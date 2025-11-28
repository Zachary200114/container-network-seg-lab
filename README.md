# Container Network Segmentation Lab

This project is a self-contained lab that simulates a small, segmented enterprise network using Docker. It is designed to demonstrate:

- Network segmentation across public, private, and management networks
- Multi-tier application architecture (frontend → API → database)
- Host-based firewalling with iptables inside a container
- Policy-as-code for defining allowed network flows
- Automated connectivity testing and a small web dashboard
- An attacker perspective from the public network

The lab is intended to be readable, reproducible, and useful as both a portfolio project and a teaching tool.

---

## High-Level Overview

The environment is built out of multiple Docker containers:

- A **frontend** web server reachable from the host
- An **API** service that talks to a **PostgreSQL** database
- A **management (mgmt)** container acting as a jump host
- An **attacker** container on the public network
- A **dashboard** that visualizes connectivity test results

Three Docker networks are used:

- `public_net` – internet-facing zone (frontend, attacker, API)
- `private_net` – internal application/data zone (API, DB, mgmt)
- `mgmt_net` – management zone (mgmt only)

Only specific containers are attached to each network, enforcing segmentation by design.

---

## Architecture

### Network Topology

```text
                +---------------------------+
                |        public_net         |
                |                           |
   Host 8080 -> | [frontend]                |
                |                           |
   Host 5001 -> | [api]                     |
                |                           |
                | [attacker]                |
                +-------------+-------------+
                              |
                              | (api is on both nets)
                              v
                +----------------------------+
                |         private_net        |
                |                            |
                |  [api]  [db]  [mgmt]       |
                +-------------+--------------+
                              |
                              v
                +----------------------------+
                |          mgmt_net          |
                |                            |
                |          [mgmt]            |
                +----------------------------+

---

## Services

### **frontend**
- Nginx serving static HTML on port 80
- Network: `public_net`
- Accessible at: **http://localhost:8080**

### **api**
- Flask application (port 5000)
- Talks to Postgres using `pg8000`
- Networks: `public_net`, `private_net`
- Accessible at: **http://localhost:5001**
- Includes `NET_ADMIN` capability and iptables firewall rules

### **db**
- PostgreSQL 16
- Network: `private_net` only
- Not exposed to host

### **mgmt**
- Lightweight management/jump container
- Networks: `private_net`, `mgmt_net`
- No exposed ports

### **dashboard**
- Flask application generating segmentation dashboard
- Reads `results.json`
- Accessible at: **http://localhost:8000**

### **attacker**
- Container with `nmap`, `curl`, and scanning tools
- Network: `public_net` only
- Used to simulate an external attacker

---

## What This Lab Demonstrates

### **1. Network segmentation**
- `frontend → api` allowed
- `frontend → db` blocked
- `attacker → db` blocked
- `db` and `mgmt` cannot reach `frontend`

### **2. Multi-tier application flow**
- Host → API (`5001`)
- API → DB (`5432` on `private_net`)

### **3. Host-based firewalling with iptables**
- `db → api:5000` intentionally blocked
- Docker would normally allow this, but iptables denies it
- Demonstrates **host-level network enforcement**

### **4. Policy-as-code testing**
- `policy.json` defines allowed flows
- `connectivity_test.py` validates:
  - Ping matrix
  - TCP checks (`nc`)
  - Saves results into `results.json`

### **5. Dashboard visualization**
Displays:
- Ping matrix table
- TCP policy results

### **6. Attacker perspective**
Attacker container performs:
- `nmap` scans
- HTTP probing
- Attempts (and fails) to reach `db`

---

## Prerequisites

- **Docker Desktop** or Docker Engine + `docker-compose`
- **Python 3** (for running `connectivity_test.py`)
```
