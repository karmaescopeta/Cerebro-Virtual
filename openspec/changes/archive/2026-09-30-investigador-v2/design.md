# Design — investigador-v2

## Contexto del consejo (condicionantes de diseño)
Veredicto completo en `design-plans/investigador-v2.md`. Condiciones aplicadas:
- "Crear investigación" visible desde el segundo cero (escape siempre presente) — Godin/Hormozi.
- Techo visible de 3 tandas — Sutherland (sin interrogatorio infinito).
- Niveles = 3 plantillas de prompt (coste marginal cero, se hacen los tres) — Hormozi cede.
- Fix internet PRIMERO — es la causa probable de la mala calidad actual (Hopkins).
- Métrica de éxito: % investigaciones guardadas con save-output (ya existe; revisar en sesión de limpieza).

## Decisiones

### Backend
- **Un endpoint nuevo**, `POST /api/chat/investigate/questions`. La generación de preguntas usa `_ask_hermes("investigador", ...)` con prompt que exige JSON estricto: `{"questions":[{"q":"...","options":["a","b","c","d"]},...]}`. Parseo tolerante: extraer primer bloque `{...}` del output con regex; si falla → HTTPException con mensaje claro.
- **`investigate` mantiene su contrato** (messages → response/full_doc) y añade campos OPCIONALES: `level`, `answers`, `topic`, `deepen {doc, subtema}`. Cuando `deepen` viene, el prompt pide "## Sección nueva: <subtema>" y el backend la concatena al doc ANTES de las Fuentes existentes (split por `## Fuentes`).
- **Internet**: en ambas rutas, `search_internet(topic)` + `_format_search_results()` ya existen — 3 líneas, cero código nuevo.
- **main.py solo con `patch`** (regla del proyecto).

### SOUL.md (rewrite completo, fichero de 50 líneas)
Estructura: identidad (qué es el investigador) → plantilla .md fija → normas anti-IA (~10, destiladas del humanizer de blader: sin "no es X sino Y", sin muletillas, frases cortas, concreción, una persona) → reglas por nivel → reglas JSON para el modo cuestionario.
El modo cuestionario y el modo doc usan el MISMO perfil (investigador) — el prompt decide el modo. Un perfil, dos formatos de salida.

### Frontend
- **`ResearchPanel.jsx`** en `components/shared/` (no views/ — lo usa ChatView pero vive como shared por simetría con MarkdownViewer/AddFilesPopup).
- Estado del panel vive en `App.jsx` (como previewDoc del chat hoy): `researchPanel {open, topic, messages, round, questions, answers, level, result, loading}` + handlers `fetchResearchQuestions` / `fetchResearchDoc` que sustituyen a `handleInvestigate`.
- **ChatView** cambia 2 líneas: onInvestigate ya no llama fetch — abre el panel.
- **CSS**: clases `.research-*` en `app.css` junto a las `.chat-*`. Animación de entrada transform+opacity 0.2s. Overlay `color-mix(in srgb, var(--color-bg) 60%, transparent)`. Panel `var(--color-surface)`, borde izquierdo surface-high, width 420px desktop / 100vw ≤768px.
- **Opciones clicable**: botones de selección única (radio-like sin input nativo, patrón de los TabButton existentes). Deseleccionar = click de nuevo. Input libre "Otra cosa…" bajo las 4 opciones; si tiene texto, manda ese valor en vez de la opción marcada.
- **Iconos**: solo de la lista verificada (close, search, send, progress_activity, download, visibility, psychology, arrow_forward).

## Riesgos
- Modelo devuelve JSON roto → parseo tolerante + botón reintentar en el panel.
- Doc muy largo en `deepen` → el doc va en la petición; si supera ~50KB se envía solo Resumen+Conclusiones+Fuentes y el subtema (el modelo no necesita todo el desarrollo para añadir una sección).
- Doble tema custom (webTheme.js) → verificar panel con y sin tema activo.
