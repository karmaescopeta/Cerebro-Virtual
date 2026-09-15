# Proposal: Wizard Redesign (Stitch → React)

## Why

El wizard actual (2 pasos, CSS ad-hoc, sin pantalla de bienvenida) no coincide con los diseños finales de Google Stitch. El usuario quiere implementar las 4 pantallas de Stitch (bienvenida + 3 pasos) con design system "Obsidian Deep" centralizado en CSS variables para poder cambiar paleta/fuentes en un solo archivo.

## Scope

### Incluido
- `tokens.css` — variables CSS de Obsidian Deep (colores, fuentes, spacing, radios)
- 4 componentes wizard: `WelcomeScreen`, `WizardStep1`, `WizardStep2`, `WizardStep3`
- `StepIndicator` — indicador de 3 pasos compartido
- Refactor de `SetupWizard.jsx` a orquestador thin
- Migración de toda la lógica existente (state, fetch, validación, canales)
- Pantalla de bienvenida nueva (botón START, título, versión)
- Pantalla de finalización nueva (check verde, "¡Todo listo!", botón ir al dashboard)

### No incluido
- `App.jsx` (sigue usando `SetupWizard` con `onComplete`)
- Backend
- Otras tabs (Dashboard, Chat, Grafo, Ajustes)
- Tailwind (CSS plano con variables)

## Approach

- Sin Tailwind. CSS plano con variables (`var(--color-primary)` etc).
- `tokens.css` = único punto de cambio de paleta. Cambias colores ahí → toda la web se actualiza.
- Componentes UI base: `Button`, `Input` — reutilizables, sin abstracción prematura.
- `SetupWizard.jsx` = thin orquestador. State vive ahí. Componentes son presentacionales + callbacks.
- Fiel a diseño Stitch: colores Obsidian Deep, fuentes (Inter + JetBrains Mono), layout de cada pantalla.
- Lógica existente (handleCreate, validación, canales) se migra sin cambios funcionales.

## Rollback

Revertir `frontend/src/` a estado anterior. No hay cambios en backend ni Docker.
