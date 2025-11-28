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

```
