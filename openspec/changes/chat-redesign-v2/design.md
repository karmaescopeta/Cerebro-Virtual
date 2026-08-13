# Design — Chat Redesign V2

## Arquitectura

### Sesiones persistentes

```
vault/chat-sesiones/
├── <uuid>.json    ← {id, title, messages: [{role, content, context, timestamp}], createdAt, updatedAt, lastActive}
```

Solo una sesión tiene `lastActive: true`. Al cambiar de sesión, se desmarca la anterior.

**Backend endpoints:**
- `GET /api/chat/sessions` → lista (sin messages, solo metadata)
- `POST /api/chat/sessions` → crea vacía, marca lastActive
- `GET /api/chat/sessions/{id}` → sesión completa con messages
- `PUT /api/chat/sessions/{id}` → actualizar title, messages, lastActive
- `DELETE /api/chat/sessions/{id}` → borrar JSON. Si era lastActive, marcar la siguiente.

**Frontend:**
- App.jsx state `activeSessionId` + `sessions` (lista metadata)
- Al cargar tab Chat: `GET /api/chat/sessions` → buscar `lastActive` → `GET /api/chat/sessions/{id}` → cargar messages
- Panel lateral "Chats": lista de sesiones, click para cambiar, botón nuevo, botón eliminar
- Auto-guardado: tras cada mensaje enviado/recibido, `PUT /api/chat/sessions/{id}` con messages actualizados

### Memoria conversacional

Últimos 10 mensajes inyectados en cada prompt. Formato:

```
Historial de conversación:
[user]: Hola, ¿qué sabes de X?
[assistant]: X es...
[user]: ¿Y sobre Y?
[assistant]: ...

Pregunta actual: <nuevo mensaje>
```

Sesión completa guardada en JSON. Si 10 no son suficientes en futuro, subir N o usar memoria persistente de Hermes (skills).

### Perfiles — 4 nuevos

```
sistema-agente/profiles/
├── chat-default/
│   ├── config.yaml      ← model: openrouter/auto, temp: 0.3, skills: [web]
│   ├── SOUL.md          ← ChatGPT-like, busca internet, responde directo
│   └── distribution.yaml
├── chat-smart/
│   ├── config.yaml      ← model: deepseek/deepseek-v4-flash, temp: 0.3, skills: [web]
│   ├── SOUL.md          ← Igual que default pero modelo más potente
│   └── distribution.yaml
├── cerebro/
│   ├── config.yaml      ← model: deepseek/deepseek-v4-flash, temp: 0.2, skills: [file, terminal]
│   ├── SOUL.md          ← RAG vault, anti-alucinación, cite fuentes
│   └── distribution.yaml
└── investigador/
    ├── config.yaml      ← model: deepseek/deepseek-v4-flash-latest, temp: 0.4, skills: [web, file, terminal]
    ├── SOUL.md          ← Investiga + genera Markdown Obsidian detallado
    └── distribution.yaml
```

**Invocación:**
- `chat-default`: `hermes chat -q -p chat-default "<msg>"`
- `chat-smart`: `hermes chat -q -p chat-smart "<msg>"`
- `cerebro`: backend busca en vault → `hermes chat -q -p cerebro "<contexto + pregunta>"`
- `investigador`: `hermes chat -q -p investigador "<contexto mensajes + investigación>"`

**`install_profiles.sh`:** 4 perfiles en vez de 5. Keys: `chat-default`, `chat-smart`, `cerebro`, `investigador`.

**`PROFILE_DEFS` en backend:**
```python
PROFILE_DEFS = [
    {"key": "chat-default", "label": "Chat Default", "default": "openrouter/auto"},
    {"key": "chat-smart", "label": "Chat Inteligente", "default": "deepseek/deepseek-v4-flash"},
    {"key": "cerebro", "label": "Cerebro", "default": "deepseek/deepseek-v4-flash"},
    {"key": "investigador", "label": "Investigador", "default": "deepseek/deepseek-v4-flash-latest"},
]
```

### SearXNG

**Opción A (recomendada): servicio separado en docker-compose**
```yaml
searxng:
  image: searxng/searxng:latest
  ports:
    - "8888:8080"
  volumes:
    - ./searxng:/etc/searxng
  environment:
    - SEARXNG_BASE_URL=http://localhost:8888/
  networks:
    - cerebro-network
```

Config: `settings.yml` con `search.formats: [html, json]` para habilitar API JSON.

**Backend helper:**
```python
def search_internet(query: str, limit: int = 5) -> list[dict]:
    """Busca en SearXNG. Returns [{title, url, snippet}]."""
    resp = requests.get(f"http://searxng:8080/search?q={query}&format=json", timeout=10)
    data = resp.json()
    return [{"title": r.get("title"), "url": r.get("url"), "snippet": r.get("content")}
            for r in data.get("results", [])[:limit]]
```

### Refactor POST /api/chat

```python
@app.post("/api/chat")
async def chat(message: dict):
    user_message = message.get("message", "")
    session_id = message.get("session_id")
    mode = message.get("mode", "default")  # "default" | "smart" | "cerebro" | "cerebro+internet"
    
    # 1. Cargar historial de sesión (últimos 10 mensajes)
    history = _load_session_history(session_id, limit=10)
    
    # 2. Determinar perfil + flujo según modo
    if mode == "cerebro" or mode == "cerebro+internet":
        # RAG grafo-primero
        vault_context = _search_vault(user_message)
        if mode == "cerebro+internet":
            internet_results = search_internet(user_message)
            # Respuesta dividida
            cerebro_resp = _ask_hermes("cerebro", vault_context + user_message, history)
            internet_resp = _summarize_internet(internet_results, user_message, history)
            response = f"🧠 **CEREBRO**\n\n{cerebro_resp}\n\n---\n\n🌐 **INTERNET**\n\n{internet_resp}"
        else:
            response = _ask_hermes("cerebro", vault_context + user_message, history)
    else:
        # Chat normal (default o smart)
        profile = "chat-smart" if mode == "smart" else "chat-default"
        internet_results = search_internet(user_message)
        context = _format_search_results(internet_results)
        response = _ask_hermes(profile, context + user_message, history)
    
    # 3. Guardar mensaje en sesión
    _save_to_session(session_id, user_message, response)
    
    return {"response": response, "context": {...}}
```

### Frontend — ChatView refactor

**State:**
```jsx
const [activeSessionId, setActiveSessionId] = useState(null)
const [sessions, setSessions] = useState([])
const [showSessionPanel, setShowSessionPanel] = useState(false)
const [chatSmart, setChatSmart] = useState(false)
const [cerebroMode, setCerebroMode] = useState(false)
const [internetMode, setInternetMode] = useState(false)
const [investigationMode, setInvestigationMode] = useState(false)
const [selectedMessages, setSelectedMessages] = useState([])
```

**Barra de botones:**
```
[Añadir archivos] [Chat inteligente*] [Cerebro*] [Búsqueda Internet*] ... [Investigar]
                                                          (* condicional)
```

- Chat inteligente: toggle ON/OFF, gris/azul
- Cerebro: toggle ON/OFF, gris/verde. Al ON → desactiva Chat inteligente visualmente
- Búsqueda Internet: solo visible si Cerebro ON. Toggle ON/OFF
- Investigar: activa modo selección con checkboxes

**Modo investigación:**
- Cada mensaje muestra checkbox
- Botón cambia a "Investigar (N)" 
- Al ejecutar: `POST /api/chat/investigate` con `{messages: [...], session_id}`

**Popup "Añadir":**
- Campo nombre (auto si vacío)
- Campo descripción
- Radio: "Proyecto existente" (select) / "Crear proyecto" (nombre + desc + color)
- Botón "Añadir al cerebro" → `POST /api/vault/save-output` con `{content, project_id, name, description}`

### Markdown renderer mejorado

Parser inline + bloques:
- `# ## ###` → h2/h3/h4
- ``` ``` → code block con fondo oscuro + mono font
- `**bold**` → bold
- `` `code` `` → inline code
- `[[wikilink]]` → enlace azul
- `- ` / `* ` → listas
- Tablas markdown → tablas HTML

Sin dependencias externas — parser manual en React. ~80 líneas. Si se quiere highlighting real, instalar `react-markdown` + `remark-gfm` (dependencia npm).

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `backend/app/main.py` | Refactor `/api/chat`, nuevos endpoints sesiones, SearXNG helper, PROFILE_DEFS |
| `frontend/src/components/views/ChatView.jsx` | Refactor completo: sesiones, toggles, investigación, markdown renderer |
| `frontend/src/App.jsx` | State sesiones, pasar props nuevas a ChatView |
| `sistema-agente/profiles/` | Eliminar 5 viejos, crear 4 nuevos |
| `sistema-agente/scripts/install_profiles.sh` | 4 perfiles nuevos |
| `sistema-agente/scripts/generate_config.py` | Keys de perfiles actualizadas |
| `docker-compose.yml` | Servicio SearXNG |
| `searxng/settings.yml` | Config SearXNG con JSON API |
| `frontend/src/components/views/ModelosView.jsx` | 4 perfiles (ya usa PROFILE_DEFS dinámico) |
| `frontend/src/styles/app.css` | Estilos nuevos: session panel, checkboxes, respuesta dividida |

## Orden de implementación

1. **SearXNG** — docker-compose + config + verify API
2. **Perfiles** — eliminar viejos, crear 4 nuevos, install_profiles.sh, generate_config.py, PROFILE_DEFS
3. **Sesiones** — backend endpoints + carpeta vault/chat-sesiones/
4. **Backend chat refactor** — `/api/chat` con modos + perfiles + memoria + SearXNG
5. **Frontend** — ChatView refactor (sesiones, toggles, investigación, markdown)
6. **Verificación** — build, tests funcionales, end-to-end
