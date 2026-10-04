#!/usr/bin/env python3
"""Patch Hermes dashboard auth auto-redirect for password-only providers.

Some Hermes builds auto-redirect any single auth provider to /auth/login.
That works for OAuth providers but not for the built-in basic password
provider, whose login must render /login and POST to /auth/password-login.
This patch makes unauthenticated dashboard loads go to /login when the only
provider supports password login.
"""
from pathlib import Path

# ponytail: layout nuevo (instalador pm) primero, FHS viejo como fallback
_CANDIDATES = [
    Path("/app/hermes-home/hermes-agent/hermes_cli/dashboard_auth/middleware.py"),
    Path("/usr/local/lib/hermes-agent/hermes_cli/dashboard_auth/middleware.py"),
]
TARGET = next((p for p in _CANDIDATES if p.exists()), _CANDIDATES[0])
MARKER = "# CEREBRO_PATCH_PASSWORD_PROVIDER_NO_AUTO_SSO"


def main() -> int:
    if not TARGET.exists():
        print(f"⚠️ No existe {TARGET}; no se aplica parche")
        return 0

    text = TARGET.read_text(encoding="utf-8")
    if MARKER in text:
        print("✅ Parche auth dashboard ya aplicado")
        return 0

    needle = "    providers = list_session_providers()\n    if len(providers) != 1:\n"
    replacement = (
        "    providers = list_session_providers()\n"
        f"    {MARKER}\n"
        "    if len(providers) == 1 and getattr(providers[0], \"supports_password\", False):\n"
        "        return None\n"
        "    if len(providers) != 1:\n"
    )

    if needle not in text:
        print("⚠️ No se encontró el punto de parcheo; Hermes puede haber cambiado")
        return 0

    TARGET.write_text(text.replace(needle, replacement, 1), encoding="utf-8")
    print("✅ Parche auth dashboard aplicado")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
