# Specs: Multi-instancia Cerebro Virtual

## ADDED Requirements

### Requirement: Gestión de instancias

### Requirement: Modo interactivo por defecto
El sistema SHALL, al ejecutar `cerebro-manage.bat` sin argumentos, entrar en modo interactivo.

#### Scenario: Sin instancias existentes
- GIVEN no hay instancias en `instances/`
- WHEN el usuario ejecuta `cerebro-manage.bat` (doble clic)
- THEN el sistema dice "No tienes cerebros creados"
- AND pregunta nombre para la primera instancia
- AND la crea y levanta

#### Scenario: Con instancias existentes
- GIVEN existen 2 instancias en `instances/`
- WHEN el usuario ejecuta `cerebro-manage.bat` (doble clic)
- THEN el sistema dice "Tienes 2 cerebros creados"
- AND pregunta "¿Quieres crear otro distinto? (s/n)"
- WHEN el usuario responde "s"
- THEN pregunta nombre y crea nueva instancia

#### Scenario: Nombre duplicado
- GIVEN una instancia llamada `cerebro2` ya existe
- WHEN el usuario ejecuta `cerebro-manage create cerebro2`
- THEN el sistema rechaza la operación con error "Instancia 'cerebro2' ya existe"

### Requirement: Auto-asignación de puertos
El sistema SHALL asignar puertos únicos a cada instancia nueva, sin colisiones con instancias existentes ni contenedores Docker en uso.

#### Scenario: Primera instancia adicional
- GIVEN la instancia `default` usa puertos 8000/5173/8080/8888
- WHEN el usuario crea instancia `cerebro2`
- THEN los puertos asignados son 8001/5174/8081/8889

#### Scenario: Puerto en uso por contenedor externo
- GIVEN el puerto 8001 está en uso por un contenedor no-Cerebro
- WHEN el usuario crea instancia `cerebro2`
- THEN el backend de cerebro2 usa el puerto 8002 (siguiente libre)

### Requirement: Listar instancias
El sistema SHALL listar todas las instancias con su estado.

#### Scenario: Listar con instancias mixtas
- GIVEN instancias `default` (corriendo) y `cerebro2` (parada)
- WHEN el usuario ejecuta `cerebro-manage list`
- THEN se muestra tabla con: nombre, puertos, estado de contenedores

### Requirement: Parar instancia
El sistema SHALL parar una instancia sin afectar otras.

#### Scenario: Parar una de varias instancias
- GIVEN instancias `default` y `cerebro2` ambas corriendo
- WHEN el usuario ejecuta `cerebro-manage stop default`
- THEN los contenedores de `default` se detienen
- AND los contenedores de `cerebro2` siguen corriendo

### Requirement: Eliminar instancia
El sistema SHALL eliminar una instancia con confirmación.

#### Scenario: Eliminar con confirmación
- GIVEN instancia `cerebro2` existe
- WHEN el usuario ejecuta `cerebro-manage remove cerebro2`
- THEN el sistema pide confirmación
- WHEN el usuario confirma
- THEN se detienen y eliminan los contenedores
- AND se elimina el directorio `instances/cerebro2/`

## ADDED Requirements

### Requirement: Paths de vault y .env via variables
El sistema SHALL usar variables de entorno para los paths de vault y .env en docker-compose.yml.

#### Scenario: Instancia con paths personalizados
- GIVEN `instances/cerebro2/.env` define `VAULT_DIR=instances/cerebro2/vault`
- WHEN se levanta la instancia con `--env-file instances/cerebro2/.env`
- THEN el backend monta `instances/cerebro2/vault` como `/app/vault`
- AND el backend monta `instances/cerebro2/.env` como `/app/.env`

## ADDED Requirements

### Requirement: Visualizar rutas de contenedores
El frontend SHALL mostrar una sección "Rutas" en el tab "Modelos" con todas las URLs internas de los servicios.

#### Scenario: Usuario abre tab Modelos
- GIVEN la instancia está corriendo
- WHEN el usuario navega al tab "Modelos" y baja al final
- THEN ve una tabla con cada servicio: etiqueta, servicio, URL interna, botón copiar

#### Scenario: Copiar URL
- GIVEN la tabla de rutas visible
- WHEN el usuario hace clic en "Copiar" para el servicio `frontend`
- THEN la URL `http://frontend:80` se copia al portapapeles
- AND se muestra confirmación visual

### Requirement: Editar etiqueta de servicio
El usuario SHALL poder editar la etiqueta visual de cada servicio.

#### Scenario: Cambiar etiqueta
- GIVEN la tabla de rutas visible
- WHEN el usuario edita la etiqueta de `frontend` a "Mi Frontend Principal"
- AND guarda
- THEN la etiqueta se persiste en `.env` (`ROUTE_LABEL_FRONTEND=Mi Frontend Principal`)
- AND la URL interna (`http://frontend:80`) no cambia

#### Scenario: Etiqueta vacía
- GIVEN el usuario borra la etiqueta de un servicio
- WHEN guarda
- THEN se usa el nombre del servicio como fallback (`frontend`)
