# Tasks: security-audit-run1-fixes

## Backend (main.py — SOLO patch)
- [x] 1. Helper `_confine(category, *segments)` (resolve+prefix) y aplicarlo en: upload `dest_folder`, save-output `project_id`, rename `newName`, reassign `targetProject`, process `path`, process-folder `path`. HTTP 400 "Path inválido".
- [x] 2. `tar.extractall(str(temp_dir), filter="data")` en import_vault.
- [x] 3. `_validate_models(new_models)` (regex) al inicio de `update_profiles_models` y en `configure_agent` para `request["models"]`.
- [x] 4. Terminal WS: allowlist `^(ollama|omniroute)\s+[A-Za-z0-9._:/-]+$` + reject `[;|&$\`<>]`.
- [x] 5. `_safe_env_kv(key, value)`: key `^[A-Za-z0-9_]+$`, valor sin `\r\n=`; aplicar en `update_label` y en el token antes de `_update_env_token` (allow_eq para el token).
- [x] 6. Subclase `_VaultStatic(StaticFiles)` que 404-ee el primer segmento `system`; reemplazar el mount.
- [x] 7. `html.escape` de agentName y createdAt en `/api/agent/status`.
- [x] 8. `_GRAPH_LOCK` + `_atomic_dump()` en los 7 escritores de graph.json/graph-meta.json; parse-failure → log+abort, no merge vacío.
- [x] 9. Rollback de imágenes: retag a `meta["image"]` + `docker inspect` verificación antes de `rolledBack: True`.

## Scripts (herramientas)
- [x] 10. process_raw.sh, ocr.sh (2 sitios), transcribe.sh: `$INPUT`/`$AUDIO`/`$MODEL` por variable de entorno, sin interpolación en `python -c`.

## Verificación (solo este cambio)
- [x] 11. `py -m py_compile backend/app/main.py` OK; `bash -n` de los 3 scripts OK; sin CRLF.
- [x] 12. Script ad-hoc de asserts (borrado tras correr): _confine rechaza `../`, _safe_env_kv rechaza newline/`=`, extractall filter=data rechaza members `../`, escape HTML, regex de models/WS — ALL CHECKS PASSED.
- [ ] 13. Re-verificación con checks de gestor-cerebros-review (servidor en proceso, E2E logtest) — PENDIENTE: requiere rebuild del backend del stack corriendo (ver nota) — y `openspec validate security-audit-run1-fixes`.
- [ ] 14. `graphify update .` (graph del repo stale tras cambios).

## Extra (pedido del usuario en esta sesión)
- [x] Git history: `git filter-repo --invert-paths` sobre `.env`, `vault/system/agent-keys.json` (ambos layouts), `cerebro virtual/sistema-agente/config/agent-config.yaml`, `cerebro virtual/vault/system/agent-config.json`. Verificado con pickaxe + regex estricta de key real: 0 blobs con clave. Backup bundle en `C:\Users\danie\cerebro-history-backup-pre-filter.bundle`.
- [ ] Force push a GitHub (main + release-root + tag v1.0.0) — **bloqueado esperando consentimiento del usuario**.

