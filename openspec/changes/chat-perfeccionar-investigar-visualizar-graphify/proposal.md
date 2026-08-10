## Why

El chat del Cerebro Virtual tiene 4 problemas que afectan usabilidad y el sistema de conocimiento:
1. **Investigar** devuelve el .md completo en el bubble — inútil, debería dar resumen breve + .md completo solo al descargar.
2. **Visualizador .md** no existe — el preview actual renderiza markdown plano. Los títulos, negritas, tablas y code blocks no se ven como tales. Sin componente reusable.
3. **Bug "nuevo proyecto" en save-output** — crea el proyecto pero el archivo se guarda en `individual`, no en el proyecto nuevo.
4. **Graphify roto** — `graph.json` tiene 0 nodos. Los archivos nuevos no generan neuronas. El grafo de neuronas está vacío.

## What Changes

- **Investigar refactor**: El endpoint `/api/chat/investigate` devolverá `{summary, full_doc}`. El bubble muestra `summary`. El botón Descargar guarda `full_doc`. El botón Visualizar abre `full_doc` en el visualizador.
- **Componente `MarkdownViewer`**: renderizador .md reusable con formato (h1-h4, bold, italic, code, code blocks, tablas, listas, wikilinks, hr, blockquotes). Mismo tema Obsidian Deep. Usado desde chat preview, GrafoView, y cualquier vista del cerebro.
- **Fix bug proyecto nuevo**: `handleSaveSubmit` en ChatView.jsx debe esperar la creación del proyecto, obtener su `id`, y pasarlo a `onSaveOutput`. Actualmente crea el proyecto pero no usa el `id` retornado.
- **Fix Graphify**: diagnosticar por qué `graphify extract` no genera nodos. Posibles causas: binario `graphify` no instalado en contenedor herramientas, modelo LLM mal configurado, o paths incorrectos. Reparar para que archivos nuevos generen neuronas.

## Capabilities

### New Capabilities
- `markdown-viewer`: Componente React reusable que renderiza Markdown a HTML con formato visual atractivo, integrado al design system Obsidian Deep. Utilizable desde cualquier vista del cerebro.
- `investigate-summary`: El modo investigar devuelve un resumen breve en el bubble + el documento completo para descargar/visualizar.

### Modified Capabilities
- `chat-save-output`: Fix bug — cuando se crea un proyecto nuevo, el archivo debe guardarse en ese proyecto, no en `individual`.
- `graphify-neurons`: Repair Graphify pipeline para que archivos nuevos generen nodos en `graph.json` (grafo de neuronas).

## Impact

- **Backend** `backend/app/main.py`: endpoint `/api/chat/investigate` (split summary/full), endpoint `/api/vault/save-output` (ya correcto, el bug es frontend), Graphify pipeline (`_run_graphify`, `_merge_graph`).
- **Frontend** `frontend/src/components/views/ChatView.jsx`: `handleSaveSubmit`, `renderMarkdown` (extraer a componente), botones post-investigar.
- **Frontend nuevo** `frontend/src/components/shared/MarkdownViewer.jsx`: componente reusable.
- **Frontend** `frontend/src/components/views/GrafoView.jsx`: reemplazar `renderMarkdown` local con `MarkdownViewer`.
- **Herramientas** `herramientas/scripts/run_graphify.sh` + Dockerfile: verificar binario `graphify` instalado.
