from flask import Flask, render_template_string
import json
import os
import time

app = Flask(__name__)

TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Segmentation Lab Dashboard</title>
</head>
<body>
  <h1>Segmentation Lab Dashboard</h1>
  <p>Last updated: {{ last_updated }}</p>

  <h2>Ping Matrix</h2>
  <table border="1" cellpadding="5">
    <tr>
      <th>From \\ To</th>
      {% for dst in containers %}
      <th>{{ dst }}</th>
      {% endfor %}
    </tr>
    {% for row in ping %}
    <tr>
      <td>{{ row.from_name }}</td>
      {% for dst in containers %}
      <td>{{ row.to[dst] }}</td>
      {% endfor %}
    </tr>
    {% endfor %}
  </table>

  <h2>Policy-based TCP Checks</h2>
  <table border="1" cellpadding="5">
    <tr>
      <th>From</th>
      <th>To</th>
      <th>Port</th>
      <th>Status</th>
    </tr>
    {% for entry in policy %}
    <tr>
      <td>{{ entry.from_name }}</td>
      <td>{{ entry.to }}</td>
      <td>{{ entry.port }}</td>
      <td>{{ entry.status }}</td>
    </tr>
    {% endfor %}
  </table>
</body>
</html>
"""

@app.route("/")
def index():
  if not os.path.exists("/data/results.json"):
    last_updated = "No results.json found. Run connectivity_test.py."
    ping = []
    policy = []
  else:
    with open("/data/results.json", "r") as f:
      data = json.load(f)
    ts = data.get("timestamp", 0)
    last_updated = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts))
    raw_ping = data.get("ping", [])
    raw_policy = data.get("policy", [])

    ping = []
    for row in raw_ping:
      ping.append({
        "from_name": row["from"],
        "to": row["to"]
      })

    policy = []
    for entry in raw_policy:
      policy.append({
        "from_name": entry["from"],
        "to": entry["to"],
        "port": entry["port"],
        "status": entry["status"]
      })

  containers = ["frontend", "api", "db", "mgmt"]

  return render_template_string(
    TEMPLATE,
    last_updated=last_updated,
    ping=ping,
    policy=policy,
    containers=containers
  )

if __name__ == "__main__":
  app.run(host="0.0.0.0", port=8000)

