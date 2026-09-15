# Design — Fix Tunnel Cloudflare

## Context

El backend corre dentro de un container Docker. Para gestionar cloudflared via compose necesita acceso al `docker-compose.yml` y al `.env` del host. Hoy no los tiene montados. Adicionalmente, el comando que Cloudflare entrega al usuario es un `docker run` completo, no un token puro.

## Goals
- cloudflared arranca/detiene desde el backend sin requerir `start.bat`
- Token persiste en `.env` (fuente de verdad para compose)
- UI acepta comando completo de Cloudflare sin fricción
- Estado real del túnel en todo momento

## Non-Goals
- Configurar subdominios desde la UI (se hace en panel Cloudflare)
- Auto-detección de túneles existentes
- Multi-túnel

## Decisions

### D1: Montar docker-compose.yml y .env en backend
**Choice**: Montar ambos como read-write en el container backend.
**Why**: El backend necesita leer/escribir `.env` (token) y leer `docker-compose.yml` para que `docker compose` funcione.
**Alternative**: Usar Docker SDK para inspeccionar y manejar cloudflared → más complejo, ya migrado a compose-native.

### D2: Montar docker-compose.yml en /app/docker-compose.yml
**Choice**: Montar el compose file en `/app/docker-compose.yml` y hacer `cd /app` antes de `_compose_cmd`.
**Why**: `docker compose` busca `docker-compose.yml` en el cwd. Montándolo en `/app` el comando funciona sin flags extra.
**Alternative**: Pasar `-f /path/to/docker-compose.yml` en `_compose_cmd` → más verboso, pero igual de válido.

### D3: .env montado como volume read-write
**Choice**: `./.env:/app/.env:rw` en compose.
**Why**: El backend escribe el token en el `.env` real del host. Si es read-only, no persiste.
**Risk**: Si `.env` no existe (primer arranque), el mount falla. **Mitigation**: `start.bat` ya crea `.env` desde `.env.example` antes de levantar compose.

### D4: Parsear comando completo con regex
**Choice**: `re.search(r'--token\s+(\S+)', user_input)` para extraer token. Si no match, tratar input como token puro.
**Why**: Simple, sin dependencias, cubre ambos casos.
**Alternative**: Validar formato `eyJ` → frágil, el token puede cambiar de prefijo.

### D5: cloudflared command con --token explícito
**Choice**: `command: tunnel --no-autoupdate run --token ${TUNNEL_TOKEN}` en compose.
**Why**: cloudflared no lee `TUNNEL_TOKEN` como env var implícita. Hay que pasarlo como flag.
**Alternative**: Usar `TUNNEL_TOKEN` env var con `command: tunnel run` → no funciona, cloudflared espera `--token`.

### D6: tunnel_status usa docker compose ps
**Choice**: `docker compose ps cloudflared --format json` y verificar estado.
**Why**: Refleja estado real, no inferido.
**Alternative**: `docker inspect` → más verboso, misma info.

### D7: Frontend overlay con estado de carga
**Choice**: Estado `loading` en TunnelSection que renderiza overlay con spinner.
**Why**: El usuario espera feedback visual durante activación/desactivación.

### D8: _compose_cmd necesita --profile tunnel al operar cloudflared
**Choice**: `tunnel_configure` y `tunnel_deactivate` llaman `_compose_cmd("--profile", "tunnel", "up", "-d", "cloudflared")` y `_compose_cmd("stop", "cloudflared")` respectivamente.
**Why**: cloudflared tiene `profiles: [tunnel]`. Sin `--profile tunnel`, compose no lo levanta.

## Risks / Trade-offs

- [.env montado como rw] → Si el usuario edita `.env` manualmente mientras el backend escribe, puede haber race. **Mitigation**: Escritura atómica (escribir a temp y rename).
- [docker-compose.yml montado] → Si el usuario lo edita, el backend opera sobre la versión montada. Aceptable — es la misma que usa `start.bat`.

## Migration Plan
1. Modificar `docker-compose.yml` (monts + cloudflared command).
2. Modificar `backend/app/main.py` (tunnel endpoints + parse).
3. Modificar frontend (labels + overlay).
4. `docker compose down && start.bat` (o `docker compose up -d --build`).
5. Test: pegar comando completo de Cloudflare → túnel activo.

Rollback: revertir los 3 archivos, `docker compose up -d --build`.