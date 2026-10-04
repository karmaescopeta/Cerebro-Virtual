# doc-reader — Delta Spec

## ADDED Requirements

### Requirement: Tema de estilo separado
El sistema SHALL definir la traducción símbolo-md→estilo en un archivo dedicado (`src/mdTheme.js`) que MarkdownViewer SHALL consumir. Cada elemento (headings, párrafos, negrita, cursiva, código, bloques de código, citas, tablas, listas, links, wikilinks, hr, índice) SHALL tener su entrada de estilo como punto único de personalización.

#### Scenario: Cambio de estilo centralizado
- WHEN se modifica el estilo de un símbolo en mdTheme.js
- THEN el cambio se refleja en todos los usos del lector (burbujas chat, visor Cerebro, vista previa chat) sin tocar otros archivos

#### Scenario: Personalización futura
- WHEN en el futuro Ajustes ofrezca personalización por símbolo
- THEN solo hace falta sobreescribir entradas del objeto del tema — sin refactor del parser

### Requirement: Escala de lectura del visor
El visor SHALL renderizar documentos en escala de lectura (base ~15px, jerarquía clara, interlineado amplio, ancho de línea ~72ch centrado). Las burbujas de chat SHALL mantener su escala compacta actual mediante la prop `compact`.

#### Scenario: Documento en el visor
- WHEN se abre un .md en el visor (Cerebro o chat)
- THEN el contenido se muestra con tipografía de documento, no la de burbuja

#### Scenario: Burbujas sin cambio visual
- WHEN el chat renderiza una respuesta en una burbuja
- THEN la escala es la actual (compact) y no se rompe el layout del chat

### Requirement: Índice de secciones clicable
El visor SHALL generar un índice a partir de los headings `#`/`##`/`###` del contenido, clicable, que haga scroll a la sección. Desktop: columna lateral. Móvil (≤768px): fila de chips scrollable encima del contenido.

#### Scenario: Índice generado del contenido
- WHEN se abre cualquier .md (con o sin la plantilla del investigador)
- THEN el índice se genera de los headings reales del documento

#### Scenario: Navegación
- WHEN el usuario pulsa una entrada del índice
- THEN el visor hace scroll a esa sección dentro del visor

#### Scenario: Documento corto
- WHEN el documento tiene menos de 3 headings
- THEN el índice se oculta

### Requirement: Un lector, dos entradas
El visor (DocReader) SHALL usarse tanto en el modal de vista previa de Cerebro como en el botón "Visualizar" del chat. No SHALL haber dos lectores distintos.

#### Scenario: Desde Cerebro
- WHEN el usuario hace click en un .md en Cerebro (raw/outputs/estructura)
- THEN se abre el DocReader con nombre de archivo, contexto (proyecto) y acción Descargar

#### Scenario: Desde el chat
- WHEN el usuario pulsa "Visualizar" tras una investigación
- THEN se abre el mismo DocReader con el documento generado

#### Scenario: Archivo descargado intacto
- WHEN el usuario descarga el archivo desde el visor o la fila del archivo
- THEN el .md descargado conserva su sintaxis original completa

### Requirement: Sin sintaxis visible
El visor SHALL renderizar la sintaxis md como formato visual — el usuario no SHALL ver símbolos (`#`, `**`, `[[ ]]`, `|`) en el contenido renderizado.

#### Scenario: Wikilinks como conceptos
- WHEN el documento contiene [[wikilinks]]
- THEN se muestran como conceptos destacados clicables (estilo del tema), nunca con corchetes

## ADDED Requirements (fase 2)

### Requirement: Edición en caliente
El visor SHALL ofrecer un modo edición para documentos de `raw/` y `outputs/` (y para docs de investigación sin guardar): botón Editar → textarea monospace con el `.md` crudo, alternable entre Vista y Edición, con Guardar y Cancelar. Guardar un archivo del vault SHALL llamar a `POST /api/vault/update-file`; guardar un doc de investigación sin guardar SHALL reusar `POST /api/vault/save-output`.

#### Scenario: Corrección en caliente
- WHEN el usuario edita y guarda un doc de outputs/
- THEN el archivo se reescribe en disco con sintaxis .md pura, su copia wiki/ se actualiza y el grafo se regenera — sin borrar ni volver a subir el archivo

#### Scenario: Alternar vista y edición
- WHEN el usuario está en modo edición
- THEN puede alternar entre el textarea crudo y la vista renderizada antes de guardar

#### Scenario: Cancelar
- WHEN el usuario cancela la edición
- THEN el contenido vuelve al original sin tocar disco ni grafo

### Requirement: Fullscreen móvil
En móvil (≤768px) el visor SHALL ocupar la pantalla completa (sin bordes ni radius), manteniendo los chips del índice scrollables.

#### Scenario: DocReader en 375px
- WHEN se abre el visor con viewport ≤768px
- THEN el panel cubre el viewport completo y el scrollWidth del documento no excede el ancho

### Requirement: Entrada desde el investigador
El panel del investigador SHALL ofrecer "Ver documento" que abra el DocReader (con Editar y Descargar) por encima del panel. La vista compacta inline SHALL seguir existiendo como resumen rápido.

#### Scenario: Ver doc investigado
- WHEN la investigación termina y el usuario pulsa "Ver documento"
- THEN se abre el mismo DocReader con índice y acciones, por encima del panel
