# Tasks: Swap Default Models to DeepSeek V4

## Task 1: Parchear 5 config.yaml de perfiles

**Files:**
- `sistema-agente/profiles/hermes-coordinador/config.yaml`
- `sistema-agente/profiles/hermes-editor/config.yaml`
- `sistema-agente/profiles/hermes-indexador/config.yaml`
- `sistema-agente/profiles/hermes-sintetizador/config.yaml`
- `sistema-agente/profiles/hermes-investigador-resumidor/config.yaml`

- [x] Coordinador: `model: openai/gpt-4o-mini` → `model: deepseek/deepseek-v4-flash`
- [x] Editor: igual
- [x] Indexador: igual
- [x] Sintetizador: igual
- [x] Investigador: `model: anthropic/claude-3.5-sonnet` → `model: deepseek/deepseek-v4-flash-latest`

## Task 2: Parchear generate_config.py

**File:** `sistema-agente/scripts/generate_config.py`

- [x] Línea 83: `"default": "openai/gpt-4o-mini"` → `"default": "deepseek/deepseek-v4-flash"`
- [x] Línea 89: `"model": "openai/gpt-4o-mini"` → `"model": "deepseek/deepseek-v4-flash"`

## Task 3: Parchear entrypoint.sh del agente

**File:** `sistema-agente/scripts/entrypoint.sh`

- [x] Línea 115: `model: openai/gpt-4o-mini` → `model: deepseek/deepseek-v4-flash`

## Task 4: Parchear entrypoint.sh del backend

**File:** `backend/scripts/entrypoint.sh`

- [x] Línea 42: `"defaultModel": "openai/gpt-4o-mini"` → `"defaultModel": "deepseek/deepseek-v4-flash"`
- [x] Línea 44: `"openai/gpt-4o-mini",` → `"deepseek/deepseek-v4-flash",`
- [x] Línea 46: `"anthropic/claude-3.5-sonnet",` → `"deepseek/deepseek-v4-flash-latest",`

## Task 5: Parchear main.py (4 sitios)

**File:** `backend/app/main.py`

- [x] Línea 314: fallback defaultModel → `deepseek/deepseek-v4-flash`
- [x] Línea 316: primer modelo availableModels → `deepseek/deepseek-v4-flash`
- [x] Línea 318: segundo modelo availableModels → `deepseek/deepseek-v4-flash-latest`
- [x] Línea 870: context.model del chat → `deepseek/deepseek-v4-flash`
- [x] Línea 931: context.model del investigate → `deepseek/deepseek-v4-flash-latest`

## Task 6: Parchear agent-config.yaml y models.json

**Files:**
- `sistema-agente/config/agent-config.yaml` — línea 17
- `vault/system/models.json` — líneas 2, 4, 6

- [x] agent-config.yaml: `model: openai/gpt-4o-mini` → `model: deepseek/deepseek-v4-flash`
- [x] models.json: defaultModel + availableModels actualizados

## Task 7: Actualizar doc project-description

**File:** `openspec/changes/project-description/design.md`

- [x] Línea 9: `openai/gpt-4o-mini` → `deepseek/deepseek-v4-flash`

## Task 8: Validación

- [ ] `grep -r "gpt-4o-mini\|claude-3.5-sonnet" sistema-agente/ backend/ vault/system/models.json` → 0 matches
- [ ] `grep -r "deepseek-v4-flash" sistema-agente/ backend/ vault/system/models.json` → matches esperados
- [ ] `openspec validate swap-default-models --json`
