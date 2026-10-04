# knowledge-update — Delta Spec

## ADDED Requirements

### Requirement: Edición actualiza el conocimiento
Al guardar la edición de un archivo de `raw/` u `outputs/`, el sistema SHALL reescribir el archivo, actualizar su copia en `wiki/` (solo si existe), y regenerar la parte del grafo correspondiente a ese archivo: purgar los nodos y edges cuyo `source_file` coincida e insertar los extraídos de nuevo por Graphify.

#### Scenario: Re-grafo por archivo
- WHEN se guarda una edición de `outputs/individual/doc.md`
- THEN los nodos/edges viejos con `source_file: doc.md` desaparecen y los nuevos (extraídos del contenido editado) quedan en graph.json — sin duplicados ni nodos huérfanos de conceptos eliminados

#### Scenario: Concepto eliminado en la edición
- WHEN el contenido editado ya no menciona un concepto que sí estaba en el grafo
- THEN el nodo y sus edges de ese archivo se purgan al guardar

#### Scenario: Archivo raw sin wiki
- WHEN se edita un archivo de `raw/` (sin copia wiki)
- THEN se reescribe el archivo y se regenera su parte del grafo; no se crea copia wiki

### Requirement: Endpoint único de actualización
El sistema SHALL exponer `POST /api/vault/update-file` {path, content} que valide que `path` esté dentro de `raw/` o `outputs/` del vault y aplique el flujo anterior. El endpoint SHALL responder `{status, path, graph_updated}`.

#### Scenario: Path fuera del vault
- WHEN se llama con un path que escapa de raw/ u outputs/ (o con `..`)
- THEN se rechaza con 400 y no se toca disco