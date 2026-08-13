## ADDED Requirements

### Requirement: Pantalla de selección de modelos por perfil
El wizard SHALL mostrar una pantalla entre Step 1 (config) y Step 2 (confirm) con 5 campos de texto, uno por perfil, para que el usuario introduzca la URL del modelo OpenRouter de cada perfil.

#### Scenario: Pantalla muestra 5 perfiles con campos
- **WHEN** el usuario avanza desde Step 1
- **THEN** se muestran 5 campos: "Sistema Base" (Coordinador), "Editor", "Indexador", "Sintetizador", "Investigador"
- **AND** cada campo tiene un label con el nombre del perfil y un input para la URL del modelo

#### Scenario: Botón "Modelos por defecto" rellena campos
- **WHEN** el usuario pulsa "Modelos por defecto"
- **THEN** los 5 campos se rellenan con los defaults: deepseek/deepseek-v4-flash (4 perfiles) + deepseek/deepseek-v4-flash-latest (Investigador)
- **AND** el usuario puede editar cualquier campo después

#### Scenario: Botón SIGUIENTE deshabilitado hasta que todos los campos tienen contenido
- **WHEN** uno o más campos están vacíos
- **THEN** el botón SIGUIENTE está gris y no responde
- **WHEN** los 5 campos tienen contenido
- **THEN** el botón SIGUIENTE se ilumina y permite avanzar

#### Scenario: Step indicator muestra 4 pasos
- **WHEN** el wizard renderiza la pantalla de modelos
- **THEN** StepIndicator muestra 4 pasos: CONFIGURAR (done), MODELOS (active), CONFIRMAR (pending), FINALIZAR (pending)

### Requirement: Backend persiste modelos en agent-config.json
El endpoint `/api/init/configure` SHALL aceptar un `models` dict y guardarlo en `agent-config.json`.

#### Scenario: Models guardados en agent-config.json
- **WHEN** el wizard envía POST /api/init/configure con `models: {coordinador: "...", editor: "...", ...}`
- **THEN** agent-config.json incluye el campo `models` con los 5 valores

### Requirement: generate_config.py usa modelo del coordinador del JSON
`generate_config.py` SHALL leer `models.coordinador` de agent-config.json y usarlo en config.yaml.

#### Scenario: Coordinador usa modelo del JSON
- **WHEN** agent-config.json tiene `models.coordinador = "deepseek/deepseek-v4-flash"`
- **THEN** config.yaml generado tiene `model.default = "deepseek/deepseek-v4-flash"`

### Requirement: install_profiles.sh sobreescribe modelos por perfil
`install_profiles.sh` SHALL leer `models` de agent-config.json y sobreescribir `model:` en cada perfil tras copiar.

#### Scenario: Perfiles reciben modelo correcto
- **WHEN** agent-config.json tiene `models: {coordinador: "A", editor: "B", indexador: "C", sintetizador: "D", investigador: "E"}`
- **THEN** cada config.yaml de perfil tiene `model:` con su valor correspondiente