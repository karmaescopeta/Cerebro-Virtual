## Why

El flujo de Cloudflare Tunnel está roto: el backend corre dentro de un container sin acceso al `docker-compose.yml` ni al `.env` del host, por lo que `docker compose --profile tunnel up` falla. El token se guarda en `agent-config.json` pero `start.bat` lee de `.env`, así que se pierde al reiniciar. El campo de entrada solo acepta tokens puros, pero Cloudflare entrega un comando `docker run` completo. El usuario pega eso y el sistema no sabe parsearlo.

## What Changes

- **Montar `docker-compose.yml` y `.env` en el container backend** para que `_compose_cmd` pueda operar compose desde dentro.
- **Parsear comando completo de Cloudflare**: el campo acepta `docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJ...` y extrae solo el `--token`. También acepta token puro.
- **Backend escribe token en `.env` real del host** (vía mount), no en ruta calculada.
- **Activar/desactivar túnel con reinicio inmediato**: al guardar token → `docker compose --profile tunnel up -d cloudflared`. Al desactivar → `docker compose stop cloudflared` + borrar token de `.env`.
- **Frontend con overlay de carga**: al activar/desactivar, mostrar spinner overlay hasta que el backend confirme.
- **`tunnel/status` verifica estado real del container**, no solo si hay token guardado.
- **Labels y placeholders actualizados**: wizard Step 1 y AjustesView dicen "Pega el comando de Cloudflare" en vez de "Token del tunnel...".
- **`cloudflared` en compose**: `command` recibe `--token ${TUNNEL_TOKEN}` explícito, no depende de env var implícita.

## Capabilities

### New Capabilities
- `tunnel-cloudflare`: Gestión completa de Cloudflare Tunnel — parseo de comando, activación/desactivación con reinicio, estado real del container, UI con feedback de carga.

### Modified Capabilities
<!-- No hay specs previos — todo es nuevo -->

## Impact

- `docker-compose.yml`: montar compose + `.env` en backend, fix `command` de cloudflared.
- `backend/app/main.py`: `tunnel_configure` (escritura a `.env` real, parseo de comando), `tunnel_status` (estado real), `tunnel/deactivate` (borrar token de `.env` + stop).
- `frontend/src/components/wizard/WizardStep1.jsx`: label, placeholder, helper text.
- `frontend/src/components/views/AjustesView.jsx`: label, placeholder, helper text, overlay de carga.
- `start.bat`: sin cambios (ya lee `.env` correctamente).