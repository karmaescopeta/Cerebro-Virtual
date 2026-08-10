## ADDED Requirements

### Requirement: Verificación de Graphify funcional
El pipeline de Graphify SHALL estar verificado como funcional. Graphify ya funciona correctamente: Pass 1 (tree-sitter, gratuito) genera nodos para código (.py, .js, etc.) sin API key. Pass 3 (LLM) genera nodos para docs (.md) con API key válida vía OpenRouter. Los nodos se mergean en `vault/system/graph.json`.

#### Scenario: Subir archivo .py genera neuronas
- **WHEN** el usuario sube un archivo `.py` al vault
- **THEN** Graphify Pass 1 (tree-sitter) genera nodos en `graph.json` sin requerir LLM

#### Scenario: Subir archivo .md genera neuronas
- **WHEN** el usuario sube un archivo `.md` al vault
- **THEN** Graphify Pass 3 (LLM) genera nodos en `graph.json` usando OpenRouter con `google/gemma-4-26b-a4b-it:free`

#### Scenario: Save-output genera neuronas
- **WHEN** el usuario guarda un documento desde el chat (investigar → añadir al cerebro)
- **THEN** el documento guardado en `outputs/` pasa por Graphify
- **THEN** los nodos generados se mergean en `graph.json`

### Requirement: Grafo de neuronas visible en GrafoView
El grafo de neuronas (`graph.json` con nodos de Graphify) SHALL ser visible y diferenciado del grafo de estructura (wikilinks). GrafoView MUST mostrar ambos: el grafo de estructura (visual) y el grafo de neuronas (Graphify).

#### Scenario: Ver neuronas en GrafoView
- **WHEN** el usuario abre la pestaña Grafo y selecciona modo "Neuronas"
- **THEN** se muestran los nodos de `graph.json` generados por Graphify
- **THEN** si no hay nodos, se muestra mensaje "No hay neuronas. Sube archivos al cerebro para generarlas."

### Requirement: Logging de Graphify
Los errores de Graphify SHALL loguearse con contexto del archivo que falló.

#### Scenario: Graphify falla para un archivo
- **WHEN** `graphify extract` falla para un archivo específico
- **THEN** el backend imprime `⚠️ Graphify falló para <filename>: <error>` en stderr
