# Tasks: cerebro-mcp

## Backend — mcp_router.py (archivo nuevo)
- [ ] 1.1 Router con auth bearer: lookup en `mcp_tokens` (activo), 401 si falta/revocado; update `ultima_conexion` en cada llamada válida
- [ ] 1.2 Tablas `mcp_tokens` + `mcp_consultas` (migración idempotente al arrancar)
- [ ] 1.3 `POST /mcp` JSON-RPC: `initialize`, `tools/list`, `tools/call` → despacha a las 3 operaciones
- [ ] 1.4 REST shim: `POST /api/ext/consultar`, `GET /api/ext/resultado/{id}`, `POST /api/ext/feedback` (mismas funciones internas que MCP)
- [ ] 1.5 `consultar`: prompt + `_ask_hermes` + fila en `mcp_consultas` (pendiente | confirmada si `sin_confirmacion`); devuelve `{id, estado, respuesta?}`
- [ ] 1.6 `resultado(id)`: estado + respuesta/motivo
- [ ] 1.7 `feedback(id, exito|fallo, notas)`: escribe `vault/soluciones/sol-<id>.md` (fallo ⇒ "NO APLICAR"), marca `entregada`

## Backend — gestión UI (mismo router, auth UI normal)
- [ ] 2.1 `POST /api/devices/tokens` (crear, devuelve token 1 vez), `GET` (lista con actividad), `POST .../{id}/revocar`, `POST .../{id}/restaurar`
- [ ] 2.2 `GET /api/devices/consultas` (historial + pendientes), `POST /api/devices/consultas/{id}/confirmar|rechazar`
- [ ] 2.3 `POST /api/devices/tokens/{id}/info` — sube/guarda `vault/dispositivos/<nombre>.md`

## Frontend — tab "Dispositivos"
- [ ] 3.1 Tab nuevo en navegación existente
- [ ] 3.2 Lista dispositivos: nombre, última conexión, nº consultas, estado; crear (token mostrado 1 vez), revocar/restaurar
- [ ] 3.3 Por dispositivo: ver/editar doc de información (textarea → vault/dispositivos/)
- [ ] 3.4 Historial de consultas: pendientes arriba con Confirmar/Rechazar (+motivo); poll 10s con vista abierta

## Docs
- [ ] 4.1 `docs/ejemplo-cliente.md`: sketch ESP32 (HTTPClient POST consultar / GET resultado) + script Python requests, con token por dispositivo

## Verificación e2e (desde cero, real, con limpieza)
- [ ] 5.1 Rebuild; curl `/mcp` sin token → 401; token revocado → 401
- [ ] 5.2 `tools/list` con token → 3 herramientas
- [ ] 5.3 `consultar` real sobre doc real del vault → pendiente; visible en tab
- [ ] 5.4 Confirmar en UI → `resultado(id)` devuelve respuesta; rechazar → motivo
- [ ] 5.5 `sin_confirmacion=true` → respuesta directa
- [ ] 5.6 `feedback` exito/fallo → docs en vault/soluciones/; fallo con "NO APLICAR"; indexado los pica
- [ ] 5.7 REST shim mismo flujo con curl simple (simula ESP32)
- [ ] 5.8 Doc de dispositivo subido → visible en vault/dispositivos/ e indexado
- [ ] 5.9 Limpieza: borrar dispositivos/consultas/docs de prueba
