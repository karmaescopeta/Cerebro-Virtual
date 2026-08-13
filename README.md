# Cerebro Virtual

Tu segundo cerebro: un sistema de conocimiento personal que organiza lo que lees, lo que aprendes y lo que generas. Todo en tu propio ordenador, sin depender de servicios externos para guardar tus datos.

---

## ¿Qué necesitas antes de empezar?

Solo dos cosas, ambas gratis:

1. **Docker Desktop** — el motor que hace funcionar Cerebro Virtual.
   - Descárgalo de https://www.docker.com/products/docker-desktop/
   - Instálalo y ábrelo una vez (debe quedar corriendo en segundo plano, lo verás en la barra de tareas).

2. **Una clave de OpenRouter** — para que la IA funcione.
   - Ve a https://openrouter.ai/ y créate una cuenta (gratis).
   - Entra en https://openrouter.ai/keys y pulsa "Create Key".
   - Copia la clave que te da (empieza por `sk-or-...`). La necesitarás más abajo.

> ¿No quieres usar la IA todavía? Puedes saltarte la clave y usar Cerebro Virtual como organizador de documentos. La IA es opcional, el vault funciona sin ella.

---

## Instalación en 4 pasos

Piensa en esto como montar un mueble: descargas, desempaquetas, pones tus llaves, y enciendes.

### 1. Descargar Cerebro Virtual

Necesitas tener **Git** instalado (viene con Docker Desktop en Windows, o descárgalo de https://git-scm.com/).

Abre una terminal (en Windows: botón derecho en una carpeta → "Abrir terminal" o "Git Bash") y ejecuta:

```bash
git clone https://github.com/karmaescopeta/Cerebro-Virtual.git
cd Cerebro-Virtual
```

Esto baja el proyecto a tu ordenador y entra dentro de la carpeta.

### 2. Configurar tus llaves (una sola vez)

Hay un archivo llamado `.env.example` que sirve de plantilla. Vas a crear tu propia versión con tus datos:

**En Windows (Git Bash o PowerShell):**
```bash
copy .env.example .env
```

**En Mac / Linux:**
```bash
cp .env.example .env
```

Ahora abre el archivo `.env` que acabas de crear con cualquier editor de texto (Bloc de notas, VS Code, lo que sea). Verás algo así:

```
COMPOSE_PROJECT_NAME=cerebrovirtual
OPENROUTER_API_KEY=
BACKEND_PORT=8000
FRONTEND_PORT=5173
AGENT_PORT=8080
SEARXNG_PORT=8888
CLOUDFLARE_TUNNEL_TOKEN=
VAULT_HOST_PATH=
GITHUB_REPO=
```

Rellena solo lo que necesites:

- **`OPENROUTER_API_KEY=`** → pega aquí tu clave de OpenRouter (la que empieza por `sk-or-...`). Sin espacios.
- **`VAULT_HOST_PATH=`** → la ruta completa a la carpeta `vault` dentro del proyecto. Ejemplos:
  - Windows: `C:\Users\tuusuario\Cerebro-Virtual\vault`
  - Mac/Linux: `/home/tuusuario/Cerebro-Virtual/vault`
- Lo demás déjalo como está, salvo que sepas que otro programa usa esos puertos.

Guarda el archivo y ciérralo. Ese archivo `.env` es **solo tuyo**: no se sube a internet, no lo ve nadie más.

> ¿Quieres acceder a tu Cerebro desde fuera de casa (móvil, otro PC)? Entonces sí necesitas un token de Cloudflare Tunnel. Es opcional y lo puedes configurar más adelante desde el propio Cerebro, en Ajustes. Si no sabes qué es esto, ignóralo.

### 3. Encender Cerebro Virtual

**En Windows:**
- Haz doble clic en `start.bat` (o ejecútalo desde la terminal).

**En Mac / Linux:**
```bash
./start.sh
```

**A mano (cualquier sistema):**
```bash
docker compose up -d --build
```

La primera vez tarda varios minutos: descarga imágenes y construye los contenedores. Las siguientes veces es casi instantáneo. No cierres la terminal hasta que veas que terminó.

### 4. Abrirlo en el navegador

Ve a:

- **http://localhost:5173** → la interfaz principal (dashboard, wizard, chat, grafo, ajustes).

Si cambiaste `FRONTEND_PORT` en tu `.env`, sustituye `5173` por ese puerto.

---

## ¿Qué verás?

Una interfaz oscura (estilo Obsidian) con:

- **Dashboard** — vista general del sistema.
- **Cerebro** — tus documentos y archivos procesados.
- **Chat** — habla con la IA. Sube archivos, haz preguntas, genera resúmenes.
- **Grafo** — visualización de cómo se conecta tu conocimiento.
- **Modelos** — qué IA usa cada parte del sistema.
- **Ajustes** — configuración, copias de seguridad, túnel de acceso remoto.

---

## Actualizar a una nueva versión

Cuando haya cambios, actualiza así:

```bash
git pull
docker compose up -d --build
```

Tus datos del vault y tu `.env` no se tocan. Solo se actualiza el código.

---

## Si algo falla

**"Docker no encontrado"** → Docker Desktop no está corriendo. Ábrelo y espera a que el icono de la barra de tareas deje de animar.

**"Puerto en uso"** → Otro programa usa ese puerto. Edita `.env` (cambia `FRONTEND_PORT=5174` por ejemplo) y reinicia.

**"La IA no responde"** → Revisa que tu clave de OpenRouter en `.env` es correcta y tiene saldo. Crea una nueva en https://openrouter.ai/keys si hace falta.

**Ver logs (para diagnosticar):**
```bash
docker compose logs -f backend    # ver qué hace el backend
docker compose logs -f sistema-agente  # ver qué hace el agente IA
```

**Parar todo:**
```bash
docker compose down
```

---

## ¿Dónde se guardan mis datos?

Todo lo que subes y genera Cerebro Virtual vive en la carpeta `vault/` dentro del proyecto. Es solo tuyo, no se sube a internet, no lo ve nadie más. Si borras la carpeta, pierdes tus datos (haz copias con el botón Exportar en Ajustes).

---

## Arquitectura (para curiosos)

```
Cerebro Virtual
├── backend (FastAPI, :8000)   — orquestador, API, wizard
├── frontend (React + Nginx, :5173) — la interfaz que ves
├── sistema-agente (Hermes, :8080)  — la IA, 5 perfiles
├── searxng (:8888)            — buscador web privado
├── herramientas                — Whisper/OCR/PDF bajo demanda
└── cloudflared (opcional)      — túnel de acceso remoto
```

Vault:
```
vault/
├── raw/      → lo que subes (inmutable)
├── wiki/     → conocimiento procesado (Markdown con enlaces)
├── outputs/  → informes generados
└── system/   → config + identidad
```

---

## Tu `.env` es tuyo

El archivo `.env` está excluido del repositorio (en `.gitignore`). Nadie puede ver tus claves. Si alguien clona el repo, solo obtiene la plantilla `.env.example` con campos vacíos. Tú eres el único que conoce tus claves.
