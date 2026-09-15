# Tasks — Fix Chat Tab Errors

## Frontend — ChatView.jsx

- [x] **T1**: Loading indicators contextuales
  - Reemplazar texto hardcoded "Investigando..." (línea ~194) con texto dinámico según modo activo
  - Modos: default→"Pensando...", smart→"Pensamiento profundo...", cerebro→"Buscando en mi cerebro...", investigar→"Investigando..."
  - También cambiar icono: investigar usa `search`, resto usa `psychology` o `lightbulb`

- [ ] **T2**: Enter en modo investigar llama onInvestigate
  - Modificar `onKeyDown` del input (línea ~292)
  - Si `investigationMode && chatMessage.trim()` → `onInvestigate([{role:'user', content: chatMessage}])` + clear input
  - Si no → `onSend()` (comportamiento actual)

- [ ] **T3**: Highlight visual de mensajes seleccionados
  - En el style del div del mensaje (línea ~154), añadir background condicional
  - `selectedMessages.includes(i)` → `rgba(173,198,255,0.15)` + border `1px solid var(--color-primary)`
  - Normal → colors actuales

- [ ] **T4**: Pasar props necesarias a ChatView
  - Verificar que `investigationMode`, `chatSmart`, `cerebroMode` llegan a ChatView (ya llegan — confirmado en firma)
  - Sin cambios extra si ya están

## Frontend — App.jsx

- [ ] **T5**: Optimistic UI en handleSendChat
  - Mover `setChatMessages(user)` + `setChatMessage('')` + `setChatAttachedFile(null)` ANTES del fetch
  - El `setChatMessages(assistant)` se queda después del fetch
  - Mantener todo lo demás igual (modo, sesión, error handling)

- [ ] **T6**: handleInvestigate — pasar mensajes correctos
  - Cuando `onInvestigate` recibe `[{role:'user', content: text}]` (desde input directo), usar ese array
  - Cuando recibe `selectedMessages` (índices), mapear a `chatMessages[idx]` (comportamiento actual)
  - Ya funciona así — solo verificar que el flujo del T2 llega correctamente

## Backend — main.py

- [ ] **T7**: Reescribir investigate() — 1 llamada + resumen extraído
  - Reemplazar 2 llamadas secuenciales (investigador 180s + chat-default 60s) por 1 sola
  - Timeout: 90s
  - Prompt pide documento completo con resumen al inicio
  - Extraer resumen = contenido entre `## Resumen` y siguiente `##`
  - Si no hay `## Resumen`, usar primeras 5 líneas

- [ ] **T8**: Multi-mensaje con directrices
  - Si `len(messages_list) >= 2`: pre-llamada `chat-default` (timeout 45s) para extraer directrices
  - Usar directrices como contexto en el prompt del investigador
  - Si 1 mensaje: directo al investigador sin pre-paso

- [ ] **T9**: Helper _extract_summary(full_doc)
  - Buscar `## Resumen` en el documento
  - Extraer texto hasta el siguiente `##`
  - Si no existe, primeras 5 líneas no-vacías
  - Return string

## Backend — Graphify

- [ ] **T10**: _ensure_herramientas_image()
  - `docker images -q cerebrovirtual-herramientas:latest`
  - Si vacío → `_compose_cmd("build", "herramientas")` con timeout 120s
  - Return bool

- [ ] **T11**: Integrar _ensure_herramientas_image en _run_graphify
  - Llamar al inicio de _run_graphify
  - Si falla, log claro + return None

- [ ] **T12**: Mejor logging en _run_graphify
  - Print cuando imagen falta, cuando graphify falla, cuando no genera graph.json
  - Mensajes en español, claros, con emoji para diagnóstico

- [ ] **T13**: Endpoint GET /api/graph/status
  - Devuelve: `{image_exists: bool, graph_nodes: int, graph_edges: int, last_error: str|None}`
  - Útil para diagnóstico desde frontend

## Verificación

- [ ] **V1**: Reconstruir frontend (`docker compose build frontend`)
- [ ] **V2**: Reconstruir backend (`docker compose build backend`)
- [ ] **V3**: Probar loading indicators — enviar msg en cada modo, verificar texto
- [ ] **V4**: Probar Enter en modo investigar — escribir + Enter, verificar que investiga directo
- [ ] **V5**: Probar highlight visual — seleccionar mensajes, verificar fondo
- [ ] **V6**: Probar optimistic UI — enviar msg, verificar que aparece inmediatamente
- [ ] **V7**: Probar investigar — seleccionar msg, investigar, verificar que no cuelga
- [ ] **V8**: Probar multi-mensaje — seleccionar 2+, investigar, verificar directrices
- [ ] **V9**: Verificar graph.json tiene nodos (`GET /api/graph/full`)
- [ ] **V10**: Verificar neural map muestra nodos en GrafoView
- [ ] **V11**: Probar modo Cerebro — preguntar, verificar que usa grafo como contexto
