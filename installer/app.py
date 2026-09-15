#!/usr/bin/env python3
"""Cerebro Virtual — Installer. HTTP server + browser. No deps."""
import http.server, json, os, re, shutil, subprocess, sys, threading, urllib.parse, webbrowser
from pathlib import Path

REPO_URL = "https://github.com/karmaescopeta/Cerebro-Virtual.git"

# ponytail: .exe lives in installer/dist/ → up 3 levels to project root
if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys.executable).resolve().parent.parent.parent
else:
    BASE_DIR = Path(__file__).resolve().parent.parent

INSTANCES_DIR = BASE_DIR / "instances"
COMPOSE_FILE = BASE_DIR / "docker-compose.yml"
PORT_RANGES = {"FRONTEND_PORT": 5173, "BACKEND_PORT": 8000, "AGENT_PORT": 8080, "SEARXNG_PORT": 8888}


def run(cmd, timeout=600):
    try:
        # ponytail: errors="replace" — netstat/docker en Windows puede emitir bytes no-UTF8 (0xa2 CP850)
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, errors="replace")
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
    token = vals.get("CLOUDFLARE_TUNNEL_TOKEN", "")
    profile = ["--profile", "tunnel"] if token else []
    cmd = ["docker", "compose", "-p", project, "-f", str(COMPOSE_FILE),
           "--env-file", str(INSTANCES_DIR / name / ".env")] + profile + list(args)
    return cmd, full_env


def instance_start(name):
    if not (INSTANCES_DIR / name / ".env").exists(): return {"error": "No existe"}
    cmd, env = compose_cmd(name, "up", "-d", "--build")
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=600, env=env)
    if r.returncode != 0: return {"error": r.stderr or r.stdout}
    return {"success": True}


def instance_stop(name):
    if not (INSTANCES_DIR / name / ".env").exists(): return {"error": "No existe"}
    cmd, env = compose_cmd(name, "stop")
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=60, env=env)
    if r.returncode != 0: return {"error": r.stderr or r.stdout}
    return {"success": True}


def instance_remove(name):
    if not (INSTANCES_DIR / name / ".env").exists(): return {"error": "No existe"}
    cmd, env = compose_cmd(name, "down", "--rmi", "local")
    subprocess.run(cmd, capture_output=True, text=True, timeout=60, env=env)
    inst = INSTANCES_DIR / name
    if inst.exists(): shutil.rmtree(inst, ignore_errors=True)
    return {"success": True}


def check_requirements():
    checks = []
    rc, out, _ = run(["docker", "--version"], timeout=5)
    checks.append({"name": "Docker Desktop", "ok": rc == 0, "version": out.strip(), "url": "https://docs.docker.com/desktop/install/windows-install/"})
    if rc == 0:
        rc2, _, _ = run(["docker", "info"], timeout=10)
        checks.append({"name": "Docker corriendo", "ok": rc2 == 0, "version": "", "url": ""})
    rc, out, _ = run(["git", "--version"], timeout=5)
    checks.append({"name": "Git", "ok": rc == 0, "version": out.strip(), "url": "https://git-scm.com/download/win"})
    try:
        usage = shutil.disk_usage(BASE_DIR)
        gb = usage.free / (1024**3)
        checks.append({"name": "Espacio disco (5GB)", "ok": gb >= 5, "version": f"{gb:.1f}GB libres", "url": ""})
    except: pass
    return checks


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
        if self.path == "/api/requirements": self._json({"checks": check_requirements()}); return
        if self.path == "/api/instances": self._json({"instances": list_instances()}); return
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
            self._json(instance_start(urllib.parse.unquote(self.path.split("/api/start/")[1]))); return
        if self.path.startswith("/api/stop/"):
            self._json(instance_stop(urllib.parse.unquote(self.path.split("/api/stop/")[1]))); return
        if self.path.startswith("/api/remove/"):
            self._json(instance_remove(urllib.parse.unquote(self.path.split("/api/remove/")[1]))); return
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
