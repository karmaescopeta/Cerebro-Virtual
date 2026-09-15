## MODIFIED Requirements

### Requirement: Chat message sending
El sistema SHALL añadir el mensaje del usuario al chat inmediatamente al presionar Enter o el botón Enviar (optimistic UI), antes de recibir la respuesta del backend. La respuesta del assistant se añade cuando el backend responde.

#### Scenario: User sends message
- **WHEN** user types a message and presses Enter or clicks Send
- **THEN** the user message appears immediately in the chat
- **AND** the input field clears
- **AND** loading indicator appears
- **AND** assistant response is added when backend returns
