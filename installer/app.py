#!/usr/bin/env python3
"""Cerebro Virtual — Installer. HTTP server + browser. No deps."""
import http.server, io, json, os, re, shutil, subprocess, sys, threading, time, urllib.parse, urllib.request, webbrowser, zipfile
from pathlib import Path

REPO_ZIP_URL = "https://codeload.github.com/karmaescopeta/Cerebro-Virtual/zip/refs/heads/main"
GESTOR_VERSION = "1.5.5"
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
# v1.5: el CÓDIGO del sistema vive en su propia subcarpeta — gestor_de_cerebros queda
# legible: una carpeta por cerebro (+ esta). Un nombre por diseño: el usuario la reconoce.
SYSTEM_SUBDIR = "imagen_Sistema_Base"


def _compose_file_at(base):
    """docker-compose.yml de una base cualquiera: raíz (instalaciones <= v1.4) o
    imagen_Sistema_Base/ (v1.5+). Devuelve la ruta aunque no exista — el caller hace .exists()."""
    if (base / "docker-compose.yml").exists():
        return base / "docker-compose.yml"
    return base / SYSTEM_SUBDIR / "docker-compose.yml"


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
        if saved and _compose_file_at(Path(saved)).exists():
            return Path(saved)
    except Exception:
        pass
    frozen = getattr(sys, "frozen", False)
    start = Path(sys.executable).resolve().parent if frozen else Path(__file__).resolve().parent.parent
    for child in ("gestor_de_cerebros", "cerebro_virtual", "Cerebro-Virtual-main", "Cerebro-Virtual", SYSTEM_SUBDIR):  # instalación de un solo archivo
        if _compose_file_at(start / child).exists():
            return start / child
    for p in [start, *start.parents][:8]:
        if _compose_file_at(p).exists():
            return p
    # v1.4.1: sin sistema por near — el fallback es la carpeta del propio exe (o repo en dev).
    # parents[2] saltaba con IndexError si el exe estaba en una carpeta poco profunda (C:\X\Gestor.exe)
    return Path(__file__).resolve().parent.parent if not frozen else start

BASE_DIR = _find_base()

# v1.4: los cerebros viven DIRECTO en la carpeta general: gestor_de_cerebros\<cerebro>\
INSTANCES_DIR = BASE_DIR
COMPOSE_FILE = _compose_file_at(BASE_DIR)


def _refresh_base():
    """Recalcular la raíz tras descargar el proyecto (POST /api/download-project)."""
    global BASE_DIR, INSTANCES_DIR, COMPOSE_FILE
    BASE_DIR = _find_base()
    INSTANCES_DIR = BASE_DIR
    COMPOSE_FILE = _compose_file_at(BASE_DIR)
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


def _migrate_system_subdir():
    """v1.5: hasta ahora TODO el código del sistema se descomprimía en la raíz de
    gestor_de_cerebros, mezclado con las carpetas de los cerebros. Moverlo a
    imagen_Sistema_Base/ para que la carpeta general sea legible: una carpeta por cerebro.
    Solo el binario (en el repo de desarrollo NO — rompería el árbol de git)."""
    if not getattr(sys, "frozen", False):
        return
    if not (BASE_DIR / "docker-compose.yml").exists():
        return  # ya migrado (v1.5 instala directo en el subdir) o sin sistema
    if (BASE_DIR / ".git").exists():
        return  # clon git: mover rompería el repo y las actualizaciones
    try:
        sub = BASE_DIR / SYSTEM_SUBDIR
        sub.mkdir(exist_ok=True)
        for item in list(BASE_DIR.iterdir()):
            if item.name in (SYSTEM_SUBDIR, "relocating.json", "instances"):
                continue
            if item.is_dir() and (item / ".env").exists():
                continue  # carpeta de un cerebro — se queda
            if item.name in (".env", "vault"):
                continue  # cerebro suelto legado — lo organiza tidy-root, con permiso del usuario
            shutil.move(str(item), str(sub / item.name))
    except Exception:
        pass  # best-effort: lo que no se mueva, sigue funcionando (rutas absolutas de los .env no cambian)


PORT_RANGES = {"FRONTEND_PORT": 5173, "BACKEND_PORT": 8000, "AGENT_PORT": 8080, "SEARXNG_PORT": 8888, "OMNIROUTE_PORT": 20128}

if COMPOSE_FILE.exists():
    _migrate_old()  # al arrancar también (no solo tras descargar)
    _migrate_system_subdir()  # v1.5: código del sistema a imagen_Sistema_Base/
    COMPOSE_FILE = _compose_file_at(BASE_DIR)  # la migración movió el compose — recalcular

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


def proj_name(name):
    """v1.4.1: docker compose EXIGE minúsculas ('invalid project name "Cerebro1"') —
    normalizar cualquier nombre de cerebro a stack name de docker."""
    n = re.sub(r"[^a-z0-9_-]", "", name.lower())
    return n or name.lower()


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


_LIST_CACHE = {"at": 0.0, "data": None}


def list_instances():
    # v1.5 (M3): el auto-refresh (5s) llama docker ps+stats+images+netstat cada vez (~2s de CPU).
    # Cache 2.5s — las acciones de create/start/stop/remove la invalidan.
    if _LIST_CACHE["data"] is not None and time.time() - _LIST_CACHE["at"] < 2.5:
        return _LIST_CACHE["data"]
    if not INSTANCES_DIR.exists():
        return []
    result = []
    for d in sorted(INSTANCES_DIR.iterdir()):
        if not (d / ".env").exists(): continue
        vals = read_env(d.name)
        project = proj_name(vals.get("COMPOSE_PROJECT_NAME", d.name))  # v1.4.1: docker pide minúsculas
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
    _LIST_CACHE.update(at=time.time(), data=result)
    return result


def _list_invalidate():
    _LIST_CACHE.update(at=0.0)


def instance_create(name):
    inst = INSTANCES_DIR / name
    if inst.exists(): return {"error": "Ya existe"}
    try:
        for sub in ["vault/raw/.processed", "vault/wiki", "vault/outputs", "vault/system", "vault/chat-sesiones"]:
            (inst / sub).mkdir(parents=True, exist_ok=True)
        default_cfg = INSTANCES_DIR / "default" / "agent-config.yaml"
        if default_cfg.exists(): shutil.copy2(default_cfg, inst / "agent-config.yaml")
        ports = auto_ports()
        base_fwd = str(BASE_DIR).replace("\\", "/")
        (inst / ".env").write_text(
            f"COMPOSE_PROJECT_NAME={proj_name(name)}\nOPENROUTER_API_KEY=\n"  # v1.4.1: docker exige minúsculas
            f"BACKEND_PORT={ports['BACKEND_PORT']}\nFRONTEND_PORT={ports['FRONTEND_PORT']}\n"
            f"AGENT_PORT={ports['AGENT_PORT']}\nSEARXNG_PORT={ports['SEARXNG_PORT']}\n"
            f"OMNIROUTE_PORT={ports['OMNIROUTE_PORT']}\n"
            # v1.3: VAULT_HOST_PATH con / — igual que VAULT_DIR; Docker/Windows acepta ambas, Linux necesita /
            # v1.4: cerebro directo en la raíz (gestor_de_cerebros\<name>), sin instances\
            # v1.4.1: COMPOSE_PROJECT_NAME normalizado (docker exige minúsculas); la carpeta conserva el nombre tal cual
            f"CLOUDFLARE_TUNNEL_TOKEN=\nVAULT_HOST_PATH={base_fwd}/{name}/vault\n"
            f"GITHUB_REPO=\nVAULT_DIR={base_fwd}/{name}/vault\n"
            f"ENV_FILE={base_fwd}/{name}/.env\nAGENT_CONFIG_DIR={base_fwd}/{name}\n",
            encoding="utf-8")
    except Exception as e:
        # v1.5 (C1): cualquier fallo del filesystem devuelve JSON — jamás rompe la conexión
        shutil.rmtree(inst, ignore_errors=True)  # sin restos a medias
        return {"error": f"No pude crear la carpeta del cerebro: {e}"}
    _list_invalidate()
    return {"success": True, "ports": ports}


def download_project(dest_str=""):
    """Instalación de un solo archivo: descarga el repo en zip y lo descomprime.
    v1.4: dest_str = carpeta elegida por el usuario (vacía = junto al exe); sistema,
    cerebros y vaults viven todos dentro de esa carpeta. Se recuerda en gestor.json.
    Progreso en START_LOGS['setup'] (mismo mecanismo de polling que el arranque)."""
    if COMPOSE_FILE.exists():
        return {"error": "El sistema ya está instalado"}
    target = Path(dest_str.strip()) if (dest_str or "").strip() else None
    if target is not None:
        if not target.is_absolute():
            return {"error": "La ruta debe ser absoluta (ej: D:\\cerebros)"}
        try:
            target.mkdir(parents=True, exist_ok=True)  # valida permisos ahora, no en el thread
        except Exception as e:
            return {"error": f"No puedo escribir en {target}: {e}"}
    if START_LOGS.get("task:setup", {}).get("done") is False:
        return {"error": "Ya se está descargando"}
    with LOG_LOCK:
        START_LOGS["task:setup"] = {"lines": [], "done": False, "ok": False}

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
            # v1.5 (M1): buscar SOLO entre las carpetas del zip — cualquier otra previa con compose no es nuestra
            extracted = next((d for d in dest.iterdir() if d.is_dir() and d.name.startswith("Cerebro-Virtual") and (d / "docker-compose.yml").exists()), None)
            # v1.5: carpeta general LEGIBLE — gestor_de_cerebros solo contiene una carpeta por
            # cerebro; todo el código del sistema vive dentro de imagen_Sistema_Base
            gestor = dest / "gestor_de_cerebros"
            gestor.mkdir(exist_ok=True)
            if extracted is not None and not (gestor / SYSTEM_SUBDIR).exists():
                extracted.rename(gestor / SYSTEM_SUBDIR)
            zpath.unlink()
            # v1.4: persistir la carpeta elegida ANTES de _refresh_base — _find_base solo mira
            # hijos/padres del exe, así que sin gestor.json un proyecto en otro disco quedaría huérfano
            if target is not None and _compose_file_at(gestor).exists():
                _config_file().write_text(json.dumps({"base": str(gestor)}), encoding="utf-8")
            _refresh_base()
            ok = COMPOSE_FILE.exists()
            lines.append(f"Sistema instalado en: {BASE_DIR}" if ok else "Error: no encontré el sistema tras descomprimir")
        except Exception as e:
            lines.append(f"Error: {e}")
        with LOG_LOCK:
            b = START_LOGS.get("task:setup")
            if b is not None:
                b["lines"] = (b["lines"] + lines)[-200:]
                b.update(done=True, ok=ok)

    threading.Thread(target=worker, daemon=True).start()
    return {"success": True}


def install_deps():
    """v1.4: botón 'Instalar dependencias' — instala de golpe lo que falte (docker/git/python):
    winget en Windows (salta el UAC, el usuario acepta), apt+sudo en Linux (contraseña en la terminal).
    Si winget no existe, abre las páginas de descarga. Progreso en START_LOGS['deps']."""
    if START_LOGS.get("task:deps", {}).get("done") is False:
        return {"error": "Ya se está instalando"}
    with LOG_LOCK:
        START_LOGS["task:deps"] = {"lines": [], "done": False, "ok": False}

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
                    # v1.5 (M4): las URLs van al log (clicables en el panel) — no bombardeo de pestañas
                    lines.append("Sin winget — descarga e instala a mano (los enlaces, en el log):")
                    for k in missing:
                        lines.append(f"  {k}: {_DL_URLS[k]}")
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
            b = START_LOGS.get("task:deps")
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

    def _is_sys(d):
        return (d / "docker-compose.yml").exists() or (d / SYSTEM_SUBDIR / "docker-compose.yml").exists()
    base = None
    if p.name == SYSTEM_SUBDIR and _is_sys(p):
        base = p.parent  # señalaron imagen_Sistema_Base directamente — el sistema es su carpeta padre
    elif _is_sys(p):
        base = p
    else:
        base = next((c for c in p.iterdir() if c.is_dir() and _is_sys(c)), None)
    if base is None:
        return {"error": f"En {p} no hay ningún sistema instalado (busco su archivo de configuración ahí y un nivel abajo). "
                         f"Si lo que quieres es TRAER tu sistema a esta carpeta, usa Ajustes → «Mover todo»"}
    try:
        _config_file().write_text(json.dumps({"base": str(base)}), encoding="utf-8")
    except Exception as e:
        return {"error": f"No puedo guardar el ajuste: {e}"}
    global COMPOSE_FILE
    _refresh_base()
    _migrate_system_subdir()  # v1.5: si era una instalación vieja, su código va a imagen_Sistema_Base
    COMPOSE_FILE = _compose_file_at(BASE_DIR)
    _rewrite_envs()
    return {"success": True, "base": str(BASE_DIR), "instances": len(list_instances())}


def _inst_dir(base, name):
    """Carpeta de un cerebro en una base cualquiera — layout nuevo (base\\name) o viejo (base\\instances\\name).
    v1.4.1: case-insensitive — la carpeta puede llamarse 'Cerebro1' y el stack de docker 'cerebro1'."""
    b = Path(base)
    for father in (b, b / "instances"):
        if not father.is_dir():
            continue
        for d in father.iterdir():
            if d.name.lower() == str(name).lower() and (d / ".env").exists():
                return d
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
                if base.name == SYSTEM_SUBDIR:
                    base = base.parent  # v1.5: el compose vive en imagen_Sistema_Base — los cerebros están un nivel arriba
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
    if START_LOGS.get("task:move", {}).get("done") is False:
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
        START_LOGS["task:move"] = {"lines": [], "done": False, "ok": False}

    def worker():
        lines, ok = [], True
        try:
            for i in clean:
                src = _inst_dir(i["base"], i["name"])
                lines.append(f"Moviendo {i['name']} (desde {i['base']})...")
                project = proj_name(read_env_path(src / ".env").get("COMPOSE_PROJECT_NAME", i["name"]))  # v1.4.1
                run(["docker", "compose", "-p", project, "-f", str(_compose_file_at(Path(i["base"]))),
                     "--env-file", str(src / ".env"), "stop"], timeout=120)
                shutil.move(str(src), str(INSTANCES_DIR / i["name"]))
                lines.append(f"{i['name']} mudado")
            _rewrite_envs()
            lines.append(f"Listo: {len(clean)} cerebro(s) ahora viven en {INSTANCES_DIR}")
        except Exception as e:
            ok = False
            lines.append(f"Error: {e}")
        with LOG_LOCK:
            b = START_LOGS.get("task:move")
            if b is not None:
                b["lines"] = (b["lines"] + lines)[-200:]
                b.update(done=True, ok=ok)

    threading.Thread(target=worker, daemon=True).start()
    return {"success": True}


def update_system():
    """v1.5.4: re-descarga el código del sistema (imagen_Sistema_Base) y lo sustituye.
    Los cerebros y sus datos NO se tocan. Los encendidos se paran un momento, se
    reconstruyen con el código nuevo y vuelven solos. Log en START_LOGS['task:update']."""
    if not _compose_file_at(BASE_DIR).exists():
        return {"error": "No hay sistema instalado"}
    if START_LOGS.get("task:update", {}).get("done") is False:
        return {"error": "Ya se está actualizando"}
    with LOG_LOCK:
        START_LOGS["task:update"] = {"lines": [], "done": False, "ok": False}

    def worker():
        global COMPOSE_FILE
        lines, ok = [], False
        old = BASE_DIR / "_old_system"
        try:
            # 1) cerebros encendidos: parar (los bind mounts al código se liberan)
            running = [i["name"] for i in list_instances() if i["status"] == "running"]
            if running:
                lines.append(f"Parando cerebros encendidos ({', '.join(running)})…")
                for name in running:
                    cmd, env = compose_cmd(name, "stop")
                    run(cmd, timeout=300)
            # 2) descargar el código nuevo a temporal (streaming, no entero en memoria)
            lines.append("Descargando la última versión del sistema…")
            tmp = BASE_DIR / "_update_tmp"
            shutil.rmtree(tmp, ignore_errors=True); tmp.mkdir()
            req = urllib.request.Request(REPO_ZIP_URL, headers={"User-Agent": "GestorDeCerebros"})
            with urllib.request.urlopen(req, timeout=60) as r, open(tmp / "sys.zip", "wb") as f:
                shutil.copyfileobj(r, f)
            with zipfile.ZipFile(tmp / "sys.zip") as z:
                if any(m.filename.startswith(("..", "/", "\\")) for m in z.infolist()):
                    raise RuntimeError("zip con rutas inseguras")
                z.extractall(tmp)
            new = next((d for d in tmp.iterdir() if d.is_dir() and d.name.startswith("Cerebro-Virtual") and (d / "docker-compose.yml").exists()), None)
            if new is None:
                raise RuntimeError("la descarga no trajo el sistema")
            # 3) intercambio: viejo → _old_system, nuevo → imagen_Sistema_Base (con rollback)
            sub = BASE_DIR / SYSTEM_SUBDIR
            shutil.rmtree(old, ignore_errors=True)
            if sub.exists():
                sub.rename(old)
            try:
                new.rename(sub)
            except Exception:
                if old.exists() and not sub.exists():
                    old.rename(sub)  # rollback — el sistema viejo vuelve
                raise
            shutil.rmtree(tmp, ignore_errors=True)
            shutil.rmtree(old, ignore_errors=True)  # v1.5.4: el viejo se va del todo — la carpeta queda limpia
            COMPOSE_FILE = _compose_file_at(BASE_DIR)
            lines.append("Código nuevo instalado.")
            ok = True
            # 4) re-encender los que estaban encendidos (cada uno con su propio panel de log)
            for name in running:
                lines.append(f"Reconstruyendo {name}…")
                instance_start(name)
            lines.append("Listo" + (f" — {len(running)} cerebro(s) encendiéndose de nuevo" if running else ""))
        except Exception as e:
            lines.append(f"Error: {e}")
            if old.exists():
                lines.append("(El sistema anterior sigue en su sitio — nada se ha perdido)")
        with LOG_LOCK:
            b = START_LOGS.get("task:update")
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
        if rc == 0:
            path = out.strip()
            return {"path": path or None}  # vacío = usuario canceló
        # v1.5 (M5): timeout/fallojo del selector → mensaje claro, no silencio
        return {"error": "No pude abrir el explorador de carpetas — inténtalo otra vez (o usa el explorador de esta ventana)"}
    rc, out, _ = run(["zenity", "--file-selection", "--directory", "--title", "Elige la carpeta del sistema"], timeout=900)
    if rc == 0:
        return {"path": out.strip() or None}
    return {"error": "No hay selector de carpetas en este equipo — usa el explorador de la ventana"}


def _move_one(src, dst, tries=3):
    """Mover con reintentos y sin estados sucios:
    - mismo volumen → os.rename ATÓMICO (si falla por bloqueo, no queda nada a medias;
      shutil.move haría copytree parcial + rmtree fallido = duplicados en los reintentos)
    - otro volumen → shutil.move (copiar y borrar); si quedó una copia a medias de un
      intento anterior, se limpia y se rehace
    - nunca se sobreescribe lo que ya esté en el destino"""
    src, dst = Path(src), Path(dst)
    if src.resolve() == dst.resolve():
        return None  # mismo sitio — nada que hacer (y NUNCA borrar en este caso)
    for i in range(tries):
        try:
            if dst.exists():
                if not src.exists():
                    return None  # ya estaba movida en un intento anterior
                shutil.rmtree(dst, ignore_errors=True)  # copia a medias previa — rehacer
            if src.anchor == dst.anchor:
                os.rename(src, dst)
            else:
                shutil.move(str(src), str(dst))
            return None
        except Exception as e:
            if i == tries - 1:
                return f"{src} ({e})"
            time.sleep(2)
    return None


def _move_except(src, dst, exe):
    """Mover todo src→dst salvo el exe bloqueado (baja por las carpetas que lo contienen).
    El docker-compose.yml se mueve el ÚLTIMO: es el distintivo de 'aquí hay un sistema' —
    si algo falla a medias, la carpeta vieja sigue siendo válida y reintentable.
    Devuelve la lista de rutas que no se pudieron mover."""
    dst.mkdir(parents=True, exist_ok=True)
    failed, compose = [], None
    for item in src.iterdir():
        if item.name == "docker-compose.yml":
            compose = item
            continue
        if exe is not None and item.resolve() == exe:
            continue  # el exe en ejecución está bloqueado por Windows — se queda y sigue funcionando
        if exe is not None and exe.is_relative_to(item.resolve()):
            failed += _move_except(item, dst / item.name, exe)  # la carpeta del exe se mueve por dentro
        else:
            err = _move_one(item, dst / item.name)
            if err:
                failed.append(err)
    if compose is not None and not failed:  # con fallos, el compose se queda: mantiene la base vieja válida y reintentable
        err = _move_one(compose, dst / compose.name)
        if err:
            failed.append(err)
    return failed


def relocate(dest_str):
    """v1.4: mudar TODO el sistema (la carpeta gestor_de_cerebros con todos los cerebros) a otra
    carpeta/disco. Para los cerebros encendidos, mueve todo y vuelve a encenderlos. Log en START_LOGS['relocate']."""
    if not COMPOSE_FILE.exists():
        return {"error": "No hay sistema instalado"}
    if START_LOGS.get("task:relocate", {}).get("done") is False:
        return {"error": "Ya se está mudando"}
    dest = Path((dest_str or "").strip())
    if not str(dest) or not dest.is_absolute():
        return {"error": "Carpeta no válida"}
    target = dest  # v1.4.1: la carpeta elegida ES la nueva carpeta del sistema (gestor_de_cerebros con todo dentro)
    if target.resolve() == Path(BASE_DIR).resolve():
        return {"error": "El sistema ya está en esa carpeta"}
    if str(target) == str(target.anchor):
        return {"error": "Elige (o crea) una carpeta concreta, no la raíz del disco"}
    if Path(BASE_DIR).resolve().is_relative_to(target.resolve()):
        return {"error": "No puedes elegir una carpeta que CONTIENE al sistema (su carpeta padre o superior) — elige una carpeta aparte"}
    if target.resolve().is_relative_to(Path(BASE_DIR).resolve()):
        return {"error": "No puedes elegir una carpeta de DENTRO del sistema — elige una carpeta fuera de él"}
    if _compose_file_at(target).exists():  # v1.5: también si ya tiene imagen_Sistema_Base dentro
        # v1.4.1: puede ser el resto de una mudanza anterior que quedó a medias — el marcador lo dice
        partial = False
        try:
            mk = json.loads((target / "relocating.json").read_text(encoding="utf-8"))
            partial = mk.get("from") == str(Path(BASE_DIR).resolve())
        except Exception:
            pass
        if not partial:
            return {"error": f"En {target} ya hay un sistema instalado — elige otra carpeta"}
    else:
        partial = False
    try:
        base_names = {p.name for p in Path(BASE_DIR).iterdir()}
        if target.exists() and not partial:
            clash = base_names & {p.name for p in target.iterdir()}
            if clash:
                return {"error": f"En {target} ya existe: {', '.join(sorted(clash)[:5])} — elige una carpeta vacía o con otro nombre"}
    except OSError as e:
        return {"error": f"No puedo revisar {target}: {e}"}
    try:
        exe = Path(sys.executable).resolve()
    except Exception:
        exe = None
    exe_inside = bool(exe and exe.is_relative_to(Path(BASE_DIR).resolve()))
    with LOG_LOCK:
        START_LOGS["task:relocate"] = {"lines": [], "done": False, "ok": False}

    def worker():
        lines, ok = [], False
        try:
            # marcador de mudanza en curso: si algo queda a medias, el reintento no se frena en los guards
            target.mkdir(parents=True, exist_ok=True)
            (target / "relocating.json").write_text(json.dumps({"from": str(Path(BASE_DIR).resolve())}), encoding="utf-8")
            running = [i["name"] for i in list_instances() if i["status"] == "running"]
            if running:
                lines.append(f"Apagando cerebros encendidos ({', '.join(running)})...")
                for name in running:
                    cmd, env = compose_cmd(name, "stop")
                    run(cmd, timeout=120)
            lines.append(f"Mudando todo el sistema a {target} (puede tardar si hay muchos archivos)...")
            # ponytail: entrada a entrada, no shutil.move del árbol — target puede existir y
            # shutil.move(dir, dir_existente) metería el sistema un nivel más abajo
            failed = _move_except(Path(BASE_DIR), target, exe if exe_inside else None)
            if exe_inside:
                lines.append(f"El gestor se queda donde está ({exe}) — el resto se muda y sigue funcionando igual.")
            if failed:
                raise RuntimeError("No pude mover (probablemente en uso por otro programa): " + "; ".join(failed[:3]))
            try:
                Path(BASE_DIR).rmdir()  # cosmético — si algo la deja ocupada, no debe romper el registro
            except OSError:
                lines.append(f"Nota: la carpeta vieja ({BASE_DIR}) conserva solo el gestor — copia el gestor donde prefieras y bórrala")
            _config_file().write_text(json.dumps({"base": str(target)}), encoding="utf-8")
            _refresh_base()
            _rewrite_envs()
            ok = COMPOSE_FILE.exists()
            (target / "relocating.json").unlink(missing_ok=True)  # mudanza completa — quitar el marcador
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
            b = START_LOGS.get("task:relocate")
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
    if START_LOGS.get("task:dockermove", {}).get("done") is False:
        return {"error": "Ya se está moviendo"}
    root = Path((dest_str or "").strip()) if (dest_str or "").strip() else BASE_DIR.parent
    target = root / "docker-data"
    with LOG_LOCK:
        START_LOGS["task:dockermove"] = {"lines": [], "done": False, "ok": False}

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
            b = START_LOGS.get("task:dockermove")
            if b is not None:
                b["lines"] = (b["lines"] + lines)[-200:]
                b.update(done=True, ok=ok)

    threading.Thread(target=worker, daemon=True).start()
    return {"success": True}


def compose_cmd(name, *args):
    vals = read_env(name)
    project = proj_name(vals.get("COMPOSE_PROJECT_NAME", name))  # v1.4.1: docker pide minúsculas
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


_PROGRESS = {"ok": None}  # cache del probe: ¿esta versión de docker compose admite --progress?


def _compose_progress_ok():
    """v1.5.1: 'unknown flag: --progress' en composes antiguos (Docker Desktop) —
    comprobar UNA vez si el compose local lo admite antes de usarlo."""
    if _PROGRESS["ok"] is None:
        rc, out, _ = run(["docker", "compose", "up", "--help"], timeout=15)
        _PROGRESS["ok"] = (rc == 0 and "--progress" in (out or ""))
    return _PROGRESS["ok"]


def _log_append(buf, s):
    with LOG_LOCK:
        buf["lines"] = (buf["lines"] + [s])[-200:]


def _ensure_ports(name, log):
    """v1.5.3: los puertos de un cerebro se asignan UNA VEZ y quedan FIJOS en su .env
    (el túnel de Cloudflare apunta a ellos — reasignar en cada arranque lo desconfiguraría).
    Reasigna SOLO si falta un puerto (.env viejo movido) o choca con el puerto declarado en
    el .env de OTRO cerebro (colisión estructural, determinista: converge y no repite).
    La ocupación runtime externa (programas del equipo, contenedores ajenos) NUNCA reasigna:
    solo avisa — el puerto es de este cerebro y el intruso debe cerrarse."""
    vals = read_env(name)
    project = proj_name(vals.get("COMPOSE_PROJECT_NAME", name))
    assigned = {k: int(vals[k]) for k in PORT_RANGES if str(vals.get(k, "")).strip().isdigit()}
    missing = [k for k in PORT_RANGES if k not in assigned]
    # 1) puertos declarados por los DEMÁS cerebros — la única colisión que reasigna
    others = set()
    if INSTANCES_DIR.exists():
        for d in INSTANCES_DIR.iterdir():
            if d.name == name or not (d / ".env").exists():
                continue
            for line in (d / ".env").read_text(encoding="utf-8", errors="ignore").splitlines():
                for key in PORT_RANGES:
                    if line.startswith(f"{key}="):
                        v = line.split("=", 1)[1].strip()
                        if v.isdigit(): others.add(int(v))
    conflicts = {k for k, v in assigned.items() if v in others}
    # 2) ocupación runtime (contenedores ajenos + netstat) — para elegir libres al asignar,
    #    y para AVISAR (nunca reasignar) si un puerto fijo está ocupado por otro programa
    runtime = set()
    rc, out, _ = run(["docker", "ps", "--format", "{{.Names}}|{{.Ports}}"], timeout=10)
    if rc == 0:
        for ln in out.splitlines():
            cname, _, ports = ln.partition("|")
            if cname.startswith(f"{project}-"):
                continue  # mi propio stack no cuenta
            for m in re.finditer(r":(\d+)->", ports):
                runtime.add(int(m.group(1)))
    rc, out2, _ = run(["netstat", "-an"], timeout=10)
    if rc == 0:
        for line in out2.splitlines():
            if "LISTENING" in line or "LISTEN" in line:
                m2 = re.search(r":(\d+)\s", line)
                if m2: runtime.add(int(m2.group(1)))
    if not missing and not conflicts:
        busy = sorted(v for v in assigned.values() if v in runtime)
        if busy:
            log(f"AVISO: el/los puerto(s) {', '.join(map(str, busy))} de este cerebro están ocupados ahora "
                f"mismo por otro programa. NO los cambio — son fijos (por ejemplo, para el túnel de acceso "
                f"remoto). Cierra ese programa y vuelve a dar a Iniciar.")
        return  # puertos ya asignados y sin colisión estructural — NUNCA se tocan
    used = set(others) | runtime
    # conservar los míos que no chocan; los que faltan o chocan → primer libre desde la base
    changed = {}
    for key, base in PORT_RANGES.items():
        if key in assigned and key not in conflicts:
            continue
        port = base
        while port in used or port in assigned.values():
            port += 1
        used.add(port)
        changed[key] = port
    env_path = INSTANCES_DIR / name / ".env"
    lines = env_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    seen, out_lines = set(), []
    for ln in lines:
        k = ln.split("=", 1)[0].strip() if "=" in ln else None
        if k in changed:
            out_lines.append(f"{k}={changed[k]}")
            seen.add(k)
        else:
            out_lines.append(ln)
    for k, v in changed.items():
        if k not in seen:
            out_lines.append(f"{k}={v}")
    env_path.write_text("\n".join(out_lines) + "\n", encoding="utf-8")
    pretty = ", ".join(f"{k.replace('_PORT', '').lower()} {v}" for k, v in changed.items())
    log(f"Puertos asignados (quedan FIJOS a partir de ahora, p. ej. para el túnel de acceso remoto): {pretty}")


def _postcheck_recreate(name, log):
    """v1.5.2: docker a veces deja contenedores creados SIN conectar a la red del stack
    (visto en real: frontend en bucle 'host not found in upstream backend' — 0 redes en
    inspect). Tras el up, comprobar qué servicios no quedaron corriendo y recrearlos."""
    try:
        cmd, env = compose_cmd(name, "ps", "--all", "--format", "json")
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30, env=env,
                           creationflags=NO_WINDOW, errors="replace")
        bad = []
        for ln in (r.stdout or "").splitlines():  # NDJSON — línea a línea (pitfall compose v5)
            ln = ln.strip()
            if not ln:
                continue
            try:
                c = json.loads(ln)
            except Exception:
                continue
            state = str(c.get("State") or "").lower()
            status = str(c.get("Status") or "").lower()
            healthy = state == "running" or (not state and status.startswith("up"))
            if not healthy:
                svc = c.get("Service") or c.get("Name") or "?"
                if svc not in bad:
                    bad.append(svc)
        if not bad:
            return
        log(f"Arreglando {', '.join(bad)} (no arrancaron bien)…")
        args = ["up", "-d", "--force-recreate", "--no-deps", *bad]
        if _compose_progress_ok():
            args.append("--progress=plain")
        rcmd, renv = compose_cmd(name, *args)
        r2 = subprocess.run(rcmd, capture_output=True, text=True, timeout=300, env=renv,
                           creationflags=NO_WINDOW, errors="replace")
        for l in ((r2.stdout or "") + (r2.stderr or "")).splitlines():
            log(l.rstrip())
        log("Listo" if r2.returncode == 0 else "No pude arreglarlo del todo — revisa las líneas de arriba")
    except Exception as e:
        log(f"(comprobación post-arranque falló: {e})")


def _ensure_omni_key(name, log):
    """v1.5.5: cerebros IMPORTADOS pueden traer un .env sin OMNIROUTE_API_KEY (la key
    que el agente presenta al /v1 de OmniRoute). Sin ella, el chat muere con un 401
    imposible de diagnosticar. Auto-curar tras el arranque: si falta, crear una key en
    el OmniRoute de ESTE cerebro (login con su propia password de gestión), guardarla
    en su .env y recrear el agente para que la use."""
    try:
        vals = read_env(name)
        if vals.get("OMNIROUTE_API_KEY", "").strip():
            return  # ya tiene key — nada que hacer
        port = vals.get("OMNIROUTE_PORT", "20128")
        pw = vals.get("OMNIROUTE_MANAGE_PASSWORD", "")
        if not pw:
            log("(no pude revisar la clave interna del cerebro: falta OMNIROUTE_MANAGE_PASSWORD)")
            return
        base = f"http://127.0.0.1:{port}"
        # login con cookie de sesión (como hace el backend de la app)
        import urllib.request, http.cookiejar
        cj = http.cookiejar.CookieJar()
        op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
        r1 = op.open(urllib.request.Request(base + "/api/auth/login",
                    data=json.dumps({"password": pw}).encode(),
                    headers={"Content-Type": "application/json"}, method="POST"), timeout=15)
        r1.read()
        # crear la key
        r2 = op.open(urllib.request.Request(base + "/api/keys",
                    data=json.dumps({"name": f"{name}-agent"}).encode(),
                    headers={"Content-Type": "application/json"}, method="POST"), timeout=15)
        d = json.loads(r2.read())
        key = d.get("key") or d.get("apiKey") or d.get("token") or ""
        if not key:
            raise RuntimeError("OmniRoute no devolvió la clave")
        # guardarla en el .env (preservando todo lo demás) y recrear SOLO el agente
        env_path = INSTANCES_DIR / name / ".env"
        lines = [l for l in env_path.read_text(encoding="utf-8", errors="ignore").splitlines()
                 if not l.startswith("OMNIROUTE_API_KEY=")]
        lines.append("OMNIROUTE_API_KEY=" + key)
        env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        log("Reparado: este cerebro no tenía su clave interna de IA (se pierde al importar o"
            " mover a mano un sistema viejo). La he creado y guardado; aplicándola…")
        cmd, env = compose_cmd(name, "up", "-d", "--force-recreate", "--no-deps", "sistema-agente")
        r3 = subprocess.run(cmd, capture_output=True, text=True, timeout=300, env=env,
                            creationflags=NO_WINDOW, errors="replace")
        log("Clave interna aplicada — el chat ya puede funcionar." if r3.returncode == 0
            else "No pude aplicar la clave del todo; si el chat falla, dale a Iniciar otra vez.")
    except Exception as e:
        log(f"(revisión de la clave interna: {e})")


def instance_start(name):
    if not (INSTANCES_DIR / name / ".env").exists(): return {"error": "No existe"}
    if START_LOGS.get(name, {}).get("done") is False: return {"error": "Ya se está iniciando"}
    with LOG_LOCK:
        START_LOGS[name] = {"lines": [], "done": False, "ok": False}
        buf = START_LOGS[name]  # v1.5 (C5): MI buffer — si el cerebro se borra y se recrea, este worker no toca el nuevo
    try:
        # v1.5.2: los puertos de ESTE cerebro no chocan con nada — antes de montar el compose
        _ensure_ports(name, lambda s: _log_append(buf, s))
    except Exception as e:
        _log_append(buf, f"(no pude comprobar los puertos: {e})")
    # v1.5 (U17): --progress=plain desoculta los pasos de build — SOLO si el compose lo admite
    args = ["up", "-d", "--build"] + (["--progress=plain"] if _compose_progress_ok() else [])
    cmd, env = compose_cmd(name, *args)
    def worker():
        p = None
        try:
            p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                 text=True, errors="replace", env=env, creationflags=NO_WINDOW)
            for line in p.stdout:
                with LOG_LOCK:  # v1.5 (U17): lock POR LÍNEA — antes se retenía todo el arranque y /api/logs se quedaba colgado
                    if START_LOGS.get(name) is not buf:
                        if p.poll() is None: p.kill()  # mi cerebro fue borrado — el arranque huérfano muere
                        break
                    buf["lines"] = (buf["lines"] + [line.rstrip()])[-200:]
            rc = p.wait()
            if rc == 0:
                time.sleep(5)  # dejar que arranquen del todo antes de juzgar
                _postcheck_recreate(name, lambda s: _log_append(buf, s))
                _ensure_omni_key(name, lambda s: _log_append(buf, s))  # v1.5.5: auto-cura del import sin key
            with LOG_LOCK:
                if START_LOGS.get(name) is buf:
                    buf.update(done=True, ok=rc == 0)
        except Exception as e:
            with LOG_LOCK:
                if START_LOGS.get(name) is buf:
                    buf["lines"] = (buf["lines"] + [f"Error: {e}"])[-200:]
                    buf.update(done=True, ok=False)
    threading.Thread(target=worker, daemon=True).start()
    return {"success": True}


def instance_stop(name):
    if not (INSTANCES_DIR / name / ".env").exists(): return {"error": "No existe"}
    cmd, env = compose_cmd(name, "stop")
    # v1.5 (C2): parar 8 contenedores puede pasar de 60s — sin catch, TimeoutExpired rompía la conexión
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=300, env=env, creationflags=NO_WINDOW)
    except subprocess.TimeoutExpired:
        return {"error": "El cerebro es grande y está tardando en pararse — espera un momento y vuelve a intentarlo"}
    if r.returncode != 0: return {"error": r.stderr or r.stdout}
    _list_invalidate()
    return {"success": True}


def instance_remove(name):
    if not (INSTANCES_DIR / name / ".env").exists(): return {"error": "No existe"}
    cmd, env = compose_cmd(name, "down", "--rmi", "local")
    down_err = ""
    # v1.5 (C3): igual que stop — down pesado nunca rompe la conexión
    try:
        subprocess.run(cmd, capture_output=True, text=True, timeout=300, env=env, creationflags=NO_WINDOW)
    except subprocess.TimeoutExpired:
        down_err = "El cerebro es grande y ha tardado en apagarse — la carpeta ya está borrada; si sigue apareciendo en Docker, reintenta en un minuto"
    # v1.5 (C5): cerrar el log de un arranque en curso — sin esto, borrar+recrear+iniciar
    # dejaba el nombre bloqueado con "Ya se está iniciando" (worker fantasma)
    with LOG_LOCK:
        buf = START_LOGS.get(name)
        if buf is not None and not buf.get("done"):
            buf["lines"] = (buf["lines"] + ["Cerebro eliminado — arranque cancelado"])[-200:]
            buf.update(done=True, ok=False)
    inst = INSTANCES_DIR / name
    if inst.exists(): shutil.rmtree(inst, ignore_errors=True)
    _list_invalidate()
    return {"error": down_err} if down_err else {"success": True}


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


def start_docker():
    """v1.5 (U4): botón 'Arrancar Docker' — Docker Desktop instalado pero parado.
    El usuario no debe buscarlo en el menú Inicio: la página sigue sola al volver."""
    if not IS_WIN:
        return {"error": "En Linux, arranca el servicio de Docker desde una terminal"}
    _refresh_path()
    ok, _, _ = _probe("docker", _KNOWN["docker"])
    if not ok:
        return {"error": "Docker no está instalado — usa «Instalar dependencias» arriba"}
    rc, _, _ = run(["docker", "info"], timeout=10)
    if rc == 0:
        return {"success": True, "ya": True}
    dd = Path(r"C:\Program Files\Docker\Docker\Docker Desktop.exe")
    if not dd.exists():
        return {"error": "No encuentro Docker Desktop — ábrelo tú desde el menú Inicio"}
    subprocess.Popen([str(dd)], creationflags=NO_WINDOW)
    return {"success": True}


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
        # v1.5 (U1): informativo, NO requisito — se descargan solas al primer arranque.
        # Contarlas como "faltantes" daba un chip rojo en instalaciones perfectas.
        per.append({"name": "Imágenes base", "ok": len(have) == 3, "info": True,
                    "version": "ya descargadas" if len(have) == 3 else "se descargan solas (~3GB) al primer inicio", "url": ""})
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
        try:
            self._do_GET()
        except Exception as e:
            # v1.5 (C-all): NINGÚN error rompe la conexión — siempre JSON legible
            try: self._json({"error": f"Error inesperado: {e}"}, 500)
            except Exception: pass

    def _do_GET(self):
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
            # v1.5 (C4): las tareas del gestor llevan prefijo task: — un cerebro llamado 'setup' tiene SU propio log
            if not (valid_name(name) or name in ("task:setup", "task:deps", "task:move", "task:dockermove", "task:relocate", "task:update")):
                self._json({"error": "Nombre inválido"}, 400); return
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
        try:
            self._do_POST()
        except Exception as e:
            # v1.5 (C-all): NINGÚN error rompe la conexión — siempre JSON legible
            try: self._json({"error": f"Error inesperado: {e}"}, 500)
            except Exception: pass

    def _do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(length)) if length else {}
        except Exception:
            self._json({"error": "Datos no válidos"}, 400); return
        if self.path == "/api/create":
            name = body.get("name", "").strip()
            if not name: self._json({"error": "nombre vacío"}, 400); return
            if len(name) > 64:  # v1.5 (C1): rutas >260 chars rompían mkdir/bind mounts — y crash sin JSON
                self._json({"error": "El nombre es demasiado largo — 64 caracteres como mucho"}, 400); return
            if not re.fullmatch(r"[A-Za-z0-9_-]+", name):
                self._json({"error": "Solo letras, números, guiones y guiones bajos"}, 400); return
            if name.lower() == SYSTEM_SUBDIR.lower():  # v1.5: es la carpeta del sistema
                self._json({"error": "Ese nombre está reservado para el sistema — elige otro"}, 400); return
            self._json(instance_create(name)); return
        if self.path == "/api/download-project":
            self._json(download_project(body.get("dest", ""))); return
        if self.path == "/api/install-deps":
            self._json(install_deps()); return
        if self.path == "/api/start-docker":
            self._json(start_docker()); return
        if self.path == "/api/update-system":
            self._json(update_system()); return
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
