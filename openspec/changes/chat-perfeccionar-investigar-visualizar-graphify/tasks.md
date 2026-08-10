# Tasks — chat-perfeccionar-investigar-visualizar-graphify

## Fase 1: MarkdownViewer reusable

- [ ] 1.1 Crear `frontend/src/components/shared/MarkdownViewer.jsx` — parser markdown completo (h1-h4, bold, italic, code, code blocks, tablas, listas, wikilinks, links, blockquotes, hr)
- [ ] 1.2 Integrar MarkdownViewer en ChatView preview modal (reemplazar renderMarkdown local)
- [ ] 1.3 Integrar MarkdownViewer en GrafoView panel wiki (reemplazar renderMarkdown local)

## Fase 2: Investigar refactor (resumen + doc completo)

- [ ] 2.1 Modificar endpoint `/api/chat/investigate` en backend — generar full_doc + summary (segunda llamada chat-default), devolver `{response: summary, full_doc, context}`
- [ ] 2.2 Modificar ChatView — guardar `full_doc` en el mensaje para usarlo en Descargar/Visualizar
- [ ] 2.3 Modificar ChatView — botón Descargar usa `full_doc` (no `msg.content`)
- [ ] 2.4 Modificar ChatView — botón Visualizar abre `full_doc` en MarkdownViewer
- [ ] 2.5 Modificar ChatView — botón Añadir al cerebro guarda `full_doc` (no `msg.content`)

## Fase 3: Fix bug proyecto nuevo

- [ ] 3.1 Fix `handleSaveSubmit` en ChatView.jsx — asegurar que `projectId` del proyecto creado se pasa a `onSaveOutput`

## Fase 4: GrafoView — toggle neuronas/estructura

- [ ] 4.1 Añadir toggle en GrafoView para switch entre grafo "Estructura" (wikilinks) y "Neuronas" (graph.json de Graphify)
- [ ] 4.2 GrafoView modo neuronas lee `graph.json` (ya existe endpoint `/api/graph/full`)
- [ ] 4.3 Mensaje "No hay neuronas" si graph.json tiene 0 nodos

## Fase 5: Verificación

- [ ] 5.1 Subir archivo .py → verificar nodos en graph.json
- [ ] 5.2 Subir archivo .md → verificar nodos en graph.json
- [ ] 5.3 Investigar mensajes → verificar resumen en bubble + full_doc al descargar
- [ ] 5.4 Visualizar documento → verificar MarkdownViewer renderiza formato
- [ ] 5.5 Crear proyecto nuevo desde "Añadir al cerebro" → verificar archivo en outputs/<nuevo_proyecto>/
- [ ] 5.6 GrafoView toggle neuronas → verificar nodos visibles
