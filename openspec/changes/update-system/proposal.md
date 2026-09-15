## Why

El sistema no tiene forma de detectar ni aplicar actualizaciones. Hay dos componentes que pueden actualizarse independientemente: Cerebro Virtual (repo GitHub propio) y Hermes Agent (instalado en el contenedor `sistema-agente` via `install.sh`). Hoy el usuario debe saber manualmente si hay updates y hacer rebuild a mano. Necesitamos detección automática + rollback seguro.

## What Changes

- **Frontend**: icono campana en Header (superior derecha) con punto rojo si hay updates. Desplegable lateral izquierdo (mismo patrón que chat sessions) muestra 2 secciones: "Cerebro Virtual" y "Hermes Agent". Cada una indica versión actual vs disponible + botón "Actualizar".
- **Backend**: 3 endpoints nuevos:
  - `GET /api/updates/check` — compara versiones locales vs remotas (GitHub API para Cerebro, `hermes --version` + GitHub releases para Hermes).
  - `POST /api/updates/cerebro` — `git pull` del repo local + rebuild contenedor `backend` + `frontend`.
  - `POST /api/updates/hermes` — tag imagen actual como backup → rebuild `sistema-agente` → post-checks → si falla, botón rollback.
- **Rollback**: `docker tag` de imagen pre-update → si post-check falla, endpoint `POST /api/updates/rollback/hermes` restaura imagen backup + recreate.
- **Post-checks**: contenedor arranca + `:8080` responde + `patch_hermes_dashboard_auth.py` encuentra needle. Si falla, mostrar botón rollback en UI.

## Capabilities

### New Capabilities
- `update-detection`: Detección de versiones disponibles (Cerebro Virtual via GitHub releases, Hermes Agent via GitHub releases + versión instalada en contenedor).
- `update-apply`: Aplicar updates con rebuild del contenedor correspondiente. Rollback automático pre-taggeando imagen anterior.
- `update-ui`: Icono notificaciones en Header con badge rojo, desplegable lateral mostrando estado de updates.

### Modified Capabilities
- `header`: Header ahora incluye icono notificaciones con badge.
- `version-endpoint`: `GET /api/version` ampliado o complementado con `/api/updates/check`.

## Impact

- **Frontend**: `Header.jsx` (nuevo componente notificaciones), `App.jsx` (fetch updates al cargar).
- **Backend**: `main.py` (3-4 endpoints nuevos, helpers de git/docker/github API).
- **Docker**: `sistema-agente` Dockerfile ya hace `curl install.sh` → rebuild pilla latest. `git pull` en host antes de rebuild backend/frontend.
- **Seguridad**: GitHub API rate limit sin token (60 req/h). Suficiente para check on-load.
- **Rollback**: 1 solo backup (imagen anterior). No N versiones.
