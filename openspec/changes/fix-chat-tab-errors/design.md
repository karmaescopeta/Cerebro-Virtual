# Design — Fix Chat Tab Errors

## Architectural Context

Stack: FastAPI backend (:8000) + React frontend (:5173) + Hermes Agent (:8080) + Herramientas (efímero).

El chat funciona así:
1. Frontend `ChatView.jsx` → `App.jsx` handlers → `fetch /api/chat`
2. Backend `_ask_hermes()` → `docker compose exec sistema-agente hermes chat -q -p <perfil>`
3. Para investigar: 2 llamadas secuenciales (`investigador` 180s + `chat-default` 60s)

## Changes by Area

### 1. Loading indicators contextuales (Frontend)

**Problema**: `ChatView.jsx` línea 194 siempre dice "Investigando..." sin importar el modo.

**Fix**: Pasar `chatMode` a `ChatView` o computar el texto desde los toggles existentes.

```jsx
// ChatView.jsx — reemplazar texto hardcoded
const loadingText = (() => {
  if (investigationMode) return 'Investigando...'
  if (cerebroMode) return 'Buscando en mi cerebro...'
  if (chatSmart) return 'Pensamiento profundo...'
  return 'Pensando...'
})()
```

**Diff**: 1 bloque en `ChatView.jsx` (~línea 189-198). Sin cambios en backend.

### 2. Investigar directo desde Enter (Frontend)

**Problema**: `ChatView.jsx` línea 292 — `onKeyDown` Enter siempre llama `onSend()`. En modo investigar, debería llamar `onInvestigate()`.

**Fix**: Modificar el handler del Enter:

```jsx
onKeyDown={(e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (investigationMode && chatMessage.trim()) {
      onInvestigate?.([{ role: 'user', content: chatMessage }])
      setChatMessage('')
    } else {
      onSend()
    }
  }
}}
```

**Diff**: 1 condicional en `onKeyDown`. Sin cambios en backend.

### 3. Highlight visual de seleccionados (Frontend)

**Problema**: Mensajes seleccionados solo muestran checkbox, sin highlight de fondo.

**Fix**: Añadir estilo condicional al bubble del mensaje:

```jsx
// En el style del div del mensaje (línea ~154)
background: selectedMessages.includes(i)
  ? 'rgba(173,198,255,0.15)'  // highlight
  : msg.role === 'user' ? 'var(--color-surface-high)' : 'var(--color-surface-container)'
border: selectedMessages.includes(i)
  ? '1px solid var(--color-primary)'
  : '1px solid var(--color-surface-high)'
```

**Diff**: 1 bloque de style. Sin cambios en backend.

### 4. Envío inmediato / optimistic UI (Frontend)

**Problema**: `handleSendChat` en `App.jsx` (línea 263) hace `setChatMessages(p => [...p, user, assistant])` después del fetch. El usuario no ve su mensaje hasta que el backend responde.

**Fix**: Split en 2 pasos:
1. Añadir user msg inmediatamente + limpiar input + mostrar loading
2. Añadir assistant msg cuando backend responda

```jsx
async function handleSendChat() {
  if (!chatMessage.trim() && !chatAttachedFile) return
  setChatLoading(true)
  let msg = chatMessage
  if (chatAttachedFile) { /* ... mismo que antes ... */ }
  const mode = computeMode()
  // optimistic: añadir user msg inmediatamente
  setChatMessages(p => [...p, { role: 'user', content: msg, attachment: chatAttachedFile }])
  setChatMessage(''); setChatAttachedFile(null)
  try {
    const res = await fetch('/api/chat', { ... })
    // ... procesar respuesta ...
    setChatMessages(p => [...p, { role: 'assistant', content: txt, context: ctx }])
  } catch { ... } finally { setChatLoading(false) }
}
```

**Diff**: Mover `setChatMessage('')` y `setChatAttachedFile(null)` antes del fetch. Separar el `setChatMessages` en 2 llamadas.

### 5. Fix Investigar colgado (Backend)

**Problema**: `_ask_hermes("investigador", ...)` con timeout=180s + segunda llamada con timeout=60s = 240s total. El frontend `fetch` no tiene timeout propio, pero la UX es horrible.

**Fix**: 
- **1 llamada en vez de 2**: El endpoint `investigate` hace 1 sola llamada al perfil `investigador` con instrucciones de incluir resumen al inicio del documento. El `full_doc` ya contiene todo. El `response` es el resumen (primeras 5 líneas del doc).
- **Timeout reducido a 90s**.
- **Verificar perfil**: El perfil `investigador` existe en `sistema-agente/profiles/investigador/config.yaml`. El binario Hermes está en `/usr/local/lib/hermes-agent/venv/bin/hermes` (confirmado en Dockerfile + entrypoint.sh).

```python
@app.post("/api/chat/investigate")
async def investigate(message: dict):
    # ... parsear messages ...
    combined = "\n".join(f"[{m['role']}]: {m['content']}" for m in messages_list)
    prompt = (
        "Investiga el siguiente tema y genera un documento Markdown completo. "
        "Empieza con un resumen de 3-5 líneas, luego secciones detalladas. "
        "Estructura: # Título, ## Resumen, ## Secciones, ## Conclusiones.\n\n"
        f"Contexto:\n{combined}"
    )
    full_doc = _ask_hermes("investigador", prompt, history, timeout=90)
    # extraer resumen = primer párrafo después de ## Resumen
    summary = _extract_summary(full_doc)
    return {"response": summary, "full_doc": full_doc, "context": {...}}
```

**Diff**: Reescribir `investigate()` (~líneas 983-1038).

### 6. Multi-mensaje con resumen de directrices (Backend)

**Problema**: Actualmente solo concatena texto plano. No genera directrices.

**Fix**: Si hay 2+ mensajes, añadir un paso de pre-resumen antes del documento:

```python
if len(messages_list) >= 2:
    # resumen de directrices desde los mensajes
    directive_prompt = (
        "Analiza los siguientes mensajes y extrae los puntos clave, "
        "directrices e instrucciones sobre el tema a investigar. "
        "Formato: lista de puntos.\n\n"
        f"Mensajes:\n{combined}"
    )
    directives = _ask_hermes("chat-default", directive_prompt, history, timeout=45)
    prompt = f"Directrices extraídas:\n{directives}\n\nGenera el documento...\n{combined}"
else:
    prompt = f"Investiga: {combined}"
```

**Diff**: Añadir bloque condicional en `investigate()`.

### 7. Fix Graphify/Neural Map (Backend + Docker)

**Problema**: `_run_graphify` hace `docker run cerebrovirtual-herramientas:latest`. Si la imagen no está construida, falla silenciosamente (`return None`).

**Fix**:
- **Verificar imagen antes de ejecutar**: `docker images -q cerebrovirtual-herramientas:latest`. Si no existe, construir con `docker compose build herramientas`.
- **Mejor logging**: Print claro cuando la imagen falta o graphify falla.
- **Endpoint de diagnóstico**: `GET /api/graph/status` — devuelve si la imagen existe, si graph.json tiene nodos, último error.

```python
def _ensure_herramientas_image() -> bool:
    result = subprocess.run(
        ["docker", "images", "-q", "cerebrovirtual-herramientas:latest"],
        capture_output=True, text=True, timeout=5
    )
    if result.stdout.strip():
        return True
    # construir
    subprocess.run(_compose_cmd("build", "herramientas"), capture_output=True, timeout=120)
    return True
```

**Diff**: Añadir `_ensure_herramientas_image()`, llamar al inicio de `_run_graphify`.

## Root Cause Analysis

| Bug | Síntoma | Root Cause |
|-----|---------|------------|
| Loading siempre "Investigando" | Texto hardcoded en JSX | Falta de contexto de modo en el render del loading |
| Enter no investiga | `onKeyDown` siempre llama `onSend()` | No distingue modo investigar |
| Sin highlight visual | Style no usa `selectedMessages` | Solo checkbox, sin style condicional |
| Msg no aparece hasta respuesta | `setChatMessages` después de fetch | Falta optimistic UI |
| Investigar cuelga | 2 llamadas 240s total | Redundancia + timeout excesivo |
| Multi-msg sin directrices | Solo concatena texto | Falta paso de resumen |
| Neural map vacío | Imposible no construida o graph.json vacío | `_run_graphify` falla silenciosamente |

## No Changes

- No añadir dependencias npm/pip nuevas.
- No cambiar la arquitectura de docker compose.
- No modificar el Dockerfile del sistema-agente.
- No añadir WebSocket (el polling simple es suficiente para el volumen actual).
