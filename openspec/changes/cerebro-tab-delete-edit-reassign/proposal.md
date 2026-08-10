# Cerebro Tab: Delete Confirmation, Edit, Reassign

## Context

Bug: al eliminar el último archivo de un proyecto desde Raw/Outputs/Estructura, el proyecto se elimina de `projects.json` (porque `list_projects` filtra los que no tienen carpeta `raw/<id>/`) pero el grafo Estructura (`/api/wiki/graph`) sigue mostrando el nodo del proyecto porque su filtro es `has_raw or has_outputs` — y `delete_project` NO borra la carpeta `outputs/<id>/` (solo borra `raw/<id>/`). Además `_sync_graph_json` no se llama tras delete, así que los nodos de archivos borrados pueden persistir en `graph.json`.

## Scope

3 cambios en tab Cerebro:

1. **Bug fix: grafo obsoleto tras eliminar último archivo de un proyecto**
   - `delete_project` debe borrar `outputs/<id>/` además de `raw/<id>/`
   - `batch_delete` debe llamar `_sync_graph_json()` al final
   - Frontend ya llama `onRefreshGraph` tras delete, pero el backend no sincronizaba `graph.json`

2. **Feature: confirmación al eliminar último archivo de un proyecto**
   - Al borrar archivo(s) desde Raw/Outputs/Estructura, si algún archivo es el último de su proyecto → modal de confirmación
   - Modal dice: "Este es el último archivo del proyecto X. ¿Eliminar también el proyecto o conservarlo vacío?"
   - Si "Eliminar todo" → `DELETE /api/projects/{id}` (borra proyecto + archivos + graph sync)
   - Si "Conservar" → solo borra el archivo, proyecto queda vacío (carpeta `raw/<id>/` sigue existiendo)
   - Ambas opciones actualizan grafo

3. **Feature: editar nombres y colores + reasignar archivos**
   - Botón "Editar" junto a "Añadir archivos" en Estructura
   - Editar permite: renombrar archivos, renombrar proyectos, cambiar color de proyecto
   - Botón "Reasignar" permite mover archivo(s) de un proyecto a otro
   - Todos los cambios disparan `onRefreshGraph` para actualizar tab Grafo

## Approach

### Backend
- `delete_project`: añadir borrado de `outputs/<id>/`
- `batch_delete`: llamar `_sync_graph_json()` al final
- Nuevo endpoint `PUT /api/vault/rename` — renombrar archivo (mueve raw/output + wiki + actualiza graph.json source_file)
- Nuevo endpoint `PUT /api/projects/{id}` — ya existe, ampliar para aceptar `name`
- Nuevo endpoint `POST /api/vault/reassign` — mover archivo(s) entre proyectos (mueve raw/output, actualiza graph.json)

### Frontend
- `CerebroView.jsx`:
  - Detectar último archivo de proyecto antes de borrar → mostrar modal confirmación
  - Botón "Editar" → entra en modo edición inline (inputs en lugar de spans)
  - Botón "Reasignar" → modal con dropdown de proyecto destino
- `App.jsx`: `handleCerebroDelete` ampliado para soportar confirmación de último archivo

## Out of scope
- Drag-and-drop para reasignar (YAGNI, botón es suficiente)
- Renombrar carpetas anidadas (no existen, estructura es plana por proyecto)
- Versionado de archivos