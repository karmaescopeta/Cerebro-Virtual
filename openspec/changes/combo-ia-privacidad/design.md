# Design: combo-ia-privacidad

## Arquitectura

### Combo como unidad de ruteo
`agent-config.json` cambia semántica: `models.{perfil}` contiene `combo/<nombre>` en vez de `proveedor/modelo`. OmniRoute ya enruta `combo/<nombre>` al primer modelo disponible del combo (verificado 2026-09-05). `_ask_hermes` no cambia su mecanismo (docker exec + HERMES_CONFIG); solo cambia el valor que `install_profiles.sh` escribe en `model:` de cada perfil.

```
ia-mode.json (vault/system)          agent-config.json
{ "mode": "local|cloud|both",        { "models": {
  "localMode": true,                    "chat-default": "combo/cerebro-default",
  "cloudMode": true,                    "chat-smart": "combo/cerebro-smart",
  "combosProvisioned": true,            "cerebro": "combo/cerebro-cerebro",
  "cerebroAvisoVisto": false }          ... } }
```

### Resolución de combo en runtime (lazy)
Toggle local/cloud = flag en la request de chat. `_ask_hermes` recibe `profile`; nuevo helper `_profile_model(profile, local)`:
- local=True → `modelsLocal.{perfil}` (combo local), local=False → `models.{perfil}`.
- Nuevas claves en agent-config.json: `modelsLocal` (paralela a models) + `iaMode`.
- CERO cambios en install_profiles.sh / perfiles Hermes: el sed de `model:` sigue funcionando porque `combo/x` es un model name válido para OmniRoute. El toggle NO reconfigura Hermes: el backend pasa el modelo por env del exec.

Cambio concreto en `_ask_hermes`: el `-e HERMES_CONFIG` de perfil ya fija el modelo — el toggle no puede cambiarlo post-arranque. Solución lazy: no depender del config del perfil para el modelo. Hermes chat ya lee el modelo del config; para overridar por llamada existe `LLM_MODEL`… **decisión**: inyectar `MODEL_OVERRIDE` no existe en Hermes → usar `OPENAI_MODEL`? NO — la ruta barata verificada: `hermes chat` usa `llm.model` del config. El perfil YA se genera por install_profiles.sh desde agent-config.json. Por tanto el toggle cambia `models.{perfil}` en agent-config.json + docker restart es DEMASIADO lento por mensaje.

**Decisión**: pasar el modelo como parte del prompt NO; usar env `HERMES_MODEL_OVERRIDE` no existe. La ruta real: `_ask_hermes` no usa el config de perfil para el modelo sino para personalidad; el modelo se fijará por exec env si Hermes lo soporta (`--model` flag en `hermes chat`). Verificar flag en implementación. Plan B si no hay flag: 5 configs extra `profiles/<p>-local/config.yaml` generadas por install_profiles.sh (misma personalidad, combo local) y el toggle elige `<p>` vs `<p>-local`. Ruta B es la fallback segura — cero dependencia de features nuevas de Hermes CLI.

### Provision de combos
`_omni_provision_combos(mode)`: tras login existente, `POST /api/combos` (endpoint verificado e2e en omniroute-ollama). Combos base:
- cloud: `cerebro-default` [tier gratis], `cerebro-smart` [mejor de pago], `cerebro-cerebro` [gratis + aviso], `cerebro-graphify` [gratis]
- local: `local-default` [liviano], `local-smart` [el mayor instalado], `local-cerebro` [medio recomendado], `local-graphify` [medio]
Solo se crean los del modo elegido. Vacío si no hay modelos → combos con 1 modelo placeholder elegible desde ModelosView.

### Badge y colores
- Badge: `ctx.local` (bool) guardado al enviar (estructura ctx ya persiste en sesión). Frontend pinta 🔒/☁️ en header de burbuja assistant.
- Input del chat: `borderColor` verde/naranja + barra de estado junto al toggle. CSS variables existentes (--color-success verde; naranja = nuevo token inline, sin tocar tokens.css).
- Aviso: `vault/system/ia-mode.json.cerebroAvisoVisto`; endpoint GET/POST `/api/ia/aviso`. Frontend muestra modal informativo 1 vez al activar cerebro con cloudMode activo.

### Wizard v3 (SetupWizard.jsx)
1. Bienvenida (existe) → 2. Cuenta (API key/nombre/dashboard) → 3. **Modo IA** (nuevo): radio local/cloud/ambas + si local: lista de modelos sugeridos + input pegar comando ollama (`ollama pull qwen2.5:7b` → extrae nombre) + botón añadir → cola con progreso (GET /api/localai/pull SSE existente) + recomendación destacada "1 modelo medio para el cerebro" → 4. OmniRoute externo: botón "Configurar en OmniRoute" abre `/omniroute/` en nueva pestaña (provision corre en backend al confirmar) + botón "Ya terminé, continuar" → 5. default/personalizada → done. Personalizada NO entra al wizard: ModelosView post-instalación (recomendado y aceptado).

### Bugs incluidos
- containers_status: desindentar bloque (raíz, no síntoma).
- export: añadir agent-config.json → sanitize keys apiKey/channelTokens/*/dashboard.password (escribir versión sin credenciales, conservar estructura).
- SetupWizard: apiKey placeholder → string vacío.
- ChatView burbujas: `<MarkdownViewer content={msg.content}>` con fallback pre-wrap.

### Upload async
Patrón `_graphify_bg`: nueva thread `_wiki_bg(stem, extracted_text, api_key)` tras guardar raw; upload responde inmediato `{wiki_pending: true}`; badge "Procesando…" en CerebroView (poll de GET /api/vault/raw ya existente refresca al entrar).

## Pitfalls conocidos (de skill cerebro-virtual)
- Compose v5.1.4: `up -d --force-recreate --no-deps` tras cambios de imagen.
- OmniRoute modelos con prefijo (`ollama/qwen2.5:0.5b`).
- Wizard off-by-one en setStep.
- MSYS paths en docker exec.
- run_in_threadpool para subprocess bloqueantes.

## Investigación: markitdown (Microsoft) — APROBADO, task añadida

**Veredicto: sí, reemplaza el pipeline de extracción actual.** Razones contra la escalera de complejidad:
1. El stack actual (pdfplumber + PyPDF2 + whisper + pytesseract + python-docx, 5 rutas de script bash) es exactamente lo que markitdown unifica en 1 llamada con SALIDA MARKDOWN (títulos, tablas, listas preservados). Markdown estructurado = Graphify y la síntesis wiki reciben estructura real en vez de texto plano → mejor grafo, menos alucinación en chunking.
2. Cubre docx/xlsx/pptx/epub/html/csv que HOY no se procesan (solo pdf/audio/imagen/txt/docx).
3. Es pip-installable, mantenida por Microsoft, licencia MIT. La imagen `herramientas` ya es Python 3.11 (requisito 3.10+ ok).
4. whisper queda para audio/video (markitdown también transcribe audio vía EXIF+speech pero no mejor que whisper actual; no tocar).

**Alcance mínimo (ponytail)**: `pip install markitdown[all]` en herramientas/Dockerfile + rewrite de `process_raw.sh`: un case de 2 ramas (audio/video → whisper como hoy; todo lo demás → `markitdown "$INPUT" > "$OUTPUT.md"`). Se elimina extract_pdf.sh, ocr.sh se queda para PDFs escaneados como fallback cuando markitdown devuelva vacío. Probar con PDF real de C:\proyectoBueno\ antes de cerrar la task.

**Task añadida a tasks.md** (ver abajo). No entra en esta iteración el modo library de markitdown ni preprocesadores custom.