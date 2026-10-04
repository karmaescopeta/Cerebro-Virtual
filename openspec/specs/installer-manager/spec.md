# installer-manager Specification

## Purpose
TBD - created by archiving change installer-redesign. Update Purpose after archive.
## Requirements
### Requirement: Sin ventanas CMD visibles
El installer SHALL ejecutar todos los comandos externos (docker, git, netstat) sin que aparezca ninguna ventana de consola en pantalla. En un exe windowed (console=False), cada subprocess SHALL llevar el flag que suprime la ventana de consola del proceso hijo en Windows.

#### Scenario: Iniciar una instancia
- WHEN el usuario pulsa Iniciar y el backend ejecuta docker compose
- THEN no aparece ninguna ventana CMD parpadeante

#### Scenario: Chequeo de requisitos
- WHEN el installer arranca y ejecuta docker/git/netstat
- THEN ninguna ventana de consola parpadea

### Requirement: Inicio con log en vivo
El inicio de una instancia SHALL ejecutarse en background y SHALL exponer `GET /api/logs/<instancia>` que devuelva las líneas nuevas de la salida de `docker compose up -d --build`. El frontend SHALL mostrar el log en un panel legible durante el inicio.

#### Scenario: Usuario pulsa Iniciar
- WHEN la instancia se está construyendo/arrancando
- THEN el frontend muestra un panel con las líneas del proceso (polling), no un spinner ciego

#### Scenario: Fin del inicio
- WHEN docker compose termina
- THEN el log marca éxito o error y la instancia se refresca en la tabla

### Requirement: Abrir la instancia
Las instancias activas SHALL tener un botón "Abrir" que lance el navegador en `http://localhost:{FRONTEND_PORT}` de esa instancia.

#### Scenario: Abrir con un clic
- WHEN el usuario pulsa Abrir en una instancia activa
- THEN el navegador abre el frontend de esa instancia sin teclear puertos

### Requirement: Descarga del vault
El installer SHALL exponer `GET /api/download/<instancia>` que empaquete `instances/<instancia>/vault/` en un .zip y lo sirva como descarga. Botón "Descargar vault" visible junto a las acciones de cada instancia.

#### Scenario: Rescate antes de borrar
- WHEN el usuario quiere borrar una instancia pero conservar los datos
- THEN descarga el vault como .zip antes del borrado

#### Scenario: Descarga OPCIONAL
- WHEN el usuario quiere borrarlo todo sin descargar nada
- THEN el borrado funciona sin haber descargado nunca el vault — la descarga es una acción disponible, nunca un paso obligatorio

### Requirement: Borrado con confirmación tecleada
El borrado SHALL requerir que el usuario teclee el nombre exacto de la instancia en un modal (el confirm simple es insuficiente: borra todo el vault).

#### Scenario: Borrado confirmado
- WHEN el usuario teclea el nombre exacto y confirma
- THEN la instancia y su vault se eliminan

#### Scenario: Nombre incorrecto
- WHEN el texto tecleado no coincide
- THEN el botón de borrado permanece deshabilitado

### Requirement: Estado en vivo
La tabla de instancias SHALL refrescarse automáticamente (~5s) sin recargar la página.

#### Scenario: Cambio de estado externo
- WHEN una instancia arranca o para por fuera del gestor
- THEN la tabla refleja el estado nuevo sin acción del usuario

### Requirement: Estilo y copy unificados
El installer SHALL usar la paleta de la web (mismos tokens), Material Symbols Rounded y copy en español con una sola voz. El flujo JS de gestión existente SHALL mantenerse (solo CSS, strings y los añadidos especificados).

#### Scenario: Coherencia visual
- WHEN se abre el gestor
- THEN la paleta, tipografía e iconos coinciden con la web

