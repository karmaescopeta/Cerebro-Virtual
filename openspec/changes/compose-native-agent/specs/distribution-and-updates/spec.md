## ADDED Requirements

### Requirement: Clean base repository
The repository SHALL be distributable as a clean base. No API keys, no vault data, no user configurations, no test artifacts. `.env`, `vault/` contents, `.venv/`, `node_modules/`, `__pycache__/`, and `.hermes/` SHALL be gitignored. Only `.gitkeep` files in vault subdirectories SHALL be tracked to preserve structure.

#### Scenario: User clones fresh repo
- GIVEN a clean clone of the repository
- WHEN the user runs `start.bat`
- THEN `.env` is created from `.env.example`
- AND vault directories exist (raw/, wiki/, outputs/, system/, chat-sesiones/)
- AND no API keys, chat sessions, or user data exist
- AND the wizard starts for first-time configuration

### Requirement: Version notification banner
The system SHALL display a banner when a newer version is available on GitHub. The banner SHALL include a link to the release notes and a "No molestar" button. Dismissing the banner SHALL suppress it for 7 days (stored in localStorage). The system SHALL NOT auto-update.

#### Scenario: New version available
- GIVEN a running cerebro instance at version 1.0.0
- WHEN the frontend detects GitHub release v1.1.0
- THEN a banner appears: "Nueva versión disponible: v1.1.0"
- AND a link to the release notes is shown
- AND a "No molestar" button is shown

#### Scenario: User dismisses banner
- GIVEN the banner is showing
- WHEN the user clicks "No molestar"
- THEN the banner disappears
- AND it does not reappear for 7 days
- AND after 7 days, if a newer version still exists, the banner reappears

#### Scenario: User updates manually
- GIVEN a user with version 1.0.0 and version 1.1.0 available
- WHEN the user runs `git pull` and `start.bat`
- THEN the system updates to 1.1.0
- AND the banner no longer appears

### Requirement: Vault backward compatibility
The system SHALL ensure vault data (markdown files, `agent-config.json`, `agent-keys.json`) remains compatible across versions. New config fields SHALL have defaults. No existing field SHALL be removed or renamed. If schema migration is needed, the backend SHALL perform it silently on startup.

#### Scenario: Old vault with new code
- GIVEN a vault created with version 1.0.0
- WHEN the user updates to version 2.0.0
- THEN all markdown files in wiki/ and outputs/ remain readable
- AND `agent-config.json` is read with defaults for any new fields
- AND `agent-keys.json` is read with defaults for any new fields
- AND the cerebro starts without errors

#### Scenario: New vault with old code (downgrade)
- GIVEN a vault created with version 2.0.0
- WHEN the user downgrades to version 1.0.0
- THEN the cerebro starts
- AND old code ignores unknown fields in config JSON
- AND no data is lost

### Requirement: Hermes agent version pinned at build time
The system SHALL NOT auto-update Hermes inside the agent container. The Dockerfile SHALL install the Hermes version available at build time. To update Hermes, the user SHALL manually run `docker compose build --no-cache sistema-agente`.

#### Scenario: Normal operation
- GIVEN a running cerebro instance
- WHEN Hermes releases a new version
- THEN the cerebro continues running the pinned Hermes version
- AND no auto-update occurs

#### Scenario: Manual Hermes update
- GIVEN a running cerebro instance
- WHEN the user runs `docker compose build --no-cache sistema-agente` and `docker compose up -d sistema-agente`
- THEN the agent image is rebuilt with the latest Hermes
- AND the cerebro restarts with the new Hermes version