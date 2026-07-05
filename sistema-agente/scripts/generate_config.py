#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

import yaml

CONFIG_JSON = os.getenv("AGENT_CONFIG_JSON", "/app/vault/system/agent-config.json")


def hash_password(password: str) -> str:
    """Return a Hermes-compatible password hash for the dashboard password."""
    try:
        from plugins.dashboard_auth.basic import hash_password as hermes_hash_password
        return hermes_hash_password(password)
    except Exception:
        pass

    try:
        import bcrypt
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        return hashed.decode("utf-8") if isinstance(hashed, bytes) else str(hashed)
    except Exception as exc:
        raise RuntimeError(
            "bcrypt no está disponible; no se puede generar la contraseña segura del dashboard"
        ) from exc


def main():
    config_yaml = sys.argv[1] if len(sys.argv) > 1 else "/root/.hermes/config.yaml"

    config_path = Path(CONFIG_JSON)
    if not config_path.exists():
        print(f"❌ No se encuentra {CONFIG_JSON}")
        return 1

    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    agent_name = config.get("agentName", "Hermes")
    personality = config.get("personality", "Eres un asistente útil y amigable.")
    api_key = config.get("apiKey", "")
    channels = config.get("channels", {}) or {}
    dashboard = config.get("dashboard", {}) or {}
    dashboard_user = (dashboard.get("user") or "").strip()
    dashboard_password = dashboard.get("password") or ""

    dashboard_config = {
        "host": "0.0.0.0",
        "port": 8080,
        "basic_auth": {"enabled": False},
    }
    auth_config = {
        "basic": {"enabled": False},
        "oauth": {"enabled": False},
    }

    if dashboard_user and dashboard_password:
        password_hash = hash_password(dashboard_password)
        # Keep both config shapes because Hermes dashboard/auth config changed
        # across versions. This lets the same generated file work with either.
        dashboard_config["basic_auth"] = {
            "enabled": True,
            # Shape required by Hermes dashboard auth gate.
            "username": dashboard_user,
            "password_hash": password_hash,
            # Compatibility shapes for older/alternate code paths.
            "users": [
                {
                    "username": dashboard_user,
                    "password": password_hash,
                    "password_hash": password_hash,
                }
            ],
        }
        auth_config["basic"] = {
            "enabled": True,
            "username": dashboard_user,
            "password_hash": password_hash,
            "users": {dashboard_user: password_hash},
        }

    hermes_config = {
        "agent": {
            "name": agent_name,
            "personality": personality,
        },
        "model": {
            "provider": "openrouter",
            "default": "openai/gpt-4o-mini",
            "api_key": api_key,
        },
        # Legacy shape kept for older code paths in this project.
        "llm": {
            "provider": "openrouter",
            "api_key": api_key,
            "model": "openai/gpt-4o-mini",
        },
        "channels": {
            "web": {"enabled": True, "port": 8080},
            "telegram": {
                "enabled": bool(channels.get("telegram", False)),
                "token": os.getenv("TELEGRAM_TOKEN", ""),
            },
            "discord": {
                "enabled": bool(channels.get("discord", False)),
                "token": os.getenv("DISCORD_TOKEN", ""),
            },
            "whatsapp": {"enabled": bool(channels.get("whatsapp", False))},
        },
        "vault": {"path": "/app/vault", "obsidian": True},
        "paths": {"data": "/root/.hermes/data", "skills": "/root/.hermes/skills"},
        "dashboard": dashboard_config,
        "auth": auth_config,
    }

    Path(config_yaml).parent.mkdir(parents=True, exist_ok=True)
    with open(config_yaml, "w", encoding="utf-8") as f:
        yaml.dump(hermes_config, f, default_flow_style=False, allow_unicode=True)

    print(f"✅ Configuración generada en {config_yaml}")
    print(f"   Agente: {agent_name}")
    print(
        f"   Canales: Web, Telegram={channels.get('telegram', False)}, "
        f"Discord={channels.get('discord', False)}, WhatsApp={channels.get('whatsapp', False)}"
    )
    if dashboard_user:
        print(f"   🔒 Dashboard protegido. Usuario: {dashboard_user}")
    else:
        print("   🔓 Dashboard público (sin autenticación)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
