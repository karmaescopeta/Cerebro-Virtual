# Tareas: Cerebro Virtual

## Fase 1 — Cimientos (COMPLETADO)
- [x] Reestructurar vault (raw/wiki/outputs, eliminar notes/projects/assets)
- [x] docker-compose.yml con 5 servicios
- [x] Backend FastAPI con endpoints health, vault, init
- [x] Wizard del frontend (3 pasos: tipo modelo, config, confirmar)
- [x] Dockerfile del agente Hermes + entrypoint.sh
- [x] 5 perfiles de subagentes (coordinador, editor, investigador, indexador, sintetizador)
- [x] install_profiles.sh + install_models.sh

## Fase 2 — UI/UX (COMPLETADO)
- [x] Dashboard: info del sistema, estado de contenedores, stats del vault
- [x] Chat: drag-and-drop + subida de archivos a raw/chat/
- [x] Ajustes: toggle IA, API keys, export/import vault, full-restart, zona peligrosa
- [x] Eliminar tab "Notas"
- [x] Arreglar start.bat (setlocal enabledelayedexpansion, sin chcp)

## Fase 3 — Modo Mixto e IA Local (COMPLETADO)
- [x] Wizard: 3 opciones (OpenRouter, Local, Mixto)
- [x] Modo mixto: mostrar formulario de API key + hardware juntos
- [x] Pantalla de carga bloqueante (overlay fullscreen, log en tiempo real)
- [x] generate_config.py: provider custom + /v1 + api_key dummy para Ollama
- [x] entrypoint.sh: wait de Ollama no bloqueante para mixed, bloqueante para local
- [x] docker-compose: Ollama sin puertos expuestos (evitar conflicto con Ollama nativo)
- [x] llama3.2:3b instalado y verificado en contenedor

## Fase 4 — Chat e Integración (EN PROGRESO)
- [x] Backend /api/chat proxy a OpenRouter con contexto del vault
- [x] Frontend chat usa /api/chat (no Hermes directo)
- [x] Kanban init en entrypoint
- [x] SOUL.md del Coordinador con instrucciones de delegación Kanban
- [ ] Verificar que el chat funciona en navegador (frontend → backend → OpenRouter)
- [ ] Verificar que el mensaje de subida de archivos al Coordinador es correcto

## Fase 5 — Herramientas y Procesamiento (PENDIENTE)
- [ ] Contenedor de herramientas (Whisper, FFmpeg, Tesseract, PyPDF2)
- [ ] Sintetizador procesa raw/ → páginas en wiki/
- [ ] Pipeline process_raw.sh (detectar tipo → transcribir/OCR/extraer)
- [ ] Cron jobs para procesamiento periódico de raw/

## Fase 6 — Pulido (PENDIENTE)
- [ ] Test completo de start.bat (limpiar → construir → iniciar → verificar)
- [ ] Manejo de casos límite (Ollama caído, API key inválida, etc.)
- [ ] Feedback en UI (estados de carga, mensajes de error)
- [ ] Actualizar documentación
