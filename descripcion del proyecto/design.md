# Design: Cerebro Virtual Architecture

## Tech Stack
- Docker Compose: 5 services (backend, frontend, agente, ollama, herramientas)
- Backend: FastAPI 0.111, Python 3.11, httpx, docker SDK
- Frontend: React 18, Vite 5, Nginx Alpine
- Agent: Hermes Agent (Nous Research), 5 profiles
- Local IA: Ollama (llama3.2:3b, qwen2.5, llama3.1)
- Cloud IA: OpenRouter (openai/gpt-4o-mini)

## Container Network
```
cerebro-network (Docker bridge)
├── cerebro-backend   :8000  (FastAPI)
├── cerebro-frontend  :5173  (Nginx → Vite build)
├── cerebro-agente    :8080  (Hermes)
├── cerebro-ollama    :11434 (internal only, no host port)
└── cerebro-herramientas (on-demand, no port)
```

## Vault Structure
```
vault/
├── raw/            # Immutable input (uploads, ingested files)
│   └── .processed/ # Tracks which files have been synthesized
├── wiki/           # Processed knowledge (Markdown + [[wikilinks]])
│   └── index.md    # Global index
├── outputs/        # Generated reports, summaries, mind maps
└── system/         # Config, identity, index.json, manifest.json
```

## Model Modes
| Mode | model (config.yaml) | local_llm | Use case |
|------|---------------------|-----------|----------|
| openrouter | provider=openrouter, api_key=sk-or-... | — | Cloud only |
| local | provider=custom, base_url=cerebro-ollama:11434/v1, api_key=ollama | — | Offline |
| mixed | provider=openrouter, api_key=sk-or-... | provider=custom, ... | Cloud + local fallback |

## Chat Flow
```
Frontend → POST /api/chat (backend) → OpenRouter API → response
                                 ↳ vault search (wiki/ + raw/) for context
```
Not direct to Hermes (:8080) — backend acts as proxy.

## Kanban Flow
```
User message → Coordinador evaluates → delegate_task if needed
  ├── File uploaded → kanban create → Sintetizador
  ├── Research question → kanban create → Investigador
  ├── Edit request → kanban create → Editor
  └── Metadata query → kanban create → Indexador
Simple question → Coordinador answers directly (no task)
```
