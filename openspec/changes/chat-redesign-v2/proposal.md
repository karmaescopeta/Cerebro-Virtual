## Why

El chat actual usa `docker exec` one-shot sin memoria ni persistencia. Los 5 perfiles Hermes están muertos (solo el Coordinador responde; Kanban no funciona en one-shot). El usuario quiere sesiones persistentes estilo ChatGPT, perfiles que funcionen, búsqueda en internet real, y un flujo de investigación mejorado.

## What Changes

### Sesiones persistentes (**BREAKING**)
- Nueva carpeta `vault/chat-sesiones/` almacena sesiones como JSON (`{id, title, messages, createdAt, updatedAt}`)
- Al abrir el tab Chat, carga automáticamente la última sesión activa
- Botón "Chats" arriba-izquierda → panel lateral con listado de sesiones (click para abrir, eliminar, crear nueva)
- Título auto-generado desde el primer mensaje, editable por el usuario
- Sesiones se incluyen en export/import del vault (ya que viven en `vault/`)
- Eliminar sesión NO borra archivos/investigaciones ya añadidas al cerebro

### Perfiles — eliminación + nuevos (**BREAKING**)
- **Eliminados**: `hermes-coordinador`, `hermes-editor`, `hermes-indexador`, `hermes-sintetizador`, `hermes-investigador-resumidor` (muertos o redundantes)
- **Nuevos 4 perfiles**:
  1. `chat-default` — Chat normal free (`openrouter/auto` por defecto). ChatGPT-like, busca internet por defecto.
  2. `chat-smart` — Chat normal con modelo paid (usuario elige). Toggle ON/OFF.
  3. `cerebro` — RAG grafo-primero. Busca en vault/graph.json. Sin internet por defecto.
  4. `investigador` — Investigación detallada con documento Markdown. Selecciona 1+ mensajes como contexto.
- Display names editables en tab MODELOS (cosmético, no afecta key interna)
- `PROFILE_DEFS` en backend reescrito con los 4 perfiles nuevos

### Modos de chat — barra de botones
- **Sin Cerebro** (default): ChatGPT normal. Busca internet por defecto. Perfil `chat-default` o `chat-smart` si toggle ON.
- **Cerebro ON**: RAG vault. Botón "Búsqueda en Internet" aparece a la derecha de Cerebro.
  - Cerebro ON + Internet OFF: solo vault, si no hay info → "no encontré"
  - Cerebro ON + Internet ON: vault primero, si no hay → internet. Respuesta dividida en 2 secciones (🧠 Cerebro / 🌐 Internet)
- **Chat inteligente**: toggle ON/OFF. Si Cerebro ON, se ignora (Cerebro pisa). Al desactivar Cerebro, vuelve al estado anterior.
- Orden barra: `[Añadir archivos] [Chat inteligente] [Cerebro] [Búsqueda Internet] [Investigar]`

### Investigación — flujo mejorado
- Botón "Investigar" (derecha del todo) → activa modo selección con checkboxes en cada mensaje
- Selecciona 1+ mensajes (user o assistant) como contexto
- Perfil `investigador` genera documento Markdown detallado
- Resultado muestra 3 botones:
  1. **Descargar** — blob `.md`
  2. **Vista previa** — modal con markdown renderizado (mejorar renderer: code blocks, wikilinks, tablas, inline)
  3. **Añadir** — popup con: nombre (auto si vacío), descripción, asignar a proyecto existente o crear nuevo
- Añadir a proyecto existente = select desplegable con proyectos
- Crear proyecto nuevo = nombre + descripción + color (ya existe `POST /api/projects`)

### Búsqueda en internet — SearXNG
- SearXNG self-hosted en contenedor `cerebro-herramientas` (o servicio nuevo)
- Backend llama a SearXNG API → resultados → modelo resume
- Sin Cerebro: búsqueda internet integrada en el chat normal (el modelo usa los resultados)
- Con Cerebro + Internet: vault primero, si no hay → SearXNG → resumen breve

### Memoria conversacional
- Últimos 10 mensajes inyectados en cada prompt como contexto
- Sesión completa guardada en JSON (no se pierde nada)
- Si 10 no son suficientes, cargar más en futuro (extensible)

## Capabilities

### New Capabilities
- `chat-sessions`: Sesiones persistentes con historial, creación/eliminación/edición, carga automática
- `chat-profiles`: 4 perfiles nuevos con switching dinámico, display names editables
- `chat-modes`: Toggles Cerebro/Internet/Smart con exclusividad y respuesta dividida
- `internet-search`: SearXNG local para búsqueda web integrada en chat
- `chat-investigation`: Selección multi-mensaje, investigación, vista previa, descarga, añadir al cerebro

### Modified Capabilities
- `profiles-models`: PROFILE_DEFS reescrito (4 perfiles nuevos, keys cambiadas). Tab MODELOS muestra nuevos perfiles.

## Impact

- **Backend** (`main.py`): nuevos endpoints `/api/chat/sessions`, `/api/chat/sessions/{id}`, `/api/chat/search`. Refactor `/api/chat` con perfiles + memoria + modos. Endpoint SearXNG.
- **Frontend** (`ChatView.jsx`, `App.jsx`): refactor completo — sidebar sesiones, toggles, investigación, vista previa mejorada
- **Perfiles** (`sistema-agente/profiles/`): eliminar 5 viejos, crear 4 nuevos
- **Docker** (`docker-compose.yml`): SearXNG service o integración en herramientas
- **Vault**: nueva carpeta `vault/chat-sesiones/`
- **`install_profiles.sh`**: reescrito con 4 perfiles nuevos
- **`generate_config.py`**: actualizar keys de perfiles
- **Tab MODELOS** (`ModelosView.jsx`): 4 perfiles en vez de 5
