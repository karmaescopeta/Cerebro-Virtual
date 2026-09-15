# Proposal: ui-fixes-y-unified-password

## Why

4 bugs + 3 mejoras UI reportadas por el usuario:

1. **Link OmniRoute roto**: en tab Modelos, "Editar los modelos de cada combo en el panel OmniRoute" abre `/omniroute/` vía proxy nginx — OmniRoute redirige 307 a `/dashboard` (absoluta, fuera del prefijo) y sus rutas API colisionan con las del backend. El panel nunca carga.
2. **Contraseña OmniRoute misteriosa**: OmniRoute pide contraseña (su manage password de `INITIAL_PASSWORD`) y el usuario no sabe cuál es ni dónde se define.
3. **Contraseña unificada**: el usuario quiere UNA credencial (usuario + contraseña) en el wizard que sirva para el panel de Hermes (:8080) Y para el dashboard de OmniRoute.
4. **Versión falsa**: Sidebar muestra `v1.0.4-stable` hardcoded (repo va por v1.0.0). Logout muerto abajo. "SYSTEM HEALTHY" sobra en el header.
5. **Responsive**: móvil no es 100% usable; en PC sobra una scrollbar horizontal inferior.

## What Changes

- **G1 (link OmniRoute)**: link/botón a `http://<hostname>:20128` (puerto ya publicado en compose). Muerto el proxy `/omniroute/` (borrar location de nginx.conf).
- **G2 (password unificada)**: wizard guarda usuario+contraseña → `agent-config.json.dashboard` (ya existe) **y** propaga a `.env` como `OMNIROUTE_MANAGE_PASSWORD` + recreate omniroute. `INITIAL_PASSWORD` se re-aplica en cada recreate (verificado experimentalmente) → cambiar = update .env + `up -d --force-recreate omniroute`.
- **G2b (login UX)**: panel Ajustes muestra credenciales activas + aviso de que la misma contraseña abre Hermes (:8080) y OmniRoute (:20128).
- **G3 (versión)**: `/api/version` (existe) alimenta Sidebar; logo→GitHub repo.
- **G4 (header)**: quitar badge SYSTEM HEALTHY (Header.jsx + CSS).
- **G5 (logout)**: borrar botón LOGOUT (no hay auth en el front; botón muerto).
- **G6 (PC fullscreen)**: eliminar scrollbar horizontal (root cause en CSS).
- **G7 (móvil)**: responsive completo: grids → 1 col, header, chat, tabs, inputs, wizard.

## Capabilities

### New: unified-access-credential
Una credencial de acceso para todos los paneles del stack.

### Modified: ui-navigation
Header sin health badge, sidebar con versión real y sin logout.

### New: mobile-responsive
Layout usable en móvil (<768px) y sin scroll horizontal en PC.
