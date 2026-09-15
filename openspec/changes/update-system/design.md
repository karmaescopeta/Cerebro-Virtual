## Design

### Arquitectura

3 capas: frontend (icono + dropdown), backend (3 endpoints), docker ops (git pull + rebuild + tag/rollback).

### Backend

#### `GET /api/updates/check`
- Cerebro: lee `VERSION` local → `GET https://api.github.com/repos/karmaescopeta/Cerebro-Virtual/releases/latest` → compara `tag_name`.
- Hermes: `docker exec <container> hermes --version` → `GET https://api.github.com/repos/NousResearch/hermes-agent/releases/latest` → compara.
- Sin token GitHub (60 req/h). On error: `{"error": "github-unavailable"}`.
- Timeout 10s. No bloquear carga de página.

#### `POST /api/updates/cerebro`
- `git pull` en host (no en contenedor). Si dirty: `git stash` antes, `git stash pop` después.
- `docker compose build --no-cache backend frontend`
- `docker compose up -d --force-recreate --no-deps backend frontend`

#### `POST /api/updates/hermes`
1. `docker tag <project>-sistema-agente:latest <project>-sistema-agente:backup`
2. `docker compose build --no-cache sistema-agente`
3. `docker compose up -d --force-recreate --no-deps sistema-agente`
4. Post-checks (timeout 60s):
   - `docker inspect` container running
   - `curl :8080` responde (200/302/401)
   - `docker exec <container> python -c "import ...middleware"` → patch encuentra needle
5. Si falla: `{"success": false, "needsRollback": true}`

#### `POST /api/updates/rollback/hermes`
- `docker tag <project>-sistema-agente:backup <project>-sistema-agente:latest`
- `docker compose up -d --force-recreate --no-deps sistema-agente`
- Si no existe `:backup`: error.

### Frontend

#### Header.jsx
- Icono campana Material Symbols (`notifications`).
- Badge: `<span className="notif-badge" />` (punto rojo) si `updates.cerebro.update || updates.hermes.update`.
- Click → toggle dropdown.

#### Dropdown (componente inline o `NotificationDropdown.jsx`)
- Posición: absolute, right: 0, desplegable hacia abajo/izquierda.
- 2 secciones: Cerebro Virtual, Hermes Agent.
- Cada sección: `current → latest` + botón si update.
- Estados: idle, updating (spinner), error+rollback.

#### App.jsx
- `useEffect` al cargar: `fetch('/api/updates/check')` → `setUpdates(data)`.
- Pasar `updates` + handlers al Header.

### Docker

- `sistema-agente` Dockerfile ya hace `curl install.sh` → rebuild pilla latest automáticamente.
- `git pull` en host actualiza `backend/`, `frontend/`, `VERSION` antes de rebuild.
- Tag backup solo para Hermes (Cerebro no necesita rollback: git revert cubre).

### Edge cases
- GitHub rate limit: retornar error, no crash.
- Contenedor no arranca tras rebuild: post-check detecta, muestra rollback.
- `git pull` con conflictos: `git stash` + pull + `git stash pop`. Si stash pop falla: avisar al usuario.
- Múltiples clicks: botón deshabilitado durante update.
