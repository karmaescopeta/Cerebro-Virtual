## Why

El agente (`cerebro-agente`) se crea con Docker SDK (`client.containers.run()`) en lugar de gestionarse mediante `docker compose`. Esto produce contenedores sueltos fuera del compose project. Además, todos los `container_name` están hardcodeados (`cerebro-backend`, `cerebro-agente`, etc.), impidiendo multi-instancia en un mismo servidor. El usuario necesita desplegar múltiples cerebros independientes, cada uno como un compose project aislado con su propio nombre.

## What Changes

- **BREAKING**: Eliminar `profiles: [agent]` del docker-compose.yml. El agente arranca con compose, no con Docker SDK.
- **BREAKING**: Eliminar `start_agent_container()` y todo `client.containers.run()` del backend. El agente se gestiona vía `docker compose`.
- El entrypoint del agente (`entrypoint.sh`) ya espera config con un `while` loop. Si no hay config, duerme. Compose lo levanta y queda esperando. No hay que tocarlo.
- `reset_agent_config()`: en lugar de `docker stop/rm`, haría `docker compose stop sistema-agente` + borrar config. Al recargar la página y configurar, el wizard guarda config y hace `docker compose start sistema-agente`.
- `restart_agent()` y `full_restart_agent()`: cambian de `docker restart cerebro-agente` a `docker compose restart sistema-agente` (o `docker compose up -d --force-recreate sistema-agente` para full-restart).
- Todos los `docker exec cerebro-agente` pasan a usar el nombre del servicio compose (que compose resuelve por DNS interno) o `docker compose exec sistema-agente`.
- Todos los `container_name` hardcodeados se eliminan del compose. Los contenedores se nombran automáticamente como `<project>-<service>-1`. Esto permite multi-instancia sin colisión de nombres.
- `start.bat`: pregunta nombre del proyecto (o lo lee de `.env` como `COMPOSE_PROJECT_NAME`). Ejecuta `docker compose -p <nombre> up -d --build`. Sin `--profile`.
- Frontend: `localhost:8080` y `localhost:8000` pasan a variables de entorno o se sirven con prefijos. Para multi-instancia en mismo servidor, los puertos se asignan por `.env` por instancia.
- **.env**: añadir `COMPOSE_PROJECT_NAME` y puertos parametrizables (`BACKEND_PORT=8000`, `FRONTEND_PORT=5173`, `AGENT_PORT=8080`, `SEARXNG_PORT=8888`).
- **BREAKING**: Añadir servicio `cloudflared` al docker-compose.yml. Tunnel token opcional en `.env` (`CLOUDFLARE_TUNNEL_TOKEN`). Sin token → cloudflared duerme. Con token → tunnel activo.
- **Wizard**: Nuevo paso después de la API key de OpenRouter: pedir `CLOUDFLARE_TUNNEL_TOKEN` (opcional). Si el usuario no tiene cuenta, link a cloudflare.com. El backend guarda el token en `agent-config.json` y lo escribe en `.env` del host vía compose env.
- **start.bat**: Detectar Docker. Si no está instalado → mostrar link de descarga y salir. Si está → continuar. No detectar Cloudflare (es servicio web, no instalación local).
- **nginx**: Proxy `/agent` → `sistema-agente:8080` para que el botón "ir a panel de Hermes" funcione local y remoto.
- **Frontend**: Botón "ir a Hermes" apunta a `/agent` relativo, no `localhost:8080`.

## Capabilities

### New Capabilities
- `compose-native-management`: Gestión del agente y todos los contenedores exclusivamente vía `docker compose`. Sin Docker SDK para crear contenedores.
- `multi-instance-support`: Soporte para desplegar múltiples instancias del cerebro en un mismo servidor, cada una aislada con su compose project name, puertos y .env propios.
- `cloudflare-tunnel-access`: Acceso remoto a cada cerebro mediante Cloudflare Tunnel. Un tunnel por instancia, con token opcional. Access control gestionado en Cloudflare Zero Trust dashboard (sin código de auth local).
- `distribution-and-updates`: Repo limpio distribuible, notificación de versiones con banner, compatibilidad del vault entre versiones, Hermes sin auto-update.

### Modified Capabilities
<!-- No hay specs existentes en openspec/specs/ que modificar -->

## Impact

- **docker-compose.yml**: Eliminar `profiles`, `container_name` fijos. Parametrizar puertos con `${VAR}`. Añadir `COMPOSE_PROJECT_NAME`.
- **backend/app/main.py**: `start_agent_container()`, `reset_agent_config()`, `restart_agent()`, `full_restart_agent()`, todos los `docker exec`, `docker stop`, `docker rm` contra nombres hardcodeados. ~25 referencias. Nuevo: endpoint del wizard para guardar `CLOUDFLARE_TUNNEL_TOKEN`.
- **backend/Dockerfile**: Instalar `docker-compose-plugin` o usar `docker compose` (ya viene con Docker CLI).
- **start.bat**: Aceptar nombre de proyecto, usar `COMPOSE_PROJECT_NAME`. Detectar Docker instalado.
- **frontend**: URLs hardcodeadas a `localhost:8080` y `localhost:8000`. Nuevo paso del wizard para Cloudflare token.
- **frontend/nginx**: Proxy `/agent` → `sistema-agente:8080`.
- **.env**: Nuevo formato con `COMPOSE_PROJECT_NAME`, puertos, `CLOUDFLARE_TUNNEL_TOKEN`.
- **docker-compose.yml**: Nuevo servicio `cloudflared`.
- **entrypoint.sh del agente**: Sin cambios. Ya espera config con `while` loop.
