# Design — gestor-usabilidad

Restricciones heredadas (skill gestor-cerebros-review, no negociables): solo stdlib; patch quirúrgico (nunca reescribir ficheros enteros); no romper contratos de endpoints existentes (añadir, no cambiar); todo subprocess nuevo con `creationflags=NO_WINDOW`; iconos solo de la lista verificada; `color-mix()` para tintes.

## D1. Errores siempre JSON — un solo lugar

`do_POST`/`do_GET` envuelven cada dispatch en un try/except genérico que devuelve `{"error": "..."}` 500-friendly. Es UN punto (el handler), no 30 try/except repartidos. Además:

- `instance_create`: valida `len(name) > 64` en `do_POST /api/create` (mismo sitio que la regex actual) y try/except propio en `instance_create` para excepciones de filesystem.
- `instance_stop`/`instance_remove`: `timeout=300` (parar no es urgente; el frontend ya tiene loading) + catch `TimeoutExpired` → JSON "cerebro grande: está tardando en pararse". `instance_remove` hace `rmtree` en `finally` para no dejar la carpeta aunque down falle.

## D2. Pseudo-nombres con prefijo — clave vs URL

Hoy: `START_LOGS["setup"]` lo usan `download_project` (tarea) y podría usarlo un cerebro. Cambio:

- Las TAREAS usan claves `task:setup`, `task:deps`, `task:move`, `task:dockermove`, `task:relocate` en `START_LOGS`.
- `/api/logs/` acepta ambos formatos: los logs de cerebro siguen SIN prefijo (compatibilidad total con el frontend actual), las tareas se piden con `task:` — `valid_name` del endpoint se extiende con una rama `^task:(setup|deps|move|dockermove|relocate)$`.
- Frontend: `showLog('setup')` → `showLog('task:setup')` en las llamadas de tareas (el título del panel ya dependía de esto, se mapea igual).

Un cerebro llamado `setup` sigue siendo válido: su log vive en `START_LOGS["setup"]`, la tarea en `START_LOGS["task:setup"]` — sin colisión y sin bloquear nombres al usuario.

## D3. Muerte del fantasma en remove

`instance_remove` cierra el buffer de arranque si existe: `START_LOGS[name] = {"lines": [...], "done": True, "ok": False}` (o marca kill). El Popen huérfano seguirá vivo hasta que docker termine (no se puede matar limpio sin guardar el pid), pero el NUEVO start ya no queda bloqueado porque el guard (`done is False`) ve done=True. Si llega la salida del worker viejo tarde, escribirá en un buffer ya reemplazado por el nuevo start — el dict se sobreescribe por clave y el último estado manda; el worker viejo escribe en `START_LOGS[name]` que ya es el nuevo buffer: para blindarlo, el worker captura su buffer POR REFERENCIA al empezar (hoy ya lo hace: `buf = START_LOGS.get(name)` dentro del for… se re-checkea; se endurece guardando la referencia al buffer propio al inicio del worker y escribiendo SOLO en esa referencia). 1 línea de cambio.

## D4. Chip honesto + estado visible (U1/U4)

- `check_requirements`: "Imágenes base" pasa de `ok: bool` a informativo: se excluye del cálculo de `faltan` (el frontend lo filtra por nombre → mejor: añadir `"info": true` al item y que el chip cuente solo los que no son info; el item se pinta con badge neutro "Se descargan solas (~3GB)").
- Botón "Nuevo cerebro": cuando disabled, se muestra debajo (o en su lugar) una línea de estado con el bloqueo actual ("Arranca Docker Desktop y espera a la ballena verde"). El title se mantiene para desktops.
- Botón "Arrancar Docker" (solo Windows + Docker instalado + motor caído): lanza `Docker Desktop.exe` con Popen+NO_WINDOW, con toast "Arrancando Docker…". Es opcional y reversible — no abre nada más.

## D5. Sección "Sistema" (U5) y pregunta inicial (U6)

- El h2 "Tus cerebros" pierde los 4 botones+ⓘ. Nueva card compacta "Sistema" (entre Requisitos y Tus cerebros, solo cuando `project_ready`): dos botones grandes uno por fila: "Abrir carpeta existente — ya lo tengo instalado en otro sitio" y "Mover todo a otra carpeta o disco". Los textos completos de los ⓘ pasan a subtítulos. Los `showInfo` quedan obsoletos → eliminar.
- Modal de primera instalación (exe sin gestor.json y sin sistema cerca): la primera pantalla es la pregunta "¿Ya tienes Cerebro Virtual instalado en este ordenador?" [Sí, señalar su carpeta] [No, instalarlo ahora]. Cada rama lleva al explorador con título propio: instalar → "¿Dónde guardo tus cerebros?"; señalar → "¿Dónde está instalado tu sistema?". Un botón "atrás" vuelve a la pregunta (user freedom).
- `dockerMoveRoot` (checkbox de mover datos de Docker) solo aparece en la rama "instalar".

## D6. Validación en vivo (U3/U9)

Sin framework: helper JS `validateName()` con las reglas (regex, longitud, obligatorio) usado por el input del modal de cerebro y el input inline de Nueva carpeta (reemplaza `prompt()`). Bajo el input, `<div class="field-error">` con el motivo; botón deshabilitado hasta válido. El patrón de "Nueva carpeta" pasa a mini-form dentro del explorador (input + botón Crear).

## D7. Toasts y paneles (U8/U10/U11)

- `toast()`: un solo contenedor; un toast nuevo REEMPLAZA al anterior; errores 8s, éxitos 3s; `role="alert"`.
- `showLog` al terminar: añade al panel línea final "✓ $n iniciado" + botón "Abrir" (link a localhost:puerto leído de la instancia) — el panel ya no se destruye al done; se limpia en el siguiente start o al cerrarlo (×).
- `startInst`: tras click, deshabilita el botón de esa fila vía `data-starting="<name>"` en el DOM y el render lo respeta (guardo en una var JS `startingSet` que render consulta).

## D8. Tabla (U7)

Columnas: Nombre · Estado · Recursos · Acciones. El botón "Abrir" YA abre el puerto correcto — basta eliminar las columnas de puertos y size "0.0GB" (`i.size_gb` solo si >0.1GB). Sin tocar el backend: `.ports` siguen en la API para debugging. Si acaso, title="localhost:5173" en el botón Abrir.

## D9. Primer arranque interpretado (U16)

En `showLog` (frontend), traducción de patrones comunes del output de compose ANTES de mostrar la línea: `^Pulling` → "Descargando las piezas del sistema (~3GB la primera vez)…", `^Building` → "Construyendo…". Log técnico completo en un `<details>` colapsable. Solo JS de presentación, cero cambios de backend.

## D10. README (U15)

Reescritura de "Si algo falla": cada problema → acción en el gestor (parar/arrancar desde la tabla, panel de logs, sección Sistema). Los comandos docker logs/down pasan a "Para técnicos" al final de la sección. Añade el paso "Arrancar Docker" con el botón nuevo. No toca arquitectura (sección "Para los técnicos" ya correcta).

## D12. Primer arranque con feedback vivo (U17 — reportado por el usuario)

Verificado en vivo (2026-10-06): el stdout de `instance_start` es un PIPE (no TTY). En ese modo (a) buildkit oculta TODOS los pasos de la fase build, y (b) el pull de un layer grande solo imprime unos pocos "Downloading X" (checkpoints) — minutos de panel sin nada nuevo. `--progress=plain` en el pull no cambia nada (auto≈plain sin TTY), pero sí desoculta los pasos de build.

- Backend (1 flag): `compose_cmd(name, "up", "-d", "--build", "--progress=plain")` en `instance_start`.
- Frontend: el panel de arranque añade (a) **contador "X:XX transcurridos"** con tick de 1s (independiente del log — demuestra que el gestor vive aunque docker calle), (b) **última línea de actividad** siempre visible encima del log (la del poll más reciente), (c) traducción de líneas: `Downloading X` → "Descargando X" (se suma a U16/D9). Sin barra de progreso real: el agregado de capas de 8 servicios no da un % honesto y un % falso es peor (el reloj + líneas reales bastan).

## D13. README: virtualización (U18 — reportado por el usuario)

En "¿Qué necesitas antes de empezar?", antes de Docker: bloque "Virtualización activada" con 4 pasos cortos: (1) comprobar con Ctrl+Shift+Esc → Rendimiento → CPU → "Virtualización: Habilitado"; (2) si dice "Deshabilitado": reiniciar y entrar en BIOS/UEFI (tecla según fabricante, F2/Supr/F10) → activar "Intel Virtualization Technology (VT-x)" o "SVM Mode" (AMD); (3) en Windows: características "Plataforma de máquina virtual" y "Subsistema de Windows para Linux" (o `wsl --install` en terminal, una línea); (4) reiniciar. Nota de una línea: Docker Desktop avisa él solo si falta.

## D11. M-robustez (M1-M5)

- M1: `download_project` tras extraer busca la carpeta con compose SOLO dentro de las que empiecen por "Cerebro-Virtual" (la raíz del zip de codeload) — no cualquier carpeta previa.
- M3: cache ligera de `list_instances`: TTL 2.5s en memoria (dict + timestamp) — el auto-refresh de 5s la aguanta y los POST de acción la invalidan.
- M4: enlaces de descarga sin winget → panel con los 3 enlaces clicables (no `webbrowser.open` en bucle).
- M5: timeout del selector nativo → mensaje claro al fallar.

## Versionado y despliegue

`GESTOR_VERSION = "1.5.0"`. El exe se recompila con el comando del skill; el binario de Linux igual vía CI (tag `v1.5.0`). El bump del HTML exige recompilar (regla: HTML se sirve de `_MEIPASS`).

## Riesgos

- D2 toca el contrato de `/api/logs` — se mantiene compatible (cerebros sin prefijo siguen funcionando); solo las TAREAS cambian de clave. El frontend y el backend se cambian en el MISMO commit (el gestor se sirve a sí mismo, no hay versión mixta posible).
- D3: el Popen huérfano de un cerebro borrado a mitad de arranque sigue vivo hasta que docker termine — aceptable (no mata nada del usuario; el estado del gestor queda limpio).
- D7: mantener el panel al terminar cambia el guard del auto-refresh (`logActive`) — el panel persistente NO debe bloquear el refresco: `logActive` pasa a false al done (como hoy) y el panel persistente es un nodo aparte que render() no borra (fuera de #app, como los modales).
