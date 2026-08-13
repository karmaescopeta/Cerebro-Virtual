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
echo [1/6] Verificando Docker...

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
echo [2/6] Verificando que Docker este en ejecucion...

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
        echo Por favor, abrela manualmente y espera a que termine de iniciar.
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
        echo Por favor, abrela manualmente y vuelve a ejecutar este script.
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
echo [3/6] Verificando Docker Compose...

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
echo [4/6] Preparando entorno...

if not exist .env (
    if exist .env.example (
        copy .env.example .env >nul
        echo OK: .env creado desde .env.example
    ) else (
        echo Creando .env por defecto...
        echo COMPOSE_PROJECT_NAME=cerebrovirtual > .env
        echo OPENROUTER_API_KEY= >> .env
        echo BACKEND_PORT=8000 >> .env
        echo FRONTEND_PORT=5173 >> .env
        echo AGENT_PORT=8080 >> .env
        echo SEARXNG_PORT=8888 >> .env
        echo CLOUDFLARE_TUNNEL_TOKEN= >> .env
        echo VAULT_HOST_PATH= >> .env
        echo GITHUB_REPO= >> .env
    )
)

if not exist vault (
    echo Creando estructura de vault...
    mkdir vault
)

if not exist vault\raw mkdir vault\raw
if not exist vault\raw\.processed mkdir vault\raw\.processed
if not exist vault\wiki mkdir vault\wiki
if not exist vault\outputs mkdir vault\outputs
if not exist vault\system mkdir vault\system
if not exist vault\chat-sesiones mkdir vault\chat-sesiones

REM -----------------------------------------------------------------
REM 5. LEER PROYECTO Y TUNNEL DE .env
REM -----------------------------------------------------------------
echo [5/6] Leyendo configuracion...

REM Leer COMPOSE_PROJECT_NAME del .env
set "PROJECT_NAME="
for /f "tokens=1,* delims==" %%a in (.env) do (
    if /i "%%a"=="COMPOSE_PROJECT_NAME" set "PROJECT_NAME=%%b"
)
if not defined PROJECT_NAME set "PROJECT_NAME=cerebrovirtual"
echo OK: Proyecto = !PROJECT_NAME!

REM Detectar contenedores antiguos cerebrovirtual-*
for /f "tokens=*" %%c in ('docker ps -a --filter "name=cerebrovirtual-" --format "{{.Names}}" 2^>nul') do (
    echo ADVERTENCIA: Detectado contenedor antiguo: %%c
    echo Considera ejecutar "docker compose down" antes de continuar.
)
echo.

REM Leer CLOUDFLARE_TUNNEL_TOKEN para decidir si activar profile tunnel
set "TUNNEL_TOKEN="
for /f "tokens=1,* delims==" %%a in (.env) do (
    if /i "%%a"=="CLOUDFLARE_TUNNEL_TOKEN" set "TUNNEL_TOKEN=%%b"
)

set "PROFILE_FLAG="
if defined TUNNEL_TOKEN if not "!TUNNEL_TOKEN!"=="" (
    echo OK: Cloudflare Tunnel detectado, activando perfil tunnel...
    set "PROFILE_FLAG=--profile tunnel"
)

REM Leer VAULT_HOST_PATH si existe
set "VAULT_HOST="
for /f "tokens=1,* delims==" %%a in (.env) do (
    if /i "%%a"=="VAULT_HOST_PATH" set "VAULT_HOST=%%b"
)
if not defined VAULT_HOST set "VAULT_HOST=%CD%\vault"
REM Escribir VAULT_HOST_PATH si esta vacio en .env
findstr /b "VAULT_HOST_PATH=" .env | findstr "=" >nul 2>&1
if errorlevel 1 (
    echo VAULT_HOST_PATH=%VAULT_HOST%>> .env
) else (
    REM Actualizar si esta vacio
    findstr /r "^VAULT_HOST_PATH=$" .env >nul 2>&1
    if !errorlevel! equ 0 (
        powershell -command "(Get-Content .env) -replace '^VAULT_HOST_PATH=$', 'VAULT_HOST_PATH=%VAULT_HOST:\=/%' | Set-Content .env"
    )
)

REM Leer puertos
set "BACKEND_PORT=8000"
set "FRONTEND_PORT=5173"
set "AGENT_PORT=8080"
set "SEARXNG_PORT=8888"
for /f "tokens=1,* delims==" %%a in (.env) do (
    if /i "%%a"=="BACKEND_PORT" set "BACKEND_PORT=%%b"
    if /i "%%a"=="FRONTEND_PORT" set "FRONTEND_PORT=%%b"
    if /i "%%a"=="AGENT_PORT" set "AGENT_PORT=%%b"
    if /i "%%a"=="SEARXNG_PORT" set "SEARXNG_PORT=%%b"
)

echo.
echo Estructura del Vault:
echo   vault\raw\       - Archivos origidos (inmutable)
echo   vault\wiki\      - Conocimiento procesado
echo   vault\outputs\   - Informes y resumenes generados
echo.

REM -----------------------------------------------------------------
REM 6. LEVANTAR SISTEMA
REM -----------------------------------------------------------------
echo [6/6] Iniciando contenedores...
echo Construyendo y levantando el sistema...
echo (Esto puede tomar varios minutos la primera vez)
echo.

!COMPOSE_CMD! -p !PROJECT_NAME! !PROFILE_FLAG! up -d --build
if !errorlevel! neq 0 (
    echo.
    echo ERROR: No se pudo iniciar el sistema con Docker Compose.
    echo Revisa los logs con: !COMPOSE_CMD! -p !PROJECT_NAME! logs -f
    echo.
    pause
    exit /b 1
)

echo.
echo =========================================
echo  SISTEMA INICIADO CORRECTAMENTE
echo =========================================
echo.
echo Proyecto:    !PROJECT_NAME!
echo Frontend:    http://localhost:!FRONTEND_PORT!
echo Backend API: http://localhost:!BACKEND_PORT!
echo Agente:      http://localhost:!AGENT_PORT!
echo SearXNG:     http://localhost:!SEARXNG_PORT!
echo Vault:       %CD%\vault
if defined TUNNEL_TOKEN if not "!TUNNEL_TOKEN!"=="" (
    echo Tunnel:     Activo (Cloudflare)
) else (
    echo Tunnel:     No configurado
)
echo.
echo Comandos utiles:
echo   Ver logs:      !COMPOSE_CMD! -p !PROJECT_NAME! logs -f
echo   Parar sistema: !COMPOSE_CMD! -p !PROJECT_NAME! down
echo   Reiniciar:     !COMPOSE_CMD! -p !PROJECT_NAME! restart
echo.
echo Presione una tecla para continuar . . .
pause >nul

endlocal