## ADDED Requirements

### Requirement: Investigate directly from input
El sistema SHALL permitir que en modo Investigar, presionar Enter con texto en el input envíe el texto directamente a investigar (no a chat normal). No requiere enviar el mensaje primero ni seleccionarlo después.

#### Scenario: Enter in investigate mode with text
- **WHEN** investigation mode is ON and user types text and presses Enter
- **THEN** system calls investigate with the typed text as the message
- **AND** clears the input field

#### Scenario: Enter in investigate mode without text but with selections
- **WHEN** investigation mode is ON, input is empty, and messages are selected
- **THEN** system calls investigate with the selected messages

### Requirement: Visual highlight of selected messages
El sistema SHALL aplicar un fondo de color distintivo a los mensajes seleccionados en modo Investigar para identificación visual inmediata.

#### Scenario: Message selected
- **WHEN** user selects a message in investigation mode
- **THEN** the message bubble gets a highlighted background color (e.g. primary with low opacity)
- **AND** the checkbox reflects checked state

#### Scenario: Message deselected
- **WHEN** user deselects a message
- **THEN** the message bubble returns to its normal background

### Requirement: Investigate does not hang
El sistema SHALL completar una investigación en menos de 120 segundos. Si el backend no responde en ese tiempo, el sistema SHALL mostrar un mensaje de timeout y liberar el estado de carga.

#### Scenario: Investigation completes
- **WHEN** user triggers an investigation
- **THEN** system calls /api/chat/investigate
- **AND** receives a response within 120 seconds
- **AND** displays the summary in chat with full doc available

#### Scenario: Investigation times out
- **WHEN** investigation takes longer than 120 seconds
- **THEN** system displays "⏱️ La investigación tardó demasiado."
- **AND** releases the loading state

### Requirement: Multi-message investigation with directive summary
El sistema SHALL, cuando se seleccionan múltiples mensajes para investigar, generar un resumen de los puntos clave y directrices a partir de esos mensajes antes de producir el documento completo. Este resumen sirve como contexto para la investigación.

#### Scenario: Multiple messages selected
- **WHEN** user selects 2+ messages and triggers investigation
- **THEN** backend extracts key points from the selected messages
- **AND** uses them as directive context for the investigation prompt
- **AND** generates the full document

#### Scenario: Single message investigation
- **WHEN** user selects 1 message or types text directly
- **THEN** backend investigates that single topic without summary step
