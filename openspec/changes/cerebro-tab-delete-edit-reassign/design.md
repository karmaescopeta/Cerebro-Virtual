# Design — Cerebro Tab: Delete Confirmation, Edit, Reassign

## Bug root cause

`delete_project` (línea 2059) solo borra `raw/<id>/`, no `outputs/<id>/`. El grafo Estructura (`/api/wiki/graph`) muestra proyecto si `has_raw or has_outputs`. Tras eliminar proyecto, `outputs/<id>/` sigue existiendo → nodo del proyecto persiste en el grafo.

`batch_delete` (línea 1907) llama `_delete_vault_item` por cada archivo, que a su vez llama `_prune_graph_json` por archivo. Pero `_sync_graph_json` (que limpia nodos huérfanos por source_file inexistente) NO se llama tras batch_delete. Si un archivo se borra pero `_prune_graph_json` no lo encuentra por nombre exacto, el nodo queda huérfano.

## Fix

1. `delete_project`: añadir borrado de `outputs/<id>/` con misma lógica que `raw/<id>/` (iterar archivos, `_delete_vault_item`, rmtree si vacío).
2. `batch_delete`: llamar `_sync_graph_json()` al final del loop.

## Confirmación de último archivo

Frontend detecta último archivo antes de enviar batch-delete. Lógica:
- Para cada item seleccionado, obtener `project_id` del path (primer segmento del path antes de `/`).
- Si `project_id` no está en `projects` del frontend → es "individual", no aplica confirmación.
- Contar archivos restantes del proyecto (raw + outputs) después de eliminar los seleccionados.
- Si el conteo llega a 0 para algún proyecto → mostrar modal.

Modal ofrece 2 opciones:
- "Eliminar todo" → `DELETE /api/projects/{id}` por cada proyecto vacío, luego `batch-delete` para archivos de proyectos no vacíos.
- "Conservar" → `batch-delete` normal.

## Editar nombres y colores

Modo edición inline en CerebroView. Botón "Editar" alterna entre vista y edición:
- Archivos: `<input>` con nombre. Al guardar, `PUT /api/vault/rename {category, oldPath, newName}`.
- Proyectos: `<input>` con nombre + `<input type="color">` con color. Al guardar, `PUT /api/projects/{id} {name, color}`.

Backend `PUT /api/vault/rename`:
- Mueve archivo en raw/ o outputs/
- Renombra `.txt` hermano si existe
- Renombra wiki `<stem>.md` → `<newStem>.md`
- Actualiza `source_file` en graph.json (cambia `target.name` → `newName` en todos los nodos con ese source_file)

Backend `PUT /api/projects/{id}` ampliado: añadir campo `name` al `ProjectUpdate` model.

## Reasignar archivos

Modal con dropdown de proyectos destino. Backend `POST /api/vault/reassign`:
- Recibe `{items: [{category, path}], targetProject: "id"}`
- Para cada item: mueve archivo de `raw/<origen>/<file>` a `raw/<target>/<file>` (igual outputs)
- Si target es "individual", mueve a `raw/<file>` (raíz)
- `graph.json` no necesita cambios (source_file = nombre del archivo, no cambia)
- Crea `raw/<target>/` si no existe

## API changes

| Method | Endpoint | Body | Descripción |
|--------|----------|------|-------------|
| PUT | `/api/vault/rename` | `{category, path, newName}` | Renombrar archivo + wiki + graph |
| PUT | `/api/projects/{id}` | `{name?, color?, description?}` | Ya existe, ampliar con `name` |
| POST | `/api/vault/reassign` | `{items, targetProject}` | Mover archivos entre proyectos |
| DELETE | `/api/projects/{id}` | — | Fix: ahora borra outputs/ también |
| POST | `/api/vault/batch-delete` | `[{category, path}]` | Fix: ahora llama `_sync_graph_json` |