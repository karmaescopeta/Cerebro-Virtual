#!/bin/bash
# install_profiles.sh — Instala los 5 perfiles de subagentes en Hermes
# Se ejecuta dentro del contenedor cerebro-agente después de generar el config.yaml
# Uso: install_profiles.sh

set -e

PROFILES_SRC="/app/sistema-agente/profiles"
HERMES_HOME="${HERMES_HOME:-/app/hermes-home}"
PROFILES_DEST="$HERMES_HOME/profiles"

echo "========================================="
echo "  INSTALACIÓN DE PERFILES DE SUBAGENTES"
echo "========================================="
echo ""

mkdir -p "$PROFILES_DEST"

# Instalar cada perfil
for profile_dir in "$PROFILES_SRC"/hermes-*; do
    if [ -d "$profile_dir" ]; then
        profile_name=$(basename "$profile_dir")
        dest_dir="$PROFILES_DEST/$profile_name"

        echo "📦 Instalando perfil: $profile_name"
        mkdir -p "$dest_dir"
        cp -r "$profile_dir"/* "$dest_dir/" 2>/dev/null || true
        echo "  ✅ Perfil $profile_name instalado en $dest_dir"
    fi
done

echo ""
echo "✅ Todos los perfiles instalados en: $PROFILES_DEST"
ls -la "$PROFILES_DEST"
