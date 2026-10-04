# vault-security Delta Spec (security-audit-run1-fixes)

## ADDED Requirements

### Requirement: Confinamiento de rutas del vault (SHALL)
Todo endpoint que una segmento de ruta controlado por el usuario bajo VAULT_PATH MUST (SHALL) resolver el path final y verificar que queda dentro del subtree previsto (raw/, outputs/, wiki/), igual que `update_vault_file`.

#### Scenario: Upload con project=../..
- GIVEN el backend corriendo
- WHEN se hace POST /api/vault/upload con `project` conteniendo `..`
- THEN responde 400 y no se escribe archivo fuera de `raw/`

#### Scenario: Rename hacia system
- GIVEN un archivo existente en raw/
- WHEN se hace PUT /api/vault/rename con `newName` que resuelve fuera del subtree
- THEN responde 400 y `vault/system/` no cambia

### Requirement: Extracción de archivos confinada (SHALL)
La extracción de archivos subidos (import tar.gz) MUST (SHALL) usar el filtro de miembros de la librería (`filter="data"`) para rechazar members con traversal, rutas absolutas o links externos.

#### Scenario: Miembro ../../app/.env
- GIVEN un tar.gz con member `../../app/.env` y las 4 carpetas requeridas
- WHEN se hace POST /api/vault/import
- THEN el member es rechazado y no se escribe nada fuera del temp dir

### Requirement: Sin interpolación de rutas en código de intérprete (SHALL)
Los scripts de herramientas MUST (SHALL) pasar rutas de archivos al código Python vía variable de entorno o argv, nunca interpoladas en el string de `python -c`.

#### Scenario: Nombre con comilla simple
- GIVEN un archivo renombrado a `a');__import__('os')...;#.mp3` en raw/
- WHEN se procesa con POST /api/vault/process
- THEN el nombre se trata como dato (error de archivo inexistente o transcripción normal) y no se ejecuta Python inyectado

### Requirement: Validación de identificadores de modelos (SHALL)
El backend MUST (SHALL) validar los valores de `models` (regex de model-id) antes de persistirlos en agent-config.json.

#### Scenario: Valor con pipe
- WHEN PUT /api/profiles/models recibe `models.investigador` = `x|;e touch /tmp/pwned;#`
- THEN responde 400 y agent-config.json no cambia

### Requirement: Terminal WS con allowlist (SHALL)
El terminal WS de ollama/omniroute MUST (SHALL) usar una allowlist de comando y rechazar metacaracteres de shell; ningún input del usuario DEBE poder ejecutar comandos fuera de la allowlist.

#### Scenario: sh -c env
- WHEN se envía `sh -c env` por el WebSocket del terminal
- THEN se bloquea con mensaje y no se ejecuta

### Requirement: Escritores de .env validados (SHALL)
Toda escritura de líneas KEY=VALUE en `.env` desde input del usuario MUST (SHALL) validar key (chars alfanuméricos y _) y valor (sin newline, CR ni =) antes de escribir.

#### Scenario: Label con newline
- WHEN PUT /api/instances/routes/labels recibe `label` con `\n` interior
- THEN responde 400 y `.env` queda sin cambios

### Requirement: Credenciales no servidas por HTTP (SHALL)
El mount estático del vault MUST (SHALL) denegar (404) el acceso a `system/`, aplicando la misma política de exclusión que el export.

#### Scenario: GET /vault-static/system/agent-keys.json
- WHEN cualquier cliente pide esa ruta
- THEN responde 404

### Requirement: HTML escapado en páginas renderizadas (SHALL)
Los valores interpolados en la página de estado del agente MUST (SHALL) escaparse con html.escape.

#### Scenario: agentName con <img onerror>
- GIVEN agentName configurado con payload HTML
- WHEN se abre /api/agent/status
- THEN el payload aparece como texto escapado, no se ejecuta

### Requirement: Integridad del grafo de conocimiento (SHALL)
Las escrituras de graph.json/graph-meta.json MUST (SHALL) serializarse con un lock y persistirse atómicamente; un error de parse NO DEBE mergearse como grafo vacío.

#### Scenario: Escrituras concurrentes
- GIVEN dos escrituras de grafo solapadas
- WHEN ambas terminan
- THEN el archivo es JSON válido y contiene los nodos de ambas

### Requirement: Rollback de update verificado (SHALL)
El rollback de un componente de imagen MUST (SHALL) retaggear al nombre de imagen que compose resuelve y verificar el ID del contenedor recreado antes de reportar éxito.

#### Scenario: Update fallido con rollback
- GIVEN un update de imagen cuyo smoke test falla
- WHEN se ejecuta el rollback
- THEN el contenedor vuelve a la imagen previa y `rolledBack` refleja la verificación real
