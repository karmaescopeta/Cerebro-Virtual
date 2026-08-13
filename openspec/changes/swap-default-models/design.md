# Design: Swap Default Models to DeepSeek V4

## Approach

Replace directo de strings de modelo en 11 archivos. No hay abstracción nueva — el sistema ya funciona con strings de modelo OpenRouter en config.yaml y models.json. Solo se cambian los valores.

## Modelos

| Perfil / Sitio | Modelo anterior | Modelo nuevo |
|---|---|---|
| Coordinador | `openai/gpt-4o-mini` | `deepseek/deepseek-v4-flash` |
| Editor | `openai/gpt-4o-mini` | `deepseek/deepseek-v4-flash` |
| Indexador | `openai/gpt-4o-mini` | `deepseek/deepseek-v4-flash` |
| Sintetizador | `openai/gpt-4o-mini` | `deepseek/deepseek-v4-flash` |
| Investigador | `anthropic/claude-3.5-sonnet` | `deepseek/deepseek-v4-flash-latest` |
| generate_config.py default | `openai/gpt-4o-mini` | `deepseek/deepseek-v4-flash` |
| entrypoint.sh backend models.json | `openai/gpt-4o-mini` + `claude-3.5-sonnet` | `deepseek/deepseek-v4-flash` + `deepseek/deepseek-v4-flash-latest` |
| main.py fallback /api/config/models | igual que arriba | igual que arriba |
| main.py context.model chat | `openai/gpt-4o-mini` | `deepseek/deepseek-v4-flash` |
| main.py context.model investigate | `anthropic/claude-3.5-sonnet` | `deepseek/deepseek-v4-flash-latest` |

## Archivos afectados (11)

1. `sistema-agente/profiles/hermes-coordinador/config.yaml` — línea 1
2. `sistema-agente/profiles/hermes-editor/config.yaml` — línea 1
3. `sistema-agente/profiles/hermes-indexador/config.yaml` — línea 1
4. `sistema-agente/profiles/hermes-sintetizador/config.yaml` — línea 1
5. `sistema-agente/profiles/hermes-investigador-resumidor/config.yaml` — línea 1
6. `sistema-agente/scripts/generate_config.py` — líneas 83, 89
7. `sistema-agente/scripts/entrypoint.sh` — línea 115
8. `backend/scripts/entrypoint.sh` — líneas 42, 44, 46
9. `backend/app/main.py` — líneas 314, 316, 318, 870, 931
10. `sistema-agente/config/agent-config.yaml` — línea 17 (se regenera, pero parchear para consistencia)
11. `vault/system/models.json` — líneas 2, 4, 6 (se regenera, pero parchear para consistencia)

Archivo documental: `openspec/changes/project-description/design.md` línea 9.

## Decisions

- **No crear capa de abstracción de modelos**: YAGNI. Los strings viven en config.yaml y se cambian directamente. Una tabla de modelos añadiría indirection sin beneficio.
- **Parchear models.json y agent-config.yaml aunque se regeneran**: consistencia. Si alguien lee esos archivos entre restarts, ven los modelos correctos.
- **availableModels en models.json**: quitar `openai/gpt-4o` y `google/gemini-2.0-flash-exp` (ya no son los modelos por defecto). Meter los 2 DeepSeek. Si el usuario quiere más, los añade manualmente.

## Verification

1. `grep -r "gpt-4o-mini\|claude-3.5-sonnet" sistema-agente/ backend/ vault/system/models.json` → 0 matches (excluyendo openspec/)
2. `grep -r "deepseek-v4-flash" sistema-agente/ backend/ vault/system/models.json` → matches en todos los sitios esperados
3. Tras `full-restart` del agente: `docker exec cerebro-agente cat /app/hermes-home/config.yaml | grep model` → `deepseek/deepseek-v4-flash`
4. Tras restart del backend: `curl http://localhost:8000/api/config/models` → `defaultModel: deepseek/deepseek-v4-flash`
