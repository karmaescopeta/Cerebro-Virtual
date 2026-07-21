# Tasks: Cerebro Virtual

## Phase 1 — Foundation (DONE)
- [x] Vault restructure (raw/wiki/outputs, eliminate notes/projects/assets)
- [x] docker-compose.yml with 5 services
- [x] Backend FastAPI with health, vault, init endpoints
- [x] Frontend wizard (3 steps: model type, config, confirm)
- [x] Hermes agent Dockerfile + entrypoint.sh
- [x] 5 subagent profiles (coordinador, editor, investigador, indexador, sintetizador)
- [x] install_profiles.sh + install_models.sh

## Phase 2 — UI/UX (DONE)
- [x] Dashboard: system info, container status, vault stats
- [x] Chat: drag-and-drop + file upload to raw/chat/
- [x] Settings: IA toggle, API keys, vault export/import, full-restart, zone
- [x] Eliminate "Notas" tab
- [x] start.bat fix (setlocal enabledelayedexpansion, no chcp)

## Phase 3 — Mixed Mode & Local IA (DONE)
- [x] Wizard: 3 options (OpenRouter, Local, Mixed)
- [x] Mixed mode: show both API key + hardware form
- [x] Blocking install screen (fullscreen overlay, log in real-time)
- [x] generate_config.py: custom provider + /v1 + dummy api_key for Ollama
- [x] entrypoint.sh: non-blocking Ollama wait for mixed, blocking for local
- [x] docker-compose: Ollama no exposed ports
- [x] llama3.2:3b installed and verified in container

## Phase 4 — Chat & Integration (IN PROGRESS)
- [x] Backend /api/chat proxy to OpenRouter with vault context
- [x] Frontend chat uses /api/chat (not Hermes direct)
- [x] Kanban init in entrypoint
- [x] Coordinador SOUL.md with Kanban delegation instructions
- [ ] Verify chat works in browser (frontend → backend → OpenRouter)
- [ ] Verify file upload message to Coordinador is correct

## Phase 5 — Tools & Processing (PENDING)
- [ ] Herramientas container (Whisper, FFmpeg, Tesseract, PyPDF2)
- [ ] Sintetizador processes raw/ → wiki/ pages
- [ ] process_raw.sh pipeline (detect type → transcribe/OCR/extract)
- [ ] Cron jobs for periodic raw/ processing

## Phase 6 — Polish (PENDING)
- [ ] start.bat full test (clean → build → start → verify)
- [ ] Error handling edge cases (Ollama down, API key invalid, etc.)
- [ ] UI feedback (loading states, error messages)
- [ ] Documentation update
