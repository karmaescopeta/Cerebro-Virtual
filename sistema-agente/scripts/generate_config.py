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
    channel_tokens = config.get("channelTokens", {}) or {}
    models = config.get("models", {}) or {}
    dashboard = config.get("dashboard", {}) or {}
    dashboard_user = (dashboard.get("user") or "").strip()
    dashboard_password = dashboard.get("password") or ""

    default_model = models.get("chat-default", "").strip() or "openrouter/auto"

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
        dashboard_config["basic_auth"] = {
            "enabled": True,
            "username": dashboard_user,
            "password_hash": password_hash,
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

    llm_config = {
        "provider": "openrouter",
        "default": default_model,
        "api_key": api_key,
    }
    legacy_llm_config = {
        "provider": "openrouter",
        "api_key": api_key,
        "model": default_model,
    }

    hermes_config = {
        "agent": {
            "name": agent_name,
            "personality": personality,
        },
        "model": llm_config,
        "llm": legacy_llm_config,
        "channels": {
            "web": {"enabled": True, "port": 8080},
            "telegram": {
                "enabled": bool(channels.get("telegram", False)),
                "token": channel_tokens.get("telegram", "") or os.getenv("TELEGRAM_TOKEN", ""),
            },
            "discord": {
                "enabled": bool(channels.get("discord", False)),
                "token": channel_tokens.get("discord", "") or os.getenv("DISCORD_TOKEN", ""),
            },
            "whatsapp": {
                "enabled": bool(channels.get("whatsapp", False)),
                "phone": channel_tokens.get("whatsapp", ""),
            },
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
