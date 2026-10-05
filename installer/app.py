#!/usr/bin/env python3
"""Cerebro Virtual — Installer. HTTP server + browser. No deps."""
import http.server, io, json, os, re, shutil, subprocess, sys, threading, time, urllib.parse, urllib.request, webbrowser, zipfile
from pathlib import Path

REPO_ZIP_URL = "https://codeload.github.com/karmaescopeta/Cerebro-Virtual/zip/refs/heads/main"
GESTOR_VERSION = "1.4.0"
RELEASES_API = "https://api.github.com/repos/karmaescopeta/Cerebro-Virtual/releases/latest"

IS_WIN = os.name == "nt"
# v1.4: enlaces directos de descarga + paquetes para el botón instalar-todo
_DL_URLS = {
    "docker": "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" if IS_WIN else "https://docs.docker.com/engine/install/",
    "git": "https://git-scm.com/download/win" if IS_WIN else "https://git-scm.com/download/linux",
    "python": "https://www.python.org/downloads/",
}
_WINGET_PKGS = {"docker": "Docker.DockerDesktop", "git": "Git.Git", "python": "Python.Python.3.12"}
_APT_PKGS = {"docker": "docker.io", "git": "git", "python": "python3"}


def _config_file() -> Path:
    # v1.4: gestor.json junto al exe recuerda la carpeta de instalación elegida (sobrevive a updates del exe)
    return (Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent) / "gestor.json"


def _find_base() -> Path:
    """Raíz del proyecto: primero la carpeta elegida por el usuario (gestor.json),
    luego buscar docker-compose.yml alrededor del exe.
    ponytail: funciona incrustado en el repo (hacia arriba) o standalone
    (proyecto descargado como hijo del exe); fallback = legacy installer/dist/."""
    try:
        saved = json.loads(_config_file().read_text(encoding="utf-8")).get("base", "")
        if saved and (Path(saved) / "docker-compose.yml").exists():
            return Path(saved)
    except Exception:
        pass
    frozen = getattr(sys, "frozen", False)
    start = Path(sys.executable).resolve().parent if frozen else Path(__file__).resolve().parent.parent
    for child in ("gestor_de_cerebros", "cerebro_virtual", "Cerebro-Virtual-main", "Cerebro-Virtual"):  # instalación de un solo archivo
        if (start / child / "docker-compose.yml").exists():
            return start / child
    for p in [start, *start.parents][:8]:
        if (p / "docker-compose.yml").exists():
            return p
    return start.parents[2] if frozen else start

BASE_DIR = _find_base()

# v1.4: los cerebros viven DIRECTO en la carpeta general: gestor_de_cerebros\<cerebro>\
INSTANCES_DIR = BASE_DIR
COMPOSE_FILE = BASE_DIR / "docker-compose.yml"


def _refresh_base():
    """Recalcular la raíz tras descargar el proyecto (POST /api/download-project)."""
    global BASE_DIR, INSTANCES_DIR, COMPOSE_FILE
    BASE_DIR = _find_base()
    INSTANCES_DIR = BASE_DIR
    COMPOSE_FILE = BASE_DIR / "docker-compose.yml"
    _migrate_old()


def _migrate_old():
    """v1.4: instalaciones viejas traían los cerebros en instances\\<name> — subirlos un
    nivel a la raíz (gestor_de_cerebros\\<name>). Silencioso y un solo uso por carpeta."""
    old = BASE_DIR / "instances"
    if not old.is_dir():
        return
    try:
        for d in list(old.iterdir()):
            if (d / ".env").exists() and not (BASE_DIR / d.name).exists():
                shutil.move(str(d), str(BASE_DIR / d.name))
    except Exception:
        pass


PORT_RANGES = {"FRONTEND_PORT": 5173, "BACKEND_PORT": 8000, "AGENT_PORT": 8080, "SEARXNG_PORT": 8888, "OMNIROUTE_PORT": 20128}

if COMPOSE_FILE.exists():
    _migrate_old()  # al arrancar también (no solo tras descargar)

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
            if "LISTENING" in line or "LISTEN" in line:  # LISTENING (Windows) / LISTEN (Linux)
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
        # v1.3: VAULT_HOST_PATH con / — igual que VAULT_DIR; Docker/Windows acepta ambas, Linux necesita /
        # v1.4: cerebro directo en la raíz (gestor_de_cerebros\<name>), sin instances\
        f"CLOUDFLARE_TUNNEL_TOKEN=\nVAULT_HOST_PATH={base_fwd}/{name}/vault\n"
        f"GITHUB_REPO=\nVAULT_DIR={base_fwd}/{name}/vault\n"
        f"ENV_FILE={base_fwd}/{name}/.env\nAGENT_CONFIG_DIR={base_fwd}/{name}\n",
        encoding="utf-8")
    return {"success": True, "ports": ports}


def download_project(dest_str=""):
    """Instalación de un solo archivo: descarga el repo en zip y lo descomprime.
    v1.4: dest_str = carpeta elegida por el usuario (vacía = junto al exe); sistema,
    cerebros y vaults viven todos dentro de esa carpeta. Se recuerda en gestor.json.
    Progreso en START_LOGS['setup'] (mismo mecanismo de polling que el arranque)."""
    if COMPOSE_FILE.exists():
        return {"error": "El proyecto ya está descargado"}
    target = Path(dest_str.strip()) if (dest_str or "").strip() else None
    if target is not None:
        if not target.is_absolute():
            return {"error": "La ruta debe ser absoluta (ej: D:\\cerebros)"}
        try:
            target.mkdir(parents=True, exist_ok=True)  # valida permisos ahora, no en el thread
        except Exception as e:
            return {"error": f"No puedo escribir en {target}: {e}"}
    if START_LOGS.get("setup", {}).get("done") is False:
        return {"error": "Ya se está descargando"}
    with LOG_LOCK:
        START_LOGS["setup"] = {"lines": [], "done": False, "ok": False}

    def worker():
        lines, ok = [], False
        try:
            dest = target or (Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else BASE_DIR)
            req = urllib.request.Request(REPO_ZIP_URL, headers={"User-Agent": "GestorDeCerebros"})
            with urllib.request.urlopen(req, timeout=60) as r:
                total = int(r.headers.get("Content-Length") or 0)
                got, last = 0, -1
                buf = io.BytesIO()
                while True:
                    chunk = r.read(65536)
                    if not chunk:
                        break
                    buf.write(chunk)
                    got += len(chunk)
                    pct = got * 100 // total if total else -1
                    if pct >= last + 10:
                        last = pct
                        lines.append(f"Descargando... {pct}% ({got // 1048576} MB)")
            zpath = dest / "cerebro-virtual.zip"
            zpath.write_bytes(buf.getvalue())
            lines.append("Descomprimiendo...")
            with zipfile.ZipFile(zpath) as z:
                # ponytail: zip-slip guard — descarga por HTTPS de nuestro repo, pero el guard es 1 línea
                if any(m.filename.startswith(("..", "/", "\\")) for m in z.infolist()):
                    raise RuntimeError("zip con rutas inseguras")
                z.extractall(dest)
            # v1.4: carpeta general con el nombre del sistema — el zip trae "Cerebro-Virtual-main"
            extracted = next((d for d in dest.iterdir() if d.is_dir() and (d / "docker-compose.yml").exists()), None)
            if extracted and extracted.name != "gestor_de_cerebros":
                renamed = dest / "gestor_de_cerebros"
                if not renamed.exists():
                    extracted.rename(renamed)
            zpath.unlink()
            # v1.4: persistir la carpeta elegida ANTES de _refresh_base — _find_base solo mira
            # hijos/padres del exe, así que sin gestor.json un proyecto en otro disco quedaría huérfano
            if target is not None:
                final = next((d for d in dest.iterdir() if d.is_dir() and (d / "docker-compose.yml").exists()), None)
                if final:
                    _config_file().write_text(json.dumps({"base": str(final)}), encoding="utf-8")
            _refresh_base()
            ok = COMPOSE_FILE.exists()
            lines.append(f"Proyecto listo en: {BASE_DIR}" if ok else "Error: proyecto no encontrado tras descomprimir")
        except Exception as e:
            lines.append(f"Error: {e}")
        with LOG_LOCK:
            b = START_LOGS.get("setup")
            if b is not None:
                b["lines"] = (b["lines"] + lines)[-200:]
                b.update(done=True, ok=ok)

    threading.Thread(target=worker, daemon=True).start()
    return {"success": True}


def install_deps():
    """v1.4: botón 'Instalar dependencias' — instala de golpe lo que falte (docker/git/python):
    winget en Windows (salta el UAC, el usuario acepta), apt+sudo en Linux (contraseña en la terminal).
    Si winget no existe, abre las páginas de descarga. Progreso en START_LOGS['deps']."""
    if START_LOGS.get("deps", {}).get("done") is False:
        return {"error": "Ya se está instalando"}
    with LOG_LOCK:
        START_LOGS["deps"] = {"lines": [], "done": False, "ok": False}

    def worker():
        lines, ok = [], True
        try:
            _refresh_path()
            probes = {"docker": ("docker", _KNOWN["docker"]),
                      "git": ("git", _KNOWN["git"]),
                      "python": ("python", _KNOWN["python"])}
            missing = [k for k in ("docker", "git", "python") if not _probe(*probes[k])[0]]
            if missing:
                lines.append(f"No detectado: {', '.join(missing)}")
            if not missing:
                lines.append("Todo ya está instalado — nada que hacer")
            elif IS_WIN:
                rc, _, _ = run(["winget", "--version"], timeout=15)
                if rc != 0:
                    lines.append("winget no disponible — abriendo páginas de descarga")
                    for k in missing:
                        webbrowser.open(_DL_URLS[k])
                else:
                    for k in missing:
                        lines.append(f"Instalando {_WINGET_PKGS[k]} — acepta el aviso de Windows si aparece")
                        p = subprocess.Popen(["winget", "install", "-e", "--id", _WINGET_PKGS[k], "--silent",
                                              "--accept-source-agreements", "--accept-package-agreements"],
                                             stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                             text=True, errors="replace", creationflags=NO_WINDOW)
                        for ln in p.stdout:
                            lines.append(ln.rstrip())
                        if p.wait() != 0:
                            ok = False
                            lines.append(f"Fallo instalando {k} — instala a mano: {_DL_URLS[k]}")
                    if "docker" in missing:
                        dd = Path(r"C:\Program Files\Docker\Docker\Docker Desktop.exe")
                        if dd.exists():
                            subprocess.Popen([str(dd)], creationflags=NO_WINDOW)
                            lines.append("Arrancando Docker Desktop — acepta sus términos la primera vez")
            else:
                pkgs = [_APT_PKGS[k] for k in missing]
                lines.append(f"sudo apt-get install -y {' '.join(pkgs)}")
                # ponytail: sudo pide la contraseña por /dev/tty — el binario debe lanzarse desde terminal
                p = subprocess.Popen(["sudo", "apt-get", "install", "-y", *pkgs],
                                     stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                     text=True, errors="replace")
                for ln in p.stdout:
                    lines.append(ln.rstrip())
                if p.wait() != 0:
                    ok = False
                    lines.append("apt falló — ¿contraseña sudo? Ejecuta el comando de arriba en una terminal")
                else:
                    lines.append("Consejo: añade tu usuario al grupo docker (sudo usermod -aG docker $USER) y reinicia sesión")
        except Exception as e:
            ok = False
            lines.append(f"Error: {e}")
        with LOG_LOCK:
            b = START_LOGS.get("deps")
            if b is not None:
                b["lines"] = (b["lines"] + lines)[-200:]
                b.update(done=True, ok=ok)

    threading.Thread(target=worker, daemon=True).start()
    return {"success": True}


def _rewrite_envs():
    """v1.4: si el usuario MOVIÓ la carpeta del sistema y la reasigna, los .env siguen con
    rutas absolutas viejas (VAULT_DIR, ENV_FILE...). Regenerarlas hacia la base actual."""
    if not INSTANCES_DIR.exists():
        return
    base_fwd = str(BASE_DIR).replace("\\", "/")
    for d in INSTANCES_DIR.iterdir():
        env = d / ".env"
        if not env.exists() or not d.is_dir():
            continue
        if read_env_path(env).get("VAULT_DIR") == f"{base_fwd}/{d.name}/vault":
            continue  # ya apunta aquí
        keep = [ln for ln in env.read_text(encoding="utf-8", errors="ignore").splitlines()
                if not ln.startswith(("VAULT_HOST_PATH=", "VAULT_DIR=", "ENV_FILE=", "AGENT_CONFIG_DIR="))]
        keep += [f"VAULT_HOST_PATH={base_fwd}/{d.name}/vault",
                 f"VAULT_DIR={base_fwd}/{d.name}/vault",
                 f"ENV_FILE={base_fwd}/{d.name}/.env",
                 f"AGENT_CONFIG_DIR={base_fwd}/{d.name}"]
        env.write_text("\n".join(keep) + "\n", encoding="utf-8")


def set_base(path_str):
    """v1.4: apuntar el gestor a un sistema YA instalado — un exe nuevo en otra carpeta
    no lo encuentra solo. Vale para el proyecto directamente o la raíz que lo contiene."""
    p = Path((path_str or "").strip())
    if not str(p) or not p.is_absolute():
        return {"error": "La ruta debe ser absoluta (ej: D:\\Gestor de Cerebros)"}
    if not p.is_dir():
        return {"error": f"La carpeta no existe: {p}"}
    base = p if (p / "docker-compose.yml").exists() else next(
        (c for c in p.iterdir() if c.is_dir() and (c / "docker-compose.yml").exists()), None)
    if base is None:
        return {"error": f"No encuentro el sistema en {p} (docker-compose.yml ni ahí ni un nivel abajo)"}
    try:
        _config_file().write_text(json.dumps({"base": str(base)}), encoding="utf-8")
    except Exception as e:
        return {"error": f"No puedo guardar el ajuste: {e}"}
    _refresh_base()
    _rewrite_envs()
    return {"success": True, "base": str(BASE_DIR), "instances": len(list_instances())}


def _inst_dir(base, name):
    """Carpeta de un cerebro en una base cualquiera — layout nuevo (base\\name) o viejo (base\\instances\\name)."""
    b = Path(base)
    for cand in (b / name, b / "instances" / name):
        if (cand / ".env").exists():
            return cand
    return None


def find_other_cerebros():
    """v1.4: cerebros instalados en OTRAS carpetas del equipo. Docker sabe dónde vive cada
    stack (docker compose ls) — sin escanear discos. Los de la base actual se excluyen."""
    rc, out, _ = run(["docker", "compose", "ls", "--all", "--format", "json"], timeout=15)
    result = {}
    if rc == 0:
        try:
            for p in json.loads(out):
                cfg = (p.get("ConfigFiles") or "").split(",")[0].strip()
                name = (p.get("Name") or "").strip()
                if not cfg or not name:
                    continue
                base = Path(cfg).resolve().parent
                if base == Path(BASE_DIR).resolve():
                    continue
                if _inst_dir(base, name) is None:
                    continue  # stack ajeno (no es un cerebro nuestro)
                g = result.setdefault(str(base), {"base": str(base), "cerebros": []})
                g["cerebros"].append({"name": name, "encendido": "running" in (p.get("Status") or "")})
        except Exception:
            pass
    return list(result.values())


def move_cerebros(items):
    """v1.4: mover cerebros encontrados en otras carpetas a la carpeta central.
    Los para (aviso previo al usuario), muda la carpeta completa de cada uno
    (vault + ajustes) y regenera los .env. Log en START_LOGS['move']."""
    if START_LOGS.get("move", {}).get("done") is False:
        return {"error": "Ya se está moviendo"}
    clean = [{"base": str(Path(i["base"]).resolve()), "name": i["name"]}
             for i in (items or []) if valid_name(i.get("name", ""))]
    if not clean:
        return {"error": "Nada que mover"}
    for i in clean:
        if _inst_dir(i["base"], i["name"]) is None:
            return {"error": f"No encuentro {i['name']} en {i['base']}"}
        if (INSTANCES_DIR / i["name"]).exists():
            return {"error": f"Ya existe un cerebro llamado {i['name']} aquí — renómbralo o bórralo antes"}
    with LOG_LOCK:
        START_LOGS["move"] = {"lines": [], "done": False, "ok": False}

    def worker():
        lines, ok = [], True
        try:
            for i in clean:
                src = _inst_dir(i["base"], i["name"])
                lines.append(f"Moviendo {i['name']} (desde {i['base']})...")
                project = read_env_path(src / ".env").get("COMPOSE_PROJECT_NAME", i["name"])
                run(["docker", "compose", "-p", project, "-f", str(Path(i["base"]) / "docker-compose.yml"),
                     "--env-file", str(src / ".env"), "stop"], timeout=120)
                shutil.move(str(src), str(INSTANCES_DIR / i["name"]))
                lines.append(f"{i['name']} mudado")
            _rewrite_envs()
            lines.append(f"Listo: {len(clean)} cerebro(s) ahora viven en {INSTANCES_DIR}")
        except Exception as e:
            ok = False
            lines.append(f"Error: {e}")
        with LOG_LOCK:
            b = START_LOGS.get("move")
            if b is not None:
                b["lines"] = (b["lines"] + lines)[-200:]
                b.update(done=True, ok=ok)

    threading.Thread(target=worker, daemon=True).start()
    return {"success": True}


def pick_folder():
    """v1.4: selector de carpeta NATIVO del sistema (el explorador de Windows/Linux de verdad,
    con buscar y crear carpeta). Bloquea hasta que el usuario elige o cancela."""
    if IS_WIN:
        ps = ("[Console]::OutputEncoding=[Text.Encoding]::UTF8; "
              "Add-Type -AssemblyName System.Windows.Forms; "
              "$f = New-Object System.Windows.Forms.FolderBrowserDialog; "
              "$f.Description = 'Elige la carpeta del sistema'; "
              "$f.ShowNewFolderButton = $true; "
              "if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }")
        rc, out, _ = run(["powershell", "-NoProfile", "-STA", "-Command", ps], timeout=900)
        path = out.strip() if rc == 0 else ""
        return {"path": path or None}
    rc, out, _ = run(["zenity", "--file-selection", "--directory", "--title", "Elige la carpeta del sistema"], timeout=900)
    if rc == 0:
        return {"path": out.strip() or None}
    return {"error": "No hay selector de carpetas en este equipo — usa el explorador de la ventana"}


def relocate(dest_str):
    """v1.4: mudar TODO el sistema (la carpeta gestor_de_cerebros con todos los cerebros) a otra
    carpeta/disco. Para los cerebros encendidos, mueve todo y vuelve a encenderlos. Log en START_LOGS['relocate']."""
    if not COMPOSE_FILE.exists():
        return {"error": "No hay sistema instalado"}
    if START_LOGS.get("relocate", {}).get("done") is False:
        return {"error": "Ya se está mudando"}
    dest = Path((dest_str or "").strip())
    if not str(dest) or not dest.is_absolute():
        return {"error": "Carpeta no válida"}
    target = dest  # v1.4.1: la carpeta elegida ES la nueva carpeta del sistema (gestor_de_cerebros con todo dentro)
    if target.resolve() == Path(BASE_DIR).resolve():
        return {"error": "El sistema ya está en esa carpeta"}
    if str(target) == str(target.anchor):
        return {"error": "Elige (o crea) una carpeta concreta, no la raíz del disco"}
    if (target / "docker-compose.yml").exists():
        return {"error": f"En {target} ya hay un sistema instalado — elige otra carpeta"}
    try:
        base_names = {p.name for p in Path(BASE_DIR).iterdir()}
        if target.exists():
            clash = base_names & {p.name for p in target.iterdir()}
            if clash:
                return {"error": f"En {target} ya existe: {', '.join(sorted(clash)[:5])} — elige una carpeta vacía o con otro nombre"}
    except OSError as e:
        return {"error": f"No puedo revisar {target}: {e}"}
    try:
        exe = Path(sys.executable).resolve()
        if exe == Path(BASE_DIR).resolve() or exe.is_relative_to(Path(BASE_DIR).resolve()):
            return {"error": "El gestor no puede vivir DENTRO de la carpeta del sistema — saca el exe fuera primero"}
    except Exception:
        pass
    with LOG_LOCK:
        START_LOGS["relocate"] = {"lines": [], "done": False, "ok": False}

    def worker():
        lines, ok = [], False
        try:
            running = [i["name"] for i in list_instances() if i["status"] == "running"]
            if running:
                lines.append(f"Apagando cerebros encendidos ({', '.join(running)})...")
                for name in running:
                    cmd, env = compose_cmd(name, "stop")
                    run(cmd, timeout=120)
            lines.append(f"Mudando todo el sistema a {target} (puede tardar si hay muchos archivos)...")
            # ponytail: mover entrada a entrada (no shutil.move del árbol) — target puede existir
            # y shutil.move(dir, dir_existente) metería el sistema un nivel más abajo
            target.mkdir(parents=True, exist_ok=True)
            for item in Path(BASE_DIR).iterdir():
                shutil.move(str(item), str(target / item.name))
            try:
                Path(BASE_DIR).rmdir()  # cosmético — si algo la deja ocupada, no debe romper el registro
            except OSError:
                lines.append(f"Nota: no pude borrar la carpeta vieja vacía ({BASE_DIR}) — bórrala tú si quieres")
            _config_file().write_text(json.dumps({"base": str(target)}), encoding="utf-8")
            _refresh_base()
            _rewrite_envs()
            ok = COMPOSE_FILE.exists()
            lines.append(f"Sistema listo en: {BASE_DIR}")
            if ok and running:
                lines.append(f"Volviendo a encender: {', '.join(running)}...")
                for name in running:
                    instance_start(name)
        except Exception as e:
            lines.append(f"Error: {e}")
            if not ok:
                lines.append(f"Si algo quedó a medias, lo que ya se movió está en {target} — no borres nada")
        with LOG_LOCK:
            b = START_LOGS.get("relocate")
            if b is not None:
                b["lines"] = (b["lines"] + lines)[-200:]
                b.update(done=True, ok=ok)

    threading.Thread(target=worker, daemon=True).start()
    return {"success": True}


def read_env_path(env_file):
    """Leer key=val de un .env por ruta (read_env es relativo a INSTANCES_DIR)."""
    vals = {}
    if Path(env_file).exists():
        for line in Path(env_file).read_text(encoding="utf-8", errors="ignore").splitlines():
            if "=" in line:
                k, v = line.split("=", 1)
                vals[k.strip()] = v.strip()
    return vals


def browse(path=""):
    """v1.4: explorador de carpetas para elegir la ruta con clics (sin teclear rutas).
    Sin path → discos (Windows) o / (Linux). Solo carpetas, nunca ficheros."""
    p = (path or "").strip()
    if not p:
        if IS_WIN:
            import string
            drives = []
            for letter in string.ascii_uppercase:
                d = f"{letter}:\\"
                if Path(d).exists():
                    drives.append(d)
            return {"path": "", "dirs": drives}
        p = "/"
    d = Path(p)
    if not d.is_dir():
        return {"error": f"No puedo abrir {p}"}
    dirs = []
    try:
        for c in sorted(d.iterdir(), key=lambda x: x.name.lower()):
            if not c.is_dir():
                continue
            n = c.name
            if n.startswith(".") or n in ("$RECYCLE.BIN", "System Volume Information", "$WinREAgent"):
                continue
            dirs.append(n)
    except PermissionError:
        return {"error": f"Sin permiso para abrir {p}"}
    parent = str(d.parent) if str(d.parent) != str(d) else ""
    return {"path": str(d), "parent": parent, "dirs": dirs}


def make_dir(path):
    """v1.4: botón 'Nueva carpeta' del explorador."""
    try:
        p = Path((path or "").strip())
        if not str(p) or not p.is_absolute():
            return {"error": "Elige una carpeta válida primero"}
        p.mkdir(parents=True, exist_ok=True)
        return {"success": True, "path": str(p)}
    except Exception as e:
        return {"error": f"No puedo crear la carpeta: {e}"}


def tidy_root():
    """v1.4: organizar un cerebro volcado a mano en la raíz del sistema (layout legado:
    el stack corría en la raíz con .env+vault ahí, sin carpeta con su nombre). Lo envuelve
    en <nombre>/ y regenera las rutas. Solo con confirmación explícita del usuario."""
    envf = BASE_DIR / ".env"
    if not (envf.exists() and (BASE_DIR / "vault").is_dir()):
        return {"error": "No veo archivos sueltos de cerebro en la carpeta del sistema"}
    project = read_env_path(envf).get("COMPOSE_PROJECT_NAME") or "cerebro"
    target = BASE_DIR / project
    if target.exists():
        return {"error": f"Ya existe una carpeta llamada {project} — revisa a mano"}
    try:
        target.mkdir()
        for item in (".env", "vault", "agent-config.yaml", "agent-config.json"):
            p = BASE_DIR / item
            if p.exists():
                shutil.move(str(p), str(target / item))
    except Exception as e:
        return {"error": f"No pude mover: {e}"}
    _rewrite_envs()
    return {"success": True, "name": project}


def _dd_settings():
    return Path(os.environ.get("APPDATA", "")) / "Docker" / "settings-store.json"


def docker_data_dir():
    """Carpeta actual del disco de datos de Docker Desktop (default = AppData\\Local\\Docker\\wsl\\disk)."""
    d = None
    try:
        d = json.loads(_dd_settings().read_text(encoding="utf-8")).get("DataFolder")
    except Exception:
        pass
    return Path(d) if d else Path(os.environ.get("LOCALAPPDATA", "")) / "Docker" / "wsl" / "disk"


def move_docker_data(dest_str=""):
    """v1.4: mover el disco de datos de Docker Desktop (imágenes/contenedores, TODO el peso) a
    <root>/docker-data. Cambia DataFolder en settings-store.json y Docker mueve el vhdx él solo
    al arrancar. Apaga Docker durante el proceso; revierte si no responde. Log en START_LOGS['dockermove']."""
    if not IS_WIN:
        return {"error": "Solo Docker Desktop en Windows — en Linux docker ya usa /var/lib/docker"}
    if START_LOGS.get("dockermove", {}).get("done") is False:
        return {"error": "Ya se está moviendo"}
    root = Path((dest_str or "").strip()) if (dest_str or "").strip() else BASE_DIR.parent
    target = root / "docker-data"
    with LOG_LOCK:
        START_LOGS["dockermove"] = {"lines": [], "done": False, "ok": False}

    def worker():
        lines, ok = [], False
        try:
            settings = _dd_settings()
            if not settings.exists():
                raise RuntimeError("No encuentro Docker Desktop (settings-store.json) — ¿está instalado?")
            cur = docker_data_dir()
            if cur.resolve() == target.resolve():
                lines.append(f"Los datos de Docker ya están en {target} — nada que hacer")
                ok = True
            elif target.exists() and any(target.glob("*.vhdx")):
                # v1.4: guard DESPUÉS de la comparación — tras un movimiento correcto, target SÍ tiene el vhdx
                raise RuntimeError(f"{target} ya contiene un disco de Docker — borra esa carpeta o elige otra raíz")
            else:
                vhdx = cur / "docker_data.vhdx"
                size = vhdx.stat().st_size if vhdx.exists() else 0
                root.mkdir(parents=True, exist_ok=True)  # v1.4: la raíz puede no existir aún — disk_usage peta si no
                free = shutil.disk_usage(root).free
                if size and free < size * 1.05:
                    raise RuntimeError(f"Espacio insuficiente: el disco de Docker pesa {size/1e9:.0f}GB y en {root} solo hay {free/1e9:.0f}GB libres")
                target.mkdir(parents=True, exist_ok=True)
                lines.append("Parando Docker Desktop (tus cerebros se detienen un rato)...")
                for proc in ("Docker Desktop.exe", "com.docker.backend.exe", "com.docker.build.exe"):
                    run(["taskkill", "/IM", proc, "/F"], timeout=30)
                run(["wsl", "--terminate", "docker-desktop"], timeout=30)
                time.sleep(3)
                try:
                    data = json.loads(settings.read_text(encoding="utf-8"))
                except Exception as e:
                    raise RuntimeError(f"No puedo leer {settings}: {e}")
                old = data.get("DataFolder")
                data["DataFolder"] = str(target)
                settings.write_text(json.dumps(data, indent=2), encoding="utf-8")
                lines.append(f"Ajuste guardado: DataFolder = {target}")
                lines.append("Arrancando Docker Desktop — moverá el disco aquí (con muchos GB puede tardar media hora, no cierres esto)...")
                dd = Path(r"C:\Program Files\Docker\Docker\Docker Desktop.exe")
                if dd.exists():
                    subprocess.Popen([str(dd)], creationflags=NO_WINDOW)
                else:
                    lines.append("No encuentro Docker Desktop.exe — arráncalo tú; el ajuste ya está puesto")
                t0, up = time.time(), False
                while time.time() - t0 < 2700:
                    rc, _, _ = run(["docker", "info"], timeout=15)
                    if rc == 0:
                        up = True
                        break
                    if int(time.time() - t0) % 60 < 16:
                        lines.append(f"Esperando al motor de Docker... {int((time.time() - t0) / 60)} min (mueve el disco mientras)")
                    time.sleep(15)
                if up:
                    ok = True
                    if any(target.glob("*.vhdx")):
                        lines.append(f"Hecho: los datos de Docker ahora viven en {target}")
                    else:
                        lines.append("Docker respondió pero no veo el disco en la carpeta destino — revisa Ajustes de Docker")
                else:
                    if old is None:
                        data.pop("DataFolder", None)
                    else:
                        data["DataFolder"] = old
                    settings.write_text(json.dumps(data, indent=2), encoding="utf-8")
                    raise RuntimeError("Docker no respondió en 45 min — ajuste revertido, arranca Docker Desktop a mano")
        except Exception as e:
            lines.append(f"Error: {e}")
        with LOG_LOCK:
            b = START_LOGS.get("dockermove")
            if b is not None:
                b["lines"] = (b["lines"] + lines)[-200:]
                b.update(done=True, ok=ok)

    threading.Thread(target=worker, daemon=True).start()
    return {"success": True}


def compose_cmd(name, *args):
    vals = read_env(name)
    project = vals.get("COMPOSE_PROJECT_NAME", name)
    base_fwd = str(BASE_DIR).replace("\\", "/")
    env_vars = {
        "VAULT_DIR": vals.get("VAULT_DIR", f"{base_fwd}/{name}/vault"),
        "ENV_FILE": vals.get("ENV_FILE", f"{base_fwd}/{name}/.env"),
        "AGENT_CONFIG_DIR": vals.get("AGENT_CONFIG_DIR", f"{base_fwd}/{name}"),
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


def _latest_gestor():
    """Última versión publicada del gestor (cache 1h). None si no se puede saber (offline)."""
    if time.time() - _GESTOR_CHECK["at"] < 3600:
        return _GESTOR_CHECK["latest"]
    latest = None
    try:
        req = urllib.request.Request(RELEASES_API, headers={"User-Agent": "GestorDeCerebros"})
        with urllib.request.urlopen(req, timeout=5) as r:
            tag = (json.loads(r.read()).get("tag_name") or "").lstrip("v")
            if tag:
                latest = tag
    except Exception:
        pass
    _GESTOR_CHECK.update(at=time.time(), latest=latest)
    return latest


_GESTOR_CHECK = {"at": 0.0, "latest": None}


def _refresh_path():
    """v1.4: el exe congela el PATH al arrancar; instalar Docker/Git actualiza el registro
    pero no este proceso → 'instalado pero Faltante' hasta reiniciar. Releer del registro."""
    if not IS_WIN:
        return
    try:
        import winreg
        parts = []
        for root, sub in ((winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment"),
                          (winreg.HKEY_CURRENT_USER, r"Environment")):
            try:
                with winreg.OpenKey(root, sub) as k:
                    parts.append(os.path.expandvars(winreg.QueryValueEx(k, "Path")[0]))
            except OSError:
                pass
        if parts:
            os.environ["PATH"] = ";".join(parts) + ";" + os.environ.get("PATH", "")
    except Exception:
        pass


_KNOWN = {  # rutas absolutas cuando el PATH (aún refrescado) no trae el bin
    "docker": [r"C:\Program Files\Docker\Docker\resources\bin\docker.exe"],
    "git": [r"C:\Program Files\Git\cmd\git.exe", r"C:\Program Files (x86)\Git\cmd\git.exe"],
    "python": [r"C:\Windows\py.exe", "py", "python3"],
}


def _probe(cmd, extra_paths=()):
    """(ok, version, exe) — cmd vía PATH refrescado, luego rutas conocidas.
    ponytail: 15s — el primer arranque tras instalar (Defender escanea el exe) puede pasar de 5s."""
    for c in [cmd, *extra_paths]:
        rc, out, _ = run([c, "--version"], timeout=15)
        if rc == 0:
            return True, out.strip(), c
    return False, "", cmd


def check_requirements():
    general, per = [], []
    _refresh_path()
    ok, ver, dexe = _probe("docker", _KNOWN["docker"])
    general.append({"name": "Docker", "ok": ok, "version": ver, "url": _DL_URLS["docker"]})
    docker_up = False
    if ok:
        rc2, _, _ = run([dexe, "info"], timeout=10)
        docker_up = rc2 == 0
        general.append({"name": "Docker corriendo", "ok": rc2 == 0, "version": "", "url": ""})
    ok, ver, _ = _probe("git", _KNOWN["git"])
    general.append({"name": "Git", "ok": ok, "version": ver, "url": _DL_URLS["git"]})
    ok, ver, _ = _probe("python", _KNOWN["python"])
    general.append({"name": "Python", "ok": ok, "version": ver.replace("Python ", ""), "url": _DL_URLS["python"]})
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
    out = {"general": general, "por_cerebro": per, "project_ready": COMPOSE_FILE.exists(),
           "base": str(BASE_DIR), "is_win": IS_WIN,
           # v1.4: cerebro volcado a mano en la raíz (sin carpeta con su nombre) → ofrecer organizarlo
           "sueltos": COMPOSE_FILE.exists() and (BASE_DIR / ".env").exists() and (BASE_DIR / "vault").is_dir(),
           # v1.4: ¿el disco de datos de Docker ya vive bajo la carpeta del sistema?
           "docker_data_here": (not IS_WIN) or docker_data_dir().resolve().is_relative_to(BASE_DIR.parent.resolve())}
    latest = _latest_gestor()
    if latest and latest != GESTOR_VERSION:
        out["gestor_update"] = {"latest": latest, "url": "https://github.com/karmaescopeta/Cerebro-Virtual/releases/latest"}
    return out


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
        global _LAST_REQ
        _LAST_REQ = time.time()
        if self.path == "/" or self.path == "/index.html":
            p = Path(sys._MEIPASS) / "index.html" if getattr(sys, "frozen", False) else Path(__file__).parent / "index.html"
            self._html(p.read_bytes()); return
        if self.path == "/api/requirements": self._json(check_requirements()); return
        if self.path == "/api/scan-cerebros": self._json({"grupos": find_other_cerebros()}); return
        if self.path.startswith("/api/browse"):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("path", [""])
            self._json(browse(q[0])); return
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
        global _LAST_REQ
        _LAST_REQ = time.time()
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        if self.path == "/api/create":
            name = body.get("name", "").strip()
            if not name: self._json({"error": "nombre vacío"}, 400); return
            if not re.fullmatch(r"[A-Za-z0-9_-]+", name):
                self._json({"error": "Solo letras, números, guiones y guiones bajos"}, 400); return
            self._json(instance_create(name)); return
        if self.path == "/api/download-project":
            self._json(download_project(body.get("dest", ""))); return
        if self.path == "/api/install-deps":
            self._json(install_deps()); return
        if self.path == "/api/set-base":
            self._json(set_base(body.get("path", ""))); return
        if self.path == "/api/move-docker-data":
            self._json(move_docker_data(body.get("dest", ""))); return
        if self.path == "/api/move-cerebros":
            self._json(move_cerebros(body.get("items", []))); return
        if self.path == "/api/mkdir":
            self._json(make_dir(body.get("path", ""))); return
        if self.path == "/api/pick-folder":
            self._json(pick_folder()); return
        if self.path == "/api/relocate":
            self._json(relocate(body.get("dest", ""))); return
        if self.path == "/api/tidy-root":
            self._json(tidy_root()); return
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


def _desktop_shortcut():
    """v1.4: acceso directo en el escritorio — el exe puede vivir donde sea (el sistema se
    encuentra vía gestor.json). Idempotente; solo en el binario, nunca en dev."""
    if not getattr(sys, "frozen", False):
        return
    try:
        exe = sys.executable.replace("'", "''")
        ps = ("$d=[Environment]::GetFolderPath('Desktop'); "
              "$lnk=Join-Path $d 'Gestor de Cerebros.lnk'; "
              "if (-not (Test-Path $lnk)) { "
              "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($lnk); "
              f"$s.TargetPath='{exe}'; "
              "$s.Save() }")
        run(["powershell", "-NoProfile", "-Command", ps], timeout=30)
    except Exception:
        pass


_LAST_REQ = time.time()  # auto-exit: sin peticiones HTTP = navegador cerrado


def _idle_watchdog():
    # ponytail: el exe no tiene ventana ni botón de salir — sin esto, cada ejecución
    # queda viva para siempre (zombis). El frontend auto-refresca cada 5s, así que
    # 600s sin tráfico = pestaña cerrada. Los docker compose en curso son procesos
    # independientes: sobreviven al exit (el arranque de una instancia no se corta).
    while True:
        time.sleep(60)
        if time.time() - _LAST_REQ > 600:
            os._exit(0)


def main():
    import socket
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    threading.Thread(target=_idle_watchdog, daemon=True).start()
    threading.Thread(target=lambda: webbrowser.open(f"http://127.0.0.1:{port}"), daemon=True).start()
    threading.Thread(target=_desktop_shortcut, daemon=True).start()
    server.serve_forever()

if __name__ == "__main__":
    main()
