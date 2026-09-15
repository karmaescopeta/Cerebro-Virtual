#!/bin/bash
set -e

echo "========================================="
echo "🧠 Cerebro Virtual - Backend"
echo "========================================="

if [ ! -d "/app/vault/system" ]; then
    echo "📁 Creando estructura de vault..."
    
    mkdir -p /app/vault/system
    mkdir -p /app/vault/notes
    mkdir -p /app/vault/projects
    mkdir -p /app/vault/assets/pdf
    mkdir -p /app/vault/assets/images
    mkdir -p /app/vault/assets/audio
    mkdir -p /app/vault/assets/video
    mkdir -p /app/vault/assets/other
    mkdir -p /app/vault/links
    mkdir -p /app/vault/exports
    
    cat > /app/vault/system/manifest.json << 'EOF'
{
  "schemaVersion": "1.0.0",
  "name": "Mi Cerebro Virtual",
  "createdAt": "2025-07-01T00:00:00Z",
  "updatedAt": "2025-07-01T00:00:00Z"
}
EOF

    cat > /app/vault/system/identity.json << 'EOF'
{
  "name": "Cerebro Virtual",
  "agentName": "Hermes",
  "purpose": "Asistente personal para gestionar conocimiento",
  "createdAt": "2025-07-01T00:00:00Z"
}
EOF

    cat > /app/vault/system/models.json << 'EOF'
{
  "defaultModel": "deepseek/deepseek-v4-flash",
  "availableModels": [
    "deepseek/deepseek-v4-flash",
    "deepseek/deepseek-v4-flash",
  ],
  "provider": "openrouter"
}
EOF

    cat > /app/vault/notes/bienvenida.md << 'EOF'
---
id: n_20250701_001
title: "¡Bienvenido a tu Cerebro Virtual!"
createdAt: 2025-07-01T00:00:00Z
updatedAt: 2025-07-01T00:00:00Z
tags:
  - bienvenida
  - inicio
---

# ¡Bienvenido a tu Cerebro Virtual! 🧠

Este es el comienzo de tu viaje para organizar todo tu conocimiento.

## ¿Qué puedes hacer aquí?

- 📝 **Crear notas** sobre cualquier tema
- 📁 **Organizar proyectos** completos
- 📎 **Adjuntar archivos** (PDFs, imágenes, etc.)
- 💬 **Hablar con Hermes** tu asistente personal
- 🔍 **Buscar** rápidamente cualquier información

¡El conocimiento es poder, y ahora lo tienes organizado! 🚀
EOF

    echo "✅ Vault creado correctamente"
fi

echo "📦 Iniciando servidor..."
echo "🔗 API disponible en: http://localhost:8000"
echo "📊 Vault montado en: /app/vault"

exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app