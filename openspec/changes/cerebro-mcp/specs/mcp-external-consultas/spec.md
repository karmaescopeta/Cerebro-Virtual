# Delta Spec: mcp-external-consultas

## ADDED Requirements

### Requirement: Acceso externo autenticado por dispositivo
El backend SHALL exponer acceso externo en su puerto actual: MCP (JSON-RPC 2.0) en `/mcp` y REST en `/api/ext/*`. Cada dispositivo enlazado SHALL tener su propio token (tabla `mcp_tokens`: token, nombre, creado, última conexión, revocado). Peticiones sin token, con token revocado o inexistente SHALL devolver 401 sin ejecutar nada. Cada llamada válida SHALL actualizar `ultima_conexion` del token.

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
- `consultar(pregunta, datos, contexto, sin_confirmacion=false)`: analiza con el motor existente (`_ask_hermes` + vault + reglas). Devuelve `{id, estado}` — `pendiente` (requiere confirmación humana) o `confirmada` con respuesta incluida si `sin_confirmacion=true`.
- `resultado(id)`: devuelve estado actual — `pendiente`, `confirmada` (con respuesta), `rechazada` (con motivo) o `entregada`.
- `feedback(id, resultado: exito|fallo, notas)`: escribe `vault/soluciones/sol-<id>.md` y marca la consulta `entregada`.

#### Scenario: Consulta con confirmación
- GIVEN un dispositivo envía datos de sensores con pregunta
- WHEN llama `consultar` sin `sin_confirmacion`
- THEN recibe `id` + `estado=pendiente` y la sugerencia aparece en la UI

#### Scenario: Consulta sin confirmación
- GIVEN `sin_confirmacion=true`
- WHEN llama `consultar`
- THEN recibe `id`, `estado=confirmada` y la respuesta en la misma llamada

#### Scenario: Recogida de resultado
- GIVEN una consulta confirmada por el usuario
- WHEN el dispositivo llama `resultado(id)`
- THEN recibe `estado=confirmada` con la respuesta analizada

### Requirement: Confirmación humana
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
El backend SHALL permitir crear token (generado servidor-side, se muestra una vez), listar dispositivos con su actividad, y revocar/restaurar cada token individualmente (`/api/devices/tokens`), con autenticación UI existente.

#### Scenario: Alta de dispositivo
- GIVEN el usuario en el tab Dispositivos
- WHEN crea un dispositivo "Bomba riego"
- THEN recibe un token único mostrado una vez y el dispositivo aparece en la lista

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
