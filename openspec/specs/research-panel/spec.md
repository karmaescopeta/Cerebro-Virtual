# research-panel Specification

## Purpose
TBD - created by archiving change investigador-v2. Update Purpose after archive.
## Requirements
### Requirement: Endpoint de preguntas del cuestionario
El sistema SHALL exponer `POST /api/chat/investigate/questions` que reciba `{topic, messages, answers?, round?}` y devuelva `{questions: [{q, options[4]}], round}` usando el perfil investigador. Con `answers` previas, las nuevas preguntas SHALL afinar sobre las respuestas analizadas.

#### Scenario: Primera tanda
- WHEN el frontend envía `{topic, messages}` sin answers
- THEN recibe 5 preguntas con exactamente 4 opciones cada una y `round: 1`

#### Scenario: Tanda de refinamiento
- WHEN el frontend envía de nuevo el tema con las `answers` recogidas
- THEN las preguntas nuevas se basan en el análisis de esas respuestas y `round` sube

#### Scenario: Límite de tandas
- WHEN `round` llega a 3
- THEN el backend sigue respondiendo pero el frontend deshabilita "Más preguntas"

#### Scenario: Output no-JSON del modelo
- WHEN el modelo devuelve texto sin JSON parseable
- THEN el endpoint responde con error claro y el panel muestra estado de reintento sin romper

### Requirement: Investigación con nivel y respuestas
El endpoint `POST /api/chat/investigate` SHALL aceptar campos opcionales `level` (principiante|intermedio|experto), `answers` (lista de directrices del cuestionario) y `deepen {doc, subtema}`.

#### Scenario: Nivel seleccionado
- WHEN `level` viene en la petición
- THEN el prompt de generación usa la plantilla de audiencia correspondiente (principiante: sin jerga + analogías; intermedio: equilibrado; experto: directo y técnico)

#### Scenario: Con respuestas del cuestionario
- WHEN `answers` viene poblado
- THEN las respuestas entran como directrices de enfoque en el prompt antes del contexto del chat

#### Scenario: Internet siempre
- WHEN se genera cualquier investigación
- THEN el sistema busca en SearXNG (helpers `search_internet` + `_format_search_results` existentes) e inyecta los resultados como contexto

#### Scenario: Profundizar
- WHEN `deepen` viene con un doc y un subtema
- THEN el sistema NO regenera el documento: produce una sección nueva sobre el subtema y la añade al mismo documento (título intacto, fuentes acumuladas)

### Requirement: Panel de investigación en el frontend
El chat SHALL abrir un panel deslizante desde la derecha al pulsar "Investigar" (botón o Enter en modo investigación) en lugar de lanzar el documento directamente.

#### Scenario: Apertura del panel
- WHEN el usuario pulsa Investigar con mensajes seleccionados o escribe y da a Investigar
- THEN se abre el panel derecho (~420px, overlay atenuado, tokens del sistema: surface, border, radius-lg, label-caps) con el tema/booking de contexto

#### Scenario: Cuestionario clicable
- WHEN el panel muestra la tanda de preguntas
- THEN cada pregunta lista 4 opciones como botones de selección única deseleccionables + input libre "Otra cosa…" visible en cada pregunta

#### Scenario: Acciones siempre accesibles
- WHEN el panel está en cualquier tanda
- THEN "Crear investigación" (primary) es visible siempre y "Más preguntas" se deshabilita con tanda 3 en curso

#### Scenario: Nivel
- WHEN el panel se abre
- THEN muestra 3 chips (principiante/intermedio/experto, default intermedio, color fijo activo sin gradientes)

#### Scenario: Resultado
- WHEN la investigación termina
- THEN el panel renderiza el doc con `MarkdownViewer` (el del chat) y botones Descargar / Añadir al cerebro / Profundizar en… (input de subtema → nueva sección en el mismo doc)

#### Scenario: Responsive
- WHEN el viewport es ≤768px
- THEN el panel ocupa pantalla completa

#### Scenario: Tema claro/oscuro
- WHEN se cambia el tema en Ajustes
- THEN el panel usa tokens duales (color-mix con var(--color-*)), nunca rgba fijo

