# Diseño: Arquitectura de Cerebro Virtual

## Stack Técnico
- Docker Compose: 5 servicios (backend, frontend, agente, ollama, herramientas)
- Backend: FastAPI 0.111, Python 3.11, httpx, docker SDK
- Frontend: React 18, Vite 5, Nginx Alpine
- Agente: Hermes Agent (Nous Research), 5 perfiles
- IA Local: Ollama (llama3.2:3b, qwen2.5, llama3.1)
- IA Nube: OpenRouter (openai/gpt-4o-mini)

## Red de Contenedores
```
cerebro-network (Docker bridge)
├── cerebro-backend   :8000  (FastAPI)
├── cerebro-frontend  :5173  (Nginx → build de Vite)
├── cerebro-agente    :8080  (Hermes)
├── cerebro-ollama    :11434 (solo interno, sin puerto en host)
└── cerebro-herramientas (bajo demanda, sin puerto)
```

## Estructura del Vault
```
vault/
├── raw/            # Entrada inmutable (uploads, archivos ingeridos)
│   └── .processed/ # Registra qué archivos ya fueron sintetizados
├── wiki/           # Conocimiento procesado (Markdown + [[wikilinks]])
│   └── index.md    # Índice global
├── outputs/        # Informes generados, resúmenes, mapas mentales
└── system/         # Config, identity, index.json, manifest.json
```

## Modos de Modelo
| Modo | model (config.yaml) | local_llm | Caso de uso |
|------|---------------------|-----------|-------------|
| openrouter | provider=openrouter, api_key=sk-or-... | — | Solo nube |
| local | provider=custom, base_url=cerebro-ollama:11434/v1, api_key=ollama | — | Offline |
| mixed | provider=openrouter, api_key=sk-or-... | provider=custom, ... | Nube + local |

## Flujo del Chat
```
Frontend → POST /api/chat (backend) → OpenRouter API → respuesta
                                 ↳ búsqueda en vault (wiki/ + raw/) para contexto
```
No va directo a Hermes (:8080) — el backend actúa como proxy.

## Flujo Kanban
```
Mensaje del usuario → Coordinador evalúa → delegate_task si hace falta
  ├── Archivo subido → kanban create → Sintetizador
  ├── Pregunta de investigación → kanban create → Investigador
  ├── Petición de edición → kanban create → Editor
  └── Consulta de metadatos → kanban create → Indexador
Pregunta simple → Coordinador responde directo (sin tarea)
```
