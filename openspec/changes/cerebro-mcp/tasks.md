# Tasks: cerebro-mcp (rediseño 2026-09-23)

## Backend — mcp_router.py (archivo nuevo)
- [ ] 1.1 Router con auth bearer: lookup en `mcp_tokens` (activo), 401 si falta/revocado; update `ultima_conexion` en cada llamada válida
- [ ] 1.2 Tablas `mcp_tokens` (token, nombre, `requiere_confirmacion` default 0, creado, ultima_conexion, revocado) + `mcp_consultas` (migración idempotente al arrancar)
- [ ] 1.3 `POST /mcp` JSON-RPC: `initialize`, `tools/list`, `tools/call` → despacha a las 3 operaciones
- [ ] 1.4 REST shim: `POST /api/ext/consultar`, `GET /api/ext/resultado/{id}`, `POST /api/ext/feedback` (mismas funciones internas que MCP)
- [ ] 1.5 `consultar`: prompt + `_ask_hermes` + fila en `mcp_consultas`. Token en modo directo (default): estado `confirmada` + respuesta en la misma respuesta HTTP. Token en modo confirmación: estado `pendiente`, devuelve `{id, estado}`. Devuelve siempre `{id, estado, respuesta?}`
- [ ] 1.6 `resultado(id)`: estado + respuesta/motivo (solo relevante en modo confirmación)
- [ ] 1.7 `feedback(id, exito|fallo, notas)`: escribe `vault/soluciones/sol-<id>.md` (fallo ⇒ "NO APLICAR"), marca `entregada`

## Backend — gestión UI (mismo router, auth UI normal)
- [ ] 2.1 `POST /api/devices/tokens` (crear con `requiere_confirmacion`, devuelve token 1 vez), `GET` (lista con actividad), `POST .../{id}/revocar`, `POST .../{id}/restaurar`, `POST .../{id}/modo` (toggle confirmación)
- [ ] 2.2 `GET /api/devices/consultas` (historial + pendientes), `POST /api/devices/consultas/{id}/confirmar|rechazar`
- [ ] 2.3 `POST /api/devices/tokens/{id}/info` — sube/guarda `vault/dispositivos/<nombre>.md`

## Frontend — tab "Dispositivos"
- [ ] 3.1 Tab nuevo en navegación existente
- [ ] 3.2 Lista dispositivos: nombre, modo (Directo/Confirmación), última conexión, nº consultas, estado; crear (token mostrado 1 vez + selector modo), revocar/restaurar, toggle modo
- [ ] 3.3 Por dispositivo: ver/editar doc de información (textarea → vault/dispositivos/)
- [ ] 3.4 Historial de consultas: pendientes arriba con Confirmar/Rechazar (+motivo) — solo aparecen consultas de tokens en modo confirmación; poll 10s con vista abierta

## Docs
- [ ] 4.1 `docs/ejemplo-cliente.md`: sketch ESP32 modo directo (POST consultar → leer respuesta del JSON) + modo confirmación (POST → poll GET resultado) + script Python requests, con token por dispositivo

## Verificación e2e (desde cero, real, con limpieza)
- [ ] 5.1 Rebuild; curl `/mcp` sin token → 401; token revocado → 401
- [ ] 5.2 `tools/list` con token → 3 herramientas
- [ ] 5.3 Token modo directo: `consultar` real sobre doc real del vault → respuesta en la misma llamada (`estado=confirmada`)
- [ ] 5.4 Token modo confirmación: `consultar` → `pendiente`; visible en tab; Confirmar en UI → `resultado(id)` devuelve respuesta; rechazar → motivo
- [ ] 5.5 Toggle modo en UI cambia el flujo del token (directo → confirmación)
- [ ] 5.6 `feedback` exito/fallo → docs en vault/soluciones/; fallo con "NO APLICAR"; indexado los pica
- [ ] 5.7 REST shim mismo flujo con curl simple (simula ESP32)
- [ ] 5.8 Doc de dispositivo subido → visible en vault/dispositivos/ e indexado
- [ ] 5.9 Limpieza: borrar dispositivos/consultas/docs de prueba