# Design: Wizard Model Selection

## Approach

Nuevo componente `WizardStepModels.jsx` entre Step 1 y Step 2. StepIndicator ampliado a 4 pasos. Backend guarda `models` dict en agent-config.json. `generate_config.py` + `install_profiles.sh` leen y aplican.

## Mapping de perfiles

| Display name (UI) | Clave JSON | Perfil real |
|---|---|---|
| Sistema Base | `coordinador` | hermes-coordinador |
| Editor | `editor` | hermes-editor |
| Indexador | `indexador` | hermes-indexador |
| Sintetizador | `sintetizador` | hermes-sintetizador |
| Investigador | `investigador` | hermes-investigador-resumidor |

## Defaults

```js
const DEFAULT_MODELS = {
  coordinador: 'deepseek/deepseek-v4-flash',
  editor: 'deepseek/deepseek-v4-flash',
  indexador: 'deepseek/deepseek-v4-flash',
  sintetizador: 'deepseek/deepseek-v4-flash',
  investigador: 'deepseek/deepseek-v4-flash-latest',
}
```

## UI

- Progress bar: 50% (Step 1=25%, Step Models=50%, Step Confirm=75%, Step Done=100%).
- StepIndicator: 4 items: CONFIGURAR, MODELOS, CONFIRMAR, FINALIZAR.
- Card: mismo estilo que WizardStep1 (`.wizard-card`, `.wizard-title`, `.wizard-subtitle`).
- 5 form-groups, cada uno: label (nombre perfil) + input (URL modelo). Mismo `.form-group` / `.form-label` / `.form-input` que Step 1.
- Hint box explicando formato URL: `deepseek/deepseek-v4-flash`.
- Botones inferiores: "Modelos por defecto" (btn-secondary, izquierda) + "SIGUIENTE" (btn-primary, derecha). SIGUIENTE deshabilitado si algún campo vacío.

## Flujo SetupWizard.jsx

```
step 0 = Welcome
step 1 = WizardStep1 (config)
step 2 = WizardStepModels (NUEVO)
step 3 = WizardStep2 (confirm) — renombrado lógicamente
step 4 = WizardStep3 (done) — renombrado lógicamente
```

formData añade `models: { ...DEFAULT_MODELS }`.

## Backend `/api/init/configure`

Añade `models = request.get("models", {})` al dict guardado. Si vacío, no se guarda (defaults de los perfiles se aplican).

## generate_config.py

Lee `models = config.get("models", {})`. Si `models.get("coordinador")`, usa ese modelo en `llm_config["default"]` y `legacy_llm_config["model"]`. Si no, fallback al default hardcodeado.

## install_profiles.sh

Tras copiar cada perfil, lee el modelo correspondiente del JSON via `python -c` (una sola llamada que devuelve los 5 valores) y sobreescribe `model:` en cada `config.yaml` con `sed`.

## Verification

1. `npm run build` del frontend — 0 errores.
2. `python -c "import py_compile; py_compile.compile('backend/app/main.py'); py_compile.compile('sistema-agente/scripts/generate_config.py')"` — OK.
3. Script ad-hoc verifica: StepIndicator 4 pasos, WizardStepModels existe, SetupWizard routing 5 steps, backend acepta models, generate_config lee models, install_profiles sobreescribe.