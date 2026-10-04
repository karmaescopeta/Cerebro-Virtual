# Proposal: cerebro-mcp (rediseño 2026-09-23)

## Why

Hoy el cerebro solo responde a humanos en el chat. Queremos que cualquier dispositivo con acceso HTTP al servidor (WiFi/LAN o tunnel) pueda **consultarlo**: envía datos → el cerebro analiza con sus documentos y reglas del proyecto → responde. El cliente decide qué ejecutar con la respuesta. El resultado real (funcionó/falló) se guarda como experiencia para futuras consultas. Comité 2026-09 aprobó el concepto: el cerebro no controla hardware, solo responde.

**Cambios del rediseño frente a v1 (2026-09-15):**
- La confirmación humana universal pasa a ser **configurable por token**: respuesta directa por defecto; el modo confirmación (IA propone → usuario aprueba en UI) se activa por dispositivo. Un dispositivo con dos modos = dos tokens.
- **El cerebro solo habla HTTP** (WiFi/LAN o tunnel). Bluetooth queda fuera: un dispositivo sin WiFi lo puentea un cliente externo (script/app) que hace POST al backend.
- Superficie: REST para dispositivos simples + `/mcp` JSON-RPC para agentes IA, mismas 3 funciones debajo.

## What Changes

- **Endpoint MCP dentro del backend existente** (`/mcp` en el puerto 8000 actual — sin proceso ni puerto nuevo; accesible por LAN y tunnel Cloudflare sin cambios de infra).
- **Shim REST paralelo** (`/api/ext/*`) sobre las mismas 3 funciones para clientes simples (ESP32/app a medida: un POST con token).
- 3 herramientas/operaciones: `consultar(pregunta, datos, contexto)`, `resultado(id)`, `feedback(id, resultado, notas)`.
- **Tokens por dispositivo** con flag `requiere_confirmacion` (default false): tabla `mcp_tokens` (token, nombre, modo, creado, última conexión, revocado). CRUD desde la UI, revocable individualmente.
- **Tab "Dispositivos"** en la UI: lista (nombre, modo, última conexión, nº consultas), crear/revocar/toggle modo + botón "añadir información del dispositivo" que sube un doc (puertos, sensores, hardware, qué procesa) a `vault/dispositivos/` — el indexado existente lo pica y el cerebro "sabe con quién habla". Historial de consultas con Confirmar/Rechazar SOLO para tokens en modo confirmación.
- **Aprendizaje etiquetado**: feedback escribe en `vault/soluciones/` (✓ éxito / ✗ "NO aplicar"); pipeline existente lo indexa. Sin re-entrenamiento.
- Permisos: todos los dispositivos iguales en v1; permisos por dispositivo cuando exista caso real.

## Capabilities

### New Capabilities
- `mcp-external-consultas`: servidor MCP + shim REST con herramientas consultar/resultado/feedback, tokens por dispositivo con modo de confirmación configurable, tab de gestión con docs de dispositivo, y experiencias en vault.

### Modified Capabilities
- (ninguna — chat, RAG, grafo y tunnel no cambian; se reutilizan)

## Impact

- **Backend**: archivo nuevo `app/mcp_router.py` (router FastAPI montado en main.py: `/mcp` + `/api/ext/*` + `/api/devices/*`), tablas `mcp_tokens` + `mcp_consultas` en sqlite existente. Sin entrypoint, compose ni puertos nuevos.
- **Frontend**: tab nuevo "Dispositivos" (gestión tokens + modo + info docs + historial consultas con Confirmar/Rechazar cuando aplique).
- **Vault**: carpetas nuevas `dispositivos/` y `soluciones/` — indexadas por el pipeline actual, sin cambios.
- **Seguridad**: bearer token por dispositivo (generado en la UI), revocación individual. Sin token ⇒ 401; token revocado ⇒ 401.