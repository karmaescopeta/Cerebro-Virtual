## MODIFIED Requirements

### Requirement: Guardar output en proyecto correcto
El sistema SHALL guardar el documento en el proyecto seleccionado por el usuario. Cuando el usuario crea un proyecto nuevo desde el popup "Añadir al cerebro", el archivo MUST guardarse en ese proyecto nuevo, no en `individual`.

#### Scenario: Crear proyecto nuevo y guardar
- **WHEN** el usuario selecciona "Crear proyecto", ingresa nombre, descripción, color, y hace clic en "Añadir al cerebro"
- **THEN** el frontend crea el proyecto vía `POST /api/projects`, obtiene el `id` del proyecto creado
- **THEN** el frontend pasa ese `id` a `onSaveOutput` como `projectId`
- **THEN** el backend guarda el archivo en `outputs/<project_id>/` (no en `outputs/individual/`)

#### Scenario: Guardar en proyecto existente
- **WHEN** el usuario selecciona un proyecto existente del dropdown
- **THEN** el archivo se guarda en `outputs/<project_id>/` de ese proyecto (sin cambios)
