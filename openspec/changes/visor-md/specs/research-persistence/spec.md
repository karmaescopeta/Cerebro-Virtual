# research-persistence — Delta Spec

## ADDED Requirements

### Requirement: La investigación persiste en la sesión
Al terminar una investigación, el backend SHALL guardar el documento como mensaje `assistant` de la sesión activa (contenido = resumen, `context.is_document = true`, `context.offer_save = true`, doc completo en `full_doc`) ANTES de responder la petición HTTP. El frontend SHALL añadir el mensaje localmente para que aparezca sin recargar.

#### Scenario: Sobrevive la recarga
- WHEN el usuario recarga la página tras una investigación
- THEN el doc aparece en el chat con el botón Visualizar y "Ver investigaciones" lo lista

#### Scenario: Recarga a mitad del proceso
- WHEN el usuario recarga mientras el backend sigue investigando
- THEN el doc queda persistido igualmente por el backend y aparece al recargar (el toast no llega, el contenido no se pierde)

### Requirement: Ver investigaciones lee de las sesiones
"Ver investigaciones" SHALL listar los mensajes con `context.is_document` de todas las sesiones (no SHALL depender de estado en memoria). Cada entrada abre el doc con onOpenHistoryDoc → DocReader.

#### Scenario: Historial tras recargar
- WHEN el usuario abre "Ver investigaciones" tras recargar la página
- THEN aparecen las investigaciones anteriores con su tema y doc

### Requirement: Procesos largos no bloqueantes
Investigación, edición+re-grafo y subida de archivos SHALL ejecutarse fire-and-forget desde la UI: la petición se lanza, el usuario queda libre para navegar por la app, y un toast global SHALL avisar al terminar (éxito o error). El botón que lanza el proceso SHALL deshabilitarse solo durante su propia ejecución.

#### Scenario: Investigar y navegar
- WHEN el usuario lanza una investigación y cambia a otra pestaña (Cerebro, Grafo)
- THEN la app sigue navegable y al terminar aparece el toast con el resultado

#### Scenario: Toast global
- WHEN cualquier proceso largo termina
- THEN un toast fijo (esquina inferior) muestra el resultado unos segundos, sin bloquear nada