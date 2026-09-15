## ADDED Requirements

### Requirement: Update Cerebro Virtual
El sistema SHALL aplicar updates de Cerebro Virtual via `git pull` + rebuild de contenedores afectados.

#### Scenario: Update exitoso
- GIVEN update de Cerebro Virtual disponible
- WHEN el usuario hace click en "Actualizar" en la notificación
- THEN el backend ejecuta `git pull` en el repo local
- AND hace rebuild de contenedores `backend` y `frontend`
- AND retorna `{"success": true}`

#### Scenario: Git pull falla
- GIVEN hay conflictos locales o cambios sin commitear
- WHEN se intenta `git pull`
- THEN retorna `{"success": false, "message": "Conflictos locales"}` sin perder cambios

### Requirement: Update Hermes Agent
El sistema SHALL aplicar updates de Hermes Agent via rebuild del contenedor `sistema-agente` con rollback automático.

#### Scenario: Update exitoso
- GIVEN update de Hermes disponible
- WHEN el usuario hace click en "Actualizar"
- THEN el backend hace `docker tag` de la imagen actual a `<project>-sistema-agente:backup`
- AND hace rebuild con `--no-cache` del contenedor `sistema-agente`
- AND ejecuta post-checks (contenedor arranca + `:8080` responde + patch auth encuentra needle)
- AND si post-checks pasan, retorna `{"success": true}`

#### Scenario: Update rompe sistema
- GIVEN el rebuild de Hermes cambia la estructura interna
- WHEN los post-checks fallan (contenedor no arranca o patch no encuentra needle)
- THEN el backend NO marca como success
- AND retorna `{"success": false, "needsRollback": true, "message": "Update falló"}`
- AND el frontend muestra botón "Rollback"

### Requirement: Rollback Hermes
El sistema SHALL permitir rollback a la imagen anterior inmediatamente después de un update fallido.

#### Scenario: Rollback exitoso
- GIVEN un update fallido con `needsRollback: true`
- WHEN el usuario hace click en "Rollback"
- THEN el backend hace `docker tag <project>-sistema-agente:backup <project>-sistema-agente:latest`
- AND recrea el contenedor
- AND retorna `{"success": true}`

#### Scenario: No hay backup
- GIVEN no existe imagen `:backup`
- WHEN se intenta rollback
- THEN retorna `{"success": false, "message": "No hay backup disponible"}`
