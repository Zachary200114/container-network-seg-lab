import subprocess
import json

containers = ["frontend", "api", "db", "mgmt"]

def run_cmd(cmd, timeout=3):
    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout
        )
        return result.returncode
    except subprocess.TimeoutExpired:
        return 124
    except Exception:
        return 125

def test_ping(src, dst):
    if src == dst:
        return "SELF"

    cmd = ["docker", "exec", src, "ping", "-c", "1", "-W", "1", dst]
    code = run_cmd(cmd)

    if code == 0:
        return "OK"
    elif code == 124:
        return "TO"
    elif code == 125:
        return "ERR"
    else:
        return "X"

def test_tcp(src, dst, port):
    # Use nc (netcat) to test TCP connectivity
    cmd = [
        "docker", "exec", src,
        "sh", "-c",
        "nc -z -w 1 " + dst + " " + str(port)
    ]
    code = run_cmd(cmd)

    if code == 0:
        return "OK"
    elif code == 124:
        return "TO"
    elif code == 125:
        return "ERR"
    else:
        return "X"

def print_ping_matrix():
    print("")
    print("Ping connectivity matrix (by container name):")
    print("")

    header = "From\\To"
    for dst in containers:
        header = header + "\t" + dst
    print(header)

    for src in containers:
        row = src
        for dst in containers:
            status = test_ping(src, dst)
            row = row + "\t" + status
        print(row)

def load_policy():
    with open("policy.json", "r") as f:
        data = json.load(f)
    return data.get("allowed_flows", [])

def check_policy():
    print("")
    print("Policy-based TCP connectivity check:")
    print("")

    flows = load_policy()
    for flow in flows:
        src = flow.get("from")
        dst = flow.get("to")
        ports = flow.get("ports", [])

        for port in ports:
            status = test_tcp(src, dst, port)
            print(src + " -> " + dst + ":" + str(port) + " => " + status)

def main():
    print_ping_matrix()
    check_policy()

if __name__ == "__main__":
    main()

