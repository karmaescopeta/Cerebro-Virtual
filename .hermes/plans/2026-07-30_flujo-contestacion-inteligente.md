# Flujo de Contestación Eficiente — Plan v2

**Goal:** Chat usa graph.json (Neuronas) como índice primario → lee solo .md relevantes → fallback keyword si no hay nodos → investigar + guardar en outputs/ sin síntesis extra.

**Cambios vs v1:** sin `search_structure()`, sin copia a raw/, sin `_synthesize_wiki()` en save-output. 2 pases de disco, no 3. 1 docker exec en save-output, no 2.

## Tareas

1. **Modificar `search_graph()`** — boost por stem (ya tiene label matching, añadir boost)
2. **Refactor `POST /api/chat`** — grafo primero, vault fallback, `found_info` flag, `offer_internet`
3. **`POST /api/chat/investigate`** — docker exec al perfil investigador → Markdown Obsidian
4. **`POST /api/vault/save-output`** — guarda outputs/ + wiki/ tal cual + Graphify sobre outputs
5. **Frontend ChatView** — botones post-respuesta + handlers
6. **Verificación end-to-end**

## Archivos

- `backend/app/main.py` — modificar search_graph, chat, añadir 2 endpoints
- `frontend/src/components/views/ChatView.jsx` — botones + handlers
- `frontend/src/app.css` o tokens — estilos botones

Estructura (GrafoView) no se toca. Ya es visual.
