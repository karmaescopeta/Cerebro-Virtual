## 1. docker-compose.yml — Monts y cloudflared fix

- [ ] 1.1 Montar `./docker-compose.yml:/app/docker-compose.yml:ro` en servicio backend
- [ ] 1.2 Montar `./.env:/app/.env:rw` en servicio backend
- [ ] 1.3 Cambiar `command` de cloudflared a `tunnel --no-autoupdate run --token ${TUNNEL_TOKEN}`

## 2. Backend — _compose_cmd con cwd

- [ ] 2.1 Modificar `_compose_cmd` para que use `cwd="/app"` en subprocess.run (o pasar `-f /app/docker-compose.yml`)
- [ ] 2.2 Verificar que los endpoints existentes (start/stop/restart sistema-agente) sigan funcionando con el nuevo cwd

## 3. Backend — Parseo de comando Cloudflare

- [ ] 3.1 Crear función `_extract_tunnel_token(raw_input: str) -> str` que extrae `--token <value>` o devuelve el input si es token puro
- [ ] 3.2 Usar `_extract_tunnel_token` en `tunnel_configure` y en `/api/init/configure` (wizard)

## 4. Backend — tunnel_configure fix

- [ ] 4.1 Escribir token en `/app/.env` (ruta real via mount) en vez de ruta calculada
- [ ] 4.2 Escritura atómica: escribir a temp + rename
- [ ] 4.3 Ejecutar `_compose_cmd("--profile", "tunnel", "up", "-d", "cloudflared")` con cwd correcto
- [ ] 4.4 Retornar error detallado si compose falla

## 5. Backend — tunnel_status real

- [ ] 5.1 Ejecutar `docker compose ps cloudflared --format json` y parsear estado
- [ ] 5.2 Responder `{active: <bool>, hasToken: <bool>}` según estado real del container + token en .env

## 6. Backend — tunnel_deactivate fix

- [ ] 6.1 Ejecutar `_compose_cmd("--profile", "tunnel", "stop", "cloudflared")`
- [ ] 6.2 Borrar token de `/app/.env` (CLOUDFLARE_TUNNEL_TOKEN=)
- [ ] 6.3 Borrar token de agent-config.json

## 7. Frontend — WizardStep1 labels

- [ ] 7.1 Cambiar placeholder a "Pega aquí el comando de Cloudflare..."
- [ ] 7.2 Actualizar helper text: "Crea un tunnel en Cloudflare Zero Trust, copia el comando completo y pégalo aquí."
- [ ] 7.3 Cambiar input de `type="password"` a `type="text"` (el comando es largo, necesita verse)

## 8. Frontend — AjustesView labels + overlay

- [ ] 8.1 Cambiar placeholder a "Pega aquí el comando de Cloudflare..."
- [ ] 8.2 Actualizar helper text igual que wizard
- [ ] 8.3 Cambiar input de `type="password"` a `type="text"`
- [ ] 8.4 Agregar estado `loading` que muestra overlay con spinner durante activación/desactivación
- [ ] 8.5 Overlay bloquea interacción hasta recibir respuesta del backend

## 9. Verificación

- [ ] 9.1 `docker compose down` + `start.bat` (o `docker compose up -d --build`)
- [ ] 9.2 Pegar comando completo de Cloudflare en wizard → túnel activo
- [ ] 9.3 Pegar comando completo en Ajustes → túnel activo
- [ ] 9.4 Desactivar desde Ajustes → túnel detenido
- [ ] 9.5 `GET /api/tunnel/status` refleja estado real
- [ ] 9.6 Reiniciar sistema → token persiste en .env, cloudflared arranca solo