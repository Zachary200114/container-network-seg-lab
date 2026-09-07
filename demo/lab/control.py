"""Fixed operations against a disposable Docker lab. No caller-supplied commands."""
import concurrent.futures
import fcntl
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent
NODES = ["frontend", "api", "db", "mgmt", "attacker"]
NETWORKS = {"frontend": ["public_net"], "api": ["public_net", "private_net"], "db": ["private_net"], "mgmt": ["private_net", "mgmt_net"], "attacker": ["public_net"]}
POLICY = json.loads((ROOT / "policy.json").read_text())["allowed_flows"]

def run(*args, timeout=25, check=True):
    result = subprocess.run(list(args), capture_output=True, text=True, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(result.stderr or result.stdout or "Command failed")
    return result

def docker(*args, **kwargs):
    return run("docker", *args, **kwargs)

def boot():
    for network in ["public_net", "private_net", "mgmt_net"]:
        docker("network", "create", "--internal", network, check=False)
    # The Sandbox VM enforces memory/CPU limits; nested cgroup controllers are unavailable.
    common = []
    docker("rm", "-f", *NODES, check=False)
    docker("run", "-d", "--name", "frontend", "--network", "public_net", "-v", str(ROOT / "frontend.html") + ":/usr/share/nginx/html/index.html:ro", *common, "nginx:alpine")
    docker("run", "-d", "--name", "db", "--network", "private_net", "-e", "POSTGRES_USER=demo", "-e", "POSTGRES_PASSWORD=demo", "-e", "POSTGRES_DB=demo", "postgres:16-alpine")
    docker("run", "-d", "--name", "api", "--network", "public_net", "--cap-add", "NET_ADMIN", *common, "segmentation-api:demo")
    docker("network", "connect", "private_net", "api")
    docker("run", "-d", "--name", "mgmt", "--network", "private_net", *common, "segmentation-api:demo", "sleep", "infinity")
    docker("network", "connect", "mgmt_net", "mgmt")
    docker("run", "-d", "--name", "attacker", "--network", "public_net", *common, "segmentation-api:demo", "sleep", "infinity")
    for _ in range(30):
        if docker("exec", "api", "curl", "-fsS", "http://localhost:5000/users", check=False).returncode == 0:
            break
        time.sleep(1)
    else:
        raise RuntimeError("Original API did not become ready")
    return state()

def state():
    records = json.loads(docker("inspect", *NODES).stdout)
    nodes = [{"name": x["Name"].lstrip("/"), "running": x["State"]["Running"], "networks": list(x["NetworkSettings"]["Networks"])} for x in records]
    firewall = docker("exec", "api", "iptables", "-S", "INPUT").stdout
    observed = {"nodes": nodes, "firewallEnabled": "--dport 5000" in firewall and "-j DROP" in firewall, "dbPublic": "public_net" in next(x for x in nodes if x["name"] == "db")["networks"], "measuredAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    (ROOT.parent / "last-state.json").write_text(json.dumps(observed))
    return observed

PROBE_SCRIPT = r'''
import json, socket, sys, time
destination, port = sys.argv[1], int(sys.argv[2])
started = time.monotonic()
try:
    address = socket.gethostbyname(destination)
    with socket.create_connection((address, port), timeout=1.5):
        result = {"status": "OK", "reason": "TCP connection established", "address": address}
except socket.gaierror:
    result = {"status": "X", "reason": "Name does not resolve from this container network"}
except ConnectionRefusedError:
    result = {"status": "X", "reason": "Destination refused the TCP connection"}
except (TimeoutError, socket.timeout):
    result = {"status": "TO", "reason": "TCP connection timed out (1.5 seconds)"}
except OSError as error:
    result = {"status": "X", "reason": str(error)}
result["durationMs"] = round((time.monotonic()-started)*1000)
print(json.dumps(result))
'''

def probe(source, destination, port):
    if source not in NODES or destination not in NODES or source == destination:
        raise ValueError("Choose different lab containers")
    if not isinstance(port, int) or port not in [80, 5000, 5432]:
        raise ValueError("Choose a lab service port: 80, 5000, or 5432")
    measured = docker("run", "--rm", "--network", "container:" + source, "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "python:3.12-alpine", "python", "-c", PROBE_SCRIPT, destination, str(port), timeout=10)
    result = json.loads(measured.stdout)
    result.update({"from": source, "to": destination, "port": port, "declaredAllowed": any(flow["from"] == source and flow["to"] == destination and port in flow["ports"] for flow in POLICY)})
    return result

def ping_row(source):
    # One helper container joins the actual source network namespace for this row.
    script = "import json,subprocess; nodes=" + repr(NODES) + "; result={}; "
    script += "\nfor dest in nodes:\n if dest==" + repr(source) + ":\n  result[dest]='SELF'\n  continue\n try:\n  result[dest]='OK' if subprocess.run(['ping','-c','1','-W','1',dest],capture_output=True,timeout=2).returncode==0 else 'X'\n except subprocess.TimeoutExpired:\n  result[dest]='TO'\nprint(json.dumps(result))"
    answer = docker("run", "--rm", "--network", "container:" + source, "--read-only", "--cap-drop", "ALL", "--cap-add", "NET_RAW", "python:3.12-alpine", "python", "-c", script, timeout=15)
    return {"from": source, "to": json.loads(answer.stdout)}

def audit():
    tasks = [(f["from"], f["to"], p) for f in POLICY for p in f["ports"]]
    tasks += [("attacker", "db", 5432), ("attacker", "api", 5000), ("frontend", "db", 5432)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(lambda x: probe(*x), tasks))
        ping = list(pool.map(ping_row, NODES))
    return {**state(), "policy": results, "ping": ping}

def experiment(change, enabled):
    if change == "db-public":
        if state()["dbPublic"] != enabled:
            docker("network", "connect" if enabled else "disconnect", "public_net", "db")
    elif change == "firewall":
        address = json.loads(docker("inspect", "db").stdout)[0]["NetworkSettings"]["Networks"]["private_net"]["IPAddress"]
        rule = ["INPUT", "-p", "tcp", "--dport", "5000", "-s", address, "-j", "DROP"]
        exists = docker("exec", "api", "iptables", "-C", *rule, check=False).returncode == 0
        if exists != enabled:
            docker("exec", "api", "iptables", "-A" if enabled else "-D", *rule)
    else:
        raise ValueError("Unknown experiment")
    return state()

def main():
    action = sys.argv[1]
    # Lock protects the real Docker control plane from concurrent API calls.
    with open(ROOT.parent / "operation.lock", "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if action not in ["boot", "status"]:
            counter = ROOT.parent / "operation-count.txt"
            count = int(counter.read_text()) if counter.exists() else 0
            if count >= 60:
                raise ValueError("This session has reached its 60-operation limit")
            counter.write_text(str(count + 1))
        dispatch(action)

def dispatch(action):
    if action == "boot": result = boot()
    elif action == "status": result = state()
    elif action == "audit": result = audit()
    elif action == "probe": result = probe(sys.argv[2], sys.argv[3], int(sys.argv[4]))
    elif action == "experiment": result = experiment(sys.argv[2], sys.argv[3] == "true")
    elif action == "reset":
        experiment("db-public", False)
        result = experiment("firewall", False)
    else: raise ValueError("Unsupported action")
    print(json.dumps(result))

if __name__ == "__main__":
    main()
