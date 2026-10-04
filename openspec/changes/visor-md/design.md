# Design — visor-md

## Contexto del consejo + grill
- Consejo: solo lectura (NO edición in-place), índice clicable barato gracias a la plantilla fija, NO rehash del parser (funciona — lo que falta es escala de lectura y externalizar estilo). Hopkins satisfecho: el "defecto" real era tipografía de chat en un documento.
- Grill: (1) el parser ya traduce — verificado en código: headings, bold, italic, code, tablas, listas, wikilinks sin corchetes, blockquotes, hr. (2) El objetivo Graphify = estructura de contenido que dé nodos/edges limpios (Pass 3 = subagente LLM que lee el .md). (3) Un lector, dos entradas (Cerebro + chat).

## Decisiones

### Separación parser / tema
- **`src/mdTheme.js`**: objeto `mdTheme` con una entrada por elemento. Export default. Comentarios en el archivo: aquí enganchará la personalización premium de Ajustes (punto futuro). Ninguna otra cosa importa este archivo salvo MarkdownViewer.
- **MarkdownViewer**: se sustituyen los literales `style={{...}}` por `mdTheme.x`. Refactor mecánico de ~15 estilos. Nueva prop `compact` (default false): en compact se usan las entradas compactas (escala chat actual); en documento, las de lectura. El parser NO cambia (mismas reglas de detección).
- **Anchors**: h1/h2/h3 reciben `id` = slug del texto (solo si no compact). Slug: lowercase, sin acentos, espacios→'-'. Colisión tolerada (ponytail: primer match gana, scroll se detiene en el primero).

### DocReader
- Componente `components/shared/DocReader.jsx`. Props: `{title, context, content, onClose, actions}` (actions = array de botones, slot para Cerebro/chat/punto 1).
- Layout: overlay `color-mix(in srgb, var(--color-bg) 60%, transparent)` (NO rgba fija). Panel `var(--color-surface)`, radius-lg, borde surface-high. Desktop: max-width 900px con dos columnas — índice lateral 200px sticky + contenido `maxWidth: 72ch` centrado. Móvil ≤768px: columna única, índice = fila de chips scrollables bajo la cabecera.
- Índice: extraído con regex de los headings del content. Click → `scrollIntoView` del `id` dentro del contenedor scrollable del visor. Oculto si <3 headings.
- Cabecera: título del archivo (Material `description`), contexto secundario, close. Zona de acciones en la cabecera (slot).
- Clases `.docreader-*` en `app.css` con tokens duales; responsive por media query (nada crítico en style inline).

### TEMPLATE.md (reglas Graphify — fundamentadas en el repo safishamsi/graphify)
Pass 3: subagentes LLM leen lotes de .md y devuelven JSON de nodes/edges/groups. Para que la extracción sea limpia:
1. Concepto = entidad nombrable. Nombre inequívoco y repetido IDÉNTICO cuando se vuelve a mencionar.
2. `[[wikilink]]` SOLO a conceptos que existen en el doc (anclas de nodo — el extractor las usa como candidatas de label).
3. Relaciones en frases explícitas verbo-relación ("X depende de Y", "X se configura con Z") — nunca insinuadas.
4. Una idea por párrafo; tablas solo comparaciones (el extractor las lee como filas de pares).
5. Secciones fijas en orden: Título / Resumen / Desarrollo (## y ###) / Conclusiones / Fuentes.
6. Sin decoración que no aporte nodos (hr solo separadores mayores, sin emojis como datos).

### Swaps
- `CerebroView.jsx`: modal previewDoc → `<DocReader title={f.name} context={proyecto} actions=[Descargar]>`. PATCH (el modal entero se reemplaza por el componente).
- `ChatView.jsx`: modal Vista previa → mismo DocReader con el doc del mensaje (botón Visualizar). PATCH.

## Riesgos
- Burbujas de chat cambian de look sin querer → prop compact=true en burbujas + verificación visual del chat antes/después.
- Slug colisiona en docs con headings repetidos → aceptado (primer match).
- Índice en móvil desplaza el contenido → chips compactos de una fila con overflow-x.

## Decisiones fase 2 (delta aprobado por grill)

### Edición en caliente
- **Endpoint `POST /api/vault/update-file`** {path, content}: valida que `path` resuelva dentro de `VAULT_PATH/raw` o `VAULT_PATH/outputs` (resolve + startswith → 400 si escapa). Escribe el archivo. Si el archivo está en outputs/ y existe copia en wiki/, la actualiza. Grafo: `_replace_graph(partial, source_file)` — purga nodos/edges con ese `source_file` y mergea los nuevos (reusa `_run_graphify` + la lógica de merge de `_merge_graph`; `_merge_graph` NO se toca, siguen usándola save-output y el background). Todo vía `run_in_threadpool` (graphify es subprocess). Responde `{status, path, graph_updated}`.
- **DocReader modo edición**: prop `onSaveEdit(content)` (async, el caller decide endpoint) + prop `editHint` (texto del botón guardar). Estado interno: `editing`, `draft`, `mode` (view|edit). Alternar vista/edición con toggle. Guardar → `onSaveEdit(draft)`; el caller hace fetch + toast + refresca su estado; DocReader vuelve a vista con el contenido nuevo cuando la promesa resuelve. Cancelar → descarta draft. El índice se regenera del draft en vista previa de edición.
- **Caller endpoints**: CerebroView (raw/outputs) → `update-file` con `cat/path`; ResearchPanel (doc sin guardar) → `save-output` con nombre slug del título; ChatView doc guardado (msg con path) → `update-file`, doc sin guardar → `save-output`.
- Raw se puede editar igual (el re-grafo funciona por source_file; raw no crea wiki).

### Fullscreen móvil
- `app.css` media ≤768px: `.docreader-panel { inset: 0; width: 100%; height: 100%; max-width: none; border-radius: 0 }`, overlay sin padding. Chips ya son scrollables (verificado).

### Ver documento en el investigador
- ResearchPanel result: botón "Ver documento" → prop `onPreviewDoc()` que App ya pasa → abre DocReader (z-index de `.docreader-overlay` por encima de `.research-panel`). Acciones: Editar (guarda como nuevo vía save-output), Descargar, Añadir al cerebro. La vista compacta inline se queda.

### Persistencia de investigaciones
- `_save_to_session(session_id, role, content, context, full_doc="")` — kwarg opcional; cuando no vacío, el mensaje lleva `full_doc`.
- `investigate` (normal y deepen): llama `_save_to_session(session_id, "assistant", summary, ctx, full_doc=full_doc)` ANTES del return → si el cliente recarga a mitad, el doc queda igualmente.
- Frontend: App appendea el mensaje localmente al resolver (sin recarga se ve al momento); al recargar, loadMessages ya mapea los campos de la sesión.
- "Ver investigaciones": al abrir, fetch `/api/chat/sessions` → por sesión `/api/chat/sessions/{id}` → filtra `context.is_document` → merge con la memoria de la sesión actual (dedup por timestamp). Cero endpoints nuevos.

### Procesos no bloqueantes + toast
- Toast global en App: estado `{type, text}` + div fijo esquina inferior (patrón flash de Ajustes, 3.5s), pasado como prop `toast` a ResearchPanel/CerebroView/ChatView.
- Fire-and-forget: investigación, guardar edición y uploads lanzan el fetch sin bloquear navegación; `.then` → toast + refresco de datos; botón deshabilitado solo mientras SU proceso corre. Si la pestaña se recarga a mitad: el doc/edit ya persiste por el backend (update-file guarda el archivo antes de regrafiar) y el toast se pierde — aceptado.

## Riesgos fase 2
- Graphify falla tras editar → NO se purga el grafo (grafo viejo > grafo vacío): orden extract → si ok, purga+merge; si falla, el grafo queda como está y `graph_updated: false` avisa en el toast. El archivo editado es la fuente de verdad y queda en disco.
- doc sin guardar editado en el visor del investigador → guarda como NUEVO archivo (slug del título), el draft sigue en memoria para "Añadir al cerebro".
