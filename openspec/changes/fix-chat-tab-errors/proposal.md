## Why

El tab Chat tiene 7 errores funcionales y visuales que degradan la experiencia de uso. El modo Investigar está roto (se cuelga indefinidamente), los mensajes de carga no reflejan el modo activo, la selección visual de mensajes no existe, el envío de mensajes tiene lag visual, y el contenedor Graphify/neural map no funciona.

## What Changes

### Visualización
1. **Mensajes de carga contextuales**: El indicador de carga cambia según el modo activo:
   - Modo default → "Pensando..."
   - Chat inteligente → "Pensamiento profundo..."
   - Cerebro → "Buscando en mi cerebro..."
   - Investigar → "Investigando..." (actual)
2. **Investigar directo desde input**: En modo Investigar, Enter envía el texto del input directamente a investigar (no a chat normal). Elimina el flujo "enviar → seleccionar → investigar".
3. **Highlight visual de mensajes seleccionados**: Mensajes seleccionados en modo Investigar reciben fondo de color distintivo para identificación inmediata.
4. **Envío inmediato de mensajes**: El mensaje del usuario aparece inmediatamente al enviar (optimistic UI), no espera la respuesta del backend.

### Funcionamiento
5. **Fix Investigar colgado**: `_ask_hermes` para perfil `investigador` usa timeout excesivo (180s) y hace 2 llamadas secuenciales (240s total). Reducir a 1 llamada con timeout razonable. Verificar que el perfil `investigador` existe y el binario Hermes es accesible.
6. **Multi-mensaje con resumen de directrices**: Al seleccionar múltiples mensajes para investigar, el backend genera un resumen de los puntos clave como contexto/directrices antes de producir el documento completo.
7. **Fix Graphify/Neural Map**: Verificar que el contenedor `herramientas` existe como imagen Docker, que `graphify` binario está instalado dentro, y que `_run_graphify` produce nodos. El neural map debe mostrar datos si hay archivos procesados.

## Capabilities

### New Capabilities
- `chat-loading-indicators`: Mensajes de carga contextuales según modo activo (default, smart, cerebro, investigar)
- `chat-investigate-flow`: Flujo corregido de Investigar — envío directo, multi-mensaje con resumen, highlight visual, fix timeout
- `graphify-neural-map`: Contenedor herramientas + Graphify funcional, neural map con nodos reales

### Modified Capabilities
- `chat-messaging`: Envío optimistic UI (mensaje aparece inmediatamente)

## Impact

- **Frontend**: `ChatView.jsx` (loading indicators, highlight, Enter handler, optimistic send), `App.jsx` (`handleSendChat` refactor, `handleInvestigate` refactor)
- **Backend**: `main.py` — `_ask_hermes` timeout fix, `investigate` endpoint (1 llamada + resumen multi-mensaje), `_run_graphify` error handling
- **Docker**: `docker-compose.yml` — verificar imagen `herramientas`, posiblemente cambiar `restart: "no"` a `restart: "no"` con build garantizado
- **Dependencias**: Ninguna nueva. Reutilizar componentes existentes.
