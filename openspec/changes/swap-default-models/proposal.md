## Why

Los modelos actuales (`openai/gpt-4o-mini` para 4 perfiles, `anthropic/claude-3.5-sonnet` para el investigador) son más caros y menos eficientes que DeepSeek V4. `deepseek/deepseek-v4-flash` ofrece mejor relación calidad-precio para los perfiles generales, y `deepseek/deepseek-v4-flash-latest` (versión más reciente/privada) para el investigador que necesita mayor capacidad de razonamiento.

## What Changes

- **BREAKING**: Modelo por defecto cambia de `openai/gpt-4o-mini` → `deepseek/deepseek-v4-flash` en 4 perfiles (Coordinador, Editor, Indexador, Sintetizador) + config del agente + models.json + fallbacks del backend.
- **BREAKING**: Modelo del investigador cambia de `anthropic/claude-3.5-sonnet` → `deepseek/deepseek-v4-flash-latest`.
- Lista de modelos disponibles en `models.json` y endpoint `/api/config/models` actualizada.
- Context metadata del chat (`POST /api/chat` y `POST /api/chat/investigate`) refleja los nuevos modelos.

## Capabilities

### New Capabilities
- `model-config`: Configuración centralizada de modelos LLM por perfil y sistema.

### Modified Capabilities

## Impact

- **5 perfiles Hermes**: `sistema-agente/profiles/hermes-*/config.yaml` — línea `model:` cambiada.
- **generate_config.py**: `llm_config["default"]` y `legacy_llm_config["model"]` cambiados.
- **entrypoint.sh (agente)**: config YAML fallback línea 115.
- **entrypoint.sh (backend)**: `models.json` generado con nuevos modelos.
- **main.py**: 4 sitios — fallback de `/api/config/models` (líneas 314-319), context del chat (línea 870), context del investigate (línea 931).
- **agent-config.yaml**: modelo del agente (generado, se regenera tras full-restart).
- **vault/system/models.json**: se regenera en arranque del backend.
- **Design system doc** (`openspec/changes/project-description/design.md` línea 9): referencia documental — actualizar.
- **Docker**: requiere `full-restart` del agente para que `generate_config.py` regenere `config.yaml` con el nuevo modelo. El backend requiere restart para que `entrypoint.sh` regenere `models.json`.
- **Dependencia**: OpenRouter debe soportar ambos modelos DeepSeek V4 (verificar disponibilidad).
