# Tasks — investigador-v2

## 1. Backend
- [x] 1.1 Fix internet en `investigate`: `search_internet` + `_format_search_results` antes de generar (patch en main.py)
- [x] 1.2 Endpoint `POST /api/chat/investigate/questions` (patch en main.py): prompt JSON, parseo tolerante, round
- [x] 1.3 `investigate`: campos `level`/`answers`/`topic`/`deepen` (patch); deepen = sección nueva antes de `## Fuentes`
- [x] 1.4 Test manual curl: questions con y sin answers; investigate con level + deepen sobre doc real

## 2. SOUL.md investigador
- [x] 2.1 Rewrite `sistema-agente/profiles/investigador/SOUL.md`: plantilla fija + normas anti-IA + niveles + modo JSON
- [x] 2.2 Restart sistema-agente y verificar que el perfil carga (rebuild imagen — el perfil va horneado, no montado)

## 3. Frontend test4
- [x] 3.1 `ResearchPanel.jsx` nuevo: panel derecho, chips nivel, preguntas clicables, input libre, acciones fijas, resultado con MarkdownViewer + Profundizar
- [x] 3.2 `App.jsx`: estado del panel + fetchResearchQuestions/fetchResearchDoc (sustituyen handleInvestigate)
- [x] 3.3 `ChatView.jsx`: Investigar (botón + Enter) abre el panel
- [x] 3.4 `app.css`: clases `.research-*` con tokens duales + responsive ≤768px full-screen

## 10. Ronda 7 — pestañas tab + tema persistente + chat rápido (feedback usuario, APROBADO)
- [x] 10.1 Pestañas con look de tab: subrayado 2px activo + tinte 7% + transición (animación de selección); en móvil flex:1 (reparten todo el ancho, sin hueco antes de info) — verificado 133+133=266 en 375px, headR 375 ✓
- [x] 10.2 Tema persistente: el tema activo se restaura AL CARGAR la app (useEffect en App.jsx con localActivePal + /api/web/palettes; antes solo al entrar en Ajustes) — verificado: primario #DB2777-family se mantiene tras reload ✓
- [x] 10.3 Chat-default → modelo GRATIS más rápido disponible: probados 4 candidatos free; `inclusionai/ling-3.0-flash-sante:free` gana (2.1s, 857 chars reales; nemotron lightning 9s; qwen fuera de catálogo; gemma 429). Backup storage-pre-default-free. Chat endpoint: 11s total (antes 30-60s+) ✓
- [x] 10.4 Verificación ronda 7: tabs ✓, tema persiste ✓, chat rápido ✓, investigador GLM 28s ✓
- [x] 9.1 Modelo: combo `cerebro-investigador` → `openrouter/z-ai/glm-5.3-flash` (backup en db_backups/storage-pre-glm). Doc en **28s** (antes 2-28 min con deepseek), 4718 chars, Kidd Keo ×5, 0 Cuba/detenido, Fuentes ✓
- [x] 9.2 Timeout doc 240→300s (margen con GLM)
- [x] 9.3 Solape del icono de app sobre las pestañas: `.brand-mark` tenía z-index 96 > panel 91 → overlay 97 / panel 98. Verificado brandSolapa=false ✓
- [x] 9.4 Espacio de las pestañas: padding 5px 10px, gap 4, head gap space-2, white-space nowrap
- [x] 9.5 Móvil (≤768px): texto junto a los botones Generar/Crear (`.research-actions-main .research-btn-label` inline) y Seleccionar/Identificar (`.research-confirm-tools` inline); sm-labels "Crear/Ver/Más" ✓
- [x] 9.6 Batería E2E con 2 investigaciones (Kidd Keo intermedio + gatos experto): datos correctos, historial con 2 items, abrir del historial ✓, extender 3792→5789 + historial actualizado (6.1k) ✓, info 7 pasos ✓, misma línea en móvil ✓, 4xx vacío ✓

## 8. Mejoras ronda 5 (feedback usuario)
- [x] 8.1 "Seleccionar mensajes" CIERRA el panel para marcar en el chat; barra muestra [Cancelar][Investigador]; "Investigador" reabre el panel; al soltar la selección ("Dejar de seleccionar") el panel vuelve solo
- [x] 8.2 Listado numerado de mensajes seleccionados (#1 #4 #6 en orden del chat, entre los botones de selección y las acciones)
- [x] 8.3 Tono por nivel VERIFICADO con mismo tema (fotosíntesis): principiante = lenguaje simple + analogía ("un azúcar"); experto = técnico ("fotoautótrofos", ATP, citas [1][3][4]) ✓
- [x] 8.4 Timeout del doc 150→240s (principiante genera más texto; los timeouts eran intermitentes)
- [x] 8.5 Decisión: identificar tema admite VARIOS mensajes (el riesgo está controlado: el tema se muestra EDITABLE antes de seguir; marcar 1 solo sigue siendo posible)
- [x] 8.6 Verificado: panel cierra al seleccionar ✓, checkboxes ✓, botón Investigador reabre ✓, listado en orden ✓, 4xx vacío ✓
## 7. Correcciones ronda 4 (feedback usuario)
- [x] 7.1 Botón "Seleccionar mensajes" en el panel (toggle → checkboxes visibles; "Dejar de seleccionar" cuando activo)
- [x] 7.2 "Seleccionar tema" renombrado a "Identificar tema" (aparece con mensajes marcados; spinner "Identificando tema…")
- [x] 7.3 Preguntas anti-genéricas: el prompt PROHÍBE preguntas de formato/extension/nivel/para-qué; solo preguntas sobre EL TEMA (Kidd Keo: etapa, aspectos, artistas relacionados, conexión Alicante) ✓
- [x] 7.4 Overlay por acción: loadingText por estado ("Generando preguntas…" / "Generando documento…" / "Añadiendo sección…") — ya no sale el texto equivocado al crear el doc
- [x] 7.5 Veracidad: REGLA DE VERACIDAD en doc y deepen (solo datos de fuentes, no mezclar fragmentos, rastreable a ## Fuentes) + TEMA obligatorio al inicio del prompt + SIN historial del chat en doc/deepen (el historial arrastraba el doc hacia la conversación)
- [x] 7.6 Búsqueda: se probó engines=google (se cae, 0 resultados intermitente) → el mix default de SearXNG (google cse + ddg + wikipedia, 26 resultados estables, Wikipedia primero) es el robusto; search_internet admite engines para el futuro
- [x] 7.7 Verificado: Kidd Keo doc = 19 menciones Kidd Keo, 0 Bad Bunny, 0 Cuba/detenido (dato falso erradicado), Alicante ✓, fuentes Wikipedia/Instagram reales; crash de React arreglado (onToggleSelectMessages sin desestructurar en ChatView)
## 6. Mejoras ronda 3 (feedback usuario)
- [x] 6.1 Botón Investigar abre el panel directamente (sin botón primario intermedio; Cancelar sale). Dos modos: directo (tema tecleado prefilled) o contexto (checkboxes → textarea se rellena solo → "Seleccionar tema" destila el tema con spinner → editable → Generar preguntas/Crear)
- [x] 6.2 Endpoint nuevo `POST /api/chat/investigate/topic` (tema destilado de los mensajes seleccionados)
- [x] 6.3 Popup de guardar: spinner + "Guardando…" en el botón mientras corre save-output (Graphify tarda minutos; antes el usuario no sabía)
- [x] 6.4 Verificado: modo directo ✓, checkboxes rellenan textarea ✓, Seleccionar tema ✓ ("Definición y características de los gatos como especie"), preguntas sobre el tema ✓, Guardando…→✅ Guardado ✓

## 5. Mejoras ronda 2 (feedback usuario)
- [x] 5.1 Confirmación de tema editable antes del 1er cuestionario (fase `confirm` en ResearchPanel; startResearch con topicOverride)
- [x] 5.2 Pestañita derecha pegada al borde (misma línea que Chats) — aparece solo con investigación activa/terminada, spinner mientras carga, punto rojo de notificación al terminar con panel cerrado, reabre el panel, × descarta
- [x] 5.3 Overlay de carga cubriendo el panel entero (Investigando… / Generando más preguntas… / Añadiendo sección…)
- [x] 5.4 Verificado: confirmación ✓, overlay ✓, tab+spinner+dot+reabrir+descartar ✓, 375px ✓, oscuro ✓, recursos 4xx vacío ✓

## 4. Verificación (checklist completo)
- [x] 4.1 verify-jsx OK en cada .jsx tocado
- [x] 4.2 Build test4 + :5177 flujo completo con datos reales (tanda 1 → más preguntas → crear → doc → profundizar → guardar)
- [x] 4.3 Recursos 4xx vacío, tema claro/oscuro, con y sin tema custom
- [x] 4.4 375px: panel full-screen, scrollWidth ≤ 375
- [ ] 4.5 Sección Hecho en el plan + usuario aprueba
