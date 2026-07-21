# IA Local — Conceptos e Instrucciones (Referencia futura)

> **Estado**: Funcionalidad pausada. El sistema funciona solo con OpenRouter (cloud).
> Cuando se retome la IA local, este documento contiene todo lo necesario para implementarla.

## Arquitectura

Contenedor **Ollama** (Docker) sin puertos expuestos al host. Acceso interno via red Docker:
```
cerebro-ollama:11434
```

### Servicio Docker
```yaml
ollama:
  image: ollama/ollama:latest
  container_name: cerebro-ollama
  restart: unless-stopped
  volumes:
    - ollama-models:/root/.ollama
    - ./sistema-agente/scripts:/app/scripts:ro
  networks:
    - cerebro-network
  profiles:
    - local
```

## Perfiles de hardware

| Perfil | RAM | VRAM | Modelos |
|--------|-----|------|---------|
| low | ≤8GB | 0 | qwen2.5:3b, llama3.2:3b |
| medium | 8-16GB | 4-8GB | gemma3:4b, qwen2.5:7b, llama3.2:3b |
| high | >16GB | >8GB | qwen2.5:14b, llama3.1:8b, llama3.2:3b |

### Detección de perfil
```python
def detect_hw_profile(cpu: str, ram_gb: int, gpu: str, vram_gb: int = 0) -> str:
    ram = int(ram_gb or 8)
    has_gpu = bool(gpu and gpu.lower() not in ("no", "none", "sin gpu", "integrated", "integrada"))
    vram = int(vram_gb or 0)
    if ram >= 16 and vram >= 8:
        return "high"
    if ram >= 8 and (vram >= 4 or has_gpu):
        return "medium"
    return "low"
```

### Asignación de modelos por subagente
```python
MODEL_ASSIGNMENTS = {
    "low": {
        "coordinador": "qwen2.5:3b",
        "editor": "qwen2.5:3b",
        "investigador-resumidor": "qwen2.5:3b",
        "indexador": "llama3.2:3b",
        "sintetizador": "qwen2.5:3b",
    },
    "medium": {
        "coordinador": "gemma3:4b",
        "editor": "gemma3:4b",
        "investigador-resumidor": "qwen2.5:7b",
        "indexador": "llama3.2:3b",
        "sintetizador": "gemma3:4b",
    },
    "high": {
        "coordinador": "qwen2.5:14b",
        "editor": "llama3.1:8b",
        "investigador-resumidor": "qwen2.5:14b",
        "indexador": "llama3.2:3b",
        "sintetizador": "llama3.1:8b",
    },
}
```

## Configuración en Hermes (generate_config.py)

Para modo local, el provider de Hermes se configura como `custom` apuntando a Ollama:
```python
llm_config = {
    "provider": "custom",
    "base_url": "http://cerebro-ollama:11434/v1",
    "default": local_model,  # ej: "qwen2.5:3b"
    "api_key": "ollama",     # dummy — Ollama no requiere auth
}
```

Para modo mixed (cloud + local):
```python
llm_config = {
    "provider": "openrouter",
    "default": "openai/gpt-4o-mini",
    "api_key": api_key,
}
hermes_config_extra = {
    "local_llm": {
        "provider": "custom",
        "base_url": "http://cerebro-ollama:11434/v1",
        "default": local_model,
        "api_key": "ollama",
    }
}
```

## Modos de modelo

| Modo | Descripción | API key | Ollama |
|------|-------------|---------|--------|
| openrouter | Cloud únicamente | Obligatoria | No usado |
| local | Offline únicamente | No | Obligatorio |
| mixed | Cloud + local fallback | Obligatoria | Opcional (fallback) |

## Comportamiento del entrypoint

- **local**: Bloquea arranque hasta que Ollama responda (timeout 300s)
- **mixed**: No bloquea. Si Ollama no está, usa OpenRouter como fallback.
- **openrouter**: No espera Ollama.

```bash
if [ "$MODEL_MODE" = "local" ]; then
    # Esperar Ollama (bloqueante, 60 intentos x 5s = 300s)
    for i in $(seq 1 60); do
        if curl -s http://cerebro-ollama:11434/api/tags > /dev/null 2>&1; then
            break
        fi
        sleep 5
    done
elif [ "$MODEL_MODE" = "mixed" ]; then
    # No bloqueante
    curl -s http://cerebro-ollama:11434/api/tags > /dev/null 2>&1 || true
fi
```

## UI: Toggle de modo

El frontend tenía un toggle switch (OpenRouter ↔ IA Local) en Ajustes:
- Al cambiar a local: verificar que hay modelos instalados, si no, mostrar formulario de hardware
- Formulario de hardware: CPU (dropdown con modelos concretos), RAM, GPU (modelos concretos), VRAM
- Pantalla de instalación bloqueante: overlay fullscreen con log en tiempo real mientras `ollama pull` descarga modelos
- Al completar: `toggle-mode` + `full-restart` del agente

## Hardware forms (dropdowns concretos)

### CPU
- Intel i3, i5, i7, i9
- AMD Ryzen 3, 5, 7, 9

### GPU
- Sin GPU
- NVIDIA RTX 3060, 4060, 4070, 4080, 4090
- AMD RX 6600, 7700, 7900

### VRAM
- 0, 4, 6, 8, 12, 16, 24 GB

### RAM
- 8, 16, 32, 64 GB

## Scripts

### install_models.sh
Ejecuta dentro del contenedor Ollama. Recibe el perfil de hardware y hace `ollama pull` por cada modelo.

### install_profiles.sh
Copia los 5 perfiles de subagentes. En modo local, reescribe el `config.yaml` de cada perfil para usar `provider: ollama` con el modelo asignado según hardware.

## Endpoints backend (eliminados)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/init/hardware` | POST | Recibe specs HW, devuelve perfil + modelos |
| `/api/init/install-models` | POST | Lanza `ollama pull` en contenedor Ollama |
| `/api/agent/toggle-mode` | POST | Cambia entre openrouter/local/mixed |
| `/api/agent/model-mode` | GET | Devuelve modo activo |

## Pasos para re-implementar

1. Restaurar servicio Ollama en docker-compose.yml con `profiles: [local]`
2. Restaurar endpoints de hardware y install-models en backend
3. Restaurar toggle de modo en frontend (Ajustes)
4. Restaurar formulario de hardware en SetupWizard (paso 2 para local/mixed)
5. Restaurar pantalla de instalación bloqueante
6. Restaurar lógica de generate_config.py para local/mixed
7. Restaurar entrypoint.sh: espera de Ollama para modo local/mixed
8. Restaurar install_models.sh y detect_hardware.py
9. Restaurar lógica de install_profiles.sh para modo local
10. Probar con `docker compose --profile local up -d ollama`
