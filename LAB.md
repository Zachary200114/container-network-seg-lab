# Container Network Segmentation Lab – Exercises

This lab is meant to be hackable. These guided exercises help you explore:

- Network segmentation
- Host firewalls (iptables)
- Policy-as-code for network flows
- Attacker perspective
- API + database interactions

You’ll run everything from the project root:

````bash

1. Basic Segmentation Validation

Start the lab:

docker compose up -d --build
python3 connectivity_test.py


Open the dashboard in your browser:

http://localhost:8000


Look at the Ping connectivity matrix and answer:

Which containers can ping frontend?

Which containers can ping db?

Can frontend ping db? Why or why not?

From the mgmt container, run your own tests:

docker exec -it mgmt sh
ping frontend
ping api
ping db
exit


Compare what you see in the terminal with the ping matrix on the dashboard.

2. Breaking and Fixing Network Segmentation

Edit docker-compose.yml and (temporarily) add public_net to the db service’s networks: section.

Rebuild and restart the environment:

docker compose down
docker compose up -d --build
python3 connectivity_test.py


Check:

Does frontend now show OK when pinging db in the matrix?

What does this change mean from a security standpoint?

Revert the change (remove public_net from db) and redeploy:

docker compose down
docker compose up -d --build
python3 connectivity_test.py


Confirm that frontend -> db is back to X in the ping matrix.

3. Experimenting with Policy-as-Code

Open policy.json and intentionally add a clearly bad policy, for example:

{
  "from": "frontend",
  "to": "db",
  "ports": [5432]
}


Add this object to the existing allowed_flows list and keep the JSON valid.

Run the connectivity tests:

python3 connectivity_test.py


Observe the Policy-based TCP connectivity check section:

Does frontend -> db:5432 show OK or X?

What does that tell you about:

Your actual network topology?

The difference between “declared policy” and “reality”?

Remove the bad policy from policy.json when you are done, and re-run:

python3 connectivity_test.py

4. Exploring the Host Firewall (iptables)

Enter the api container and inspect iptables:

docker exec -it api sh
iptables -L


Identify the rule that blocks db -> api:5000.

Flush all rules (this removes the protection):

iptables -F
iptables -L


From the host, re-run the connectivity tests:

python3 connectivity_test.py


Look at the policy-based checks:

What does db -> api:5000 show now (OK or X)?

How did removing the iptables rule change the behavior?

Re-add the drop rule inside api:

iptables -A INPUT -p tcp --dport 5000 -s db.container-network-seg-lab_private_net -j DROP
iptables -L
exit


Run the tests again:

python3 connectivity_test.py


Confirm that db -> api:5000 is back to X.

5. Attacker Perspective from the Public Network

Run the attack script from the host:

docker exec attacker ./attack.sh


Read the output carefully:

Which ports are open on frontend?

Which ports are open on api?

What happens when the attacker tries to resolve or scan db?

Relate these findings to:

The ping matrix (who can reach whom)

The policy-based TCP checks

Think through: from an attacker’s point of view, which parts of the environment are exposed, and which are safely hidden behind segmentation?

6. API and Database Behavior

Create a few users through the API:

curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}' \
  http://localhost:5001/users

curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"Bob","email":"bob@example.com"}' \
  http://localhost:5001/users


List users:

curl http://localhost:5001/users


Confirm the users are stored in the database.

Stop only the database container:

docker stop db


Try to list users again:

curl http://localhost:5001/users


What error do you receive?

How does the API behave when the DB is unavailable?

Start the database again and re-run the connectivity tests:

docker start db
python3 connectivity_test.py


cd ~/Documents/Personal-Projects/container-network-seg-lab
You’ll run everything from the project root:

```bash
cd ~/Documents/Personal-Projects/container-network-seg-lab

````
