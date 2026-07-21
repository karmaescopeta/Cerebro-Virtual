# Cerebro Virtual — Contexto del Proyecto

> Archivo de contexto para nuevas sesiones. Contiene arquitectura, archivos, endpoints, flujos y estado actual.

## Qué es

Sistema personal de conocimiento. Vault estructurado (raw → wiki → outputs). Subes archivos (PDF, imagen, audio, video, texto) → se procesan automáticamente a páginas wiki con `[[wikilinks]]`. Chat con RAG que busca en el vault antes de responder. Grafo visual de conocimiento. Multi-canal (Telegram/Discord/WhatsApp).

## Stack

- **Backend**: FastAPI (Python 3.11) — `backend/app/main.py` (~1100 líneas)
- **Frontend**: React 18 + Vite + Nginx — `frontend/src/App.jsx` (~1350 líneas) + `SetupWizard.jsx` (~420 líneas)
- **Agente**: Hermes Agent (Nous Research) en Docker — `sistema-agente/`
- **Herramientas**: Whisper + Tesseract + FFmpeg + PyPDF2 en Docker — `herramientas/`
- **Docker Compose**: 4 servicios (backend :8000, frontend :5173, agente :8080, herramientas on-demand)

## Arranque

```bash
start.bat  # Windows — docker compose --profile agent --profile tools up -d --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Hermes: http://localhost:8080

## Estructura del vault

```
vault/
├── raw/chat/         # Archivos subidos (input inmutable)
├── wiki/             # Páginas wiki generadas (Markdown + [[wikilinks]])
├── outputs/          # Informes (vacío por ahora)
└── system/           # Config: agent-config.json, agent-keys.json, manifest.json, etc.
```

## Endpoints backend

| Método | Path | Función |
|--------|------|---------|
| GET | `/api/health` | Estado del sistema |
| GET | `/api/vault/status` | Stats del vault (wiki_pages, raw_files, outputs) |
| GET | `/api/notes` | Lista páginas wiki |
| GET | `/api/notes/{id}` | Contenido de página wiki |
| GET | `/api/config/models` | Modelos disponibles |
| GET | `/api/agents/keys` | Estado de API keys |
| GET/POST/DELETE | `/api/agents/hermes/key` | Gestionar API key |
| POST | `/api/chat` | Chat con RAG (busca en wiki/ → Hermes via docker exec) |
| GET | `/api/init/status` | ¿Configurado? |
| GET | `/api/init/config` | Config actual |
| POST | `/api/init/configure` | Guardar config (wizard) |
| DELETE | `/api/init/reset` | Borrar config + detener agente |
| GET/PUT | `/api/agent/config` | Nombre + personalidad |
| POST | `/api/agent/restart` | Reiniciar agente |
| POST | `/api/agent/full-restart` | Rebuild desde cero |
| POST | `/api/agent/start` | Iniciar agente |
| GET | `/api/agent/status` | Página HTML de estado |
| GET | `/api/system/info` | Info del sistema |
| GET | `/api/wiki/graph` | Nodos + aristas del grafo de wikilinks |
| GET | `/api/vault/export` | Exportar vault como .tar.gz |
| POST | `/api/vault/import` | Importar vault desde .tar.gz |
| POST | `/api/vault/upload` | Subir archivo → auto-procesa a wiki |
| POST | `/api/vault/process` | Procesar archivo raw existente → wiki |
| POST | `/api/vault/process-folder` | Procesar carpeta completa → wiki enlazada |
| GET | `/api/vault/raw` | Listar archivos raw |
| GET | `/api/containers/status` | Estado de contenedores Docker |
| Static | `/vault-static/*` | Servir archivos del vault (imágenes para preview) |

## Flujo del chat

1. Frontend → `POST /api/chat { message }`
2. Backend `search_vault()` busca palabras clave en `wiki/` y `raw/*.txt` (acento-insensible)
3. Si hay resultados → inyecta contexto en el mensaje
4. `docker exec -e OPENROUTER_API_KEY=*** cerebro-agente hermes chat -q --continue "mensaje + contexto"`
5. Parsea respuesta (extrae texto entre separadores unicode de Hermes)
6. Devuelve `{ response, context: { vault_results, via: "hermes-coordinador" } }`

## Flujo de upload

1. Frontend drag-and-drop o botón 📎 → `POST /api/vault/upload?topic=chat`
2. Backend guarda archivo en `raw/chat/`
3. `docker run --rm cerebro-herramientas process_raw.sh <file>` → extrae texto
4. `docker exec cerebro-agente hermes chat -q "Sintetiza: <texto>"` → genera wiki Markdown
5. Guarda en `wiki/<stem>.md`
6. Devuelve `{ preview_type, wiki_path, file_size }` para preview WhatsApp-style

## 5 Subagentes Hermes

| Perfil | Rol |
|--------|-----|
| Coordinador | Orquestador, habla con el usuario, delega via Kanban |
| Editor | Corrige/amplía páginas wiki |
| Investigador-Resumidor | Resúmenes, esquemas, mapas mentales |
| Indexador | Metadatos, índice global |
| Sintetizador | Procesa raw/ → wiki/ |

## IA local (pausada)

Cloud-only (OpenRouter). IA local con Ollama está pausada. Referencia completa en `descripcion del proyecto/ia-local-referencia.md`.

## Archivos clave

| Archivo | Descripción |
|---------|-------------|
| `backend/app/main.py` | Todo el backend FastAPI (~1100 líneas) |
| `frontend/src/App.jsx` | App principal + WikiGraphView (~1350 líneas) |
| `frontend/src/SetupWizard.jsx` | Wizard de configuración (~420 líneas) |
| `frontend/src/styles.css` | Estilos globales (~326 líneas) |
| `frontend/nginx.conf` | Proxy: /api/ y /vault-static/ → backend |
| `sistema-agente/scripts/entrypoint.sh` | Arranque del agente Hermes |
| `sistema-agente/scripts/generate_config.py` | Genera config.yaml de Hermes |
| `sistema-agente/scripts/install_profiles.sh` | Instala 5 perfiles de subagentes |
| `herramientas/scripts/process_raw.sh` | Pipeline: detecta tipo → extrae texto |
| `docker-compose.yml` | 4 servicios + profiles |
| `start.bat` | Arranque Windows |
| `vault/system/agent-config.json` | Config del agente (nombre, apiKey, canales) |
| `vault/system/agent-keys.json` | API keys guardadas |

## Estado actual (verificado)

- ✅ Chat con RAG funcionando (vault_results > 0)
- ✅ Upload auto-procesa a wiki
- ✅ Preview WhatsApp-style en chat
- ✅ Grafo de conocimiento visual (SVG)
- ✅ Multi-canal en wizard (tokens Telegram/Discord/WhatsApp)
- ✅ start.bat construye los 4 servicios
- ✅ Sin dead code
- ✅ Sin IA local en código
