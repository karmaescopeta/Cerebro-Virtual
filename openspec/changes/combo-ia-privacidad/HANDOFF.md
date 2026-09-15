# Plan: combo-ia-privacidad (handoff para sesión nueva)

**Estado**: plan aprobado y validado (`openspec validate` → VALID). Cambio: `openspec/changes/combo-ia-privacidad/` (proposal.md, design.md, specs/combo-routing/spec.md, tasks.md — 19 tareas). Leer esos 4 archivos primero en la nueva sesión.

**Contexto**: skill `cerebro-virtual` (arquitectura + pitfalls) y `references/posicionamiento-2026-09.md` (claims aprobados). No vender "más inteligente con el tiempo". Privacidad por capas.

## Qué implementa (orden recomendado)

0. **Markitdown** (task 20): veredicto positivo — ver "Investigación markitdown" en design.md. `pip install markitdown[all]` + rewrite process_raw.sh (2 ramas: whisper audio/video, resto → markitdown .md). PDF/docx/xlsx/pptx/epub → Markdown estructurado → mejor Graphify. Borrar extract_pdf.sh; ocr.sh queda como fallback.

1. **Bugs primero** (tasks 1-2-9, ~30min): indentación containers_status, export sin credenciales, apiKey placeholder fuera.
2. **Combo-routing** (tasks 3-7): ia-mode.json + `_profile_model(profile, local)` + toggle por request + provision combos OmniRoute. Decisión pendiente en task 5: probar si `hermes chat` acepta flag `--model` (una línea); si no → plan B: configs `*-local` por perfil generadas en install_profiles.sh (misma personalidad, combo local; toggle elige `<p>` vs `<p>-local`). Nada nuevo en Hermes.
3. **Frontend chat** (tasks 11-13): toggle Local/Cloud en barra, input verde/naranja, badge 🔒/☁️ desde ctx.local, markdown en burbujas (MarkdownViewer), aviso cerebro-cloud 1 vez (POST /api/ia/aviso).
4. **Wizard v3** (tasks 14-15-16): quitar WizardStepModels legacy → paso Modo IA (local/cloud/ambas) + instalador de modelos (pegar comando `ollama pull X`, cola multi, SSE existente `/api/localai/pull`) + recomendación 1 modelo medio para cerebro/graphify + OmniRoute en ventana aparte (/omniroute/, volver con "Ya terminé") + default vs personalizada. ModelosView = editor de combos.
5. **Upload async** (task 8): patrón _graphify_bg para síntesis wiki.

## Nivel de modelo por perfil (acordado)
- cerebro: local MEDIO (7B clase) recomendado; si cloud → tier gratis + aviso informativo.
- graphify: igual que cerebro (procesa contenido completo del doc → cloud = doc sale; mismo aviso).
- chat-default: gratis cloud o liviano local. chat-smart/investigador: mejor disponible (cloud pago o mayor local).

## Pitfalls conocidos (del proyecto, no re-descubrir)
- Compose v5.1.4: `up -d --force-recreate --no-deps` tras rebuild.
- OmniRoute modelos con prefijo proveedor (`ollama/qwen2.5:0.5b`); combos ya verificados e2e (`combo/<nombre>`).
- Wizard off-by-one en setStep. MSYS paths en docker exec. subprocess bloqueante → run_in_threadpool.
- Verificación: usuario exige e2e desde cero (compose recreate, wizard limpio, export→import sin claves, badge/color, aviso 1 vez, containers/status con mapa). Tests solo en cambios nuevos.

## Fuera de este plan (changes aparte ya existentes)
- Cloudflare Access Google login (obligatorio si tunnel activo — decisión del usuario) → change `cloudflare-access-auth`.
- Pasos 2-3 update-system-v2 y CF Access: ver `references/PROXIMOS-PASOS-updates-v2-y-cloudflare.md`.