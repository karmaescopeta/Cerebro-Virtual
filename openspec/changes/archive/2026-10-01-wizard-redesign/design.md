# Design — wizard-redesign

## Contexto del consejo + grill
- Consejo: preview de identidad (Godin), copy humano (Handley), señales de progreso (Sutherland), no reordenar pasos sin datos (Hormozi/Hopkins). Métrica de abandono por paso: SKIPPED — no hay endpoint ni señal barata; se añade si hay sospecha de abandono.
- Grill: preview sí + avatar subible en instalación (idea del usuario); sin ideas nuevas del usuario (tamagotchi = concepto, fuera del MVP); iconos Rounded.

## Decisiones

### Copy (rewrite completo, por archivo)
- **WelcomeScreen**: producto + versión real + botón "Empezar". Glow y dark se conservan.
- **WizardStep1** "Crea tu agente": nombre, personalidad (con placeholder de ejemplo), API key con hint + link openrouter.ai/keys, credenciales (explicadas en una línea: para qué sirven), canales opcionales.
- **WizardStepModels** "Tu inteligencia": local/nube/ambas con lenguaje llano (privado vs nube, coherente con los badges PRIVADO/NUBE del chat), pull de Ollama con copy normal.
- **WizardStep2** confirmación: resumen legible de lo que se va a crear.
- **WizardStep3**: instalación — log pulido (líneas con icono estado: progress_activity / check_circle / warning), sin crudo.

### Preview del agente (WizardStep1)
- Tarjeta arriba del form (o lateral en desktop): círculo avatar (imagen o `electric_bolt` en primary por defecto) + "Hola, soy {agentName || '…'}" + directiva truncada a ~2 líneas.
- Estado avatar en formData (`avatar: ''` data-URL). Picker reutiliza el patrón de AjustesView (input file hidden → FileReader data-URL → validación data:image/* y ≤400KB chars → POST tras configure).

### Flujo de guardado del avatar
`handleCreate` (SetupWizard.jsx): tras `POST /api/init/configure` OK → si `formData.avatar` → `POST /api/agent/avatar {avatar}`. Si falla el avatar: log warning y continuar (config ya existe, no bloquea).

### Iconos
- `wizard.css`: eliminar el @import de Material Symbols **Outlined** (la web ya carga Rounded globalmente). Los `material-symbols-outlined` class names del JSX funcionan igual con la fuente Rounded cargada (misma ligadura) — verificado: app.css de la web usa la misma clase.

### Versión real
- WelcomeScreen: `useEffect` → `fetch('/api/version')` → `v{current}`. Fallback: ocultar la línea si falla (nunca un número falso).

## Hecho (2026-10-01)
- Implementado y verificado en sandbox dedicado: red `cv-wizard-test` + contenedores `backend` (imagen cerebrovirtual-backend, vault scratch propio, :8100) y `cv-wizard-frontend` (imagen cerebro-frontend-test4, :5178) + dummy nginx con aliases (`sistema-agente`/`ollama`) para que el nginx del frontend arranque. Stack real NO tocado.
- Verificado en navegador (127.0.0.1:5178): welcome (Empezar + tagline + versión real v1.0.0 en stack real; en sandbox "unknown" → línea oculta = fallback OK), preview en vivo (nombre/directiva/avatar reactivos), subida de avatar (File→data-URL→preview img), imagen inválida rechazada con copy, pasos 2-4 completos, log pulido con iconos de estado (progress_activity girando / check_circle / warning ámbar / error), pantalla final "¡Tu Cerebro está vivo!", Entrar → chat con avatar en sidebar y topbar.
- Endpoints con payload real en sandbox: POST /api/init/configure 200, POST /api/agent/avatar 200 (770 bytes guardados), /api/agent/start (falla controlada → línea warn del log, sin bloquear).
- Temas: claro y oscuro (OLED azul) verificados en welcome + pasos + confirmación; tokens duales/color-mix computan con la var activa (App.jsx restaura su paleta al montar, mismo mecanismo que webTheme custom). 375px: scrollWidth 375, sin overflow en paso 1 dark.
- Recursos: `performance.getEntriesByType('resource')` sin `material+symbols+outlined` y sin responseStatus>=400, tanto en wizard como en la app post-wizard.
- Extra: App.jsx re-carga el avatar al completar el wizard (si no, el chat no lo veía hasta F5).
- Auditoría de skills de diseño aplicada (impeccable + ui-ux-pro-max, 2026-10-01): validación on-blur por campo (validators en SetupWizard, error se limpia al escribir), botones de avatar del preview a 48px táctiles (padding 14px + margen negativo), `prefers-reduced-motion` desactiva spin/blink/transform hovers, `aria-current="step"` en el indicador y `role="log" aria-live="polite"` en el terminal. Re-verificado tras rebuild: blur valida y limpia, 375px sin overflow, recursos limpios (0 Outlined, 0 4xx).
- Iteración del usuario (2026-10-01, 6 puntos): (1) personalización como pestaña propia — wizard de 5 pasos (Identidad → Conexión → Inteligencia → Confirmar → Listo), WizardStepIdentity.jsx nuevo con la tarjeta identidad sola y WizardStep1 = solo conexión (API key, tunnel, panel). (2) Tagline "Crea tu propio asistente: un clic, tus documentos, coste cero." (3) OmniRoute claro: hint "¿Más proveedores (Claude, Gemini, GLM...)? Entra en el panel de OmniRoute, añádelos tú mismo con su API key y vuelve: el chat los usará al instante." + botón "Añadir proveedores en OmniRoute" SIEMPRE activo (antes disabled en modo cloud). (4) Respuesta al usuario: local/nube SÍ se cambia después (interruptor del chat + Ajustes); subtitle lo dice explícito. (5) Tunnel con enlace a Cloudflare Zero Trust (one.dash.cloudflare.com) en el hint. (6) Tema oscuro: default de la app 'dark' cuando no hay preferencia guardada (App.jsx) + wizard fuerza dark mientras dura (useEffect force + cleanup restaurando el prev — regla del skill cv-redesign). Verificado: flujo 5 pasos completo → app con tema dark sin salto (themeAfter dark), 375px limpio (identity en móvil: avatar 56px, nombre completo 171px, acciones full-row), copy sin escapes rotos.
- Alineación de estilo con la web (2026-10-01, "mismo estilo que las páginas"): comparado wizard.css contra app.css (.card/.btn-app/.input-app) — diffs corregidos: fondo plano var(--color-bg) (antes gradiente radial), wizard-card border --color-border sin sombra (como .card), inputs bg --color-surface + padding 11/16 (como .input-app), botones pill radius-full font-body 14/600 con secundario surface-container+border (como .btn-app, antes mono caps radius-md), textarea font-body (mono solo consola), summary-box como card de la web, welcome-start-btn pill grande con arrow_forward (antes círculo 192px con inset gradient). Verificado con computed styles: cardBorder #2A3350 (--color-border), rootBg #070912 plano, inputBg #0D101D (--color-surface), secBg #121626 (--color-surface-container), radii 9999px, fuentes Sora. Desplegado en sandbox y :5177.
- Simplificación de inteligencia (2026-10-01, decisión del usuario): pestaña "Tu inteligencia" ELIMINADA — local y nube habilitados por defecto (iaMode 'both' fijo; el backend provisiona ambos y el interruptor Local/Nube vive en el chat), sin instalar modelos locales en el wizard (la web tiene terminal al contenedor Ollama). En su lugar pestaña opcional "Proveedores de IA" (WizardStepProviders.jsx; WizardStepModels.jsx borrado): explica los 5 combos por tarea (chat-default/chat-smart/cerebro/graphify/investigador), cómo añadir proveedores con su API key en OmniRoute y asignar modelos a cada combo + botón "Abrir panel de OmniRoute". StepIndicator: Identidad → Conexión → Proveedores → Confirmar → Listo. Verificado: flujo completo, combos listados, 375px sin overflow, .btn-actions con wrap para 3 botones.
- Iteración UI (2026-10-01, 5 puntos): (1) botón Empezar circular 192px otra vez (140px móvil, sin gradiente interno ni flecha). (2) Tagline "Crea tu propio asistente". (3) Subtítulos fijos ELIMINADOS de todas las pantallas — en su lugar icono info (WizardInfo.jsx: botón junto al título que despliega caja de ayuda con aria-expanded). (4) Títulos centrados horizontalmente en el card (.wizard-head flex center + .wizard-title text-align center). (5) Copy simplificado para usuario básico: combos = "puestos" (Hablar contigo / Pensar más a fondo / Leer tus documentos / Hacer los mapas de conocimiento / Buscar en internet), hints de una frase, divider TU CUENTA, errores cortos ("Ponle un nombre", "Pega aquí tu API Key"...), final "Ya puedes hablar con él. Todo se puede cambiar después en Ajustes." Verificado: títulos centrados (rect center < 3px), info despliega/cierra en pasos 1 y 2, sin .wizard-subtitle en el DOM, flecha fuera del círculo.
- Pendiente del checklist: prueba de tema custom REAL activando una paleta desde Ajustes (el wizard consume las mismas vars; riesgo bajo), aprobación del usuario → archive.

### Estilo
- Tokens ya presentes; se añaden: label-caps en labels de sección (patrón `.form-divider-label` ya existe — se generaliza), tarjeta preview con `color-mix(in srgb, var(--color-primary) 8%, transparent)` + borde, botones primarios primary sólido (color fijo, sin gradientes en botones).
- wizard.css: 579 líneas — patch por bloques, NO write_file.

## Riesgos
- El wizard solo aparece sin config → para verificar: vaciar `vault/system/agent-config.json` del entorno de TEST y recargar :5177 (después restaurar).
- Burbujas/estados del chat NO se tocan — el wizard es un árbol aparte en App.jsx.
- Fuente Outlined eliminada: si algún icono del wizard usa un nombre que no está en la lista verificada de Rounded, cambiarlo a uno de la lista (auditar los ~10 iconos del wizard).
