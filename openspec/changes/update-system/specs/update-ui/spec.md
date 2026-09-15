## ADDED Requirements

### Requirement: Notification Icon
El Header SHALL mostrar un icono de notificaciones en la esquina superior derecha con badge rojo cuando hay updates disponibles.

#### Scenario: Updates disponibles
- GIVEN `GET /api/updates/check` retorna `update: true` para Cerebro o Hermes
- WHEN la página carga
- THEN el Header muestra icono campana con punto rojo

#### Scenario: Sin updates
- GIVEN `GET /api/updates/check` retorna `update: false` para ambos
- WHEN la página carga
- THEN el Header muestra icono campana sin badge

### Requirement: Notification Dropdown
El icono de notificaciones SHALL abrir un desplegable hacia la izquierda mostrando el estado de updates.

#### Scenario: Desplegable abierto
- GIVEN hay updates disponibles
- WHEN el usuario hace click en el icono
- THEN se abre un panel desplegable lateral izquierdo
- AND muestra 2 secciones: "Cerebro Virtual" y "Hermes Agent"
- AND cada sección muestra versión actual → versión disponible
- AND cada sección con update tiene botón "Actualizar"

#### Scenario: Update en progreso
- GIVEN el usuario hizo click en "Actualizar"
- WHEN el update está en curso
- THEN el botón muestra spinner + "Actualizando..."
- AND el botón se deshabilita

#### Scenario: Update fallido con rollback
- GIVEN un update de Hermes falló
- WHEN el desplegable está abierto
- THEN la sección Hermes muestra error + botón "Rollback"
