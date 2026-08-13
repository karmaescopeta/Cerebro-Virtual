from fastapi import FastAPI, HTTPException, File, UploadFile, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import os
import json
from pathlib import Path
from datetime import datetime
import httpx

import subprocess
import time

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
if Path(VAULT_PATH).exists():
    app.mount("/vault-static", StaticFiles(directory=VAULT_PATH), name="vault-static")


# ============================================
# FUNCIONES AUXILIARES
# ============================================

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
    return ["docker", "compose", "-p", project] + list(args)


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
    return "google/gemma-4-26b-a4b-it:free"

def _run_graphify(file_abs_path: str, vault_host: str) -> dict | None:
    """Ejecuta Graphify sobre el directorio del archivo. Output a vault/system/graphify-tmp/graphify-out/graph.json.
    ponytail: Graphify espera un directorio, no un archivo individual."""
    out_subdir = "system/graphify-tmp"
    out_abs = f"/app/vault/{out_subdir}"
    # ponytail: Graphify escanea directorios, no archivos. Pasar el dir del archivo.
    import os as _os
    input_dir = _os.path.dirname(file_abs_path) or file_abs_path
    try:
        # ponytail: pasar env vars al contenedor efímero — Graphify necesita OPENAI_API_KEY
        # ponytail: modelo de Graphify configurable desde agent-config.json (models.graphify)
        graphify_model = _get_graphify_model()
        env_vars = ["-e", f"OPENAI_API_KEY={get_agent_key('hermes') or OPENROUTER_API_KEY or ''}",
                    "-e", "OPENAI_BASE_URL=https://openrouter.ai/api/v1",
                    "-e", f"GRAPHIFY_OPENAI_MODEL={graphify_model}",
                    "-e", "GRAPHIFY_FORCE=1"]
        result = subprocess.run(
            ["docker", "run", "--rm", "-v", f"{vault_host}:/app/vault",
             *env_vars,
             "cerebrovirtual-herramientas:latest",
             "bash", "/app/scripts/run_graphify.sh", input_dir, out_abs],
            capture_output=True, text=True, timeout=180
        )
        if result.returncode != 0:
            print(f"⚠️ Graphify falló: {result.stderr[:300]}")
            return None
        # ponytail: Graphify escribe a <out_dir>/graphify-out/graph.json (siempre crea subdirectorio)
        graph_file = Path(VAULT_PATH) / out_subdir / "graphify-out" / "graph.json"
        if not graph_file.exists():
            print("⚠️ Graphify no generó graph.json")
            return None
        with open(graph_file) as f:
            partial = json.load(f)
        # limpiar tmp
        import shutil
        shutil.rmtree(Path(VAULT_PATH) / out_subdir / "graphify-out", ignore_errors=True)
        return partial
    except Exception as e:
        print(f"⚠️ Graphify error: {e}")
        return None

def _merge_graph(partial: dict, source_file: str) -> None:
    """Merge graph parcial de Graphify con graph.json global del vault."""
    if not partial or "nodes" not in partial:
        return
    # ponytail: cargar graph global, añadir source_file a cada nodo, merge, guardar
    existing = {"nodes": [], "edges": []}
    if GRAPH_PATH.exists():
        try:
            with open(GRAPH_PATH) as f:
                existing = json.load(f)
        except Exception:
            pass

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
    with open(GRAPH_PATH, "w") as f:
        json.dump(existing, f, ensure_ascii=False)

def _prune_graph_json(source_file: str) -> None:
    """Elimina nodos/edges de un archivo borrado del graph.json global."""
    # ponytail: O(n) scan, suficiente hasta miles de nodos
    if not GRAPH_PATH.exists():
        return
    try:
        with open(GRAPH_PATH) as f:
            graph = json.load(f)
        before = len(graph.get("nodes", []))
        graph["nodes"] = [n for n in graph.get("nodes", []) if n.get("source_file") != source_file]
        valid_ids = {n["id"] for n in graph["nodes"]}
        graph["edges"] = [e for e in graph.get("edges", [])
                          if e.get("source") in valid_ids and e.get("target") in valid_ids]
        with open(GRAPH_PATH, "w") as f:
            json.dump(graph, f, ensure_ascii=False)
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
        graph["nodes"] = [n for n in graph.get("nodes")
                          if n.get("source_file") in existing_files or not n.get("source_file")]
        valid_ids = {n["id"] for n in graph["nodes"]}
        graph["edges"] = [e for e in graph.get("edges", [])
                          if e.get("source") in valid_ids and e.get("target") in valid_ids]
        with open(GRAPH_PATH, "w") as f:
            json.dump(graph, f, ensure_ascii=False)
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
HERMES_BIN = "/usr/local/lib/hermes-agent/venv/bin/hermes"


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

def _save_to_session(session_id: str, role: str, content: str, context: dict = None):
    """Añade mensaje al JSON + actualiza updatedAt + auto-título."""
    s = _load_session(session_id)
    if not s:
        return
    s["messages"].append({
        "role": role,
        "content": content,
        "context": context,
        "timestamp": datetime.now().isoformat()
    })
    s["updatedAt"] = datetime.now().isoformat()
    # ponytail: auto-título desde primer mensaje user
    if not s.get("title") and role == "user":
        s["title"] = content[:40].replace("\n", " ").strip()
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

def search_internet(query: str, limit: int = 5) -> list[dict]:
    """Busca en SearXNG. Returns [{title, url, snippet}]."""
    try:
        resp = httpx.get(f"{SEARXNG_URL}/search", params={"q": query, "format": "json"}, timeout=15)
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

HERMES_BIN = "/usr/local/lib/hermes-agent/venv/bin/hermes"

def _ask_hermes(profile: str, prompt: str, history: list[dict] = None, timeout: int = 120) -> str:
    """docker exec con perfil, inyecta historial (últimos 10 msgs)."""
    # ponytail: inyectar historial como contexto
    full_prompt = prompt
    if history:
        hist_text = "\n\n**Historial de conversación:**\n"
        for msg in history:
            role = msg.get("role", "")
            content = msg.get("content", "")[:500]
            hist_text += f"[{role}]: {content}\n"
        full_prompt = hist_text + "\n\n**Pregunta/mensaje actual:**\n" + prompt

    cmd = ["docker", "compose", "-p", os.getenv("COMPOSE_PROJECT_NAME", "cerebrovirtual"), "exec", "-e", f"OPENROUTER_API_KEY={get_agent_key('hermes') or OPENROUTER_API_KEY}",
           "sistema-agente", HERMES_BIN, "chat", "-q", "-p", profile, full_prompt]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        # ponytail: fallback sin -p
        cmd_no_profile = cmd[:6] + ["chat", "-q", full_prompt]
        result = subprocess.run(cmd_no_profile, capture_output=True, text=True, timeout=timeout)
        if result.returncode != 0:
            raise RuntimeError(result.stderr[:500])
    return _parse_hermes_output(result.stdout)

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
                content = md_file.read_text(encoding="utf-8")[:800]
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
            anti_hallucinate = (
                "\n\n**Instrucción:** Responde SOLO con la información del contexto anterior. "
                "Si el contexto no contiene la respuesta, di que no tienes datos suficientes. "
                "No inventes información."
            )
            cerebro_prompt = f"{vault_context}\n\nPregunta: {user_message}{anti_hallucinate}" if vault_context.strip() else user_message

            if mode == "cerebro":
                # solo vault, sin internet
                if not vault_context.strip():
                    response = "🔍 **No he encontrado información sobre esto en el cerebro.**"
                    ctx = {"via": "direct", "found_info": False, "sources": [], "mode": mode}
                else:
                    response = _ask_hermes("cerebro", cerebro_prompt, history)
                    ctx = {"via": "cerebro", "found_info": True, "sources": sources, "mode": mode}
            else:
                # cerebro + internet → respuesta dividida
                if vault_context.strip():
                    cerebro_resp = _ask_hermes("cerebro", cerebro_prompt, history)
                else:
                    cerebro_resp = "No se encontró información en el cerebro."
                    sources = []
                # buscar internet
                internet_results = search_internet(user_message)
                if internet_results:
                    internet_prompt = f"{_format_search_results(internet_results)}\n\nResume los resultados anteriores sobre: {user_message}"
                    internet_resp = _ask_hermes("chat-default", internet_prompt, history)
                else:
                    internet_resp = "No se pudieron obtener resultados de internet."
                response = f"🧠 **CEREBRO**\n\n{cerebro_resp}\n\n---\n\n🌐 **INTERNET**\n\n{internet_resp}"
                ctx = {"via": "cerebro+internet", "found_info": bool(sources), "sources": sources, "mode": mode, "internet_results": len(internet_results)}

        else:
            # chat normal (default o smart) — busca internet por defecto
            profile = "chat-smart" if mode == "smart" else "chat-default"
            internet_results = search_internet(user_message)
            search_context = _format_search_results(internet_results)
            prompt = f"{search_context}\n\n{user_message}" if search_context else user_message
            response = _ask_hermes(profile, prompt, history)
            ctx = {"via": profile, "found_info": True, "sources": [], "mode": mode, "internet_results": len(internet_results)}

        # ponytail: guardar respuesta en sesión
        if session_id:
            _save_to_session(session_id, "assistant", response, ctx)

        return {"response": response, "context": ctx}

    except subprocess.TimeoutExpired:
        return {"response": "⏰ **Tiempo de espera agotado.**", "context": {"error": "timeout"}}
    except Exception as e:
        return {"response": f"❌ **Error:** {str(e)}", "context": {"error": str(e)}}


@app.post("/api/chat/investigate")
async def investigate(message: dict):
    """Investiga mensajes seleccionados → documento Markdown completo + resumen breve.
    Devuelve {response: summary, full_doc: document, context: {is_document, offer_save}}.
    ponytail: dos llamadas — investigador genera .md completo, chat-default genera resumen."""
    messages_list = message.get("messages", [])
    session_id = message.get("session_id")
    if not messages_list:
        raise HTTPException(status_code=400, detail="No hay mensajes seleccionados")

    config = get_agent_config()
    api_key = get_agent_key("hermes") or OPENROUTER_API_KEY
    if not api_key:
        return {"response": "⚠️ No hay API key configurada.", "full_doc": "", "context": {"error": "no_api_key"}}

    # ponytail: combinar mensajes seleccionados como contexto
    combined = ""
    for msg in messages_list:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        combined += f"\n[{role}]: {content}\n"

    prompt = (
        "Investiga el siguiente tema basándote en el contexto del chat y genera un documento "
        "en formato Markdown compatible con Obsidian. Usa títulos (#, ##, ###), **negritas**, "
        "listas, [[wikilinks]], tablas y code blocks cuando aplique. "
        "Estructura: título, resumen, secciones detalladas, conclusiones, fuentes. "
        "Sin preámbulos. Empieza con # Título.\n\n"
        f"Contexto del chat:\n{combined}"
    )

    history = _load_session_history(session_id, limit=10) if session_id else []
    try:
        # 1. generar documento completo
        full_doc = _ask_hermes("investigador", prompt, history, timeout=180)

        # 2. generar resumen breve (3-5 líneas) desde el documento completo
        summary_prompt = (
            "Resume el siguiente documento en 3-5 líneas con los puntos clave. "
            "Sin preámbulos, sin títulos, solo el resumen directo.\n\n"
            f"{full_doc[:3000]}"
        )
        summary = _ask_hermes("chat-default", summary_prompt, history, timeout=60)

        return {
            "response": summary,
            "full_doc": full_doc,
            "context": {
                "via": "investigador",
                "is_document": True,
                "offer_save": True,
                "sources": [],
            }
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

    out_dir = Path(VAULT_PATH) / "outputs" / req.project_id
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
    try:
        # ponytail: obtener vault_host real del host (VAULT_PATH es /app/vault dentro del contenedor)
        vault_host = VAULT_PATH
        vault_host = os.getenv("VAULT_HOST_PATH", "") or VAULT_PATH
        partial = _run_graphify(str(out_file), vault_host)
        if partial:
            _merge_graph(partial, safe_name + ".md")
            graphify_ok = True
    except Exception as e:
        print(f"⚠️ save-output graphify error: {e}")

    return {
        "status": "saved",
        "path": f"outputs/{req.project_id}/{safe_name}.md",
        "wiki_path": f"wiki/{safe_name}.md",
        "graph_updated": graphify_ok,
        "project_id": req.project_id
    }


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
    {"key": "graphify", "label": "Graphify (Neuronas)", "default": "google/gemma-4-26b-a4b-it:free"},
]

@app.get("/api/profiles/models")
async def get_profiles_models():
    config = get_agent_config()
    if not config:
        raise HTTPException(status_code=404, detail="No hay configuración")
    models = config.get("models", {})
    names = config.get("profileNames", {})
    return {"profiles": [
        {"key": p["key"], "name": names.get(p["key"], p["label"]), "model": models.get(p["key"], p["default"])}
        for p in PROFILE_DEFS
    ]}


@app.put("/api/profiles/models")
async def update_profiles_models(request: dict):
    import subprocess
    config = get_agent_config()
    if not config:
        raise HTTPException(status_code=404, detail="No hay configuración")

    new_models = request.get("models", {})
    new_names = request.get("profileNames", {})
    old_models = config.get("models", {})

    config["models"] = new_models
    config["profileNames"] = new_names
    config["updatedAt"] = datetime.now().isoformat()
    save_agent_config(config)

    # ponytail: docker restart reejecuta entrypoint → generate_config.py + install_profiles.sh aplican nuevos modelos
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
    agent_name = config.get("agentName", "Hermes") if config else "Hermes"
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
                {f'Configurado el: {config.get("createdAt", "desconocido")[:10]}' if is_configured else 'Completa el wizard para configurar el agente.'}
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
        cloudflare_token = request.get("cloudflareTunnelToken", "").strip()

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
            "cloudflareTunnelToken": cloudflare_token,
            "createdAt": datetime.now().isoformat(),
            "updatedAt": datetime.now().isoformat()
        }

        save_agent_config(config)
        set_agent_key("hermes", api_key)

        return {"success": True, "message": "Configuración guardada correctamente", "agentName": agent_name}
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
        tar.extractall(str(temp_dir))
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

    raw_path = Path(VAULT_PATH) / "raw" / dest_folder
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

    # ponytail: auto-procesar a wiki en background (no bloquear el upload)
    wiki_path = None
    api_key = get_agent_key("hermes") or OPENROUTER_API_KEY
    if api_key:
        try:
            vault_host = os.getenv("VAULT_HOST_PATH", "") or VAULT_PATH

            # 1. extraer texto
            extract = subprocess.run(
                ["docker", "run", "--rm", "-v", f"{vault_host}:/app/vault",
                 "cerebrovirtual-herramientas:latest",
                 "bash", "/app/scripts/process_raw.sh", f"/app/vault/{file_path}"],
                capture_output=True, text=True, timeout=300
            )

            # ponytail: Graphify — procesa el archivo original directamente (no necesita texto extraído)
            file_ext = Path(safe_filename).suffix.lower()
            if file_ext in GRAPHIFY_EXTS:
                try:
                    partial = _run_graphify(f"/app/vault/{file_path}", vault_host)
                    if partial:
                        _merge_graph(partial, safe_filename)
                except Exception as e:
                    print(f"⚠️ Graphify falló para {safe_filename}: {e}")

            if extract.returncode == 0 and extract.stdout.strip():
                extracted_text = extract.stdout.strip()
                # filtrar logs del script
                text_lines = extracted_text.split("\n")
                content_start = 0
                for i, line in enumerate(text_lines):
                    if line.strip() == "---" or line.startswith("✅"):
                        content_start = i + 1
                extracted_text = "\n".join(text_lines[content_start:]).strip() or extracted_text

                # 2. sintetizar wiki (lossless, multi-chunk)
                stem = Path(safe_filename).stem
                try:
                    wiki_content = _synthesize_wiki(stem, extracted_text, api_key)
                    wiki_file = Path(VAULT_PATH) / "wiki" / f"{stem}.md"
                    wiki_file.parent.mkdir(parents=True, exist_ok=True)
                    wiki_file.write_text(wiki_content, encoding="utf-8")
                    wiki_path = f"wiki/{stem}.md"
                except Exception as e:
                    print(f"⚠️ Síntesis wiki falló: {e}")
        except Exception as e:
            print(f"⚠️ Auto-procesamiento falló: {e}")

    return {
        "success": True,
        "message": f"Archivo subido: {safe_filename}" + (f" → wiki/{Path(safe_filename).stem}.md" if wiki_path else ""),
        "path": file_path,
        "filename": safe_filename,
        "preview_type": preview_type,
        "wiki_path": wiki_path,
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
    new_path = target.parent / req.newName
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
            with open(GRAPH_PATH) as f:
                graph = json.load(f)
            for n in graph.get("nodes", []):
                if n.get("source_file") == old_name:
                    n["source_file"] = req.newName
            with open(GRAPH_PATH, "w") as f:
                json.dump(graph, f, ensure_ascii=False)
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
            dst_dir = base / req.targetProject
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


@app.get("/api/graph/query")
async def graph_query(q: str, limit: int = 10):
    """Busca nodos en graph.json por label → nodos + edges adyacentes. Para RAG del chat."""
    return search_graph(q, limit)


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

    raw_file = Path(VAULT_PATH) / file_path
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

    folder = Path(VAULT_PATH) / folder_path
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
             "sistema-agente", "/usr/local/lib/hermes-agent/venv/bin/hermes",
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
        containers = {}
        try:
            services = json.loads(result.stdout) if result.stdout.strip() else []
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

@app.get("/api/tunnel/status")
async def tunnel_status():
    config = get_agent_config()
    if not config:
        return {"active": False, "hasToken": False}
    token = config.get("cloudflareTunnelToken", "")
    return {"active": bool(token), "hasToken": bool(token)}


@app.post("/api/tunnel/configure")
async def tunnel_configure(request: dict):
    token = request.get("cloudflareTunnelToken", "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token requerido")

    config = get_agent_config()
    if not config:
        raise HTTPException(status_code=404, detail="No hay configuración")

    config["cloudflareTunnelToken"] = token
    config["updatedAt"] = datetime.now().isoformat()
    save_agent_config(config)

    # ponytail: write token to .env on host via VAULT_HOST_PATH
    vault_host = os.getenv("VAULT_HOST_PATH", "") or VAULT_PATH
    env_path = os.path.join(vault_host, "..", ".env") if vault_host != VAULT_PATH else "/app/.env"
    try:
        # Read current .env, update/add CLOUDFLARE_TUNNEL_TOKEN
        env_lines = []
        env_file = os.path.join(os.path.dirname(vault_host), ".env") if vault_host != VAULT_PATH else None
        if env_file and os.path.exists(env_file):
            with open(env_file, "r") as f:
                env_lines = f.readlines()
            updated = False
            for i, line in enumerate(env_lines):
                if line.startswith("CLOUDFLARE_TUNNEL_TOKEN="):
                    env_lines[i] = f"CLOUDFLARE_TUNNEL_TOKEN={token}\n"
                    updated = True
                    break
            if not updated:
                env_lines.append(f"CLOUDFLARE_TUNNEL_TOKEN={token}\n")
            with open(env_file, "w") as f:
                f.writelines(env_lines)
    except Exception as e:
        print(f"⚠️ No se pudo escribir .env: {e}")

    # Start cloudflared via compose
    result = subprocess.run(
        _compose_cmd("--profile", "tunnel", "up", "-d", "cloudflared"),
        capture_output=True, text=True, timeout=60
    )
    if result.returncode != 0:
        return {"success": False, "message": f"Token guardado pero error al iniciar tunnel: {result.stderr}"}

    return {"success": True, "message": "Túnel configurado y activado"}


@app.post("/api/tunnel/deactivate")
async def tunnel_deactivate():
    config = get_agent_config()
    if not config:
        raise HTTPException(status_code=404, detail="No hay configuración")

    config["cloudflareTunnelToken"] = ""
    config["updatedAt"] = datetime.now().isoformat()
    save_agent_config(config)

    subprocess.run(
        _compose_cmd("stop", "cloudflared"),
        capture_output=True, timeout=30
    )

    return {"success": True, "message": "Túnel desactivado"}


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
    return {"current": version, "githubRepo": os.getenv("GITHUB_REPO", "")}
