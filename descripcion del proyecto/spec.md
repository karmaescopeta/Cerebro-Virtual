# Spec: Cerebro Virtual

## ADDED Requirements

### Requirement: Vault Structure
The system SHALL maintain a vault with three top-level directories: `raw/` (immutable input), `wiki/` (processed knowledge), and `outputs/` (generated reports).

#### Scenario: New vault initialization
- GIVEN a fresh installation with no vault
- WHEN the system starts for the first time
- THEN the vault directories `raw/`, `raw/.processed/`, `wiki/`, `outputs/`, and `system/` are created

#### Scenario: File upload
- GIVEN a user uploading a file via chat drag-and-drop
- WHEN the file is received by the backend
- THEN the file is saved to `raw/chat/<filename>` and is immediately visible on the host filesystem

### Requirement: Multi-Model Support
The system SHALL support three model modes: `openrouter` (cloud), `local` (Ollama), and `mixed` (both).

#### Scenario: Mixed mode configuration
- GIVEN a user selecting "Mixed" in the wizard
- WHEN the user provides both an API key and hardware specs
- THEN the system saves `modelMode: "mixed"` with both OpenRouter and Ollama configs

#### Scenario: Toggle between modes
- GIVEN an agent configured in mixed mode
- WHEN the user toggles to local mode in settings
- THEN the system updates `agent-config.json` and restarts the agent

### Requirement: Kanban Task Delegation
The Coordinador SHALL create Kanban tasks only when delegation is needed, not for simple responses.

#### Scenario: File arrives in chat
- GIVEN a user uploads a file and sends a message
- WHEN the Coordinador receives the message
- THEN a Kanban task is created and assigned to the Sintetizador

#### Scenario: Simple question
- GIVEN a user asks "What is 2+2?"
- WHEN the Coordinador evaluates the question
- THEN no Kanban task is created and the Coordinador answers directly

### Requirement: Local IA Installation
The system SHALL block the UI during local model installation until models are ready.

#### Scenario: Install local models
- GIVEN a user clicks "Install IA Local" in settings
- WHEN model installation begins
- THEN a fullscreen overlay blocks all interaction and shows real-time progress
- AND when installation completes, the agent is automatically restarted
