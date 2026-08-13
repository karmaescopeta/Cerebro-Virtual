# Cerebro Virtual

Tu segundo cerebro: un sistema de conocimiento personal que organiza lo que lees, lo que aprendes y lo que generas. Todo en tu propio ordenador, sin depender de servicios externos para guardar tus datos.

---

## ¿Qué puede hacer Cerebro Virtual?

- **Organizar documentos** — sube PDFs, textos, imágenes, lo que sea. Todo va al vault, estructurado y buscable.
- **Chat con IA** — habla con 5 perfiles especializados (coordinador, editor, indexador, sintetizador, investigador). Cada uno hace lo suyo: el coordinador recibe tu mensaje y decide a quién delegar.
- **Procesar archivos** — cuando subes algo, la IA lo lee, lo resume, lo indexa y lo convierte en páginas wiki con enlaces cruzados.
- **Grafo de conocimiento** — visualización de cómo se conecta todo lo que sabes. Dos modos: Estructura (árbol) y Neuronas (red de conexiones).
- **SearXNG** — buscador web privado integrado. La IA puede buscar en internet sin mandarte a un rastreador.
- **Modelos configurables** — cada perfil puede usar un modelo distinto (DeepSeek, Gemini, etc.) vía OpenRouter. Tú eliges cuál.
- **Exportar / importar vault** — copia de seguridad completa en un `.tar.gz`. Llévatelo a otro dispositivo.
- **Acceso remoto opcional** — conéctate desde el móvil u otro PC vía Cloudflare Tunnel (ver más abajo).
- **Multi-instancia** — puedes tener varios cerebros en el mismo ordenador, cada uno aislado.
- **Todo en tu ordenador** — tus datos no salen a la nube. La IA sí habla con OpenRouter, pero tus documentos se quedan en tu disco.

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

## Instalación en 3 pasos

Descargas, enciendes, y el asistente visual te pregunta lo que necesita. Sin editar archivos a mano.

### 1. Descargar Cerebro Virtual

Necesitas tener **Git** instalado (viene con Docker Desktop en Windows, o descárgalo de https://git-scm.com/).

Abre una terminal (en Windows: botón derecho en una carpeta → "Abrir terminal" o "Git Bash") y ejecuta:

```bash
git clone https://github.com/karmaescopeta/Cerebro-Virtual.git
cd Cerebro-Virtual
```

Esto baja el proyecto a tu ordenador y entra dentro de la carpeta.

### 2. Encender Cerebro Virtual

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

### 3. Abrirlo y configurar con el asistente

Ve a **http://localhost:5173** en tu navegador.

La primera vez, aparece un **asistente visual** (wizard) que te guía paso a paso:

1. **Te pide tu clave de OpenRouter** — la que copiaste antes (empieza por `sk-or-...`). Pégala ahí.
2. **Nombre del agente y personalidad** — puedes dejar los valores por defecto o personalizarlos.
3. **Modelos de IA** — qué modelo usa cada perfil. Hay valores por defecto, no tienes que cambiar nada si no quieres.
4. **Túnel de Cloudflare (opcional)** — si quieres acceso desde el móvil, pega tu token. Si no, sáltalo.

Cuando terminas, el asistente guarda todo y Cerebro Virtual queda listo. No tienes que editar ningún archivo de texto en ningún momento.

> **¿Necesitas cambiar algo después?** Ve a Ajustes (el icono de engranaje en la interfaz). Desde ahí puedes cambiar la clave, los modelos, activar/desactivar el túnel, exportar copias de seguridad, etc.

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

**"Puerto en uso"** → Otro programa usa ese puerto. Si sabes qué es un `.env`, puedes cambiar `FRONTEND_PORT=5174` y reiniciar. Si no, cierra el otro programa.

**"La IA no responde"** → Ve a Ajustes en la interfaz y comprueba que tu clave de OpenRouter es correcta y tiene saldo. Crea una nueva en https://openrouter.ai/keys si hace falta.

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

## Acceso remoto: Cloudflare Tunnel (opcional)

Si solo vas a usar Cerebro Virtual en este ordenador, **ignora esta sección**. Es para acceder desde el móvil, una tablet u otro PC fuera de casa.

Cloudflare Tunnel crea un pasadizo seguro entre tu Cerebro y una dirección pública. Tu router no se abre, tu IP no se expone. Solo tú (con tu cuenta de Google) entras.

### ¿Cómo se configura?

Tienes dos opciones:

**Opción fácil (desde la interfaz):** Abre Cerebro Virtual → Ajustes → busca la sección del túnel → pega tu token ahí. El sistema lo guarda y activa el túnel automáticamente.

**Opción manual (editando `.env`):** Si prefieres hacerlo antes de arrancar, pega el token en tu archivo `.env`:
```
CLOUDFLARE_TUNNEL_TOKEN=eyJ...todo-el-token...
```
Y reinicia con `docker compose up -d`.

Para conseguir el token:
1. Ve a https://one.dash.cloudflare.com/ y créate una cuenta (gratis).
2. En el panel, ve a **Networks → Tunnels → Create a tunnel**.
3. Sigue los pasos. Te dará un **token** largo (empieza por `eyJ...`).
4. Configura el túnel para que apunte a `http://cerebro-frontend:5173` (o el puerto que pusiste).

Ya puedes acceder desde el móvil con la URL que te dé Cloudflare (`https://tu-tunnel.trycloudflare.com` o el dominio que configures).

### ¿Y si no lo quiero?

No lo configures. Cerebro funciona igual, solo en `localhost`. Si ya lo activaste y lo quieres quitar: ve a Ajustes → "Desactivar túnel", o borra el token del `.env` y reinicia.

### ¿Es seguro?

Sí. El túnel va cifrado. El acceso lo controlas desde Cloudflare Zero Trust: puedes exigir login con Google, restringirlo a tu correo, y cerrarlo cuando quieras. Nadie entra sin tu permiso.

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

## El archivo `.env` (avanzado, opcional)

Cerebro Virtual funciona sin que toques ningún archivo de configuración: el wizard y la pantalla de Ajustes lo hacen todo.

Si eres usuario avanzado y quieres cambiar puertos o preconfigurar algo antes de arrancar, existe un archivo `.env` (copia de `.env.example`) que puedes editar. Ese archivo está excluido del repositorio (en `.gitignore`): nadie puede ver tus claves, solo tú.
