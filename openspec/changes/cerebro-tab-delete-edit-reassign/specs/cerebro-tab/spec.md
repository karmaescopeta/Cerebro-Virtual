# specs/cerebro-tab/spec.md

## ADDED Requirements

### Requirement: Sincronización de grafo al eliminar archivos

El sistema SHALL sincronizar `graph.json` tras cualquier eliminación de archivos del vault.

#### Scenario: Eliminar último archivo de un proyecto
- GIVEN un proyecto "X" con 1 archivo en `raw/X/` y 0 en `outputs/X/`
- WHEN el usuario elimina ese archivo desde Raw, Outputs o Estructura
- THEN `graph.json` se sincroniza eliminando nodos huérfanos
- AND el proyecto "X" deja de aparecer en el grafo Estructura
- AND el proyecto "X" deja de aparecer en la leyenda del grafo

#### Scenario: Eliminar proyecto desde Estructura
- GIVEN un proyecto "X" con archivos en `outputs/X/`
- WHEN el usuario elimina el proyecto
- THEN `outputs/X/` se borra además de `raw/X/`
- AND `graph.json` se sincroniza

### Requirement: Confirmación al eliminar último archivo de un proyecto

El sistema SHALL mostrar un modal de confirmación cuando el usuario intenta eliminar el último archivo(s) de un proyecto.

#### Scenario: Último archivo detectado
- GIVEN el usuario ha seleccionado archivos para eliminar y al menos uno es el último de su proyecto
- WHEN el usuario hace clic en "Eliminar"
- THEN aparece un modal que dice "Este es el último archivo del proyecto [nombre]. ¿Eliminar también el proyecto o conservarlo vacío?"
- AND el modal ofrece dos botones: "Eliminar todo" y "Conservar proyecto"

#### Scenario: Usuario elige eliminar todo
- GIVEN el modal de confirmación de último archivo
- WHEN el usuario hace clic en "Eliminar todo"
- THEN el sistema ejecuta `DELETE /api/projects/{id}` para cada proyecto afectado
- AND el grafo se actualiza
- AND la lista de archivos se recarga

#### Scenario: Usuario elige conservar
- GIVEN el modal de confirmación de último archivo
- WHEN el usuario hace clic en "Conservar proyecto"
- THEN el sistema solo borra los archivos seleccionados
- AND el proyecto queda vacío (carpeta `raw/<id>/` sigue existiendo)
- AND el grafo se actualiza

#### Scenario: No es último archivo
- GIVEN el usuario elimina archivos pero ninguno es el último de su proyecto
- WHEN el usuario hace clic en "Eliminar"
- THEN el sistema procede con el confirm normal "¿Eliminar N archivo(s)?"
- AND no aparece el modal de último archivo

### Requirement: Editar nombres y colores

El sistema SHALL permitir editar nombres de archivos, nombres de proyectos y colores de proyectos desde el tab Cerebro > Estructura.

#### Scenario: Entrar en modo edición
- GIVEN el usuario está en Cerebro > Estructura
- WHEN el usuario hace clic en el botón "Editar"
- THEN los nombres de archivos y proyectos se convierten en inputs editables
- AND cada proyecto muestra un color picker inline
- AND el botón "Editar" cambia a "Guardar"

#### Scenario: Renombrar archivo
- GIVEN modo edición activado
- WHEN el usuario cambia el nombre de un archivo y hace clic en "Guardar"
- THEN el sistema ejecuta `PUT /api/vault/rename` con el nuevo nombre
- AND el archivo se mueve físicamente en el vault
- AND la wiki derivada se renombra
- AND `graph.json` actualiza el `source_file` del nodo
- AND el grafo se actualiza

#### Scenario: Renombrar proyecto
- GIVEN modo edición activado
- WHEN el usuario cambia el nombre de un proyecto y hace clic en "Guardar"
- THEN el sistema ejecuta `PUT /api/projects/{id}` con el nuevo nombre
- AND el grafo se actualiza

#### Scenario: Cambiar color de proyecto
- GIVEN modo edición activado
- WHEN el usuario cambia el color de un proyecto y hace clic en "Guardar"
- THEN el sistema ejecuta `PUT /api/projects/{id}` con el nuevo color
- AND el grafo se actualiza

### Requirement: Reasignar archivos entre proyectos

El sistema SHALL permitir mover archivos entre proyectos desde el tab Cerebro > Estructura.

#### Scenario: Reasignar un archivo
- GIVEN el usuario ha seleccionado 1+ archivos en Estructura
- WHEN el usuario hace clic en "Reasignar"
- THEN aparece un modal con un dropdown de proyectos destino
- WHEN el usuario selecciona un proyecto y confirma
- THEN el sistema ejecuta `POST /api/vault/reassign` con los archivos y el proyecto destino
- AND los archivos se mueven físicamente de `raw/<origen>/` a `raw/<destino>/` (igual con outputs)
- AND `graph.json` se actualiza
- AND el grafo se actualiza

#### Scenario: Reasignar a "Individual"
- GIVEN el modal de reasignación
- WHEN el usuario selecciona "Individual" como destino
- THEN los archivos se mueven a la raíz de `raw/` (sin subcarpeta de proyecto)