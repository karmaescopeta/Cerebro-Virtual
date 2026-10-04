# Design: cerebro-mcp (rediseño 2026-09-23)

## Decisiones

**1. Todo en el backend existente — sin proceso, puerto, contenedor ni entrypoint nuevo.**
`app/mcp_router.py` = APIRouter montado en main.py. Rutas:
- `POST /mcp` (JSON-RPC 2.0: `initialize`, `tools/list`, `tools/call`) — para agentes IA.
- `POST /api/ext/consultar`, `GET /api/ext/resultado/{id}`, `POST /api/ext/feedback` — shim REST para ESP32/app a medida (mismas funciones internas que MCP).
- `/api/devices/*` (gestión UI: tokens CRUD + toggle modo + consultas confirmar/rechazar + subida doc info).
Acceso LAN y por tunnel CF gratis (mismo puerto 8000 que ya viaja por el tunnel). La UI llama same-origin, sin CORS ni proxy. Auth UI existente para `/api/devices/*`, bearer de dispositivo para `/mcp` y `/api/ext/*`.
*Cambio frente a la decisión posterior de v1 (uvicorn :8900 aparte): con tokens por dispositivo + gestión UI, un proceso separado añadía tunnel roto, CORS y auth duplicada. El router vive en el backend; si algún día hace falta aislamiento de proceso, se extrae el router a un uvicorn propio sin cambiar las rutas.*

**2. Motor de análisis = código existente.** `consultar` arma prompt y llama `_ask_hermes` con vault+reglas del proyecto. Cero RAG nuevo.

**3. Estado = sqlite existente.** Tablas:
- `mcp_tokens`: token, nombre, `requiere_confirmacion` (default 0), creado, ultima_conexion, revocado.
- `mcp_consultas`: id, token_id, pregunta, datos, contexto, respuesta, estado pendiente|confirmada|rechazada|entregada, motivo, ts.
Migración idempotente al arrancar backend.

**4. Token por dispositivo con modo.** Generación `secrets.token_urlsafe(32)` server-side, mostrado una vez en la UI. Bearer en header. `requiere_confirmacion` decide el flujo en `consultar` (default false = respuesta directa). Un dispositivo que necesite lecturas directas Y acciones confirmadas = dos tokens. Rate-limit: skip (LAN + token, abuso improbable; añadir si hay indicios).

**5. Modo directo (default):** `consultar` ejecuta `_ask_hermes`, guarda fila con estado `confirmada` y devuelve `{id, estado: confirmada, respuesta}` en la misma llamada. El dispositivo no necesita conocer `resultado()`.

**6. Modo confirmación (opt-in por token):** `consultar` guarda `pendiente` y devuelve `{id, estado: pendiente}`. Poll 10s con vista abierta en tab Dispositivos. Botones Confirmar/Rechazar (motivo opcional). Sin websocket. El dispositivo recoge con `resultado(id)`.

**7. Docs de dispositivo y soluciones = archivos en vault.**
- `vault/dispositivos/<nombre>.md` (subido desde la UI, editable)
- `vault/soluciones/sol-<id>.md` (escrito por feedback; fallo ⇒ `> ⚠️ NO APLICAR ESTA SOLUCIÓN`)
Indexado/graphify existente los pica. Sin pipeline nuevo.

## Cliente de ejemplo (documentación, no código del repo)

`docs/ejemplo-cliente.md`: ESP32 en modo directo (~10 líneas: POST consultar, leer respuesta del JSON) y Python (requests); modo confirmación con GET resultado en bucle. Copiar/pegar + token.

## Flujo

```
directo (default):
  dispositivo ── POST consultar (token) ──▶ _ask_hermes + vault ──▶ {id, confirmada, respuesta}

con confirmación (token.requiere_confirmacion):
  dispositivo ── POST consultar ──▶ fila sqlite (pendiente) ──▶ {id, pendiente}
  usuario UI ── tab Dispositivos ── Confirmar/Rechazar ──▶ update sqlite
  dispositivo ── GET resultado(id) ──▶ respuesta confirmada / rechazada+motivo / pendiente

ambos:
  dispositivo ── POST feedback ──▶ vault/soluciones/sol-<id>.md ──▶ indexado normal
```

## Pitfalls (del skill)

- main.py: solo patch (3200+ líneas).
- Código baked en imagen: `docker compose build backend frontend` + `up -d --force-recreate --no-deps`.
- CRLF: `.sh`/scripts escritos desde Windows → `sed -i 's/\r$//'`.
- e2e con archivos temporales únicos + limpieza.

## Fuera de alcance

- Bluetooth nativo (WiFi/LAN/tunnel cubren el caso; BLE-only = puente externo cliente).
- MCP directo en micro (necesita gateway/app a medida — es lo que el usuario hará).
- MQTT, push/websocket, permisos granulares por dispositivo, rate-limit, RBAC.