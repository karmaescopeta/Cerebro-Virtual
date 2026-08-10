## ADDED Requirements

### Requirement: 4 perfiles de chat
El sistema SHALL tener 4 perfiles de subagente Hermes: `chat-default`, `chat-smart`, `cerebro`, `investigador`. Cada perfil tiene una key interna fija y un display name editable (cosmético).

#### Scenario: Perfil chat-default
- **WHEN** el usuario envía un mensaje sin Cerebro ni Chat inteligente activados
- **THEN** el backend invoca `hermes chat -q -p chat-default` con modelo `openrouter/auto` (o el que el usuario configure en tab MODELOS)

#### Scenario: Perfil chat-smart
- **WHEN** el usuario activa "Chat inteligente" sin Cerebro activado
- **THEN** el backend invoca `hermes chat -q -p chat-smart` con el modelo paid configurado

#### Scenario: Perfil cerebro
- **WHEN** el usuario activa "Cerebro"
- **THEN** el backend invoca `hermes chat -q -p cerebro` con RAG grafo-primero. El perfil cerebro tiene instrucciones de buscar solo en el contexto del vault.

#### Scenario: Perfil investigador
- **WHEN** el usuario clicka "Investigar" con mensajes seleccionados
- **THEN** el backend invoca `hermes chat -q -p investigador` con los mensajes seleccionados como contexto

### Requirement: Eliminación de perfiles viejos
El sistema SHALL eliminar los 5 perfiles anteriores: `hermes-coordinador`, `hermes-editor`, `hermes-indexador`, `hermes-sintetizador`, `hermes-investigador-resumidor`.

#### Scenario: Perfiles viejos eliminados
- **WHEN** se despliegan los nuevos perfiles
- **THEN** las carpetas viejas se borran de `sistema-agente/profiles/` y los nuevos perfiles se instalan

### Requirement: Display names editables
El sistema SHALL permitir al usuario editar el display name de cada perfil desde el tab MODELOS. La key interna permanece fija.

#### Scenario: Editar display name
- **WHEN** el usuario edita el nombre visible de un perfil en tab MODELOS
- **THEN** se guarda en `agent-config.json[profileNames]` y se muestra en la UI. La key interna no cambia.

### Requirement: PROFILE_DEFS reescrito
El backend SHALL tener `PROFILE_DEFS` con los 4 perfiles nuevos.

#### Scenario: Defaults de perfiles
- **WHEN** no hay modelos en `agent-config.json`
- **THEN** `PROFILE_DEFS` devuelve: `chat-default` → `openrouter/auto`, `chat-smart` → `deepseek/deepseek-v4-flash`, `cerebro` → `deepseek/deepseek-v4-flash`, `investigador` → `deepseek/deepseek-v4-flash-latest`

### Requirement: install_profiles.sh reescrito
El script `install_profiles.sh` SHALL instalar los 4 perfiles nuevos y sobreescribir `model:` en cada `config.yaml` desde `agent-config.json[models]`.

#### Scenario: Instalar perfiles
- **WHEN** el entrypoint ejecuta `install_profiles.sh`
- **THEN** copia los 4 perfiles a `hermes-home/profiles/` y sobreescribe `model:` con los valores de `agent-config.json`
