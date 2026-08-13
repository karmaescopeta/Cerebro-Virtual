## ADDED Requirements

### Requirement: Modelos DeepSeek V4 por defecto
El sistema SHALL configurar `deepseek/deepseek-v4-flash` como modelo por defecto para todos los perfiles de subagentes excepto el investigador. El perfil investigador-resumidor SHALL usar `deepseek/deepseek-v4-flash-latest`.

#### Scenario: Perfiles generales usan deepseek-v4-flash
- **WHEN** el agente se configura via `generate_config.py` o los perfiles se instalan
- **THEN** Coordinador, Editor, Indexador y Sintetizador tienen `model: deepseek/deepseek-v4-flash` en su `config.yaml`

#### Scenario: Investigador usa deepseek-v4-flash-latest
- **WHEN** el perfil investigador-resumidor se instala
- **THEN** su `config.yaml` tiene `model: deepseek/deepseek-v4-flash-latest`

#### Scenario: models.json refleja los nuevos modelos
- **WHEN** el backend arranca y genera `vault/system/models.json`
- **THEN** `defaultModel` es `deepseek/deepseek-v4-flash` y `availableModels` incluye ambos modelos DeepSeek

#### Scenario: Endpoint /api/config/models actualizado
- **WHEN** el cliente llama `GET /api/config/models` y no existe `models.json`
- **THEN** el fallback devuelve `defaultModel: deepseek/deepseek-v4-flash` con ambos modelos en `availableModels`

#### Scenario: Context metadata del chat refleja modelo real
- **WHEN** el backend responde a `POST /api/chat`
- **THEN** `context.model` es `deepseek/deepseek-v4-flash`
- **WHEN** el backend responde a `POST /api/chat/investigate`
- **THEN** `context.model` es `deepseek/deepseek-v4-flash-latest`
