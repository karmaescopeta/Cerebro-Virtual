# Design: Multi-instancia Cerebro Virtual

## Decisiones técnicas

### D1: Script BAT en el host, no backend
**Decisión**: Gestión de instancias via `cerebro-manage.bat` en el host.
**Razón**: Backend corre en container. Gestionar otros containers desde dentro = Docker-in-Docker. Ya vimos el dolor con cloudflared (exit 137). El ciclo de vida (create/start/stop) es orquestación a nivel host.
**Trade-off**: No se puede gestionar desde la web. Aceptable — el usuario gestiona instancias desde el host, no desde dentro de un cerebro.

### D2: Una sola red Docker por instancia
**Decisión**: Cada instancia crea su propia red `<project>_cerebro-network`.
**Razón**: Aislamiento total. cloudflared de la instancia A no ve frontend de instancia B. Docker compose lo hace automáticamente con `COMPOSE_PROJECT_NAME`.
**Sin código extra**.

### D3: docker-compose.yml compartido, .env por instancia
**Decisión**: Un solo `docker-compose.yml` en la raíz. Cada instancia tiene su `.env` en `instances/<nombre>/.env`.
**Razón**: Sin duplicar el compose file. Cambios al stack se aplican a todas las instancias. Cada instancia solo varía en .env (puertos, tokens, project name).
**Implementación**: `docker compose -p <nombre> --env-file instances/<nombre>/.env up -d --build`.

### D4: Auto-asignación de puertos secuencial
**Decisión**: Script busca primer puerto libre desde base (8000, 8001, ...). Verifica contra `docker ps` y `.env` de otras instancias.
**Razón**: Sin fricción. Usuario no tiene que saber qué puertos están libres. Sin colisiones garantizado.
**Algoritmo**:
```
para cada servicio (backend=8000, frontend=5173, agent=8080, searxng=8888):
  port = base
  mientras port en uso (docker ps + .env instances):
    port++
  asignar port
```

### D5: Vault path parameterizado
**Decisión**: `docker-compose.yml` usa `${VAULT_DIR:-./vault}` en vez de `./vault`.
**Razón**: Cada instancia apunta a su propio vault. Compose file compartido, paths diferentes via env.
**Cambio**: 1 línea en backend volumes. `ENV_FILE` similar para .env mount.

### D6: Tab Rutas — etiqueta visual, no rename Docker
**Decisión**: Frontend muestra tabla de rutas con etiqueta editable. Etiqueta se guarda en `.env` (`ROUTE_LABEL_FRONTEND=...`). El nombre interno del servicio (`frontend`) no cambia.
**Razón**: Renombrar contenedores Docker rompe DNS resolution dentro de la red compose. El nombre del servicio es el hostname. Cambiarlo requiere recreate + actualizar túnel. Etiqueta visual da la misma UX sin riesgo.

### D7: Backend endpoint para rutas
**Decisión**: `GET /api/instances/routes` devuelve lista de servicios con su URL interna.
**Razón**: Frontend no puede leer docker-compose.yml directamente. Backend sí (montado como `/app/docker-compose.yml:ro`).
**Respuesta**:
```json
{
  "services": [
    {
      "service": "frontend",
      "label": "Mi Frontend",
      "url": "http://frontend:80",
      "port_internal": 80,
      "port_host": 5173
    },
    ...
  ]
}
```

### D8: Migración de instancia actual
**Decisión**: Script de migración que mueve `vault/` y `.env` a `instances/default/`.
**Razón**: No romper la instancia existente. Migración transparente.
**Pasos**:
1. `mkdir instances/default`
2. `mv vault/ instances/default/vault/`
3. `mv .env instances/default/.env`
4. Actualizar `VAULT_HOST_PATH` en `instances/default/.env` al nuevo path.
5. `start.bat` → wrapper de `cerebro-manage start default`.

## Arquitectura final

```
┌─────────────────────────────────────────┐
│ Host Windows                            │
│                                         │
│  cerebro-manage.bat                     │
│  ├── create <nombre>                   │
│  │   ├── instances/<nombre>/.env        │
│  │   ├── instances/<nombre>/vault/     │
│  │   └── auto-asignar puertos           │
│  ├── start <nombre>                    │
│  │   └── docker compose -p <nombre>     │
│  │       --env-file instances/<n>/.env │
│  │       up -d --build                  │
│  ├── stop <nombre>                     │
│  ├── list                               │
│  └── remove <nombre>                   │
│                                         │
│  docker-compose.yml (compartido)       │
│  ├── ${VAULT_DIR}:/app/vault           │
│  └── ${ENV_FILE}:/app/.env:rw          │
│                                         │
│  instances/                             │
│  ├── default/                           │
│  │   ├── .env (puertos 8000/5173/...)  │
│  │   └── vault/                         │
│  └── cerebro2/                          │
│      ├── .env (puertos 8001/5174/...)  │
│      └── vault/                         │
│                                         │
│  Docker Engine                          │
│  ├── red: default_cerebro-network       │
│  │   ├── frontend:80                   │
│  │   ├── backend:8000                  │
│  │   ├── cloudflared → frontend:80     │
│  │   └── (aislado de cerebro2)          │
│  └── red: cerebro2_cerebro-network      │
│      ├── frontend:80                   │
│      ├── backend:8000                  │
│      └── cloudflared → frontend:80     │
└─────────────────────────────────────────┘
```

## Cambios por archivo

| Archivo | Cambio | Esfuerzo |
|---------|--------|----------|
| `docker-compose.yml` | `${VAULT_DIR}`, `${ENV_FILE}` en backend volumes | 2 líneas |
| `cerebro-manage.bat` | Nuevo. create/start/stop/list/remove/ports | ~150 líneas BAT |
| `start.bat` | Simplificar a wrapper | -100 líneas |
| `backend/app/main.py` | Endpoint `GET /api/instances/routes` | ~40 líneas |
| `backend/app/main.py` | `GET /api/instances/routes/labels` + `PUT` | ~30 líneas |
| `frontend/src/.../ModelosTab.jsx` | Sección Rutas al final | ~80 líneas JSX |
| `instances/default/.env` | Migrar .env actual | mover archivo |
| `instances/default/vault/` | Migrar vault actual | mover directorio |
