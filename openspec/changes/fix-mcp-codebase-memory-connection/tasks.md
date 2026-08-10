# Tasks: MCP Pipe-Bridge Transport

## 1. Implement pipe_bridge_client

- [ ] 1.1 Crear `tools/mcp_pipe_bridge.py` con `pipe_bridge_client(params)` async context manager
- [ ] 1.2 Implementar Popen spawn con `bufsize=0`, `CREATE_NO_WINDOW`
- [ ] 1.3 Thread daemon para stdout → `read_stream_writer.send()` vía `anyio.from_thread.run()`
- [ ] 1.4 Write path: `write_stream_reader` → `proc.stdin.write()` + flush
- [ ] 1.5 Shutdown: `proc.terminate()`, cerrar streams, cleanup threads

## 2. Integrar en mcp_tool.py

- [ ] 2.1 Leer `transport` de config MCP (default: `stdio` = nativo)
- [ ] 2.2 En `_run_stdio`, si `transport == "pipe-bridge"`, usar `pipe_bridge_client` en vez de `stdio_client`
- [ ] 2.3 Auto-detección: si conexión nativa falla en Windows con timeout/CancelledError, reintentar con pipe-bridge

## 3. Verificación

- [ ] 3.1 Test: `pipe_bridge_client` + `ClientSession` → `initialize()` + `list_tools()` con codebase-memory-mcp.exe
- [ ] 3.2 Test: `hermes mcp test codebase-memory-mcp` → conexión exitosa
- [ ] 3.3 Test: 14 herramientas MCP registradas como `mcp_codebase_memory_mcp_*`
- [ ] 3.4 Test: llamada a `mcp_codebase_memory_mcp_list_projects` desde sesión Hermes
- [ ] 3.5 Verificar que Linux/macOS no se ven afectados (transport nativo sigue por defecto)

## 4. Config

- [ ] 4.1 Documentar `transport: pipe-bridge` en config MCP
- [ ] 4.2 Configurar `codebase-memory-mcp` con `transport: pipe-bridge` en config.yaml del usuario
