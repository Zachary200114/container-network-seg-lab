# Container Network Segmentation Lab

A hands-on lab that simulates a small, segmented enterprise network using Docker:

- **Public network** with a frontend web server and an attacker box  
- **Private network** with an API and a PostgreSQL database  
- **Management network** with a jump host  
- **Host-based firewall** (iptables) on the API  
- **Policy-as-code** connectivity tester + **Flask dashboard**

The lab shows how network segmentation, host firewalls, and automated testing all fit together.

---

## Architecture Overview

### Networks

The lab uses three Docker networks:

- `public_net` – internet-facing zone (frontend + attacker + API)
- `private_net` – internal backend/data zone (API + DB + mgmt)
- `mgmt_net` – dedicated management network (mgmt only)

### Services

```text
+---------------------------+         +----------------------------+
|         public_net        |         |         private_net        |
|                           |         |                            |
|  [frontend]   [attacker]  |         |    [api]  [db]  [mgmt]     |
+---------------------------+         +----------------------------+

outside host (you) can talk to:
- frontend: http://localhost:8080
- api:      http://localhost:5001
- dashboard: http://localhost:8000

