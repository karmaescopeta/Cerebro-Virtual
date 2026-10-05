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

## Instalación en 2 pasos

Descargas **un solo archivo**, enciendes, y el propio gestor te pregunta lo que necesita. Sin terminal, sin carpetas que buscar, sin editar archivos a mano.

### 1. Descargar el Gestor de Cerebros

Ve a [Releases](https://github.com/karmaescopeta/Cerebro-Virtual/releases) y descarga el gestor de tu sistema:

- **Windows:** `GestorDeCerebros.exe`
- **Linux:** `GestorDeCerebros-linux` (tras descargar: `chmod +x GestorDeCerebros-linux && ./GestorDeCerebros-linux`)

> El exe de Windows no está firmado: al abrirlo por primera vez Windows muestra SmartScreen → pulsa **"Más información" → "Ejecutar igualmente"**.

Doble clic. Se abre tu navegador con el gestor. Ahí verás:
1. **Los requisitos** (Docker Desktop, etc.) — con enlaces de descarga si falta algo, y un botón **"Instalar dependencias"** que lo instala todo de golpe (te pedirá permiso de Windows, tú solo aceptas).
2. La pregunta **"¿Dónde guardo tus cerebros?"** — se abre el explorador de Windows de toda la vida: navega hasta la carpeta que quieras (por ejemplo `D:\`) y si hace falta creas una carpeta nueva desde el propio explorador. Vale cualquier disco.
3. Pulsa **"Instalar en esta carpeta"** y el gestor descarga el proyecto (~un minuto).

Dentro de la carpeta que elijas se crea esta estructura:

```
la carpeta que elegiste\
└── gestor_de_cerebros\     ← el sistema (código + configuración)
    ├── cerebro1\            ← un cerebro = una carpeta con su nombre
    │   └── vault\           ← tus datos de ESE cerebro, aquí y solo aquí
    ├── cerebro2\
    │   └── vault\
    └── ...
```

Cada cerebro con todos sus archivos vive en su propia carpeta, con su nombre. Si algún día quieres buscar a mano tus notas, sabes exactamente dónde están.

> En Windows, además, el gestor crea solo un acceso directo en el escritorio la primera vez que lo abres. Puedes mover ese acceso directo donde quieras: el gestor recuerda dónde vive tu sistema.

### 2. Crear tu primer cerebro

Pulsa **"Nuevo cerebro"**, dale un nombre y dale a **Iniciar**. La primera vez tarda varios minutos (descarga las imágenes de Docker, ~3GB).

Cuando termine, pulsa **Abrir**: aparece el asistente visual que te pide tu clave de OpenRouter, el nombre de tu agente y los modelos. Todo trae valores por defecto — solo la clave es imprescindible si quieres usar la IA.

> **¿Necesitas cambiar algo después?** Ve a Ajustes (el icono de engranaje en la interfaz). Desde ahí puedes cambiar la clave, los modelos, activar/desactivar el túnel, exportar copias de seguridad, etc.

---

## ¿Ya lo tenías instalado? (actualizar o cambiar de ordenador)

El gestor nuevo no necesita reinstalar nada. Al abrirlo, en la pantalla de tus cerebros:

- **"Abrir carpeta existente"** — le dice al gestor dónde vive tu sistema ya instalado (porque acabas de bajar un gestor nuevo, o porque moviste la carpeta a mano). Señalas la carpeta y al momento aparecen todos tus cerebros. No copia ni mueve nada.
- **"Mover todo a otra carpeta"** — muda físicamente el sistema completo (con todos los cerebros y sus archivos) a otra carpeta o disco: vale para pasar de `C:` a `D:`, por ejemplo. Los cerebros encendidos se apagan un momento durante el traslado y se vuelven a encender solos al terminar. Elige la carpeta con el explorador de Windows; esa carpeta pasa a ser la nueva carpeta del sistema.
- **El icono de "i"** junto a cada botón te explica para qué sirve, por si dudas.

Y si el gestor encuentra cerebros instalados en otras carpetas del equipo, te lo avisa y te ofrece meterlos en tu carpeta central para tenerlo todo junto.

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

Cuando hay una versión nueva, la campana de la interfaz (arriba a la derecha) te avisa: pulsa y sigue los pasos — descarga el código nuevo y reconstruye los contenedores solo.

Tus datos (el vault, tus cerebros, tu `.env`) no se tocan. Solo se actualiza el código.

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

Todo lo que subes y genera un cerebro vive en `vault/`, dentro de la carpeta con su nombre: `gestor_de_cerebros\<nombre del cerebro>\vault\`. Es solo tuyo, no se sube a internet, no lo ve nadie más. Si borras esa carpeta, pierdes los datos de ese cerebro (haz copias con el botón Exportar en Ajustes).

¿Quieres tenerlo en otro disco? Pulsa **"Mover todo a otra carpeta"** en el gestor y toda la mudanza se hace sola. Y si lo que quieres es liberar espacio en `C:` moviendo las imágenes que descarga Docker (~los GB que pesan los contenedores), está el botón **"Mover datos de Docker aquí"** en la sección de Requisitos del gestor.

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
