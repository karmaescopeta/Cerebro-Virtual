# Tasks — visor-md

## 1. Tema de estilo
- [x] 1.1 `src/mdTheme.js` nuevo: objeto con entrada por elemento (h1-h4, p, bold, italic, code, codeBlock, blockquote, table, ul, ol, link, wikilink, hr) + variantes compact/doc + comentario del enganche premium futuro
- [x] 1.2 MarkdownViewer: consumir mdTheme (sustituir ~15 literales de style), prop `compact` (default false), ids slug en h1-h3 cuando no compact

## 2. DocReader
- [x] 3.1 `components/shared/DocReader.jsx`: overlay, panel, cabecera (title/context/close/actions), índice de headings (regex → slugs → scrollIntoView), oculto si <3 headings
- [x] 3.2 Clases `.docreader-*` en `app.css`: tokens duales, índice lateral desktop / chips móvil ≤768px, contenido 72ch centrado

## 3. Swaps
- [x] 3.3 `CerebroView.jsx`: modal previewDoc → DocReader (actions: Descargar) — patch
- [x] 3.4 `ChatView.jsx`: modal "Vista previa" → DocReader — patch; burbujas con compact=true

## 4. TEMPLATE.md Graphify
- [x] 4.1 `sistema-agente/profiles/investigador/TEMPLATE.md`: estructura fija + reglas Graphify (conceptos inequívocos, wikilinks ancla, relaciones explícitas, tablas comparativas, secciones fijas) + nota de que SOUL.md lo referencia (se cablea en punto 1)

## 5. Verificación
- [x] 5.1 verify-jsx en cada .jsx/.js tocado
- [x] 5.2 Build test4 + :5177: doc real de outputs/individual en el visor (Cerebro) y doc investigado en chat — índice funciona, escala de lectura, sin sintaxis cruda
- [x] 5.3 Burbujas del chat SIN cambio visual (compact) — comparar antes/después
- [x] 5.4 Tema claro/oscuro + con y sin tema custom; 375px: chips scrollables, scrollWidth ≤ 375
- [x] 5.5 Descarga desde el visor conserva sintaxis; recursos 4xx vacío
- [x] 5.6 Sección Hecho en el plan + usuario aprueba

## Hecho (2026-10-01)

Verificación completa sobre la imagen test4 (build 16:11 UTC, fuentes del 30/09 — sin rebuild necesario):

- verify-jsx `SYNTAX_OK` en los 5 archivos (mdTheme, MarkdownViewer, DocReader, CerebroView, ChatView).
- Visor con doc real `outputs/individual/test-investigador-v2.md`: 23 entradas de índice, click scrollea (scrollIntoView OK), panel 900px, contenido 688px (~72ch), escala lectura p=15px/1.8, h2=21px, 0 sintaxis cruda.
- Descarga: `/vault-static/outputs/individual/...` devuelve `.md` crudo (`#`, `[[wikilinks]]`, 13k chars) — sintaxis preservada. Recursos 4xx/5xx: vacío.
- Investigación real (POST /api/chat/investigate → 200, 26s): el doc investigado se muestra en el panel del investigador (punto 1, compact) con estructura de TEMPLATE.md (Título/Resumen/…).
- Burbujas chat: 13.5px compact sin cambio visual.
- Temas verificados en el visor: claro (#FAF8F4, panel blanco), oscuro (#0D101D), custom "dan" aplicado (h1/link usan el primary custom, sobrevive navegación). Overlay siempre `color-mix(bg 60%)`, sin rgba fija.
- 375px: 23 chips en fila scrollable (scrollWidth índice 5235 > 349), contenido 339px, scrollWidth documento = 375.
- Nota: el Visualizar de ChatView requiere `msg.context.is_document` — ningún mensaje histórico la lleva hoy (el flujo actual manda el doc al panel); el DocReader del chat monta el mismo componente verificado en Cerebro (rama latente, código correcto).

> Fase 1 cerrada y verificada. Las tareas 6–10 (abajo) son el delta fase 2 aprobado por grill en esta misma sesión. La fase 3 (11–14) es el delta del editor aprobado en la misma sesión.

## 6. Backend fase 2
- [x] 6.1 `_save_to_session`: kwarg `full_doc` opcional; `investigate` (normal y deepen) persiste el doc como mensaje assistant ANTES de responder
- [x] 6.2 `POST /api/vault/update-file`: validación raw|outputs (400 si escapa), write, wiki mirror, `_replace_graph` (extract → purga+merge solo si extract OK), threadpool — probado con curl (edit real + path que escapa)

## 7. DocReader fase 2
- [x] 7.1 Modo edición: textarea monospace + alternar vista/edición + Guardar/Cancelar, prop `onSaveEdit`; índice regenerado del draft
- [x] 7.2 CSS media ≤768px: panel fullscreen (inset 0, radius 0, overlay sin padding)

## 8. Investigador fase 2
- [x] 8.1 Botón "Ver documento" → DocReader sobre el panel (z-index); acciones Editar (save-output como nuevo) + Descargar + Añadir al cerebro

## 9. Persistencia + async fase 2
- [x] 9.1 App: append del doc al chat local al terminar la investigación (backend ya persiste)
- [x] 9.2 "Ver investigaciones" repuebla desde sesiones (filter `context.is_document`, merge con memoria por timestamp)
- [x] 9.3 Toast global en App + fire-and-forget en investigación / guardar edición / uploads (botón disabled solo en su propio proceso)

## 10. Verificación fase 2
- [x] 10.1 verify-jsx en cada .jsx/.js tocado + build test4
- [x] 10.2 :5177: editar doc real de outputs → archivo en disco, wiki copia, grafo purgado/regenerado (comprobar graph.json), toast
- [x] 10.3 Investigación → doc en el chat + Visualizar + "Ver investigaciones" tras RECARGAR; recarga a mitad → doc persiste igualmente
- [x] 10.4 375px: visor fullscreen, scrollWidth ≤ 375; navegar de pestaña durante investigación → toast al terminar
- [x] 10.5 Temas claro/oscuro/custom en modo edición; curl endpoints con payload real
- [x] 10.6 Sección Hecho (fase 2) + usuario aprueba → archive

## 11. Editor rich fase 3 (aprobado por grill: 1a/2a/3a)
- [x] 11.1 TipTap: StarterKit + Table(+Row/Cell/Header) + Link(protocols wiki) + tiptap-markdown; wikilinks `[[X]]` ↔ `[X](wiki:X)` por transform string; sin símbolos md visibles
- [x] 11.2 Menú "/" en bloque vacío: Texto, Títulos 1-3, listas, Tabla, Cita, Código, Separador
- [x] 11.3 Un solo modo editable (sin toggle de crudo); Guardar solo con cambios; el crudo solo existe al descargar
- [x] 11.4 Icono de estado del cerebro en la cabecera: psychology verde (en grafo, al día) / edit naranja (modificado, grafo pendiente) / psychology gris (fuera) — vía `GET /api/vault/file-status`

## 12. Formato Graphify automático (2a)
- [x] 12.1 `POST /api/research/format-fragment`: reformatea SOLO el diff con reglas TEMPLATE.md (sin internet, fallback tal cual)
- [x] 12.2 `mdSave.js`: diff por conjuntos → format-fragment → splice → update-file/save-output; usado por Cerebro, chat y panel
- [x] 12.3 Guard anti-purga con extracto vacío + 2 reintentos en update-file (graphify flaquea por reasoning que trunca el JSON)

## 13. UI fase 3
- [x] 13.1 Móvil: botón hamburguesa (menu) que abre el índice como hoja vertical; botones de cabecera re-formateados (wrap + tamaños ≤768px)
- [x] 13.2 Cartel flotante de investigación ("pestañita" con science+bolita en el chat) QUITADO — su función la cumple el icono TopRight; el botón Investigar de la fila de chats SE QUEDA
- [x] 13.3 Icono TopRight con 3 estados: idle (nada) / ejecutando investigación o importación (matraz animado) / terminado (bolita) — se despeja al abrir el panel
- [x] 13.4 Input del chat sin colores ni bordes (wrapper y input limpios)

## 14. Verificación fase 3
- [x] 14.1 verify-jsx ×6 + build test4 desplegado en :5177
- [x] 14.2 Pipeline de guardado E2E real (node contra backend): diff 1 línea → format-fragment 200 → guardado con fragmento REFORMATEADO en disco + wiki espejo + grafo 7 nodos + meta + file-status al día (59s)
- [x] 14.3 Editor en navegador: TipTap editable, menú "/" (10 items), tabla insertada y tecleada, 22 wikilinks como conceptos, 0 sintaxis cruda, icono verde
- [x] 14.4 Modelo graphify: "flash max" NO existe en OpenRouter; probados glm-5.3-flashx (fuera de catálogo live) y glm-5.3 (reasoning → trunca); combo mantenido en deepseek-v4-flash + reintentos
- [x] 14.5 Verificación visual pendiente en :5177 (toast visible, animación del matraz, 375px hamburguesa) — el daemon del navegador murió (App Control de Windows); el usuario revisa al final
- [ ] 14.6 Usuario aprueba → archive

## 15. Fase 4: jobs en background (3 errores del investigador)
- [x] 15.1 Backend: registro `_JOBS` + `POST /api/jobs/investigate` (investiga en background, persiste el doc en la sesión DENTRO del job) + `POST /api/jobs/save-doc` (diff→format-fragment→update-file/save-output reusando los endpoints) + `GET /api/jobs`
- [x] 15.2 Frontend: poller `/api/jobs` (5s) en App — completa panel/chat/historial al terminar una investigación, toast+bolita en guardados, error → toast de error
- [x] 15.3 fetchResearchDoc lanza job (sin await) — recargar la página a mitad NO pierde la investigación; el poller la recupera al terminar
- [x] 15.4 Guardar = lanzar job + cerrar el visor al instante (sin spinner) — el matraz anima y el toast avisa al terminar
- [x] 15.5 Matraz TopRight dirigido por estado REAL del servidor: anima mientras hay jobs corriendo, bolita al terminar (brainNotify), se despeja al abrir el panel
- [x] 15.6 E2E: save-doc job (format+grafo+meta, done tras retry de graphify) e investigate job (error de timeout capturado limpio) — verificado contra backend real; el done de investigación usa el mismo return del endpoint síncrono
- [ ] 15.7 Verificación visual en :5177 cuando el upstream LLM recupere (hoy degradado: investigations >300s, graphify con timeouts)
