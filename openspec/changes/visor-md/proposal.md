# Proposal: visor-md

## Why

El MarkdownViewer actual traduce la sintaxis .md pero con tipografía de burbuja de chat (13.5px, sin jerarquía de lectura, sin navegación). El usuario final no debe ver símbolos de sintaxis — debe ver información clara, atractiva y estructurada. Además, el archivo descargado DEBE conservar su sintaxis .md y estar optimizado para la extracción de Graphify (nodos/relaciones limpios).

**Delta (fase 2, misma sesión — aprobada tras la verificación de fase 1):** el visor debe permitir corregir en caliente (sin borrar ni volver a subir), actualizando el grafo de conocimiento; en móvil debe ocupar la pantalla completa; el investigador debe poder abrir el doc en el visor; y las investigaciones deben sobrevivir la recarga (hoy viven solo en estado React). Además los procesos largos (investigar, editar+regrafo, subir archivos) no deben bloquear la UI: se ejecutan por detrás y avisan con un toast.

## What Changes

- **`src/mdTheme.js` NUEVO** — archivo de traducción símbolo→estilo: un objeto con los estilos de cada elemento md (h1-h4, p, bold, italic, code, codeBlock, blockquote, table, ul, ol, link, wikilink, hr, index). Punto único de personalización; futuro premium: Ajustes podrá sobreescribirlo por símbolo.
- **MarkdownViewer refactor** — lee estilos desde `mdTheme.js` (mismo parser, cero lógica nueva). Prop `compact` para burbujas de chat (escala chat); sin compact = escala documento (15px base, más aire). Los h1-h3 llevan `id` (slug) para navegación por índice.
- **`DocReader.jsx` NUEVO** (components/shared/) — EL visor: cabecera (nombre archivo + contexto, close), índice de secciones clicable generado de los headings del contenido (lateral en desktop, chips scrollables arriba en móvil), contenido a ancho de lectura (~72ch) centrado, slot para botones de acción (Descargar, Editar, etc.).
- **Edición en caliente (fase 2)** — DocReader con modo edición: botón Editar → textarea monospace con el .md crudo + alternar Vista/Edición → Guardar llama a `POST /api/vault/update-file` (raw/ o outputs/), que reescribe el archivo, actualiza su copia en wiki/ (si existe), purga los nodos/edges viejos de ese archivo en graph.json y re-extrae con Graphify. El doc de investigación aún sin guardar se guarda con `save-output` (reusa el flujo existente). En móvil el panel ocupa la pantalla completa.
- **Ver documento en el investigador (fase 2)** — botón "Ver documento" en el panel del investigador abre el DocReader por encima del panel (mismo componente, con Editar).
- **Persistencia de investigaciones (fase 2)** — el backend guarda el doc como mensaje `assistant` de la sesión activa (`_save_to_session` con `full_doc`) antes de responder; aparece en el chat con Visualizar tras recargar, y "Ver investigaciones" se repobla leyendo los mensajes `is_document` de las sesiones (muere la memoria como fuente de verdad).
- **Procesos no bloqueantes (fase 2)** — investigación, edición+regrafo y subida de archivos: fire-and-forget con toast global al terminar (mini flash en App); la UI queda libre para navegar. Si el usuario recarga a mitad de una investigación, el doc igualmente queda persistido por el backend y aparece al recargar.
- **`TEMPLATE.md` NUEVO** (sistema-agente/profiles/investigador/) — plantilla + reglas de estructura/sintaxis del documento optimizadas para Graphify Pass 3 (LLM lee el .md → nodos/edges): conceptos con nombre inequívoco, [[wikilinks]] como anclas de concepto, relaciones explícitas, secciones fijas. Referenciado por el SOUL.md del investigador (se integra en el punto 1).
- Veredicto del consejo fase 1 aplicado: índice clicable, NO rehash del renderer. La "solo lectura" queda superada por el delta aprobado (edición en caliente).

## Capabilities

### New Capabilities
- `doc-reader`: Visor de documentos compartido (Cerebro + chat + investigador) con índice, tema de estilo separado, escala de lectura, edición en caliente y fullscreen móvil.
- `graphify-doc-template`: Plantilla y reglas de estructura .md optimizada para extracción Graphify.
- `knowledge-update`: Actualización del conocimiento del cerebro al editar un archivo (re-grafo atómico por archivo).
- `research-persistence`: Investigaciones persistentes como mensajes de sesión + procesos largos no bloqueantes con toast.

### Modified Capabilities
<!-- research-panel: "Ver investigaciones" pasa a leer de las sesiones en vez de estado en memoria (delta en research-persistence) -->

## Impact

- Solo frontend-test4: `src/mdTheme.js` (nuevo), `src/components/shared/MarkdownViewer.jsx` (refactor de estilos + compact), `src/components/shared/DocReader.jsx` (nuevo, fase 2: modo edición), `CerebroView.jsx` + `ChatView.jsx` (swap de modal, patch), `ResearchPanel.jsx` (botón Ver documento), `App.jsx` (toast global + append de doc al chat + historial desde sesiones), `app.css` (clases `.docreader-*`, media query fullscreen).
- Backend: `backend/app/main.py` SOLO patch — `POST /api/vault/update-file` (nuevo), `_save_to_session` con `full_doc` opcional, `investigate` guarda el doc en sesión antes de responder.
- `sistema-agente/profiles/investigador/TEMPLATE.md` (nuevo) — sin tocar más backend.
- Descarga intacta: el archivo en disco conserva sintaxis .md pura.
