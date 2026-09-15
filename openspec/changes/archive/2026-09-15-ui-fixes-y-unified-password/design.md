# Design: ui-fixes-y-unified-password

## Context

Verificado experimentalmente (contenedor efímero + volumen con datos):
- `INITIAL_PASSWORD` de omniroute **se re-aplica en cada recreate** → cambiar contraseña = actualizar `.env` + `docker compose up -d --force-recreate --no-deps omniroute`. Sin migración de datos.
- `/omniroute/` nginx es inviable: OmniRoute (Next.js) emite redirects absolutos (`/dashboard`) y sus rutas `/api/...` colisionan con las del backend Cerebro tras el proxy. Compose ya publica `20128:20128` en el host → usar URL directa.
- Backend lee `OMNIROUTE_MANAGE_PASSWORD` vía `os.getenv` en 3 sitios (~3319, ~3409, ~3522): tras cambiarla en el wizard el proceso no ve la nueva hasta recreate del backend → helper de lectura con fallback a `/app/.env` (el .env ya está montado rw en backend).
- Contraseña Hermes: wizard ya guarda `dashboard.password` en agent-config.json → `generate_config.py` la hashea en cada arranque del contenedor. Nada que cambiar ahí: solo propagar el mismo valor a OmniRoute.
- Versión: `GET /api/version` devuelve `{current, githubRepo}` leyendo `/app/VERSION` (montado del repo). Sidebar hardcodea `v1.0.4-stable`.
- Scrollbar horizontal: localizar en implementación con devtools (candidatos: `.modelos-summary-change`, grids con `1fr` y `word-break` ausente, `width: 100vw` + padding).

## Goals / Non-Goals

- Goal: una sola credencial (user+pass) configura Hermes dashboard y OmniRoute.
- Goal: link OmniRoute funcional.
- Goal: versión real de git/VERSION, header/sidebar limpios, responsive completo.
- Non-Goal: SSO real u OAuth (INITIAL_PASSWORD re-aplicada por recreate es suficiente).
- Non-Goal: cambiar el mecanismo de auth de Hermes (generate_config.py intacto).
- Non-Goal: túnel Cloudflare para :20128 (acceso LAN/host; el túnel solo expone 5173).

## Decisions

### D1. Password unificada — flujo wizard
`WizardStep1` ya pide user+password. Tras `POST /api/init/configure` (guarda agent-config), el backend:
1. Si el request trae `dashboardPassword`, escribe `OMNIROUTE_MANAGE_PASSWORD=<pwd>` en `.env` (helper `_update_env_token` ya existe, mismo patrón que el tunnel token).
2. Recrea omniroute: `docker compose up -d --force-recreate --no-deps omniroute` (subprocess, patrón update-system-v2: `run_in_threadpool`, dual-bind docker:cli).
3. Login de verificación contra `http://omniroute:20128/api/auth/login` (200 = OK; si falla, respuesta con warning no bloqueante).
Si `.env` ya tenía `OMNIROUTE_MANAGE_PASSWORD` y el wizard envía vacío → no tocar (idempotencia en reconfiguraciones).

### D2. Cambio de contraseña posterior (Ajustes)
`PUT /api/agent/config` acepta `dashboardUser`/`dashboardPassword` opcionales → mismo flujo D1 (env + recreate omniroute + regenerate config Hermes ya ocurre en arranque; para Hermes hace falta recreate sistema-agente también). UI en Ajustes: sección "Acceso" con los 2 campos + botón Guardar.

### D3. Lectura fresca de la contraseña en backend
Helper `_omni_password()` = `os.getenv("OMNIROUTE_MANAGE_PASSWORD")` o parse de `/app/.env` (mismo patrón que `or_key` en `omniroute_provision`). Reemplaza los 3 `os.getenv` directos. Evita el stale tras cambiar contraseña sin recreate del backend.

### D4. Link OmniRoute
ModelosView: `<a href={\`http://${location.hostname}:20128\`} target="_blank">` — mismo patrón que el botón "Dashboard" de LocalAISection (línea ~310). Borrar location nginx `/omniroute/`.

### D5. Versión
`loadSystemInfo`-style fetch `/api/version` en App → prop a Sidebar. Si `unknown` → ocultar fila. Título del repo (Header) → link a `https://github.com/{githubRepo}` (target _blank).

### D6. Header sin health badge
Borrar bloque `header-badge` de Header.jsx + CSS `.header-badge`/`pulse-dot`. El estado del sistema ya es visible en Dashboard (containers status).

### D7. Logout
Borrar botón del Sidebar + CSS huérfano. (Sin auth front no hay logout real; cuando llegue auth, se añade en Header.)

### D8. Responsive
Mobile-first en el media query existente (768px):
- `.app-main` padding 16px, `.modelos-grid` 1col (ya), `.header-title` centrado sin badge, `.notif-dropdown` right:0 width:calc(100vw-32px).
- Chat: burbujas max-width 100%, botones toggle wrap, input barra apilada si no cabe.
- Wizard: form inputs 100%, step indicator compacta.
- Cerebro/Grafo: scroll horizontal interno permitido solo en el grafo (canvas), no en la página.
- PC: `overflow-x: clip` en body + fix del elemento culpable (detectar con devtools; NO mask a ciegas).

## Risks / Trade-offs

- Recreate omniroute en wizard añade ~10s al configure → aceptable (ya hay spinner de "Iniciando el agente").
- Si el usuario cambia la contraseña en Ajustes, sesión de OmniRoute abierta en otra pestaña caduca → mensaje en la UI lo avisa.
- `:20128` requiere misma red que el host (acceso local/túnel lan). Para acceso remoto puro (túnel CF), el link no funcionará — documentado en Ajustes.
