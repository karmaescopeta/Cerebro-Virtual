## ADDED Requirements

### Requirement: Agent managed exclusively by docker compose
The system SHALL manage the agent container exclusively through `docker compose`. The backend MUST NOT create agent containers via Docker SDK (`client.containers.run()`) or `docker run`.

#### Scenario: Fresh deploy with start.bat
- GIVEN a clean host with Docker installed and `.env` configured with `COMPOSE_PROJECT_NAME`
- WHEN the user runs `start.bat`
- THEN all services (backend, frontend, sistema-agente, searxng, herramientas) start as containers under the same compose project
- AND the agent container appears in `docker compose ps` as part of the project

#### Scenario: Reset agent configuration
- GIVEN a running cerebro instance with the agent configured
- WHEN the user triggers "Reestablecer configuración" (DELETE `/api/init/reset`)
- THEN the backend stops the agent service via `docker compose stop sistema-agente`
- AND local config files are deleted
- AND the agent container remains managed by compose (stopped, not removed)
- AND no standalone container is created outside the compose project

#### Scenario: Restart agent after config change
- GIVEN a running cerebro instance with the agent stopped after reset
- WHEN the user completes the wizard and calls POST `/api/agent/start`
- THEN the backend starts the agent service via `docker compose start sistema-agente`
- AND the agent entrypoint detects the new config and bootstraps Hermes
- AND the agent becomes reachable at its internal service DNS name

#### Scenario: Full restart with image rebuild
- GIVEN a running cerebro instance
- WHEN the user calls POST `/api/agent/full-restart`
- THEN the backend runs `docker compose up -d --force-recreate sistema-agente`
- AND the agent image is rebuilt with `docker compose build --no-cache sistema-agente`
- AND the new container is part of the compose project

### Requirement: No hardcoded container names
The system MUST NOT reference containers by hardcoded `container_name` values. All container references in backend code SHALL use compose service names (resolved via Docker DNS) or `docker compose exec` commands scoped to the project.

#### Scenario: Backend communicates with agent
- GIVEN a running cerebro instance
- WHEN the backend needs to execute a command inside the agent (e.g., `hermes chat`)
- THEN it uses `docker compose exec sistema-agente <command>` or the internal DNS name `sistema-agente:8080`
- AND no hardcoded `cerebro-agente` name appears in the command

#### Scenario: Backend discovers its own vault mount
- GIVEN a running cerebro instance
- WHEN the backend needs the host path of the vault volume
- THEN it reads the mount info from its own container inspect data (via Docker SDK `containers.get` using the compose-generated name pattern `<project>-backend-1`)
- OR it reads the path from an environment variable set in the compose file

### Requirement: Agent waits for config on compose start
The agent entrypoint SHALL wait for configuration to exist before bootstrapping Hermes. If the config file does not exist when the container starts, the entrypoint MUST sleep and retry until the file appears.

#### Scenario: Agent starts before wizard completes
- GIVEN a fresh deploy where `start.bat` has just been run
- WHEN the agent container starts and no `agent-config.json` exists
- THEN the agent entrypoint prints "Esperando configuración..." and sleeps
- AND the container stays running (not crashed)
- AND when the wizard saves config, the agent detects it and continues bootstrapping
