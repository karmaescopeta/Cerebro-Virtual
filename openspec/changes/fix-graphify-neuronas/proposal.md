# Proposal — fix-graphify-neuronas

## Problema

Cuando se añade un archivo nuevo (via chat upload o save-output), Graphify no genera neuronas en el grafo de neuronas (`vault/system/graph.json`). El grafo de estructura sí se actualiza, pero el de neuronas queda vacío o sin los nodos nuevos.

## Root causes (verificado con tests manuales)

1. **Timeout 180s insuficiente**: `deepseek-v4-flash` tarda 90-130s por archivo. A veces >180s → `subprocess.TimeoutExpired` → 0 nodos. Log confirmado: `⏱️ Graphify timeout (180s) para /app/vault/outputs/infocantantes`.

2. **Graphify procesa directorio completo**: `_run_graphify` hace `os.path.dirname(file_abs_path)` y pasa el directorio a Graphify. Esto reprocesa TODOS los archivos del directorio, no solo el nuevo. Ineficiente, más caro, más propenso a timeout. Test manual: dir completo = 102s/$0.02, archivo aislado = 52s/$0.01.

3. **Modelo default rate-limited**: `_get_graphify_model()` default = `google/gemma-4-26b-a4b-it:free`. Si la config no carga o el usuario no configuró el modelo, usa el free → 429 rate-limit → 0 nodos. El free está casi siempre rate-limited en OpenRouter.

4. **Upload no retorna `graph_updated`**: El endpoint `/api/vault/upload` no incluye `graph_updated` en la respuesta. El frontend no puede mostrar feedback de si las neuronas se generaron.

5. **Graphify bloquea el upload**: Graphify corre inline en `/api/vault/upload`. Si falla o timeout, el upload tarda hasta 180s en responder. Debe correr en background.

## Solución

1. Subir timeout de 180s a 300s en `_run_graphify`.
2. Aislar archivo en dir temporal antes de pasar a Graphify. Copiar el archivo a un temp dir, procesar, leer graph.json, cleanup. Más rápido, más barato, sin reprocesar archivos viejos.
3. Cambiar default de `gemma-4-26b-a4b-it:free` a `deepseek/deepseek-v4-flash` en 3 sitios: `_get_graphify_model()`, `ModelosView.jsx`, `WizardStepModels.jsx`, `SetupWizard.jsx`, y `PROFILE_DEFS`.
4. Añadir `graph_updated` a la respuesta de `/api/vault/upload`.
5. Mover Graphify a background thread en `/api/vault/upload` (no bloquear respuesta).

## Scope

- `backend/app/main.py`: `_run_graphify`, `_get_graphify_model`, `PROFILE_DEFS`, `/api/vault/upload`
- `frontend/src/components/views/ModelosView.jsx`: default model
- `frontend/src/components/wizard/WizardStepModels.jsx`: default model
- `frontend/src/SetupWizard.jsx`: default model

## Out of scope

- Cambiar la UI del tab de modelos (ya funciona, solo cambia el default)
- Modificar Graphify binary (interno)
- Cambiar el grafo de estructura (funciona)
