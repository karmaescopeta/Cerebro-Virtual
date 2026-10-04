# Proposal: investigador-v2

## Why

El botón "Investigar" produce documentos pobres: el endpoint `/api/chat/investigate` nunca busca en internet (el SOUL del perfil investigador promete lo que el código no da) y genera el doc directo sin entender qué quiere el usuario. Se sustituye el flujo de una llamada por un cuestionario conversacional que afina el tema antes de investigar.

## What Changes

- Fix: `investigate` busca en internet (SearXNG, helpers existentes) antes de generar.
- Endpoint NUEVO `POST /api/chat/investigate/questions`: genera 5 preguntas × 4 opciones clicables (estilo grill); con `answers` previas, analiza y afina la siguiente tanda (máx 3 tandas).
- `investigate` ampliado: `level` (principiante/intermedio/experto = plantilla de audiencia), `answers` (directrices del cuestionario), `deepen {doc, subtema}` (añade sección nueva al mismo doc, no doc aparte).
- `SOUL.md` del perfil investigador reescrito: plantilla .md fija (Título/Resumen/Desarrollo/Conclusiones/Fuentes + wikilinks) + ~10 normas anti-IA destiladas del skill humanizer + reglas por nivel.
- Frontend test4: `ResearchPanel.jsx` NUEVO — panel deslizante derecho con cuestionario clicable, input libre "Otra cosa…", 3 chips de nivel, "Crear investigación" siempre visible, "Más preguntas" con techo 3 tandas, resultado con MarkdownViewer + Profundizar. El botón Investigar del chat abre este panel en vez de disparar el doc.
- Veredicto del consejo (condicionantes): escape visible desde el segundo cero, techo de tandas visible, métrica de éxito = % de investigaciones guardadas vía save-output (ya existe, nada que construir).

## Capabilities

### New Capabilities
- `research-panel`: Panel lateral de investigación con cuestionario (backend de preguntas + frontend del panel + flujo completo).
- `research-writing-standards`: Normas de escritura del investigador (SOUL.md, plantilla .md fija, niveles, anti-IA).

### Modified Capabilities
<!-- ninguna a nivel spec: el endpoint investigate mantiene su contrato; solo añade campos opcionales -->

## Impact

- `backend/app/main.py` — solo `patch` (3600+ líneas, write_file lo destruye). Un endpoint nuevo + ampliar `investigate`.
- `sistema-agente/profiles/investigador/SOUL.md` — rewrite completo (write_file, fichero pequeño).
- `frontend-test4/src/components/shared/ResearchPanel.jsx` — nuevo.
- `frontend-test4/src/components/views/ChatView.jsx`, `src/App.jsx`, `src/app.css` — patch.
- Endpoints existentes intactos. Verificación: verify-jsx + build test4 + :5177 + checklist responsive/tema.
