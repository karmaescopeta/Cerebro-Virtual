# Tasks: Wizard Redesign

## 1. Design system
- [x] 1.1 Crear `frontend/src/styles/tokens.css` con variables Obsidian Deep (colores, fuentes, spacing, radios)
- [x] 1.2 Importar `tokens.css` en `main.jsx`

## 2. Componentes wizard
- [x] 2.1 Crear `frontend/src/components/wizard/StepIndicator.jsx` — indicador 3 pasos
- [x] 2.2 Crear `frontend/src/components/wizard/WelcomeScreen.jsx` — botón START, título, versión
- [x] 2.3 Crear `frontend/src/components/wizard/WizardStep1.jsx` — form config
- [x] 2.4 Crear `frontend/src/components/wizard/WizardStep2.jsx` — resumen + logs + botón crear
- [x] 2.5 Crear `frontend/src/components/wizard/WizardStep3.jsx` — finalización
- [x] 2.6 Crear `frontend/src/components/wizard/wizard.css` — estilos del wizard

## 3. Refactor SetupWizard
- [x] 3.1 Reescribir `SetupWizard.jsx` como thin orquestador (state + step routing)
- [x] 3.2 Eliminar `SetupWizard.css` (reemplazado por wizard.css + tokens.css)
- [x] 3.3 App.jsx sin cambios (import SetupWizard, prop onComplete)

## 4. Verificación
- [x] 4.1 `npm run build` pasa sin errores (✓ 39 modules, 811ms)
- [x] 4.2 4 pantallas verificadas visualmente en navegador (welcome, step1, step2, step3)
