#!/bin/sh

echo "===================================="
echo " Attacker container on public_net"
echo "===================================="
echo ""

echo "== ENV INFO =="
echo "Hostname: $(hostname)"
echo "IP addresses:"
ip addr show
echo ""

echo "== DNS test: can we resolve container names? =="
echo "Trying to resolve 'frontend'..."
nslookup frontend 2>/dev/null || echo "nslookup frontend failed"

echo "Trying to resolve 'api'..."
nslookup api 2>/dev/null || echo "nslookup api failed"

echo "Trying to resolve 'db'..."
nslookup db 2>/dev/null || echo "nslookup db failed (expected, db is on private_net only)"
echo ""

echo "== Nmap scan against frontend =="
nmap -Pn frontend || echo "nmap against frontend failed"
echo ""

echo "== Nmap scan against api =="
nmap -Pn api || echo "nmap against api failed"
echo ""

echo "== Trying HTTP requests to frontend and api =="
echo "curl http://frontend/ ..."
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://frontend/ || echo "curl to frontend failed"

echo "curl http://api:5000/ ..."
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://api:5000/ || echo "curl to api:5000 failed"
echo ""

echo "== Trying to reach db (should fail, not on public_net) =="
echo "nmap -Pn db ..."
nmap -Pn db || echo "nmap db failed (expected, no route / no DNS)"

echo ""
echo "Attack simulation complete."

