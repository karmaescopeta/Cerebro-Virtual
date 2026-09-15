# Tasks: combo-ia-privacidad

## Backend
- [x] 1. Fix indentación `containers_status` (main.py:2443-2456) + verificación: `GET /api/containers/status` devuelve mapa con backend/frontend
- [x] 2. Fix export: sanitize agent-config.json en tar (sin apiKey/channelTokens/dashboard.password) + test: export→import→grep sin claves
- [x] 3. `vault/system/ia-mode.json` (mode, localMode, cloudMode, combosProvisioned, cerebroAvisoVisto) + helpers load/save + endpoints GET/PUT `/api/ia/mode` + GET/POST `/api/ia/aviso`
- [x] 4. `_profile_model(profile, local)`: lee modelsLocal/models de agent-config.json; fallback a modelos actuales si no hay combos (compat hacia atrás)
- [x] 5. Ruta B elegida (configs `<p>-local` en install_profiles.sh, 5 configs extra generadas con mismos prompts + combo local) — verificar primero si `hermes chat` acepta flag `--model`; si sí, usar flag y no crear configs locales
- [x] 6. `/api/chat`: parámetro `local` en request → `_ask_hermes(perfil_local_o_cloud)` → ctx.local en respuesta y sesión
- [x] 7. `_omni_provision_combos(mode)`: login+POST /api/combos (4 cloud / 4 local) tras wizard y arranque si provisionado=false
- [x] 8. Upload async: `_wiki_bg` thread (patrón _graphify_bg), respuesta inmediata con `wiki_pending: true`
- [x] 9. Sanitize SetupWizard apiKey placeholder (string vacío)
- [x] 10. `/api/profiles/models` devuelve combos actuales (models + modelsLocal); PUT escribe ambas claves

## Frontend
- [x] 11. ChatView: toggle Local/Cloud (barra botones), borde input verde/naranja, badge 🔒/☁️ en burbuja assistant desde ctx.local
- [x] 12. Modal MarkdownViewer en burbujas assistant (fallback pre-wrap)
- [x] 13. Aviso informativo cerebro-cloud: modal 1 vez (estado via `/api/ia/aviso`), texto recomendación + nota empresas
- [x] 14. Wizard v3: quitar WizardStepModels legacy; nuevo paso Modo IA (radio + instalador ollama con cola SSE + recomendación medio); paso OmniRoute ventana aparte con "Ya terminé, continuar"; default vs personalizada
- [x] 15. ModelosView: editor de combos (perfil → combo cloud/local asignado; link a /omniroute/ para editar modelos del combo)
- [x] 16. CerebroView/ChatView: badge "Procesando…" cuando wiki_pending y refresco al entrar

## Herramientas (markitdown)
- [x] 20. markitdown en herramientas: pip install `markitdown[all]` en Dockerfile + rewrite process_raw.sh (audio/video→whisper como hoy; resto→`markitdown "$INPUT" > "$OUTPUT.md"`) + ocr.sh como fallback si salida vacía + borrar extract_pdf.sh + probar con PDF real de C:\proyectoBueno\

## Verificación e2e
- [x] 17. Compose recreate backend/frontend; flujo wizard completo en limpio (modo ambas): provision combos visible en OmniRoute, pull qwen2.5:0.5b desde wizard, chat local (combo local), toggle cloud (combo cloud), badge/color correctos, aviso 1 vez, export sin credenciales, upload async con badge, containers/status devuelve mapa
- [x] 18. Regresión: multi-instancia installer crea instancia y arranca; update check no roto

## Ponytail checks (uno runnable)
- [x] 19. `tests/test_combo_routing.py`: _profile_model devuelve combo local/cloud correcto + export sanitizado sin credenciales (assert puro, sin fixtures)