# Tasks — Cerebro Tab: Delete Confirmation, Edit, Reassign

## Bug fix: grafo obsoleto

- [ ] 1.1 `delete_project`: borrar `outputs/<id>/` además de `raw/<id>/`
- [ ] 1.2 `batch_delete`: llamar `_sync_graph_json()` al final
- [ ] 1.3 Verificar: eliminar último archivo de proyecto → grafo actualizado, sin nodo fantasma en leyenda ni pantalla

## Feature: confirmación último archivo

- [ ] 2.1 Backend: `GET /api/projects/{id}/file-count` — devuelve count de archivos raw+outputs de un proyecto
- [ ] 2.2 Frontend `CerebroView`: detectar último archivo antes de `handleCerebroDelete`
- [ ] 2.3 Frontend: modal confirmación con "Eliminar todo" y "Conservar proyecto"
- [ ] 2.4 Frontend: "Eliminar todo" → `DELETE /api/projects/{id}` por cada proyecto vacío
- [ ] 2.5 Frontend: "Conservar" → batch-delete normal
- [ ] 2.6 Verificar: ambos caminos actualizan grafo + lista

## Feature: editar nombres y colores

- [ ] 3.1 Backend: `PUT /api/vault/rename` — mueve archivo + wiki + actualiza graph.json source_file
- [ ] 3.2 Backend: ampliar `ProjectUpdate` con campo `name`
- [ ] 3.3 Frontend: botón "Editar" junto a "Añadir archivos" en Estructura
- [ ] 3.4 Frontend: modo edición inline (inputs para nombres, color picker para proyectos)
- [ ] 3.5 Frontend: botón "Guardar" ejecuta renames + project updates
- [ ] 3.6 Verificar: renombrar archivo → grafo actualizado, renombrar proyecto → grafo actualizado, cambiar color → grafo actualizado

## Feature: reasignar archivos

- [ ] 4.1 Backend: `POST /api/vault/reassign` — mueve archivos entre proyectos
- [ ] 4.2 Frontend: botón "Reasignar" en Estructura (visible cuando hay selección)
- [ ] 4.3 Frontend: modal con dropdown de proyecto destino + confirmación
- [ ] 4.4 Frontend: ejecuta reassign + reload + refresh graph
- [ ] 4.5 Verificar: reasignar archivo → aparece en nuevo proyecto, grafo actualizado

## Verificación final

- [ ] 5.1 Rebuild Docker completo desde cero
- [ ] 5.2 Test navegador: eliminar último archivo → grafo correcto
- [ ] 5.3 Test navegador: editar nombre archivo → grafo correcto
- [ ] 5.4 Test navegador: editar nombre + color proyecto → grafo correcto
- [ ] 5.5 Test navegador: reasignar archivo → aparece en proyecto destino, grafo correcto