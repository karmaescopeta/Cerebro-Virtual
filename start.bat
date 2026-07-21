@echo off
setlocal enabledelayedexpansion
title Cerebro Virtual - Inicio

echo =========================================
echo  CEREBRO VIRTUAL - INICIO
echo =========================================
echo.

REM -----------------------------------------------------------------
REM 1. VERIFICAR DOCKER
REM -----------------------------------------------------------------
echo [1/5] Verificando Docker...

where docker >nul
if errorlevel 1 (
    echo.
    echo ERROR: Docker no esta instalado.
    echo Descargalo desde: https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)
echo OK: Docker instalado.
echo.

REM -----------------------------------------------------------------
REM 2. VERIFICAR QUE DOCKER ESTE CORRIENDO
REM -----------------------------------------------------------------
echo [2/5] Verificando que Docker este en ejecucion...

docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo ADVERTENCIA: Docker no esta corriendo.
    echo Intentando abrir Docker Desktop...

    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        echo Abriendo Docker Desktop...
    ) else if exist "C:\Program Files\Docker\Docker\resources\bin\docker.exe" (
        start "" "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
        echo Abriendo Docker Desktop...
    ) else (
        echo.
        echo No se encontro Docker Desktop.
        echo Por favor, abrelo manualmente y espera a que termine de iniciar.
        echo Luego vuelve a ejecutar este script.
        echo.
        pause
        exit /b 1
    )

    echo.
    echo Esperando 30 segundos para que Docker arranque...
    timeout /t 30 /nobreak >nul

    docker info >nul 2>&1
    if errorlevel 1 (
        echo.
        echo ERROR: Docker no arranco despues de 30 segundos.
        echo Por favor, abrelo manualmente y vuelve a ejecutar este script.
        echo.
        pause
        exit /b 1
    )
    echo OK: Docker se inicio correctamente.
) else (
    echo OK: Docker ya estaba en ejecucion.
)
echo.

REM -----------------------------------------------------------------
REM 3. VERIFICAR DOCKER COMPOSE
REM -----------------------------------------------------------------
echo [3/5] Verificando Docker Compose...

set "COMPOSE_CMD="

docker compose version >nul 2>&1
if !errorlevel! equ 0 (
    set "COMPOSE_CMD=docker compose"
) else (
    where docker-compose >nul 2>&1
    if !errorlevel! equ 0 (
        set "COMPOSE_CMD=docker-compose"
    )
)

if not defined COMPOSE_CMD (
    echo.
    echo ERROR: Docker Compose no esta instalado.
    echo Viene incluido con Docker Desktop, reinstalalo si es necesario.
    echo.
    pause
    exit /b 1
)
echo OK: Docker Compose instalado.
echo.

REM -----------------------------------------------------------------
REM 4. PREPARAR ENTORNO
REM -----------------------------------------------------------------
echo [4/5] Preparando entorno...

if not exist .env (
    echo Creando .env por defecto...
    echo OPENROUTER_API_KEY= > .env
)

if not exist vault (
    echo Creando estructura de vault...
    mkdir vault
)

REM Asegurar estructura del vault
if not exist vault\raw mkdir vault\raw
if not exist vault\raw\.processed mkdir vault\raw\.processed
if not exist vault\wiki mkdir vault\wiki
if not exist vault\outputs mkdir vault\outputs
if not exist vault\system mkdir vault\system

echo.
echo Estructura del vault:
echo   vault\raw\       - Materia prima inmutable
echo   vault\wiki\      - Conocimiento procesado
echo   vault\outputs\   - Informes generados
echo   vault\system\    - Configuracion del sistema
echo.

REM -----------------------------------------------------------------
REM 5. LEVANTAR SISTEMA
REM -----------------------------------------------------------------
echo [5/5] Iniciando contenedores...
echo Construyendo y levantando el sistema...
echo (Esto puede tomar varios minutos la primera vez)
echo.

!COMPOSE_CMD! --profile agent --profile tools up -d --build
if !errorlevel! neq 0 (
    echo.
    echo ERROR: No se pudo iniciar el sistema con Docker Compose.
    echo Revisa los logs con: !COMPOSE_CMD! logs -f
    echo.
    pause
    exit /b 1
)

echo.
echo =========================================
echo  SISTEMA INICIADO CORRECTAMENTE
echo =========================================
echo.
echo Frontend:    http://localhost:5173
echo Backend API: http://localhost:8000
echo Vault:       %CD%\vault
echo.
echo Estructura del Vault:
echo   raw\       - Archivos originales (inmutable)
echo   wiki\      - Conocimiento procesado (Markdown)
echo   outputs\   - Informes y resumenes generados
echo.
echo Subagentes disponibles:
echo   - Coordinador (interfaz con el usuario)
echo   - Editor (corrige y amplía wiki)
echo   - Investigador-Resumidor (resumenes y mapas)
echo   - Indexador (indice global)
echo   - Sintetizador (procesa raw/ a wiki/)
echo.
echo Comandos utiles:
echo   Ver logs:      !COMPOSE_CMD! logs -f
echo   Parar sistema: !COMPOSE_CMD! down
echo   Reiniciar:     !COMPOSE_CMD! restart
echo.
echo Presione una tecla para continuar . . .
pause >nul

endlocal
