## ADDED Requirements

### Requirement: Tab MODELOS en Sidebar
El sistema SHALL mostrar una tab "MODELOS" entre GRAFO y AJUSTES.

#### Scenario: Tab visible
- WHEN el usuario abre la app principal
- THEN Sidebar muestra tab "MODELOS" con icono "memory" entre GRAFO y AJUSTES

### Requirement: Vista de tarjetas de modelos
La vista MODELOS SHALL mostrar 5 tarjetas rectangulares, una por perfil, con nombre display arriba y URL del modelo debajo.

#### Scenario: Tarjetas muestran modelo actual
- WHEN el usuario entra a la tab MODELOS
- THEN se muestran 5 tarjetas: Sistema Base, Editor, Indexador, Sintetizador, Investigador
- AND cada tarjeta muestra la URL del modelo asignado

### Requirement: Modo edición
El botón "Editar" SHALL activar inputs editables en cada tarjeta para cambiar nombre display y URL del modelo.

#### Scenario: Edición de campos
- WHEN el usuario pulsa "Editar"
- THEN cada tarjeta muestra 2 inputs: nombre display + URL modelo
- AND el botón "Editar" cambia a "Guardar"

### Requirement: Guardar + reiniciar
El botón "Guardar" SHALL enviar los cambios al backend, que guarda en agent-config.json y reinicia cerebro-agente.

#### Scenario: Guardado con restart
- WHEN el usuario pulsa "Guardar"
- THEN se muestra overlay de carga bloqueando la UI
- AND el backend guarda models en agent-config.json
- AND el backend ejecuta docker restart cerebro-agente
- AND al completar se muestra resumen de cambios

### Requirement: Overlay de carga
Durante el guardado+restart, se SHALL mostrar un overlay que bloquea cambio de pestaña.

#### Scenario: Overlay bloquea navegación
- WHEN el guardado está en curso
- THEN un overlay cubre la pantalla con spinner
- AND el usuario no puede cambiar de tab