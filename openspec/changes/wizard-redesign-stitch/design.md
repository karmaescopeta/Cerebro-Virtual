# Design: Wizard Redesign

## Arquitectura de archivos

```
frontend/src/
├── styles/
│   └── tokens.css              ← Obsidian Deep: colores, fuentes, spacing, radios
├── components/
│   └── wizard/
│       ├── WelcomeScreen.jsx   ← pantalla de bienvenida (nueva)
│       ├── WizardStep1.jsx      ← configuración (API key, nombre, personalidad, credenciales, canales)
│       ├── WizardStep2.jsx      ← resumen + logs + botón crear
│       ├── WizardStep3.jsx      ← finalización (nueva)
│       ├── StepIndicator.jsx    ← indicador de 3 pasos
│       └── wizard.css           ← estilos del wizard
├── SetupWizard.jsx             ← thin orquestador (state + render por step)
└── ...
```

## tokens.css — Design System

CSS variables agrupadas por categoría. Un archivo, un punto de cambio.

```css
:root {
  /* === Obsidian Deep — Colors === */
  --color-bg: #0e0e0e;
  --color-surface: #1c1b1b;
  --color-surface-container: #201f1f;
  --color-surface-high: #2a2a2a;
  --color-surface-highest: #353534;
  --color-border: #424754;
  --color-border-variant: #8c909f;

  --color-text-primary: #e5e2e1;
  --color-text-secondary: #c2c6d6;
  --color-text-tertiary: #8c909f;

  --color-primary: #adc6ff;
  --color-primary-container: #4d8eff;
  --color-on-primary: #002e6a;

  --color-success: #4edea3;
  --color-error: #ffb4ab;
  --color-error-container: #93000a;

  /* === Fonts === */
  --font-display: 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* === Spacing === */
  --space-base: 8px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
}
```

## Flujo del wizard

```
step 0 (Welcome) → click START → step 1
step 1 (Config)  → click Siguiente → step 2
step 2 (Confirm) → click Crear → handleCreate() → step 3
step 3 (Done)    → click Ir al Dashboard → onComplete()
```

State vive en `SetupWizard.jsx`. Componentes son presentacionales + callbacks.

## Mapeo Stitch → React

| Stitch HTML | React Component | Notas |
|---|---|---|
| welcome.html | `WelcomeScreen` | Botón circular START, título 80px, versión footer |
| wizard-step1.html | `WizardStep1` | Form: API key, nombre, personalidad, credenciales, canales |
| wizard-step2.html | `WizardStep2` | Resumen + logs terminal + botón crear |
| wizard-step3.html | `WizardStep3` | Check verde, "¡Todo listo!", info del agente, botón dashboard |

## Lógica preservada

- `formData` state (agentName, personality, apiKey, channels, dashboardUser, dashboardPassword, telegramToken, discordToken, whatsappPhone)
- `validateStep2()` → valida API key, nombre, personalidad, password
- `handleCreate()` → POST /api/init/configure → POST /api/agent/start → logs → step 3
- `handleBack()` → step 2 ← step 1
- `onComplete()` callback al App.jsx

## Decisiones

- **Sin Tailwind**: CSS plano con variables. Menos deps, mismo resultado visual.
- **Sin componentes UI base separados**: Button/Input son lo suficientemente simples para inline en wizard.css. Si más pantallas los necesitan, se extraen. YAGNI.
- **StepIndicator como componente**: se reutiliza en 3 pasos. Justifica su existencia.
- **wizard.css único**: todos los estilos del wizard en un archivo. Evita fragmentación prematura.
