## MODIFIED Requirements

### Requirement: PROFILE_DEFS con 4 perfiles nuevos
El backend SHALL tener `PROFILE_DEFS` con 4 perfiles: `chat-default`, `chat-smart`, `cerebro`, `investigador`. Reemplaza los 5 perfiles anteriores.

#### Scenario: GET /api/profiles/models
- **WHEN** se llama a `GET /api/profiles/models`
- **THEN** devuelve `{profiles: [{key: "chat-default", name: "Chat Default", model: "openrouter/auto"}, {key: "chat-smart", ...}, {key: "cerebro", ...}, {key: "investigador", ...}]}`

#### Scenario: PUT /api/profiles/models
- **WHEN** se llama a `PUT /api/profiles/models` con nuevos modelos
- **THEN** guarda en `agent-config.json[models]` + `docker restart cerebro-agente`

### Requirement: Tab MODELOS con 4 perfiles
El frontend SHALL mostrar 4 tarjetas en tab MODELOS en vez de 5.

#### Scenario: Mostrar perfiles nuevos
- **WHEN** el usuario abre tab MODELOS
- **THEN** se muestran 4 tarjetas: Chat Default, Chat Inteligente, Cerebro, Investigador

### Requirement: Defaults de modelos
Los modelos por defecto SHALL ser: `chat-default` → `openrouter/auto`, `chat-smart` → `deepseek/deepseek-v4-flash`, `cerebro` → `deepseek/deepseek-v4-flash`, `investigador` → `deepseek/deepseek-v4-flash-latest`.

#### Scenario: Sin modelos en config
- **WHEN** no hay `models` en `agent-config.json`
- **THEN** `PROFILE_DEFS` devuelve los defaults anteriores
