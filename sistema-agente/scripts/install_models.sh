#!/bin/bash
# install_models.sh — Instala modelos de Ollama según el hardware del usuario
# Uso: install_models.sh <hw_profile>
# hw_profile: "low" | "medium" | "high"
# Se ejecuta dentro del contenedor cerebro-ollama

set -e

HW_PROFILE="${1:-medium}"
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"

echo "========================================="
echo "  INSTALACIÓN DE MODELOS LOCALES (Ollama)"
echo "  Perfil de hardware: $HW_PROFILE"
echo "========================================="
echo ""

# Esperar a que Ollama esté listo
echo "Esperando a que Ollama esté listo..."
for i in $(seq 1 30); do
    if curl -s "$OLLAMA_HOST/api/tags" > /dev/null 2>&1; then
        echo "✅ Ollama está listo."
        break
    fi
    echo "  Esperando... ($i/30)"
    sleep 2
done

# Definir modelos según el perfil de hardware
case "$HW_PROFILE" in
    low)
        # Hardware bajo: ≤8GB RAM, sin GPU dedicada
        MODELS=("qwen2.5:3b" "llama3.2:3b")
        echo "📋 Modelos a instalar (perfil bajo):"
        echo "  - qwen2.5:3b (Coordinador, Editor, Investigador, Sintetizador)"
        echo "  - llama3.2:3b (Indexador)"
        ;;
    medium)
        # Hardware medio: 8-16GB RAM, GPU 4-8GB
        MODELS=("gemma3:4b" "qwen2.5:7b" "llama3.2:3b")
        echo "📋 Modelos a instalar (perfil medio):"
        echo "  - gemma3:4b (Coordinador, Editor, Sintetizador)"
        echo "  - qwen2.5:7b (Investigador)"
        echo "  - llama3.2:3b (Indexador)"
        ;;
    high)
        # Hardware alto: >16GB RAM, GPU >8GB
        MODELS=("qwen2.5:14b" "llama3.1:8b" "llama3.2:3b")
        echo "📋 Modelos a instalar (perfil alto):"
        echo "  - qwen2.5:14b (Coordinador, Investigador)"
        echo "  - llama3.1:8b (Editor, Sintetizador)"
        echo "  - llama3.2:3b (Indexador)"
        ;;
    *)
        echo "❌ Perfil de hardware no válido: $HW_PROFILE"
        echo "Perfiles válidos: low, medium, high"
        exit 1
        ;;
esac

echo ""

# Instalar cada modelo
INSTALLED=()
for model in "${MODELS[@]}"; do
    echo "⬇️  Descargando modelo: $model..."
    if ollama pull "$model"; then
        echo "✅ Modelo $model instalado correctamente."
        INSTALLED+=("$model")
    else
        echo "❌ Error al instalar $model. Continuando con el siguiente..."
    fi
    echo ""
done

# Listar modelos instalados
echo "========================================="
echo "  MODELOS INSTALADOS"
echo "========================================="
ollama list

echo ""
echo "✅ Instalación de modelos completada."
echo "Modelos instalados: ${INSTALLED[*]}"
