#!/usr/bin/env python3
"""Detect hardware profile from user-provided specs and recommend Ollama models."""
import json
import sys


def detect_hw_profile(cpu: str, ram_gb: int, gpu: str, vram_gb: int = 0) -> str:
    """Return 'low', 'medium', or 'high' based on user hardware."""
    ram = int(ram_gb or 8)
    has_gpu = bool(gpu and gpu.lower() not in ("no", "none", "sin gpu", "integrated", "integrada"))
    vram = int(vram_gb or 0)

    if ram >= 16 and vram >= 8:
        return "high"
    if ram >= 8 and (vram >= 4 or has_gpu):
        return "medium"
    return "low"


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


def main():
    if len(sys.argv) > 1:
        specs = json.loads(sys.argv[1])
    else:
        specs = json.load(sys.stdin)

    cpu = specs.get("cpu", "")
    ram = int(specs.get("ram_gb", 8))
    gpu = specs.get("gpu", "")
    vram = int(specs.get("vram_gb", 0))

    profile = detect_hw_profile(cpu, ram, gpu, vram)
    models = MODEL_ASSIGNMENTS[profile]

    result = {
        "profile": profile,
        "models": models,
        "all_models_to_install": sorted(set(models.values())),
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    raise SystemExit(main())
