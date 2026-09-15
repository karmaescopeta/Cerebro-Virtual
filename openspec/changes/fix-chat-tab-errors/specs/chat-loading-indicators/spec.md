## ADDED Requirements

### Requirement: Contextual loading messages
El sistema SHALL mostrar un mensaje de carga diferente según el modo activo:
- Modo default (chat normal): "Pensando..."
- Chat inteligente (smart): "Pensamiento profundo..."
- Cerebro (con o sin internet): "Buscando en mi cerebro..."
- Modo Investigar: "Investigando..."

#### Scenario: Default mode loading
- **WHEN** user sends a message in default mode
- **THEN** system displays "Pensando..." with spinner

#### Scenario: Smart mode loading
- **WHEN** user sends a message with Chat inteligente ON
- **THEN** system displays "Pensamiento profundo..." with spinner

#### Scenario: Cerebro mode loading
- **WHEN** user sends a message with Cerebro ON
- **THEN** system displays "Buscando en mi cerebro..." with spinner

#### Scenario: Investigate mode loading
- **WHEN** user triggers an investigation
- **THEN** system displays "Investigando..." with spinner
