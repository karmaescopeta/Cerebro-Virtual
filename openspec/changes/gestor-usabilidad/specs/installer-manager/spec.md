# installer-manager Delta — gestor-usabilidad

## MODIFIED Requirements

### Requirement: Borrado con confirmación tecleada
El borrado SHALL requerir que el usuario teclee el nombre de la instancia en un modal. La comparación SHALL ser case-insensitive y, mientras no coincida, el modal SHALL mostrar el motivo ("escribe el nombre tal y como se ve arriba") en lugar de dejar el botón deshabilitado sin explicación.

#### Scenario: Borrado confirmado
- WHEN el usuario teclea el nombre (mayúsculas/minúsculas indiferentes) y confirma
- THEN la instancia y su vault se eliminan

#### Scenario: Nombre incorrecto
- WHEN el texto tecleado no coincide
- THEN el botón de borrado permanece deshabilitado Y se muestra bajo el campo el motivo

#### Scenario: Cerebro encendido o arrancándose
- WHEN el usuario abre el modal de borrado de un cerebro que está Activo o iniciándose
- THEN el modal avisa ("se parará por la fuerza") antes de confirmar

### Requirement: Inicio con log en vivo
El inicio de una instancia SHALL ejecutarse en background y SHALL exponer `GET /api/logs/<instancia>` que devuelva las líneas nuevas de la salida de `docker compose up -d --build`. El frontend SHALL mostrar el log en un panel legible durante el inicio. Al terminar con éxito, el panel SHALL permanecer visible con una línea final de éxito y un botón "Abrir" directo (no desaparece solo).

#### Scenario: Usuario pulsa Iniciar
- WHEN la instancia se está construyendo/arrancando
- THEN el frontend muestra un panel con las líneas del proceso (polling), no un spinner ciego

#### Scenario: Fin del inicio
- WHEN docker compose termina
- THEN el log marca éxito o error, la instancia se refresca en la tabla y el panel conserva la línea final + botón Abrir

### Requirement: Estado en vivo
La tabla de instancias SHALL refrescarse automáticamente (~5s) sin recargar la página. El botón Iniciar de una fila SHALL deshabilitarse en cuanto se pulsa (el estado "iniciándose" llega por el refresco), para que un doble clic nunca produzca un error.

#### Scenario: Cambio de estado externo
- WHEN una instancia arranca o para por fuera del gestor
- THEN la tabla refleja el estado nuevo sin acción del usuario

#### Scenario: Doble clic en Iniciar
- WHEN el usuario hace doble clic sobre Iniciar
- THEN no se envían dos arranques ni se muestra error; la fila queda en estado iniciándose

## ADDED Requirements

### Requirement: Ninguna acción rompe el servidor
Toda operación del gestor SHALL devolver SIEMPRE JSON (éxito o error legible en español), aunque el comando subyacente falle o expire. Ningún endpoint SHALL dejar la conexión sin respuesta (traceback/500 crudo).

#### Scenario: Nombre demasiado largo
- WHEN se crea un cerebro con nombre >64 caracteres
- THEN el endpoint responde con error JSON claro ("el nombre es demasiado largo — 64 caracteres como mucho") y el servidor sigue sirviendo

#### Scenario: Parar un cerebro pesado
- WHEN docker compose stop tarda más de 60s
- THEN el endpoint responde con error JSON claro ("cerebro grande: está tardando en pararse — espera y vuelve a intentarlo") y el servidor sigue sirviendo

#### Scenario: Borrar un cerebro pesado
- WHEN docker compose down tarda más de 60s
- THEN el endpoint responde JSON y NO queda estado a medias oculto (el error dice qué hacer)

#### Scenario: Error inesperado en create
- WHEN el filesystem lanza cualquier excepción durante la creación
- THEN el endpoint responde JSON de error (nunca conexión rota)

### Requirement: Los pseudo-nombres de tareas del gestor no colisionan con cerebros
Los logs de las tareas del propio gestor (descarga del proyecto, dependencias, mudanzas) SHALL usar claves con prefijo reservado (p. ej. `task:setup`, `task:deps`, `task:move`, `task:dockermove`, `task:relocate`) en `START_LOGS` y en `/api/logs/`. Un cerebro con cualquier nombre válido (incluidos setup/deps/move/…) SHALL poder iniciarse con su propio log sin pisar las tareas del gestor.

#### Scenario: Cerebro llamado setup
- WHEN el usuario crea e inicia un cerebro llamado "setup" mientras no hay tareas del gestor corriendo
- THEN el panel muestra "Iniciando setup" con el log de su docker compose (no "Descargando Cerebro Virtual")

#### Scenario: Tarea y cerebro simultáneos
- WHEN la descarga del proyecto corre y existe un cerebro "setup" iniciándose
- THEN los dos logs viven por separado y ambos paneles muestran su propio contenido

### Requirement: Borrar durante un arranque no deja bloqueado el nombre
Al borrar un cerebro cuyo arranque sigue en curso, el gestor SHALL cancelar/marcar el log de esa instancia como terminado, de modo que re-crear el mismo nombre y pulsar Iniciar funcione inmediatamente.

#### Scenario: Recrear tras borrar a mitad de arranque
- GIVEN un cerebro que se está iniciando
- WHEN el usuario lo borra, lo vuelve a crear y pulsa Iniciar
- THEN el arranque nuevo empieza (sin "Ya se está iniciando" fantasma)

### Requirement: Primera impresión honesta
En una instalación limpia con requisitos cubiertos, el gestor SHALL mostrar "Todo listo" — los elementos informativos (imágenes base pendientes de descargar en el primer inicio) NO cuentan como faltantes. El estado de "Nuevo cerebro" deshabilitado SHALL ser visible como texto (qué falta y en qué orden), no solo como tooltip.

#### Scenario: Instalación limpia con Docker y disco OK
- WHEN el usuario termina de instalar y el gestor refresca
- THEN el chip de requisitos dice "Todo listo" y "Imágenes base" aparece como nota informativa ("se descargan solas al primer inicio, ~3GB")

#### Scenario: Sin Docker corriendo
- WHEN el motor de Docker no responde
- THEN el área de Nuevo cerebro muestra el paso pendiente por texto visible ("Arranca Docker Desktop — espera a la ballena verde") y, en Windows, un botón "Arrancar Docker"

### Requirement: Un solo concepto por botón
Las acciones de sistema ("señalar sistema existente" y "mudar el sistema a otra carpeta") SHALL vivir en una sección propia ("Sistema"), separada de la lista de cerebros, con botones titulados con su intención completa — no conviven varios botones similares en la cabecera de "Tus cerebros". El copy de todo el gestor usa un vocabulario fijo: "el sistema" (la instalación) y "tus cerebros" (las instancias).

#### Scenario: Usuario quiere recuperar su sistema en un ordenador nuevo
- WHEN abre el gestor sin sistema encontrado
- THEN la primera pregunta es "¿Ya tienes Cerebro Virtual instalado en este ordenador?" con dos caminos claros: "Sí — señalar su carpeta" y "No — instalarlo ahora"

#### Scenario: Botones de sistema
- WHEN el usuario ve la sección Sistema
- THEN los dos botones muestran la acción completa ("Abrir carpeta existente (ya lo tengo instalado)" / "Mover todo a otra carpeta o disco") y no necesita el icono ⓘ para distinguirlos

### Requirement: Validación del nombre en vivo
El modal de crear cerebro SHALL validar el nombre mientras se escribe: motivo visible bajo el input (caracteres no permitidos, longitud >64, vacío) y el botón Crear deshabilitado hasta que sea válido. El error de "Ya existe" SHALL explicar qué hacer (renombrar o elegir otro nombre).

#### Scenario: Escribiendo "mi cerebro"
- WHEN el usuario teclea un espacio
- THEN bajo el input aparece "Sin espacios — solo letras, números y guiones" y Crear queda deshabilitado

#### Scenario: Nombre repetido
- WHEN el usuario intenta crear un cerebro que ya existe
- THEN el mensaje explica la causa y el remedio ("ya hay una carpeta con ese nombre — si es tuya usa otro nombre o bórrala")

### Requirement: Errores visibles el tiempo suficiente
Los toasts de error SHALL durar mínimo 8 segundos o hasta clic, nunca SHALL apilarse más de uno simultáneo, y SHALL anunciarse a lectores (role=alert). Las acciones largas (instalar, iniciar, mudar) SHALL mostrar el panel de progreso con estado final persistente.

#### Scenario: Error durante la creación
- WHEN falla una operación
- THEN el error permanece en pantalla hasta que el usuario lo lee/cierra

### Requirement: Tabla de cerebros sin ruido técnico
La tabla de cerebros NO SHALL mostrar puertos crudos ni "0.0GB" en la vista principal: una columna "Acceso" clicable (localhost:puerto) para los activos, y recursos solo cuando existan (>0.1GB). Los detalles técnicos SHALL seguir en el .env.

#### Scenario: Cerebro recién creado
- WHEN el cerebro nunca ha arrancado
- THEN la fila muestra nombre + estado Parado + acciones (sin columnas de puertos ni 0.0GB)

#### Scenario: Cerebro activo
- WHEN el cerebro está Activo
- THEN la fila muestra un enlace "Abrir" que lleva a localhost:puerto sin mostrar el número como dato suelto

### Requirement: Crear carpetas con validación
"Nueva carpeta" del explorador SHALL usar un input inline (no prompt nativo) con validación en vivo de los caracteres ilegales de Windows (<>:"/\|?*), mostrando el motivo bajo el campo.

#### Scenario: Nombre de carpeta ilegal
- WHEN el usuario teclea "mis:cosas"
- THEN el input muestra el motivo y el botón queda deshabilitado (el error del SO nunca llega al usuario)

### Requirement: Primer arranque interpretado
Durante el primer arranque de un cerebro, las líneas clave del log de docker (pulling/building/downloading) SHALL mostrar una traducción en español sobre el log técnico crudo ("Descargando las piezas del sistema (~3GB), puede tardar varios minutos"), con el log completo visible en un bloque colapsable. El arranque SHALL ejecutarse con salida verbosa de compose (`--progress=plain`) para que los pasos de construcción no queden ocultos, y el panel SHALL mostrar un contador de tiempo transcurrido que se actualiza cada segundo y la última línea de actividad recibida — el panel nunca SHALL parecer congelado aunque el comando no emita líneas nuevas.

#### Scenario: Primera vez
- WHEN docker pull está descargando imágenes
- THEN el usuario ve la frase en español + porcentaje/actividad, y puede abrir el detalle técnico si quiere

#### Scenario: Minutos sin líneas nuevas de docker
- WHEN la descarga de una capa grande pasa más de 30s sin emitir líneas
- THEN el contador de tiempo transcurrido sigue corriendo (el usuario sabe que el gestor sigue trabajando, no colgado)

### Requirement: Documentación alineada con el gestor
El README ("Si algo falla") SHALL apuntar al flujo del gestor (botones, panel de logs) en lugar de a terminales y .env; las indicaciones de terminal SHALL quedar en una subsección aparte "Para técnicos".

#### Scenario: Usuario B con un problema
- WHEN sigue la sección de fallos del README
- THEN cada problema se resuelve con un botón/panel del gestor o una frase sin comandos

#### Scenario: Ordenador sin virtualización activada
- WHEN el usuario lee los requisitos del README antes de instalar
- THEN el README explica cómo comprobar si la virtualización está activa (Administrador de tareas → CPU) y cómo activarla (BIOS: Intel VT-x / AMD SVM; "Plataforma de máquina virtual" en Windows + wsl --install) antes de instalar Docker
