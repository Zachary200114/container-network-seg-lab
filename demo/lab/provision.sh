#!/bin/sh
set -eu
LAB_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$LAB_ROOT"
rm -f "$LAB_ROOT/failed" "$LAB_ROOT/ready" "$LAB_ROOT/operation-count.txt"
status() { printf '%s\n' "$1" > "$LAB_ROOT/progress.txt"; }
trap 'status "Provisioning failed. Start a new session to retry."; touch "$LAB_ROOT/failed"' EXIT
status 'Installing Docker in your isolated lab…'
if ! command -v docker >/dev/null; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io
fi
if ! docker info >/dev/null 2>&1; then
  dockerd --host=unix:///var/run/docker.sock > "$LAB_ROOT/dockerd.log" 2>&1 &
  for i in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 1; done
fi
docker info >/dev/null
status 'Loading the lab container images…'
docker image inspect python:3.12-alpine >/dev/null 2>&1 || docker pull python:3.12-alpine
docker image inspect postgres:16-alpine >/dev/null 2>&1 || docker pull postgres:16-alpine
docker image inspect nginx:alpine >/dev/null 2>&1 || docker pull nginx:alpine
status 'Building the original Flask API and probe tools…'
cp /etc/pki/ca-trust/source/anchors/vercel-proxy-ca.pem "$LAB_ROOT/lab/vercel-proxy-ca.crt" 2>/dev/null || cp /etc/ssl/certs/ca-certificates.crt "$LAB_ROOT/lab/vercel-proxy-ca.crt"
docker image inspect segmentation-api:demo >/dev/null 2>&1 || docker build -t segmentation-api:demo "$LAB_ROOT/lab"
status 'Connecting frontend, API, database, management, and attacker containers…'
python3 "$LAB_ROOT/lab/control.py" boot
status 'Ready. Docker containers are running.'
touch "$LAB_ROOT/ready"
trap - EXIT
