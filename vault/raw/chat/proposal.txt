# Proposal: Cerebro Virtual

## Intent

Personal knowledge system. Structured vault (raw → wiki → outputs). 5 AI subagents via Hermes Kanban. Web UI (React + FastAPI + Docker).

## Scope

- **Backend** (FastAPI :8000): Infra orchestrator — wizard config, Docker management, vault CRUD, chat proxy to OpenRouter/Ollama.
- **Frontend** (React+Vite+Nginx :5173): Dashboard, chat with drag-and-drop file upload, settings (IA toggle, API keys, vault export/import).
- **Sistema-Agent** (Hermes :8080): 5 profiles — Coordinador, Editor, Investigador-Resumidor, Indexador, Sintetizador. Kanban task board.
- **Ollama** (:11434 internal): Local LLM models via Docker, no exposed ports.
- **Herramientas** (on-demand): Whisper, FFmpeg, Tesseract, PyPDF2 for raw/ processing.
- **Vault**: `raw/` (immutable input), `wiki/` (processed knowledge with wikilinks), `outputs/` (generated reports).

## Approach

Three model modes: OpenRouter (cloud), Local (Ollama), Mixed (both). Wizard guides setup. Toggle in settings switches modes. Kanban delegates tasks to subagents.

## Phases

### Phase 1 — Foundation (DONE)
Vault restructure, Docker compose, backend endpoints, frontend wizard, Hermes agent, 5 subagent profiles.

### Phase 2 — UI/UX (DONE)
Dashboard with system info, chat with drag-and-drop, settings with IA toggle, export/import vault, full-restart, API key management.

### Phase 3 — Mixed Mode & Local IA (DONE)
Wizard supports mixed mode. Blocking install screen. generate_config.py uses custom provider for Ollama. Entrypoint: blocking Ollama wait for local, non-blocking for mixed.

### Phase 4 — Chat & Integration (IN PROGRESS)
Chat uses backend proxy /api/chat (not Hermes direct). Backend calls OpenRouter with vault context. Kanban initialized in entrypoint. Coordinador SOUL.md has delegation instructions.

### Phase 5 — Tools & Processing (PENDING)
Herramientas container (Whisper/FFmpeg/Tesseract/PDF). Sintetizador processes raw/ → wiki/. Cron jobs for periodic processing.

### Phase 6 — Polish (PENDING)
start.bat verification. Error handling edge cases. UI feedback. Documentation.
