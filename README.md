# Cerebro Virtual

Sistema personal de conocimiento. Vault estructurado (raw → wiki → outputs), 5 subagentes via Hermes Kanban, UI web (React + FastAPI + Docker).

## Arranque

```bash
# Windows
start.bat

# Manual
docker compose up -d --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Hermes: http://localhost:8080

## Arquitectura

```
cerebro-network (Docker bridge)
├── cerebro-backend   :8000  (FastAPI)
├── cerebro-frontend  :5173  (Nginx → React)
├── cerebro-agente    :8080  (Hermes Agent, 5 perfiles)
└── cerebro-herramientas (on-demand: Whisper/OCR/PDF)
```

## Vault

```
vault/
├── raw/            # Input inmutable
├── wiki/           # Conocimiento procesado (Markdown + [[wikilinks]])
├── outputs/        # Informes generados
└── system/         # Config + identity + manifest
```

## IA

Cloud-only (OpenRouter). IA local pausada — ver `descripcion del proyecto/ia-local-referencia.md`.

## Chat

Frontend → POST `/api/chat` → `docker exec cerebro-agente hermes chat -q` → Coordinador evalúa y delega a subagentes via Kanban.

## Pipeline raw → wiki

POST `/api/vault/process` → `docker run cerebro-herramientas process_raw.sh` → `docker exec cerebro-agente hermes chat -q` → guarda `wiki/<stem>.md`.
