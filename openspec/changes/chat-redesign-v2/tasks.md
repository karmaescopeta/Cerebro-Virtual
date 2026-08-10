# Tasks — Chat Redesign V2

## Fase 1: SearXNG
- [ ] 1.1 Añadir servicio `searxng` a `docker-compose.yml` (imagen `searxng/searxng:latest`, puerto 8888, red cerebro-network)
- [ ] 1.2 Crear `searxng/settings.yml` con `search.formats: [html, json]` habilitado
- [ ] 1.3 Levantar SearXNG: `docker compose up -d searxng`
- [ ] 1.4 Verificar API: `curl "http://localhost:8888/search?q=test&format=json"` devuelve JSON con resultados
- [ ] 1.5 Backend helper `search_internet(query, limit=5)` en `main.py` — consulta SearXNG, devuelve `[{title, url, snippet}]`

## Fase 2: Perfiles
- [ ] 2.1 Eliminar 5 perfiles viejos de `sistema-agente/profiles/` (`hermes-coordinador`, `hermes-editor`, `hermes-indexador`, `hermes-sintetizador`, `hermes-investigador-resumidor`)
- [ ] 2.2 Crear perfil `chat-default/` (config.yaml: model `openrouter/auto`, skills `[web]`, temp 0.3; SOUL.md: ChatGPT-like; distribution.yaml)
- [ ] 2.3 Crear perfil `chat-smart/` (config.yaml: model `deepseek/deepseek-v4-flash`, skills `[web]`, temp 0.3; SOUL.md: igual que default; distribution.yaml)
- [ ] 2.4 Crear perfil `cerebro/` (config.yaml: model `deepseek/deepseek-v4-flash`, skills `[file, terminal]`, temp 0.2; SOUL.md: RAG vault anti-alucinación; distribution.yaml)
- [ ] 2.5 Crear perfil `investigador/` (config.yaml: model `deepseek/deepseek-v4-flash-latest`, skills `[web, file, terminal]`, temp 0.4; SOUL.md: investigación Markdown Obsidian; distribution.yaml)
- [ ] 2.6 Reescribir `install_profiles.sh` con 4 perfiles nuevos (keys: `chat-default`, `chat-smart`, `cerebro`, `investigador`)
- [ ] 2.7 Actualizar `PROFILE_DEFS` en `main.py` con 4 perfiles nuevos
- [ ] 2.8 Actualizar `generate_config.py` con keys de perfiles nuevos
- [ ] 2.9 Rebuild agente: `docker compose up -d --build sistema-agente`
- [ ] 2.10 Verificar: `docker exec cerebro-agente ls /app/hermes-home/profiles/` muestra 4 perfiles

## Fase 3: Sesiones
- [ ] 3.1 Crear carpeta `vault/chat-sesiones/` con `.gitkeep`
- [ ] 3.2 Backend: helper `_sessions_dir()` → `Path(VAULT_PATH) / "chat-sesiones"`
- [ ] 3.3 Backend: `GET /api/chat/sessions` — lista sesiones (metadata sin messages), ordenadas por `updatedAt` desc
- [ ] 3.4 Backend: `POST /api/chat/sessions` — crea sesión vacía con UUID, marca `lastActive: true` (desmarca anterior), devuelve `{id, title, createdAt}`
- [ ] 3.5 Backend: `GET /api/chat/sessions/{id}` — sesión completa con messages
- [ ] 3.6 Backend: `PUT /api/chat/sessions/{id}` — actualizar `title`, `messages`, `lastActive`. Solo una sesión con `lastActive: true`
- [ ] 3.7 Backend: `DELETE /api/chat/sessions/{id}` — borra JSON. Si era `lastActive`, marca la siguiente disponible
- [ ] 3.8 Backend: helper `_load_session_history(session_id, limit=10)` — lee últimos N messages para inyectar como contexto
- [ ] 3.9 Backend: helper `_save_to_session(session_id, role, content, context)` — añade mensaje al JSON + actualiza `updatedAt`
- [ ] 3.10 Backend: auto-generar título desde primer mensaje (primeros 40 chars) si title está vacío
- [ ] 3.11 Verificar endpoints con curl

## Fase 4: Backend chat refactor
- [ ] 4.1 Refactor `POST /api/chat` — aceptar `{message, session_id, mode}` donde mode = `default|smart|cerebro|cerebro+internet`
- [ ] 4.2 Helper `_ask_hermes(profile, prompt, history)` — docker exec con `-p <profile>`, inyecta historial (últimos 10 msgs)
- [ ] 4.3 Helper `_format_search_results(results)` — formatea resultados SearXNG como contexto para el modelo
- [ ] 4.4 Helper `_summarize_internet(results, query, history)` — resume resultados web con modelo
- [ ] 4.5 Modo `default`: SearXNG + `_ask_hermes("chat-default", ...)`
- [ ] 4.6 Modo `smart`: SearXNG + `_ask_hermes("chat-smart", ...)`
- [ ] 4.7 Modo `cerebro`: search_graph + search_vault + `_ask_hermes("cerebro", contexto + pregunta)`. Sin internet.
- [ ] 4.8 Modo `cerebro+internet`: vault primero → si hay, cerebro resp. Si no, "sin resultados". SearXNG → resumen internet. Combinar en respuesta dividida.
- [ ] 4.9 Refactor `POST /api/chat/investigate` — aceptar `{messages: [...], session_id}`, combinar mensajes seleccionados como contexto, invocar perfil `investigador`
- [ ] 4.10 Endpoint `POST /api/vault/save-output` — aceptar `{content, project_id, name, description}` (name y description opcionales, auto-generar si vacío)
- [ ] 4.11 Guardar mensaje user + assistant en sesión tras cada interacción
- [ ] 4.12 Verificar todos los modos con curl

## Fase 5: Frontend
- [ ] 5.1 App.jsx: state `activeSessionId`, `sessions`, `chatSmart`, `cerebroMode`, `internetMode`, `investigationMode`, `selectedMessages`
- [ ] 5.2 App.jsx: `loadSessions()` al montar → buscar lastActive → cargar messages
- [ ] 5.3 App.jsx: `handleSendChat` refactor — enviar `{message, session_id, mode}` donde mode se calcula de toggles
- [ ] 5.4 App.jsx: `handleNewSession()`, `handleSwitchSession(id)`, `handleDeleteSession(id)`, `handleRenameSession(id, title)`
- [ ] 5.5 App.jsx: `handleInvestigate(selectedMessages)` — `POST /api/chat/investigate` con mensajes seleccionados
- [ ] 5.6 App.jsx: `handleSaveOutput` refactor — aceptar `{content, project_id, name, description}`
- [ ] 5.7 ChatView.jsx: botón "Chats" arriba-izquierda → panel lateral sesiones
- [ ] 5.8 ChatView.jsx: panel sesiones (lista + nuevo + eliminar + rename)
- [ ] 5.9 ChatView.jsx: barra de botones — `[Añadir archivos] [Chat inteligente] [Cerebro] [Búsqueda Internet] [Investigar]`
- [ ] 5.10 ChatView.jsx: toggle Chat inteligente (gris/azul, ON/OFF)
- [ ] 5.11 ChatView.jsx: toggle Cerebro (gris/verde, ON/OFF). Al ON → desactiva Chat inteligente visualmente. Al OFF → restaura estado anterior.
- [ ] 5.12 ChatView.jsx: toggle Búsqueda Internet (solo visible si Cerebro ON)
- [ ] 5.13 ChatView.jsx: renderizar respuesta dividida (🧠 Cerebro / divisor / 🌐 Internet)
- [ ] 5.14 ChatView.jsx: modo investigación — checkboxes en mensajes, botón "Investigar (N)", botón "Cancelar"
- [ ] 5.15 ChatView.jsx: popup "Añadir" — nombre + descripción + radio proyecto existente/crear nuevo + select desplegable
- [ ] 5.16 ChatView.jsx: markdown renderer mejorado (code blocks, wikilinks, tablas, inline bold/code)
- [ ] 5.17 ChatView.jsx: vista previa modal con renderer mejorado
- [ ] 5.18 app.css: estilos session panel, checkboxes investigación, respuesta dividida, popup añadir
- [ ] 5.19 Build: `cd frontend && npm run build` sin errores

## Fase 6: Verificación
- [ ] 6.1 Rebuild completo: `docker compose down && docker compose --profile agent --profile tools up -d --build`
- [ ] 6.2 SearXNG: `curl "http://localhost:8888/search?q=test&format=json"` devuelve JSON
- [ ] 6.3 Perfiles: `docker exec cerebro-agente ls /app/hermes-home/profiles/` muestra 4
- [ ] 6.4 Sesiones: crear → enviar mensaje → refrescar → sesión carga con historial
- [ ] 6.5 Chat default: enviar mensaje → responde con búsqueda internet
- [ ] 6.6 Chat smart: toggle ON → mensaje → responde con modelo paid
- [ ] 6.7 Cerebro ON: mensaje → responde desde vault
- [ ] 6.8 Cerebro + Internet: respuesta dividida en 2 secciones
- [ ] 6.9 Investigación: seleccionar 2 mensajes → investigar → documento con 3 botones
- [ ] 6.10 Añadir al cerebro: nombre + proyecto existente → archivo en outputs/ + wiki/
- [ ] 6.11 Eliminar sesión: archivos añadidos al cerebro se conservan
- [ ] 6.12 Tab MODELOS: 4 perfiles, editar modelo, docker restart
- [ ] 6.13 Exportar vault: `chat-sesiones/` incluido en .tar.gz
