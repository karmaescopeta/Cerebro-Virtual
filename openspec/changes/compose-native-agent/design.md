# Design: Compose-Native Agent & Multi-Instance Support

## Context

Cerebro Virtual runs 5 Docker containers via `docker-compose.yml`. The agent (`sistema-agente`) is defined with `profiles: [agent]`, so `docker compose up` doesn't start it by default. The backend creates it ad-hoc with Docker SDK (`client.containers.run()`), producing a standalone container outside the compose project.

All `container_name` values are hardcoded. The backend references `cerebro-agente`, `cerebro-backend`, etc. in ~25 places via `subprocess.run(["docker", "stop", "cerebro-agente"])`, `docker exec cerebro-agente`, and Docker SDK `containers.get("cerebro-backend")`.

The user needs multi-instance: multiple isolated cerebros on the same host, each with its own compose project name.

## Goals / Non-Goals

**Goals:**
- Agent managed exclusively by `docker compose`.
- No hardcoded `container_name` in compose or backend.
- Multiple instances on same host without collision.
- Ports parametrized via `.env`.

**Non-Goals:**
- No orchestration layer for managing N instances (no web UI to spawn instances).
- No shared services between instances.
- No dynamic port allocation (user sets ports in `.env` manually).

## Decisions

### D1: Remove `profiles` from all services

**Decision:** Delete `profiles: [agent]` and `profiles: [tools]` from docker-compose.yml.

**Why:** Profiles cause services to be skipped on `docker compose up`. The agent's entrypoint already waits for config with a `while` loop — it's safe to start it before config exists. The tools container has `restart: "no"` so it won't loop.

**Alternative:** Keep profiles and use `docker compose --profile agent up -d`. Rejected — the user wants `docker compose up -d` to bring everything up, and the wizard's agent management shouldn't need to pass `--profile` flags.

### D2: Remove all `container_name` from compose

**Why:** Compose generates `<project>-<service>-1`. Hardcoded names collide on multi-instance.

### D3: Backend uses `docker compose exec` instead of `docker exec <name>`

**Why:** `docker compose exec` scopes to the project automatically. No need to know the container name.

**How:** The backend runs inside a container with Docker socket mounted. It can call `subprocess.run(["docker", "compose", "exec", "sistema-agente", ...])`. But — the backend container doesn't know its compose project name or the compose file location on the host.

**Alternative chosen:** Use `COMPOSE_PROJECT_NAME` env var. The backend reads it from its own environment (set in compose). Then: `subprocess.run(["docker", "compose", "-p", project_name, "exec", "sistema-agente", ...])`.

For HTTP calls to the agent, use the compose service DNS name `http://sistema-agente:8080` (already works within the Docker network).

### D4: Backend discovers vault host path via env var

**Current:** Backend inspects its own container to find the host mount source of `/app/vault`.

**New:** Set `VAULT_HOST_PATH` in docker-compose.yml from `.env`. Backend reads it directly. Simpler, no Docker SDK inspect needed.

### D5: `start_agent_container()` replaced by `compose start`

**Current flow:**
1. `start.bat` → `docker compose --profile agent up -d` (agent starts, waits for config)
2. Wizard saves config
3. `POST /api/agent/start` → `start_agent_container()` → `client.containers.run()` (creates standalone container)

**New flow:**
1. `start.bat` → `docker compose -p <name> up -d` (agent starts, waits for config)
2. Wizard saves config
3. `POST /api/agent/start` → `docker compose -p <name> start sistema-agente` (or just `restart` since it's already running but waiting)

### D6: `reset_agent_config()` uses `compose stop`

**Current:** `docker stop cerebro-agente` + `docker rm -f cerebro-agente`.

**New:** `docker compose -p <name> stop sistema-agente`. Container stays (stopped), compose-managed. On reconfigure: `docker compose -p <name> start sistema-agente`.

### D7: `full_restart_agent()` uses `compose up --force-recreate`

**New:** `docker compose -p <name> build --no-cache sistema-agente && docker compose -p <name> up -d --force-recreate sistema-agente`.

### D8: Port parametrization in compose

```yaml
ports:
  - "${BACKEND_PORT:-8000}:8000"
  - "${FRONTEND_PORT:-5173}:80"
  - "${AGENT_PORT:-8080}:8080"
  - "${SEARXNG_PORT:-8888}:8080"
```

### D9: Frontend port references

Frontend hardcodes `localhost:8080` in two places (DashboardView, AjustesView) and `localhost:8000` in vite.config.js proxy.

- `vite.config.js`: use `VITE_BACKEND_URL` env or default to `localhost:8000`.
- DashboardView/AjustesView: use `VITE_AGENT_URL` or construct from `window.location` (replace port).
- For production (nginx in frontend container): nginx proxies `/api` to `backend:8000` (DNS name). No port hardcoding needed.

### D10: `.env` template

```env
COMPOSE_PROJECT_NAME=cerebrovirtual
OPENROUTER_API_KEY=
BACKEND_PORT=8000
FRONTEND_PORT=5173
AGENT_PORT=8080
SEARXNG_PORT=8888
CLOUDFLARE_TUNNEL_TOKEN=
VAULT_HOST_PATH=
```

### D11: `start.bat` changes

- Detect Docker installed. If missing → show download link (`https://www.docker.com/products/docker-desktop/`) and exit.
- No Cloudflare detection (web service, not local install).
- Check if `COMPOSE_PROJECT_NAME` is in `.env`. If not, prompt user or default.
- Use `docker compose -p %PROJECT_NAME% up -d --build` (no `--profile`).
- Display ports from `.env` in the success message.

### D12: Cloudflare Tunnel service

**Decision:** Add `cloudflared` service to docker-compose.yml.

```yaml
cloudflared:
  image: cloudflare/cloudflared:latest
  restart: unless-stopped
  environment:
    - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN:-}
  command: tunnel --no-autoupdate run
  networks:
    - cerebro-network
  depends_on:
    - frontend
```

Without token: container exits 0. Compose `restart: unless-stopped` won't restart on exit 0. Actually — `unless-stopped` DOES restart on non-zero. Exit 0 = no restart. Need to verify. Alternative: use a conditional entrypoint that sleeps if no token.

**Simpler:** Use compose `profiles` for cloudflared only. `profiles: [tunnel]`. start.bat runs `docker compose -p <name> --profile tunnel up -d` only if token exists. No dormant container.

**Chosen:** Conditional in start.bat. If `CLOUDFLARE_TUNNEL_TOKEN` is set → add `--profile tunnel` to the compose command. If not → skip. cloudflared has `profiles: [tunnel]` in compose.

### D13: Wizard Cloudflare token step

**Decision:** Wizard collects token after OpenRouter API key. Backend saves it in `agent-config.json` and writes to `.env` on host.

**Problem:** Backend runs inside container. Can't write to host `.env` directly.

**Solution:** Backend stores token in `agent-config.json` (vault). A script in start.bat or a compose env file mechanism reads from there.

**Simpler:** The wizard saves the token in `agent-config.json`. The backend passes it as env var to the compose project via `docker compose --env-file` mechanism. OR: start.bat reads `agent-config.json` for the token and writes it to `.env` before starting.

**Chosen:** Wizard saves token in `agent-config.json`. `start.bat` on each run reads `agent-config.json` → if `cloudflareTunnelToken` exists and `.env` doesn't have it → write to `.env`. This way the wizard is the single input point, start.bat syncs to `.env`.

### D14: Nginx proxy for `/agent`

**Decision:** Frontend nginx config adds:

```nginx
location /agent/ {
    proxy_pass http://sistema-agente:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

WebSocket upgrade for Hermes dashboard real-time features.

### D15: No local auth

**Decision:** Zero local auth code. Cloudflare Zero Trust handles remote access. LAN is open.

**Rationale:** User confirmed LAN doesn't need auth. Cloudflare Access policies filter who can reach the tunnel. Less code = less attack surface.

### D16: .gitignore — clean base repo

**Decision:** Create/fix `.gitignore` so the repo is a clean base. No `.env`, no `vault/` contents, no `.venv/`, no `node_modules/`, no `__pycache__/`, no `.hermes/`.

```gitignore
.env
.env.*
!.env.example
.venv/
node_modules/
__pycache__/
*.pyc
.hermes/
vault/
!vault/.gitkeep
!vault/raw/.gitkeep
!vault/raw/.processed/.gitkeep
!vault/wiki/.gitkeep
!vault/outputs/.gitkeep
!vault/system/.gitkeep
!vault/chat-sesiones/.gitkeep
```

The user clones → `start.bat` creates `.env` from `.env.example` and vault dirs. Clean base.

### D17: Version banner — update notification

**Decision:** Backend endpoint `GET /api/version` returns current version (from `VERSION` file in repo root). Frontend checks GitHub Releases API once per day. If newer → banner. User can dismiss ("No molestar") → stored in localStorage.

**Flow:**
1. Repo has `VERSION` file: `1.0.0`
2. GitHub tag matches: `v1.0.0`
3. Backend `GET /api/version` → `{current: "1.0.0"}`
4. Frontend fetches `https://api.github.com/repos/<owner>/<repo>/releases/latest` → compares
5. If newer → banner with link to release notes
6. User clicks "No molestar" → localStorage flag → no banner for 7 days

**No auto-update.** User runs `git pull` + `start.bat` manually.

### D18: Vault backward compatibility

**Decision:** `agent-config.json` and `agent-keys.json` schemas MUST be additive. New fields get defaults. Old fields stay. Code reads with `.get()` + fallback.

**Rule:** No field is ever removed or renamed. If structure changes, migration code in backend startup handles it silently.

Markdown files in `vault/` are plain text. No versioning needed. A wiki page from v1.0 works in v2.0.

### D19: Hermes agent version pinning

**Decision:** No auto-update of Hermes inside the container. The Dockerfile pins to the installer's current version at build time. To update Hermes: `docker compose build --no-cache sistema-agente` (manual, user-initiated).

**Rationale:** Hermes can change config schema, break profiles, change APIs. Auto-update = risk of bricking the cerebro. Manual = user verifies after update.

## Risks / Trade-offs

- **[Backend can't call `docker compose` from inside container]** Backend has Docker CLI installed (`docker.io` package). `docker compose` (v2 plugin) may not be available inside the container. → Install `docker-compose-plugin` in backend Dockerfile, or use `docker compose` via the socket (the Docker daemon on the host has compose v2). **Test:** verify `docker compose` works from inside the backend container with the socket mounted.

- **[Agent runs before config exists]** Agent entrypoint already handles this with a `while` loop. → No risk. Already solved.

- **[Multi-instance: port conflicts]** Two instances with same ports → bind failure. → `.env` per instance. User responsibility. No auto-allocation.

- **[Breaking change for existing deployments]** Users with running `cerebrovirtual` stack need to `docker compose down`, update `.env`, and restart. → Migration: add step in `start.bat` to detect old containers and warn.

## Migration Plan

1. Update `docker-compose.yml` (remove profiles, container_name, add port vars).
2. Update `backend/Dockerfile` (ensure `docker compose` v2 available).
3. Update `backend/app/main.py` (replace all hardcoded names + SDK calls).
4. Update `start.bat` (project name, no --profile).
5. Update `.env` template.
6. Update frontend port references.
7. Test: `docker compose down` → `start.bat` → wizard → agent starts → chat works → reset works → full-restart works.
8. Test multi-instance: second copy with different `.env` ports.

## Open Questions

- **Backend Docker SDK `get_docker_client()`:** Still needed for image builds in `full_restart_agent()`. Can be replaced by `docker compose build` CLI. → D7 handles this. SDK client can be removed entirely if no other SDK calls remain.
- **`herramientas` container:** Has `restart: "no"`. Started by compose, runs graphify, exits. No changes needed beyond removing `profiles: [tools]`.
