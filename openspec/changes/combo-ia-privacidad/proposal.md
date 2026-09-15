# Proposal: combo-ia-privacidad

## Why
El posicionamiento aprobado (comité 2026-09) vende "privado por defecto + coste cero", pero el chat no distingue local/cloud, el wizard obliga a elegir modelos que luego no se usan (claves legacy muertas), y el cerebro (RAG sobre documentos privados) puede ir por cloud sin avisar. OmniRoute ya soporta combos multi-modelo; hoy ningún perfil los usa.

## What Changes
- **Combos OmniRoute como unidad de ruteo**: cada perfil Hermes (chat-default, chat-smart, cerebro, investigador, graphify) apunta a un COMBO, no a un modelo fijo. 2 combos por perfil: cloud y local. Provision automático de 4 combos base al primer arranque.
- **Toggle Local/Cloud global** en la barra del chat: cambia el combo de TODOS los perfiles a la vez. Local → combos de Ollama; Cloud → combos de OmniRoute cloud. Sin endpoints nuevos: `models.{perfil}` pasa de `modelo` a `combo/{nombre}` (OmniRoute ya enruta `combo/<nombre>`).
- **Color del estado**: input del chat verde (local) / naranja (cloud) + badge por mensaje (🔒/☁️) = estado del toggle al enviar (via ctx existente).
- **Aviso informativo (no alarma) primera vez por cerebro** (guardado en vault/system, sobrevive export): usar cerebro en cloud = recomendación de modelo local potente (privacidad) + nota para empresas.
- **Wizard v3**: (1) sin paso de modelos legacy, (2) nuevo paso "Modo IA": solo-local / solo-cloud / ambas, (3) si local: instalador de modelos pegando comando Ollama (botón añadir, N modelos, pull SSE existente), recomendación de 1 modelo medio para cerebro/graphify, (4) instalación por defecto (combos precreados) o personalizada (combos creados vacíos, usuario asigna), (5) configuración OmniRoute en ventana aparte (dashboard /omniroute/) y volver al wizard para terminar.
- **Bugs corregidos de paso**: indentación de `/api/containers/status` (dashboard null), export de vault filtra credenciales (excluir apiKey/password/tokens de agent-config.json), placeholder de apiKey en wizard fuera del repo, Markdown renderizado en burbujas de chat (reutilizar MarkdownViewer).
- **Upload no bloqueante**: síntesis wiki en background thread (patrón Graphify existente); upload responde en ~2s, badge "procesando…" hasta que wiki está lista.

## Capabilities
### New
- combo-routing: perfiles → combos, toggle local/cloud, badge, aviso cerebro-cloud.
- wizard-modo-ia: paso modo IA + instalador de modelos locales + ventana OmniRoute externa.
### Modified
- vault-export: excluye credenciales de agent-config.json.
- chat-render: markdown en burbujas.
- upload-async: síntesis wiki en background.
- containers-status-fix: indentación.

## Impact
- `backend/app/main.py`: _ask_hermes (combo lookup), /api/init/configure (modo IA, combos), /api/profiles/models (lee combos), export filter, containers_status fix, upload async.
- `frontend`: SetupWizard (paso modo IA + modelos), ChatView (toggle, colores, badge, markdown), ModelosView (editor de combos), App.jsx (estado IA-mode).
- OmniRoute provision: +2 POST /api/combos por modo.
- Nuevo: vault/system/ia-mode.json (modo + aviso visto).

## Out of scope
- Detección automática de hardware (lista sugerida + pegado manual de comando Ollama).
- Endpoints nuevos de OmniRoute para saber qué conexión sirvió (badge = estado del toggle).
- Cloudflare Access (change existente, aparte).