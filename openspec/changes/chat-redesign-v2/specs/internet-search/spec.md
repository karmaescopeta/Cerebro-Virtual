## ADDED Requirements

### Requirement: SearXNG local
El sistema SHALL ejecutar SearXNG self-hosted en el contenedor `cerebro-herramientas` o como servicio separado en docker-compose.

#### Scenario: SearXNG disponible
- **WHEN** el contenedor de herramientas arranca
- **THEN** SearXNG está disponible en `http://localhost:8888` (o puerto interno) con API JSON habilitada

### Requirement: Endpoint de búsqueda
El backend SHALL exponer un endpoint interno para buscar en internet via SearXNG.

#### Scenario: Búsqueda básica
- **WHEN** el backend recibe una query de búsqueda
- **THEN** consulta `http://searxng:8888/search?q=<query>&format=json` y devuelve los top 5 resultados con título, URL y snippet

### Requirement: Integración en chat sin Cerebro
Cuando Cerebro está OFF, el backend SHALL consultar SearXNG antes de enviar el mensaje al modelo.

#### Scenario: Chat normal con resultados web
- **WHEN** el usuario envía un mensaje sin Cerebro
- **THEN** el backend busca en SearXNG, combina los resultados con el mensaje, y envía al modelo con instrucción de usar los resultados como contexto

### Requirement: Integración en chat con Cerebro + Internet
Cuando Cerebro ON + Internet ON, el backend SHALL buscar en vault primero y en SearXNG después.

#### Scenario: Vault tiene info + internet
- **WHEN** Cerebro ON + Internet ON y el vault tiene información
- **THEN** el backend busca en el grafo/vault, genera respuesta del cerebro, busca en SearXNG, genera resumen de internet, combina ambas en respuesta dividida

#### Scenario: Vault sin info + internet
- **WHEN** Cerebro ON + Internet ON y el vault NO tiene información
- **THEN** el backend responde "sin resultados en cerebro" para la sección 🧠, busca en SearXNG, genera resumen para la sección 🌐
