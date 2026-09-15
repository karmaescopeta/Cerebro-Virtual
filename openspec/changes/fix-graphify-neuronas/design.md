# Design — fix-graphify-neuronas

## Decisiones

### D1: Timeout 300s

Cambio trivial. `_run_graphify` línea 370: `timeout=180` → `timeout=300`. deepseek-v4-flash tarda hasta 130s. 300s da margen para modelos más lentos (claude, gpt-4).

### D2: Archivo aislado en temp dir

En `_run_graphify`, en vez de pasar `os.path.dirname(file_abs_path)` a Graphify:
1. Crear temp dir en host (`tempfile.mkdtemp()`).
2. Copiar el archivo al temp dir.
3. Montar temp dir en el contenedor efímero.
4. Graphify procesa el temp dir (1 archivo).
5. Leer graph.json del output.
6. Cleanup temp dir.

El contenedor efímero ya monta `vault_host:/app/vault`. Añadimos un segundo mount: `temp_dir:/app/vault/tmp-iso`. Graphify escanea `/app/vault/tmp-iso` (1 archivo).

**Alternativa considerada:** Modificar `run_graphify.sh` para aceptar un archivo individual. Descartado: Graphify dice "Not a directory" con archivo. El temp dir es más simple.

### D3: Default model `deepseek/deepseek-v4-flash`

Cambiar en 4 sitios:
- `backend/app/main.py` `_get_graphify_model()` default return
- `backend/app/main.py` `PROFILE_DEFS` graphify default
- `frontend/src/components/views/ModelosView.jsx` `DEFAULT_MODELS.graphify`
- `frontend/src/components/wizard/WizardStepModels.jsx` `DEFAULT_MODELS.graphify`
- `frontend/src/SetupWizard.jsx` `DEFAULT_MODELS.graphify`

### D4: `graph_updated` en upload

Añadir `graph_updated` al return de `/api/vault/upload`. Como Graphify corre en background (D5), el valor inicial es `false`. El frontend puede hacer polling de `/api/graph/status` si quiere saber cuándo termina.

**Alternativa considerada:** Esperar a Graphify y retornar el valor real. Descartado: bloquea el upload 50-130s.

### D5: Graphify en background

Usar `threading.Thread` para lanzar Graphify después del upload. El thread:
1. Copia archivo a temp dir.
2. Ejecuta `_run_graphify`.
3. Si hay nodos, `_merge_graph`.
4. Cleanup.
5. Log de errores, no crash.

No hay necesidad de `asyncio` — Graphify es `subprocess.run` (blocking). Thread simple es suficiente. El daemon thread muere si el proceso principal muere.

## No changes

- `_merge_graph`: funciona bien, dedup por `(id, source_file)`.
- `_prune_graph_json`: funciona bien.
- `_sync_graph_json`: funciona bien.
- `run_graphify.sh`: no cambia, sigue recibiendo un directorio.
- `GRAPHIFY_EXTS`: no cambia.
- Grafo de estructura: no cambia, funciona.
