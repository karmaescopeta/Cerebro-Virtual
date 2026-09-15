# ui-navigation Specification

## Purpose
TBD - created by archiving change ui-fixes-y-unified-password. Update Purpose after archive.
## Requirements
### Requirement: UI chrome limpio
The app header SHALL NOT display a system-health badge, the sidebar SHALL NOT display a logout button, and the sidebar SHALL display the real application version from `/api/version` (matching the git tag / VERSION file).

#### Scenario: Version matches repository
- **GIVEN** VERSION file contains `1.0.0`
- **WHEN** the app shell renders
- **THEN** the sidebar shows `v1.0.0` (no hardcoded value)

#### Scenario: No dead controls
- **WHEN** the app shell renders
- **THEN** no SYSTEM HEALTHY badge is shown in the header and no LOGOUT button is shown in the sidebar

