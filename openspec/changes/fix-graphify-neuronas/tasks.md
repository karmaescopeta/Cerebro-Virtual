# Tasks — fix-graphify-neuronas

## Backend (main.py)

- [ ] **T1**: Subir timeout de 180s a 300s en `_run_graphify` (línea 370)
- [ ] **T2**: Aislar archivo en temp dir dentro de `_run_graphify`
  - Crear temp dir con `tempfile.mkdtemp()`
  - Copiar archivo al temp dir
  - Añadir mount `-v temp_dir:/app/vault/tmp-iso` al `docker run`
  - Pasar `/app/vault/tmp-iso` como input a `run_graphify.sh`
  - Cleanup temp dir en `finally`
- [ ] **T3**: Cambiar default de `_get_graphify_model()` de `gemma-4-26b-a4b-it:free` a `deepseek/deepseek-v4-flash`
- [ ] **T4**: Cambiar default de `PROFILE_DEFS` graphify de `gemma-4-26b-a4b-it:free` a `deepseek/deepseek-v4-flash`
- [ ] **T5**: Mover Graphify a background thread en `/api/vault/upload`
  - Crear `threading.Thread(target=_graphify_background, daemon=True)`
  - Thread: copiar a temp, `_run_graphify`, `_merge_graph`, cleanup
  - Log errors, no crash
- [ ] **T6**: Añadir `graph_updated: false` a la respuesta de `/api/vault/upload`
  - Documentar que el grafo se actualiza en background

## Frontend

- [ ] **T7**: Cambiar `DEFAULT_MODELS.graphify` en `ModelosView.jsx` a `deepseek/deepseek-v4-flash`
- [ ] **T8**: Cambiar `DEFAULT_MODELS.graphify` en `WizardStepModels.jsx` a `deepseek/deepseek-v4-flash`
- [ ] **T9**: Cambiar `DEFAULT_MODELS.graphify` en `SetupWizard.jsx` a `deepseek/deepseek-v4-flash`

## Verificación

- [ ] **T10**: Rebuild backend + frontend
- [ ] **T11**: Subir archivo .md desde el chat → verificar que la respuesta es inmediata
- [ ] **T12**: Esperar 60s → `GET /api/graph/status` → verificar nodos nuevos
- [ ] **T13**: Cambiar modelo de graphify desde tab Modelos a otro → verificar que el próximo upload usa el nuevo modelo
- [ ] **T14**: Verificar que el grafo de estructura sigue funcionando
