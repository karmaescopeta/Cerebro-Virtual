## ADDED Requirements

### Requirement: Unified access credential
The system SHALL use a single credential (username + password), set in the setup wizard, to grant access to both the Hermes agent panel (:8080) and the OmniRoute dashboard (:20128).

#### Scenario: Wizard sets both panels
- **GIVEN** a user completing the setup wizard with username `admin` and password `secret1`
- **WHEN** the wizard submits `/api/init/configure`
- **THEN** `agent-config.json.dashboard` contains user `admin` and password `secret1`
- **AND** `.env` contains `OMNIROUTE_MANAGE_PASSWORD=secret1`
- **AND** the omniroute container is recreated with the new `INITIAL_PASSWORD`
- **AND** login on :8080 with `admin`/`secret1` succeeds
- **AND** login on :20128 with password `secret1` succeeds

#### Scenario: Change credential from Settings
- **GIVEN** the system is configured with password `secret1`
- **WHEN** the user saves a new password `secret2` from the Settings access section
- **THEN** both panels reject `secret1` and accept `secret2` after recreation

#### Scenario: OmniRoute link opens working dashboard
- **GIVEN** the Models tab
- **WHEN** the user clicks the OmniRoute panel link
- **THEN** the browser opens `http://<host>:20128` showing the OmniRoute login/dashboard
