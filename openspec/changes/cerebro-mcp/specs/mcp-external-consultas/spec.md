# Delta Spec: mcp-external-consultas

## ADDED Requirements

### Requirement: Acceso externo autenticado por dispositivo
El backend SHALL exponer acceso externo en su puerto actual: MCP (JSON-RPC 2.0) en `/mcp` y REST en `/api/ext/*`. Cada dispositivo enlazado SHALL tener su propio token (tabla `mcp_tokens`: token, nombre, `requiere_confirmacion`, creado, última conexión, revocado). Peticiones sin token, con token revocado o inexistente SHALL devolver 401 sin ejecutar nada. Cada llamada válida SHALL actualizar `ultima_conexion` del token. El backend solo habla HTTP: el acceso es por WiFi/LAN o tunnel; un dispositivo sin WiFi SHALL ser puenteado por un cliente externo (fuera del cerebro).

#### Scenario: Cliente válido
- GIVEN un dispositivo con token válido no revocado
- WHEN llama a cualquier operación
- THEN se ejecuta y `ultima_conexion` se actualiza

#### Scenario: Token revocado
- GIVEN un dispositivo cuyo token fue revocado desde la UI
- WHEN llama a cualquier operación
- THEN recibe 401 y nada se ejecuta

### Requirement: Operaciones consultar / resultado / feedback
El sistema SHALL exponer 3 operaciones por MCP (`tools/call`) y por REST (`POST /api/ext/consultar`, `GET /api/ext/resultado/{id}`, `POST /api/ext/feedback`):
- `consultar(pregunta, datos, contexto)`: analiza con el motor existente (`_ask_hermes` + vault + reglas). Si el token está en modo directo, devuelve `{id, estado: confirmada, respuesta}` en la misma llamada. Si el token está en modo confirmación, guarda `pendiente` y devuelve `{id, estado: pendiente}`.
- `resultado(id)`: devuelve estado actual — `pendiente`, `confirmada` (con respuesta), `rechazada` (con motivo) o `entregada`.
- `feedback(id, resultado: exito|fallo, notas)`: escribe `vault/soluciones/sol-<id>.md` y marca la consulta `entregada`.

#### Scenario: Consulta directa (default)
- GIVEN un token con `requiere_confirmacion=false`
- WHEN el dispositivo llama `consultar` con datos de sensores
- THEN recibe `id`, `estado=confirmada` y la respuesta en la misma llamada HTTP

#### Scenario: Consulta en modo confirmación
- GIVEN un token con `requiere_confirmacion=true`
- WHEN el dispositivo llama `consultar`
- THEN recibe `id` + `estado=pendiente` y la sugerencia aparece en la UI

#### Scenario: Recogida de resultado
- GIVEN una consulta confirmada por el usuario
- WHEN el dispositivo llama `resultado(id)`
- THEN recibe `estado=confirmada` con la respuesta analizada

### Requirement: Modo de confirmación configurable por token
Cada token SHALL tener flag `requiere_confirmacion` (default false). La UI SHALL permitir activar/desactivar el modo por token. Solo las consultas de tokens en modo confirmación SHALL quedar `pendiente` y aparecer como pendientes de confirmación en la UI; los tokens en modo directo SHALL responder sin intervención humana.

#### Scenario: Modo directo sin intervención
- GIVEN un token en modo directo
- WHEN llama `consultar`
- THEN no aparece nada pendiente en la UI y la respuesta se entrega en la misma llamada

#### Scenario: Toggle de modo
- GIVEN el usuario cambia el modo de un token en la UI
- WHEN ese dispositivo llama `consultar`
- THEN la consulta sigue el flujo del modo nuevo

### Requirement: Confirmación humana (solo modo confirmación)
El backend SHALL listar consultas pendientes y permitir confirmarlas o rechazarlas (con motivo opcional) desde la UI (`GET/POST /api/devices/consultas...`), con la autenticación UI existente.

#### Scenario: Usuario confirma
- GIVEN una consulta pendiente en la UI
- WHEN el usuario pulsa Confirmar
- THEN `resultado(id)` devuelve la respuesta al dispositivo

#### Scenario: Usuario rechaza
- GIVEN una consulta pendiente
- WHEN el usuario pulsa Rechazar con motivo
- THEN `resultado(id)` devuelve `estado=rechazada` + motivo

### Requirement: Tokens gestionados desde la UI
El backend SHALL permitir crear token (generado servidor-side, se muestra una vez, con selector de modo), listar dispositivos con su actividad y modo, y revocar/restaurar cada token individualmente (`/api/devices/tokens`), con autenticación UI existente.

#### Scenario: Alta de dispositivo
- GIVEN el usuario en el tab Dispositivos
- WHEN crea un dispositivo "Bomba riego" en modo directo
- THEN recibe un token único mostrado una vez y el dispositivo aparece en la lista con su modo

### Requirement: Documento de información del dispositivo
El tab Dispositivos SHALL permitir adjuntar a cada dispositivo un documento (texto/md) describiendo su hardware, puertos, sensores y qué procesa. El sistema SHALL guardarlo en `vault/dispositivos/` con el nombre del dispositivo, donde el pipeline de indexado existente lo incorpora sin cambios.

#### Scenario: Info de dispositivo indexada
- GIVEN el usuario sube el doc del dispositivo "ESP32-bomba" (puertos, sensor DHT22, qué controla)
- WHEN el pipeline indexa el vault
- THEN el contenido está disponible para las respuestas del cerebro

### Requirement: Aprendizaje etiquetado en vault
`feedback` SHALL escribir un markdown en `vault/soluciones/` con pregunta, datos, respuesta, resultado (exito/fallo) y notas. Los de fallo SHALL llevar texto explícito "NO aplicar esta solución". El indexado existente los incorpora sin cambios de pipeline.

#### Scenario: Experiencia exitosa
- GIVEN una consulta ejecutada con buen resultado
- WHEN el dispositivo llama `feedback(id, "exito", notas)`
- THEN existe `vault/soluciones/sol-<id>.md` etiquetado éxito

#### Scenario: Experiencia fallida
- GIVEN el resultado fue malo
- WHEN el dispositivo llama `feedback(id, "fallo", notas)`
- THEN el doc lleva etiqueta fallo y encabezado "NO aplicar esta solución"