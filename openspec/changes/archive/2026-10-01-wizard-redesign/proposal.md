# Proposal: wizard-redesign

## Why

El wizard es la primera experiencia del producto: 5 pasos con tono técnico-SciFi ("Inicialización del Sistema"), iconos Material Symbols **Outlined** (la web usa **Rounded** — fuente duplicada), versión hardcodeada desactualizada (`v1.0.4-stable` vs VERSION real) y el paso de personalidad — el momento de identidad del agente — enterrado en un formulario genérico.

## What Changes

- **Copy completo en voz humana** — todos los títulos, subtítulos, labels y hints del wizard reescritos en español natural (Handley: "¿dirías esto en voz alta a un cliente?"). "START" → "Empezar". Detalles técnicos SOLO donde hay riesgo (API key con hint de dónde obtenerla).
- **Tarjeta de preview del agente** (paso de personalidad) — vista en vivo: "Hola, soy {nombre}" con su avatar y su directiva resumida. El momento de identidad deja de ser un input suelto.
- **Avatar del agente en la instalación** — el usuario puede subir la imagen del agente durante el wizard (toque premium). Reutiliza el endpoint `POST /api/agent/avatar` existente (data-URL, límite ~300KB) y el patrón de picker de AjustesView.
- **Reskin al estilo web** — label-caps, CardHeader, tokens duales; iconos Outlined → **Rounded** (elimina la carga de fuente duplicada). El look Obsidian Deep (glow welcome, dark) se conserva.
- **Log de instalación pulido** — señal de progreso legible durante la creación (ya existe installLog; se viste, no se re-arquitecta).
- **Fix versión real** — WelcomeScreen lee de `/api/version` (existe) en vez del string hardcodeado.
- Veredicto del consejo aplicado: NO se reordenan pasos ni se mueven canales post-instalación (sin datos de abandono); métrica de abandono por paso SKIPPED (no hay endpoint; añadir si se sospecha abandono).

## Capabilities

### New Capabilities
- `setup-wizard`: Primera experiencia de configuración — copy, reskin, preview de identidad del agente, avatar en instalación.

### Modified Capabilities
<!-- ninguna: los endpoints no cambian; el avatar usa /api/agent/avatar existente (se llama tras configure) -->

## Impact

- `frontend-test4/src/components/wizard/*` — patch (SetupWizard.jsx, WelcomeScreen.jsx, WizardStep1-3, WizardStepModels, StepIndicator, wizard.css). Ficheros pequeños (18-579 líneas).
- Iconos: solo la lista verificada de cv-redesign (Rounded).
- Endpoints: ninguno nuevo. `/api/init/configure` intacto + `POST /api/agent/avatar` llamado tras él.
- El wizard solo aparece sin configuración — verificación requiere reset de config de test o estado limpio.
