# tests/test_combo_routing.py — ponytail check (task 19)
# _profile_model devuelve combo local/cloud correcto + _sanitize_credentials sin credenciales.
# Assert puro, sin fixtures: extrae las funciones REALES de main.py via ast y las ejecuta con stubs mínimos.
import ast, json, re, sys
from pathlib import Path

MAIN = Path(__file__).resolve().parents[1] / "backend" / "app" / "main.py"
src = MAIN.read_text(encoding="utf-8")
tree = ast.parse(src)

WANTED = {"_profile_model", "_sanitize_credentials", "get_agent_config"}
chunks = []
profile_defs_src = None
for node in tree.body:
    if isinstance(node, ast.FunctionDef) and node.name in WANTED:
        chunks.append(ast.get_source_segment(src, node))
    if isinstance(node, ast.Assign):
        for t in node.targets:
            if isinstance(t, ast.Name) and t.id == "PROFILE_DEFS":
                profile_defs_src = ast.get_source_segment(src, node)

assert profile_defs_src, "PROFILE_DEFS no encontrado en main.py"
ns = {"json": json, "re": re, "Path": Path}
exec("\n\n".join(chunks) + "\n\n" + profile_defs_src, ns)

# --- _profile_model: ruta A (flag) — tabla según toggle, fallbacks ---
ns["get_agent_config"] = lambda: {
    "models": {"cerebro": "combo/cerebro-cerebro", "chat-default": "combo/cerebro-default"},
    "modelsLocal": {"cerebro": "combo/local-cerebro", "chat-default": "combo/local-default"},
}
assert ns["_profile_model"]("cerebro", True) == "combo/local-cerebro"
assert ns["_profile_model"]("cerebro", False) == "combo/cerebro-cerebro"
assert ns["_profile_model"]("chat-default", True) == "combo/local-default"

# sin modelsLocal → fallback a models (cloud) en ambas direcciones
ns["get_agent_config"] = lambda: {"models": {"cerebro": "combo/cerebro-cerebro"}}
assert ns["_profile_model"]("cerebro", True) == "combo/cerebro-cerebro"

# sin config → defaults de PROFILE_DEFS
ns["get_agent_config"] = lambda: None
assert ns["_profile_model"]("cerebro", True) == "deepseek/deepseek-v4-flash"

# --- _sanitize_credentials: sin credenciales en claro ---
cfg = {
    "agentName": "Hermes",
    "apiKey": "sk-or-v1-SECRETO",
    "channelTokens": {"telegram": "TOK", "discord": "TOK2"},
    "dashboard": {"user": "dani", "password": "P4ss"},
    "nested": {"list": [{"apiKey": "sk-inner"}], "profileNames": {"x": "y"}},
}
ns["_sanitize_credentials"](cfg)
blob = json.dumps(cfg)
for secret in ("sk-or-v1-SECRETO", "TOK2", "P4ss", "sk-inner"):
    assert secret not in blob, f"credencial filtrada: {secret}"
assert cfg["agentName"] == "Hermes"                      # estructura conservada
assert cfg["dashboard"]["user"] == "dani"                # user no es credencial
assert cfg["nested"]["list"] == [{"apiKey": ""}]         # recursivo en listas/dicts

print("OK test_combo_routing: 6 asserts")
