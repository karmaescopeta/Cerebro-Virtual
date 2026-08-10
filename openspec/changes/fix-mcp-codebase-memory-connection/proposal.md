## Why

Hermes Agent no puede conectar con `codebase-memory-mcp` en Windows. El servidor MCP (binario Go v0.9.0) funciona correctamente — responde al handshake JSON-RPC en <1s vía `subprocess.Popen` sync. Pero `asyncio.create_subprocess_exec` (ProactorEventLoop, único event loop que soporta subprocess en Windows) no logra leer stdout del proceso. El SDK MCP Python (v1.26.0) usa `anyio.open_process` que internamente usa `asyncio.create_subprocess_exec`, por lo tanto la conexión timeout silenciosamente.

El fallback del SDK (`_create_windows_fallback_process` con `subprocess.Popen`) solo se activa cuando `anyio.open_process` lanza `NotImplementedError` — lo cual no ocurre con ProactorEventLoop. El proceso se spawn, stderr se lee, pero stdout nunca dispara el evento de completion de `ReadFile` overlapped.

Esto afecta a cualquier servidor MCP stdio que sea un binario Go compilado para Windows, no solo a codebase-memory-mcp.

## What Changes

- **Modo `transport: pipe-bridge`** en config MCP para servidores stdio que no funcionan con asyncio ProactorEventLoop. Cuando se activa, Hermes usa `subprocess.Popen` sync + thread reader en vez de `anyio.open_process`, puenteando el bug de ProactorEventLoop.
- El bridge mantiene la misma interfaz MCP (`ClientSession` con memory streams), solo cambia el transporte inferior de `stdio_client` a un wrapper con `Popen` + threads.
- Detección automática opcional: si la conexión stdio falla con timeout, reintentar automáticamente con pipe-bridge.

## Capabilities

### New Capabilities
- `mcp-pipe-bridge`: Transport alternativo para servidores MCP stdio en Windows usando `subprocess.Popen` + threads cuando el transporte asyncio nativo falla.

### Modified Capabilities
- (ninguna — los cambios son internos al transporte, no cambian la API pública de herramientas MCP)

## Impact

- **Código afectado**: `tools/mcp_tool.py` — función `_run_stdio`, `_connect_server`, `MCPServerTask`.
- **Dependencias**: ninguna nueva. Usa `subprocess` stdlib + `threading` stdlib.
- **Plataformas**: Windows únicamente. Linux/macOS no se ven afectados (usan SelectorEventLoop con `anyio.open_process` que funciona).
- **Compatibilidad**: el modo pipe-bridge es opt-in vía config (`transport: pipe-bridge`). El comportamiento por defecto no cambia.
