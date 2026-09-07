# Live Docker segmentation lab

This deployment preserves the original plain dashboard: Ping Matrix and Policy-based TCP Checks. Minimal session and exercise controls let a visitor operate a real, temporary Docker environment.

## What runs

The Vercel function creates a five-minute Sandbox VM. Docker runs the original Flask API (`lab/app.py`, copied unchanged from `../api/app.py`), PostgreSQL 16, the original static frontend, and management and attacker containers. The original `policy.json` is copied unchanged. The five containers join `public_net`, `private_net`, and `mgmt_net` with the memberships from the original Compose file. The browser dashboard replaces the original file-reading dashboard process for this deployment.

TCP probes and pings run from short-lived helper containers that join the selected service's actual network namespace. The result is the observed socket or process result. Nothing is predicted or randomized. Fixed exercises attach/detach the real database network and apply/remove the documented iptables rule inside the real API container. The original Compose workflow and source remain untouched above this directory.

The hosted wrapper uses a common tool image for mgmt/attacker rather than installing tooling in each image separately. Networks are additionally internal: the lab cannot route to outside targets. PostgreSQL uses disposable demonstration credentials. No container ports or Docker socket are published to visitors. Vercel's VM applies the memory/CPU boundary because nested cgroup resource controllers are unavailable in this runtime.

## Original policy details

`policy.json` is a test declaration, not a firewall controller. `frontend → api:80` is declared but the Flask server listens on 5000, so the port-80 check is refused. `db → api:5000` connects in the base Compose setup; the firewall drop in LAB.md is a manual exercise. The controls expose that distinction accurately.

## Deploy

The Vercel project root is this `demo` directory. It serves `public/` and `api/lab.mjs` using Node 24 and `@vercel/sandbox` 3. OIDC authentication is provided by Vercel. Required environment variables: `LAB_SESSION_SECRET`, at least 32 random characters, and `LAB_SNAPSHOT_ID`, pointing to the prepared Docker/image snapshot. Public startup fails closed without either; it never creates an unprepared VM with outbound access. Status polling reads progress and the last observed container state; tests and exercises refresh real container observations.

```sh
npm ci
npm test
vercel link
vercel env pull .env.local
node --env-file=.env.local scripts/build-snapshot.mjs
```

The build verifies the real network before emitting `.snapshot.json`. Set that ID as `LAB_SNAPSHOT_ID`. `scripts/configure-secret.mjs` generates and stores a signing key without printing it; the configuration scripts target Zachary's existing Vercel team/project. Deploy with `vercel --prod`.

Visitor sessions have a five-minute VM deadline, signed HttpOnly cookies, a 60-operation limit, serialized Docker operations, a three-active-session project cap, one active session per visitor IP hash, six starts per visitor per hour, and 30 starts per project per hour. Creation limits use the Vercel sandbox inventory and are best effort under simultaneous requests; the Hobby account's hard quotas provide an additional cap. No paid plan is configured or required. All interactions accept only enumerated lab nodes, ports, and operations.

## Verification

`npm test` covers request validation, command-injection inputs, unsupported targets/ports, signed-cookie tampering, and expiry. `scripts/smoke-live.mjs` starts the deployed Docker lab, validates actual connected/refused/isolated probes, changes the live network/firewall, verifies effects, resets, and stops the VM. Run it against the deployed origin:

```sh
node scripts/smoke-live.mjs https://network-segmentation-lab.vercel.app
```

The initial image build needs outbound package downloads; visitor sessions boot the prepared image with outbound access denied. Setup snapshots contain only project code, installed tools, and base images; they contain no account credentials.
