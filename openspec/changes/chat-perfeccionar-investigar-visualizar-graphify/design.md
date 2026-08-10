## Context

Chat del Cerebro Virtual funcional con 4 perfiles, sesiones persistentes, modos (default/smart/cerebro/cerebro+internet), RAG grafo-primero, SearXNG. 4 problemas a resolver:

1. **Investigar** devuelve .md completo en bubble → inútil, el usuario ve un muro de texto.
2. **Visualizador .md** — `renderMarkdown` existe en ChatView.jsx y GrafoView.jsx pero es duplicado, básico (no tablas, no blockquotes, no links). No hay componente reusable.
3. **Bug "nuevo proyecto"** — `handleSaveSubmit` en ChatView.jsx: crea proyecto vía `POST /api/projects`, obtiene `d.id`, pero si la respuesta no tiene `id`, `projectId` se queda en `'individual'`.
4. **Graphify** — verificado funcional. El grafo estaba vacío por falta de uploads, no por bug. El problema real es que GrafoView no muestra el grafo de neuronas.

## Goals / Non-Goals

**Goals:**
- Investigar: resumen breve en bubble + .md completo para descargar/visualizar.
- MarkdownViewer: componente reusable, formato completo, tema Obsidian Deep.
- Fix bug proyecto nuevo.
- GrafoView: mostrar grafo de neuronas (Graphify) además del de estructura (wikilinks).

**Non-Goals:**
- Streaming de respuestas (futuro).
- Cambiar modelos de perfiles.
- Refactor de sesiones.

## Decisions

### 1. Investigar: dos llamadas vs una con split
**Decisión:** Una llamada al endpoint `/api/chat/investigate` que devuelve `{summary, full_doc}`.

El perfil investigador genera el .md completo. Luego una segunda llamada rápida al perfil chat-default genera el resumen (3-5 líneas) desde el .md completo.

**Alternativa considerada:** Una sola llamada con prompt que genere ambos → impredecible, el modelo puede mezclar formato. Dos llamadas es más fiable.

### 2. MarkdownViewer: parser propio vs librería
**Decisión:** Parser propio en React, sin librería externa.

El parser actual ya maneja headers, bold, code, wikilinks. Añadir: tablas, blockquotes, links, listas ordered, italic. ~150 líneas. Una librería como `react-markdown` añade 50KB+ bundle y dependencia.

**Alternativa considerada:** `react-markdown` + `remark-gfm` → más completo pero pesado. Ponytail: stdlib primero, parser propio suficiente para Obsidian-flavored markdown.

### 3. Bug proyecto nuevo: fix en frontend
**Decisión:** Fix en `handleSaveSubmit` en ChatView.jsx.

El bug: `d.id` del `POST /api/projects` puede no llegar si el response no lo incluye. Verificado: el backend retorna `new_project` que tiene `id`. El bug real es que `projectId` no se actualiza correctamente en el flujo `handleSaveSubmit`.

### 4. GrafoView: grafo de neuronas
**Decisión:** Añadir toggle en GrafoView para switch entre "Estructura" (wikilinks) y "Neuronas" (Graphify). El grafo de neuronas lee `graph.json`. El de estructura lee `wiki/graph.json` o deriva de wikilinks.

## Risks / Trade-offs

- [Parser propio puede no manejar edge cases de markdown] → suficientes para Obsidian-flavored; si se necesitan features avanzadas, migrar a react-markdown después.
- [Dos llamadas en investigar = 2x latencia] → la segunda (resumen) es rápida con modelo chat-default. Aceptable.
- [Grafo de neuronas puede tener 0 nodos] → mensaje claro al usuario: "Sube archivos para generar neuronas."

## Migration Plan

1. Crear `MarkdownViewer.jsx`.
2. Refactor ChatView: extraer renderMarkdown → usar MarkdownViewer.
3. Refactor GrafoView: usar MarkdownViewer + añadir toggle neuronas/estructura.
4. Fix handleSaveSubmit bug.
5. Modificar endpoint investigate: devolver summary + full_doc.
6. Tests: subir archivo, verificar nodos; investigar, verificar resumen + download.

## Open Questions

- ¿Necesitas que el grafo de neuronas y el de estructura se vean simultaneamente o toggle es suficiente? → toggle por ahora.
