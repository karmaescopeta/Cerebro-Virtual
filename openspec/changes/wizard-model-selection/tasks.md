# Tasks: Wizard Model Selection

## Task 1: Crear WizardStepModels.jsx
- [ ] Crear `frontend/src/components/wizard/WizardStepModels.jsx` con 5 campos, botón defaults, botón SIGUIENTE deshabilitado si campos vacíos.

## Task 2: Actualizar StepIndicator.jsx a 4 pasos
- [ ] Añadir paso 2 = MODELOS. Renumerar CONFIRMAR=3, FINALIZAR=4.

## Task 3: Actualizar SetupWizard.jsx
- [ ] Añadir import WizardStepModels. Añadir `models` a formData. Routing: step 2 = WizardStepModels. Step 2→3, 3→4.

## Task 4: Añadir CSS para botón deshabilitado
- [ ] `wizard.css`: `.btn-disabled` o reusar `.btn-primary:disabled`.

## Task 5: Backend `/api/init/configure` acepta models
- [ ] `main.py`: `models = request.get("models", {})` → guardar en config dict.

## Task 6: generate_config.py lee models.coordinador
- [ ] `generate_config.py`: leer `models` del JSON, usar `models.coordinador` si existe.

## Task 7: install_profiles.sh sobreescribe modelos
- [ ] `install_profiles.sh`: tras copiar perfiles, leer models del JSON y sobreescribir `model:` en cada config.yaml.

## Task 8: Verificación
- [ ] `npm run build` — 0 errores.
- [ ] Script ad-hoc: 34+ checks.
- [ ] `openspec validate wizard-model-selection --json`.