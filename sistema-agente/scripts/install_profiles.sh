#!/bin/bash
# install_profiles.sh — Instala los 4 perfiles de chat en Hermes
# Se ejecuta dentro del contenedor cerebro-agente después de generar el config.yaml
# Uso: install_profiles.sh

set -e

PROFILES_SRC="/app/sistema-agente/profiles"
HERMES_HOME="${HERMES_HOME:-/app/hermes-home}"
PROFILES_DEST="$HERMES_HOME/profiles"
CONFIG_JSON="${AGENT_CONFIG_JSON:-/app/vault/system/agent-config.json}"

# ponytail: leer models del JSON en una sola llamada a python
MODELS_JSON=""
if [ -f "$CONFIG_JSON" ]; then
    MODELS_JSON=$(python -c "
import json, sys
with open('$CONFIG_JSON') as f:
    m = json.load(f).get('models', {})
keys = ['chat-default','chat-smart','cerebro','investigador']
print('|'.join(m.get(k,'') for k in keys))
" 2>/dev/null || echo "|||")
fi
IFS='|' read -r M_DEFAULT M_SMART M_CEREBRO M_INVESTIGADOR <<< "$MODELS_JSON"

# Mapa perfil→variable
declare -A PROFILE_MODELS=(
    ["chat-default"]="$M_DEFAULT"
    ["chat-smart"]="$M_SMART"
    ["cerebro"]="$M_CEREBRO"
    ["investigador"]="$M_INVESTIGADOR"
)

echo "========================================="
echo "  INSTALACIÓN DE PERFILES DE CHAT"
echo "========================================="
echo ""

mkdir -p "$PROFILES_DEST"

# Instalar cada perfil
for profile_dir in "$PROFILES_SRC"/*; do
    if [ -d "$profile_dir" ]; then
        profile_name=$(basename "$profile_dir")
        dest_dir="$PROFILES_DEST/$profile_name"

        echo "📦 Instalando perfil: $profile_name"
        mkdir -p "$dest_dir"
        cp -r "$profile_dir"/* "$dest_dir/" 2>/dev/null || true

        # Sobreescribir model: en config.yaml si hay modelo asignado
        model_val="${PROFILE_MODELS[$profile_name]}"
        if [ -n "$model_val" ] && [ -f "$dest_dir/config.yaml" ]; then
            sed -i "s|^model:.*|model: $model_val|" "$dest_dir/config.yaml"
            echo "  ✅ Modelo asignado: $model_val"
        fi

        echo "  ✅ Perfil $profile_name instalado en $dest_dir"
    fi
done

echo ""
echo "✅ Todos los perfiles instalados en: $PROFILES_DEST"
ls -la "$PROFILES_DEST"
