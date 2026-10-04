# setup-wizard Specification

## Purpose
TBD - created by archiving change wizard-redesign. Update Purpose after archive.
## Requirements
### Requirement: Copy en voz humana
Todo el texto del wizard (títulos, subtítulos, labels, hints, botones, errores) SHALL estar en español natural y directo, sin jerga de sistema. Los detalles técnicos SHALL aparecer solo junto a campos de riesgo, con hint de una línea que diga para qué sirve el dato y de dónde obtenerlo.

#### Scenario: Welcome
- WHEN el usuario llega al wizard
- THEN ve el nombre del producto, la versión real (de /api/version) y el botón "Empezar"

#### Scenario: Hints de riesgo
- WHEN el usuario llega al campo de API key
- THEN el hint explica qué es y con enlace para obtenerla

### Requirement: Preview de identidad del agente
El paso de personalidad SHALL mostrar una tarjeta en vivo con "Hola, soy {agentName}", el avatar elegido (o icono por defecto) y la directiva de personalidad resumida, actualizándose al escribir.

#### Scenario: Preview en vivo
- WHEN el usuario escribe nombre, personalidad o cambia el avatar
- THEN la tarjeta de preview se actualiza al instante

### Requirement: Avatar durante la instalación
El wizard SHALL permitir subir una imagen del agente (data-URL, máx ~300KB, acepta data:image/*) usando el endpoint `POST /api/agent/avatar` tras la creación de la configuración. Si no se sube imagen, el agente usa su icono por defecto.

#### Scenario: Avatar subido
- WHEN el usuario elige una imagen en el wizard y completa la instalación
- THEN el avatar queda guardado y visible en chat y ajustes

#### Scenario: Sin avatar
- WHEN el usuario completa la instalación sin subir imagen
- THEN la instalación no falla y el agente mantiene su icono por defecto

#### Scenario: Imagen inválida
- WHEN el archivo elegido no es imagen o supera el límite
- THEN el wizard muestra el error sin bloquear el resto del paso

### Requirement: Estilo unificado con la web
El wizard SHALL usar Material Symbols Rounded (fuente de la web), label-caps y tokens duales del sistema. El look oscuro Obsidian Deep del welcome se conserva.

#### Scenario: Iconos unificados
- WHEN se renderiza cualquier paso del wizard
- THEN los iconos provienen de Material Symbols Rounded y la fuente Outlined ya no se carga

#### Scenario: Versión real
- WHEN se muestra la versión en el welcome
- THEN proviene de /api/version, no de un string hardcodeado

### Requirement: Log de instalación legible
Durante la creación, el wizard SHALL mostrar el progreso como un log legible (líneas con estado, sin crudo técnico innecesario) que dé sensación de control.

#### Scenario: Creación en marcha
- WHEN la configuración se está creando
- THEN el usuario ve el log pulido y un indicador de progreso, sin pantalla vacía

