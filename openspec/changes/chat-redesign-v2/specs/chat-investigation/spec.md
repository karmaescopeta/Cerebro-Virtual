## ADDED Requirements

### Requirement: Modo selección de investigación
El sistema SHALL activar un modo selección al clickar "Investigar". En este modo, cada mensaje muestra un checkbox.

#### Scenario: Activar modo investigación
- **WHEN** el usuario clicka "Investigar"
- **THEN** aparece un checkbox junto a cada mensaje (user y assistant). El botón cambia a "Investigar (N)" mostrando cuántos están seleccionados.

#### Scenario: Seleccionar mensajes
- **WHEN** el usuario marca 1 o más checkboxes
- **THEN** el botón muestra "Investigar (N)" con el número de seleccionados

#### Scenario: Ejecutar investigación
- **WHEN** el usuario clicka "Investigar (N)" con mensajes seleccionados
- **THEN** el backend combina los mensajes seleccionados como contexto, invoca perfil `investigador`, y genera documento Markdown

#### Scenario: Salir del modo selección
- **WHEN** el usuario clicka "Cancelar" o desactiva "Investigar"
- **THEN** los checkboxes desaparecen y el chat vuelve a modo normal

### Requirement: Resultado de investigación
El sistema SHALL mostrar el resultado de la investigación con 3 botones de acción.

#### Scenario: Descargar investigación
- **WHEN** el usuario clicka "Descargar"
- **THEN** se descarga un archivo `.md` con el contenido de la investigación

### Requirement: Vista previa mejorada
El sistema SHALL renderizar Markdown con soporte para code blocks, tablas, inline formatting (**bold**, `code`, [[wikilinks]]), listas, y headers.

#### Scenario: Vista previa con code blocks
- **WHEN** el documento contiene bloques de código ``` ```
- **THEN** se renderizan con sintaxis resaltada y fondo oscuro

#### Scenario: Vista previa con wikilinks
- **WHEN** el documento contiene [[wikilink]]
- **THEN** se renderiza como enlace azul clickeable

### Requirement: Añadir al cerebro
El sistema SHALL mostrar un popup al clickar "Añadir" con campos: nombre, descripción, asignación a proyecto.

#### Scenario: Añadir con nombre personalizado
- **WHEN** el usuario escribe un nombre en el campo
- **THEN** el archivo se guarda con ese nombre + `.md`

#### Scenario: Añadir con nombre por defecto
- **WHEN** el usuario deja el nombre vacío
- **THEN** el sistema genera un nombre automático basado en el contenido

#### Scenario: Asignar a proyecto existente
- **WHEN** el usuario selecciona "Proyecto existente" y elige un proyecto del desplegable
- **THEN** el documento se guarda en `outputs/<project_id>/<name>.md` + `wiki/<stem>.md` + Graphify

#### Scenario: Crear proyecto nuevo
- **WHEN** el usuario selecciona "Crear proyecto" y rellena nombre + descripción + color
- **THEN** se crea el proyecto via `POST /api/projects`, el documento se asigna a ese proyecto

### Requirement: Persistencia de archivos añadidos
El sistema SHALL conservar los archivos e investigaciones añadidas al cerebro cuando se elimina la sesión de chat que las generó.

#### Scenario: Eliminar sesión preserva archivos
- **WHEN** el usuario elimina una sesión que generó investigaciones añadidas al cerebro
- **THEN** las investigaciones en `outputs/` y `wiki/` se conservan
