# Proposal: cerebro-mcp

## Why

Hoy el cerebro solo responde a humanos en el chat. El usuario quiere que apps y dispositivos externos (ESP32 vía app a medida, scripts, agentes IA) puedan **consultarlo**: envían datos → el cerebro analiza con sus documentos y normas del proyecto → sugiere acción → el usuario confirma en la UI → el cliente recoge la respuesta y ejecuta. El resultado real (funcionó/falló) se guarda como experiencia para futuras consultas. Comité 2026-09 aprobó el concepto: el cerebro no controla hardware, solo responde; el cliente decide qué ejecutar.

## What Changes

- **Endpoint MCP dentro del backend existente** (`/mcp` en el puerto 8000 actual — sin proceso ni puerto nuevo; accesible por LAN y tunnel Cloudflare sin cambios de infra).
- **Shim REST paralelo** (`/api/ext/*`) sobre las mismas 3 funciones para clientes simples (ESP32/app a medida: un POST con token).
- 3 herramientas/operaciones: `consultar(pregunta, datos, contexto, sin_confirmacion=false)`, `resultado(id)`, `feedback(id, resultado, notas)`.
- **Tokens por dispositivo**: tabla `mcp_tokens` (token, nombre, creado, última conexión, revocado). CRUD desde la UI. Revocable individualmente.
- **Tab "Dispositivos"** en la UI: lista de dispositivos enlazados (nombre, token, última conexión, nº consultas, revocar) + historial de consultas con Confirmar/Rechazar + botón "añadir información del dispositivo" que sube un doc (puertos, sensores, hardware, qué procesa) a `vault/dispositivos/` — el indexado existente lo pica y el cerebro "sabe con quién habla".
- **Aprendizaje etiquetado**: feedback escribe en `vault/soluciones/` (✓ éxito / ✗ "NO aplicar"); pipeline existente lo indexa. Sin re-entrenamiento.
- Permisos: todos los dispositivos iguales en v1 (flag `sin_confirmacion` disponible para cualquiera); permisos por dispositivo cuando exista caso real.

## Capabilities

### New Capabilities
- `mcp-external-consultas`: servidor MCP + shim REST con herramientas consultar/resultado/feedback, tokens por dispositivo, flujo de confirmación humana, tab de gestión con docs de dispositivo, y experiencias en vault.

### Modified Capabilities
- (ninguna — chat, RAG, grafo y tunnel no cambian; se reutilizan)

## Impact

- **Backend**: archivo nuevo `app/mcp_router.py` (router FastAPI montado en main.py: `/mcp` + `/api/ext/*` + `/api/devices/*`), tabla `mcp_tokens` + `mcp_consultas` en sqlite existente. Sin entrypoint, compose ni puertos nuevos.
- **Frontend**: tab nuevo "Dispositivos" (gestión tokens + info docs + historial consultas con Confirmar/Rechazar).
- **Vault**: carpetas nuevas `dispositivos/` y `soluciones/` — indexadas por el pipeline actual, sin cambios.
- **Seguridad**: bearer token por dispositivo (generado en la UI), revocación individual. Sin token ⇒ 401.
