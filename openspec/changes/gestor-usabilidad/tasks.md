# Tasks — gestor-usabilidad

Fuente de verdad de hallazgos: `design-plans/auditoria-gestor-2026-10-06.md` (IDs C1-C5, U1-U16, M1-M5). Verificación por fase: re-ejecutar el arnés de la auditoría (server en proceso + exe simulado + docker mockeado) y los checks listados en cada tarea. Leyes: patch quirúrgico, stdlib, NO_WINDOW en todo subprocess, no romper endpoints existentes.

## Fase 1 — Crashes (C1-C5)

- [x] 1.1 C1: límite 64 chars en `/api/create` (junto a la regex actual) con mensaje "El nombre es demasiado largo — usa 64 como mucho". Test: POST 300 chars → JSON error (antes RemoteDisconnected). ✔ E2E: 300/65 → 400 claro, 64 OK
- [x] 1.2 C1: try/except en `instance_create` devolviendo `{"error": ...}` para excepciones de filesystem. Test: nombre 64 chars en path profundo OK. ✔ + rmtree de restos parciales
- [ ] 1.3 C1: validación en vivo de longitud en el modal JS (deshabilita Crear) — se completa en Fase 4 (helper), aquí solo backend.
- [x] 1.4 C2: `instance_stop` catch `TimeoutExpired` → JSON "cerebro grande: está tardando en pararse — espera un momento y reintenta". Timeout 60→300. ✔ E2E: JSON legible
- [x] 1.5 C3: `instance_remove` igual + `rmtree` en `finally`. Test mock TimeoutExpired en down → JSON y carpeta borrada. ✔ E2E: aviso JSON + carpeta fuera
- [x] 1.6 C2/C3: el loading del frontend (showLoading en stopInst/removeInst) pasa a tener mensaje de "puede tardar en cerebros grandes". ✔ + __timeout 330s (nuevo timeout backend)
- [x] 1.7 C4: `START_LOGS` de tareas con prefijo `task:` (setup/deps/move/dockermove/relocate) en app.py; `/api/logs/` acepta `task:<id>` (regex extendida); frontend `showLog('task:setup')` en las 5 llamadas de tareas. ✔ grep: 0 claves viejas
- [x] 1.8 C4 test: cerebro "setup" creado + iniciado mientras corre task:setup → dos logs separados, panel correcto "Iniciando setup". ✔ E2E: log propio + task:setup vacío + título UI
- [x] 1.9 C5: `instance_remove` marca `START_LOGS[name]` done (mata guard fantasma) + worker escribe solo en su referencia de buffer. Test auditoría L2: borrar Ocupado arrancándose → recrear → Iniciar funciona. ✔ E2E: recreate+start OK, huérfano killed en la siguiente línea
- [x] 1.10 C5 UI: modal de borrado avisa si el cerebro está Activo/arrancándose ("se parará a la fuerza"). ✔ E2E: aviso visible con ambos casos
- [x] 1.11 Envolver do_POST/do_GET dispatch en try/except → `{"error": "Error inesperado: ..."}` 500 (red de seguridad de todos los anteriores). Test: cualquier endpoint con bug simulado → JSON. ✔ E2E: 500 JSON + POST basura 400

**Extra F1 (causa raíz U17 encontrada al releer):** el worker retenía `LOG_LOCK` durante TODO el compose → `/api/logs` bloqueado → panel sin líneas hasta el final. Fix: lock por línea. ✔ E2E: 3 líneas visibles a mitad de un arranque de 6 líneas. + `--progress=plain` (task 4.7) aplicado en el mismo patch.

## Fase 2 — Primer contacto (U1, U4, U6)

- [x] 2.1 U1: "Imágenes base" con `"info": true` en requirements; chip cuenta solo no-info; item pinta "Se descargan solas (~3GB) al primer inicio" con badge neutro. Test: instalación limpia → chip "Todo listo". ✔ E2E: chip Todo listo + badge "Se descargan solas"
- [x] 2.2 U4: estado visible cuando "Nuevo cerebro" disabled: línea de texto con el paso que falta (docker caído / sistema sin instalar), title se mantiene. ✔ E2E: "Termina de instalar el sistema (arriba)…"
- [x] 2.3 U4: botón "Arrancar Docker" (Windows, docker instalado, motor caído): Popen Docker Desktop.exe + NO_WINDOW + toast "Arrancando Docker — espera a la ballena verde". Endpoint nuevo `POST /api/start-docker` (no rompe nada). ✔ E2E: lanza 1x, {ya:true} si ya corre
- [x] 2.4 U6: primera pantalla del modal (exe nuevo sin sistema): "¿Ya tienes Cerebro Virtual instalado en este ordenador?" [Sí — señalar su carpeta] [No — instalarlo ahora] + volver atrás. Cada rama con título propio. ✔ E2E: pregunta + ramas con h2/footers correctos
- [x] 2.5 U6: la checkbox "Mover datos de Docker" solo en la rama instalar (como hoy). Test del flujo README completo (L1 de la auditoría) re-ejecutado OK tras el cambio. ✔ E2E: instalación REAL codeload completa + crear cerebro OK

## Fase 3 — Botones y vocabulario (U5, U13)

- [x] 3.1 U5: card "Sistema" (solo project_ready) con los 2 botones grandes + subtítulos con el texto de los ⓘ. ✔ E2E: card presente, explicaciones al lado
- [x] 3.2 U5: quitar los 4 botones+ⓘ del h2 "Tus cerebros" y eliminar `showInfo` muerto. ✔ E2E + función borrada
- [x] 3.3 U13: glosario fijo "el sistema" / "tus cerebros"; "Descargar Cerebro Virtual"→"Instalar Cerebro Virtual", "Proyecto descargado"→"Sistema instalado", panel "Instalando Cerebro Virtual", backend "El sistema ya está instalado". ✔

## Fase 4 — Feedback y validación (U17, U3, U2, U12, U8, U10, U11)

- [x] 4.1 U3 (+1.3): validación en vivo del modal crear (regex + longitud 64 + vacío) con motivo bajo el input y Crear disabled. ✔ E2E: "mi cerebro"→"Sin espacios ni acentos…"+disabled; válido habilita
- [x] 4.2 U2: borrado case-insensitive + hint "No coincide — cópialo tal cual: X". ✔ E2E: minúsculas habilita, hint visible
- [x] 4.3 U12: "Ya existe una carpeta llamada X — si es tuya, dale otro nombre o bórrala primero". ✔ E2E
- [x] 4.4 U8: toast único (reemplaza), errores 8s/hasta clic, role=alert. ✔
- [x] 4.5 U10: showLog al done → badge Terminado/Error + botón Abrir (puerto real de /api/instances) + Cerrar; panel vive en body (render no lo destruye) con ×. ✔ E2E: Terminado+Abrir+persiste
- [x] 4.6 U11: startingSet — fila "Arrancando…" disabled hasta done. ✔ E2E
- [x] 4.7 U17 (reportado): `--progress=plain` — aplicado en Fase 1 (misma zona), assert en E2E
- [x] 4.8 U17: reloj "X:XX transcurridos" (tick 1s) + última línea siempre visible. ✔ E2E: 0:00→0:01 transcurridos, "Building cerebro…" visible

## Fase 5 — Pulido (U7, U9, U15, U16, M1-M5)

- [x] 5.1 U7: tabla Nombre·Estado·Recursos·Acciones; sin puertos; size solo >0.1GB; Abrir con title URL. ✔ E2E: ths exactos, sin 0.0GB, title localhost:5173
- [x] 5.2 U9: Nueva carpeta input inline + validación Windows en vivo. ✔ E2E: "mis:cosas"→motivo+disabled; "Cerebros" creada
- [x] 5.3 U16: traducción Pulling/Downloading→"Descargando X" etc. (las 4 variantes) — URLs linkificadas con escape. ✔ E2E: "Descargando 1.049MB"
- [x] 5.4 M1: download_project busca solo Cerebro-Virtual* (extracted y final). ✔
- [x] 5.5 M3: cache TTL 2.5s en list_instances, invalidada por create/stop/remove (_list_invalidate). ✔ E2E: identidad en 2 llamadas
- [x] 5.6 M4: sin winget → URLs al log clicables (linkify), sin webbrowser.open en bucle. ✔
- [x] 5.7 M5: selector nativo caído → "No pude abrir el explorador de carpetas — inténtalo otra vez…". ✔ E2E
- [x] 5.8 U15: README "Si algo falla" reescrito al gestor (Arrancar Docker, panel reloj, parar/reintentar); comandos a "Para técnicos". ✔
- [x] 5.9 U18 (reportado): README paso 1 Virtualización (comprobar con Administrador de tareas; BIOS Intel VT-x/SVM; Plataforma de máquina virtual + wsl --install). ✔

## Fase 6 — Feedback del usuario tras verificación visual (2026-10-06)

- [x] 6.1 Recuadro "Sistema" eliminado → tuerca (icono settings) arriba a la derecha que abre el modal **Ajustes** con 3 filas (icono-círculo + título + explicación + botón): "Cambiar de carpeta o disco", "Usar un sistema ya instalado", "Liberar espacio del disco de Windows". ✔ E2E + visión glm-4.6v
- [x] 6.2 "Mover datos de Docker" renombrado en TODOS los sitios a **"Liberar espacio del disco de Windows (C:)"** con explicación en lenguaje normal (Docker guarda sus descargas —los moldes de tus cerebros— en un archivo enorme en C:). Checkbox de instalación, modal de confirmación, panel, toast, README y fila de Ajustes con estado "Ya está" cuando ya vive allí. ✔ E2E
- [x] 6.3 `gestor_de_cerebros/` legible: SOLO una carpeta por cerebro + `imagen_Sistema_Base/` con todo el código del sistema. Instalaciones nuevas caen directo ahí (download_project reescrito); las viejas se **auto-migran** al arrancar (solo exe, nunca repos git/dev; cerebros y sueltos no se tocan). `_compose_file_at()` resuelve compose raíz (≤v1.4) vs subdir (v1.5) en todos los flows: find_base, set-base (incluye señalar el subdir directamente → normaliza al padre), relocate guards, scan de otros equipos, move_cerebros. Nombre `imagen_Sistema_Base` reservado en create. ✔ E2E G1+G2 (30 checks): instalación REAL → raíz limpia; migración legacy → código al subdir, cerebro intacto, sueltos intactos; crear "backend" ya no choca.

- [x] 6.4 **FIX v1.5.1 (reportado)**: `unknown flag: --progress` al Iniciar (cualquier cerebro) — compose del Docker Desktop del usuario no admite el flag. Probe con cache (`docker compose up --help` una vez): el flag se añade SOLO si su compose lo soporta. ✔ E2E: compose viejo → up sin flag y arranca OK; compose nuevo → flag presente.
- [x] 6.5 **v1.5.1 (reportado)**: al asignar carpeta del sistema / mover cerebros no quedaba claro DÓNDE queda. Toast de set-base con la ruta resuelta ("Listo — tu sistema vive ahora en: … (N cerebros)"), toast de mudanza con ruta fresca ("Tus cerebros ahora viven en: …"), y el modal de scan ahora muestra la ruta central concreta antes de mover. ✔ E2E 8/8.

- [x] 6.6 **FIX v1.5.2 (reportado)**: dos cerebros con los mismos puertos (cerebro movido con .env sin puertos → compose defaults; cerebro nuevo hereda base porque el detector no veía al parado). `_ensure_ports()` en cada Iniciar: contra .env de otros cerebros + docker ps de contenedores ajenos + netstat (excluyendo los de mi propio stack) — reasigna los libres, reescribe el .env preservando secretos y lo avisa en el log. ✔ E2E: familia 5174 al chocar, secreto intacto, restart propio sin reasignar, ajeno en mi puerto → sube.
- [x] 6.7 **FIX v1.5.2 (reportado)**: frontend "se enciende y se apaga" — dos causas reales halladas con docker inspect en el sistema del usuario: (a) choque de puertos del 6.6 (bind falla → restart loop); (b) contenedores creados SIN conectar a la red del stack (nets= vacío en inspect → nginx "host not found in upstream backend" en bucle, 12 restarts). `_postcheck_recreate()` tras cada arranque OK: `compose ps --all` (NDJSON), servicios que no quedaron running → `up -d --force-recreate --no-deps <svcs>` y log del arreglo. Auto-cura el sistema actual del usuario al re-Iniciar. ✔ E2E: restarting detectado + recreate solo frontend; todo running → nada.

- [x] 6.8 **FIX v1.5.3 (reportado)**: los puertos deben ser ESTÁTICOS — el túnel de Cloudflare apunta a un puerto fijo; reasignar en cada arranque lo desconfigura. `_ensure_ports` reescrito: reasigna SOLO si falta un puerto en el .env o choca con el declarado en el .env de OTRO cerebro (colisión estructural, determinista, converge en una pasada); con los 5 puertos ya en el .env **no se toca nunca más** — la ocupación runtime externa (netstat, contenedores ajenos) solo produce un AVISO en el log pidiendo cerrar al intruso. Log de asignación: "quedan FIJOS a partir de ahora, p. ej. para el túnel de acceso remoto". ✔ E2E 12/12: asigna una vez (5174) + "quedan FIJOS"; 2º arranque .env bit a bit intacto; netstat ajeno y contenedor ajeno en puerto fijo → AVISO sin cambiar el .env; colisión estructural resuelta; postcheck vivo.

## Cierre

- [x] 7.1 `py -m py_compile installer/app.py` + `node --check` JS inline — ambos OK (rondas durante todo el desarrollo).
- [x] 7.2 Arnés re-ejecutado: L1, F1 (22), F2 (18), FINAL (25/25), G1+G2 estructura nueva (19+13) — todos los bugs de la auditoría en verde.
- [x] 7.3 `GESTOR_VERSION = "1.5.0"` ✔ + compilar exe.
- [x] 7.4 Verificación visual por el usuario — hecha EN VIVO durante el ciclo (el usuario probó el exe real: reportó el crash de --progress, los puertos duplicados y el frontend en bucle, todos verificados y arreglados). ✔
- [x] 7.5 `openspec validate` ✔ + sección en `design-plans/installer-redesign.md` ✔. Release: commit `6dab87e` + tag **v1.5.3** — CI success, assets verificados vía API: `GestorDeCerebros.exe` 9.1MB + `GestorDeCerebros-linux` 21.1MB publicados. ✔
