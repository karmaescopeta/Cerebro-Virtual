#!/bin/bash
set -e

echo "========================================="
echo "  SISTEMA AGENTE - INICIO"
echo "========================================="
echo ""

# Configuración
CONFIG_JSON="/app/vault/system/agent-config.json"
HERMES_HOME="${HERMES_HOME:-/root/.hermes}"
export HERMES_HOME
CONFIG_YAML="$HERMES_HOME/config.yaml"

mkdir -p "$HERMES_HOME"

# Determinar la ruta de instalación de Hermes
if [ -d "/usr/local/lib/hermes-agent" ]; then
    HERMES_DIR="/usr/local/lib/hermes-agent"
    echo "✅ Hermes encontrado en: $HERMES_DIR (instalación FHS)"
elif [ -d "/app/hermes-home/hermes-agent" ]; then
    HERMES_DIR="/app/hermes-home/hermes-agent"
    echo "✅ Hermes encontrado en: $HERMES_DIR (instalación en HOME)"
else
    echo "❌ No se encontró la instalación de Hermes"
    exit 1
fi

# Buscar y activar el entorno virtual
VENV_DIR=""
if [ -d "$HERMES_DIR/venv" ]; then
    VENV_DIR="$HERMES_DIR/venv"
    echo "✅ Entorno virtual encontrado en: $VENV_DIR"
elif [ -d "$HERMES_DIR/.venv" ]; then
    VENV_DIR="$HERMES_DIR/.venv"
    echo "✅ Entorno virtual encontrado en: $VENV_DIR"
fi

# Definir el intérprete de Python a usar
if [ -n "$VENV_DIR" ] && [ -f "$VENV_DIR/bin/activate" ]; then
    echo "✅ Activando entorno virtual: $VENV_DIR"
    source "$VENV_DIR/bin/activate"
    PYTHON_CMD="$VENV_DIR/bin/python"

    # Instalar bcrypt en el entorno virtual
    echo "🔧 Instalando bcrypt en el entorno virtual con uv..."
    if command -v uv &> /dev/null; then
        uv pip install bcrypt --quiet || true
    else
        if $PYTHON_CMD -m pip --version &> /dev/null; then
            $PYTHON_CMD -m pip install bcrypt --quiet || true
        else
            echo "⚠️ No se encontró pip en el venv, instalando bcrypt en el sistema..."
            pip install bcrypt --quiet || true
        fi
    fi

    if $PYTHON_CMD -c "import bcrypt" 2>/dev/null; then
        echo "✅ bcrypt instalado correctamente en el entorno virtual."
    else
        echo "⚠️ bcrypt no está en el venv. Se usará el Python del sistema para generate_config.py."
        PYTHON_CMD="python"
    fi
else
    echo "⚠️ No se encontró un entorno virtual. Usando Python del sistema."
    PYTHON_CMD="python"
    pip install bcrypt --quiet || true
fi

# Esperar configuración
echo "Esperando configuración del agente..."
while [ ! -f "$CONFIG_JSON" ]; do
    echo "  Esperando $CONFIG_JSON..."
    sleep 3
done

echo "✅ Configuración encontrada: $CONFIG_JSON"

# Leer la API key del JSON
API_KEY=$($PYTHON_CMD -c "import json; print(json.load(open('$CONFIG_JSON')).get('apiKey', ''))" 2>/dev/null || echo "")
if [ -n "$API_KEY" ]; then
    export OPENROUTER_API_KEY="$API_KEY"
    echo "✅ API key exportada como OPENROUTER_API_KEY"
fi

# Generar configuración YAML usando el intérprete correcto
echo "Generando configuración para Hermes en $CONFIG_YAML..."
$PYTHON_CMD /app/scripts/generate_config.py "$CONFIG_YAML"

# Parchear Hermes para que el proveedor básico muestre /login
echo "Aplicando parche de autenticación del dashboard de Hermes..."
$PYTHON_CMD /app/scripts/patch_hermes_dashboard_auth.py || true

# Instalar perfiles de subagentes
echo "Instalando perfiles de subagentes..."
bash /app/scripts/install_profiles.sh || echo "⚠️ Error instalando perfiles, continuando..."

# Inicializar tablero Kanban para el Coordinador
echo "Inicializando tablero Kanban..."
if command -v hermes &> /dev/null; then
    hermes kanban init 2>/dev/null || echo "⚠️ No se pudo inicializar Kanban (puede que ya exista)"
else
    echo "⚠️ hermes CLI no disponible todavía para inicializar Kanban"
fi

# Verificar que se generó el archivo
if [ ! -f "$CONFIG_YAML" ]; then
    echo "⚠️ No se generó $CONFIG_YAML, creando manualmente..."
    cat > "$CONFIG_YAML" << EOF
agent:
  name: Hermes
  personality: Eres un asistente útil y amigable.
llm:
  provider: openrouter
  model: openai/gpt-4o-mini
channels:
  web:
    enabled: true
    port: 8080
vault:
  path: /app/vault
EOF
fi

echo "✅ Configuración lista en: $CONFIG_YAML"
echo ""
echo "Contenido de la configuración:"
cat "$CONFIG_YAML"
echo ""

export HERMES_CONFIG="$CONFIG_YAML"

echo "Iniciando Hermes Agent en modo servicio desde: $HERMES_DIR"
cd "$HERMES_DIR"

if command -v hermes &> /dev/null; then
    echo "✅ Ejecutando 'hermes dashboard' (UI web + backend)..."
    exec hermes dashboard --port 8080 --host 0.0.0.0 --no-open
else
    echo "⚠️ 'hermes' no está en el PATH, buscando alternativas..."
    if [ -f "cli.py" ]; then
        echo "✅ Ejecutando 'python cli.py dashboard'..."
        exec $PYTHON_CMD cli.py dashboard --port 8080 --host 0.0.0.0 --no-open
    elif [ -f "main.py" ]; then
        echo "✅ Ejecutando 'python main.py dashboard'..."
        exec $PYTHON_CMD main.py dashboard --port 8080 --host 0.0.0.0 --no-open
    else
        echo "❌ No se encontró un punto de entrada válido para Hermes"
        exit 1
    fi
fi
