# Design: MCP Pipe-Bridge Transport

## Context

Hermes Agent usa el SDK MCP Python (v1.26.0) para conectar con servidores MCP stdio. En Windows, el SDK usa `anyio.open_process` → `asyncio.create_subprocess_exec` con ProactorEventLoop (único loop que soporta subprocess en Windows).

**Bug confirmado**: `asyncio.create_subprocess_exec` + ProactorEventLoop no puede leer stdout de `codebase-memory-mcp.exe` (binario Go, 273MB). El proceso se spawn, stderr se lee vía asyncio, pero stdout nunca dispara el evento de completion de `ReadFile` overlapped. Resultado: `TimeoutError` → `CancelledError` → conexión fallida.

`subprocess.Popen` sync + thread reader funciona perfectamente con el mismo exe.

El SDK MCP tiene un fallback (`_create_windows_fallback_process`) que usa `Popen`, pero solo se activa cuando `anyio.open_process` lanza `NotImplementedError` — lo cual no ocurre con ProactorEventLoop.

## Goals / Non-Goals

**Goals:**
- Permitir que `codebase-memory-mcp` (y cualquier servidor MCP Go en Windows) funcione con Hermes.
- Mínimo diff. Reutilizar `ClientSession` del SDK sin parchearlo.
- No romper el transporte nativo en Linux/macOS.

**Non-Goals:**
- Fixear el bug de ProactorEventLoop en CPython (upstream).
- Parchear el SDK MCP (upstream).
- Soportar todos los servidores MCP posibles — solo stdio, solo Windows.

## Decisions

### D1: Pipe-bridge como context manager async

Implementar `pipe_bridge_client(params)` como reemplazo directo de `stdio_client(params)`. Mismo return type: `(read_stream, write_stream)` memory streams.

```python
@asynccontextmanager
async def pipe_bridge_client(params, errlog=sys.stderr):
    # subprocess.Popen sync + threads → memory streams
    proc = subprocess.Popen(...)
    # Thread reads proc.stdout lines → send to read_stream_writer
    # Async write_stream_reader → proc.stdin writes
    # On exit: proc.terminate(), close streams
```

**Por qué no parchear el SDK**: El SDK ya tiene fallback pero solo para `NotImplementedError`. Modificar el SDK upstream requiere PR + release. El wrapper es 50 líneas y no tocha el SDK.

### D2: Detección automática opcional

Si `transport: pipe-bridge` no está en config, intentar asyncio nativo primero. Si falla con timeout/CancelledError en Windows, reintentar con pipe-bridge automáticamente. Marcador en memoria para no reintentar nativo en la misma sesión.

**Por qué auto-detect**: El usuario no debería necesitar saber que su servidor MCP es un binario Go con bug de pipe. Pero el flag explícito existe para forzarlo.

### D3: Threads daemon para lectura

Thread daemon lee `proc.stdout.readline()` (blocking) y hace `read_stream_writer.send()` vía `anyio.from_thread.run()`. Un thread para stdout, otro para stderr (si errlog es un archivo).

**Por qué threads y no asyncio**: El problema es que ProactorEventLoop no notifica cuando hay datos en el pipe. Un thread blocking con `readline()` sí lee. Es lo que ya funciona en el test.

## Architecture

```
MCPServerTask._run_stdio()
  ├─ if transport == "pipe-bridge" or auto-detected:
  │   └─ pipe_bridge_client(params)  ← nuevo
  │       ├─ subprocess.Popen (sync)
  │       ├─ Thread: proc.stdout → read_stream_writer (anyio.from_thread)
  │       └─ Thread: write_stream_reader → proc.stdin
  └─ else:
      └─ stdio_client(params)  ← existente (SDK nativo)
```

Sin cambios en `ClientSession`, `_discover_tools`, ni el resto del flujo.

## Pitfalls

- **Thread shutdown**: `proc.stdout.readline()` blocking en thread daemon. Si el proc muere, readline retorna `b''` (EOF). Thread termina solo. Si proc no muere, `proc.terminate()` + thread es daemon (muere con el proceso).
- **Encoding**: Go usa `\r\n` en Windows. `readline()` con `\n` funciona (incluye `\r` en el string, JSON parser lo ignora).
- **Buffering**: `bufsize=0` en Popen para evitar buffering intermedio.
