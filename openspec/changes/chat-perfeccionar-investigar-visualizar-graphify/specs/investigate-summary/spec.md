## ADDED Requirements

### Requirement: Investigar devuelve resumen + documento completo
El endpoint `/api/chat/investigate` SHALL devolver dos campos: `summary` (resumen breve de 3-5 líneas con puntos clave) y `full_doc` (documento Markdown completo). El bubble del chat MUST mostrar `summary`. El botón Descargar MUST guardar `full_doc`. El botón Visualizar MUST abrir `full_doc` en MarkdownViewer.

#### Scenario: Investigar mensajes seleccionados
- **WHEN** el usuario selecciona mensajes y hace clic en "Investigar"
- **THEN** el endpoint devuelve `{response: summary, full_doc: document, context: {is_document: true, offer_save: true}}`
- **THEN** el bubble muestra el resumen breve, no el documento completo

#### Scenario: Descargar documento completo
- **WHEN** el usuario hace clic en "Descargar" en un resultado de investigación
- **THEN** se descarga `full_doc` como archivo .md, no `summary`

#### Scenario: Visualizar documento completo
- **WHEN** el usuario hace clic en "Visualizar" en un resultado de investigación
- **THEN** el modal abre con `full_doc` renderizado en MarkdownViewer

#### Scenario: Guardar documento completo al cerebro
- **WHEN** el usuario hace clic en "Añadir al cerebro"
- **THEN** se guarda `full_doc` (no `summary`) en outputs/ + wiki/ + Graphify
