@echo off
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

docker info >nul
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

    docker info >nul
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

docker compose version >nul 2>&1
if errorlevel 1 (
    where docker-compose >nul 2>&1
    if errorlevel 1 (
        echo.
        echo ERROR: Docker Compose no esta instalado.
        echo Viene incluido con Docker Desktop, reinstalalo si es necesario.
        echo.
        pause
        exit /b 1
    ) else (
        set COMPOSE_CMD=docker-compose
    )
) else (
    set COMPOSE_CMD=docker compose
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
    echo Creando carpeta vault...
    mkdir vault
)

echo.

REM -----------------------------------------------------------------
REM 5. LEVANTAR SISTEMA
REM -----------------------------------------------------------------
echo [5/5] Iniciando contenedores...
echo Construyendo y levantando el sistema...
echo (Esto puede tomar varios minutos la primera vez)
echo.

%COMPOSE_CMD% up -d --build
if errorlevel 1 (
    echo.
    echo ERROR: No se pudo iniciar el sistema con Docker Compose.
    echo Revisa los logs con: %COMPOSE_CMD% logs -f
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
echo Comandos utiles:
echo   Ver logs:      docker-compose logs -f
echo   Parar sistema: docker-compose down
echo   Reiniciar:     docker-compose restart
echo.
echo La API key de OpenRouter se configura en:
echo   Ajustes > Apis Agentes (dentro de la web)
echo.

pause