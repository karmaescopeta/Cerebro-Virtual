#!/bin/bash
# install_profiles.sh — Instala los 5 perfiles de subagentes en Hermes
# Se ejecuta dentro del contenedor cerebro-agente después de generar el config.yaml
# Uso: install_profiles.sh <model_mode> <hw_profile>

set -e

MODEL_MODE="${1:-openrouter}"
HW_PROFILE="${2:-medium}"
PROFILES_SRC="/app/sistema-agente/profiles"
HERMES_HOME="${HERMES_HOME:-/app/hermes-home}"
PROFILES_DEST="$HERMES_HOME/profiles"

echo "========================================="
echo "  INSTALACIÓN DE PERFILES DE SUBAGENTES"
echo "  Modo: $MODEL_MODE | Hardware: $HW_PROFILE"
echo "========================================="
echo ""

mkdir -p "$PROFILES_DEST"

# Función para reescribir el config.yaml de un perfil según el modo de modelo
rewrite_config() {
    local profile_dir="$1"
    local local_model="$2"
    local config_file="$profile_dir/config.yaml"

    if [ "$MODEL_MODE" = "local" ] && [ -n "$local_model" ]; then
        echo "  🔧 Configurando $profile_dir para modelo local: $local_model"
        # Usar ollama como provider para modelos locales
        cat > "$config_file" << EOF
model: $local_model
provider: ollama
base_url: http://cerebro-ollama:11434
temperature: 0.3
skills:
  - file
  - web
  - terminal
  - delegation
terminal:
  cwd: /app/vault
EOF
        # Añadir skills específicos según el perfil
        local profile_name=$(basename "$profile_dir" | sed 's/hermes-//')
        case "$profile_name" in
            editor)
                sed -i 's|cwd: /app/vault|cwd: /app/vault/wiki|' "$config_file"
                sed -i 's|temperature: 0.3|temperature: 0.2|' "$config_file"
                ;;
            indexador)
                sed -i 's|cwd: /app/vault|cwd: /app/vault/wiki|' "$config_file"
                sed -i 's|temperature: 0.3|temperature: 0.1|' "$config_file"
                ;;
            investigador-resumidor)
                sed -i 's|temperature: 0.3|temperature: 0.4|' "$config_file"
                ;;
        esac
    fi
}

# Asignación de modelos locales según el perfil de hardware
get_local_model() {
    local profile_name="$1"
    case "$HW_PROFILE" in
        low)
            case "$profile_name" in
                coordinador|editor|investigador-resumidor|sintetizador) echo "qwen2.5:3b" ;;
                indexador) echo "llama3.2:3b" ;;
            esac
            ;;
        medium)
            case "$profile_name" in
                coordinador|editor|sintetizador) echo "gemma3:4b" ;;
                investigador-resumidor) echo "qwen2.5:7b" ;;
                indexador) echo "llama3.2:3b" ;;
            esac
            ;;
        high)
            case "$profile_name" in
                coordinador|investigador-resumidor) echo "qwen2.5:14b" ;;
                editor|sintetizador) echo "llama3.1:8b" ;;
                indexador) echo "llama3.2:3b" ;;
            esac
            ;;
    esac
}

# Instalar cada perfil
for profile_dir in "$PROFILES_SRC"/hermes-*; do
    if [ -d "$profile_dir" ]; then
        profile_name=$(basename "$profile_dir")
        dest_dir="$PROFILES_DEST/$profile_name"

        echo "📦 Instalando perfil: $profile_name"
        mkdir -p "$dest_dir"

        # Copiar archivos del perfil
        cp -r "$profile_dir"/* "$dest_dir/" 2>/dev/null || true

        # Reescribir config.yaml si es modo local
        if [ "$MODEL_MODE" = "local" ]; then
            short_name=$(echo "$profile_name" | sed 's/hermes-//')
            local_model=$(get_local_model "$short_name")
            rewrite_config "$dest_dir" "$local_model"
        fi

        echo "  ✅ Perfil $profile_name instalado en $dest_dir"
    fi
done

echo ""
echo "✅ Todos los perfiles instalados en: $PROFILES_DEST"
ls -la "$PROFILES_DEST"
