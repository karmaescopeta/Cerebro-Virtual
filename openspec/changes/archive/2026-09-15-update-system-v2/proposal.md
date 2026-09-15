# Proposal: Update System v2

## Why
El update-system actual solo cubre Cerebro Virtual + Hermes. Con OmniRoute y Ollama nuevos, y repos comunitarios que evolucionan rápido, el usuario quiere saber qué componente tiene update, qué trae, y actualizar sin romper el sistema.

## What Changes
- Registro de componentes en `sistema-agente/config/update_targets.yaml` (o dict en backend): nombre, fuente (imagen docker / git repo), versión actual detectada, upstream.
  Componentes: cerebro-backend, cerebro-frontend, hermes-agente, omniroute, ollama, searxng, cloudflared, graphify (si existe como repo/herramienta), herramientas.
- Detección por componente:
  - Imágenes Docker (`omniroute`, `ollama`, `searxng`, `cloudflared`): comparar `docker images` digest local vs `docker manifest inspect` del registry (o etiqueta `latest` digest).
  - Repos git (cerebro, hermes, graphify): `git fetch` + comparar HEAD local vs `origin/main`.
- Cada componente con update muestra: versión actual → nueva, y **resumen de novedades**: últimos commits/release notes (GitHub API `/releases/latest` + `/compare`), truncado a ~500 chars.
- Compatibilidad: tras aplicar una actualización, smoke-test automático (contenedores up, endpoints :8000/:5173/:8080/:20128 responden, patch Hermes needle presente, vault accesible). Si falla → rollback automático (tag backup anterior / git reset) + notificación en UI.
- UI: página/nueva sección de Actualizaciones (diseño lo define el usuario después; el backend expone los datos, el diseño se adapta).

## Impact
- Affected: backend (endpoints `/api/updates/*` — extiende update-system actual), frontend página updates, nuevos campos en update_targets.
- Risks: rate-limit GitHub API sin token → usar token opcional en .env si existe.
- Rollback: sistema anterior intacto, es extensión.

## Decisiones (ponytail)
- Detección de imágenes: digest del registry vía `docker manifest inspect` (ya disponible con docker instalado), sin SDK extra.
- Resumen: primeras 500 chars del body del release + link. No parsing de CHANGELOG completo.
- Smoke-test: reutiliza el post-check del update-system actual, añade omniroute + ollama a la lista.
