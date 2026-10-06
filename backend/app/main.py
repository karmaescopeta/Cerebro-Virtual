from starlette.concurrency import run_in_threadpool
from fastapi import FastAPI, HTTPException, File, UploadFile, Body, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse, Response
from html import escape
import os
import json
import threading
from pathlib import Path
from datetime import datetime, timedelta
import httpx

import subprocess
import time
import re
import io

app = FastAPI(
    title="Cerebro Virtual API",
    version="1.0.0",
    description="API para el Cerebro Virtual - Tu asistente personal de conocimiento"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración
VAULT_PATH = os.getenv("VAULT_PATH", "/app/vault")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

# Rutas de configuración
AGENT_KEYS_PATH = Path(VAULT_PATH) / "system" / "agent-keys.json"
AGENT_CONFIG_PATH = Path(VAULT_PATH) / "system" / "agent-config.json"
AGENT_INTERNAL_URL = os.getenv("AGENT_INTERNAL_URL", "http://sistema-agente:8080")

# ponytail: servir archivos del vault (imagenes para preview en chat)
from fastapi.staticfiles import StaticFiles

class _VaultStatic(StaticFiles):
    # audit run-1: system/ lleva credenciales — misma política de exclusión que el export (SENSITIVE)
    BLOCKED_FIRST_SEGMENT = {"system"}

    async def get_response(self, path: str, scope):
        first = path.split("/")[0] if path else ""
        if first in self.BLOCKED_FIRST_SEGMENT:
            raise HTTPException(status_code=404)
        return await super().get_response(path, scope)

if Path(VAULT_PATH).exists():
    app.mount("/vault-static", _VaultStatic(directory=VAULT_PATH), name="vault-static")


# ============================================
# FUNCIONES AUXILIARES
# ============================================

# ---- audit run-1 (security): helpers compartidos ----

def _confine(category: str, *segments: str) -> Path:
    """Confinar ruta bajo VAULT_PATH/<category>/ — mismo patrón que update_vault_file."""
    base = (Path(VAULT_PATH) / category).resolve()
    target = base.joinpath(*segments).resolve()
    if not str(target).startswith(str(base) + os.sep) and target != base:
        raise HTTPException(status_code=400, detail="Path inválido")
    return target

def _confine_vault(*segments: str) -> Path:
    """Confinar ruta bajo VAULT_PATH (raíz) — para paths relativos al vault con categoría incluida."""
    base = Path(VAULT_PATH).resolve()
    target = base.joinpath(*segments).resolve()
    if not str(target).startswith(str(base) + os.sep) and target != base:
        raise HTTPException(status_code=400, detail="Path inválido")
    return target

def _safe_env_kv(key: str, value: str, allow_eq: bool = False):
    """audit run-1: newline en key/value forjaba lineas de .env enteras."""
    import string as _string
    if not all(c in _string.ascii_letters + _string.digits + "_" for c in key):
        raise HTTPException(status_code=400, detail="clave no permitida")
    forbidden = set(map(chr, range(32)))  # todo control char, incl. CR y LF
    if not allow_eq:
        forbidden.add("=")
    if any(c in forbidden for c in value):
        raise HTTPException(status_code=400, detail="caracteres no permitidos")
    return key, value

_MODEL_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,120}$")

def _validate_models(new_models) -> None:
    """audit run-1: models llega a un sed en install_profiles.sh — whitelist de model-id."""
    if not isinstance(new_models, dict):
        raise HTTPException(status_code=400, detail="models debe ser un objeto")
    for k, v in new_models.items():
        if not isinstance(v, str) or (v and not _MODEL_ID_RE.match(v)):
            raise HTTPException(status_code=400, detail=f"Modelo inválido: {k}")

_GRAPH_LOCK = threading.RLock()  # audit run-1: 7 escritores de graph.json en 3 contextos concurrentes

def _atomic_dump(path: Path, obj) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)

def get_agent_keys():
    if AGENT_KEYS_PATH.exists():
        with open(AGENT_KEYS_PATH, "r") as f:
            return json.load(f)
    return {}

def save_agent_keys(data):
    AGENT_KEYS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(AGENT_KEYS_PATH, "w") as f:
        json.dump(data, f, indent=2)

def get_agent_key(agent_name):
    keys = get_agent_keys()
    return keys.get(agent_name, "")

def set_agent_key(agent_name, api_key):
    keys = get_agent_keys()
    keys[agent_name] = api_key
    save_agent_keys(keys)

def get_agent_config():
    if AGENT_CONFIG_PATH.exists():
        with open(AGENT_CONFIG_PATH, "r") as f:
            return json.load(f)
    return None

def _sanitize_credentials(obj):
    """Vacía recursivamente toda clave credencial (apiKey/channelTokens/password) — para export."""
    if isinstance(obj, dict):
        for k in list(obj.keys()):
            if re.search(r'(apikey|channeltokens|password)', k, re.IGNORECASE):
                obj[k] = ""
            else:
                _sanitize_credentials(obj[k])
    elif isinstance(obj, list):
        for v in obj:
            _sanitize_credentials(v)

# ============================================
# IA MODE (combo-routing local/cloud)
# ============================================

IA_MODE_PATH = Path(VAULT_PATH) / "system" / "ia-mode.json"

def get_ia_mode():
    if IA_MODE_PATH.exists():
        try:
            return json.loads(IA_MODE_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"mode": "cloud", "localMode": False, "cloudMode": True,
            "combosProvisioned": False, "cerebroAvisoVisto": False}

def save_ia_mode(data):
    IA_MODE_PATH.parent.mkdir(parents=True, exist_ok=True)
    IA_MODE_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

def _profile_model(profile: str, local: bool) -> str:
    """Modelo/combo de un perfil según toggle local/cloud.
    ponytail: fallback a models legacy (compat pre-combos) y defaults de PROFILE_DEFS."""
    config = get_agent_config() or {}
    table = config.get("modelsLocal") if local else config.get("models")
    m = (table or {}).get(profile)
    if not m:
        m = (config.get("models") or {}).get(profile)
    if not m:
        m = next((p["default"] for p in PROFILE_DEFS if p["key"] == profile), "openrouter/auto")
    return m

@app.get("/api/ia/mode")
async def get_ia_mode_ep():
    return get_ia_mode()

@app.put("/api/ia/mode")
async def set_ia_mode_ep(request: dict):
    data = get_ia_mode()
    mode = request.get("mode")
    if mode in ("local", "cloud", "both"):
        data["mode"] = mode
        data["localMode"] = mode in ("local", "both")
        data["cloudMode"] = mode in ("cloud", "both")
    for k in ("localMode", "cloudMode"):
        if k in request:
            data[k] = bool(request[k])
    save_ia_mode(data)
    return {"success": True, **data}

@app.get("/api/ia/aviso")
async def get_ia_aviso():
    return {"cerebroAvisoVisto": get_ia_mode().get("cerebroAvisoVisto", False)}

@app.post("/api/ia/aviso")
async def set_ia_aviso():
    data = get_ia_mode()
    data["cerebroAvisoVisto"] = True
    save_ia_mode(data)
    return {"success": True, "cerebroAvisoVisto": True}

def save_agent_config(data):
    AGENT_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(AGENT_CONFIG_PATH, "w") as f:
        json.dump(data, f, indent=2)


# ============================================
# FUNCIONES PARA MANEJAR EL CONTENEDOR DEL AGENTE
# ============================================

def _compose_cmd(*args):
    """Build a docker compose command scoped to this project."""
    project = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")
    # ponytail: -f points to mounted compose file so all callers work from /app
    compose_file = "/app/docker-compose.yml" if Path("/app/docker-compose.yml").exists() else None
    cmd = ["docker", "compose", "-p", project]
    if compose_file:
        cmd += ["-f", compose_file]
    return cmd + list(args)


def _agent_http_ready(timeout=1.5):
    """Return True when the Hermes dashboard is reachable on the Docker network."""
    for path in ("/login", "/"):
        try:
            response = httpx.get(f"{AGENT_INTERNAL_URL}{path}", timeout=timeout)
            if response.status_code in (200, 302, 401, 403):
                return True
        except Exception:
            pass
    return False


def start_agent_container():
    """Start the agent service via docker compose."""
    if _agent_http_ready(timeout=0.8):
        return True, "El agente ya está iniciado"

    result = subprocess.run(
        _compose_cmd("start", "sistema-agente"),
        capture_output=True, text=True, timeout=60
    )
    if result.returncode != 0:
        if _agent_http_ready(timeout=3):
            return True, "El agente ya está iniciado"
        return False, f"Error al iniciar agente: {result.stderr}"

    return True, "Agente iniciado"



def wait_for_agent_ready(timeout=180, interval=2):
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            if _agent_http_ready(timeout=2):
                return True
        except Exception:
            pass
        time.sleep(interval)
    return False


# ============================================
# ENDPOINTS DE ESTADO Y SALUD
# ============================================

@app.get("/")
async def root():
    return {
        "name": "Cerebro Virtual API",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
        "redoc": "/redoc"
    }

@app.get("/api/health")
async def health_check():
    vault_exists = Path(VAULT_PATH).exists()
    manifest_path = Path(VAULT_PATH) / "system" / "manifest.json"
    manifest_valid = manifest_path.exists()
    agent_keys = get_agent_keys()
    has_key = bool(agent_keys.get("hermes", "")) or bool(OPENROUTER_API_KEY)
    return {
        "status": "healthy" if vault_exists and manifest_valid else "degraded",
        "vault_exists": vault_exists,
        "manifest_valid": manifest_valid,
        "vault_path": VAULT_PATH,
        "timestamp": datetime.now().isoformat(),
        "openrouter_configured": has_key
    }

@app.get("/api/vault/status")
async def vault_status():
    manifest_path = Path(VAULT_PATH) / "system" / "manifest.json"
    if not manifest_path.exists():
        raise HTTPException(status_code=404, detail="Vault no encontrado o no inicializado")
    with open(manifest_path, "r") as f:
        manifest = json.load(f)
    identity_path = Path(VAULT_PATH) / "system" / "identity.json"
    identity = {}
    if identity_path.exists():
        with open(identity_path, "r") as f:
            identity = json.load(f)
    # New vault structure: raw/, wiki/, outputs/
    # ponytail: contar solo archivos reales (no dirs, no .gitkeep, no .processed)
    wiki_count = len([f for f in Path(VAULT_PATH).glob("wiki/**/*.md") if f.is_file() and f.name != ".gitkeep"])
    raw_files = len([f for f in Path(VAULT_PATH).glob("raw/**/*") if f.is_file() and f.name != ".gitkeep" and ".processed" not in str(f)])
    outputs_count = len([f for f in Path(VAULT_PATH).glob("outputs/**/*") if f.is_file() and f.name != ".gitkeep"])
    return {
        "manifest": manifest,
        "identity": identity,
        "vault_host_path": os.getenv("VAULT_HOST_PATH", ""),
        "stats": {
            "wiki_pages": wiki_count,
            "raw_files": max(raw_files, 0),
            "outputs": outputs_count,
        }
    }

@app.get("/api/notes")
async def list_notes():
    """List wiki pages (legacy endpoint name for frontend compatibility)."""
    wiki_path = Path(VAULT_PATH) / "wiki"
    notes = []
    if wiki_path.exists():
        for md_file in wiki_path.glob("**/*.md"):
            if md_file.name == "index.md":
                continue
            with open(md_file, "r", encoding="utf-8") as f:
                content = f.read()
            title = md_file.stem.replace("-", " ").title()
            for line in content.split("\n"):
                if line.startswith("# "):
                    title = line[2:].strip()
                    break
            notes.append({
                "id": md_file.stem,
                "title": title,
                "path": str(md_file.relative_to(VAULT_PATH)),
                "updatedAt": datetime.fromtimestamp(md_file.stat().st_mtime).isoformat()
            })
    return {"notes": notes, "total": len(notes)}

@app.get("/api/notes/{note_id}")
async def get_note(note_id: str):
    wiki_path = Path(VAULT_PATH) / "wiki"
    found_files = list(wiki_path.glob(f"**/{note_id}.md")) + list(wiki_path.glob(f"**/*{note_id}*.md"))
    if not found_files:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    file_path = found_files[0]
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    return {
        "id": note_id,
        "path": str(file_path.relative_to(VAULT_PATH)),
        "content": content
    }

@app.get("/api/config/models")
async def get_models_config():
    models_path = Path(VAULT_PATH) / "system" / "models.json"
    if not models_path.exists():
        return {
            "defaultModel": "deepseek/deepseek-v4-flash",
            "availableModels": [
                "deepseek/deepseek-v4-flash",
                "deepseek/deepseek-v4-flash",
            ],
            "provider": "openrouter",
            "apiKeyConfigured": bool(get_agent_key("hermes")) or bool(OPENROUTER_API_KEY)
        }
    with open(models_path, "r") as f:
        config = json.load(f)
        config["apiKeyConfigured"] = bool(get_agent_key("hermes")) or bool(OPENROUTER_API_KEY)
        return config


# ============================================
# ENDPOINTS PARA APIS AGENTES
# ============================================

@app.get("/api/agents/keys")
async def get_all_agent_keys():
    keys = get_agent_keys()
    return {
        "agents": [
            {
                "name": "hermes",
                "display_name": "Hermes",
                "configured": bool(keys.get("hermes", ""))
            }
        ]
    }

@app.get("/api/agents/hermes/key")
async def get_hermes_key():
    key = get_agent_key("hermes")
    return {"agent": "hermes", "configured": bool(key)}

@app.post("/api/agents/hermes/key")
async def set_hermes_key(request: dict):
    api_key = request.get("api_key", "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="API key no puede estar vacía")
    set_agent_key("hermes", api_key)
    # También actualizar agent-config.json para que generate_config.py la use
    config = get_agent_config()
    if config:
        config["apiKey"] = api_key
        config["updatedAt"] = datetime.now().isoformat()
        save_agent_config(config)
    return {"success": True, "agent": "hermes", "message": "API key guardada correctamente"}

@app.delete("/api/agents/hermes/key")
async def delete_hermes_key():
    keys = get_agent_keys()
    if "hermes" in keys:
        del keys["hermes"]
        save_agent_keys(keys)
    return {"success": True, "agent": "hermes", "message": "API key eliminada"}


# ============================================
# ENDPOINT DE CHAT CON HERMES (RAG + sesión persistente)
# ============================================

def _normalize(s: str) -> str:
    """Quita acentos y lowercase para comparación tolerante."""
    return s.lower().translate(str.maketrans("áéíóúüñ", "aeiouun"))

# ponytail: Graphify helpers — grafo "Neuronas" coexiste con grafo "Estructura" (wikilinks)
GRAPH_PATH = Path(VAULT_PATH) / "system" / "graph.json"

# Extensión que Graphify procesa (Pass 1 código + Pass 3 docs). Audio/video se queda en Whisper.
GRAPHIFY_EXTS = {".py",".js",".cjs",".ts",".tsx",".jsx",".go",".rs",".java",".rb",".c",".h",".cpp",".hpp",".cc",".cs",".kt",".swift",".php",".scala",".lua",".sh",".md",".rst",".txt",".mdx",".pdf",".png",".jpg",".jpeg",".gif",".webp",".bmp",".csv",".json",".yaml",".yml",".html",".htm",".xml",".sql"}

def _get_graphify_model() -> str:
    """Lee el modelo de Graphify desde agent-config.json. Default: google/gemma-4-26b-a4b-it:free."""
    config = get_agent_config()
    if config:
        models = config.get("models", {})
        gm = models.get("graphify", "")
        if gm:
            return gm
    return "deepseek/deepseek-v4-flash"

def _ensure_herramientas_image() -> bool:
    """Verifica que la imagen Docker de herramientas existe. Si no, la construye."""
    try:
        result = subprocess.run(
            ["docker", "images", "-q", "cerebrovirtual-herramientas:latest"],
            capture_output=True, text=True, timeout=5
        )
        if result.stdout.strip():
            return True
        # ponytail: imagen no existe → construir
        print("🔧 Imagen herramientas no encontrada, construyendo...")
        build_result = subprocess.run(
            _compose_cmd("build", "herramientas"),
            capture_output=True, text=True, timeout=120
        )
        if build_result.returncode != 0:
            print(f"❌ Error construyendo imagen herramientas: {build_result.stderr[:300]}")
            return False
        return True
    except Exception as e:
        print(f"❌ _ensure_herramientas_image error: {e}")
        return False


def _run_graphify(file_abs_path: str, vault_host: str) -> dict | None:
    """Ejecuta Graphify sobre el archivo aislado en un temp dir. Output a vault/system/graphify-tmp/graphify-out/graph.json.
    ponytail: Graphify espera un directorio. Aislamos el archivo en temp dir para no reprocesar siblings."""
    if not _ensure_herramientas_image():
        print("❌ Graphify abortado: imagen herramientas no disponible")
        return None
    import tempfile, shutil as _sh
    # ponytail: copiar archivo a temp dir dentro del vault (accesible desde el contenedor backend)
    src_file = Path(file_abs_path)
    if not src_file.exists():
        print(f"❌ Graphify: archivo no encontrado: {src_file}")
        return None
    # ponytail: temp dir dentro del vault para que el mount del contenedor efímero lo vea
    tmp_subdir = "system/graphify-iso"
    tmp_container = Path(VAULT_PATH) / tmp_subdir
    tmp_container.mkdir(parents=True, exist_ok=True)
    _sh.copy2(src_file, tmp_container / src_file.name)
    tmp_host = f"{vault_host}/{tmp_subdir}"
    out_subdir = "system/graphify-tmp"
    out_abs = f"/app/vault/{out_subdir}"
    try:
        graphify_model = _get_graphify_model()
        # ponytail: Graphify via OmniRoute (combo cerebro-graphify vive ahí; openrouter directo no conoce combos)
        omni_base = os.getenv("OMNIROUTE_BASE_URL", "http://omniroute:20128")
        env_vars = ["-e", f"OPENAI_API_KEY={get_agent_key('hermes') or OPENROUTER_API_KEY or ''}",
                    "-e", f"OPENAI_BASE_URL={omni_base}/v1",
                    "-e", f"GRAPHIFY_OPENAI_MODEL={graphify_model}",
                    "-e", "GRAPHIFY_FORCE=1"]
        result = subprocess.run(
            ["docker", "run", "--rm",
             "--network", "cerebrovirtual_cerebro-network",  # ponytail: resolver omniroute (combo) — default bridge no tiene DNS
             "-v", f"{vault_host}:/app/vault",
             *env_vars,
             "cerebrovirtual-herramientas:latest",
             "bash", "/app/scripts/run_graphify.sh", f"/app/vault/{tmp_subdir}", out_abs],
            capture_output=True, text=True, timeout=300
        )
        if result.returncode != 0:
            print(f"⚠️ Graphify falló (exit {result.returncode}): {result.stderr[:300]}")
            return None
        graph_file = Path(VAULT_PATH) / out_subdir / "graphify-out" / "graph.json"
        if not graph_file.exists():
            print("⚠️ Graphify no generó graph.json — verificar que el archivo es soportado")
            return None
        with open(graph_file) as f:
            partial = json.load(f)
        node_count = len(partial.get("nodes", []))
        edge_count = len(partial.get("edges", []))
        print(f"✅ Graphify OK: {node_count} nodos, {edge_count} edges para {src_file.name}")
        _sh.rmtree(Path(VAULT_PATH) / out_subdir / "graphify-out", ignore_errors=True)
        return partial
    except subprocess.TimeoutExpired:
        print(f"⏱️ Graphify timeout (300s) para {src_file.name}")
        return None
    except Exception as e:
        print(f"❌ Graphify error: {e}")
        return None
    finally:
        _sh.rmtree(tmp_container, ignore_errors=True)

def _merge_graph(partial: dict, source_file: str) -> None:
    """Merge graph parcial de Graphify con graph.json global del vault."""
    if not partial or "nodes" not in partial:
        return
    # audit run-1: lock — 7 escritores en 3 contextos pisaban el archivo; parse-failure ≠ grafo vacío
    with _GRAPH_LOCK:
        existing = {"nodes": [], "edges": []}
        if GRAPH_PATH.exists():
            try:
                with open(GRAPH_PATH) as f:
                    existing = json.load(f)
            except Exception:
                print("⚠️ graph.json ilegible — merge abortado para no borrar el conocimiento (audit run-1)")
                return

        # tag nodos con source_file
        for n in partial.get("nodes", []):
            if "source_file" not in n:
                n["source_file"] = source_file

        # ponytail: dedup por id — si un nodo con mismo id+source_file ya existe, reemplazar
        existing_ids = {(n.get("id"), n.get("source_file")) for n in existing["nodes"]}
        new_nodes = [n for n in partial["nodes"] if (n.get("id"), n.get("source_file")) not in existing_ids]
        existing["nodes"].extend(new_nodes)

        # edges: dedup por (source, target, relation)
        existing_edges = {(e.get("source"), e.get("target"), e.get("relation")) for e in existing["edges"]}
        new_edges = [e for e in partial.get("edges", []) if (e.get("source"), e.get("target"), e.get("relation")) not in existing_edges]
        existing["edges"].extend(new_edges)

        GRAPH_PATH.parent.mkdir(parents=True, exist_ok=True)
        _atomic_dump(GRAPH_PATH, existing)
        _record_graphed(source_file)

# fase 3 visor-md: meta de qué archivo fue grafiado y cuándo — alimenta el icono "modificado" del visor
def _resolve_vault_file(name: str):
    vault = Path(VAULT_PATH)
    for cand in [vault / name, *vault.glob(f"raw/**/{name}"), *vault.glob(f"outputs/**/{name}")]:
        if cand.is_file():
            return cand
    return None

def _record_graphed(source_file: str) -> None:
    try:
        f = _resolve_vault_file(source_file)
        if not f:
            return
        meta_path = GRAPH_PATH.parent / "graph-meta.json"
        with _GRAPH_LOCK:  # audit run-1: meta RMW sin lock
            meta = {}
            if meta_path.exists():
                try: meta = json.load(open(meta_path))
                except Exception:
                    print("⚠️ graph-meta.json ilegible — registro abortado (audit run-1)")
                    return
            meta[source_file] = datetime.fromtimestamp(f.stat().st_mtime).isoformat()
            _atomic_dump(meta_path, meta)
    except Exception as e:
        print(f"⚠️ _record_graphed: {e}")

def _prune_graph_json(source_file: str) -> None:
    """Elimina nodos/edges de un archivo borrado del graph.json global."""
    # ponytail: O(n) scan, suficiente hasta miles de nodos
    if not GRAPH_PATH.exists():
        return
    try:
        with _GRAPH_LOCK:  # audit run-1: RMW sin lock + no atómico
            with open(GRAPH_PATH) as f:
                graph = json.load(f)
            before = len(graph.get("nodes", []))
            graph["nodes"] = [n for n in graph.get("nodes", []) if n.get("source_file") != source_file]
            valid_ids = {n["id"] for n in graph["nodes"]}
            graph["edges"] = [e for e in graph.get("edges", [])
                              if e.get("source") in valid_ids and e.get("target") in valid_ids]
            _atomic_dump(GRAPH_PATH, graph)
        pruned = before - len(graph["nodes"])
        if pruned:
            print(f"🧹 Graphify: pruned {pruned} nodes for {source_file}")
    except Exception as e:
        print(f"⚠️ _prune_graph_json error: {e}")

def _sync_graph_json() -> None:
    """Elimina nodos de graph.json cuyo source_file ya no existe en raw/ o outputs/."""
    # ponytail: O(n) scan — called at startup + GET /api/graph/full. Verifica raw/ + outputs/.
    if not GRAPH_PATH.exists():
        return
    try:
        with _GRAPH_LOCK:  # audit run-1: RMW sin lock + no atómico
            with open(GRAPH_PATH) as f:
                graph = json.load(f)
            existing_files = set()
            for category in ("raw", "outputs"):
                cat_path = Path(VAULT_PATH) / category
                if cat_path.exists():
                    for f_ in cat_path.rglob("*"):
                        if f_.is_file() and f_.name != ".gitkeep" and ".processed" not in str(f_):
                            existing_files.add(f_.name)
            before = len(graph.get("nodes", []))
            graph["nodes"] = [n for n in graph["nodes"]
                              if n.get("source_file") in existing_files or not n.get("source_file")]
            valid_ids = {n["id"] for n in graph["nodes"]}
            graph["edges"] = [e for e in graph.get("edges", [])
                              if e.get("source") in valid_ids and e.get("target") in valid_ids]
            _atomic_dump(GRAPH_PATH, graph)
        pruned = before - len(graph["nodes"])
        if pruned:
            print(f"🧹 Graphify: synced (pruned {pruned} orphan nodes)")
    except Exception as e:
        print(f"⚠️ _sync_graph_json error: {e}")

def _graphify_file_path(file_path: str) -> str:
    """Construye el path absoluto dentro del contenedor para un archivo del vault."""
    return f"/app/vault/{file_path}"

def search_graph(query: str, limit: int = 10, stems: list = None) -> dict:
    """Busca nodos en graph.json por label → devuelve nodos + edges adyacentes.
    ponytail: si stems se pasa, boost nodos cuyo source_file stem esté en la lista."""
    if not GRAPH_PATH.exists():
        return {"nodes": [], "edges": []}
    try:
        with open(GRAPH_PATH) as f:
            graph = json.load(f)
    except Exception:
        return {"nodes": [], "edges": []}

    q = _normalize(query)
    if not q:
        return {"nodes": [], "edges": []}

    # ponytail: scoring simple por coincidencia de palabras en label
    import re
    words = [w for w in re.split(r'\W+', q) if len(w) >= 3]
    if not words:
        words = [q]

    scored = []
    for n in graph.get("nodes", []):
        label = _normalize(n.get("label", ""))
        s = sum(1 for w in words if w in label)
        # ponytail: boost si source_file stem está en stems (viene de Estructura)
        if s > 0 and stems:
            sf = n.get("source_file", "")
            sf_stem = Path(sf).stem if sf else ""
            if sf_stem in stems:
                s += 5
        if s > 0:
            scored.append((s, n))
    scored.sort(key=lambda x: -x[0])
    matched_nodes = [n for _, n in scored[:limit]]
    matched_ids = {n["id"] for n in matched_nodes}

    # edges adyacentes a los nodos matcheados
    adj_edges = [e for e in graph.get("edges", [])
                 if e.get("source") in matched_ids or e.get("target") in matched_ids]

    # nodos conectados via esos edges (para dar contexto)
    adj_node_ids = set()
    for e in adj_edges:
        adj_node_ids.add(e.get("source"))
        adj_node_ids.add(e.get("target"))
    adj_node_ids -= matched_ids
    extra_nodes = [n for n in graph.get("nodes", []) if n["id"] in adj_node_ids]

    return {"nodes": matched_nodes + extra_nodes, "edges": adj_edges}

# ponytail: sistema de proyectos — vault/system/projects.json
PROJECTS_PATH = Path(VAULT_PATH) / "system" / "projects.json"

def _load_projects() -> dict:
    if not PROJECTS_PATH.exists():
        return {"projects": []}
    try:
        with open(PROJECTS_PATH) as f:
            return json.load(f)
    except Exception:
        return {"projects": []}

def _save_projects(data: dict) -> None:
    PROJECTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(PROJECTS_PATH, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def _slugify(name: str) -> str:
    # ponytail: stdlib slug, no python-slugify
    import re, uuid
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower().strip()).strip('-')
    return slug or f"proyecto-{uuid.uuid4().hex[:8]}"

def search_vault(query: str, limit: int = 5):
    """Search wiki/ then raw/ by palabras clave. Acento-insensible."""
    # ponytail: extraer palabras significativas (>=3 chars, sin puntuacion, ignorar stopwords)
    import re
    stopwords = {"que","del","los","las","con","por","para","una","uno","como","sobre","sabe","saben","dame","dime","hay","tiene","mio","mas","muy","tan","the","and","for","what","how","tell","me","about"}
    words = [w for w in re.split(r'\W+', _normalize(query)) if len(w) >= 3 and w not in stopwords]
    if not words:
        words = [_normalize(query)]

    def score(content):
        c = _normalize(content)
        return sum(1 for w in words if w in c)

    results = []
    wiki_path = Path(VAULT_PATH) / "wiki"
    if wiki_path.exists():
        scored = []
        for md_file in wiki_path.glob("**/*.md"):
            try:
                content = md_file.read_text(encoding="utf-8")
                s = score(content)
                if s > 0:
                    title = md_file.stem.replace("-", " ").title()
                    for line in content.split("\n"):
                        if line.startswith("# "):
                            title = line[2:].strip()
                            break
                    scored.append((s, {"title": title, "path": str(md_file.relative_to(VAULT_PATH)), "content": content[:500]}))
            except Exception:
                continue
        scored.sort(key=lambda x: -x[0])
        results = [r for _, r in scored[:limit]]

    if len(results) < limit:
        raw_path = Path(VAULT_PATH) / "raw"
        if raw_path.exists():
            scored = []
            for f in raw_path.glob("**/*.{txt,md}"):
                try:
                    content = f.read_text(encoding="utf-8")
                    s = score(content)
                    if s > 0:
                        scored.append((s, {"title": f.stem, "path": str(f.relative_to(VAULT_PATH)), "content": content[:500]}))
                except Exception:
                    continue
            scored.sort(key=lambda x: -x[0])
            results.extend(r for _, r in scored[:limit - len(results)])
    return results


# ponytail: chunker + sintetizador lossless — sin truncar, multi-petición por archivo
CHUNK_SIZE = 6000  # chars por chunk (~1500 tokens, deja margen respuesta)
# ponytail: bin por PATH del container (nueva imagen: /root/.local/bin/hermes; vieja: venv/bin)
HERMES_BIN = "hermes"


def _chunk_text(text: str, size: int = CHUNK_SIZE) -> list:
    """Divide texto en chunks por párrafo (no corta a mitad de línea)."""
    if len(text) <= size:
        return [text]
    chunks, cur, cur_len = [], [], 0
    for para in text.split("\n"):
        if cur_len + len(para) > size and cur:
            chunks.append("\n".join(cur))
            cur, cur_len = [], 0
        cur.append(para)
        cur_len += len(para) + 1
    if cur:
        chunks.append("\n".join(cur))
    return chunks


def _parse_hermes_output(stdout: str) -> str:
    """Extrae texto entre separadores unicode de Hermes."""
    lines = stdout.split("\n")
    out, in_resp = [], False
    for ln in lines:
        if "Hermes" in ln and "─" in ln:
            in_resp = True
            continue
        if in_resp:
            if ln.startswith("Resume this session") or ln.startswith("Session:"):
                break
            out.append(ln.strip(" ╭╮╰╯│─"))
    while out and not out[-1]:
        out.pop()
    return "\n".join(out).strip() or stdout.strip()


def _strip_to_markdown(text: str, level: int = 1) -> str:
    """Corta todo hasta el primer heading real (level 1 = '# ', 2 = '## ').
    ponytail: el transcript de hermes puede traer bloque Reasoning o eventos de tools
    antes del contenido — el doc SIEMPRE empieza por su heading, así que se corta ahí."""
    m = re.search(rf'^{"#" * level} ', text, re.MULTILINE)
    return text[m.start():].strip() if m else text.strip()


def _synthesize_wiki(stem: str, extracted_text: str, api_key: str) -> str:
    """Sintetiza wiki lossless. Multi-chunk si el texto es grande.
    Chunk 1: instrucciones + título. Chunks N>: 'continúa el documento, misma estructura'.
    Devuelve Markdown concatenado."""
    chunks = _chunk_text(extracted_text)
    parts = []
    for i, chunk in enumerate(chunks):
        if i == 0:
            prompt = (
                "Responde SOLO con Markdown, sin preámbulos ni explicaciones. "
                "Reorganiza TODO el texto en una página wiki. NO resumas, NO omitas contenido. "
                "Estructura: # Título, ## Secciones, preserva toda la información original, "
                "añade [[wikilinks]] a temas relacionados. "
                f"{'Es el inicio del documento.' if len(chunks) > 1 else ''}\n\nTexto:\n\n{chunk}"
            )
        else:
            prompt = (
                f"Continúa el mismo documento wiki (parte {i+1}/{len(chunks)}). "
                "Misma estructura: ## Secciones, sin omitir contenido, con [[wikilinks]]. "
                "No repitas el título. Empieza directamente con ##.\n\nTexto:\n\n{chunk}"
            )
        result = subprocess.run(
            ["docker", "compose", "-p", os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual"), "exec", "-e", f"OPENROUTER_API_KEY={api_key}",
             "sistema-agente", HERMES_BIN, "chat", "-q", prompt],
            capture_output=True, text=True, timeout=180
        )
        if result.returncode != 0:
            raise RuntimeError(f"Hermes chunk {i+1} falló: {result.stderr[:200]}")
        parsed = _parse_hermes_output(result.stdout)
        if not parsed:
            raise RuntimeError(f"Hermes chunk {i+1} respuesta vacía")
        parts.append(parsed)
    return "\n\n".join(parts)


# ============================================
# CHAT SESSIONS — Sesiones persistentes en vault/chat-sesiones/
# ============================================

import uuid

SESSIONS_DIR = lambda: Path(VAULT_PATH) / "chat-sesiones"

def _ensure_sessions_dir():
    d = SESSIONS_DIR()
    d.mkdir(parents=True, exist_ok=True)
    (d / ".gitkeep").touch(exist_ok=True)

def _session_path(session_id: str) -> Path:
    return SESSIONS_DIR() / f"{session_id}.json"

def _load_session(session_id: str) -> dict | None:
    p = _session_path(session_id)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None

def _save_session(session: dict):
    _ensure_sessions_dir()
    p = _session_path(session["id"])
    p.write_text(json.dumps(session, ensure_ascii=False, indent=2), encoding="utf-8")

def _unset_last_active():
    """Desmarca lastActive en todas las sesiones."""
    d = SESSIONS_DIR()
    if not d.exists():
        return
    for f in d.glob("*.json"):
        try:
            s = json.loads(f.read_text(encoding="utf-8"))
            if s.get("lastActive"):
                s["lastActive"] = False
                f.write_text(json.dumps(s, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            continue

def _load_session_history(session_id: str, limit: int = 10) -> list[dict]:
    """Lee últimos N mensajes para inyectar como contexto."""
    s = _load_session(session_id)
    if not s:
        return []
    msgs = s.get("messages", [])
    return msgs[-limit:] if len(msgs) > limit else msgs

def _save_to_session(session_id: str, role: str, content: str, context: dict = None, full_doc: str = ""):
    """Añade mensaje al JSON + actualiza updatedAt + auto-título."""
    s = _load_session(session_id)
    if not s:
        return
    msg = {
        "role": role,
        "content": content,
        "context": context,
        "timestamp": datetime.now().isoformat()
    }
    # fase 2 visor-md: docs de investigación llevan el doc completo para Visualizar tras recargar
    if full_doc:
        msg["full_doc"] = full_doc
    s["messages"].append(msg)
    s["updatedAt"] = datetime.now().isoformat()
    # ponytail: auto-título desde primer mensaje user
    if not s.get("title") and role == "user":
        s["title"] = content[:40].replace("\n", " ").strip()
    _save_session(s)

def _update_session_doc(session_id: str, old_content: str, content: str) -> bool:
    """fase investigador: guarda el borrador — actualiza el full_doc del mensaje-doc que coincide (0 tokens, sin grafo)."""
    s = _load_session(session_id)
    if not s:
        return False
    for m in s.get("messages", []):
        if m.get("full_doc") and m.get("full_doc") == old_content:
            m["full_doc"] = content
            s["updatedAt"] = datetime.now().isoformat()
            _save_session(s)
            return True
    return False

def _mark_session_brain(session_id: str, content: str, path: str) -> None:
    """fase investigador: marca el doc de la sesión como 'en el cerebro' (context.brain_path) — alimenta el badge del listado."""
    s = _load_session(session_id)
    if not s:
        return
    changed = False
    for m in s.get("messages", []):
        if m.get("full_doc") == content:
            m.setdefault("context", {})["brain_path"] = path
            changed = True
    if changed:
        s["updatedAt"] = datetime.now().isoformat()
        _save_session(s)


@app.get("/api/chat/sessions")
async def list_chat_sessions():
    _ensure_sessions_dir()
    d = SESSIONS_DIR()
    sessions = []
    for f in d.glob("*.json"):
        try:
            s = json.loads(f.read_text(encoding="utf-8"))
            sessions.append({
                "id": s["id"],
                "title": s.get("title", "Sin título"),
                "createdAt": s.get("createdAt"),
                "updatedAt": s.get("updatedAt"),
                "lastActive": s.get("lastActive", False),
            })
        except Exception:
            continue
    sessions.sort(key=lambda x: x.get("updatedAt") or "", reverse=True)
    return {"sessions": sessions}


@app.post("/api/chat/sessions")
async def create_chat_session():
    _ensure_sessions_dir()
    _unset_last_active()
    session = {
        "id": str(uuid.uuid4()),
        "title": "",
        "messages": [],
        "createdAt": datetime.now().isoformat(),
        "updatedAt": datetime.now().isoformat(),
        "lastActive": True,
    }
    _save_session(session)
    return {"id": session["id"], "title": session["title"], "createdAt": session["createdAt"]}


@app.get("/api/chat/sessions/{session_id}")
async def get_chat_session(session_id: str):
    s = _load_session(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    return s


@app.put("/api/chat/sessions/{session_id}")
async def update_chat_session(session_id: str, updates: dict):
    s = _load_session(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if "title" in updates:
        s["title"] = updates["title"]
    if "messages" in updates:
        s["messages"] = updates["messages"]
    if "lastActive" in updates and updates["lastActive"]:
        _unset_last_active()
        s["lastActive"] = True
    s["updatedAt"] = datetime.now().isoformat()
    _save_session(s)
    return {"id": s["id"], "title": s["title"], "updatedAt": s["updatedAt"]}


@app.delete("/api/chat/sessions/{session_id}")
async def delete_chat_session(session_id: str):
    p = _session_path(session_id)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    was_active = False
    s = _load_session(session_id)
    if s and s.get("lastActive"):
        was_active = True
    p.unlink()
    # ponytail: si era la activa, marcar la siguiente disponible
    if was_active:
        sessions = await list_chat_sessions()
        if sessions["sessions"]:
            next_s = _load_session(sessions["sessions"][0]["id"])
            if next_s:
                next_s["lastActive"] = True
                _save_session(next_s)
    return {"deleted": session_id}


# ============================================
# INTERNET SEARCH — SearXNG
# ============================================

SEARXNG_URL = "http://searxng:8080"

def search_internet(query: str, limit: int = 5, engines: str = "") -> list[dict]:
    """Busca en SearXNG. Returns [{title, url, snippet}]. engines: filtro de motores (p.ej. 'google')."""
    try:
        params = {"q": query, "format": "json"}
        if engines:
            params["engines"] = engines
        resp = httpx.get(f"{SEARXNG_URL}/search", params=params, timeout=15)
        data = resp.json()
        return [{"title": r.get("title", ""), "url": r.get("url", ""), "snippet": r.get("content", "")}
                for r in data.get("results", [])[:limit]]
    except Exception:
        return []

def _format_search_results(results: list[dict]) -> str:
    """Formatea resultados SearXNG como contexto para el modelo."""
    if not results:
        return ""
    out = "\n\n**Resultados de búsqueda web:**\n"
    for i, r in enumerate(results, 1):
        out += f"\n{i}. **{r['title']}**\n   URL: {r['url']}\n   {r['snippet'][:300]}\n"
    return out


# ============================================
# CHAT — Refactor con perfiles + modos + memoria
# ============================================

# ponytail: bin por PATH del container (nueva imagen: /root/.local/bin/hermes; vieja: venv/bin)
HERMES_BIN = "hermes"

def _kill_orphan_hermes():
    """El timeout mata el docker exec pero el hermes interno sigue generando — orfeo que
    satura el gateway y degrada las siguientes llamadas. pkill de los 'hermes chat' vivos."""
    subprocess.run(["docker", "compose", "-p", os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual"),
                    "exec", "-T", "sistema-agente", "pkill", "-f", "hermes chat"], capture_output=True)

def _parse_stream_json(result) -> str:
    """stream-json: el evento 'result' trae el texto RAW (el formato text renderiza markdown
    a cajitas y pierde los '#'). Fallback legado (parseo de transcript) si no hay eventos."""
    text, err = None, None
    for ln in result.stdout.splitlines():
        ln = ln.strip()
        if not ln.startswith("{"):
            continue
        try:
            e = json.loads(ln)
        except Exception:
            continue
        if e.get("type") == "result":
            if e.get("exit_code") == 0:
                text = e.get("text") or ""
            else:
                err = (e.get("text") or str(e))[:300]
    if err:
        raise RuntimeError(f"hermes: {err}")
    if text is not None and text.strip():
        return text.strip()
    return _parse_hermes_output(result.stdout)

def _ask_hermes(profile: str, prompt: str, history: list[dict] = None, timeout: int = 120, local: bool = False) -> str:
    """docker exec con perfil via HERMES_CONFIG, inyecta historial (últimos 10 msgs).
    ponytail: Hermes no tiene flag -p. Los perfiles son config.yaml separados.
    Se cargan via HERMES_CONFIG apuntando al config del perfil.
    El modelo va por flag (-m) → toggle local/cloud sin reconfigurar el perfil.
    v1.5.8: modo LOCAL = modelo en este ordenador (9B+ en CPU/GPU, prefill ~12k tokens):
    120s se quedaba corto y el chat moría en timeout — piso de 300s para local."""
    if local:
        timeout = max(timeout, 300)
    # ponytail: inyectar historial como contexto
    full_prompt = prompt
    if history:
        hist_text = "\n\n**Historial de conversación:**\n"
        for msg in history:
            role = msg.get("role", "")
            content = msg.get("content", "")[:500]
            hist_text += f"[{role}]: {content}\n"
        full_prompt = hist_text + "\n\n**Pregunta/mensaje actual:**\n" + prompt

    # ponytail: HERMES_CONFIG apunta al config.yaml del perfil dentro del contenedor
    profile_config = f"/app/hermes-home/profiles/{profile}/config.yaml"
    api_key = get_agent_key('hermes') or OPENROUTER_API_KEY
    model = _profile_model(profile, local)
    # ponytail: deepseek-v4-flash es reasoning model — el razonamiento en espiral causaba timeouts
    # intermitentes en docs largos. investigador y cerebro no lo necesitan (la calidad va en el prompt);
    # cerebro además meta-comentaba las reglas con razonamiento alto.
    reasoning_args = ["--reasoning", "low"] if profile in ("investigador", "cerebro") else []
    cmd = ["docker", "compose", "-p", os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual"),
           "exec", "-T",
           "-e", f"OPENROUTER_API_KEY={api_key}",
           "-e", f"HERMES_CONFIG={profile_config}",
           "sistema-agente", HERMES_BIN, "chat", "--provider", "custom", "-m", model,
           *reasoning_args,
           "--ignore-user-config", "-q", full_prompt, "--format", "stream-json"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if result.returncode != 0:
            # ponytail: fallback sin perfil (config global), mismo modelo por flag
            cmd_fallback = ["docker", "compose", "-p", os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual"),
                            "exec", "-T", "-e", f"OPENROUTER_API_KEY={api_key}",
                            "sistema-agente", HERMES_BIN, "chat", "--provider", "custom", "-m", model,
                            *reasoning_args,
                            "-q", full_prompt, "--format", "stream-json"]
            result = subprocess.run(cmd_fallback, capture_output=True, text=True, timeout=timeout)
            if result.returncode != 0:
                # v1.5.4: stderr+stdout combinados — antes, con salida vacía, el chat mostraba
                # "Error:" sin texto (imposible diagnosticar). Si no hay nada útil, pista de causa común.
                tail = ((result.stderr or "") + "\n" + (result.stdout or "")).strip()[-500:]
                raise RuntimeError(tail or "El asistente no dio detalles del error — si acabas de instalar o mover este cerebro, completa el asistente de configuración (wizard) desde la web y reintenta.")
    except subprocess.TimeoutExpired:
        _kill_orphan_hermes()
        raise
    return _parse_stream_json(result)

def _search_vault_context(query: str) -> tuple[str, list[str]]:
    """RAG grafo-primero. Returns (context_text, sources)."""
    graph_results = search_graph(query, limit=5)
    graph_nodes = graph_results.get("nodes", [])
    graph_edges = graph_results.get("edges", [])

    wiki_context = ""
    sources = []
    if graph_nodes:
        seen_stems = set()
        wiki_path = Path(VAULT_PATH) / "wiki"
        for n in graph_nodes:
            sf = n.get("source_file", "")
            if not sf:
                continue
            stem = Path(sf).stem
            if stem in seen_stems:
                continue
            seen_stems.add(stem)
            md_file = wiki_path / f"{stem}.md"
            if not md_file.exists():
                continue
            try:
                # fase investigador: 800 chars se quedaban cortos — los datos editados al final del
                # doc jamás entraban al RAG. 4k por doc, ~5 docs → ~20k de contexto (céntimos).
                content = md_file.read_text(encoding="utf-8")[:4000]
                title = stem.replace("-", " ").title()
                for line in content.split("\n"):
                    if line.startswith("# "):
                        title = line[2:].strip()
                        break
                wiki_context += f"\n**{title}** ({md_file.relative_to(VAULT_PATH)})\n{content}...\n"
                sources.append(title)
            except Exception:
                continue

    if not graph_nodes:
        vault_results = search_vault(query)
        if vault_results:
            wiki_context = "\n\n---\n**Contexto del vault:**\n"
            for i, r in enumerate(vault_results, 1):
                wiki_context += f"\n**{i}. {r['title']}** ({r['path']})\n{r['content']}...\n"
                sources.append(r["title"])
            wiki_context += "---\n"

    if graph_edges:
        wiki_context += "\n\n---\n**Relaciones del grafo:**\n"
        for e in graph_edges[:10]:
            wiki_context += f"  {e.get('source','?')} --{e.get('relation','rel')}--> {e.get('target','?')}\n"
        wiki_context += "---\n"

    return wiki_context, sources


@app.post("/api/chat")
async def chat(message: dict):
    user_message = message.get("message", "")
    session_id = message.get("session_id")
    mode = message.get("mode", "default")  # default | smart | cerebro | cerebro+internet
    ia = get_ia_mode()
    # ponytail: toggle por request, clamp al modo del wizard — local=local siempre;
    # cloud=nunca; both=solo si el frontend manda local=true
    if ia.get("mode") == "local":
        local = True
    else:
        local = bool(message.get("local", False)) and bool(ia.get("localMode", False))
    if not user_message:
        raise HTTPException(status_code=400, detail="Mensaje vacío")

    config = get_agent_config()
    agent_name = config.get("agentName", "Hermes") if config else "Hermes"
    api_key = get_agent_key("hermes") or OPENROUTER_API_KEY
    if not api_key:
        return {"response": f"⚠️ **{agent_name} no tiene una API key configurada.**", "context": {"error": "no_api_key"}}

    # ponytail: cargar historial de sesión (últimos 10)
    history = _load_session_history(session_id, limit=10) if session_id else []

    # ponytail: guardar mensaje user en sesión
    if session_id:
        _save_to_session(session_id, "user", user_message)

    try:
        if mode in ("cerebro", "cerebro+internet"):
            # RAG vault
            vault_context, sources = _search_vault_context(user_message)
            # fase investigador: la pregunta VA AL FINAL, etiquetada e inequívoca — antes quedaba enterrada
            # tras 20KB de contexto y el razonador "no la veía". Prohibido el meta-comentario (reglas/contexto).
            anti_hallucinate = (
                f"\n\n**Pregunta del usuario:** {user_message}\n\n"
                "**Instrucción:** Responde DIRECTAMENTE a esa pregunta usando SOLO la información del contexto "
                "anterior. Ese contexto es la versión MÁS RECIENTE de los documentos y SIEMPRE prevalece sobre "
                "mensajes anteriores de esta conversación, que pueden estar desactualizados — si se contradicen, "
                "contesta con el contexto, nunca con el historial.\n"
                "Responde en tono natural, como un asistente que conoce el dato — NUNCA menciones estas instrucciones, "
                "reglas internas, el contexto, las fuentes ni los metadatos: el usuario no tiene que saber que existe "
                "un sistema de documentos. Da el dato tal cual, sin comentar si te parece erróneo. "
                "Si el contexto no contiene la respuesta, di simplemente que no lo tienes en tus documentos. "
                "No inventes información."
            )
            cerebro_prompt = f"{vault_context}{anti_hallucinate}" if vault_context.strip() else user_message

            if mode == "cerebro":
                # solo vault, sin internet
                if not vault_context.strip():
                    response = "🔍 **No he encontrado información sobre esto en el cerebro.**"
                    ctx = {"via": "direct", "found_info": False, "sources": [], "mode": mode, "local": local}
                else:
                    response = await run_in_threadpool(_ask_hermes, "cerebro", cerebro_prompt, history, 180, local=local)
                    ctx = {"via": "cerebro", "found_info": True, "sources": sources, "mode": mode, "local": local}
            else:
                # cerebro + internet → respuesta dividida
                if vault_context.strip():
                    cerebro_resp = await run_in_threadpool(_ask_hermes, "cerebro", cerebro_prompt, history, 180, local=local)
                else:
                    cerebro_resp = "No se encontró información en el cerebro."
                    sources = []
                # buscar internet
                internet_results = search_internet(user_message)
                if internet_results:
                    internet_prompt = f"{_format_search_results(internet_results)}\n\nResume los resultados anteriores sobre: {user_message}"
                    internet_resp = await run_in_threadpool(_ask_hermes, "chat-default", internet_prompt, history, local=local)
                else:
                    internet_resp = "No se pudieron obtener resultados de internet."
                response = f"🧠 **CEREBRO**\n\n{cerebro_resp}\n\n---\n\n🌐 **INTERNET**\n\n{internet_resp}"
                ctx = {"via": "cerebro+internet", "found_info": bool(sources), "sources": sources, "mode": mode, "internet_results": len(internet_results), "local": local}

        else:
            # chat normal (default o smart) — busca internet por defecto
            profile = "chat-smart" if mode == "smart" else "chat-default"
            internet_results = search_internet(user_message)
            search_context = _format_search_results(internet_results)
            prompt = f"{search_context}\n\n{user_message}" if search_context else user_message
            response = await run_in_threadpool(_ask_hermes, profile, prompt, history, local=local)
            ctx = {"via": profile, "found_info": True, "sources": [], "mode": mode, "internet_results": len(internet_results), "local": local}

        # ponytail: guardar respuesta en sesión
        if session_id:
            _save_to_session(session_id, "assistant", response, ctx)

        return {"response": response, "context": ctx}

    except subprocess.TimeoutExpired:
        return {"response": "⏰ **Tiempo de espera agotado.**", "context": {"error": "timeout"}}
    except Exception as e:
        return {"response": f"❌ **Error:** {str(e)}", "context": {"error": str(e)}}


def _extract_summary(full_doc: str) -> str:
    """Extrae el resumen del documento. Busca '## Resumen', si no hay usa primeras 5 líneas."""
    import re as _re
    # ponytail: buscar bloque ## Resumen
    match = _re.search(r'##\s*Resumen\s*\n(.*?)(?=\n##\s|$)', full_doc, _re.DOTALL)
    if match:
        return match.group(1).strip()[:500]
    # fallback: primeras 5 líneas no-vacías
    lines = [l.strip() for l in full_doc.split('\n') if l.strip() and not l.strip().startswith('#')]
    return '\n'.join(lines[:5])[:500]


# ============================================
# INVESTIGADOR v2 — cuestionario + internet + niveles + deepen
# ============================================

@app.post("/api/chat/investigate/questions")
async def investigate_questions(message: dict):
    """Cuestionario del panel: 5 preguntas × 4 opciones (estilo grill).
    Con answers previas, la tanda nueva afina sobre ellas. round 1..3 (techo visible en el panel)."""
    topic = (message.get("topic") or "").strip()
    messages_list = message.get("messages", [])
    answers = message.get("answers") or []
    round_num = int(message.get("round") or 0) + 1
    if not topic and not messages_list:
        raise HTTPException(status_code=400, detail="No hay tema que investigar")
    if not (get_agent_key("hermes") or OPENROUTER_API_KEY):
        raise HTTPException(status_code=400, detail="No hay API key configurada")

    combined = topic
    for msg in messages_list:
        combined += f"\n[{msg.get('role', 'user')}]: {msg.get('content', '')}"

    prompt = (
        "Preparas una investigación personalizada para el usuario. Genera 5 preguntas de refinamiento SOBRE EL TEMA EN SÍ: "
        "datos concretos, subtemas, personas implicadas, fechas, alcance temporal o geográfico, ángulos o enfoques del contenido. "
        "PROHIBIDO preguntar por el formato del documento, la extensión, el idioma, el nivel o 'para qué lo quiere' — "
        "eso ya lo controla el usuario con los controles del panel. "
        "Las opciones suenan a persona: cortas, concretas, sin frases hechas de máquina.\n"
        'Responde SOLO con JSON válido, sin texto antes ni después: '
        '{"questions": [{"q": "...", "options": ["...", "...", "...", "..."]}]} '
        "— exactamente 5 preguntas, exactamente 4 opciones cada una.\n\n"
        f"Tema y contexto del usuario:\n{combined[:2000]}\n\n"
    )
    if answers:
        prompt += ("**Respuestas que el usuario ya dio (afina sobre ellas; NO repitas lo preguntado):**\n"
                   + "\n".join(f"- {a}" for a in answers) + "\n\n")
    prompt += f"Esta es la ronda {round_num} de 3."

    try:
        raw = await run_in_threadpool(_ask_hermes, "investigador", prompt, None, 60)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="⏱️ Las preguntas tardaron demasiado. Reintenta.")
    # ponytail: parseo tolerante — primer bloque {...} del output del modelo
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    questions = []
    if m:
        try:
            data = json.loads(m.group(0))
            questions = [{"q": q.get("q", ""), "options": [str(o) for o in (q.get("options") or [])[:4]]}
                         for q in data.get("questions", [])[:5]]
            questions = [q for q in questions if q.get("q")]
        except Exception:
            questions = []
    if not questions:
        raise HTTPException(status_code=502, detail="El modelo no devolvió preguntas válidas. Pulsa reintentar.")
    return {"questions": questions, "round": round_num}


@app.post("/api/chat/investigate/topic")
async def investigate_topic(message: dict):
    """Genera el tema a investigar a partir de los mensajes seleccionados (contexto del chat)."""
    messages_list = message.get("messages", [])
    if not messages_list:
        raise HTTPException(status_code=400, detail="No hay mensajes seleccionados")
    if not (get_agent_key("hermes") or OPENROUTER_API_KEY):
        raise HTTPException(status_code=400, detail="No hay API key configurada")
    combined = ""
    for msg in messages_list:
        combined += f"\n[{msg.get('role', 'user')}]: {msg.get('content', '')}"
    prompt = (
        "Resume en UNA frase corta el tema exacto que el usuario quiere investigar a partir de esta conversación. "
        "Responde SOLO la frase (sin comillas, sin preámbulos, sin punto final), máximo 120 caracteres.\n\n"
        f"Conversación:{combined[:3000]}"
    )
    try:
        topic = await run_in_threadpool(_ask_hermes, "investigador", prompt, None, 30)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="⏱️ El tema tardó demasiado. Reintenta.")
    topic = (topic or "").strip().strip('"').splitlines()[0][:200] if topic else ""
    if not topic:
        raise HTTPException(status_code=502, detail="El modelo no devolvió un tema. Reintenta.")
    return {"topic": topic}


@app.post("/api/chat/investigate")
async def investigate(message: dict):
    """Investiga tema/mensajes → documento Markdown completo + resumen breve.
    Campos opcionales: level (principiante|intermedio|experto), answers (directrices del cuestionario),
    topic, deepen {doc, subtema} (añade sección nueva al doc existente, no regenera)."""
    messages_list = message.get("messages", [])
    session_id = message.get("session_id")
    level = message.get("level", "")
    answers = message.get("answers") or []
    topic = (message.get("topic") or "").strip()
    deepen = message.get("deepen") or {}

    if not (get_agent_key("hermes") or OPENROUTER_API_KEY):
        return {"response": "⚠️ No hay API key configurada.", "full_doc": "", "context": {"error": "no_api_key"}}

    try:
        # ponytail: deepen — NO regenera el doc; sección nueva que se inserta antes de ## Fuentes
        if deepen.get("doc") and deepen.get("subtema"):
            doc, subtema = deepen["doc"], deepen["subtema"]
            prompt = (
                f"Añade UNA sección nueva a un documento de investigación existente. "
                f"Genera SOLO esa sección, empezando por el encabezado '## {subtema}' "
                "(con ### si lo necesita), en el mismo estilo del documento, sin repetir lo ya cubierto "
                "y sin cerrar el documento (sin Conclusiones ni Fuentes). Usa [[wikilinks]] y datos concretos.\n\n"
                f"**Resumen del documento existente:**\n{_extract_summary(doc)}\n\n"
                f"**Subtema a desarrollar:** {subtema}"
            )
            search = search_internet(subtema, limit=8, engines="google")
            if search:
                prompt += "\n\n" + _format_search_results(search)
            prompt += ("\n\nREGLA DE VERACIDAD: afirma SOLO datos de los resultados de búsqueda o del documento; "
                       "no inventes ni mezcles fragmentos de fuentes distintas."
                       "\n\nNo uses herramientas ni escribas archivos: responde la sección como texto en tu mensaje.")
            section = _strip_to_markdown(await run_in_threadpool(_ask_hermes, "investigador", prompt, None, 120), level=2)
            # ponytail: insertar antes de ## Fuentes existentes (título intacto, fuentes acumuladas)
            idx = doc.rfind("## Fuentes")
            full_doc = (doc[:idx].rstrip() + "\n\n" + section + "\n\n" + doc[idx:]) if idx != -1 else doc.rstrip() + "\n\n" + section
            # fase 2 visor-md: persistir ANTES de responder — recarga a mitad no pierde el doc
            if session_id:
                _save_to_session(session_id, "assistant", f"Sección añadida: {subtema}",
                                 {"via": "investigador", "is_document": True, "offer_save": True, "sources": []},
                                 full_doc=full_doc)
            return {"response": f"Sección añadida: {subtema}", "full_doc": full_doc,
                    "context": {"via": "investigador", "is_document": True, "offer_save": True, "sources": []}}

        if not messages_list and not topic:
            raise HTTPException(status_code=400, detail="No hay mensajes seleccionados ni tema")

        # ponytail: combinar mensajes seleccionados como contexto
        combined = ""
        for msg in messages_list:
            combined += f"\n[{msg.get('role', 'user')}]: {msg.get('content', '')}\n"
        if not topic:
            topic = combined.strip()

        # FIX investigador v2: internet SIEMPRE antes de generar (causa de la mala calidad anterior).
        # ponytail: sin filtro de engines — el mix default (google cse + ddg + wikipedia) es el robusto; 'google' puro se cae
        search_block = _format_search_results(search_internet(topic, limit=10))

        # ponytail: niveles = 3 plantillas de prompt (coste cero, se hacen los tres)
        level_block = {
            "principiante": "Audiencia principiante: sin jerga; explica cada término la primera vez que aparece y usa analogías cotidianas. ",
            "intermedio": "Audiencia intermedia: asume lo básico del tema; ni explicaciones elementales ni tecnicismos innecesarios. ",
            "experto": "Audiencia experta: directo al grano, técnico y denso en datos; sin explicaciones básicas ni introducir el tema. ",
        }.get(level, "")
        answers_block = ("**Directrices del cuestionario (respuestas del usuario):**\n"
                         + "\n".join(f"- {a}" for a in answers) + "\n\n") if answers else ""

        prompt = (
            f"TEMA A INVESTIGAR (obligatorio, no lo cambies): {topic}. "
            "Investiga EXACTAMENTE ese tema aunque la conversación hable de otras cosas. "
            "Genera un documento de investigación en Markdown compatible con Obsidian. "
            f"{level_block}Estructura FIJA: # Título, ## Resumen (3-5 líneas), secciones de desarrollo (##/###), "
            "## Conclusiones, ## Fuentes. **negritas**, listas, [[wikilinks]], tablas y code blocks cuando aplique. "
            "Sin preámbulos.\n\n"
            "REGLA DE VERACIDAD: afirma SOLO datos que aparezcan en los resultados de búsqueda o en el contexto del chat. "
            "NO inventes ni deduzcas ningún dato que no esté en las fuentes. NO mezcles fragmentos de fuentes distintas "
            "que hablan de personas o temas diferentes. Cada dato relevante debe poder rastrearse hasta una fuente de ## Fuentes.\n\n"
            + answers_block
            + f"Contexto del chat:\n{combined}\n"
            + search_block
            + "\nNo uses herramientas ni escribas archivos: responde el documento completo como texto en tu mensaje."
        )

        # ponytail: 300s de margen — con GLM-5.3-flash (~90 tok/s) un doc tarda 10-40s; cubre fases lentas del upstream
        full_doc = _strip_to_markdown(await run_in_threadpool(_ask_hermes, "investigador", prompt, None, 300))
        summary = _extract_summary(full_doc)

        # fase 2 visor-md: persistir ANTES de responder — recarga a mitad no pierde el doc
        ctx = {"via": "investigador", "is_document": True, "offer_save": True, "sources": []}
        if session_id:
            _save_to_session(session_id, "assistant", summary, ctx, full_doc=full_doc)

        return {
            "response": summary,
            "full_doc": full_doc,
            "context": ctx,
        }
    except subprocess.TimeoutExpired:
        return {"response": "⏱️ La investigación tardó demasiado.", "full_doc": "", "context": {"error": "investigate_timeout"}}


# ponytail: save-output — guarda Markdown en outputs/ + wiki/ + Graphify
from pydantic import BaseModel as _BM

class SaveOutputRequest(_BM):
    content: str
    project_id: str = "individual"
    name: str = ""
    description: str = ""
    session_id: str = ""

@app.post("/api/vault/save-output")
async def save_output(req: SaveOutputRequest):
    """Guarda doc en outputs/<project_id>/ + copia a wiki/ + Graphify."""
    import re as _re
    safe_name = _re.sub(r'[^a-z0-9\-_]+', '-', req.name.lower().strip()).strip('-') if req.name else ""
    if not safe_name:
        for line in req.content.split("\n"):
            if line.startswith("# "):
                safe_name = _re.sub(r'[^a-z0-9\-_]+', '-', line[2:].lower().strip()).strip('-')
                break
    if not safe_name:
        safe_name = f"doc-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

    out_dir = _confine("outputs", req.project_id)  # audit run-1: project_id sin confinar cruzaba mounts
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"{safe_name}.md"

    # ponytail: añadir descripción como metadata si existe
    content = req.content
    if req.description:
        content += f"\n\n---\n**Descripción**: {req.description}\n"
    out_file.write_text(content, encoding="utf-8")

    wiki_file = Path(VAULT_PATH) / "wiki" / f"{safe_name}.md"
    wiki_file.parent.mkdir(parents=True, exist_ok=True)
    wiki_file.write_text(content, encoding="utf-8")

    graphify_ok = False
    # fase investigador: graphify puede devolver 0 nodos (razonadores truncan el JSON) → hasta 3 intentos.
    # Merge SOLO con extracto no vacío — 0 nodos ≠ grafo actualizado, el toast no puede mentir.
    for _ in range(3):
        try:
            # ponytail: obtener vault_host real del host (VAULT_PATH es /app/vault dentro del contenedor)
            vault_host = os.getenv("VAULT_HOST_PATH", "") or VAULT_PATH
            partial = _run_graphify(str(out_file), vault_host)
            if partial and partial.get("nodes"):
                _merge_graph(partial, safe_name + ".md")
                graphify_ok = True
                break
        except Exception as e:
            print(f"⚠️ save-output graphify error: {e}")

    # fase investigador: marcar el doc de la sesión como 'en el cerebro' → badge en Ver investigaciones
    if req.session_id:
        _mark_session_brain(req.session_id, req.content, f"outputs/{req.project_id}/{safe_name}.md")

    return {
        "status": "saved",
        "path": f"outputs/{req.project_id}/{safe_name}.md",
        "wiki_path": f"wiki/{safe_name}.md",
        "graph_updated": graphify_ok,
        "project_id": req.project_id,
        "content": req.content,  # fase investigador: el frontend marca brain_path con esto al terminar el job
    }


class UpdateFileRequest(_BM):
    path: str
    content: str
    graphify: bool = True  # fase investigador: False = solo escribir archivo+wiki (instantáneo), sin re-grafiar


def _replace_graph(partial: dict, source_file: str) -> None:
    """fase 2 visor-md: reemplaza en graph.json los nodos/edges de UN archivo por los re-extraídos.
    Purga solo si el extracto nuevo llegó (grafo viejo > grafo vacío)."""
    # ponytail: extracto vacío NO purga — un reintentó de graphify sin nodos no puede borrar el conocimiento
    if not partial or not partial.get("nodes"):
        return
    with _GRAPH_LOCK:  # audit run-1: lock + atomic — RMW desde threadpool pisaba el event loop/daemons
        existing = {"nodes": [], "edges": []}
        if GRAPH_PATH.exists():
            try:
                with open(GRAPH_PATH) as f:
                    existing = json.load(f)
            except Exception:
                print("⚠️ graph.json ilegible — replace abortado para no borrar el conocimiento (audit run-1)")
                return
        # purga: nodos/edges de ESTE source_file (los sin source_file = sistema, quedan)
        existing["nodes"] = [n for n in existing["nodes"] if n.get("source_file") != source_file]
        existing["edges"] = [e for e in existing["edges"] if e.get("source_file") != source_file]
        # re-inserta con los mismos tags y dedups que _merge_graph
        for n in partial.get("nodes", []):
            if "source_file" not in n:
                n["source_file"] = source_file
        existing_ids = {(n.get("id"), n.get("source_file")) for n in existing["nodes"]}
        existing["nodes"].extend([n for n in partial["nodes"] if (n.get("id"), n.get("source_file")) not in existing_ids])
        existing_edges = {(e.get("source"), e.get("target"), e.get("relation")) for e in existing["edges"]}
        existing["edges"].extend([e for e in partial.get("edges", []) if (e.get("source"), e.get("target"), e.get("relation")) not in existing_edges])
        GRAPH_PATH.parent.mkdir(parents=True, exist_ok=True)
        _atomic_dump(GRAPH_PATH, existing)
    _record_graphed(source_file)


@app.post("/api/vault/update-file")
async def update_vault_file(req: UpdateFileRequest):
    """fase 2 visor-md: edición en caliente — reescribe raw/|outputs/, actualiza copia wiki y re-grafía ese archivo."""
    vault = Path(VAULT_PATH).resolve()
    target = (vault / req.path.lstrip("/")).resolve()
    # ponytail: confinado a raw/ u outputs/ — nada de escapes por ..
    if not (str(target).startswith(str(vault / "raw")) or str(target).startswith(str(vault / "outputs"))) \
            or target.suffix != ".md" or not target.exists():
        raise HTTPException(status_code=400, detail="Ruta no permitida")

    target.write_text(req.content, encoding="utf-8")

    # copia wiki: solo archivos de outputs/ que ya tienen espejo (save-output la crea)
    source_file = target.name
    wiki = vault / "wiki" / source_file
    if str(target).startswith(str(vault / "outputs")) and wiki.exists():
        wiki.write_text(req.content, encoding="utf-8")

    if not req.graphify:
        # fase investigador: pre-escritura instantánea del job save-doc — la vista del doc y el RAG
        # (wiki) son frescos YA; el formato LLM y el re-grafiado van después en el mismo job
        return {
            "status": "updated",
            "path": str(target.relative_to(vault)).replace("\\", "/"),
            "graph_updated": None,
        }

    graph_ok = False
    try:
        vault_host = os.getenv("VAULT_HOST_PATH", "") or VAULT_PATH
        # ponytail: graphify flaquea (reasoning consume el presupuesto y trunca el JSON → 0 nodos aleatorio);
        # 3 intentos y solo purge/merge con extracto NO vacío — grafo viejo > grafo vacío
        for _ in range(3):
            partial = await run_in_threadpool(_run_graphify, str(target), vault_host)
            if partial and partial.get("nodes"):
                await run_in_threadpool(_replace_graph, partial, source_file)
                graph_ok = True
                break
    except Exception as e:
        print(f"⚠️ update-file graphify error: {e}")

    return {
        "status": "updated",
        "path": str(target.relative_to(vault)).replace("\\", "/"),
        "graph_updated": graph_ok
    }


@app.get("/api/vault/file-status")
async def vault_file_status(path: str):
    """fase 3 visor-md: ¿está el archivo en el cerebro (grafo) y está modificado desde entonces?"""
    vault = Path(VAULT_PATH).resolve()
    target = (vault / path.lstrip("/")).resolve()
    if not str(target).startswith(str(vault)) or not target.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    name = target.name
    in_graph = False
    if GRAPH_PATH.exists():
        try:
            g = json.load(open(GRAPH_PATH))
            in_graph = any(n.get("source_file") == name for n in g.get("nodes", []))
        except Exception:
            pass
    stale = False
    try:
        meta_path = GRAPH_PATH.parent / "graph-meta.json"
        if in_graph and meta_path.exists():
            meta = json.load(open(meta_path))
            if name in meta:
                graphed = datetime.fromisoformat(meta[name])
                stale = target.stat().st_mtime - graphed.timestamp() > 2
    except Exception:
        pass
    return {"in_graph": in_graph, "stale": stale}


class FormatFragmentRequest(_BM):
    fragment: str


@app.post("/api/research/format-fragment")
async def format_fragment(req: FormatFragmentRequest):
    """fase 3 visor-md (2a): reformatea SOLO el fragmento nuevo con las reglas Graphify (TEMPLATE.md). Sin internet."""
    if not (get_agent_key("hermes") or OPENROUTER_API_KEY):
        return {"formatted": req.fragment, "context": {"error": "no_api_key"}}
    prompt = (
        "Reformatea este fragmento de documento de investigación para que cumpla las reglas de estructura Graphify. "
        "Devuelve SOLO el fragmento reformateado en Markdown — no añadas secciones nuevas ni repitas el documento entero.\n"
        "REGLAS: conceptos con nombre inequívoco, repetido IDÉNTICO cada vez; [[wikilink]] solo a conceptos que existan en el fragmento; "
        "relaciones explícitas con verbo (X depende de Y, X se configura con Z); una idea por párrafo; tablas solo comparaciones; "
        "sin emojis como datos. NO inventes datos nuevos: reordena y da formato a lo que ya está escrito. "
        "NO añadas listas de conceptos, resúmenes ni metadatos extra: devuelve únicamente el fragmento con el formato aplicado.\n\n"
        f"FRAGMENTO:\n{req.fragment}"
    )
    try:
        out = _strip_to_markdown(await run_in_threadpool(_ask_hermes, "investigador", prompt, None, 120), level=2)
        return {"formatted": out or req.fragment}
    except subprocess.TimeoutExpired:
        return {"formatted": req.fragment, "context": {"error": "timeout"}}


# ============================================
# fase 4 visor-md: JOBS en background — investigaciones y guardados sobreviven recargas del navegador
# ============================================
_JOBS: dict = {}  # id → {id, kind, status: running|done|error, started, done_at?, result?, error?}

def _jobs_prune() -> None:
    # ponytail: registro en memoria, último worker — reiniciar el backend los pierde (aceptado)
    now = datetime.now()
    for k in [k for k, j in _JOBS.items() if j["status"] != "running" and (now - datetime.fromisoformat(j.get("done_at", j["started"]))).total_seconds() > 3600]:
        _JOBS.pop(k, None)

@app.get("/api/jobs")
async def list_jobs():
    _jobs_prune()
    return {"jobs": list(_JOBS.values())}

@app.post("/api/jobs/investigate")
async def jobs_investigate(message: dict):
    """Lanza investigate() en background → {job_id}. El doc se persiste en la sesión DENTRO del job (recarga-safe)."""
    jid = uuid.uuid4().hex[:12]
    _JOBS[jid] = {"id": jid, "kind": "investigate", "status": "running", "started": datetime.now().isoformat(), "topic": (message.get("topic") or "")[:60]}

    async def run():
        try:
            d = await investigate(message)
            if d.get("context", {}).get("error"):
                _JOBS[jid].update(status="error", error=d.get("response", "Error"), done_at=datetime.now().isoformat())
            else:
                _JOBS[jid].update(status="done", result=d, done_at=datetime.now().isoformat())
        except Exception as e:
            _JOBS[jid].update(status="error", error=str(e), done_at=datetime.now().isoformat())

    asyncio.create_task(run())
    return {"job_id": jid, "topic": _JOBS[jid]["topic"]}


class SaveDocJobRequest(_BM):
    path: str = ""
    old_content: str = ""
    new_content: str = ""
    name: str = ""
    session_id: str = ""


@app.post("/api/jobs/save-doc")
async def jobs_save_doc(req: SaveDocJobRequest):
    """Guardado en background. path → update-file (re-grafíea SOLO ese archivo). Sin path + sesión →
    actualiza el borrador en la sesión (0 tokens, 0 grafo). Fallback sin sesión → save-output."""
    jid = uuid.uuid4().hex[:12]
    _JOBS[jid] = {"id": jid, "kind": "save-doc", "status": "running", "started": datetime.now().isoformat(), "path": req.path}

    async def run():
        try:
            # ponytail: mismo diff por conjuntos que el frontend — solo las líneas nuevas pasan por el LLM
            old_set = {l.strip() for l in req.old_content.split("\n") if l.strip()}
            added = [l for l in req.new_content.split("\n") if l.strip() and l.strip() not in old_set]
            final = req.new_content

            if req.path:
                # doc ya en el cerebro: escribir YA el contenido crudo — la vista del doc y el RAG
                # (wiki) son frescos al instante; el re-grafiado va después
                await update_vault_file(UpdateFileRequest(path=req.path, content=req.new_content, graphify=False))
                # fase investigador: SIN reescritura LLM en ediciones del usuario — lo que escribe se
                # guarda TAL CUAL (format_fragment corrompia datos: "25 de julio" → "5 de julio").
                # El estilo Graphify lo aporta el investigador al generar el doc original.
                final = req.new_content
                r = await update_vault_file(UpdateFileRequest(path=req.path, content=final))
                if req.session_id:
                    _update_session_doc(req.session_id, req.old_content, final)  # draft sincronizado con el archivo
            elif req.session_id and _update_session_doc(req.session_id, req.old_content, final):
                # ponytail: guardar borrador — solo la sesión, sin LLM ni grafo (ahorra tokens)
                r = {"status": "draft-saved", "draft": True, "path": ""}
            else:
                if added:
                    try:
                        d = await format_fragment(FormatFragmentRequest(fragment="\n".join(added)))
                        frag = (d.get("formatted") or "").strip()
                        if frag and not d.get("context", {}).get("error") and frag != "\n".join(added).strip():
                            added_set = {l.strip() for l in added}
                            out, ins = [], False
                            for l in req.new_content.split("\n"):
                                if l.strip() in added_set:
                                    if not ins: out.append(frag); ins = True
                                else: out.append(l)
                            final = "\n".join(out)
                    except Exception:
                        pass
                r = await save_output(SaveOutputRequest(content=final, project_id="individual", name=req.name or "investigacion"))
                r["formatted"] = bool(added)  # solo el fallback reescribe con LLM
            r.setdefault("formatted", False)
            # fase investigador: el frontend sincroniza chat/historial/panel con el contenido final
            r["old_content"] = req.old_content
            r["new_content"] = final
            _JOBS[jid].update(status="done", result=r, done_at=datetime.now().isoformat())
        except HTTPException as e:
            _JOBS[jid].update(status="error", error=str(e.detail), done_at=datetime.now().isoformat())
        except Exception as e:
            _JOBS[jid].update(status="error", error=str(e), done_at=datetime.now().isoformat())

    asyncio.create_task(run())
    return {"job_id": jid}


class SaveBrainJobRequest(_BM):
    content: str
    project_id: str = "individual"
    name: str = ""
    description: str = ""
    session_id: str = ""


@app.post("/api/jobs/save-brain")
async def jobs_save_brain(req: SaveBrainJobRequest):
    """fase investigador: 'Añadir al cerebro' en background — el matraz anima mientras importa
    (graphify tarda ~45s) y al acabar: toast + bolita (roja si las neuronas fallaron tras reintentos)."""
    jid = uuid.uuid4().hex[:12]
    _JOBS[jid] = {"id": jid, "kind": "save-brain", "status": "running", "started": datetime.now().isoformat(), "path": ""}

    async def run():
        try:
            r = await save_output(SaveOutputRequest(content=req.content, project_id=req.project_id,
                                                    name=req.name, description=req.description,
                                                    session_id=req.session_id))
            _JOBS[jid].update(status="done", result=r, done_at=datetime.now().isoformat())
        except HTTPException as e:
            _JOBS[jid].update(status="error", error=str(e.detail), done_at=datetime.now().isoformat())
        except Exception as e:
            _JOBS[jid].update(status="error", error=str(e), done_at=datetime.now().isoformat())

    asyncio.create_task(run())
    return {"job_id": jid}


# ============================================
# ENDPOINTS DE INICIALIZACIÓN (WIZARD)
# ============================================

@app.get("/api/init/status")
async def init_status():
    config = get_agent_config()
    return {"configured": config is not None, "hasConfig": config is not None}

@app.get("/api/init/config")
async def get_init_config():
    config = get_agent_config()
    if not config:
        raise HTTPException(status_code=404, detail="No hay configuración")
    safe_config = {
        "agentName": config.get("agentName", "Hermes"),
        "personality": config.get("personality", ""),
        "channels": config.get("channels", {}),
        "dashboardUser": config.get("dashboard", {}).get("user", ""),
        "createdAt": config.get("createdAt"),
        "updatedAt": config.get("updatedAt"),
        "hasApiKey": bool(config.get("apiKey"))
    }
    return safe_config

# (El endpoint /api/init/configure está definido más abajo, ampliado con soporte para modelMode y hardware)

@app.get("/api/agent/avatar")
async def get_agent_avatar():
    """Imagen del agente como data-URL (vacío = sin imagen)."""
    config = get_agent_config() or {}
    return {"avatar": config.get("avatar", "")}


@app.post("/api/agent/avatar")
async def set_agent_avatar(request: dict):
    config = get_agent_config()
    if config is None:
        raise HTTPException(status_code=404, detail="No hay configuración")
    data = (request.get("avatar") or "").strip()
    if data:
        if not data.startswith("data:image/"):
            raise HTTPException(status_code=400, detail="Formato no válido: se espera data:image/*")
        if len(data) > 400_000:
            raise HTTPException(status_code=413, detail="Imagen demasiado grande (máx ~300KB)")
    config["avatar"] = data
    config["updatedAt"] = datetime.now().isoformat()
    save_agent_config(config)
    return {"success": True, "avatar": data}


@app.get("/api/web/palettes")
async def get_web_palettes():
    """Paletas de color de la web (todos los dispositivos) + cuál está activa."""
    config = get_agent_config() or {}
    w = config.get("webTheme") or {}
    return {"palettes": w.get("palettes", []), "active": w.get("active", "")}


@app.post("/api/web/palettes")
async def save_web_palette(request: dict):
    """Crea/reemplaza una paleta {name, primary, secondary?, background?} y opcionalmente la activa."""
    config = get_agent_config()
    if config is None:
        raise HTTPException(status_code=404, detail="No hay configuración")
    name = (request.get("name") or "").strip()
    primary = (request.get("primary") or "").strip()
    if not name or not re.match(r"^#[0-9a-fA-F]{6}$", primary):
        raise HTTPException(status_code=400, detail="Se requiere nombre y color #rrggbb")
    hex_re = re.compile(r"^#[0-9a-fA-F]{6}$")
    pal = {"name": name, "primary": primary}
    for extra in ("secondary", "background"):
        v = (request.get(extra) or "").strip()
        if v and hex_re.match(v):
            pal[extra] = v
    w = config.setdefault("webTheme", {})
    palettes = w.setdefault("palettes", [])
    palettes[:] = [p for p in palettes if p.get("name") != name]
    palettes.append(pal)
    if request.get("activate", True):
        w["active"] = name
    config["updatedAt"] = datetime.now().isoformat()
    save_agent_config(config)
    return {"success": True, "palettes": palettes, "active": w.get("active", "")}


@app.delete("/api/web/palettes/{name}")
async def delete_web_palette(name: str):
    config = get_agent_config()
    if config is None:
        raise HTTPException(status_code=404, detail="No hay configuración")
    w = config.setdefault("webTheme", {})
    w["palettes"] = [p for p in w.get("palettes", []) if p.get("name") != name]
    if w.get("active") == name:
        w["active"] = ""
    config["updatedAt"] = datetime.now().isoformat()
    save_agent_config(config)
    return {"success": True, "palettes": w.get("palettes", []), "active": w.get("active", "")}


@app.delete("/api/web/active")
async def clear_web_active():
    """Desactiva la paleta global (vuelve al tema por defecto)."""
    config = get_agent_config()
    if config is None:
        raise HTTPException(status_code=404, detail="No hay configuración")
    w = config.setdefault("webTheme", {})
    w["active"] = ""
    config["updatedAt"] = datetime.now().isoformat()
    save_agent_config(config)
    return {"success": True}


@app.put("/api/agent/config")
async def update_agent_config(request: dict):
    config = get_agent_config()
    if not config:
        raise HTTPException(status_code=404, detail="No hay configuración")

    agent_name = request.get("agentName", "").strip()
    personality = request.get("personality", "").strip()

    if not agent_name:
        agent_name = "Hermes"
    if not personality:
        personality = "Eres un asistente útil, amigable y profesional. Ayudas a organizar el conocimiento y responder preguntas de manera clara y concisa."

    config["agentName"] = agent_name
    config["personality"] = personality
    config["updatedAt"] = datetime.now().isoformat()

    save_agent_config(config)
    return {"success": True, "message": "Configuración actualizada correctamente", "agentName": agent_name}


@app.delete("/api/init/reset")
async def reset_agent_config():
    import subprocess

    # 1. Eliminar configuraciones locales
    if AGENT_CONFIG_PATH.exists():
        AGENT_CONFIG_PATH.unlink()
    keys = get_agent_keys()
    if "hermes" in keys:
        del keys["hermes"]
        save_agent_keys(keys)

    # 2. Detener y eliminar el contenedor del agente
    try:
        subprocess.run(_compose_cmd("stop", "sistema-agente"), capture_output=True, check=False)
    except Exception as e:
        print(f"⚠️ No se pudo eliminar el agente: {e}")

    return {"success": True, "message": "Configuración eliminada y agente detenido. Reinicia la página para volver a configurar."}


@app.get("/api/config/export")
async def export_agent_config():
    """agent-config.json sin secretos (descarga desde Ajustes)."""
    config = get_agent_config()
    if not config:
        raise HTTPException(status_code=404, detail="No hay configuración")
    _sanitize_credentials(config)
    return Response(
        content=json.dumps(config, indent=2, ensure_ascii=False),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=agent-config.json"},
    )


@app.get("/api/agent/config")
async def get_agent_config_public():
    config = get_agent_config()
    if not config:
        raise HTTPException(status_code=404, detail="No hay configuración")
    return {
        "agentName": config.get("agentName", "Hermes"),
        "personality": config.get("personality", ""),
        "channels": config.get("channels", {}),
        "hasApiKey": bool(config.get("apiKey")),
        "createdAt": config.get("createdAt"),
        "updatedAt": config.get("updatedAt")
    }


# ============================================
# ENDPOINT PARA GESTIÓN DE MODELOS POR PERFIL
# ============================================

PROFILE_DEFS = [
    {"key": "chat-default", "label": "Chat Default", "default": "openrouter/auto"},
    {"key": "chat-smart", "label": "Chat Inteligente", "default": "deepseek/deepseek-v4-flash"},
    {"key": "cerebro", "label": "Cerebro", "default": "deepseek/deepseek-v4-flash"},
    {"key": "investigador", "label": "Investigador", "default": "deepseek/deepseek-v4-flash"},
    {"key": "graphify", "label": "Graphify (Neuronas)", "default": "deepseek/deepseek-v4-flash"},
]

@app.get("/api/profiles/models")
async def get_profiles_models():
    config = get_agent_config()
    if not config:
        raise HTTPException(status_code=404, detail="No hay configuración")
    models = config.get("models", {})
    models_local = config.get("modelsLocal", {})
    names = config.get("profileNames", {})
    return {"profiles": [
        {"key": p["key"], "name": names.get(p["key"], p["label"]),
         "model": models.get(p["key"], p["default"]),
         "modelLocal": models_local.get(p["key"], "")}
        for p in PROFILE_DEFS
    ]}


@app.put("/api/profiles/models")
async def update_profiles_models(request: dict):
    import subprocess
    config = get_agent_config()
    if not config:
        raise HTTPException(status_code=404, detail="No hay configuración")

    new_models = request.get("models", {})
    new_models_local = request.get("modelsLocal", {})
    new_names = request.get("profileNames", {})
    old_models = config.get("models", {})
    old_models_local = config.get("modelsLocal") or {}

    _validate_models(new_models)  # audit run-1: models sin validar → sed e en install_profiles.sh
    if isinstance(new_models_local, dict):
        _validate_models(new_models_local)

    config["models"] = new_models
    if new_models_local:
        config["modelsLocal"] = new_models_local
    config["profileNames"] = new_names
    config["updatedAt"] = datetime.now().isoformat()
    save_agent_config(config)

    # ponytail: reinicio solo si cambió algún modelo/combo; renombrar perfiles es solo visual
    models_changed = old_models != new_models or old_models_local != (new_models_local or {})
    if models_changed:
        # docker restart reejecuta entrypoint → generate_config.py + install_profiles.sh aplican nuevos modelos
        result = subprocess.run(_compose_cmd("restart", "sistema-agente"), capture_output=True, text=True, check=False)
        if result.returncode != 0:
            return {"success": False, "message": f"Modelos guardados pero error al reiniciar: {result.stderr}"}

        # Esperar readiness
        import time
        for _ in range(30):
            try:
                r = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "http://sistema-agente:8080/login"], capture_output=True, text=True, check=False)
                if r.stdout.strip() == "200":
                    break
            except:
                pass
            time.sleep(2)

    changes = [
        {"name": new_names.get(p["key"], p["label"]), "oldModel": old_models.get(p["key"], p["default"]), "newModel": new_models.get(p["key"], p["default"])}
        for p in PROFILE_DEFS
        if old_models.get(p["key"], p["default"]) != new_models.get(p["key"], p["default"])
    ]

    return {"success": True, "changes": changes}


# ============================================
# ENDPOINTS PARA REINICIAR E INICIAR EL AGENTE
# ============================================

@app.post("/api/agent/restart")
async def restart_agent():
    import subprocess
    try:
        result = subprocess.run(
            _compose_cmd("restart", "sistema-agente"),
            capture_output=True,
            text=True,
            check=False
        )
        if result.returncode == 0:
            return {"success": True, "message": "Agente reiniciado correctamente."}
        else:
            return {"success": False, "message": f"Error: {result.stderr}"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.post("/api/agent/full-restart")
async def full_restart_agent():
    """Destruye el contenedor del agente, borra la imagen y lo reconstruye desde cero.

    El vault (raw/, wiki/, outputs/) NO se toca. Solo se limpia el estado
    del sistema-agente (config.yaml, perfiles instalados, caché de Hermes).
    """
    # 1. Detener el contenedor del agente
    try:
        subprocess.run(_compose_cmd("stop", "sistema-agente"), capture_output=True, check=False, timeout=30)
    except Exception:
        pass
    except Exception:
        pass

    # 2. Borrar la imagen del agente para forzar rebuild limpio
    result = subprocess.run(
        _compose_cmd("build", "--no-cache", "sistema-agente"),
        capture_output=True, text=True, timeout=600
    )
    if result.returncode != 0:
        return {"success": False, "message": f"Error al reconstruir imagen: {result.stderr}"}

    # 4. Arrancar el contenedor nuevo
    success, message = start_agent_container()
    if not success:
        return {"success": False, "message": message}

    # 5. Esperar a que Hermes esté listo
    if wait_for_agent_ready(timeout=180):
        return {"success": True, "message": "Agente reconstruido y arrancado desde cero correctamente."}
    else:
        return {"success": False, "message": "El agente no respondió a tiempo después del reinicio."}


@app.post("/api/agent/start")
async def agent_start():
    """Inicia el contenedor del agente y espera a que esté listo."""
    config = get_agent_config()
    if not config:
        raise HTTPException(status_code=400, detail="No hay configuración. Ejecuta el wizard primero.")

    success, message = start_agent_container()
    if not success:
        return {"success": False, "message": message}

    if wait_for_agent_ready():
        return {"success": True, "message": "Agente listo"}
    else:
        return {"success": False, "message": "El agente no respondió a tiempo"}

# ============================================
# ENDPOINT PARA INTERFAZ WEB DEL AGENTE (PUERTO 8080)
# ============================================

@app.get("/api/agent/status", response_class=HTMLResponse)
async def agent_status_page():
    config = get_agent_config()
    agent_name = escape(config.get("agentName", "Hermes") if config else "Hermes", quote=True)  # audit run-1: XSS almacenado
    is_configured = config is not None

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>🧠 {agent_name} - Estado</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #0a0a0a;
                color: #e5e7eb;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
            }}
            .card {{
                background: #111827;
                border: 1px solid #1f2937;
                border-radius: 16px;
                padding: 2rem;
                max-width: 500px;
                width: 100%;
                text-align: center;
            }}
            .status {{
                font-size: 3rem;
                margin-bottom: 1rem;
            }}
            .name {{
                font-size: 1.5rem;
                font-weight: 600;
                margin-bottom: 0.5rem;
            }}
            .info {{
                color: #9ca3af;
                margin: 0.5rem 0;
            }}
            .badge {{
                display: inline-block;
                padding: 0.25rem 1rem;
                border-radius: 9999px;
                font-size: 0.875rem;
                font-weight: 500;
                margin-top: 1rem;
            }}
            .badge-online {{ background: #10b981; color: #0a0a0a; }}
            .badge-offline {{ background: #6b7280; color: #0a0a0a; }}
            .btn {{
                display: inline-block;
                margin-top: 1.5rem;
                padding: 0.75rem 2rem;
                background: #3b82f6;
                color: white;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 500;
                transition: background 0.2s;
            }}
            .btn:hover {{ background: #2563eb; }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="status">🧠</div>
            <div class="name">{agent_name}</div>
            <div class="info">Agente del Cerebro Virtual</div>
            <div>
                <span class="badge {'badge-online' if is_configured else 'badge-offline'}">
                    {'✅ En línea' if is_configured else '⏳ Sin configurar'}
                </span>
            </div>
            <div style="margin-top: 1rem; color: #6b7280; font-size: 0.875rem;">
                {f'Configurado el: {escape(str(config.get("createdAt", "desconocido"))[:10], quote=True)}' if is_configured else 'Completa el wizard para configurar el agente.'}
            </div>
            <a href="http://localhost:5173" class="btn">🎯 Ir al Cerebro Virtual</a>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)


@app.get("/api/system/info")
async def system_info():
    return {
        "version": "2.0.0",
        "vault_path": VAULT_PATH,
        "python_version": "3.11",
        "framework": "FastAPI",
        "vault_structure": ["raw", "wiki", "outputs"],
        "subagents": ["coordinador", "editor", "investigador-resumidor", "indexador", "sintetizador"],
        "openrouter_available": bool(get_agent_key("hermes")) or bool(OPENROUTER_API_KEY)
    }



@app.post("/api/init/configure")
async def configure_agent(request: dict):
    """Guarda la configuración del agente. Siempre modelMode=openrouter."""
    try:
        print("🔵 Recibida petición:", request)
        agent_name = request.get("agentName", "").strip()
        personality = request.get("personality", "").strip()
        api_key = request.get("apiKey", "").strip()
        channels = request.get("channels", {})
        dashboard_user = request.get("dashboardUser", "").strip()
        dashboard_password = request.get("dashboardPassword", "").strip()
        telegram_token = request.get("telegramToken", "").strip()
        discord_token = request.get("discordToken", "").strip()
        whatsapp_phone = request.get("whatsappPhone", "").strip()
        models = request.get("models", {})
        _validate_models(models)  # audit run-1: models sin validar → sed e en install_profiles.sh
        cloudflare_token = _extract_tunnel_token(request.get("cloudflareTunnelToken", "").strip())

        if not agent_name:
            agent_name = "Hermes"
        if not personality:
            personality = "Eres un asistente útil, amigable y profesional. Ayudas a organizar el conocimiento y responder preguntas de manera clara y concisa."

        if not api_key:
            raise HTTPException(status_code=400, detail="La API Key es obligatoria para OpenRouter")

        config = {
            "agentName": agent_name,
            "personality": personality,
            "apiKey": api_key,
            "modelMode": "openrouter",
            "channels": {
                "web": True,
                "telegram": channels.get("telegram", False),
                "whatsapp": channels.get("whatsapp", False),
                "discord": channels.get("discord", False)
            },
            "dashboard": {
                "user": dashboard_user,
                "password": dashboard_password
            },
            "channelTokens": {
                            "telegram": telegram_token,
                            "discord": discord_token,
                            "whatsapp": whatsapp_phone
                        },
                        "models": models,
            "createdAt": datetime.now().isoformat(),
            "updatedAt": datetime.now().isoformat()
        }

        save_agent_config(config)
        set_agent_key("hermes", api_key)

        # ponytail: contraseña unificada — misma credencial abre Hermes :8080 y OmniRoute :20128
        pw_status = ""
        if dashboard_password:
            pw_status = await run_in_threadpool(_apply_dashboard_password, dashboard_password)

        # task 7: modo IA del wizard → ia-mode.json + provision combos OmniRoute
        ia_mode = request.get("iaMode")  # local | cloud | both (opcional; default cloud)
        if ia_mode in ("local", "cloud", "both"):
            ia = get_ia_mode()
            ia["mode"] = ia_mode
            ia["localMode"] = ia_mode in ("local", "both")
            ia["cloudMode"] = ia_mode in ("cloud", "both")
            save_ia_mode(ia)

        # ponytail: tunnel token goes to .env only, NOT to vault (agent-config.json)
        if cloudflare_token:
            _update_env_token(cloudflare_token)
            ok, err = _start_cloudflared()
            if not ok:
                print(f"⚠️ Tunnel token guardado pero error al iniciar: {err}")

        provision = {"success": False}
        if ia_mode in ("local", "cloud", "both"):
            provision = await _omni_provision_combos(ia_mode)
            if not provision.get("success"):
                # no bloquea la instalación: startup reintenta con combosProvisioned=false
                print(f"⚠️ provision combos diferido: {provision.get('errors') or provision.get('error')}")

        return {"success": True, "message": "Configuración guardada correctamente", "agentName": agent_name, "provision": provision, "passwordStatus": pw_status}
    except Exception as e:
        import traceback
        print("❌ ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


# ============================================
# ENDPOINTS PARA EXPORTAR/IMPORTAR VAULT
# ============================================

@app.get("/api/vault/export")
async def export_vault():
    """Genera un .tar.gz del vault y lo sirve como descarga."""
    import tempfile
    import tarfile
    from fastapi.responses import FileResponse

    vault_path = Path(VAULT_PATH)
    if not vault_path.exists():
        raise HTTPException(status_code=404, detail="Vault no encontrado")

    timestamp = datetime.now().strftime("%Y-%m-%d")
    temp_dir = tempfile.mkdtemp()
    export_file = Path(temp_dir) / f"vault-backup-{timestamp}.tar.gz"

    # ponytail: excluir credenciales del export — el destino pide su propia API key en el wizard
    SENSITIVE = {"agent-keys.json"}
    try:
        with tarfile.open(export_file, "w:gz") as tar:
            for item in vault_path.rglob("*"):
                if not item.is_file():
                    continue
                if ".git" in item.parts:
                    continue
                if item.name in SENSITIVE:
                    continue
                if item.name == "agent-config.json":
                    # task 2: versión sin credenciales (apiKey/channelTokens/password), misma estructura
                    try:
                        cfg = json.loads(item.read_text(encoding="utf-8"))
                        _sanitize_credentials(cfg)
                        payload = json.dumps(cfg, indent=2, ensure_ascii=False).encode("utf-8")
                        info = tar.gettarinfo(str(item), arcname=str(item.relative_to(vault_path)))
                        info.size = len(payload)
                        tar.addfile(info, io.BytesIO(payload))
                        continue
                    except Exception as e:
                        # si no parsea, excluir entero — nunca credenciales en claro
                        print(f"⚠️ agent-config.json excluido del export: {e}")
                        continue
                tar.add(str(item), arcname=str(item.relative_to(vault_path)))
        return FileResponse(
            path=str(export_file),
            media_type="application/gzip",
            filename=f"vault-backup-{timestamp}.tar.gz"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al exportar: {e}")


@app.post("/api/vault/import")
async def import_vault(file: UploadFile = File(...)):
    """Acepta .tar.gz o .tar, lo descomprime en el vault.
    ponytail: preserva API key + dashboard del destino — ya configurados por wizard.
    Solo borra agent-keys.json del import (no debe sobreescribir el local)."""
    import tempfile, tarfile, io, shutil

    vault_path = Path(VAULT_PATH)

    try:
        content = await file.read()
        tar_io = io.BytesIO(content)

        # ponytail: detectar formato — probar r:gz primero, luego r:
        tar = None
        try:
            tar = tarfile.open(fileobj=tar_io, mode="r:gz")
        except tarfile.ReadError:
            tar_io.seek(0)
            try:
                tar = tarfile.open(fileobj=tar_io, mode="r:")
            except tarfile.ReadError:
                raise HTTPException(status_code=400, detail="El archivo no es un .tar o .tar.gz válido")

        # ponytail: backup del vault actual por seguridad
        backup_dir = vault_path.parent / f"vault-backup-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        if vault_path.exists():
            shutil.copytree(str(vault_path), str(backup_dir), dirs_exist_ok=True)

        # Extraer a temp primero
        temp_dir = Path(tempfile.mkdtemp())
        tar.extractall(str(temp_dir), filter="data")  # audit run-1: sin filtro, members ../ escribían fuera del temp
        tar.close()

        # Validar estructura
        required_dirs = ["raw", "wiki", "outputs", "system"]
        found_dirs = [d.name for d in temp_dir.iterdir() if d.is_dir()]
        missing = [d for d in required_dirs if d not in found_dirs]
        if missing:
            raise HTTPException(status_code=400, detail=f"Estructura inválida. Faltan: {', '.join(missing)}")

        # ponytail: preservar config existente del destino (API key, dashboard) — NO sanitizar
        existing_config = None
        existing_keys = None
        if AGENT_CONFIG_PATH.exists():
            existing_config = AGENT_CONFIG_PATH.read_text(encoding="utf-8")
        if AGENT_KEYS_PATH.exists():
            existing_keys = AGENT_KEYS_PATH.read_text(encoding="utf-8")

        # Copiar contenido del tar al vault
        for item in temp_dir.iterdir():
            dest = vault_path / item.name
            if dest.exists():
                if dest.is_dir():
                    shutil.rmtree(str(dest))
                else:
                    dest.unlink()
            shutil.move(str(item), str(dest))

        # ponytail: restaurar config local preservada — el import no toca credenciales
        if existing_config:
            AGENT_CONFIG_PATH.write_text(existing_config, encoding="utf-8")
        if existing_keys:
            AGENT_KEYS_PATH.write_text(existing_keys, encoding="utf-8")
        # si el tar traía agent-keys.json, ya se sobreescribió arriba con shutil.move
        # pero existing_keys (local) lo restaura después

        shutil.rmtree(str(temp_dir), ignore_errors=True)

        # ponytail: reiniciar agente para que cargue los datos nuevos
        try:
            subprocess.run(_compose_cmd("restart", "sistema-agente"), capture_output=True, timeout=30)
        except Exception:
            pass

        return {
            "success": True,
            "message": "Vault importado correctamente. Credenciales preservadas."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al importar: {e}")


@app.post("/api/vault/reset")
async def reset_vault():
    """Reinicio de bóveda: borra TODO el contenido (raw, wiki, outputs, chat-sesiones)
    y resetea índice y grafo. La configuración del agente NO se toca — el agente sigue
    funcionando, sin saber nada de los archivos del cerebro."""
    import shutil
    vault = Path(VAULT_PATH)
    if not vault.exists():
        raise HTTPException(status_code=404, detail="Vault no encontrado")
    for sub in ("raw", "wiki", "outputs", "chat-sesiones"):
        d = vault / sub
        if d.exists():
            shutil.rmtree(str(d))
        d.mkdir(parents=True, exist_ok=True)
    (vault / "system" / "index.json").write_text(
        json.dumps({"version": "2.0.0", "lastIndexed": None, "pages": []}), encoding="utf-8")
    with _GRAPH_LOCK:  # audit run-1: reset también pasa por el lock del grafo
        (vault / "system" / "graph.json").write_text(
            json.dumps({"nodes": [], "edges": []}), encoding="utf-8")
    gt = vault / "system" / "graphify-tmp"
    if gt.exists():
        shutil.rmtree(str(gt))
    return {"success": True, "message": "Bóveda reiniciada. Contenido borrado, agente intacto."}


# ============================================
# ENDPOINT PARA SUBIR ARCHIVOS AL VAULT
# ============================================

@app.post("/api/vault/upload")
async def upload_to_vault(file: UploadFile = File(...), project: str = "individual", topic: str = None):
    """Sube un archivo al vault en raw/<project>/. Auto-procesa a wiki + Graphify.
    Compat: si llega ?topic y no ?project, usar topic como project."""
    # ponytail: project gana sobre topic (compat hacia atrás)
    dest_folder = project or topic or "individual"
    import shutil as shutil_mod

    raw_path = _confine("raw", dest_folder)  # audit run-1: project/topic sin confinar cruzaba mounts
    raw_path.mkdir(parents=True, exist_ok=True)

    filename = file.filename or "unnamed"
    safe_filename = "".join(c for c in filename if c.isalnum() or c in "._- ")
    if not safe_filename:
        safe_filename = "unnamed"

    dest = raw_path / safe_filename
    try:
        with open(dest, "wb") as buffer:
            shutil_mod.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir archivo: {e}")

    # ponytail: preview type for frontend (whatsapp-style)
    ext = safe_filename.rsplit(".", 1)[-1].lower() if "." in safe_filename else ""
    img_exts = {"png", "jpg", "jpeg", "gif", "webp", "bmp"}
    audio_exts = {"mp3", "wav", "ogg", "m4a", "aac", "flac"}
    video_exts = {"mp4", "webm", "mov", "avi", "mkv"}
    preview_type = "image" if ext in img_exts else "audio" if ext in audio_exts else "video" if ext in video_exts else "document"

    file_path = f"raw/{dest_folder}/{safe_filename}"

    # ponytail: extracción + wiki en background (patrón _graphify_bg) — upload responde inmediato.
    # El frontend muestra "Procesando…" hasta que wiki/<stem>.md existe.
    wiki_path = None
    wiki_pending = False
    api_key = get_agent_key("hermes") or OPENROUTER_API_KEY
    if api_key:
        import threading
        vault_host = os.getenv("VAULT_HOST_PATH", "") or VAULT_PATH

        def _wiki_bg():
            try:
                # 1. extraer texto (docker run herramientas)
                extract = subprocess.run(
                    ["docker", "run", "--rm", "-v", f"{vault_host}:/app/vault",
                     "cerebrovirtual-herramientas:latest",
                     "bash", "/app/scripts/process_raw.sh", f"/app/vault/{file_path}"],
                    capture_output=True, text=True, timeout=300
                )
                if extract.returncode != 0 or not extract.stdout.strip():
                    print(f"⚠️ wiki_bg: extracción falló para {safe_filename}")
                    return

                # 2. Graphify en background thread propio (no bloquea la wiki)
                file_ext = Path(safe_filename).suffix.lower()
                if file_ext in GRAPHIFY_EXTS:
                    def _graphify_bg():
                        try:
                            partial = _run_graphify(f"/app/vault/{file_path}", vault_host)
                            if partial:
                                _merge_graph(partial, safe_filename)
                        except Exception as e:
                            print(f"⚠️ Graphify background falló para {safe_filename}: {e}")
                    threading.Thread(target=_graphify_bg, daemon=True).start()

                extracted_text = extract.stdout.strip()
                # filtrar logs del script
                text_lines = extracted_text.split("\n")
                content_start = 0
                for i, line in enumerate(text_lines):
                    if line.strip() == "---" or line.startswith("✅"):
                        content_start = i + 1
                extracted_text = "\n".join(text_lines[content_start:]).strip() or extracted_text

                # 3. sintetizar wiki (lossless, multi-chunk)
                stem = Path(safe_filename).stem
                wiki_content = _synthesize_wiki(stem, extracted_text, api_key)
                wiki_file = Path(VAULT_PATH) / "wiki" / f"{stem}.md"
                wiki_file.parent.mkdir(parents=True, exist_ok=True)
                wiki_file.write_text(wiki_content, encoding="utf-8")
                print(f"✅ wiki_bg: wiki/{stem}.md lista ({len(wiki_content)} chars)")
            except Exception as e:
                print(f"⚠️ wiki_bg falló para {safe_filename}: {e}")

        threading.Thread(target=_wiki_bg, daemon=True).start()
        stem = Path(safe_filename).stem
        wiki_pending = not (Path(VAULT_PATH) / "wiki" / f"{stem}.md").exists()

    return {
        "success": True,
        "message": f"Archivo subido: {safe_filename}",
        "path": file_path,
        "filename": safe_filename,
        "preview_type": preview_type,
        "wiki_path": wiki_path,
        "wiki_pending": wiki_pending,  # ponytail: true → frontend muestra "Procesando…" hasta wiki/<stem>.md
        "graph_updated": False,  # ponytail: Graphify corre en background, verificar con GET /api/graph/status
        "file_size": dest.stat().st_size
    }


@app.get("/api/vault/raw")
async def list_raw_files():
    """Lista archivos Y carpetas de proyecto en raw/."""
    raw_path = Path(VAULT_PATH) / "raw"
    files = []
    if raw_path.exists():
        for f in raw_path.rglob("*"):
            if ".processed" in str(f) or f.name == ".gitkeep":
                continue
            rel = f.relative_to(raw_path)
            if f.is_file():
                files.append({
                    "name": f.name, "path": str(rel),
                    "size": f.stat().st_size, "ext": f.suffix.lower().lstrip(".")
                })
            elif f.is_dir():
                # ponytail: incluir carpetas de proyecto vacías — el frontend las agrupa
                files.append({
                    "name": f.name, "path": str(rel) + "/",
                    "size": 0, "ext": "folder"
                })
    return {"files": files, "total": len(files)}


# ponytail: helper compartido — borra raw/output + .txt + wiki derivada
def _delete_vault_item(category: str, rel_path: str) -> dict:
    """Borra raw/<rel> o outputs/<rel> + .txt hermano + wiki/<stem>.md."""
    base = Path(VAULT_PATH) / category
    target = (base / rel_path).resolve()
    # evitar path traversal
    if not str(target).startswith(str(base.resolve())):
        raise HTTPException(status_code=400, detail="Path inválido")
    if not target.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    stem = target.stem
    deleted = [str(target.relative_to(VAULT_PATH))]
    target.unlink(missing_ok=True)

    # .txt de extracción (raw)
    txt_sibling = target.with_suffix(".txt")
    if txt_sibling.exists() and txt_sibling != target:
        txt_sibling.unlink(missing_ok=True)
        deleted.append(str(txt_sibling.relative_to(VAULT_PATH)))

    # wiki derivada
    wiki_file = Path(VAULT_PATH) / "wiki" / f"{stem}.md"
    if wiki_file.exists():
        wiki_file.unlink(missing_ok=True)
        deleted.append(str(wiki_file.relative_to(VAULT_PATH)))

    # ponytail: limpiar graph.json de nodos del archivo borrado
    _prune_graph_json(target.name)

    # ponytail: limpiar subdir vacío — pero NO dirs de proyecto (viven en projects.json)
    if target.parent.exists() and not any(target.parent.iterdir()):
        raw_path = Path(VAULT_PATH) / "raw"
        is_project_dir = (target.parent.parent == raw_path and
                          any(p["id"] == target.parent.name
                              for p in _load_projects().get("projects", [])))
        if not is_project_dir:
            target.parent.rmdir()

    return {"deleted": deleted, "stem": stem}


@app.get("/api/vault/outputs")
async def list_outputs():
    """Lista los archivos en outputs/."""
    out_path = Path(VAULT_PATH) / "outputs"
    files = []
    if out_path.exists():
        for f in out_path.rglob("*"):
            if f.is_file() and f.name != ".gitkeep":
                rel = f.relative_to(out_path)
                files.append({
                    "name": f.name,
                    "path": str(rel),
                    "size": f.stat().st_size,
                    "ext": f.suffix.lower().lstrip(".")
                })
    return {"files": files, "total": len(files)}


@app.post("/api/vault/batch-delete")
async def batch_delete(items: list = Body(...)):
    """Borra múltiples items. Cada item: {category, path}.
    Devuelve {deleted: [...], errors: [...]}. Grafo se recalcula en frontend al refrescar."""
    results = {"deleted": [], "errors": []}
    for item in items:
        cat = item.get("category", "")
        p = item.get("path", "")
        if cat not in ("raw", "outputs") or not p:
            results["errors"].append({"path": p, "error": "item inválido"})
            continue
        try:
            r = _delete_vault_item(cat, p)
            results["deleted"].extend(r["deleted"])
        except HTTPException as e:
            results["errors"].append({"path": p, "error": e.detail})
        except Exception as e:
            results["errors"].append({"path": p, "error": str(e)})
    _sync_graph_json()
    return results


# ponytail: renombrar archivo + wiki + graph.json source_file
class RenameRequest(_BM):
    category: str
    path: str
    newName: str

@app.put("/api/vault/rename")
async def rename_vault_item(req: RenameRequest):
    """Renombra archivo en raw/ o outputs/ + wiki derivada + actualiza graph.json."""
    if req.category not in ("raw", "outputs") or not req.path:
        raise HTTPException(status_code=400, detail="Parámetros inválidos")
    base = Path(VAULT_PATH) / req.category
    target = (base / req.path).resolve()
    if not str(target).startswith(str(base.resolve())):
        raise HTTPException(status_code=400, detail="Path inválido")
    if not target.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    old_name = target.name
    old_stem = target.stem
    rel_parent = target.parent.relative_to(base)
    new_path = _confine(req.category, *rel_parent.parts, req.newName)  # audit run-1: newName sin confinar reemplazaba vault/system
    target.rename(new_path)

    # .txt hermano (raw)
    old_txt = target.with_suffix(".txt")
    if old_txt.exists() and old_txt != target:
        old_txt.rename(new_path.with_suffix(".txt"))

    # wiki derivada
    old_wiki = Path(VAULT_PATH) / "wiki" / f"{old_stem}.md"
    if old_wiki.exists():
        old_wiki.rename(Path(VAULT_PATH) / "wiki" / f"{new_path.stem}.md")

    # graph.json: actualizar source_file
    if GRAPH_PATH.exists():
        try:
            with _GRAPH_LOCK:  # audit run-1: RMW sin lock
                with open(GRAPH_PATH) as f:
                    graph = json.load(f)
                for n in graph.get("nodes", []):
                    if n.get("source_file") == old_name:
                        n["source_file"] = req.newName
                _atomic_dump(GRAPH_PATH, graph)
        except Exception as e:
            print(f"⚠️ rename graph update error: {e}")

    return {"ok": True, "oldName": old_name, "newName": req.newName}


# ponytail: reasignar archivos entre proyectos
class ReassignRequest(_BM):
    items: list  # [{category, path}]
    targetProject: str  # project_id o "individual"

@app.post("/api/vault/reassign")
async def reassign_files(req: ReassignRequest):
    """Mueve archivos de un proyecto a otro en raw/ o outputs/."""
    moved = []
    errors = []
    for item in req.items:
        cat = item.get("category", "")
        p = item.get("path", "")
        if cat not in ("raw", "outputs") or not p:
            errors.append({"path": p, "error": "item inválido"})
            continue
        base = Path(VAULT_PATH) / cat
        src = (base / p).resolve()
        if not str(src).startswith(str(base.resolve())):
            errors.append({"path": p, "error": "path inválido"})
            continue
        if not src.exists():
            errors.append({"path": p, "error": "no encontrado"})
            continue
        # construir destino
        fname = src.name
        if req.targetProject == "individual":
            dst_dir = base
        else:
            dst_dir = _confine(cat, req.targetProject)  # audit run-1: targetProject sin confinar
            dst_dir.mkdir(parents=True, exist_ok=True)
        dst = dst_dir / fname
        if dst.exists():
            errors.append({"path": p, "error": "ya existe en destino"})
            continue
        src.rename(dst)
        # .txt hermano
        old_txt = src.with_suffix(".txt")
        if old_txt.exists() and old_txt != src:
            old_txt.rename(dst.with_suffix(".txt"))
        moved.append({"from": p, "to": str(dst.relative_to(base))})
    _sync_graph_json()
    return {"moved": moved, "errors": errors}



@app.get("/api/wiki/graph")
async def wiki_graph():
    """Grafo Estructura: proyectos como nodos principales + páginas wiki + wikilinks.
    Cada proyecto conecta a sus archivos wiki con el color del proyecto."""
    import re
    wiki_path = Path(VAULT_PATH) / "wiki"
    nodes = []
    edges = []
    node_ids = set()

    # ponytail: nodos de proyecto — usar misma lógica que list_projects (incluye huérfanos)
    projects = []
    raw_path_local = Path(VAULT_PATH) / "raw"
    outputs_path_local = Path(VAULT_PATH) / "outputs"
    seen_pids = set()
    for p in _load_projects().get("projects", []):
        pid = p["id"]
        if (raw_path_local / pid).exists() or (outputs_path_local / pid).exists():
            projects.append(p)
            seen_pids.add(pid)
    for cat_path in (raw_path_local, outputs_path_local):
        if not cat_path.exists():
            continue
        for d in cat_path.iterdir():
            if d.is_dir() and d.name not in seen_pids and d.name != "graphify-out" and d.name != "individual" and not d.name.startswith("."):
                projects.append({"id": d.name, "name": d.name.replace("-", " ").title(), "color": "#4edea3"})
                seen_pids.add(d.name)
    # mapear stem de wiki → proyecto por carpeta raw/<project_id>/ Y outputs/<project_id>/
    project_of_file = {}
    for category in ("raw", "outputs"):
        cat_path = Path(VAULT_PATH) / category
        if cat_path.exists():
            for proj in projects:
                proj_dir = cat_path / proj["id"]
                if proj_dir.exists():
                    for f in proj_dir.iterdir():
                        if f.is_file() and f.name != ".gitkeep":
                            project_of_file[f.stem] = proj

    raw_path = Path(VAULT_PATH) / "raw"
    for proj in projects:
        pid = proj["id"]
        # ponytail: mostrar proyecto si tiene carpeta en raw/ o outputs/
        has_raw = (raw_path / pid).exists() if raw_path.exists() else False
        has_outputs = (Path(VAULT_PATH) / "outputs" / pid).exists()
        if not has_raw and not has_outputs:
            continue
        if pid not in node_ids:
            nodes.append({"id": pid, "title": proj.get("name", pid), "path": None,
                           "type": "project", "color": proj.get("color", "#4edea3")})
            node_ids.add(pid)

    # ponytail: nodo "individual" para archivos sin carpeta de proyecto
    if "individual" not in node_ids:
        nodes.append({"id": "individual", "title": "Individual", "path": None, "type": "project", "color": "#808080"})
        node_ids.add("individual")

    if wiki_path.exists():
        for md_file in wiki_path.glob("**/*.md"):
            if md_file.name == "index.md":
                continue
            stem = md_file.stem
            title = stem.replace("-", " ").title()
            with open(md_file, "r", encoding="utf-8") as f:
                content = f.read()
            for line in content.split("\n"):
                if line.startswith("# "):
                    title = line[2:].strip()
                    break

            if stem not in node_ids:
                nodes.append({"id": stem, "title": title, "path": str(md_file.relative_to(VAULT_PATH))})
                node_ids.add(stem)

            # ponytail: edge proyecto → archivo, con color del proyecto
            if stem in project_of_file:
                proj = project_of_file[stem]
                edges.append({"source": proj["id"], "target": stem, "color": proj.get("color", "#4edea3")})
            else:
                # ponytail: archivo sin carpeta de proyecto → edge a nodo "individual"
                edges.append({"source": "individual", "target": stem, "color": "#808080"})

            # ponytail: regex simple para [[wikilinks]]
            links = re.findall(r'\[\[([^\]]+)\]\]', content)
            for link in links:
                target = link.strip().replace(" ", "-").lower()
                if target and target not in node_ids:
                    nodes.append({"id": target, "title": link.strip(), "path": None})
                    node_ids.add(target)
                edges.append({"source": stem, "target": target})

    return {"nodes": nodes, "edges": edges}


@app.get("/api/graph/full")
async def get_full_graph():
    """Devuelve vault/system/graph.json completo (grafo 'Neuronas' de Graphify)."""
    _sync_graph_json()  # ponytail: prune orphan nodes before returning
    if not GRAPH_PATH.exists():
        return {"nodes": [], "edges": []}
    try:
        with open(GRAPH_PATH) as f:
            return json.load(f)
    except Exception:
        return {"nodes": [], "edges": []}


# ponytail: layout visual del grafo — posiciones guardadas por el frontend (sobreviven a refresh/dispositivos)
LAYOUT_PATH = Path(VAULT_PATH) / "system" / "graph-layout.json"


@app.get("/api/graph/layout")
async def get_graph_layout():
    """Devuelve el layout visual guardado: { positions: { node_id: {x, y, fixed} } }."""
    if not LAYOUT_PATH.exists():
        return {"positions": {}}
    try:
        with open(LAYOUT_PATH) as f:
            return json.load(f)
    except Exception:
        return {"positions": {}}


@app.post("/api/graph/layout")
async def save_graph_layout(payload: dict):
    """Guarda el layout visual: { positions: { node_id: {x, y, fixed} } }. POST vacío = reset."""
    try:
        with open(LAYOUT_PATH, "w") as f:
            json.dump({"positions": payload.get("positions", {})}, f, ensure_ascii=False)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/api/raw/projects-map")
async def raw_projects_map():
    """Mapa archivo → proyecto escaneando vault/raw/ y vault/outputs/. Verdad del disco para colorear neuronas."""
    result = {}
    for base in ("raw", "outputs"):
        root = Path(VAULT_PATH) / base
        if not root.exists():
            continue
        for d in root.iterdir():
            if d.is_dir():
                for f in d.iterdir():
                    if f.is_file():
                        result[f.name] = d.name
    return result


@app.get("/api/graph/query")
async def graph_query(q: str, limit: int = 10):
    """Busca nodos en graph.json por label → nodos + edges adyacentes. Para RAG del chat."""
    return search_graph(q, limit)


@app.get("/api/graph/status")
async def graph_status():
    """Diagnóstico del grafo: imagen herramientas, nodos, edges."""
    # ponytail: verificar imagen sin construir (solo diagnóstico)
    try:
        img_result = subprocess.run(
            ["docker", "images", "-q", "cerebrovirtual-herramientas:latest"],
            capture_output=True, text=True, timeout=5
        )
        image_exists = bool(img_result.stdout.strip())
    except Exception:
        image_exists = False
    # graph.json stats
    node_count = edge_count = 0
    if GRAPH_PATH.exists():
        try:
            with open(GRAPH_PATH) as f:
                g = json.load(f)
            node_count = len(g.get("nodes", []))
            edge_count = len(g.get("edges", []))
        except Exception:
            pass
    return {
        "image_exists": image_exists,
        "graph_nodes": node_count,
        "graph_edges": edge_count,
        "graph_path": str(GRAPH_PATH),
    }


from pydantic import BaseModel

class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    color: str = "#4edea3"

# ============================================
# ENDPOINTS DE PROYECTOS
# ============================================

@app.get("/api/projects")
async def list_projects():
    """Lista proyectos — los de projects.json con carpeta raw/ o outputs/, + carpetas huérfanas auto-registradas."""
    data = _load_projects()
    raw_path = Path(VAULT_PATH) / "raw"
    outputs_path = Path(VAULT_PATH) / "outputs"
    seen = set()
    result = []
    # ponytail: proyectos de projects.json que tienen carpeta raw/ o outputs/
    for p in data.get("projects", []):
        pid = p["id"]
        has_raw = (raw_path / pid).exists() if raw_path.exists() else False
        has_outputs = (outputs_path / pid).exists() if outputs_path.exists() else False
        if has_raw or has_outputs:
            result.append(p)
            seen.add(pid)
    # ponytail: carpetas huérfanas en raw/ o outputs/ que no están en projects.json → auto-registrar
    for cat_path in (raw_path, outputs_path):
        if not cat_path.exists():
            continue
        for d in cat_path.iterdir():
            if d.is_dir() and d.name not in seen and d.name != "graphify-out" and d.name != "individual" and not d.name.startswith("."):
                # crear entrada en projects.json
                new_p = {"id": d.name, "name": d.name.replace("-", " ").title(),
                         "description": "", "created": datetime.utcnow().isoformat() + "Z",
                         "color": "#4edea3"}
                result.append(new_p)
                seen.add(d.name)
    return {"projects": result}

@app.post("/api/projects")
async def create_project(project: ProjectCreate):
    """Crea un proyecto nuevo. Genera id (slug) + created."""
    import uuid
    data = _load_projects()
    project_id = _slugify(project.name)
    # ponytail: id único — si existe, append suffix
    if any(p["id"] == project_id for p in data["projects"]):
        project_id = f"{project_id}-{uuid.uuid4().hex[:4]}"
    new_project = {
        "id": project_id,
        "name": project.name,
        "description": project.description,
        "created": datetime.utcnow().isoformat() + "Z",
        "color": project.color,
    }
    data["projects"].append(new_project)
    _save_projects(data)
    # crear carpeta raw/<id>/
    (Path(VAULT_PATH) / "raw" / project_id).mkdir(parents=True, exist_ok=True)
    return new_project

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    """Borra un proyecto: carpeta raw/<id>/ + entrada en projects.json + limpia graph.json por archivo."""
    data = _load_projects()
    data["projects"] = [p for p in data["projects"] if p["id"] != project_id]
    _save_projects(data)
    # ponytail: borrar raw/<id>/ + outputs/<id>/ + limpiar graph.json
    import shutil as _sh
    for category in ("raw", "outputs"):
        project_dir = Path(VAULT_PATH) / category / project_id
        if project_dir.exists():
            for fname in project_dir.iterdir():
                if fname.is_file():
                    _delete_vault_item(category, f"{project_id}/{fname.name}")
            _sh.rmtree(project_dir / "graphify-out", ignore_errors=True)
            if not any(project_dir.iterdir()):
                project_dir.rmdir()
    _sync_graph_json()
    return {"ok": True}

class ProjectUpdate(BaseModel):
    description: str | None = None
    color: str | None = None
    name: str | None = None

@app.put("/api/projects/{project_id}")
async def update_project(project_id: str, update: ProjectUpdate):
    """Actualiza nombre, descripción y/o color de un proyecto. Auto-registra si es huérfano."""
    data = _load_projects()
    for p in data["projects"]:
        if p["id"] == project_id:
            if update.name is not None:
                p["name"] = update.name
            if update.description is not None:
                p["description"] = update.description
            if update.color is not None:
                p["color"] = update.color
            _save_projects(data)
            return p
    # ponytail: proyecto huérfano (carpeta existe pero no en projects.json) → registrar
    raw_exists = (Path(VAULT_PATH) / "raw" / project_id).exists()
    outputs_exists = (Path(VAULT_PATH) / "outputs" / project_id).exists()
    if raw_exists or outputs_exists:
        new_p = {"id": project_id, "name": update.name or project_id.replace("-", " ").title(),
                 "description": update.description or "", "created": datetime.utcnow().isoformat() + "Z",
                 "color": update.color or "#4edea3"}
        data["projects"].append(new_p)
        _save_projects(data)
        return new_p
    raise HTTPException(status_code=404, detail="Proyecto no encontrado")


@app.post("/api/vault/process")
async def process_raw_file(request: dict):
    """Procesa un archivo de raw/ → texto extraído → página wiki via Sintetizador.

    1. docker compose run --rm herramientas process_raw.sh <file>  → .txt
    2. docker compose exec sistema-agente hermes chat -q "Sintetiza: <txt>"  → wiki page
    3. Guarda resultado en wiki/<stem>.md
    """
    file_path = request.get("path", "")
    if not file_path:
        raise HTTPException(status_code=400, detail="Falta 'path' del archivo")
    if file_path.split("/")[0] not in ("raw", "outputs"):
        raise HTTPException(status_code=400, detail="Solo se procesan archivos de raw/ o outputs/")

    raw_file = _confine_vault(file_path)  # audit run-1: path sin confinar aceptaba system/
    if not raw_file.exists():
        raise HTTPException(status_code=404, detail=f"Archivo no encontrado: {file_path}")

    api_key = get_agent_key("hermes") or OPENROUTER_API_KEY
    if not api_key:
        raise HTTPException(status_code=400, detail="No hay API key configurada")

    # ponytail: vault host path from env var
    vault_host = os.getenv("VAULT_HOST_PATH", "") or VAULT_PATH

    # 1. Extraer texto con herramientas
    try:
        extract = subprocess.run(
            ["docker", "run", "--rm",
             "-v", f"{vault_host}:/app/vault",
             "cerebrovirtual-herramientas:latest",
             "bash", "/app/scripts/process_raw.sh", f"/app/vault/{file_path}"],
            capture_output=True, text=True, timeout=300
        )
        if extract.returncode != 0:
            raise HTTPException(status_code=500, detail=f"Error extrayendo: {extract.stderr[:300]}")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Timeout extrayendo texto")

    extracted_text = extract.stdout.strip()
    if not extracted_text:
        raise HTTPException(status_code=422, detail="No se pudo extraer texto del archivo")

    # ponytail: filtrar líneas de log del script, quedarnos con el texto
    # El script imprime logs + al final el contenido. Buscamos después del último "---"
    text_lines = extracted_text.split("\n")
    content_start = 0
    for i, line in enumerate(text_lines):
        if line.strip() == "---" or line.startswith("✅"):
            content_start = i + 1
    extracted_text = "\n".join(text_lines[content_start:]).strip() or extracted_text

    # ponytail: Graphify — extraer estructura del archivo → graph.json
    file_ext = raw_file.suffix.lower()
    if file_ext in GRAPHIFY_EXTS:
        try:
            partial = _run_graphify(f"/app/vault/{file_path}", vault_host)
            if partial:
                _merge_graph(partial, raw_file.name)
        except Exception as e:
            print(f"⚠️ Graphify falló para {raw_file.name}: {e}")

    # 2. Sintetizar página wiki (lossless, multi-chunk)
    stem = raw_file.stem
    try:
        wiki_content = _synthesize_wiki(stem, extracted_text, api_key)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Timeout sintetizando wiki")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 3. Guardar en wiki/
    wiki_path = Path(VAULT_PATH) / "wiki" / f"{stem}.md"
    wiki_path.parent.mkdir(parents=True, exist_ok=True)
    wiki_path.write_text(wiki_content, encoding="utf-8")

    return {
        "success": True,
        "message": f"Página wiki creada: wiki/{stem}.md",
        "wiki_path": f"wiki/{stem}.md",
        "extracted_chars": len(extracted_text),
        "wiki_chars": len(wiki_content)
    }


@app.post("/api/vault/process-folder")
async def process_folder(request: dict):
    """Procesa todos los archivos de raw/<topic>/ juntos con contexto compartido.

    Cada archivo se extrae individualmente, luego Hermes recibe TODO el texto
    junto con el nombre de la carpeta como tema, y genera páginas wiki enlazadas.
    """
    folder_path = request.get("path", "")
    if not folder_path:
        raise HTTPException(status_code=400, detail="Falta 'path' de la carpeta")
    if folder_path.split("/")[0] not in ("raw", "outputs"):
        raise HTTPException(status_code=400, detail="Solo se procesan carpetas de raw/ o outputs/")

    folder = _confine_vault(folder_path)  # audit run-1: path sin confinar
    if not folder.exists() or not folder.is_dir():
        raise HTTPException(status_code=404, detail=f"Carpeta no encontrada: {folder_path}")

    api_key = get_agent_key("hermes") or OPENROUTER_API_KEY
    if not api_key:
        raise HTTPException(status_code=400, detail="No hay API key configurada")

    # ponytail: obtener host path del vault
    vault_host = os.getenv("VAULT_HOST_PATH", "") or VAULT_PATH

    # 1. Extraer texto de cada archivo
    topic = folder.name
    files = [f for f in folder.iterdir() if f.is_file() and ".processed" not in str(f)]
    if not files:
        raise HTTPException(status_code=422, detail="La carpeta no tiene archivos")

    extracted = []
    for f in files:
        rel = str(f.relative_to(VAULT_PATH))
        try:
            r = subprocess.run(
                ["docker", "run", "--rm", "-v", f"{vault_host}:/app/vault",
                 "cerebrovirtual-herramientas:latest",
                 "bash", "/app/scripts/process_raw.sh", f"/app/vault/{rel}"],
                capture_output=True, text=True, timeout=300
            )
            if r.returncode == 0 and r.stdout.strip():
                extracted.append({"name": f.stem, "text": r.stdout.strip()[-4000:]})
        except Exception:
            continue

    if not extracted:
        raise HTTPException(status_code=422, detail="No se pudo extraer texto de ningún archivo")

    # 2. Sintetizar wiki con contexto compartido
    combined = ""
    for item in extracted:
        combined += f"\n\n### Archivo: {item['name']}\n{item['text']}\n"

    prompt = f"""Responde SOLO con Markdown. Sin preámbulos. Empieza con # Título.
Crea un índice de tema con [[wikilinks]] a cada archivo. Cada archivo con sección ##, resumen, puntos clave, y [[wikilinks]] cruzados.
Tema: {topic}
Textos:{combined[:12000]}"""

    try:
        result = subprocess.run(
            ["docker", "exec", "-e", f"OPENROUTER_API_KEY={api_key}",
             "sistema-agente", "hermes",
             "chat", "-q", prompt],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"Error Hermes: {result.stderr[:300]}")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Timeout sintetizando wiki")

    # 3. Parsear respuesta
    output = result.stdout
    lines = output.split("\n")
    response_lines = []
    in_response = False
    for line in lines:
        if "Hermes" in line and "─" in line:
            in_response = True
            continue
        if in_response:
            if line.startswith("Resume this session") or line.startswith("Session:"):
                break
            response_lines.append(line.strip(" ╭╮╰╯│─"))
    while response_lines and not response_lines[-1]:
        response_lines.pop()
    wiki_content = "\n".join(response_lines).strip() or output.strip()

    # 4. Guardar como wiki/<topic>.md
    wiki_path = Path(VAULT_PATH) / "wiki" / f"{topic}.md"
    wiki_path.parent.mkdir(parents=True, exist_ok=True)
    wiki_path.write_text(wiki_content, encoding="utf-8")

    return {
        "success": True,
        "message": f"Wiki creada: wiki/{topic}.md ({len(extracted)} archivos procesados)",
        "wiki_path": f"wiki/{topic}.md",
        "files_processed": len(extracted),
        "wiki_chars": len(wiki_content)
    }


@app.get("/api/containers/status")
async def containers_status():
    """Devuelve el estado de todos los contenedores del sistema."""
    result = subprocess.run(_compose_cmd("ps", "--format", "json"), capture_output=True, text=True, timeout=10)
    if result.returncode != 0:
        return {"error": "docker compose no disponible"}

    # ponytail: parse compose ps output for service status
    # compose v5 emite NDJSON (1 objeto por línea), no un array
    containers = {}
    try:
        stdout = result.stdout.strip()
        if stdout.startswith("["):
            services = json.loads(stdout) if stdout else []
        else:
            services = [json.loads(l) for l in stdout.splitlines() if l.strip()]
        for svc in services:
            name = svc.get("Service", svc.get("Name", "unknown"))
            containers[name] = {
                "status": "running" if svc.get("State", "") == "running" else svc.get("State", "unknown"),
                "image": svc.get("Image", ""),
            }
    except Exception:
        pass

    return {"containers": containers}

# ============================================
# ENDPOINTS PARA CLOUDFLARE TUNNEL
# ============================================

CLOUDFLARED_CONTAINER = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual") + "-cloudflared-1"

def _extract_tunnel_token(raw: str) -> str:
    """Extract --token value from Cloudflare command, or return raw if already a token."""
    m = re.search(r'--token\s+(\S+)', raw)
    if m:
        return m.group(1)
    return raw.strip()

def _update_env_token(token: str):
    """Write CLOUDFLARE_TUNNEL_TOKEN to /app/.env (mounted from host .env)."""
    _safe_env_kv("CLOUDFLARE_TUNNEL_TOKEN", token, allow_eq=True)  # audit run-1: newline forjaba líneas .env
    env_path = Path("/app/.env")
    if not env_path.exists():
        return
    lines = env_path.read_text().splitlines()
    updated = False
    for i, line in enumerate(lines):
        if line.startswith("CLOUDFLARE_TUNNEL_TOKEN="):
            lines[i] = f"CLOUDFLARE_TUNNEL_TOKEN={token}"
            updated = True
            break
    if not updated:
        lines.append(f"CLOUDFLARE_TUNNEL_TOKEN={token}")
    env_path.write_text("\n".join(lines) + "\n")

def _clear_env_token():
    """Set CLOUDFLARE_TUNNEL_TOKEN= in /app/.env."""
    env_path = Path("/app/.env")
    if not env_path.exists():
        return
    lines = env_path.read_text().splitlines()
    for i, line in enumerate(lines):
        if line.startswith("CLOUDFLARE_TUNNEL_TOKEN="):
            lines[i] = "CLOUDFLARE_TUNNEL_TOKEN="
            break
    env_path.write_text("\n".join(lines) + "\n")

def _cloudflared_running() -> bool:
    """Check if cloudflared container is running."""
    try:
        result = subprocess.run(
            ["docker", "inspect", "--format", "{{.State.Running}}", CLOUDFLARED_CONTAINER],
            capture_output=True, text=True, timeout=5
        )
        return result.returncode == 0 and "true" in result.stdout.strip()
    except Exception:
        return False

def _start_cloudflared() -> tuple[bool, str]:
    """Stop, remove and start cloudflared container. Returns (success, error_msg)."""
    subprocess.run(
        _compose_cmd("--profile", "tunnel", "stop", "cloudflared"),
        capture_output=True, timeout=30
    )
    subprocess.run(
        _compose_cmd("--profile", "tunnel", "rm", "-f", "cloudflared"),
        capture_output=True, timeout=15
    )
    result = subprocess.run(
        _compose_cmd("--profile", "tunnel", "up", "-d", "--no-deps", "cloudflared"),
        capture_output=True, text=True, timeout=60
    )
    if result.returncode != 0:
        return False, result.stderr
    return True, ""

def _read_env_token() -> str:
    """Read CLOUDFLARE_TUNNEL_TOKEN from /app/.env. Token lives in .env, NOT in vault."""
    env_path = Path("/app/.env")
    if not env_path.exists():
        return ""
    for line in env_path.read_text().splitlines():
        if line.startswith("CLOUDFLARE_TUNNEL_TOKEN="):
            return line.split("=", 1)[1].strip()
    return ""

@app.get("/api/tunnel/status")
async def tunnel_status():
    # ponytail: token lives in .env, NOT in agent-config.json (vault) — security
    has_token = bool(_read_env_token())
    return {"active": _cloudflared_running(), "hasToken": has_token}

@app.post("/api/tunnel/configure")
async def tunnel_configure(request: dict):
    raw_input = request.get("cloudflareTunnelToken", "").strip()
    if not raw_input:
        raise HTTPException(status_code=400, detail="Token o comando requerido")

    token = _extract_tunnel_token(raw_input)
    if not token:
        raise HTTPException(status_code=400, detail="No se pudo extraer token del input")

    # ponytail: token goes to .env only, NOT to agent-config.json (vault) — security
    _update_env_token(token)

    ok, err = _start_cloudflared()
    if not ok:
        return {"success": False, "message": f"Token guardado pero error al iniciar tunnel: {err}"}

    return {"success": True, "message": "Túnel configurado y activado"}

@app.post("/api/tunnel/deactivate")
async def tunnel_deactivate():
    # ponytail: token lives in .env only — no agent-config.json (vault) write
    subprocess.run(
        _compose_cmd("--profile", "tunnel", "stop", "cloudflared"),
        capture_output=True, timeout=30
    )
    subprocess.run(
        _compose_cmd("--profile", "tunnel", "rm", "-f", "cloudflared"),
        capture_output=True, timeout=15
    )

    _clear_env_token()

    return {"success": True, "message": "Túnel desactivado"}


# ============================================
# ENDPOINT DE RUTAS DE CONTENEDORES
# ============================================

# ponytail: servicios del compose con su puerto interno — hardcoded porque no cambian entre instancias
_COMPOSE_SERVICES = [
    {"service": "frontend",       "port_internal": 80,    "port_host_env": "FRONTEND_PORT"},
    {"service": "backend",        "port_internal": 8000,  "port_host_env": "BACKEND_PORT"},
    {"service": "sistema-agente", "port_internal": 8080,  "port_host_env": "AGENT_PORT"},
    {"service": "searxng",        "port_internal": 8080,  "port_host_env": "SEARXNG_PORT"},
    {"service": "herramientas",   "port_internal": None,  "port_host_env": None},
    {"service": "cloudflared",    "port_internal": None,  "port_host_env": None},
]

def _read_env_value(key: str, env_path: Path = None) -> str:
    if env_path is None:
        env_path = Path("/app/.env")
    if not env_path.exists():
        return ""
    for line in env_path.read_text().splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip()
    return ""

def _read_all_labels(env_path: Path = None) -> dict:
    """Read ROUTE_LABEL_* keys from .env → {service: label}."""
    if env_path is None:
        env_path = Path("/app/.env")
    labels = {}
    if not env_path.exists():
        return labels
    for line in env_path.read_text().splitlines():
        m = re.match(r'^ROUTE_LABEL_(\w+)=(.*)$', line)
        if m:
            labels[m.group(1).lower().replace("_", "-")] = m.group(2).strip()
    return labels

@app.get("/api/instances/routes")
async def get_routes():
    # ponytail: read compose services + labels from .env — no docker inspect needed
    labels = _read_all_labels()
    result = []
    for svc in _COMPOSE_SERVICES:
        name = svc["service"]
        port_host = _read_env_value(svc["port_host_env"]) if svc["port_host_env"] else ""
        url = f"http://{name}:{svc['port_internal']}" if svc["port_internal"] else None
        result.append({
            "service": name,
            "label": labels.get(name, name),
            "url": url,
            "port_internal": svc["port_internal"],
            "port_host": int(port_host) if port_host and port_host.isdigit() else None,
        })
    return {"services": result}

@app.put("/api/instances/routes/labels")
async def update_label(request: dict):
    # ponytail: write ROUTE_LABEL_<service>=<value> to .env (write_text, no os.replace — pitfall P2)
    service = request.get("service", "").strip().replace("-", "_").upper()
    label = request.get("label", "").strip()
    if not service:
        raise HTTPException(status_code=400, detail="service requerido")
    _safe_env_kv(f"ROUTE_LABEL_{service}", label)  # audit run-1: newline en service/label forjaba líneas .env
    env_path = Path("/app/.env")
    if not env_path.exists():
        raise HTTPException(status_code=500, detail=".env no encontrado")
    lines = env_path.read_text().splitlines()
    key = f"ROUTE_LABEL_{service}"
    found = False
    for i, line in enumerate(lines):
        if line.startswith(f"{key}="):
            lines[i] = f"{key}={label}"
            found = True
            break
    if not found:
        lines.append(f"{key}={label}")
    env_path.write_text("\n".join(lines) + "\n")
    return {"success": True, "service": service.lower(), "label": label}


# ============================================
# ENDPOINT DE VERSION
# ============================================

@app.get("/api/version")
async def get_version():
    version_file = Path("/app/VERSION")
    if version_file.exists():
        version = version_file.read_text().strip()
    else:
        version = "unknown"
    # v1.5.4: puertos reales de ESTE cerebro, leídos de su .env (fuente de verdad) —
    # los links de la web (OmniRoute, panel del agente) se construyen con ellos,
    # no con hardcodes: cada cerebro tiene sus puertos y no cambian.
    ports = {}
    try:
        for ln in Path("/app/.env").read_text(encoding="utf-8", errors="ignore").splitlines():
            k, _, v = ln.partition("=")
            if k.strip() in ("FRONTEND_PORT", "BACKEND_PORT", "AGENT_PORT", "SEARXNG_PORT", "OMNIROUTE_PORT") and v.strip().isdigit():
                ports[k.strip().replace("_PORT", "").lower()] = int(v.strip())
    except Exception:
        pass
    return {"current": version, "githubRepo": os.getenv("GITHUB_REPO", ""), "ports": ports}


# ============================================
# SISTEMA DE ACTUALIZACIONES
# ============================================

CEREBRO_REPO = "karmaescopeta/Cerebro-Virtual"
HERMES_REPO = "NousResearch/hermes-agent"

# ponytail: cache TTL 10min — anon 60 req/h y cada check gasta ~5 llamadas
_GH_CACHE: dict = {}

def _host_git_commit() -> str:
    """Commit corto del repo host (cerebro). '' si falla."""
    try:
        r = subprocess.run(["docker", "run", "--rm", "--entrypoint", "/bin/sh",
                            "-v", f"{_REPO_BASE_DEFAULT}:/repo",
                            "alpine/git", "-c",
                            "git config --global --add safe.directory /repo && git -C /repo rev-parse --short HEAD"],
                           capture_output=True, text=True, timeout=30)
        if r.returncode == 0:
            return r.stdout.strip()
    except Exception:
        pass
    return ""

def _hermes_commit() -> str:
    """Commit corto del checkout hermes en el sistema-agente. '' si no hay git/repo."""
    project = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")
    try:
        r = subprocess.run(["docker", "exec", f"{project}-sistema-agente-1", "sh", "-c",
                            "d=/app/hermes-home/hermes-agent; [ -d $d ] && git -C $d rev-parse --short HEAD 2>/dev/null"],
                           capture_output=True, text=True, timeout=10)
        if r.returncode == 0:
            return r.stdout.strip()
    except Exception:
        pass
    return ""

def _github_latest(repo: str) -> dict | None:
    """ponytail: sin token, 60 req/h → cache TTL 10min (cada check gasta ~5). Returns {tag, body, date} or None."""
    _hit = _GH_CACHE.get(repo)
    if _hit and time.time() - _hit[0] < 600:
        return _hit[1]
    _gh_tok = os.getenv("GITHUB_TOKEN", "").strip()
    if not _gh_tok and Path("/app/.env").exists():
        for _l in Path("/app/.env").read_text(encoding="utf-8").splitlines():
            if _l.startswith("GITHUB_TOKEN="):
                _gh_tok = _l.split("=", 1)[1].strip()
                break
    _gh_headers = {"Accept": "application/vnd.github+json"}
    if _gh_tok:
        _gh_headers["Authorization"] = f"Bearer {_gh_tok}"
    try:
        r = httpx.get(f"https://api.github.com/repos/{repo}/releases/latest", timeout=10,
                      headers=_gh_headers)
        if r.status_code == 200:
            d = r.json()
            raw_date = d.get("published_at", "")[:10]  # YYYY-MM-DD
            date = f"{raw_date[8:10]}-{raw_date[5:7]}-{raw_date[:4]}" if raw_date else ""
            result = {"tag": (d.get("tag_name", "") or "").lstrip("v"), "body": d.get("body", "")[:500], "date": date}
            _GH_CACHE[repo] = (time.time(), result)  # None (fallo) NO se cachea → reintento en la próxima llamada
            return result
    except Exception:
        pass
    return None

def _local_cerebro_version() -> str:
    vf = Path("/app/VERSION")
    return vf.read_text().strip() if vf.exists() else "unknown"

def _local_hermes_version() -> str:
    """ponytail: layout pm (2026.9+) → git describe del último tag de release (v20*),
    fallback pyproject (imagen FHS vieja, que lee 0.0.0 en el checkout clonado)."""
    project = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")
    container = f"{project}-sistema-agente-1"
    try:
        r = subprocess.run(
            ["docker", "exec", container, "sh", "-c",
             "d=/app/hermes-home/hermes-agent; [ -d $d ] || d=/usr/local/lib/hermes-agent; "
             "v=$(git -C $d describe --tags --abbrev=0 --match 'v20*' 2>/dev/null); "
             "[ -n \"$v\" ] && echo ${v#v} || grep -m1 \"^version\" $d/pyproject.toml | cut -d'\"' -f2"],
            capture_output=True, text=True, timeout=8)
        if r.returncode == 0:
            return r.stdout.strip() or "unknown"
    except Exception:
        pass
    return "unknown"

def _post_check_hermes() -> tuple[bool, str]:
    """3 checks: container running, :8080 responde, patch needle existe. Timeout 60s."""
    project = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")
    container = f"{project}-sistema-agente-1"
    deadline = time.time() + 60
    while time.time() < deadline:
        # 1. running?
        r = subprocess.run(["docker", "inspect", "--format", "{{.State.Running}}", container],
                           capture_output=True, text=True, timeout=5)
        if r.returncode == 0 and "true" in r.stdout.strip():
            # 2. :8080 responde?
            try:
                h = httpx.get(AGENT_INTERNAL_URL + "/", timeout=3)
                if h.status_code in (200, 302, 401, 403):
                    # 3. patch needle existe? (layout nuevo primero, FHS viejo de fallback)
                    p = subprocess.run(
                        ["docker", "exec", container, "sh", "-c",
                         "for f in /app/hermes-home/hermes-agent/hermes_cli/dashboard_auth/middleware.py /usr/local/lib/hermes-agent/hermes_cli/dashboard_auth/middleware.py; do [ -f $f ] && grep -q 'list_session_providers()' $f && echo OK && exit 0; done; echo MISS"],
                        capture_output=True, text=True, timeout=10)
                    if p.returncode == 0 and "OK" in p.stdout:
                        return True, ""
                    return False, "patch needle no encontrado"
                return False, f":8080 responde {h.status_code}"
            except Exception:
                pass
        time.sleep(3)
    return False, "contenedor no arrancó en 60s"

# ── update-system-v2: componentes multi-fuente ──────────────────
# git repos (pull en host via runner; backend container no tiene git ni repo)
# imágenes docker :latest (digest local vs registry)
_IMAGE_COMPONENTS = {
    # ponytail: checks via DNS de servicio compose — localhost:<puerto host> no existe dentro del backend
    "omniroute": {"image": "diegosouzapw/omniroute:latest", "repo": "", "svc": "omniroute", "check_url": "http://omniroute:20128/"},
    "ollama": {"image": "ollama/ollama:latest", "repo": "ollama/ollama", "svc": "ollama", "check_url": "http://ollama:11434/"},
    "searxng": {"image": "searxng/searxng:latest", "repo": "searxng/searxng", "svc": "searxng", "check_url": "http://searxng:8080/"},
    "cloudflared": {"image": "cloudflare/cloudflared:latest", "repo": "cloudflare/cloudflared", "svc": "cloudflared", "check_url": ""},
}

def _image_local_index_digest(image: str) -> str:
    """ponytail: RepoDigest (con containerd store) = digest del INDEX en registry. Verificado con hello-world."""
    r = subprocess.run(["docker", "inspect", "--format", "{{json .RepoDigests}}", image],
                       capture_output=True, text=True, timeout=10)
    try:
        for d in json.loads(r.stdout or "[]"):
            if "@sha256:" in d:
                return d.split("@", 1)[1]
    except Exception:
        pass
    return ""

def _registry_index_digest(image: str) -> str:
    """HEAD al registry HTTP directo: docker-content-digest del index. Sin CLI ni SDK."""
    name, _, tag = image.partition(":")
    if name.startswith("docker.io/"):
        name = name[len("docker.io/"):]
    if "/" not in name:  # imagen oficial → library/
        name = f"library/{name}"
    try:
        t = httpx.get("https://auth.docker.io/token",
                      params={"service": "registry.docker.io", "scope": f"repository:{name}:pull"},
                      timeout=10).json().get("token", "")
        r = httpx.head(f"https://registry-1.docker.io/v2/{name}/manifests/{tag or 'latest'}", timeout=15,
                       headers={"Authorization": f"Bearer {t}",
                                "Accept": "application/vnd.oci.image.index.v1+json, "
                                          "application/vnd.docker.distribution.manifest.list.v2+json, "
                                          "application/vnd.oci.image.manifest.v1+json, "
                                          "application/vnd.docker.distribution.manifest.v2+json"})
        if r.status_code == 200:
            return r.headers.get("docker-content-digest", "")
    except Exception:
        pass
    return ""

def _image_update(image: str) -> tuple[bool, str, str]:
    """(update?, digest_local_index, digest_remoto_index). Unknown remoto → False (no alarmas falsas)."""
    local = _image_local_index_digest(image)
    remote = _registry_index_digest(image)
    return (bool(local and remote and local != remote), local, remote)

def _smoke_service(svc: str, check_url: str) -> tuple[bool, str]:
    """Container running + endpoint interno responde. check_url '' = solo running."""
    project = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")
    container = f"{project}-{svc}-1"
    deadline = time.time() + 45
    while time.time() < deadline:
        r = subprocess.run(["docker", "inspect", "--format", "{{.State.Running}}", container],
                           capture_output=True, text=True, timeout=5)
        if r.returncode == 0 and "true" in r.stdout.strip():
            if not check_url:
                return True, ""
            try:
                h = httpx.get(check_url, timeout=4)
                if h.status_code < 500:
                    return True, ""
            except Exception:
                pass
        time.sleep(3)
    return False, f"{svc} no responde tras 45s"

def _smoke_all() -> tuple[bool, str]:
    """Smoke-test global post-update: core services up + endpoints + patch needle hermes."""
    for svc, url, name in [("backend", "http://backend:8000/", "backend"),
                           ("frontend", "http://frontend:80/", "frontend")]:
        try:
            h = httpx.get(url, timeout=4)
            if h.status_code >= 500:
                return False, f"{name} responde {h.status_code}"
        except Exception as e:
            return False, f"{name} no responde: {e}"
    project = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")
    for meta in _IMAGE_COMPONENTS.values():
        r = subprocess.run(["docker", "inspect", "--format", "{{.State.Running}}",
                            f"{project}-{meta['svc']}-1"], capture_output=True, text=True, timeout=5)
        if r.returncode != 0 or "true" not in r.stdout.strip():
            return False, f"contenedor {meta['svc']} caído"
    return _post_check_hermes()

# v1.3 (re-root 2026-10-04): el repo git ES el proyecto — se deriva de VAULT_HOST_PATH:
# stack principal <repo>/vault → repo = parent; gestor <repo>/instances/<n>/vault → 2 niveles más.
def _repo_base() -> str:
    vh = os.getenv("VAULT_HOST_PATH", "").replace("\\", "/").rstrip("/")
    if not vh:
        return os.getenv("CEREBRO_REPO_DIR", "C:/proyectoBueno/cerebro virtual")
    p = Path(vh).parent
    repo = p.parent.parent if p.parent.name == "instances" else p
    return str(repo)

_REPO_BASE_DEFAULT = _repo_base()
# mapeo Docker Desktop del host en el runner (C:/x/y → /run/desktop/mnt/host/c/x/y)
_REPO_HOST_DIR = "/run/desktop/mnt/host/c" + _REPO_BASE_DEFAULT[2:]

def _host_env() -> dict:
    """Env del .env host para compose dentro del runner. Rutas absolutas Windows (no --env-file)."""
    env = {"COMPOSE_PROJECT_NAME": os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")}
    p = Path("/app/.env")
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    env.setdefault("HOST_PROJECT_DIR", _REPO_HOST_DIR)  # v1.3: proyecto == repo tras el re-root
    env.setdefault("HOST_REPO_DIR", _REPO_HOST_DIR)
    return env

def _runner_common() -> list:
    """Volúmenes + red comunes del contenedor runner docker:cli.
    ponytail: red con prefijo de proyecto + repo montado en la ruta que espera _build_env_for_runner."""
    project = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")
    return ["--rm", "-v", "/var/run/docker.sock:/var/run/docker.sock",
            "-v", f"{_REPO_BASE_DEFAULT}:{_REPO_HOST_DIR}",
            "--network", f"{project}_cerebro-network", "-e", "DOCKER_HOST=unix:///var/run/docker.sock"]

def _runner_cmd(args: list, workdir: str | None, env: dict) -> list:
    """Comando docker run docker:cli. Env k=v aplicado al runner (compose lee ahí)."""
    cmd = ["docker", "run"] + _runner_common()
    for k, v in env.items():
        cmd += ["-e", f"{k}={v}"]
    if workdir:
        cmd += ["-w", workdir]
    return cmd + ["docker:cli"] + args

def _build_env_for_runner() -> dict:
    """Env para compose DENTRO del runner: .env host completo + rutas en formato host-path del runner."""
    env = dict(_host_env())
    hp = env["HOST_PROJECT_DIR"]
    env.update({"VAULT_DIR": hp + "/vault", "ENV_FILE": hp + "/.env",
                "AGENT_CONFIG_DIR": hp + "/sistema-agente/config"})
    return env

@app.get("/api/updates/check")
async def check_updates():
    # ponytail: checks bloqueantes (subprocess/httpx) → hilos en paralelo (antes ~3.4s en secuencia)
    import asyncio
    gh = {"cerebro": asyncio.to_thread(_github_latest, CEREBRO_REPO),
          "hermes": asyncio.to_thread(_github_latest, HERMES_REPO),
          "cerebro_commit": asyncio.to_thread(_host_git_commit),
          "hermes_commit": asyncio.to_thread(_hermes_commit)}
    img = {}
    for cid, meta in _IMAGE_COMPONENTS.items():
        img[cid] = asyncio.to_thread(_image_update, meta["image"])
        if meta["repo"]:
            img[cid + ":gh"] = asyncio.to_thread(_github_latest, meta["repo"])
    jobs = {**gh, **img}
    vals = await asyncio.gather(*jobs.values())
    res = dict(zip(jobs.keys(), vals))
    cerebro_current = _local_cerebro_version()
    hermes_current = _local_hermes_version()
    cerebro_latest, hermes_latest = res["cerebro"], res["hermes"]
    cerebro_update = bool(cerebro_latest and cerebro_latest["tag"] != cerebro_current)
    hermes_update = bool(hermes_latest and hermes_latest["tag"] != hermes_current)

    # current con commit corto (la versión exacta instalada); update se compara con la base sin commit
    cerebro_disp = f"{cerebro_current} ({res['cerebro_commit']})" if res["cerebro_commit"] else cerebro_current
    hermes_disp = f"{hermes_current} ({res['hermes_commit']})" if res["hermes_commit"] else hermes_current

    components = [
        {"id": "cerebro", "name": "Cerebro Virtual", "kind": "git",
         "current": cerebro_disp, "latest": cerebro_latest["tag"] if cerebro_latest else "unknown",
         "update": cerebro_update,
         "summary": cerebro_latest["body"] if cerebro_latest and cerebro_update else "",
         "date": cerebro_latest["date"] if cerebro_latest else "",
         "url": f"https://github.com/{CEREBRO_REPO}/releases/latest"},
        {"id": "hermes", "name": "Hermes Agent", "kind": "git",
         "current": hermes_disp, "latest": hermes_latest["tag"] if hermes_latest else "unknown",
         "update": hermes_update,
         "summary": hermes_latest["body"] if hermes_latest and hermes_update else "",
         "date": hermes_latest["date"] if hermes_latest else "",
         "url": f"https://github.com/{HERMES_REPO}/releases/latest"},
    ]
    for cid, meta in _IMAGE_COMPONENTS.items():
        has, local, remote = res[cid]
        entry = {"id": cid, "name": cid.capitalize(), "kind": "image",
                 "current": (local[:19] + "…") if local else "unknown",
                 "latest": (remote[:19] + "…") if remote else "unknown",
                 "update": has, "summary": "", "date": "", "url": ""}
        if meta["repo"]:
            rel = res[cid + ":gh"]
            if rel:
                entry["summary"] = rel["body"] if has else ""
                entry["date"] = rel["date"] if has else ""
                entry["url"] = f"https://github.com/{meta['repo']}/releases/latest"
                entry["target"] = rel["tag"]  # versión destino legible (tag del release)
        # sin repo conocido → "Más info" al hub de la imagen (todo componente con botón)
        entry["url"] = entry["url"] or f"https://hub.docker.com/r/{meta['image'].rsplit(':', 1)[0]}"
        components.append(entry)
    return {"components": components,
            "cerebro": {"current": cerebro_current, "latest": cerebro_latest["tag"] if cerebro_latest else "unknown",
                        "update": cerebro_update, "changelog": cerebro_latest["body"] if cerebro_latest and cerebro_update else "",
                        "date": cerebro_latest["date"] if cerebro_latest and cerebro_update else ""},
            "hermes": {"current": hermes_current, "latest": hermes_latest["tag"] if hermes_latest else "unknown",
                       "update": hermes_update, "changelog": hermes_latest["body"] if hermes_latest and hermes_update else "",
                       "date": hermes_latest["date"] if hermes_latest and hermes_update else ""}}

def _apply_cerebro() -> dict:
    """git pull en el repo (runner alpine/git sobre el repo raíz) + rebuild backend/frontend."""
    env = _host_env()
    # 1. git pull --ff-only (sin stash: instalación real = working tree limpio; divergencia → error claro)
    pull = subprocess.run(
        ["docker", "run", "--rm", "-v", f"{_REPO_BASE_DEFAULT}:/repo", "-w", "/repo",
         "alpine/git", "pull", "--ff-only"],
        capture_output=True, text=True, timeout=120)
    if pull.returncode != 0:
        return {"success": False, "message": f"git pull falló: {(pull.stderr or pull.stdout)[-300:]}"}
    # 2. build con compose del repo montado — contexto se sube client-side (fresco)
    renv = _build_env_for_runner()
    cfile = env["HOST_PROJECT_DIR"] + "/docker-compose.yml"
    base = ["compose", "-p", env["COMPOSE_PROJECT_NAME"], "-f", cfile]
    b = subprocess.run(_runner_cmd(base + ["build", "--no-cache", "backend", "frontend"], None, renv),
                       capture_output=True, text=True, timeout=1800)
    if b.returncode != 0:
        return {"success": False, "message": f"build falló: {b.stderr[-300:]}"}
    u = subprocess.run(_runner_cmd(base + ["up", "-d", "--force-recreate", "--no-deps",
                                           "backend", "frontend"], None, renv),
                       capture_output=True, text=True, timeout=300)
    if u.returncode != 0:
        return {"success": False, "message": f"up falló: {u.stderr[-300:]}"}
    ok, err = _smoke_all()
    if not ok:
        return {"success": False, "needsRollback": True, "message": f"Update aplicado pero smoke-test falló: {err}"}
    return {"success": True}

def _compose_up_runner(svc: str, extra: list | None = None):
    """up -d vía runner con env completo (_build_env_for_runner: VAULT_DIR, AGENT_CONFIG_DIR...).
    ponytail: el backend no tiene las vars host → sin esto el compose monta /app/vault:/app/vault."""
    renv = _build_env_for_runner()
    cfile = renv["HOST_PROJECT_DIR"] + "/docker-compose.yml"
    base = ["compose", "-p", renv["COMPOSE_PROJECT_NAME"], "-f", cfile]
    args = (extra or []) + ["up", "-d", "--force-recreate", "--no-deps", svc]
    return subprocess.run(_runner_cmd(base + args, None, renv),
                          capture_output=True, text=True, timeout=120)

def _apply_component_image(cid: str) -> dict:
    """pull + recreate con compose interno (imágenes: sin contexto de build, sin runner)."""
    meta = _IMAGE_COMPONENTS[cid]
    project = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")
    # backup por ID de imagen
    r = subprocess.run(["docker", "inspect", "--format", "{{.Image}}", f"{project}-{meta['svc']}-1"],
                       capture_output=True, text=True, timeout=10)
    cur = r.stdout.strip() if r.returncode == 0 else ""
    if cur:
        subprocess.run(["docker", "tag", cur, f"{project}-{meta['svc']}:backup"], capture_output=True, timeout=10)
    extra = ["--profile", "tunnel"] if meta["svc"] == "cloudflared" else []
    p = subprocess.run(_compose_cmd(*(extra + ["pull", meta["svc"]])),
                       capture_output=True, text=True, timeout=900)
    if p.returncode != 0:
        return {"success": False, "message": f"pull falló: {p.stderr[-300:]}"}
    u = _compose_up_runner(meta["svc"], extra)
    if u.returncode != 0:
        return {"success": False, "message": f"up falló: {(u.stderr or u.stdout)[-300:]}"}
    ok, err = _smoke_service(meta["svc"], meta["check_url"])
    if not ok and cur:
        # audit run-1: retaggear al nombre de imagen que compose resuelve y VERIFICAR antes de reportar
        subprocess.run(["docker", "tag", cur, meta["image"]], capture_output=True, timeout=10)
        _compose_up_runner(meta["svc"], extra)
        chk = subprocess.run(["docker", "inspect", "--format", "{{.Image}}", f"{project}-{meta['svc']}-1"],
                              capture_output=True, text=True, timeout=10)
        rolled = chk.returncode == 0 and chk.stdout.strip() == cur
        return {"success": False, "rolledBack": rolled,
                "message": f"Update falló, rollback aplicado: {err}" if rolled else f"Update falló, rollback NO aplicado: {err}"}
    if not ok:
        return {"success": False, "rolledBack": False, "message": f"Update falló sin rollback (sin backup): {err}"}
    return {"success": True}

@app.post("/api/updates/apply/{component_id}")
async def apply_update(component_id: str):
    if component_id in ("cerebro", "backend", "frontend"):
        return await run_in_threadpool(_apply_cerebro)
    if component_id == "hermes":
        return await run_in_threadpool(_apply_hermes)
    if component_id in _IMAGE_COMPONENTS:
        return await run_in_threadpool(_apply_component_image, component_id)
    raise HTTPException(status_code=404, detail=f"componente desconocido: {component_id}")

def _apply_hermes() -> dict:
    """tag backup → rebuild sistema-agente (contexto fresco via runner) → post-check → rollback."""
    project = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")
    img_latest = f"{project}-sistema-agente"
    img_backup = f"{project}-sistema-agente:backup"
    r = subprocess.run(["docker", "inspect", "--format", "{{.Image}}", f"{project}-sistema-agente-1"],
                       capture_output=True, text=True, timeout=10)
    cur = r.stdout.strip() if r.returncode == 0 else ""
    if cur:
        subprocess.run(["docker", "tag", cur, img_backup], capture_output=True, timeout=10)
    env = _host_env()
    cfile = env["HOST_PROJECT_DIR"] + "/docker-compose.yml"
    base = ["compose", "-p", project, "-f", cfile]
    b = subprocess.run(_runner_cmd(base + ["build", "--no-cache", "sistema-agente"], None,
                                   _build_env_for_runner()),
                       capture_output=True, text=True, timeout=1800)
    if b.returncode != 0:
        return {"success": False, "needsRollback": True, "message": f"build falló: {b.stderr[-300:]}"}
    u = _compose_up_runner("sistema-agente")
    if u.returncode != 0:
        return {"success": False, "needsRollback": True, "message": f"up falló: {(u.stderr or u.stdout)[-300:]}"}
    ok, err = _post_check_hermes()
    if not ok:
        if cur:
            subprocess.run(["docker", "tag", cur, img_latest], capture_output=True, timeout=10)
            _compose_up_runner("sistema-agente")
        return {"success": False, "needsRollback": True, "rolledBack": bool(cur),
                "message": f"Update falló, rollback aplicado: {err}" if cur else f"Update falló: {err}"}
    return {"success": True}

@app.post("/api/updates/cerebro")
async def update_cerebro():
    """Legacy v1 → delega a v2 (git pull + rebuild backend/frontend + smoke)."""
    return await run_in_threadpool(_apply_cerebro)

@app.post("/api/updates/hermes")
async def update_hermes():
    """Legacy v1 → delega a v2 (backup + rebuild + post-check + rollback auto)."""
    return await run_in_threadpool(_apply_hermes)

@app.post("/api/updates/rollback/hermes")
async def rollback_hermes():
    project = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")
    img_latest = f"{project}-sistema-agente"
    img_backup = f"{project}-sistema-agente:backup"
    # check backup exists
    r = subprocess.run(["docker", "image", "inspect", img_backup], capture_output=True, timeout=5)
    if r.returncode != 0:
        return {"success": False, "message": "No hay backup disponible"}
    subprocess.run(["docker", "tag", img_backup, img_latest], capture_output=True, timeout=10)
    _compose_up_runner("sistema-agente")
    return {"success": True}


# ──────────────────────────────────────────────────────────────
# IA Local: terminal Ollama (WS), estado OmniRoute/Ollama, pull SSE
# ──────────────────────────────────────────────────────────────
import asyncio

_OLLAMA_CONTAINERS = {"ollama", "omniroute"}
_OLLAMA_BAN = {"rm", "rmdir", "mkfs", "shutdown", "reboot", "curl", "wget", "nc", "dd"}


def _model_labels_path() -> Path:
    return Path(VAULT_PATH) / "system" / "model-labels.json"


def _load_model_labels() -> dict:
    p = _model_labels_path()
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


@app.get("/api/localai/status")
async def localai_status():
    """Estado de contenedores ollama + omniroute + modelos instalados."""
    project = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")
    out = {"ollama": {"running": False, "models": []}, "omniroute": {"running": False}}
    for key in _OLLAMA_CONTAINERS:
        container = f"{project}-{key}-1"
        r = subprocess.run(["docker", "inspect", "--format", "{{.State.Running}}", container],
                           capture_output=True, text=True, timeout=5)
        if r.returncode == 0 and "true" in r.stdout.strip():
            out[key]["running"] = True
    if out["ollama"]["running"]:
        r = subprocess.run(["docker", "exec", f"{project}-ollama-1", "ollama", "list"],
                           capture_output=True, text=True, timeout=10)
        if r.returncode == 0:
            lines = [l for l in r.stdout.strip().splitlines()[1:] if l.strip()]
            labels = _load_model_labels()
            out["ollama"]["models"] = [
                {"name": p[0], "id": p[1][:12] if len(p) > 1 else "",
                 "size": " ".join(p[2:4]), "modified": " ".join(p[4:]),
                 "label": labels.get(p[0], p[0])}
                for p in (l.split() for l in lines) if p
            ]
    return out


@app.put("/api/localai/model-label")
async def localai_model_label(request: dict):
    """Renombrar visualmente un modelo local (alias). Guardado en vault/system/model-labels.json."""
    model = (request.get("model") or "").strip()
    label = (request.get("label") or "").strip()
    if not model or not re.fullmatch(r"[A-Za-z0-9._:/-]+", model):
        raise HTTPException(status_code=400, detail="model inválido")
    if not label or len(label) > 80:
        raise HTTPException(status_code=400, detail="label inválido")
    labels = _load_model_labels()
    labels[model] = label
    p = _model_labels_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(labels, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"success": True}


@app.delete("/api/localai/model")
async def localai_model_delete(request: dict):
    """Eliminar un modelo instalado del contenedor Ollama (ollama rm)."""
    model = (request.get("model") or "").strip()
    if not model or not re.fullmatch(r"[A-Za-z0-9._:/-]+", model):
        raise HTTPException(status_code=400, detail="model inválido")
    project = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")
    r = subprocess.run(["docker", "exec", f"{project}-ollama-1", "ollama", "rm", model],
                       capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise HTTPException(status_code=500, detail=(r.stderr or r.stdout or "fallo al borrar").strip()[:300])
    return {"success": True}


@app.get("/api/localai/omniroute-key")
async def localai_omniroute_key():
    """API key de OmniRoute (para copiar a Hermes/Ajustes)."""
    project = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")
    r = subprocess.run(
        ["docker", "exec", f"{project}-omniroute-1", "sh", "-c",
         "find /app/data -maxdepth 2 -name '*.key' -exec cat {} \\; 2>/dev/null | head -c 200 || true"],
        capture_output=True, text=True, timeout=10)
    return {"key": r.stdout.strip() if r.returncode == 0 else ""}


# ponytail: sesión de management de OmniRoute en memoria del proceso (1 admin)
_omni_client = httpx.AsyncClient(base_url="http://omniroute:20128", timeout=30.0)


@app.get("/api/localai/omniroute-connections")
async def omniroute_connections():
    """Lista conexiones de proveedores configuradas en OmniRoute."""
    try:
        r = await _omni_client.get("/api/providers")
        if r.status_code == 200:
            conns = r.json()
            if isinstance(conns, dict):
                conns = conns.get("connections") or conns.get("providers") or []
            return {"auth": False, "connections": [
                {"id": c.get("id"), "provider": c.get("provider"), "name": c.get("name"),
                 "isActive": c.get("is_active", c.get("isActive")), "testStatus": c.get("test_status") or c.get("testStatus")}
                for c in conns]}
        return {"auth": True, "connections": []}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OmniRoute no responde: {e}")


# ponytail: prefijo proveedor requerido (los ids sin prefijo no resuelven a conexión).
# Asignación aprobada por el usuario 2026-10-04 (benchmark en vivo: ver design-plans/modelos.md).
CLOUD_COMBOS = {
    # chat diario: frees verificados (2-3s). strategy "auto" → OmniRoute enruta solo
    # (latencia/coste/circuit breaker); si un free rate-limitea, failover al siguiente.
    "cerebro-default":  ["openrouter/inclusionai/ling-3.0-flash-sante:free",
                         "openrouter/cohere/north-mini-code:free",
                         "openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
                         "openrouter/qwen/qwen3.8-27b:free-medium"],
    "cerebro-smart":    ["openrouter/z-ai/glm-5.3-flash"],
    "cerebro-cerebro":  ["openrouter/z-ai/glm-5.3-flash"],
    "cerebro-investigador": ["openrouter/z-ai/glm-5.3-flash"],
    # gpt-6-luna-pro: 23 neuronas en 43s sobre el doc más difícil, ~$0.001/doc (test comparativo 2026-10-03).
    # v4-flash descartado en graphify: razonador → trunca el JSON de graphify → 0 neuronas (falló 5/5).
    "cerebro-graphify": ["openrouter/openai/gpt-6-luna-pro"],
}
CLOUD_COMBO_STRATEGY = {"cerebro-default": "auto"}  # resto: priority (un solo modelo, da igual)
PROFILE_TO_CLOUD = {"chat-default": "cerebro-default", "chat-smart": "cerebro-smart",
                    "investigador": "cerebro-investigador", "cerebro": "cerebro-cerebro",
                    "graphify": "cerebro-graphify"}
PROFILE_TO_LOCAL = {"chat-default": "local-default", "chat-smart": "local-smart",
                    "investigador": "local-smart", "cerebro": "local-cerebro",
                    "graphify": "local-graphify"}


def _ollama_installed_sorted() -> list[tuple[str, float]]:
    """Modelos ollama instalados [(nombre, size_gb)] ordenados por tamaño asc."""
    project = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")
    r = subprocess.run(["docker", "exec", f"{project}-ollama-1", "ollama", "list"],
                       capture_output=True, text=True, timeout=15)
    out = []
    if r.returncode == 0:
        for line in r.stdout.strip().splitlines()[1:]:
            parts = line.split()
            if len(parts) >= 3:
                # '1.5GB' / '496MB' — parsear a GB
                size = 0.0
                try:
                    m = re.match(r"([\d.]+)(GB|MB|TB)", parts[-2])
                    if m:
                        v = float(m.group(1))
                        size = v * (1 if m.group(2) == "GB" else 1024 if m.group(2) == "TB" else 0.001)
                except Exception:
                    pass
                out.append((parts[0], size))
    out.sort(key=lambda x: x[1])
    return out


# ponytail: OMNIROUTE_MANAGE_PASSWORD puede cambiarse en .env por el wizard sin
# recreate del backend — os.getenv queda stale, leer siempre del .env montado
def _omni_password() -> str:
    val = os.getenv("OMNIROUTE_MANAGE_PASSWORD", "").strip()
    if val:
        return val
    env_path = Path("/app/.env")
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("OMNIROUTE_MANAGE_PASSWORD="):
                return line.split("=", 1)[1].strip()
    return ""


def _update_env_password(password: str):
    """Escribe OMNIROUTE_MANAGE_PASSWORD en /app/.env (mismo patrón que _update_env_token)."""
    env_path = Path("/app/.env")
    if not env_path.exists():
        return
    lines = env_path.read_text(encoding="utf-8").splitlines()
    updated = False
    for i, line in enumerate(lines):
        if line.startswith("OMNIROUTE_MANAGE_PASSWORD="):
            lines[i] = f"OMNIROUTE_MANAGE_PASSWORD={password}"
            updated = True
            break
    if not updated:
        lines.append(f"OMNIROUTE_MANAGE_PASSWORD={password}")
    env_path.write_text("\n".join(lines) + "\n")


def _recreate_omniroute():
    """Recrea omniroute para re-aplicar INITIAL_PASSWORD (se re-aplica en cada recreate, verificado)."""
    subprocess.run(_compose_cmd("up", "-d", "--force-recreate", "--no-deps", "omniroute"),
                   capture_output=True, text=True, timeout=120)


def _apply_dashboard_password(password: str) -> str:
    """Password unificada: wizard/ajustes → .env + recreate omniroute. Devuelve mensaje de estado."""
    _update_env_password(password)
    _recreate_omniroute()
    # ponytail: omniroute (Next.js) tarda ~7s en escuchar — retry, no sleep fijo
    import time
    for _ in range(8):
        try:
            r = httpx.post("http://omniroute:20128/api/auth/login", json={"password": password}, timeout=5)
            if r.status_code == 200:
                return "omniroute-ok"
            return f"omniroute-warn (login HTTP {r.status_code})"
        except Exception:
            time.sleep(2)
    return "omniroute-warn (sin respuesta tras recreate)"


async def _omni_provision_combos(mode: str) -> dict:
    """Crea los combos base en OmniRoute según modo (local/cloud/both)
    y escribe models/modelsLocal en agent-config.json. Idempotente."""
    password = _omni_password()
    if not password:
        return {"success": False, "error": "OMNIROUTE_MANAGE_PASSWORD no configurada"}
    r = await _omni_client.post("/api/auth/login", json={"password": password})
    if r.status_code != 200:
        return {"success": False, "error": f"login OmniRoute: {r.text[:100]}"}

    want_local = mode in ("local", "both")
    want_cloud = mode in ("cloud", "both")
    if not want_local and not want_cloud:
        return {"success": False, "error": f"modo inválido: {mode}"}

    to_create = {}
    local_errors = []
    if want_cloud:
        to_create.update(CLOUD_COMBOS)
    if want_local:
        installed = _ollama_installed_sorted()
        if installed:
            small, large = installed[0][0], installed[-1][0]
            middle = installed[len(installed) // 2][0] if len(installed) > 2 else large
            to_create.update({
                "local-default":  [f"ollama/{small}"],
                "local-smart":    [f"ollama/{large}"],
                "local-cerebro":  [f"ollama/{middle}"],
                "local-graphify": [f"ollama/{middle}"],
            })
        else:
            # ponytail: sin modelos locales no hay combos local — startup reintenta (combosProvisioned=false)
            local_errors.append("sin modelos ollama instalados — combos locales omitidos")

    r = await _omni_client.get("/api/combos")
    existing = set()
    if r.status_code == 200:
        data = r.json()
        for c in (data.get("combos") or []):
            existing.add(c.get("name"))

    created, errors = [], list(local_errors)
    for name, models in to_create.items():
        if name in existing:
            continue
        r = await _omni_client.post("/api/combos",
                                    json={"name": name, "models": models,
                                          "strategy": CLOUD_COMBO_STRATEGY.get(name, "priority")})
        if r.status_code in (200, 201):
            created.append(name)
        else:
            errors.append(f"{name}: {r.status_code} {r.text[:100]}")

    # asignar combos a perfiles solo si todos los del modo se crearon
    if not errors and to_create:
        config = get_agent_config()
        if config:
            profile_keys = [p["key"] for p in PROFILE_DEFS]
            if want_cloud:
                config["models"] = {p: f"combo/{PROFILE_TO_CLOUD[p]}" for p in profile_keys}
            if want_local:
                config["modelsLocal"] = {p: f"combo/{PROFILE_TO_LOCAL[p]}" for p in profile_keys}
            save_agent_config(config)
        ia = get_ia_mode()
        ia["combosProvisioned"] = True
        save_ia_mode(ia)

    return {"success": not errors, "created": created, "errors": errors}


@app.post("/api/ia/provision")
async def ia_provision_ep():
    mode = get_ia_mode().get("mode", "cloud")
    return await _omni_provision_combos(mode)


@app.on_event("startup")
async def _startup_provision_combos():
    """Provision combos al arranque si provisionado=false (omniroute puede tardar en healthy)."""
    async def _run():
        await asyncio.sleep(8)
        try:
            ia = get_ia_mode()
            # v1.5.7: el flag puede mentir — un cerebro IMPORTADO/movido trae combosProvisioned=true
            # del sistema viejo mientras su OmniRoute es nuevo (volumen vacío, 0 combos).
            # Chequear el recurso real: flag false O OmniRoute sin combos → provisionar.
            empty_omni = False
            if ia.get("combosProvisioned"):
                r = await _omni_client.post("/api/auth/login", json={"password": _omni_password()})
                if r.status_code == 200:
                    rc = await _omni_client.get("/api/combos")
                    empty_omni = rc.status_code == 200 and not (rc.json().get("combos") or [])
            if not ia.get("combosProvisioned") or empty_omni:
                res = await _omni_provision_combos(ia.get("mode", "cloud"))
                print(f"🔵 provision combos arranque: {res.get('success')} {res.get('created', [])} {res.get('errors', [])}")
        except Exception as e:
            print(f"⚠️ provision combos arranque: {e}")
    asyncio.create_task(_run())


@app.post("/api/localai/provision")
async def omniroute_provision():
    """Login en OmniRoute + crear conexiones openrouter y ollama-local si faltan."""
    password = _omni_password()
    if not password:
        raise HTTPException(status_code=400,
            detail="OMNIROUTE_MANAGE_PASSWORD no está en .env — ponla y recrea omniroute")
    or_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not or_key:
        for line in Path("/app/.env").read_text(encoding="utf-8").splitlines():
            if line.startswith("OPENROUTER_API_KEY="):
                or_key = line.split("=", 1)[1].strip()
                break
    # 1. login → cookie
    r = await _omni_client.post("/api/auth/login", json={"password": password})
    if r.status_code != 200:
        raise HTTPException(status_code=402, detail=f"login OmniRoute falló: {r.text[:150]}")
    # 2. listar existentes
    r = await _omni_client.get("/api/providers")
    existing = []
    if r.status_code == 200:
        data = r.json()
        existing = data if isinstance(data, list) else (data.get("connections") or data.get("providers") or [])
    have = {c.get("provider") for c in existing}
    created = []
    if "openrouter" not in have and or_key:
        r = await _omni_client.post("/api/providers", json={
            "provider": "openrouter", "apiKey": or_key,
            "name": "OpenRouter principal", "priority": 10})
        created.append({"provider": "openrouter", "status": r.status_code})
    if "ollama-local" not in have:
        r = await _omni_client.post("/api/providers", json={
            "provider": "ollama-local", "apiKey": "", "name": "Ollama Cerebro",
            "providerSpecificData": {"baseUrl": "http://ollama:11434/v1"}})
        created.append({"provider": "ollama-local", "status": r.status_code})
    return {"success": True, "created": created,
            "existing": [{"provider": c.get("provider"), "name": c.get("name")} for c in existing]}


@app.websocket("/ollama-ws/terminal/{container}")
async def ollama_terminal(ws: WebSocket, container: str):
    """Terminal persistente del contenedor ollama/omniroute via docker exec sh."""
    if container not in _OLLAMA_CONTAINERS:
        await ws.close(code=4004)
        return
    project = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")
    name = f"{project}-{container}-1"
    await ws.accept()
    proc = await asyncio.create_subprocess_exec(
        "docker", "exec", "-i", name, "sh",
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT)

    async def _reader():
        while True:
            line = await proc.stdout.readline()
            if not line:
                try:
                    await ws.send_text("\n[proceso terminado]\n")
                    await ws.close()
                except Exception:
                    pass
                return
            await ws.send_text(line.decode("utf-8", "replace"))

    reader_task = asyncio.ensure_future(_reader())
    try:
        while True:
            data = await ws.receive_text()
            # audit run-1: blocklist de primer token era evadible (sh -c, command, /bin/rm, env)
            # → allowlist de comando + rechazo de metacaracteres que sh interpretaría
            stripped = data.strip()
            if stripped and (not re.fullmatch(r"(ollama|omniroute)(\s+[A-Za-z0-9._:/-]+)*", stripped)
                             or re.search(r"[;|&$`<>]", data)):
                await ws.send_text("\n[comando bloqueado por seguridad]\n")
                continue
            proc.stdin.write((data + "\n").encode())
            await proc.stdin.drain()
    except WebSocketDisconnect:
        pass
    finally:
        reader_task.cancel()
        try:
            proc.kill()
        except Exception:
            pass


@app.get("/api/localai/pull")
async def localai_pull(model: str):
    """Pull de modelo Ollama — SSE con progreso en vivo."""
    if not re.fullmatch(r"[A-Za-z0-9._:/-]+", model):
        raise HTTPException(status_code=400, detail="nombre de modelo inválido")
    project = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")

    async def _gen():
        proc = await asyncio.create_subprocess_exec(
            "docker", "exec", f"{project}-ollama-1", "ollama", "pull", model,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            yield f"data: {line.decode('utf-8', 'replace').strip()}\n\n"
        await proc.wait()
        yield f"data: [DONE rc={proc.returncode}]\n\n"
        # ponytail: sync OmniRoute al terminar (si no, el modelo no aparece hasta ciclo 24h)
        if proc.returncode == 0:
            try:
                await _omni_model_sync()
            except Exception:
                pass

    return StreamingResponse(_gen(), media_type="text/event-stream")


async def _omni_model_sync():
    """POST sync-models de la conexión ollama-local en OmniRoute."""
    r = await _omni_client.post("/api/auth/login",
                                json={"password": _omni_password()})
    if r.status_code != 200:
        return
    r = await _omni_client.get("/api/providers")
    conns = r.json() if r.status_code == 200 else []
    conns = conns if isinstance(conns, list) else (conns.get("connections") or [])
    for c in conns:
        if c.get("provider") == "ollama-local":
            await _omni_client.post(f"/api/providers/{c['id']}/sync-models", json={})
            return


# ---------- Dashboard: consumo (proxy a OmniRoute) ----------
@app.get("/api/usage/summary")
async def usage_summary(granularity: str = "day", period: int = 30):
    """Tokens/coste por bucket. Tokens: call-logs (timestamps crudos → bucket local).
    Coste: analytics de OmniRoute (total + desglose proveedor, independiente del bucket).
    ponytail: coste por hora OmniRoute no lo expone → buckets 'hour' llevan solo tokens."""
    try:
        login = await _omni_client.post("/api/auth/login", json={"password": _omni_password()})
        if login.status_code != 200:
            return {"error": "omniroute-login", "buckets": [], "total_tokens": 0, "total_cost": 0, "by_provider": []}
        cookie = login.headers.get("set-cookie", "").split(";")[0]
        headers = {"Cookie": cookie}

        # histórico completo de analytics (365d) = totales + desglose + dailyTrend
        a = await _omni_client.get("/api/usage/analytics?range=365d", headers=headers)
        total_tokens, total_cost, by_provider, daily = 0, 0.0, [], {}
        if a.status_code == 200:
            d = a.json()
            s = d.get("summary") or {}
            total_tokens = s.get("totalTokens", 0)
            total_cost = s.get("totalCost", 0.0)
            for p in d.get("dailyTrend", []):
                daily[p.get("date", "")[:10]] = int(p.get("totalTokens") or 0)
        # proveedores REALMENTE registrados en OmniRoute (conexiones) — no combos/pseudo-proveedores
        provs = []
        try:
            r = await _omni_client.get("/api/providers", headers=headers)
            raw = r.json() if r.status_code == 200 else []
            if isinstance(raw, dict):
                raw = raw.get("connections") or []
            provs = [(c.get("name") or c.get("provider") or "?", c.get("provider") or "") for c in raw]
        except Exception:
            provs = []
        cost_by_p = {}
        for m in (d.get("byModel", []) if a.status_code == 200 else []):
            p = m.get("provider") or "desconocido"
            cost_by_p[p] = cost_by_p.get(p, 0.0) + float(m.get("cost") or 0)
        by_provider = []
        for label, pkey in provs:
            cost = sum(v for k, v in cost_by_p.items() if k == pkey or k.startswith(pkey) or pkey.startswith(k))
            by_provider.append((label, cost))
        by_provider.sort(key=lambda kv: -kv[1])

        now = datetime.now()
        buckets, labels = {}, []
        if granularity == "hour":
            # ponytail: call-logs solo conserva días recientes — basta para últimas 24h
            c = await _omni_client.get("/api/usage/call-logs?limit=500", headers=headers)
            rows = c.json() if c.status_code == 200 else []
            if isinstance(rows, dict):
                rows = rows.get("logs") or rows.get("items") or []
            for i in range(24, -1, -1):
                t = now - timedelta(hours=i)
                k = t.strftime("%Y-%m-%d %H:00")
                buckets[k] = {"tokens": 0}
                labels.append(t.strftime("%H:00") if i < 24 else "")
            for r in rows:
                ts = r.get("timestamp") or ""
                tk = r.get("tokens") or {}
                k = ts[:13] + ":00"
                if k in buckets:
                    buckets[k]["tokens"] += int(tk.get("in") or 0) + int(tk.get("out") or 0)
        elif granularity == "month":
            for i in range(11, -1, -1):
                y, m = (now.year, now.month - i) if now.month - i > 0 else (now.year - 1, now.month - i + 12)
                k = f"{y}-{m:02d}"
                buckets[k] = {"tokens": 0}
                labels.append(f"{m:02d}/{y % 100}")
            for day, v in daily.items():
                k = day[:7]
                if k in buckets:
                    buckets[k]["tokens"] += v
        else:
            for i in range(period - 1, -1, -1):
                t = now - timedelta(days=i)
                k = t.strftime("%Y-%m-%d")
                buckets[k] = {"tokens": daily.get(k, 0)}
                labels.append(t.strftime("%d/%m"))
        return {"total_tokens": total_tokens, "total_cost": round(total_cost, 4),
                "by_provider": [{"provider": p, "cost": round(v, 4)} for p, v in by_provider],
                "buckets": [{"label": lb, **buckets[k]} for k, lb in zip(buckets.keys(), labels)]}
    except Exception as e:
        return {"error": str(e), "buckets": [], "total_tokens": 0, "total_cost": 0, "by_provider": []}


# ---------- Dashboard: versiones ----------
@app.get("/api/system/versions")
async def system_versions():
    """Versiones de los 6 componentes. ponytail: docker exec con timeout corto; fallo → '—'."""
    proj = os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual")

    def _exec(container, cmd, shell=True):
        try:
            args = ["docker", "exec", f"{proj}-{container}-1"] + (["sh", "-c", cmd] if shell else cmd)
            r = subprocess.run(args, capture_output=True, text=True, timeout=10)
            return (r.stdout or "").strip() or "—"
        except Exception:
            return "—"

    def _clean(v):
        import re
        m = re.search(r"(\d[\w.\-+]*)", v or "")
        return m.group(1) if m else (v or "—")

    return {
        "Sistema": "2.0.0",
        "Hermes Agent": _clean(_local_hermes_version()),
        "Graphify": "—",
        "OmniRoute": _clean(_exec("omniroute", "node -e \"console.log(require('/app/package.json').version || '')\"")),
        "Ollama": _clean(_exec("ollama", "ollama --version 2>/dev/null | head -1")),
        "Cloudflared": _clean(_exec("cloudflared", ["cloudflared", "--version"], shell=False)),
    }
