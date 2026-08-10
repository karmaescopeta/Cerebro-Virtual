# Design: Modelos Tab

## Profile map
| Display default | Key | Perfil real |
|---|---|---|
| Sistema Base | coordinador | hermes-coordinador |
| Editor | editor | hermes-editor |
| Indexador | indexador | hermes-indexador |
| Sintetizador | sintetizador | hermes-sintetizador |
| Investigador | investigador | hermes-investigador-resumidor |

`profileNames` en agent-config.json guarda nombres custom. Default si no existe.

## Endpoints

`GET /api/profiles/models` → `{profiles: [{key, name, model}]}`. Lee agent-config.json `models` + `profileNames`.

`PUT /api/profiles/models` → body `{models: {key: url}, profileNames: {key: name}}`. Guarda en agent-config.json. `docker restart cerebro-agente`. Espera readiness. Retorna `{success, changes: [{name, oldModel, newModel}]}`.

## UI
- Tarjetas grid 2 columnas (responsive 1 col mobile).
- Cada tarjeta: `.card` existente. Header: nombre perfil (mono, primary). Body: URL modelo (mono, secondary). En modo edición: 2 inputs `.input-app`.
- Header de página: title "Modelos" + botón Editar/Guardar.
- Overlay: `.modelos-overlay` fixed full-screen, blur backdrop, spinner + texto "Reiniciando agente...".

## Flow
1. GET models → render tarjetas (read-only).
2. Editar → inputs editables.
3. Guardar → PUT → overlay → resumen.