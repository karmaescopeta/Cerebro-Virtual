# Tasks: Compose-Native Agent & Multi-Instance

## 1. docker-compose.yml

- [ ] 1.1 Eliminar `container_name` de todos los servicios (backend, frontend, sistema-agente, searxng, herramientas)
- [ ] 1.2 Eliminar `profiles: [agent]` de `sistema-agente` y `profiles: [tools]` de `herramientas`
- [ ] 1.3 Parametrizar puertos con `${VAR:-default}`: backend `${BACKEND_PORT:-8000}`, frontend `${FRONTEND_PORT:-5173}`, sistema-agente `${AGENT_PORT:-8080}`, searxng `${SEARXNG_PORT:-8888}`
- [ ] 1.4 Añadir `VAULT_HOST_PATH` env var al backend (leído de `.env`) para reemplazar el inspect del Docker SDK
- [ ] 1.5 Añadir `COMPOSE_PROJECT_NAME` al entorno del backend para que pueda pasar `-p` a comandos compose

## 2. .env

- [ ] 2.1 Crear `.env.example` con: `COMPOSE_PROJECT_NAME`, `OPENROUTER_API_KEY`, `BACKEND_PORT`, `FRONTEND_PORT`, `AGENT_PORT`, `SEARXNG_PORT`, `CLOUDFLARE_TUNNEL_TOKEN`, `VAULT_HOST_PATH`
- [ ] 2.2 Actualizar `start.bat` para crear `.env` desde `.env.example` si no existe

## 3. backend/Dockerfile

- [ ] 3.1 Verificar que `docker compose` v2 está disponible dentro del contenedor backend (Docker CLI + socket). Si no, instalar `docker-compose-plugin`
- [ ] 3.2 Test: `docker exec cerebro-backend docker compose version` funciona desde el host

## 4. docker-compose.yml — Cloudflare Tunnel

- [ ] 4.1 Añadir servicio `cloudflared` (imagen `cloudflare/cloudflared:latest`, `profiles: [tunnel]`, env `TUNNEL_TOKEN`, `command: tunnel --no-autoupdate run`, network `cerebro-network`, depends_on frontend)
- [ ] 4.2 Verificar que sin `--profile tunnel` el servicio cloudflared no arranca (perfiles funcionan)

## 5. backend/app/main.py — eliminar Docker SDK para crear contenedores

- [ ] 5.1 Eliminar función `start_agent_container()` completa. Reemplazar `POST /api/agent/start` con: `docker compose -p $COMPOSE_PROJECT_NAME start sistema-agente` (o `restart` si ya está running)
- [ ] 5.2 Reemplazar `reset_agent_config()` (DELETE `/api/init/reset`): cambiar `docker stop/rm cerebro-agente` por `docker compose -p $PROJECT stop sistema-agente`
- [ ] 5.3 Reemplazar `restart_agent()` (POST `/api/agent/restart`): cambiar `docker restart cerebro-agente` por `docker compose -p $PROJECT restart sistema-agente`
- [ ] 5.4 Reemplazar `full_restart_agent()` (POST `/api/agent/full-restart`): cambiar SDK build + `containers.run()` por `docker compose -p $PROJECT build --no-cache sistema-agente && docker compose -p $PROJECT up -d --force-recreate sistema-agente`

## 6. backend/app/main.py — eliminar nombres hardcodeados

- [ ] 6.1 Reemplazar todas las referencias a `cerebro-agente` en `docker exec` con `docker compose -p $PROJECT exec sistema-agente` (líneas ~708-709, ~918-919, ~2407-2408)
- [ ] 6.2 Reemplazar `AGENT_INTERNAL_URL` de `http://cerebro-agente:8080` a `http://sistema-agente:8080` (DNS de compose)
- [ ] 6.3 Reemplazar `client.containers.get("cerebro-backend")` con lectura de `VAULT_HOST_PATH` env var (líneas ~147, ~150, ~1766, ~2277, ~2366)
- [ ] 6.4 Reemplazar `client.containers.get("cerebro-agente")` con `docker compose -p $PROJECT ps sistema-agente` o eliminar si ya no se necesita (líneas ~136, ~173)
- [ ] 6.5 Reemplazar nombres hardcodeados en `docker stop/rm` (líneas ~1243-1244, ~1308, ~1341, ~1366, ~1370, ~1707)
- [ ] 6.6 Actualizar lista de contenedores en línea ~2456 (health check o status) para usar nombres dinámicos o `docker compose ps`

## 7. backend/app/main.py — Cloudflare token en wizard

- [ ] 7.1 Añadir campo `cloudflareTunnelToken` al schema de `agent-config.json`
- [ ] 7.2 Modificar endpoint `POST /api/init/configure` para aceptar y guardar `cloudflareTunnelToken` opcional
- [ ] 7.3 Modificar `GET /api/init/config` y `GET /api/agent/config` para devolver si hay tunnel configurado
- [ ] 7.4 `start.bat` lee `agent-config.json` → si `cloudflareTunnelToken` existe → escribir a `.env` antes de compose up

## 8. backend/app/main.py — cleanup

- [ ] 8.1 Eliminar `get_docker_client()` si no queda ninguna llamada al SDK. Si queda (ej: image build en full-restart), reemplazar por CLI
- [ ] 8.2 Eliminar `_get_backend_mount_source()` y `_join_host_path()` si ya no se usan (reemplazados por `VAULT_HOST_PATH`)
- [ ] 8.3 Eliminar import de `docker` SDK si no se usa

## 9. start.bat

- [ ] 9.1 Detectar Docker instalado. Si no → mostrar link `https://www.docker.com/products/docker-desktop/` y salir
- [ ] 9.2 Detectar Docker en ejecución (ya existe esta lógica — mantener)
- [ ] 9.3 Pedir `COMPOSE_PROJECT_NAME` al usuario si no está en `.env` (o default a `cerebrovirtual`)
- [ ] 9.4 Leer `vault/system/agent-config.json` → si `cloudflareTunnelToken` existe → escribir a `.env` como `CLOUDFLARE_TUNNEL_TOKEN`
- [ ] 9.5 Si `CLOUDFLARE_TUNNEL_TOKEN` está en `.env` → añadir `--profile tunnel` al comando compose
- [ ] 9.6 Cambiar comando a `docker compose -p %PROJECT_NAME% up -d --build` (con `--profile tunnel` si aplica)
- [ ] 9.7 Mostrar puertos desde `.env` en mensaje de éxito (no hardcodeados)
- [ ] 9.8 Añadir warning si detecta contenedores `cerebrovirtual-*` antiguos

## 10. Frontend — wizard

- [ ] 10.1 Añadir paso del wizard tras API key: "Cloudflare Tunnel (opcional)" con campo para token y link a `https://www.cloudflare.com`
- [ ] 10.2 Si el usuario salta el paso, no se envía token al backend
- [ ] 10.3 Enviar `cloudflareTunnelToken` en el payload de `POST /api/init/configure`

## 11. Frontend — Ajustes tunnel toggle

- [ ] 11.1 Añadir sección "Acceso Remoto" en AjustesView (entre "Canales de Mensajería" y "Zona Peligrosa")
- [ ] 11.2 Si no hay tunnel: botón "Iniciar Tunel" → form con campo para `CLOUDFLARE_TUNNEL_TOKEN` + link a cloudflare.com
- [ ] 11.3 Si tunnel activo: badge verde "Túnel Activo" + botón "Desactivar"
- [ ] 11.4 Llamar `POST /api/tunnel/configure` con el token al guardar
- [ ] 11.5 Llamar `POST /api/tunnel/status` al cargar Ajustes para saber estado
- [ ] 11.6 Llamar `POST /api/tunnel/deactivate` al desactivar

## 12. Backend — tunnel endpoints

- [ ] 12.1 `GET /api/tunnel/status` → devuelve `{active: bool, hasToken: bool}`
- [ ] 12.2 `POST /api/tunnel/configure` → recibe token, guarda en `agent-config.json`, escribe en `.env` del host, levanta `docker compose -p $PROJECT --profile tunnel up -d cloudflared`
- [ ] 12.3 `POST /api/tunnel/deactivate` → borra token de config, `docker compose -p $PROJECT stop cloudflared`, deja token en `.env` comentado

## 13. Frontend — nginx + URLs

- [ ] 13.1 `vite.config.js`: usar `VITE_BACKEND_PORT` o `process.env.BACKEND_PORT` para el proxy target
- [ ] 13.2 `DashboardView.jsx`: reemplazar `localhost:8080` con `/agent` relativo
- [ ] 13.3 `AjustesView.jsx`: reemplazar `http://localhost:8080` (línea 141) con `/agent` relativo
- [ ] 13.4 Configurar nginx.conf del frontend: `location /agent/` → `proxy_pass http://sistema-agente:8080/` con WebSocket upgrade
- [ ] 13.5 Configurar nginx.conf: `location /api/` → `proxy_pass http://backend:8000/` (si no existe ya)

## 14. Repo limpio — .gitignore

- [ ] 14.1 Crear `.gitignore` con: `.env`, `.env.*` (excepto `.env.example`), `.venv/`, `node_modules/`, `__pycache__/`, `*.pyc`, `.hermes/`, `vault/` (excepto `.gitkeep`)
- [ ] 14.2 Quitar del tracking de git: `git rm -r --cached .env .venv vault/ .hermes/` (vault contents, .env, .venv salen del repo)
- [ ] 14.3 Crear `.env.example` (template sin valores reales)
- [ ] 14.4 Crear `VERSION` file en raíz con `1.0.0`
- [ ] 14.5 Verificar que `git status` no muestra archivos sensibles ni datos de usuario

## 15. Version banner — backend

- [ ] 15.1 Crear `VERSION` file en raíz del repo: `1.0.0`
- [ ] 15.2 Endpoint `GET /api/version` → `{current: "<version>"}` lee de `VERSION`
- [ ] 15.3 Configurar `GITHUB_REPO` en `.env.example` (formato `owner/repo`) para que el frontend sepa dónde consultar releases

## 16. Version banner — frontend

- [ ] 16.1 Al cargar la app, fetch `GET /api/version` + GitHub Releases API
- [ ] 16.2 Si GitHub release > current → banner: "Nueva versión disponible: vX.Y.Z" + link a release notes
- [ ] 16.3 Botón "No molestar" → localStorage flag `dismiss_version_until` = now + 7 días
- [ ] 16.4 Si `dismiss_version_until` > now → no mostrar banner
- [ ] 16.5 Banner se muestra sobre el dashboard, no bloquea uso

## 17. Vault backward compatibility

- [ ] 17.1 Revisar `agent-config.json` reads en backend — todos usan `.get()` con defaults
- [ ] 17.2 Revisar `agent-keys.json` reads en backend — todos usan `.get()` con defaults
- [ ] 17.3 Si algún campo se lee sin `.get()` → cambiar a `.get()` con default
- [ ] 17.4 Añadir función `migrate_config()` en backend startup que añada campos nuevos con defaults si faltan

## 18. Verificación

- [ ] 18.1 `docker compose down` (limpiar stack actual)
- [ ] 18.2 `start.bat` con proyecto `cerebrovirtual` → todos los servicios levantan
- [ ] 18.3 Wizard completo (con Cloudflare token) → agente arranca y responde
- [ ] 18.4 Chat funciona (backend → `docker compose exec sistema-agente hermes chat`)
- [ ] 18.5 Reset funciona: `DELETE /api/init/reset` → agente se detiene, no quedan contenedores sueltos
- [ ] 18.6 Re-configurar tras reset → agente arranca de nuevo
- [ ] 18.7 Full-restart funciona: `POST /api/agent/full-restart` → imagen reconstruida, agente arranca
- [ ] 18.8 `docker compose ps` muestra todos los servicios incluyendo el agente
- [ ] 18.9 Botón "ir a Hermes" → `localhost:5173/agent` carga el dashboard de Hermes
- [ ] 18.10 Cloudflare tunnel: con token válido, `cerebrovirtual.tudominio.com/agent` carga Hermes dashboard
- [ ] 18.11 Wizard sin token → Ajustes muestra "Iniciar Tunel" → pegar token → tunnel activa
- [ ] 18.12 Tunnel activa → Ajustes muestra "Túnel Activo" → Desactivar → tunnel se detiene
- [ ] 18.13 Multi-instancia: clonar repo, `.env` con `COMPOSE_PROJECT_NAME=cerebro-app2` y puertos distintos, `start.bat` → segunda instancia corre sin colisión
- [ ] 18.14 No queda ningún `container_name` hardcodeado en el compose ni referencias a `cerebro-agente`/`cerebro-backend` en main.py
- [ ] 18.15 `git status` no muestra `.env`, `vault/` contents, `.venv/`, ni datos de usuario
- [ ] 18.16 Clonar repo limpio → `start.bat` → wizard → todo funciona desde cero
- [ ] 18.17 Version banner: cambiar `VERSION` a `0.9.0` + tag `v1.0.0` en GitHub → banner aparece → "No molestar" → desaparece 7 días
- [ ] 18.18 Vault viejo (agent-config.json sin campos nuevos) → arranca sin error, defaults aplicados
