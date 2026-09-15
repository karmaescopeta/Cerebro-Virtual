# Proposal: Multi-instancia Cerebro Virtual

## Intent

Permitir N instancias independientes de Cerebro Digital en el mismo servidor. Cada instancia con su propio stack Docker, vault, túnel Cloudflare, puertos y nombre. Sin fricción.

## Scope

### Incluye
- **Multi-instancia**: Directorio `instances/` con una subcarpeta por instancia. Cada una con `.env` y `vault/` independientes.
- **Script gestor** (`cerebro-manage.bat`): create, start, stop, list, remove, ports. Auto-asignación de puertos.
- **docker-compose.yml**: Parameterizar vault y .env con variables (`${VAULT_DIR}`, `${ENV_FILE}`).
- **Migración**: Instancia actual → `instances/default/`.
- **Tab Rutas en frontend**: Sección nueva en el tab "Modelos" (parte inferior). Muestra cada contenedor con etiqueta visual editable + URL interna copiable. Solo lectura de rutas, edición de etiqueta es cosmética.

### No incluye (YAGNI)
- Gestión desde el backend (script del host, no Docker-in-Docker).
- Auto-crear túneles vía API Cloudflare (manual en dashboard).
- GUI web para gestionar instancias (BAT con menú).
- Docker Swarm / Kubernetes.
- Renombrar contenedores reales en Docker (etiqueta visual solo).

## Approach

### 1. docker-compose.yml — 3 cambios
```yaml
# Backend volumes:
- ${VAULT_DIR:-./vault}:/app/vault
- ${ENV_FILE:-./.env}:/app/.env:rw

# Compose se invoca con:
# docker compose -p <nombre> --env-file instances/<nombre>/.env up -d --build
```

### 2. Estructura de instancias
```
cerebro virtual/
├── docker-compose.yml
├── instances/
│   ├── default/
│   │   ├── .env
│   │   └── vault/
│   └── <nombre>/
│       ├── .env
│       └── vault/
├── cerebro-manage.bat
└── start.bat  # wrapper → cerebro-manage start default
```

### 3. Auto-asignación de puertos
- Script escanea `.env` de todas las instancias + `docker ps` para detectar puertos en uso.
- Asigna primer bloque libre: backend (8000+), frontend (5173+), agent (8080+), searxng (8888+).
- Sin colisiones entre instancias.

### 4. Tab Rutas en frontend
- Sección "Rutas" al final del tab "Modelos".
- Tabla con columnas: Etiqueta (editable), Servicio, URL Interna, botón Copiar.
- Datos desde endpoint `/api/instances/routes` (backend lee compose + .env).
- Etiqueta se guarda en `.env` de la instancia (`ROUTE_LABEL_FRONTEND=Mi Frontend`).
- URL interna = `http://<servicio>:<puerto_interno>`.

### 5. Túnel por instancia
- Cada `.env` tiene su propio `CLOUDFLARE_TUNNEL_TOKEN`.
- Dashboard Cloudflare apunta a `http://frontend:80` — resuelve dentro de la red de cada instancia.
- Subdominios distintos por instancia → túneles separados en Cloudflare (manual).

## Rollback
- Revertir docker-compose.yml a paths fijos (`./vault`, `./.env`).
- Mover `instances/default/vault` → `./vault`.
- Mover `instances/default/.env` → `./.env`.
- Borrar `instances/`, `cerebro-manage.bat`.
- Revertir frontend (git checkout del tab Modelos).

## Riesgos
- **Migración de vault**: mover directorio grande. Backup antes.
- **Backend paths**: `VAULT_HOST_PATH` en `.env` debe apuntar al path correcto del host para cada instancia.
- **Docker cache**:_segunda instancia no rebuild desde cero (imágenes compartidas).
