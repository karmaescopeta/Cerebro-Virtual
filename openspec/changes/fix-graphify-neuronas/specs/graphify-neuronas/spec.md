# Specs — fix-graphify-neuronas

## ADDED Requirements

### Requirement: Timeout suficiente para modelos LLM lentos
The system SHALL use a timeout of 300 seconds for Graphify subprocess execution.
The timeout MUST accommodate models that take up to 130 seconds per file.

#### Scenario: Modelo lento (deepseek-v4-flash, 130s)
- GIVEN un archivo de tamaño medio (~5KB markdown)
- WHEN Graphify procesa con deepseek-v4-flash
- THEN el proceso completa dentro de 300s
- AND el graph.json se genera con nodos y edges

#### Scenario: Timeout real (modelo caído)
- GIVEN un modelo LLM que no responde
- WHEN Graphify ejecuta por 300s sin respuesta
- THEN el proceso se cancela limpiamente
- AND se retorna None sin crash

### Requirement: Graphify procesa solo el archivo nuevo, no el directorio completo
The system SHALL copy the target file to a temporary directory before running Graphify.
The system MUST clean up the temporary directory after Graphify completes.
This avoids reprocessing existing files in the same directory.

#### Scenario: Archivo nuevo en directorio con archivos existentes
- GIVEN un directorio `raw/individual/` con 10 archivos existentes
- WHEN se añade un archivo nuevo `archivo11.md`
- THEN Graphify procesa SOLO `archivo11.md` en un temp dir
- AND los 10 archivos existentes NO se reprocesan
- AND el tiempo de ejecución es proporcional a 1 archivo, no a 11

#### Scenario: Cleanup de temp dir
- GIVEN Graphify completó exitosamente
- WHEN el proceso termina
- THEN el temp dir se elimina del host
- AND no quedan archivos temporales en el vault

### Requirement: Modelo default de Graphify debe ser funcional sin rate-limit
The system SHALL use `deepseek/deepseek-v4-flash` as the default Graphify model.
The default MUST NOT be a free-tier model that is rate-limited.
The model MUST be configurable from the Modelos tab and the Wizard.

#### Scenario: Config sin modelo graphify
- GIVEN agent-config.json sin `models.graphify`
- WHEN `_get_graphify_model()` lee la config
- THEN retorna `deepseek/deepseek-v4-flash`
- AND Graphify usa ese modelo

#### Scenario: Usuario cambia modelo desde tab Modelos
- GIVEN usuario abre tab Modelos
- WHEN edita el modelo de Graphify a `anthropic/claude-sonnet-4`
- THEN agent-config.json se actualiza
- AND el próximo `_run_graphify` usa claude-sonnet-4

### Requirement: Upload endpoint debe retornar estado del grafo
The `/api/vault/upload` endpoint SHALL include `graph_updated` (bool) in its response.
The frontend MAY use this to show feedback when neurons are generated.

#### Scenario: Archivo subido, neuronas generadas en background
- GIVEN usuario sube un archivo .md desde el chat
- WHEN el upload responde
- THEN la respuesta incluye `graph_updated: false` (procesa en background)
- AND el grafo se actualiza cuando Graphify termina

#### Scenario: Archivo subido, Graphify falla en background
- GIVEN usuario sube un archivo
- WHEN Graphify falla en background (timeout, error, modelo caído)
- THEN la respuesta del upload ya fue enviada con `graph_updated: false`
- AND el archivo SÍ se guardó en raw/ y se generó wiki
- AND el error se loguea en backend

### Requirement: Graphify no bloquea el upload
The `/api/vault/upload` endpoint SHALL run Graphify in a background thread.
The response MUST return immediately after wiki synthesis, without waiting for Graphify.
The background thread MUST handle errors silently (log only, no crash).

#### Scenario: Upload rápido con graphify lento
- GIVEN usuario sube un archivo desde el chat
- WHEN el archivo se guarda y la wiki se sintetiza
- THEN la respuesta retorna inmediatamente
- AND Graphify corre en background
- AND el grafo se actualiza cuando Graphify termina

#### Scenario: Graphify background falla
- GIVEN Graphify corre en background
- WHEN el modelo LLM falla o timeout
- THEN se loguea el error
- AND no afecta la respuesta del upload
- AND el usuario puede verificar el grafo después
