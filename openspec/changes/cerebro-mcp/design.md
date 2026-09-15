# Design: cerebro-mcp

## Decisiones

**1. Todo en el backend existente — sin proceso, puerto, contenedor ni entrypoint nuevo.**
`app/mcp_router.py` = APIRouter montado en main.py. Rutas:
- `POST /mcp` (JSON-RPC 2.0: `initialize`, `tools/list`, `tools/call`) — para agentes IA.
- `POST /api/ext/consultar`, `GET /api/ext/resultado/{id}`, `POST /api/ext/feedback` — shim REST para ESP32/app a medida (mismas funciones internas).
- `/api/devices/*` (gestión UI: tokens CRUD + consultas confirmar/rechazar + subida doc info).
Acceso LAN y por tunnel CF gratis (mismo puerto 8000 que ya viaja por el tunnel).

**2. Motor de análisis = código existente.** `consultar` arma prompt y llama `_ask_hermes` con vault+reglas del proyecto. Cero RAG nuevo.

**3. Estado = sqlite existente.** Tablas `mcp_tokens` y `mcp_consultas` (id, token_id, pregunta, datos, contexto, respuesta, estado pendiente|confirmada|rechazada|entregada, motivo, ts). Migración idempotente al arrancar backend.

**4. Token por dispositivo.** Generación `secrets.token_urlsafe(32)` server-side, mostrado una vez en la UI. Bearer en header. Revocación = flag. Rate-limit: skip (LAN + token, abuso improbable; añadir si hay indicios).

**5. Confirmación humana en tab Dispositivos.** Poll 10s con vista abierta. Botones Confirmar/Rechazar (motivo opcional). Sin websocket.

**6. Docs de dispositivo y soluciones = archivos en vault.**
- `vault/dispositivos/<nombre>.md` (subido desde la UI, editable)
- `vault/soluciones/sol-<id>.md` (escrito por feedback; fallo ⇒ `> ⚠️ NO APLICAR ESTA SOLUCIÓN`)
Indexado/graphify existente los pica. Sin pipeline nuevo.

## Cliente de ejemplo (documentación, no código del repo)

ESP32 (POST directo, ~10 líneas) y Python (requests) en `docs/ejemplo-cliente.md` — copiar/pegar + token. Sin app intermedia.

## Flujo

```
dispositivo ── POST consultar (token) ──▶ _ask_hermes + vault ──▶ fila sqlite (pendiente)
usuario UI ── tab Dispositivos ── Confirmar/Rechazar ──▶ update sqlite
dispositivo ── GET resultado(id) ──▶ respuesta confirmada / rechazada / pendiente
dispositivo ── POST feedback ──▶ vault/soluciones/sol-<id>.md ──▶ indexado normal
```

## Pitfalls (del skill)

- main.py: solo patch (3200+ líneas).
- Código baked en imagen: `docker compose build backend` + `up -d --force-recreate --no-deps`.
- e2e con archivos temporales únicos + limpieza.

## Fuera de alcance

- MCP directo en micro (necesita gateway/app a medida — es lo que el usuario hará).
- MQTT, push/websocket, permisos por dispositivo, rate-limit, RBAC.
