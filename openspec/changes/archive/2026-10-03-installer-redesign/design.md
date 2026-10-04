# Design — installer-redesign

## Contexto del consejo + grill
- Consejo: abrir con un clic (Godin), log en vivo contra la ansiedad del spinner (Sutherland), copy una voz (Handley), sin features de config nuevas (Hormozi), NO reescribir el flujo JS (Hopkins).
- Grill: polling simple para el log (no SSE); botón Abrir solo al frontend; borrado con nombre tecleado + descarga de vault como rescate; SmartScreen → opción a) instrucciones ahora, certificado cuando haya usuarios (apuntado en cerebro-ideas); petición clave del usuario: CERO ventanas CMD parpadeantes.

## Decisiones

### Fix CMD (la causa raíz)
- app.py: helper `run()` + `instance_start` + `instance_remove` + cualquier subprocess → `creationflags=subprocess.CREATE_NO_WINDOW` (constante de Windows; getattr seguro: `getattr(subprocess, "CREATE_NO_WINDOW", 0)`).
- El spec PyInstaller ya es `console=False` — no se toca.
- Docker Desktop puede abrir su propia UI al arrancar: fuera de nuestro control, se documenta en el README.

### Start en background + log
- `instance_start`: lanza thread que corre `docker compose up -d --build` con `Popen` (stdout=PIPE, text, errors=replace, CREATE_NO_WINDOW) y va llenando un buffer `{name: {"lines": [...], "done": bool, "ok": bool}}` en memoria (dict global + lock — un solo usuario local, ponytail: suficiente).
- `GET /api/logs/<name>`: devuelve `{lines: [...], done, ok}`; el frontend pide cada 1.5s durante un inicio activo y pinta el panel.
- `run()` normal sigue para el resto (rápidos). El polling de estado existente NO cambia de contrato.
- Límite de buffer: últimas ~200 líneas (slice) — evita memoria infinita en builds largos.

### Endpoints nuevos (app.py, patch)
- `GET /api/logs/<name>` — buffer del inicio.
- `GET /api/download/<name>` — `zipfile` del directorio vault de la instancia a un .zip temporal + FileResponse manual (http.server: leer bytes y servir con Content-Disposition). Excluir nada (el vault del backend ya excluye credenciales en /api/vault/export — aquí es rescate local, va completo: es el disco del propio usuario).
- `POST /api/remove/<name>` sigue pero ahora el frontend exige confirmación tecleada antes de llamarlo.

### index.html (patch)
- **Tokens**: reemplazar los valores :root por los de la web (`app.css` de frontend-test4) y la fuente Outlined → Rounded (misma clase `material-symbols-outlined`, font-family Rounded como hace app.css).
- **Botones por instancia**: Abrir (primary, solo si running, `window.open('http://localhost:'+FRONTEND_PORT)`), Descargar vault (secondary), Parar/Iniciar, Borrar (danger).
- **Modal de borrado**: input + botón deshabilitado hasta coincidencia exacta del nombre. Nota informativa "¿Quieres descargar tu vault antes? Es opcional" + enlace/botón Descargar dentro del modal; borrar no exige haber descargado.
- **Panel de log**: bajo la tabla (o modal), mono, auto-scroll, visible durante el inicio activo.
- **Auto-refresh**: setInterval 5s → `render()` solo si no hay modal/log activo abierto (evitar pisar la UI).
- **Copy ES una voz**: "Crea tu primer Cerebro", "Requisitos", "Abre tu cerebro".

## Riesgos
- `Popen` con compose build largo → timeout alto (600s) y done con ok/error; si el thread muere, el log marca error.
- Zip de vault grande → respuesta en memoria; si un vault pasa de ~1GB, buffer del navegador puede sufrir (aceptado — rescate local; streaming chunked si algún día hace falta).
- Auto-refresh pisando el modal de borrado → guard por estado de UI.
- SmartScreen: no es código — README del punto 5 con instrucciones ("Más información → Ejecutar igualmente").
