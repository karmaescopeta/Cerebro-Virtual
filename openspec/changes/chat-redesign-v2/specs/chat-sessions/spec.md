## ADDED Requirements

### Requirement: Sesiones persistentes
El sistema SHALL almacenar sesiones de chat como archivos JSON individuales en `vault/chat-sesiones/`. Cada sesión contiene: `id` (UUID), `title` (auto-generado, editable), `messages` (array de `{role, content, context, timestamp}`), `createdAt`, `updatedAt`, `lastActive` (booleano para identificar la última sesión).

#### Scenario: Cargar última sesión al abrir tab Chat
- **WHEN** el usuario abre el tab Chat
- **THEN** el sistema carga automáticamente la sesión con `lastActive: true` y muestra sus mensajes

#### Scenario: Crear nueva sesión
- **WHEN** el usuario clicka "Nuevo chat" en el panel de sesiones
- **THEN** el sistema crea una sesión vacía con UUID, la marca como `lastActive: true` (desmarca la anterior), y la carga en el chat

#### Scenario: Auto-generar título
- **WHEN** el usuario envía el primer mensaje de una sesión sin título
- **THEN** el sistema genera un título automático desde los primeros 40 caracteres del mensaje

#### Scenario: Editar título
- **WHEN** el usuario edita el título de una sesión
- **THEN** el sistema actualiza `title` y `updatedAt` en el JSON

#### Scenario: Eliminar sesión
- **WHEN** el usuario elimina una sesión
- **THEN** el sistema borra el archivo JSON de `vault/chat-sesiones/`. Los archivos/investigaciones ya añadidas al cerebro NO se borran.

#### Scenario: Exportar/importar sesiones
- **WHEN** el usuario exporta el vault
- **THEN** la carpeta `chat-sesiones/` se incluye en el `.tar.gz`

### Requirement: Panel de sesiones
El sistema SHALL mostrar un botón "Chats" arriba-izquierda del tab Chat. Al clickar, aparece un panel lateral izquierdo con el listado de todas las sesiones ordenadas por `updatedAt` descendente.

#### Scenario: Abrir panel de sesiones
- **WHEN** el usuario clicka "Chats"
- **THEN** se muestra el panel lateral con todas las sesiones (título + fecha). Click en una sesión la carga en el chat.

#### Scenario: Crear sesión desde panel
- **WHEN** el usuario clicka "Nuevo chat" en el panel
- **THEN** se crea una sesión vacía y se carga

#### Scenario: Eliminar sesión desde panel
- **WHEN** el usuario clicka eliminar en una sesión del panel
- **THEN** se borra la sesión y se carga la siguiente disponible (o se crea una vacía si no hay más)

### Requirement: Endpoints de sesiones
El sistema SHALL exponer endpoints REST para gestionar sesiones.

#### Scenario: Listar sesiones
- **WHEN** `GET /api/chat/sessions`
- **THEN** devuelve `{sessions: [{id, title, createdAt, updatedAt, lastActive}]}` ordenadas por `updatedAt` desc

#### Scenario: Crear sesión
- **WHEN** `POST /api/chat/sessions`
- **THEN** crea sesión vacía con UUID, la marca `lastActive: true`, devuelve `{id, title, createdAt}`

#### Scenario: Obtener sesión
- **WHEN** `GET /api/chat/sessions/{id}`
- **THEN** devuelve `{id, title, messages, createdAt, updatedAt}`

#### Scenario: Actualizar sesión
- **WHEN** `PUT /api/chat/sessions/{id}` con body `{title?, messages?, lastActive?}`
- **THEN** actualiza los campos proporcionados y `updatedAt`

#### Scenario: Eliminar sesión
- **WHEN** `DELETE /api/chat/sessions/{id}`
- **THEN** borra el archivo JSON. Si era `lastActive`, marca la siguiente como activa.

#### Scenario: Marcar última activa
- **WHEN** el usuario abre una sesión
- **THEN** el sistema desmarca `lastActive` en todas las demás y la marca en esta
