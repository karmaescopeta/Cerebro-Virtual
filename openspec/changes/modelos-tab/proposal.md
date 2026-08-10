## Why

El usuario quiere cambiar modelos de los perfiles en tiempo real desde la app principal, sin reconfigurar el wizard. Actualmente no hay forma de hacer esto sin editar `agent-config.json` manualmente.

## What Changes

- Nueva tab "MODELOS" en Sidebar entre GRAFO y AJUSTES.
- Vista `ModelosView.jsx`: 5 tarjetas rectangulares (nombre perfil + URL modelo actual). Botón "Editar" activa modo edición (inputs editables). Botón "Guardar" guarda + reinicia agente. Overlay de carga bloquea UI durante el restart. Mensaje de resumen al completar.
- Backend: `GET /api/profiles/models` devuelve modelos actuales. `PUT /api/profiles/models` guarda + `docker restart cerebro-agente`.
- `generate_config.py` ya lee `models.coordinador` (change anterior). `install_profiles.sh` ya sobreescribe perfiles (change anterior).

## Capabilities

### New Capabilities
- `modelos-tab`: Vista de gestión de modelos por perfil en tiempo real.

## Impact

- **Frontend**: `ModelosView.jsx` (nuevo), `Sidebar.jsx` (tab), `App.jsx` (routing), `app.css` (tarjetas + overlay).
- **Backend**: `main.py` 2 endpoints nuevos.