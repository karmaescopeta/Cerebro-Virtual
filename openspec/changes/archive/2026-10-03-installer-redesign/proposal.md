# Proposal: installer-redesign

## Why

El installer (CerebroInstaller.exe) es la puerta de entrada del producto: gestor de cerebros (crear, iniciar, parar, borrar) del que se abre el frontend. Hoy: UI con paleta propia y Material Symbols Outlined (la web usa Rounded), "Iniciar" = spinner ciego hasta 10 min, no hay botón para abrir la instancia, el borrado destruye el vault sin rescate, y — lo peor — **cada llamada a docker/git abre una ventana CMD que parpadea** (el usuario no técnico cree que le entró un virus).

## What Changes

- **Fix ventanas CMD**: `creationflags=subprocess.CREATE_NO_WINDOW` en TODOS los subprocess del installer (docker, git, netstat). El exe ya es windowed (console=False) — los hijos eran los que parpadeaban.
- **Inicio con log en vivo**: `instance_start` corre en background thread capturando las líneas de `docker compose up -d --build`; el frontend hace polling a un endpoint nuevo `GET /api/logs/<instancia>` y las muestra en un panel legible. Se ve actividad real, no un spinner muerto.
- **Botón Abrir** en instancias activas → abre `http://localhost:{FRONTEND_PORT}` (la promesa del producto: un clic y estás dentro).
- **Descarga del vault** antes de borrar: endpoint `GET /api/download/<instancia>` que zipea `instances/<nombre>/vault/` y lo sirve al navegador. Botón "Descargar vault" junto a Borrar — OPCIONAL: el borrado funciona igual sin descargar nada.
- **Borrado con confirmación tecleada**: escribir el nombre de la instancia para confirmar (borra TODO el vault — merece la fricción).
- **Auto-refresh del estado**: polling de `/api/instances` cada ~5s.
- **Reskin + copy**: paleta = tokens de la web (mismos valores), Material Symbols Rounded, copy en español de una sola voz. El flujo JS de gestión NO se reescribe (Hopkins).
- **Distribución**: el usuario descarga UN archivo (exe de GitHub Releases) → lo abre → gestor de cerebros → clic → frontend. La advertencia SmartScreen (exe sin firmar) se acepta CON INSTRUCCIONES claras (opción a) — se documenta en README + punto 5. Certificado de firma (opción b, ~200-500€/año): cuando haya usuarios; apuntado en la skill cerebro-ideas como coste de distribución futuro.

## Capabilities

### New Capabilities
- `installer-manager`: Gestor de cerebros — UX del instalador (reskin, abrir, log en vivo, descarga vault, borrado seguro, sin CMD visible).

### Modified Capabilities
<!-- ninguna: /api/requirements, /api/instances, /api/create, start/stop/remove mantienen contrato -->

## Impact

- `installer/app.py` — patch: flag CREATE_NO_WINDOW, start en thread + buffer de log, 2 endpoints nuevos (logs, download).
- `installer/index.html` — patch: reskin CSS (tokens web, Rounded), botones Abrir/Descargar, modal borrado tecleado, polling estado + log, copy ES.
- Sin deps nuevas (http.server + zipfile + threading, todo stdlib).
- La advertencia SmartScreen NO se elimina con código: instrucciones al usuario; firma de código = decisión de negocio futura (cerebro-ideas).
