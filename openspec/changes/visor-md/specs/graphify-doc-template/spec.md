# graphify-doc-template — Delta Spec

## ADDED Requirements

### Requirement: Plantilla y reglas de estructura para Graphify
El perfil investigador SHALL tener un archivo de referencia (`sistema-agente/profiles/investigador/TEMPLATE.md`) que defina la estructura y sintaxis del documento Y las reglas de cómo escribir el contenido para que la extracción de Graphify Pass 3 (subagente LLM que lee el .md → nodos/edges) sea eficiente y limpia.

#### Scenario: Reglas de contenido Graphify
- WHEN el investigador escribe el contenido del documento
- THEN aplica las reglas: conceptos con nombre inequívoco y consistente (misma entidad = mismo nombre), [[wikilinks]] como anclas de concepto referenciando conceptos reales del doc, relaciones expresadas de forma explícita ("X depende de Y", "X usa Z"), tablas solo para comparaciones, secciones en orden fijo (Título/Resumen/Desarrollo/Conclusiones/Fuentes)

#### Scenario: Documento cumple la plantilla
- WHEN se genera una investigación
- THEN el .md resultante sigue TEMPLATE.md y la descarga conserva la sintaxis completa

### Requirement: El template se referencia desde el SOUL
El SOUL.md del investigador SHALL referenciar TEMPLATE.md como fuente de estructura (la integración efectiva del prompt ocurre en el change investigador-v2, punto 1).

#### Scenario: Fuente única de estructura
- WHEN se quiere cambiar la estructura de los documentos del investigador
- THEN solo se edita TEMPLATE.md
