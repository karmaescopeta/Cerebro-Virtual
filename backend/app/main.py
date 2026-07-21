from fastapi import FastAPI, HTTPException, File, UploadFile, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import os
import json
from pathlib import Path
from datetime import datetime
import httpx
import docker
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
AGENT_INTERNAL_URL = os.getenv("AGENT_INTERNAL_URL", "http://cerebro-agente:8080")

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

def get_docker_client():
    try:
        return docker.from_env()
    except Exception as e:
        print(f"⚠️ Error al conectar con Docker: {e}")
        return None

def _join_host_path(base: str, *parts: str) -> str:
    """Join a Docker host path returned by inspect (Windows or POSIX)."""
    sep = "\\" if "\\" in base or (len(base) > 1 and base[1] == ":") else "/"
    return base.rstrip("\\/") + sep + sep.join(parts)


def _get_backend_mount_source(container, destination: str):
    for mount in container.attrs.get("Mounts", []):
        if mount.get("Destination") == destination:
            return mount.get("Source")
    return None


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
    """Build and start the Hermes agent container from the backend.

    The backend runs inside Docker, so executing `docker compose` from here is
    unreliable: relative bind paths would point to the backend container instead
    of the Windows host. We use the Docker SDK instead, build the agent image by
    streaming `/app/sistema-agente` as context, and reuse the host bind path of
    the backend's `/app/vault` mount for the agent container.
    """
    # Fast path: when the frontend reloads after the wizard, don't rebuild the
    # heavy Hermes image if the agent is already reachable. Do this before
    # touching Docker SDK so an already-running app stays responsive even if
    # Docker is slow.
    if _agent_http_ready(timeout=0.8):
        return True, "El agente ya está iniciado"

    client = get_docker_client()
    if not client:
        return False, "No se pudo conectar con Docker desde el backend"

    try:
        existing = client.containers.get("cerebro-agente")
        existing.reload()
        if existing.status == "running":
            return True, "El agente ya está iniciado"
    except docker.errors.NotFound:
        pass

    image_tag = os.getenv("AGENT_IMAGE", "cerebrovirtual-sistema-agente:latest")
    build_context = os.getenv("AGENT_BUILD_CONTEXT", "/app/sistema-agente")

    try:
        backend_container = client.containers.get("cerebro-backend")
        vault_source = _get_backend_mount_source(backend_container, "/app/vault")
        if not vault_source:
            return False, "No se encontró el volumen host de /app/vault en cerebro-backend"

        project_source = vault_source.rstrip("\\/")
        # Remove the final 'vault' path segment.
        if project_source.lower().endswith("\\vault") or project_source.lower().endswith("/vault"):
            project_source = project_source[:-6]
        config_source = _join_host_path(project_source, "sistema-agente", "config")

        networks = backend_container.attrs.get("NetworkSettings", {}).get("Networks", {})
        network_name = next(iter(networks.keys()), None)

        # Build image on demand. This is what makes a fresh start.bat flow work:
        # start.bat only launches backend/frontend; the agent is built when the
        # wizard finishes and /api/agent/start is called.
        if Path(build_context).exists():
            print(f"🔨 Construyendo imagen del agente desde {build_context}...")
            client.images.build(path=build_context, tag=image_tag, rm=True)
        else:
            print(f"⚠️ No existe {build_context}; usando imagen existente {image_tag}")
            client.images.get(image_tag)

        # Remove stale container so config changes from the wizard are applied.
        try:
            old = client.containers.get("cerebro-agente")
            old.remove(force=True)
        except docker.errors.NotFound:
            pass

        print("🚀 Creando contenedor cerebro-agente...")
        client.containers.run(
            image_tag,
            name="cerebro-agente",
            detach=True,
            ports={"8080/tcp": 8080},
            volumes={
                vault_source: {"bind": "/app/vault", "mode": "rw"},
                config_source: {"bind": "/app/config", "mode": "rw"},
            },
            environment={
                "VAULT_PATH": "/app/vault",
                "CONFIG_PATH": "/app/config/agent-config.yaml",
                "HERMES_CONFIG": "/app/hermes-home/config.yaml",
            },
            network=network_name,
            restart_policy={"Name": "unless-stopped"},
        )
        return True, "Contenedor del agente construido e iniciado"
    except Exception as e:
        return False, f"Error al iniciar el agente: {e}"


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
    wiki_count = len(list(Path(VAULT_PATH).glob("wiki/**/*.md")))
    raw_files = len(list(Path(VAULT_PATH).glob("raw/**/*"))) - len(list(Path(VAULT_PATH).glob("raw/.processed/**/*")))
    outputs_count = len(list(Path(VAULT_PATH).glob("outputs/**/*")))
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
            "defaultModel": "openai/gpt-4o-mini",
            "availableModels": [
                "openai/gpt-4o-mini",
                "openai/gpt-4o",
                "anthropic/claude-3.5-sonnet",
                "google/gemini-2.0-flash-exp"
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
            ["docker", "exec", "-e", f"OPENROUTER_API_KEY={api_key}",
             "cerebro-agente", HERMES_BIN, "chat", "-q", prompt],
            capture_output=True, text=True, timeout=180
        )
        if result.returncode != 0:
            raise RuntimeError(f"Hermes chunk {i+1} falló: {result.stderr[:200]}")
        parsed = _parse_hermes_output(result.stdout)
        if not parsed:
            raise RuntimeError(f"Hermes chunk {i+1} respuesta vacía")
        parts.append(parsed)
    return "\n\n".join(parts)


@app.post("/api/chat")
async def chat(message: dict):
    user_message = message.get("message", "")
    if not user_message:
        raise HTTPException(status_code=400, detail="Mensaje vacío")

    config = get_agent_config()
    agent_name = config.get("agentName", "Hermes") if config else "Hermes"

    api_key = get_agent_key("hermes") or OPENROUTER_API_KEY
    if not api_key:
        return {
            "response": f"⚠️ **{agent_name} no tiene una API key configurada.**",
            "context": {"error": "no_api_key"}
        }

    # ponytail: RAG — buscar en wiki/ antes de enviar a Hermes
    search_results = search_vault(user_message)
    context_text = ""
    if search_results:
        context_text = "\n\n---\n**Contexto del vault:**\n"
        for i, r in enumerate(search_results, 1):
            context_text += f"\n**{i}. {r['title']}** ({r['path']})\n{r['content']}...\n"
        context_text += "---\n"

    # ponytail: sesión persistente via --continue (recuerda mensajes previos del mismo proceso)
    HERMES_BIN = "/usr/local/lib/hermes-agent/venv/bin/hermes"
    full_message = f"{context_text}\n\nPregunta: {user_message}" if context_text else user_message

    try:
        result = subprocess.run(
            ["docker", "exec", "-e", f"OPENROUTER_API_KEY={api_key}",
             "cerebro-agente", HERMES_BIN, "chat", "-q", "--continue", full_message],
            capture_output=True, text=True, timeout=120
        )

        if result.returncode != 0:
            # ponytail: --continue falla si no hay sesión previa, retry sin flag
            result = subprocess.run(
                ["docker", "exec", "-e", f"OPENROUTER_API_KEY={api_key}",
                 "cerebro-agente", HERMES_BIN, "chat", "-q", full_message],
                capture_output=True, text=True, timeout=120
            )
            if result.returncode != 0:
                return {
                    "response": f"❌ **Error Hermes:**\n\n{result.stderr[:500]}",
                    "context": {"error": "hermes_exec_error"}
                }

        # ponytail: parse naive — respuesta entre separadores unicode
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

        ai_response = "\n".join(response_lines).strip() or output.strip()

        return {
            "response": ai_response,
            "context": {
                "model": "openai/gpt-4o-mini",
                "via": "hermes-coordinador",
                "vault_results": len(search_results),
                "timestamp": datetime.now().isoformat()
            }
        }

    except subprocess.TimeoutExpired:
        return {
            "response": "⏰ **Tiempo de espera agotado.**",
            "context": {"error": "timeout"}
        }
    except Exception as e:
        return {
            "response": f"❌ **Error:** {str(e)}",
            "context": {"error": str(e)}
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
        subprocess.run(["docker", "stop", "cerebro-agente"], capture_output=True, check=False)
        subprocess.run(["docker", "rm", "-f", "cerebro-agente"], capture_output=True, check=False)
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
# ENDPOINTS PARA REINICIAR E INICIAR EL AGENTE
# ============================================

@app.post("/api/agent/restart")
async def restart_agent():
    import subprocess
    try:
        result = subprocess.run(
            ["docker", "restart", "cerebro-agente"],
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
    import subprocess
    client = get_docker_client()

    # 1. Detener y eliminar el contenedor del agente
    try:
        subprocess.run(["docker", "stop", "cerebro-agente"], capture_output=True, check=False, timeout=30)
    except Exception:
        pass
    try:
        subprocess.run(["docker", "rm", "-f", "cerebro-agente"], capture_output=True, check=False, timeout=30)
    except Exception:
        pass

    # 2. Borrar la imagen del agente para forzar rebuild limpio
    image_tag = os.getenv("AGENT_IMAGE", "cerebrovirtual-sistema-agente:latest")
    try:
        if client:
            client.images.remove(image_tag, force=True)
        else:
            subprocess.run(["docker", "rmi", "-f", image_tag], capture_output=True, check=False, timeout=60)
    except Exception as e:
        print(f"⚠️ No se pudo borrar la imagen {image_tag}: {e}")

    # 3. Reconstruir la imagen desde cero
    build_context = os.getenv("AGENT_BUILD_CONTEXT", "/app/sistema-agente")
    try:
        if client and Path(build_context).exists():
            print("🔨 Reconstruyendo imagen del agente desde cero...")
            client.images.build(path=build_context, tag=image_tag, rm=True)
        elif client:
            client.images.pull(image_tag)
        else:
            subprocess.run(
                ["docker", "compose", "--profile", "agent", "build", "--no-cache", "sistema-agente"],
                capture_output=True, check=False, timeout=600,
                cwd="/app"
            )
    except Exception as e:
        return {"success": False, "message": f"Error al reconstruir la imagen: {e}"}

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

    try:
        with tarfile.open(export_file, "w:gz") as tar:
            for item in vault_path.iterdir():
                if item.name == ".git":
                    continue
                tar.add(str(item), arcname=item.name)

        return FileResponse(
            path=str(export_file),
            media_type="application/gzip",
            filename=f"vault-backup-{timestamp}.tar.gz"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al exportar: {e}")


@app.post("/api/vault/import")
async def import_vault(file: bytes = File(...)):
    """Acepta un .tar.gz y lo descomprime en el vault."""
    import tempfile
    import tarfile
    import io

    vault_path = Path(VAULT_PATH)

    try:
        # Leer el archivo subido
        tar_bytes = file
        tar_io = io.BytesIO(tar_bytes)

        # Verificar que es un tar.gz válido
        try:
            tar = tarfile.open(fileobj=tar_io, mode="r:gz")
        except tarfile.ReadError:
            raise HTTPException(status_code=400, detail="El archivo no es un .tar.gz válido")

        # Crear backup del vault actual por seguridad
        backup_dir = vault_path.parent / f"vault-backup-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        if vault_path.exists():
            import shutil
            shutil.copytree(str(vault_path), str(backup_dir), dirs_exist_ok=True)

        # Extraer el tar.gz en una carpeta temporal primero
        temp_dir = Path(tempfile.mkdtemp())
        tar.extractall(str(temp_dir))
        tar.close()

        # Verificar que la estructura es válida
        required_dirs = ["raw", "wiki", "outputs", "system"]
        found_dirs = [d.name for d in temp_dir.iterdir() if d.is_dir()]
        missing = [d for d in required_dirs if d not in found_dirs]

        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"El vault importado no tiene la estructura válida. Faltan: {', '.join(missing)}"
            )

        # Copiar el contenido al vault
        import shutil
        for item in temp_dir.iterdir():
            dest = vault_path / item.name
            if dest.exists():
                if dest.is_dir():
                    shutil.rmtree(str(dest))
                else:
                    dest.unlink()
            shutil.move(str(item), str(dest))

        # Limpiar temporal
        shutil.rmtree(str(temp_dir), ignore_errors=True)

        return {
            "success": True,
            "message": f"Vault importado correctamente. Backup anterior en: {backup_dir.name}"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al importar: {e}")


# ============================================
# ENDPOINT PARA SUBIR ARCHIVOS AL VAULT
# ============================================

@app.post("/api/vault/upload")
async def upload_to_vault(file: UploadFile = File(...), topic: str = "general"):
    """Sube un archivo al vault en raw/<topic>/. Auto-procesa a wiki."""
    import shutil as shutil_mod

    raw_path = Path(VAULT_PATH) / "raw" / topic
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

    file_path = f"raw/{topic}/{safe_filename}"

    # ponytail: auto-procesar a wiki en background (no bloquear el upload)
    wiki_path = None
    api_key = get_agent_key("hermes") or OPENROUTER_API_KEY
    if api_key:
        try:
            client = get_docker_client()
            vault_host = VAULT_PATH
            if client:
                try:
                    bc = client.containers.get("cerebro-backend")
                    vault_host = _get_backend_mount_source(bc, "/app/vault") or VAULT_PATH
                except Exception:
                    pass

            # 1. extraer texto
            extract = subprocess.run(
                ["docker", "run", "--rm", "-v", f"{vault_host}:/app/vault",
                 "cerebrovirtual-herramientas:latest",
                 "bash", "/app/scripts/process_raw.sh", f"/app/vault/{file_path}"],
                capture_output=True, text=True, timeout=300
            )
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
    """Lista los archivos en raw/."""
    raw_path = Path(VAULT_PATH) / "raw"
    files = []
    if raw_path.exists():
        for f in raw_path.rglob("*"):
            if f.is_file() and ".processed" not in str(f) and f.name != ".gitkeep":
                rel = f.relative_to(raw_path)
                files.append({
                    "name": f.name,
                    "path": str(rel),
                    "size": f.stat().st_size,
                    "ext": f.suffix.lower().lstrip(".")
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

    # ponytail: limpiar .processed si el directorio queda vacío
    if target.parent.exists() and not any(target.parent.iterdir()):
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
    return results


@app.get("/api/wiki/graph")
async def wiki_graph():
    """Devuelve nodos y aristas del grafo de wikilinks de wiki/."""
    import re
    wiki_path = Path(VAULT_PATH) / "wiki"
    nodes = []
    edges = []
    node_ids = set()

    if not wiki_path.exists():
        return {"nodes": [], "edges": []}

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

        # ponytail: regex simple para [[wikilinks]]
        links = re.findall(r'\[\[([^\]]+)\]\]', content)
        for link in links:
            target = link.strip().replace(" ", "-").lower()
            if target and target not in node_ids:
                nodes.append({"id": target, "title": link.strip(), "path": None})
                node_ids.add(target)
            edges.append({"source": stem, "target": target})

    return {"nodes": nodes, "edges": edges}


@app.post("/api/vault/process")
async def process_raw_file(request: dict):
    """Procesa un archivo de raw/ → texto extraído → página wiki via Sintetizador.

    1. docker run --rm cerebro-herramientas process_raw.sh <file>  → .txt
    2. docker exec cerebro-agente hermes chat -q "Sintetiza: <txt>"  → wiki page
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

    # ponytail: obtener host path del vault via Docker SDK (igual que start_agent_container)
    client = get_docker_client()
    vault_host = VAULT_PATH
    if client:
        try:
            bc = client.containers.get("cerebro-backend")
            vault_host = _get_backend_mount_source(bc, "/app/vault") or VAULT_PATH
        except Exception:
            pass

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
    client = get_docker_client()
    vault_host = VAULT_PATH
    if client:
        try:
            bc = client.containers.get("cerebro-backend")
            vault_host = _get_backend_mount_source(bc, "/app/vault") or VAULT_PATH
        except Exception:
            pass

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
             "cerebro-agente", "/usr/local/lib/hermes-agent/venv/bin/hermes",
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
    client = get_docker_client()
    if not client:
        return {"error": "Docker no disponible"}

    containers = {}
    for name in ["cerebro-backend", "cerebro-frontend", "cerebro-agente", "cerebro-herramientas"]:
        try:
            c = client.containers.get(name)
            c.reload()
            containers[name] = {
                "status": c.status,
                "running": c.status == "running",
                "ports": c.ports if hasattr(c, 'ports') else {}
            }
        except Exception:
            containers[name] = {"status": "not_found", "running": False}

    return {"containers": containers}