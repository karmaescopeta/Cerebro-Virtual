# Delta Specs: combo-ia-privacidad

## ADDED Requirements

### Requirement: Ruteo por combos
El sistema SHALL resolver el modelo de cada perfil vía combo OmniRoute (`combo/<nombre>`), con combos cloud y local separados por perfil.

#### Scenario: Chat en modo cloud
- GIVEN iaMode local=false cloud=true
- WHEN el usuario envía un mensaje en modo default
- THEN `_ask_hermes` usa el combo cloud asignado a chat-default y ctx.local=false

#### Scenario: Toggle a local
- GIVEN toggle local activado
- WHEN el usuario envía un mensaje
- THEN la respuesta usa el combo local y ctx.local=true

### Requirement: Toggle local/cloud
La barra del chat SHALL incluir un toggle global Local/Cloud que cambia el ruteo de TODOS los perfiles a la vez. El color del borde del input SHALL ser verde en local y naranja en cloud.

#### Scenario: Cambio de modo
- GIVEN chat abierto
- WHEN el usuario activa el toggle local
- THEN el input se pone verde y el siguiente mensaje se rutea por combos locales

### Requirement: Badge por mensaje
Cada respuesta SHALL registrar en su contexto si fue local o cloud y mostrarlo (🔒/☁️) en la burbuja.

#### Scenario: Respuesta cloud
- WHEN el usuario envía un mensaje con toggle en cloud
- THEN la burbuja assistant muestra ☁️ y el ctx persiste local=false en la sesión

### Requirement: Aviso informativo cerebro-cloud
El sistema SHALL mostrar una vez por cerebro un aviso informativo (no de error) al usar el modo Cerebro sin modo local activo, recomendando instalar un modelo local potente y con nota de relevancia para empresas.

#### Scenario: Primera vez
- GIVEN cerebroAvisoVisto=false y modo cerebro activado con ruteo cloud
- WHEN la primera respuesta cerebro-cloud llega
- THEN se muestra el aviso y cerebroAvisoVisto=true (vault/system/ia-mode.json)

### Requirement: Wizard modo IA
El wizard SHALL reemplazar el paso de modelos legacy por: selección de modo IA (solo-local/solo-cloud/ambas), instalador de modelos locales pegando el comando de Ollama (multi-añadir con progreso SSE), recomendación de 1 modelo medio para cerebro/graphify, y elección instalación por defecto (combos precreados) vs personalizada (combos vacíos, se editan en ModelosView).

#### Scenario: Solo local
- GIVEN el usuario elige solo-local
- WHEN instala `ollama pull qwen2.5:7b` desde el wizard
- THEN el backend hace pull con progreso y solo se crean/usan combos locales

#### Scenario: OmniRoute en ventana aparte
- GIVEN instalación personalizada
- WHEN el usuario abre OmniRoute desde el wizard
- THEN la instalación continúa al volver ("Ya terminé, continuar")

### Requirement: Provision de combos
El backend SHALL provisionar en OmniRoute los combos base del modo elegido al confirmar el wizard (y si faltan, en cada arranque si provisionado=false).

#### Scenario: Primera instalación en ambas
- GIVEN el usuario termina el wizard con modo "ambas"
- WHEN el backend confirma la instalación
- THEN OmniRoute tiene 4 combos cloud y 4 combos local y models/modelsLocal apuntan a ellos

## MODIFIED Requirements

### Requirement: Export de vault sin credenciales
El export SHALL excluir agent-keys.json y SHALL escribir agent-config.json sin apiKey, sin channelTokens y sin dashboard.password.

#### Scenario: Export compartido
- WHEN el usuario exporta el vault
- THEN el .tar.gz no contiene ninguna credencial en claro

### Requirement: Markdown en chat
Las burbujas de chat SHALL renderizar Markdown (reutilizando MarkdownViewer).

#### Scenario: Respuesta con markdown
- WHEN el assistant responde con **negritas** o listas
- THEN la burbuja renderiza el markdown, no texto literal

### Requirement: Upload asíncrono
El upload SHALL responder inmediatamente tras guardar en raw/ y procesar wiki en background; la UI SHALL indicar "Procesando…" hasta que la wiki exista.

#### Scenario: Upload grande
- WHEN el usuario sube un PDF largo
- THEN el upload responde en segundos con wiki_pending=true y la wiki aparece después

## FIXED Requirements

### Requirement: Estado de contenedores
`GET /api/containers/status` SHALL devolver el mapa de contenedores cuando compose responde correctamente.

#### Scenario: Compose responde
- WHEN el frontend pide estado de contenedores
- THEN recibe el mapa de servicios con su estado real