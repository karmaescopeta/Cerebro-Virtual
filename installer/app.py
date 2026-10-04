#!/usr/bin/env python3
"""Cerebro Virtual — Installer. HTTP server + browser. No deps."""
import http.server, io, json, os, re, shutil, subprocess, sys, threading, urllib.parse, webbrowser, zipfile
from pathlib import Path

REPO_URL = "https://github.com/karmaescopeta/Cerebro-Virtual.git"

def _find_base() -> Path:
    """Raíz del proyecto: subir desde el exe buscando docker-compose.yml.
    ponytail: el exe puede vivir a cualquier profundidad dentro del repo clonado;
    fallback = legacy installer/dist/ (3 niveles arriba del exe)."""
    frozen = getattr(sys, "frozen", False)
    start = Path(sys.executable).resolve().parent if frozen else Path(__file__).resolve().parent.parent
    for p in [start, *start.parents][:8]:
        if (p / "docker-compose.yml").exists():
            return p
    return start.parents[2] if frozen else start

BASE_DIR = _find_base()

INSTANCES_DIR = BASE_DIR / "instances"
COMPOSE_FILE = BASE_DIR / "docker-compose.yml"
PORT_RANGES = {"FRONTEND_PORT": 5173, "BACKEND_PORT": 8000, "AGENT_PORT": 8080, "SEARXNG_PORT": 8888, "OMNIROUTE_PORT": 20128}

# En exe windowed (console=False), sin este flag cada hijo abre una ventana CMD visible
NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)
START_LOGS = {}  # name -> {"lines": [...], "done": bool, "ok": bool} — solo último inicio
LOG_LOCK = threading.Lock()


def run(cmd, timeout=600):
    try:
        # ponytail: errors="replace" — netstat/docker en Windows puede emitir bytes no-UTF8 (0xa2 CP850)
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, errors="replace", creationflags=NO_WINDOW)
        return r.returncode, r.stdout or "", r.stderr or ""
    except Exception as e:
        return -1, "", str(e)


def get_used_ports():
    used = set()
    if INSTANCES_DIR.exists():
        for d in INSTANCES_DIR.iterdir():
            env = d / ".env"
            if env.exists():
                for line in env.read_text(encoding="utf-8", errors="ignore").splitlines():
                    for key in PORT_RANGES:
                        if line.startswith(f"{key}="):
                            v = line.split("=", 1)[1].strip()
                            if v.isdigit(): used.add(int(v))
    rc, out, _ = run(["docker", "ps", "--format", "{{.Ports}}"], timeout=10)
    if rc == 0:
        for m in re.finditer(r":(\d+)->", out): used.add(int(m.group(1)))
    rc, out, _ = run(["netstat", "-an"], timeout=10)
    if rc == 0:
        for line in out.splitlines():
            if "LISTENING" in line:
                m = re.search(r":(\d+)\s", line)
                if m: used.add(int(m.group(1)))
    return used


def auto_ports():
    used = get_used_ports()
    result = {}
    for key, base in PORT_RANGES.items():
        port = base
        while port in used: port += 1
        result[key] = port
        used.add(port)
    return result


def valid_name(name):
    return bool(re.fullmatch(r"[A-Za-z0-9_-]+", name))


def read_env(name):
    """Read all key=val from instance .env into dict."""
    env = INSTANCES_DIR / name / ".env"
    vals = {}
    if env.exists():
        for line in env.read_text(encoding="utf-8", errors="ignore").splitlines():
            if "=" in line:
                k, v = line.split("=", 1)
                vals[k.strip()] = v.strip()
    return vals


def _to_mb(v):
    v = v.strip()
    for unit, mult in [("GiB", 1024), ("MiB", 1), ("KiB", 1/1024)]:
        if v.endswith(unit):
            return float(v[:-len(unit)]) * mult
    return 0


def _parse_size(v):
    # docker images Size: "1.463GB", "456MB", "123kB"
    v = v.strip()
    for unit, mult in [("TB", 1e12), ("GB", 1e9), ("MB", 1e6), ("kB", 1e3), ("B", 1)]:
        if v.endswith(unit):
            try: return float(v[:-len(unit)]) * mult
            except ValueError: return 0
    return 0


def _dir_size(path):
    total = 0
    for root, _, files in os.walk(path):
        for f in files:
            try: total += os.path.getsize(os.path.join(root, f))
            except OSError: pass
    return total


def list_instances():
    if not INSTANCES_DIR.exists(): return []
    result = []
    for d in sorted(INSTANCES_DIR.iterdir()):
        if not (d / ".env").exists(): continue
        vals = read_env(d.name)
        project = vals.get("COMPOSE_PROJECT_NAME", d.name)
        info = {"name": d.name, "project": project, "ports": {}, "status": "stopped"}
        for key in PORT_RANGES:
            info["ports"][key] = vals.get(key, "")
        rc, out, _ = run(["docker", "ps", "--filter", f"name={project}-", "--format", "{{.Names}}"], timeout=5)
        if out.strip(): info["status"] = "running"
        result.append(info)
    running = [i for i in result if i["status"] == "running"]
    if running:
        # ponytail: stats --no-stream de todos los contenedores en 1 llamada (~2s); refresco 5s lo aguanta
        rc, out, _ = run(["docker", "stats", "--no-stream", "--format", "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}"], timeout=20)
        agg = {}
        for line in out.splitlines():
            parts = line.split("|")
            if len(parts) != 3: continue
            name, cpu, mem = parts
            for i in running:
                if name.startswith(i["project"] + "-"):
                    a = agg.setdefault(i["name"], {"cpu": 0.0, "mb": 0.0})
                    try: a["cpu"] += float(cpu.strip().rstrip("%"))
                    except: pass
                    try: a["mb"] += _to_mb(mem.split("/")[0])
                    except: pass
        for i in result:
            a = agg.get(i["name"])
            if a: i["stats"] = f'{a["cpu"]:.0f}% CPU · {a["mb"]:.0f}MB RAM'
    # Tamaño en disco: carpeta de la instancia + imágenes docker del proyecto
    rc, out, _ = run(["docker", "images", "--format", "{{.Repository}}|{{.Size}}"], timeout=15)
    img = {}
    for line in out.splitlines():
        parts = line.split("|", 1)
        if len(parts) == 2: img[parts[0]] = parts[1]
    for i in result:
        total = _dir_size(INSTANCES_DIR / i["name"])
        for repo, size in img.items():
            if repo.startswith(i["project"] + "-"):
                total += _parse_size(size)
        i["size_gb"] = f"{total / (1024**3):.1f}GB"
    return result


def instance_create(name):
    inst = INSTANCES_DIR / name
    if inst.exists(): return {"error": "Ya existe"}
    for sub in ["vault/raw/.processed", "vault/wiki", "vault/outputs", "vault/system", "vault/chat-sesiones"]:
        (inst / sub).mkdir(parents=True, exist_ok=True)
    default_cfg = INSTANCES_DIR / "default" / "agent-config.yaml"
    if default_cfg.exists(): shutil.copy2(default_cfg, inst / "agent-config.yaml")
    ports = auto_ports()
    base_fwd = str(BASE_DIR).replace("\\", "/")
    (inst / ".env").write_text(
        f"COMPOSE_PROJECT_NAME={name}\nOPENROUTER_API_KEY=\n"
        f"BACKEND_PORT={ports['BACKEND_PORT']}\nFRONTEND_PORT={ports['FRONTEND_PORT']}\n"
        f"AGENT_PORT={ports['AGENT_PORT']}\nSEARXNG_PORT={ports['SEARXNG_PORT']}\n"
        f"OMNIROUTE_PORT={ports['OMNIROUTE_PORT']}\n"
        f"CLOUDFLARE_TUNNEL_TOKEN=\nVAULT_HOST_PATH={BASE_DIR}\\instances\\{name}\\vault\n"
        f"GITHUB_REPO=\nVAULT_DIR={base_fwd}/instances/{name}/vault\n"
        f"ENV_FILE={base_fwd}/instances/{name}/.env\nAGENT_CONFIG_DIR={base_fwd}/instances/{name}\n",
        encoding="utf-8")
    return {"success": True, "ports": ports}


def compose_cmd(name, *args):
    vals = read_env(name)
    project = vals.get("COMPOSE_PROJECT_NAME", name)
    base_fwd = str(BASE_DIR).replace("\\", "/")
    env_vars = {
        "VAULT_DIR": vals.get("VAULT_DIR", f"{base_fwd}/instances/{name}/vault"),
        "ENV_FILE": vals.get("ENV_FILE", f"{base_fwd}/instances/{name}/.env"),
        "AGENT_CONFIG_DIR": vals.get("AGENT_CONFIG_DIR", f"{base_fwd}/instances/{name}"),
    }
    full_env = {**os.environ, **env_vars}
    # ponytail: instancia vieja sin OMNIROUTE_PORT en .env → evita chocar con el stack principal (20128)
    if not vals.get("OMNIROUTE_PORT"): full_env["OMNIROUTE_PORT"] = "20129"
    token = vals.get("CLOUDFLARE_TUNNEL_TOKEN", "")
    profile = ["--profile", "tunnel"] if token else []
    cmd = ["docker", "compose", "-p", project, "-f", str(COMPOSE_FILE),
           "--env-file", str(INSTANCES_DIR / name / ".env")] + profile + list(args)
    return cmd, full_env


def instance_start(name):
    if not (INSTANCES_DIR / name / ".env").exists(): return {"error": "No existe"}
    if START_LOGS.get(name, {}).get("done") is False: return {"error": "Ya se está iniciando"}
    cmd, env = compose_cmd(name, "up", "-d", "--build")
    with LOG_LOCK:
        START_LOGS[name] = {"lines": [], "done": False, "ok": False}
    def worker():
        try:
            # ponytail: dict global + lock — un solo usuario local, sobra
            p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                 text=True, errors="replace", env=env, creationflags=NO_WINDOW)
            with LOG_LOCK:
                for line in p.stdout:
                    buf = START_LOGS.get(name)
                    if buf is None: break
                    buf["lines"] = (buf["lines"] + [line.rstrip()])[-200:]
                rc = p.wait()
                if name in START_LOGS:
                    START_LOGS[name].update(done=True, ok=rc == 0)
        except Exception as e:
            with LOG_LOCK:
                if name in START_LOGS:
                    buf = START_LOGS[name]
                    buf["lines"] = (buf["lines"] + [f"Error: {e}"])[-200:]
                    buf.update(done=True, ok=False)
    threading.Thread(target=worker, daemon=True).start()
    return {"success": True}


def instance_stop(name):
    if not (INSTANCES_DIR / name / ".env").exists(): return {"error": "No existe"}
    cmd, env = compose_cmd(name, "stop")
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=60, env=env, creationflags=NO_WINDOW)
    if r.returncode != 0: return {"error": r.stderr or r.stdout}
    return {"success": True}


def instance_remove(name):
    if not (INSTANCES_DIR / name / ".env").exists(): return {"error": "No existe"}
    cmd, env = compose_cmd(name, "down", "--rmi", "local")
    subprocess.run(cmd, capture_output=True, text=True, timeout=60, env=env, creationflags=NO_WINDOW)
    inst = INSTANCES_DIR / name
    if inst.exists(): shutil.rmtree(inst, ignore_errors=True)
    return {"success": True}


def _ram_gb():
    try:
        import ctypes
        class MSE(ctypes.Structure):
            _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                        ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                        ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                        ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                        ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
        m = MSE(); m.dwLength = ctypes.sizeof(MSE)
        ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
        return m.ullTotalPhys / (1024**3)
    except Exception:
        return 0


def check_requirements():
    general, per = [], []
    rc, out, _ = run(["docker", "--version"], timeout=5)
    general.append({"name": "Docker Desktop", "ok": rc == 0, "version": out.strip(), "url": "https://docs.docker.com/desktop/install/windows-install/"})
    docker_up = False
    if rc == 0:
        rc2, _, _ = run(["docker", "info"], timeout=10)
        docker_up = rc2 == 0
        general.append({"name": "Docker corriendo", "ok": rc2 == 0, "version": "", "url": ""})
    rc, out, _ = run(["git", "--version"], timeout=5)
    general.append({"name": "Git", "ok": rc == 0, "version": out.strip(), "url": "https://git-scm.com/download/win"})
    rc, out, _ = run(["python", "--version"], timeout=5)
    if rc != 0: rc, out, _ = run(["py", "--version"], timeout=5)
    general.append({"name": "Python", "ok": rc == 0, "version": out.strip().replace("Python ", ""), "url": "https://www.python.org/downloads/"})
    ram = _ram_gb()
    general.append({"name": "RAM (8GB)", "ok": ram >= 8 or ram == 0, "version": f"{ram:.1f}GB" if ram else "", "url": ""})
    try:
        gb = shutil.disk_usage(BASE_DIR).free / (1024**3)
        general.append({"name": "Espacio disco (5GB)", "ok": gb >= 5, "version": f"{gb:.1f}GB libres", "url": ""})
        per.append({"name": "Espacio (1GB)", "ok": gb >= 1, "version": f"{gb:.1f}GB libres", "url": ""})
    except: pass
    if docker_up:
        rc, out, _ = run(["docker", "images", "--format", "{{.Repository}}"], timeout=10)
        have = {"searxng/searxng", "ollama/ollama", "diegosouzapw/omniroute"} & set(out.split())
        per.append({"name": "Imágenes base", "ok": len(have) == 3,
                    "version": "ya descargadas" if len(have) == 3 else "se descargan (~3GB) en el primer inicio", "url": ""})
    return {"general": general, "por_cerebro": per}


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _json(self, data, code=200):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def _html(self, content):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", len(content))
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            p = Path(sys._MEIPASS) / "index.html" if getattr(sys, "frozen", False) else Path(__file__).parent / "index.html"
            self._html(p.read_bytes()); return
        if self.path == "/api/requirements": self._json(check_requirements()); return
        if self.path == "/api/instances": self._json({"instances": list_instances()}); return
        if self.path.startswith("/api/logs/"):
            name = urllib.parse.unquote(self.path.split("/api/logs/")[1])
            if not valid_name(name): self._json({"error": "Nombre inválido"}, 400); return
            with LOG_LOCK:
                buf = START_LOGS.get(name) or {"lines": [], "done": True, "ok": False}
            self._json({"lines": buf["lines"], "done": buf["done"], "ok": buf["ok"]}); return
        if self.path.startswith("/api/download/"):
            name = urllib.parse.unquote(self.path.split("/api/download/")[1])
            if not valid_name(name): self._json({"error": "Nombre inválido"}, 400); return
            vault = INSTANCES_DIR / name / "vault"
            if not vault.is_dir(): self._json({"error": "No existe"}, 404); return
            bio = io.BytesIO()
            with zipfile.ZipFile(bio, "w", zipfile.ZIP_DEFLATED) as z:
                for f in vault.rglob("*"):
                    if f.is_file(): z.write(f, f.relative_to(vault.parent))
            data = bio.getvalue()
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Disposition", f'attachment; filename="{name}-vault.zip"')
            self.send_header("Content-Length", len(data))
            self.end_headers()
            self.wfile.write(data); return
        self.send_error(404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        if self.path == "/api/create":
            name = body.get("name", "").strip()
            if not name: self._json({"error": "nombre vacío"}, 400); return
            if not re.fullmatch(r"[A-Za-z0-9_-]+", name):
                self._json({"error": "Solo letras, números, guiones y guiones bajos"}, 400); return
            self._json(instance_create(name)); return
        if self.path.startswith("/api/start/"):
            name = urllib.parse.unquote(self.path.split("/api/start/")[1])
            if not valid_name(name): self._json({"error": "Nombre inválido"}, 400); return
            self._json(instance_start(name)); return
        if self.path.startswith("/api/stop/"):
            name = urllib.parse.unquote(self.path.split("/api/stop/")[1])
            if not valid_name(name): self._json({"error": "Nombre inválido"}, 400); return
            self._json(instance_stop(name)); return
        if self.path.startswith("/api/remove/"):
            name = urllib.parse.unquote(self.path.split("/api/remove/")[1])
            if not valid_name(name): self._json({"error": "Nombre inválido"}, 400); return
            self._json(instance_remove(name)); return
        self.send_error(404)


def main():
    import socket
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    threading.Thread(target=lambda: webbrowser.open(f"http://127.0.0.1:{port}"), daemon=True).start()
    server.serve_forever()

if __name__ == "__main__":
    main()
