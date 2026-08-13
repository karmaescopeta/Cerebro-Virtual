# Delta Spec: mcp-pipe-bridge

## ADDED Requirements

### Requirement: Pipe-Bridge Transport for Windows MCP Servers
El sistema SHALL proporcionar un transporte alternativo para servidores MCP stdio en Windows que no funcionan con el transporte asyncio nativo (`anyio.open_process` / `asyncio.create_subprocess_exec` con ProactorEventLoop).

#### Scenario: Servidor MCP Go binario en Windows
- GIVEN un servidor MCP stdio compilado como binario Go para Windows
- AND el transporte asyncio nativo falla con timeout silencioso al leer stdout
- WHEN el usuario configura `transport: pipe-bridge` en `mcp_servers.<name>`
- THEN el sistema usa `subprocess.Popen` con threads para stdin/stdout en lugar de `anyio.open_process`
- AND las herramientas MCP se registran y funcionan igual que con el transporte nativo

#### Scenario: Detección automática de fallo
- GIVEN un servidor MCP stdio en Windows sin `transport: pipe-bridge` explícito
- WHEN la conexión asyncio nativa falla con timeout o CancelledError
- THEN el sistema reintenta automáticamente una vez con transporte pipe-bridge
- AND si pipe-bridge funciona, registra el servidor y marca el transporte para uso futuro

### Requirement: API Compatible con MCP ClientSession
El transporte pipe-bridge SHALL exponer los mismos memory streams (`MemoryObjectSendStream` / `MemoryObjectReceiveStream`) que `stdio_client` del SDK MCP, de forma que `ClientSession` funcione sin modificaciones.

#### Scenario: Handshake MCP completo
- GIVEN un transporte pipe-bridge conectado a un servidor MCP stdio
- WHEN se llama `session.initialize()` y `session.list_tools()`
- THEN el handshake JSON-RPC se completa correctamente
- AND las herramientas se descubren y registran

### Requirement: Limpieza de Procesos
El transporte pipe-bridge SHALL terminar el proceso hijo y los threads de lectura al cerrar la sesión, sin dejar procesos huérfanos.

#### Scenario: Shutdown limpio
- GIVEN una sesión MCP activa con transporte pipe-bridge
- WHEN se llama `shutdown()` o se cierra el context manager
- THEN el proceso hijo se termina (TerminateProcess en Windows)
- AND los threads de lectura de stdout/stderr se cierran
- AND los memory streams se cierran sin bloquear
