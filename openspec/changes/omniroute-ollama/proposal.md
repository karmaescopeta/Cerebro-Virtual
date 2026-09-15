# Proposal: OmniRoute + Ollama como capa de modelos

## Why
Hoy el agente tiene 1 proveedor (OpenRouter) + Ollama opcional. El usuario quiere gestión central de proveedores y modelos locales. OmniRoute (`diegosouzapw/omniroute`, imagen Docker oficial, dashboard propio :20128) es el gateway: OpenRouter pasa a ser un proveedor dentro de OmniRoute, y Ollama queda como modelo local gestionado.

## What Changes
- Nuevo servicio compose `omniroute` (imagen `diegosouzapw/omniroute:latest`, puerto interno 20128, sin puerto de host — detrás del tunnel/red interna).
- Servicio `ollama` re-hecho: siempre creado (perfil por defecto en vez de `local`), volumen `ollama-models`, red interna.
- Hermes `generate_config.py`: `provider: custom` → `base_url: http://omniroute:20128/v1` con API key de OmniRoute (dummy en local). OpenRouter se configura dentro del dashboard de OmniRoute, no en Hermes.
- Terminal de contenedor accesible: `docker exec cerebro-ollama ollama pull <modelo>` documentado en UI (Ollama no tiene webUI oficial; usamos su API nativa).
- Pestaña Ajustes → IA ampliada: estado OmniRoute (up/down, URL dashboard), botón abrir dashboard, gestión de modelos Ollama vía API (`/api/tags`, `/api/pull`, `/api/delete`): listar, descargar (con progreso), borrar.
- Opción instalar/skip IA local en wizard y Ajustes (ya existía parcialmente — se mantiene, apuntando al nuevo flujo).

## Impact
- Affected: docker-compose.yml, sistema-agente/config (generate_config), backend endpoints nuevos `/api/ollama/*`, frontend tab IA, .env.example.
- Risks: cambio de proveedor rompe config Hermes existente → migración en arranque (si `model.provider==openrouter` directo, reescribir a custom/omniroute).
- Rollback: tags backup + compose anterior.

## Decisiones (ponytail)
- OmniRoute SIN puerto de host: solo red interna + dashboard vía proxy backend (evita exponer 20128).
- No fork del repo: imagen oficial. Updates = pull imagen (cubre update-system-v2).
- Ollama management por API nativa de Ollama, no scraping webUI (no existe).
