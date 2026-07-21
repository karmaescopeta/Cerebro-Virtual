# Propuesta: Cerebro Virtual — Descripción del Proyecto y Fases

## Intención

Cerebro Virtual es un sistema de gestión de conocimiento personal con un vault estructurado (raw → wiki → outputs), 5 subagentes de IA especializados orquestados via Kanban de Hermes, y una interfaz web (React + FastAPI + Docker).

## Alcance

- **Backend** (FastAPI :8000): Orquestador de infraestructura — config del wizard, gestión Docker, CRUD del vault, proxy de chat a OpenRouter/Ollama.
- **Frontend** (React+Vite+Nginx :5173): Dashboard, chat con drag-and-drop y subida de archivos, ajustes (toggle IA, API keys, export/import vault).
- **Sistema-Agente** (Hermes :8080): 5 perfiles — Coordinador, Editor, Investigador-Resumidor, Indexador, Sintetizador. Tablón de tareas Kanban.
- **Ollama** (:11434 interno): Modelos LLM locales (llama3.2:3b, qwen2.5, etc.) via Docker, sin puertos expuestos.
- **Herramientas** (bajo demanda): Whisper, FFmpeg, Tesseract, PyPDF2 para procesar archivos de raw/.
- **Vault**: `raw/` (entrada inmutable), `wiki/` (conocimiento procesado con wikilinks), `outputs/` (informes generados).

## Enfoque

Tres modos de modelo: OpenRouter (nube), Local (Ollama), Mixto (ambos). El wizard guía la configuración. El toggle en ajustes cambia de modo. Kanban delega tareas a los subagentes.

## Fases

### Fase 1 — Cimientos (COMPLETADO)
Reestructura del vault, Docker compose, endpoints del backend, wizard del frontend, contenedor del agente Hermes, 5 perfiles de subagentes.

### Fase 2 — UI/UX (COMPLETADO)
Dashboard con info del sistema, chat con drag-and-drop, ajustes con toggle de IA, export/import vault, full-restart, gestión de API keys.

### Fase 3 — Modo Mixto e IA Local (COMPLETADO)
Wizard soporta modo mixto (OpenRouter + Local). Pantalla de carga bloqueante. generate_config.py usa provider custom para Ollama. Entrypoint espera a Ollama (bloqueante en local, no bloqueante en mixto).

### Fase 4 — Chat e Integración (EN PROGRESO)
Chat usa proxy del backend `/api/chat` (no Hermes directo). Backend llama a OpenRouter con contexto del vault. Kanban inicializado en entrypoint. SOUL.md del Coordinador tiene instrucciones de delegación.

### Fase 5 — Herramientas y Procesamiento (PENDIENTE)
Contenedor de herramientas (Whisper, FFmpeg, Tesseract, PyPDF2). Sintetizador procesa archivos de raw/ → páginas en wiki/. Cron jobs para procesamiento periódico.

### Fase 6 — Pulido y Portabilidad (PENDIENTE)
Verificación de start.bat. Casos límite de manejo de errores. Mejoras de feedback en UI. Documentación.
