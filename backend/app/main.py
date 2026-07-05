from fastapi import FastAPI, HTTPException
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

def search_vault(query: str, limit: int = 5):
    """Search wiki/ first, then raw/ as fallback."""
    results = []
    # Search wiki/ first (processed, structured knowledge)
    wiki_path = Path(VAULT_PATH) / "wiki"
    if wiki_path.exists():
        for md_file in wiki_path.glob("**/*.md"):
            try:
                with open(md_file, "r", encoding="utf-8") as f:
                    content = f.read()
                if query.lower() in content.lower():
                    title = md_file.stem.replace("-", " ").title()
                    for line in content.split("\n"):
                        if line.startswith("# "):
                            title = line[2:].strip()
                            break
                    lines = content.split("\n")
                    context = ""
                    for i, line in enumerate(lines):
                        if query.lower() in line.lower():
                            start = max(0, i-2)
                            end = min(len(lines), i+3)
                            context = "\n".join(lines[start:end])
                            break
                    results.append({
                        "title": title,
                        "path": str(md_file.relative_to(VAULT_PATH)),
                        "content": context[:500],
                        "source": "wiki"
                    })
                    if len(results) >= limit:
                        return results
            except Exception as e:
                print(f"Error leyendo {md_file}: {e}")
                continue

    # Fallback: search raw/ (original files, only .txt and .md)
    raw_path = Path(VAULT_PATH) / "raw"
    if raw_path.exists() and len(results) < limit:
        for md_file in raw_path.glob("**/*.md"):
            try:
                with open(md_file, "r", encoding="utf-8") as f:
                    content = f.read()
                if query.lower() in content.lower():
                    title = md_file.stem.replace("-", " ").title()
                    for line in content.split("\n"):
                        if line.startswith("# "):
                            title = line[2:].strip()
                            break
                    lines = content.split("\n")
                    context = ""
                    for i, line in enumerate(lines):
                        if query.lower() in line.lower():
                            start = max(0, i-2)
                            end = min(len(lines), i+3)
                            context = "\n".join(lines[start:end])
                            break
                    results.append({
                        "title": title,
                        "path": str(md_file.relative_to(VAULT_PATH)),
                        "content": context[:500],
                        "source": "raw"
                    })
                    if len(results) >= limit:
                        break
            except Exception as e:
                print(f"Error leyendo {md_file}: {e}")
                continue
    return results


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

def restart_agent_container():
    """Reinicia el contenedor del agente."""
    client = get_docker_client()
    if not client:
        try:
            result = subprocess.run(
                ["docker", "restart", "cerebro-agente"],
                capture_output=True,
                text=True,
                check=False
            )
            if result.returncode == 0:
                return True, "Agente reiniciado (via subprocess)."
            else:
                return False, f"Error: {result.stderr}"
        except Exception as e:
            return False, f"Error al reiniciar: {e}"
    try:
        container = client.containers.get("cerebro-agente")
        container.restart()
        return True, "Agente reiniciado correctamente."
    except Exception as e:
        return False, f"Error al reiniciar el agente: {e}"

def delete_agent_config_file():
    client = get_docker_client()
    if not client:
        try:
            result = subprocess.run(
                ["docker", "exec", "cerebro-agente", "rm", "-f", "/root/.hermes/config.yaml"],
                capture_output=True,
                text=True,
                check=False
            )
            if result.returncode == 0:
                return True, "Archivo de configuración eliminado."
            else:
                return False, f"Error: {result.stderr}"
        except Exception as e:
            return False, f"Error al eliminar config.yaml: {e}"
    try:
        container = client.containers.get("cerebro-agente")
        exec_result = container.exec_run(["rm", "-f", "/root/.hermes/config.yaml"])
        if exec_result.exit_code == 0:
            return True, "Archivo de configuración eliminado."
        else:
            return False, f"Error al eliminar archivo: {exec_result.output.decode()}"
    except Exception as e:
        return False, f"Error al eliminar config.yaml: {e}"

def stop_and_remove_agent():
    try:
        subprocess.run(["docker", "stop", "cerebro-agente"], capture_output=True, check=False)
        subprocess.run(["docker", "rm", "-f", "cerebro-agente"], capture_output=True, check=False)
        return True, "Agente detenido y eliminado."
    except Exception as e:
        return False, f"Error al eliminar agente: {e}"


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

@app.get("/api/projects")
async def list_projects():
    projects_path = Path(VAULT_PATH) / "projects"
    projects = []
    if projects_path.exists():
        for project_dir in projects_path.iterdir():
            if project_dir.is_dir():
                project_file = project_dir / "project.md"
                if project_file.exists():
                    with open(project_file, "r") as f:
                        content = f.read()
                    title = project_dir.name
                    for line in content.split("\n"):
                        if line.startswith("# "):
                            title = line[2:].strip()
                            break
                    projects.append({
                        "id": project_dir.name,
                        "title": title,
                        "path": str(project_dir.relative_to(VAULT_PATH))
                    })
    return {"projects": projects, "total": len(projects)}

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
    return {"success": True, "agent": "hermes", "message": "API key guardada correctamente"}

@app.delete("/api/agents/hermes/key")
async def delete_hermes_key():
    keys = get_agent_keys()
    if "hermes" in keys:
        del keys["hermes"]
        save_agent_keys(keys)
    return {"success": True, "agent": "hermes", "message": "API key eliminada"}


# ============================================
# ENDPOINT DE CHAT CON HERMES (IA REAL + RAG)
# ============================================

@app.post("/api/chat")
async def chat(message: dict):
    user_message = message.get("message", "")
    if not user_message:
        raise HTTPException(status_code=400, detail="Mensaje vacío")

    config = get_agent_config()
    agent_name = config.get("agentName", "Hermes") if config else "Hermes"
    personality = config.get("personality", "Eres un asistente útil y amigable.") if config else "Eres un asistente útil y amigable."

    search_results = search_vault(user_message)
    context_text = ""
    if search_results:
        context_text = "\n\n---\n**Información relevante encontrada en tu vault:**\n"
        for i, result in enumerate(search_results, 1):
            context_text += f"\n**{i}. {result['title']}**\n{result['content']}...\n"
        context_text += "\n---\n"

    api_key = get_agent_key("hermes")
    if not api_key:
        api_key = OPENROUTER_API_KEY

    if not api_key:
        return {
            "response": f"⚠️ **{agent_name} no tiene una API key configurada.**\n\nPor favor, ve a **Ajustes > Apis Agentes** y configura tu API key.",
            "context": {"error": "no_api_key"}
        }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "openai/gpt-4o-mini",
                    "messages": [
                        {
                            "role": "system",
                            "content": f"{personality} Te llamas {agent_name}. Usa la siguiente información del vault del usuario para responder con contexto, pero solo si es relevante."
                        },
                        {
                            "role": "user",
                            "content": f"{context_text}\n\nPregunta del usuario: {user_message}"
                        }
                    ]
                },
                timeout=30.0
            )

            if response.status_code == 200:
                data = response.json()
                ai_response = data.get("choices", [{}])[0].get("message", {}).get("content", "No se pudo generar respuesta.")
                return {
                    "response": ai_response,
                    "context": {
                        "model": "openai/gpt-4o-mini",
                        "vault_results": len(search_results),
                        "timestamp": datetime.now().isoformat()
                    }
                }
            else:
                error_detail = response.text
                return {
                    "response": f"❌ **Error al conectar con OpenRouter**\n\nCódigo: {response.status_code}\n\nDetalle: {error_detail[:200]}...",
                    "context": {"error": "api_error", "status_code": response.status_code}
                }

    except httpx.TimeoutException:
        return {
            "response": "⏰ **Tiempo de espera agotado.** La conexión con OpenRouter tardó demasiado. Intenta de nuevo.",
            "context": {"error": "timeout"}
        }
    except Exception as e:
        return {
            "response": f"❌ **Error inesperado:** {str(e)}",
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


# ============================================
# ENDPOINTS PARA HARDWARE Y MODELOS LOCALES
# ============================================

def _detect_hw_profile(cpu: str, ram_gb: int, gpu: str, vram_gb: int = 0) -> str:
    """Return 'low', 'medium', or 'high' based on user hardware specs."""
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


@app.post("/api/init/hardware")
async def detect_hardware(specs: dict):
    """Recibe specs de hardware del usuario y devuelve el perfil + modelos recomendados."""
    cpu = specs.get("cpu", "")
    ram = int(specs.get("ram_gb", 8))
    gpu = specs.get("gpu", "")
    vram = int(specs.get("vram_gb", 0))

    profile = _detect_hw_profile(cpu, ram, gpu, vram)
    models = MODEL_ASSIGNMENTS[profile]

    return {
        "profile": profile,
        "models": models,
        "all_models_to_install": sorted(set(models.values())),
        "specs_received": {"cpu": cpu, "ram_gb": ram, "gpu": gpu, "vram_gb": vram}
    }


@app.post("/api/init/install-models")
async def install_models(request: dict):
    """Lanza la instalación de modelos Ollama en el contenedor cerebro-ollama."""
    hw_profile = request.get("profile", "medium")
    client = get_docker_client()
    if not client:
        return {"success": False, "message": "No se pudo conectar con Docker"}

    try:
        # Verificar si el contenedor Ollama ya está corriendo
        try:
            ollama_container = client.containers.get("cerebro-ollama")
            ollama_container.reload()
            if ollama_container.status != "running":
                ollama_container.start()
        except docker.errors.NotFound:
            return {"success": False, "message": "El contenedor cerebro-ollama no existe. Reinicia el sistema."}

        # Ejecutar el script de instalación de modelos dentro del contenedor Ollama
        exec_result = ollama_container.exec_run(
            ["/bin/bash", "-c", f"bash /app/scripts/install_models.sh {hw_profile}"],
            stream=True
        )

        output_lines = []
        for chunk in exec_result.output:
            line = chunk.decode("utf-8", errors="replace")
            output_lines.append(line)
            print(line, end="")

        return {
            "success": True,
            "message": f"Modelos instalados (perfil: {hw_profile})",
            "output": "".join(output_lines)[-2000:]
        }
    except Exception as e:
        return {"success": False, "message": f"Error al instalar modelos: {e}"}


@app.post("/api/init/configure")
async def configure_agent(request: dict):
    """Endpoint ampliado: soporta modelMode (openrouter/local) y hardware specs."""
    try:
        print("🔵 Recibida petición:", request)
        agent_name = request.get("agentName", "").strip()
        personality = request.get("personality", "").strip()
        api_key = request.get("apiKey", "").strip()
        channels = request.get("channels", {})
        dashboard_user = request.get("dashboardUser", "").strip()
        dashboard_password = request.get("dashboardPassword", "").strip()
        model_mode = request.get("modelMode", "openrouter").strip()
        hardware = request.get("hardware", {})

        if not agent_name:
            agent_name = "Hermes"
        if not personality:
            personality = "Eres un asistente útil, amigable y profesional. Ayudas a organizar el conocimiento y responder preguntas de manera clara y concisa."

        # Si es modo OpenRouter, la API key es obligatoria
        if model_mode == "openrouter" and not api_key:
            raise HTTPException(status_code=400, detail="La API Key es obligatoria para OpenRouter")

        # Si es modo local, la API key puede estar vacía
        if model_mode == "local" and not api_key:
            api_key = ""

        config = {
            "agentName": agent_name,
            "personality": personality,
            "apiKey": api_key,
            "modelMode": model_mode,
            "hardware": hardware,
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
            "createdAt": datetime.now().isoformat(),
            "updatedAt": datetime.now().isoformat()
        }

        # Si hay hardware, calcular el perfil
        if hardware and model_mode == "local":
            profile = _detect_hw_profile(
                hardware.get("cpu", ""),
                int(hardware.get("ram_gb", 8)),
                hardware.get("gpu", ""),
                int(hardware.get("vram_gb", 0))
            )
            config["hwProfile"] = profile
            config["localModels"] = MODEL_ASSIGNMENTS[profile]

        save_agent_config(config)
        if api_key:
            set_agent_key("hermes", api_key)

        return {"success": True, "message": "Configuración guardada correctamente", "agentName": agent_name}
    except Exception as e:
        import traceback
        print("❌ ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")