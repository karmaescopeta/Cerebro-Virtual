# Proposal: security-audit-run1-fixes

## Why
La auditoría de seguridad run-1 (2026-10-04, ver `~/security-audit-skill/cerebro-virtual/run-1/REPORT.md`) confirmó 10 vulnerabilidades (7 HIGH, 3 MEDIUM) tras doble validación adversarial. Una de ellas (clave OpenRouter commiteada al repo público) ya fue explotada de facto: OpenRouter detectó la clave en github.com/karmaescopeta/Cerebro-Virtual y la desactivó (correo "Security alert", key "prueba2").

## What Changes
Fixes mínimos, uno por hallazgo, en el punto de decisión compartido (todos en backend/app/main.py salvo 3 scripts):

1. **Confinamiento de rutas del vault** — helper `_confine()` (resolve+prefix, igual que update-file) aplicado a los 6 endpoints sin guard: upload (project/topic), save-output (project_id), rename (newName), reassign (targetProject), process y process-folder (path). [HIGH]
2. **Import tar** — `tar.extractall(..., filter="data")`. [HIGH]
3. **Scripts herramientas** — `python -c` deja de interpolar `$INPUT`/`$AUDIO`: se pasa por variable de entorno (`os.environ`). process_raw.sh, ocr.sh (2 sitios), transcribe.sh. [HIGH]
4. **models del API** — `_validate_models()` (regex `[A-Za-z0-9._:/@+-]{0,120}`) en update_profiles_models y configure_agent, antes de persistir. Cierra la inyección sed `e` en install_profiles.sh. [HIGH]
5. **Terminal WS** — whitelist de primer token (ollama|omniroute + verbo) y rechazo de metacaracteres shell `[;|&$\`<>]` en vez de blocklist. [HIGH]
6. **Escritores de `.env`** — `_safe_env_kv()`: key `^[A-Za-z0-9_]+$`, valor sin `\r\n=` ni control chars; aplicado en update_label y `_update_env_token` (token de túnel). [HIGH]
7. **`/vault-static`** — subclase de StaticFiles que devuelve 404 para el primer segmento `system/` (misma política que el export). [HIGH]
8. **`/api/agent/status`** — `html.escape()` de los valores interpolados. [MEDIUM]
9. **graph.json/graph-meta.json** — `threading.Lock` + `_atomic_dump()` (tmp + os.replace) y no mergear sobre parse-failure (log + abort). [MEDIUM]
10. **Rollback de imágenes** — retag al nombre de imagen del compose (`meta["image"]`) + verificación del ID del contenedor recreado antes de reportar `rolledBack`. [MEDIUM]

## Out of scope
- Needs_validation (16): requieren observación del owner o hechos de desplazuegue (Cloudflare Access, OmniRoute defaults, prompt injection, etc.). Ningún cambio de código aquí.
- Rewrite de git history (la clave expuesta ya está desactivada; opcional, decisión aparte).
- CSP de nginx, puerto 20128 de omniroute, docker.sock, D15 sin auth: decisiones de diseño documentadas, no fixes.

## Impact
- Seguridad: cierra las 10 confirmadas. Los 7 HIGH comparten patrón "control de hermano inconsistente" — 4 fixes son reutilizar el patrón que ya existe en el repo (update-file/export/upload-whitelist).
- Riesgo: diffs pequeños y localizados; `main.py` solo con patch (3600+ líneas).
