## Why

El wizard no permite al usuario elegir modelos por perfil. Los 5 perfiles usan defaults hardcodeados. El usuario quiere asignar modelos OpenRouter concretos a cada perfil desde la UI de instalación.

## What Changes

- Nueva pantalla del wizard entre Step 1 y Step 2: selección de modelos por perfil.
- 5 campos (uno por perfil) con label del nombre del perfil + input para URL del modelo OpenRouter.
- Botón "Modelos por defecto" rellena los 5 campos con los defaults DeepSeek actuales (editable).
- Botón "SIGUIENTE" confirma y avanza. Empieza deshabilitado (gris). Se activa cuando los 5 campos tienen contenido.
- `StepIndicator` pasa de 3 a 4 pasos: CONFIGURAR → MODELOS → CONFIRMAR → FINALIZAR.
- Backend `/api/init/configure` acepta `models` dict con 5 claves (coordinador, editor, indexador, sintetizador, investigador).
- `generate_config.py` usa `models.coordinador` del JSON para el config.yaml del coordinador.
- `install_profiles.sh` sobreescribe `model:` en cada perfil tras copiar, leyendo del JSON.
- Progress bar: 25% → 50% → 75% → 100%.

## Capabilities

### New Capabilities
- `wizard-model-selection`: Selección de modelos LLM por perfil en el wizard de instalación.

### Modified Capabilities

## Impact

- **Frontend**: nuevo `WizardStepModels.jsx`, `SetupWizard.jsx` (routing), `StepIndicator.jsx` (4 pasos), `wizard.css` (estilos).
- **Backend**: `main.py` `/api/init/configure` acepta `models` dict.
- **Agente**: `generate_config.py` lee modelo del coordinador del JSON, `install_profiles.sh` sobreescribe `model:` por perfil.
- **Docker**: requiere rebuild agente (scripts copied) + full-restart.