# Specs: infra-repo-workflow

## ADDED Requirements

### Requirement: Repo GitHub privado como backup

El repo local `C:\proyectoBueno\cerebro virtual` tendrá un remoto GitHub privado `cerebro-virtual-dev` que funciona como mirror/backup del código actual.

#### Scenario: Primer push al remoto privado

- **WHEN** se configura el remoto y se hace push inicial desde `dev`
- **THEN** el repo `cerebro-virtual-dev` existe en GitHub, es privado, y contiene el historial del repo local
- **AND** el contenido publicado NO incluye la bóveda, secreto, `sistema-agente/`, `instances/`, ni ficheros con credenciales

#### Scenario: Caducidad de autenticación gh

- **WHEN** el código device-flow de `gh auth login` ha caducado (~15 min tras generarse)
- **THEN** se re-ejecuta `gh auth login` con un código nuevo antes de continuar con cualquier operación remota

---

### Requirement: Rama dev con flujo dev → main

Todo el trabajo de edición ocurre en la rama `dev`. El paso a producción (`main`) es manual y aprobado por el usuario mediante PR y merge manual.

#### Scenario: Trabajo normal en dev

- **WHEN** se edita cualquier fichero del repo
- **THEN** los cambios se commitean y pushean a `dev`
- **AND** NO se hace push directo a `main`

#### Scenario: Salida a producción

- **WHEN** el usuario da el visto bueno a los cambios en `dev`
- **THEN** se abre un PR `dev → main`
- **AND** el merge es manual (aprobado y ejecutado tras el visto bueno)

---

### Requirement: .gitignore como frontera de seguridad

El `.gitignore` excluye explícitamente todo dato privado o de usuario: bóveda, datos de usuario, `sistema-agente/`, `instances/`, y cualquier fichero con credenciales o tokens.

#### Scenario: Cambios en .gitignore

- **WHEN** se actualiza el `.gitignore` en la rama `dev`
- **THEN** los cambios se commitean y pushean a `dev` (no a `main`)

#### Scenario: Verificación previa al primer push

- **WHEN** se prepara el primer push al remoto privado
- **THEN** se revisa la lista de ficheros a publicar (`git status` / `git ls-files`) y se confirma que ninguno pertenece a las categorías excluidas
