# Design: security-audit-run1-fixes

## Contexto
Los 10 fixes provienen de `~/security-audit-skill/cerebro-virtual/run-1/FINDINGS-DETAIL.md` (trazas archivo:línea y remediación mínima ya verificadas adversarialmente). Este design solo decide dónde se aplican.

## Decisiones

### D1 — Un helper de confinamiento, no 6 checks
`_confine(category, *segments)` con `Path.resolve()` + `startswith(base + os.sep)` — copia el patrón EXISTENTE de `update_vault_file` (main.py:1543-1548). Aplica a los 6 endpoints. Los sinks move (rename/reassign) quedan confinados de facto (EXDEV ya limitaba su alcance); los write cruzan mounts solo dentro del subtree confinado.

### D2 — extractall con filter="data"
Python 3.11.4+ soporta `filter="data"`; la imagen base es `python:3.11-slim` (unpinned, cualquier patch actual ≥3.11.4). One-liner. Symlinks del copy-back: `filter="data"` ya rechaza links que escapan; además el sink de symlink-serving por vault-static fue refutado (starlette no sigue symlinks), así que no se toca el copy-back.

### D3 — Scripts: env var, no interpolación
`TRANSCRIPT="$INPUT" python -c "...os.environ['TRANSCRIPT']..."` — mismo shape en los 4 sitios. No se reescriben los scripts completos, solo las líneas `python -c`.

### D4 — Validación de models en la API, no en el script
Whitelist regex en backend antes de persistir (la fuente atacante es el API). install_profiles.sh queda como está: con la entrada saneada, el sed es inerte. (Capa extra en el script: innecesaria — YAGNI; los otros writers de agent-config.json ya quedan cerrados por D1/D2.)

### D5 — WS terminal: allowlist + metacharacteres
`^(ollama|omniroute)\s+[A-Za-z0-9._:/-]+$` + reject `[;|&$\`<>]`. Reemplaza `_OLLAMA_BAN` (se mantiene para el mensaje de error).

### D6 — `_safe_env_kv` compartido
Valida key y valor en update_label y _update_env_token (el token crudo pasa por ahí). `_update_env_password`/`_clear_env_token` escriben valores internos → no requieren validación de entrada.

### D7 — StaticFiles bloqueando `system/`
Subclase con `get_response` override: primer segmento `system` → HTTPException 404. Misma lista que `SENSITIVE` del export — un solo lugar conceptual: se usa un set `{"system"}`.

### D8 — html.escape en status page
`escape(agent_name, quote=True)` + escapar el fragmento createdAt.

### D9 — Lock + atomic dump para graph.json
`_GRAPH_LOCK = threading.Lock()` (uvicorn single process), `_atomic_dump(path, obj)` con `os.replace`. En parse-failure: log + return (no merge con grafo vacío). Aplica a _merge_graph, _replace_graph, _prune_graph_json, _sync_graph_json, RMW inline del rename, reset y _record_graphed.

### D10 — Rollback verifica, no afirma
`docker tag <oldID> <meta["image"]>` + `docker inspect` compara el ID del contenedor recreado antes de `rolledBack: true`.

## Verificación
Tests SOLO en este cambio (workflow del usuario): cada fix con un assert mínimo (script ad-hoc con nombre único, limpieza tras — patrón del usuario). `py_compile` de main.py, `bash -n` de los scripts, `node --check` del frontend si se toca (no se toca). Re-verificar con los checks de `gestor-cerebros-review` tras aplicar.
