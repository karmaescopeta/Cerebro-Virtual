## ADDED Requirements

### Requirement: Version Comparison
El sistema SHALL comparar versiones locales vs remotas para Cerebro Virtual y Hermes Agent al cargar la página.

#### Scenario: Cerebro Virtual update disponible
- GIVEN el repo local de Cerebro Virtual en `C:\proyectoBueno\cerebro virtual`
- WHEN el frontend llama `GET /api/updates/check`
- THEN el backend compara `VERSION` local vs latest release tag en GitHub `karmaescopeta/Cerebro-Virtual`
- AND retorna `{"cerebro": {"current": "1.0.0", "latest": "1.1.0", "update": true}}`

#### Scenario: Hermes Agent update disponible
- GIVEN el contenedor `sistema-agente` corriendo
- WHEN el frontend llama `GET /api/updates/check`
- THEN el backend ejecuta `hermes --version` en el contenedor para obtener versión instalada
- AND compara con latest release tag en GitHub `NousResearch/hermes-agent`
- AND retorna `{"hermes": {"current": "0.9.0", "latest": "0.10.0", "update": true}}`

#### Scenario: Sin updates
- GIVEN ambas versiones locales coinciden con latest remoto
- WHEN el frontend llama `GET /api/updates/check`
- THEN retorna `update: false` para ambos

#### Scenario: Error de red o rate limit
- GIVEN GitHub API no responde o rate limit exceeded
- WHEN el frontend llama `GET /api/updates/check`
- THEN retorna `{"error": "github-unavailable"}` sin crash
