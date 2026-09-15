## ADDED Requirements

### Requirement: Graphify container functional
El sistema SHALL tener la imagen Docker `cerebrovirtual-herramientas` construida y disponible. El contenedor SHALL ejecutar `graphify extract` correctamente cuando se invoque desde el backend.

#### Scenario: Graphify image exists
- **WHEN** backend calls _run_graphify
- **THEN** Docker image `cerebrovirtual-herramientas:latest` exists
- **AND** container runs graphify extract successfully
- **AND** produces graph.json with nodes and edges

#### Scenario: Graphify image missing
- **WHEN** backend calls _run_graphify and image does not exist
- **THEN** system logs the error clearly
- **AND** returns None to caller (graceful degradation)

### Requirement: Neural map displays nodes
El sistema SHALL mostrar nodos en el grafo "Neuronas" (vista GrafoView) cuando existan archivos procesados en el vault. Si graph.json tiene nodos, se renderizan. Si está vacío, se muestra mensaje explicativo.

#### Scenario: Neural map with data
- **WHEN** user opens Grafo tab and switches to Neuronas view
- **AND** graph.json has nodes
- **THEN** system renders the neural map with all nodes and edges

#### Scenario: Neural map empty
- **WHEN** user opens Grafo tab and switches to Neuronas view
- **AND** graph.json is empty or does not exist
- **THEN** system shows message "No hay nodos en graph.json todavía. Sube archivos para que Graphify los procese."

### Requirement: Cerebro can answer about neurons
El sistema SHALL, cuando el usuario pregunta en modo Cerebro sobre neuronas/conocimiento, usar el grafo (graph.json) como fuente de contexto. Si el grafo tiene nodos, las respuestas se basan en ellos.

#### Scenario: Cerebro query matches graph nodes
- **WHEN** user asks a question in Cerebro mode
- **AND** search_graph finds matching nodes
- **THEN** the response includes information derived from those nodes
- **AND** sources list includes the matched node labels
