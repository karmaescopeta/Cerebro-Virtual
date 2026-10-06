# Cerebro Virtual

Tu segundo cerebro, en tu propio ordenador. Le das documentos y la IA los lee, los resume y los convierte en conocimiento conectado. Después le preguntas en lenguaje normal y responde usando lo tuyo, no lo que encuentra por ahí. Todo vive en tu disco.

---

## ¿Qué puede hacer?

- **Guardar y organizar documentos.** Sube PDFs, textos, imágenes, audio o vídeo. Cada archivo entra en proyectos que tú nombras y coloreas como quieras.
- **Procesarlos sin que hagas nada.** El sistema extrae el texto (incluye OCR para escaneados y transcripción para audio), lo resume y lo convierte en páginas wiki con enlaces.
- **Chatear con tu conocimiento.** Pregunta en lenguaje natural y responde leyendo tus propios documentos. Si no tiene datos suficientes, te lo dice en vez de inventar.
- **Investigar.** Dale un tema y te devuelve un documento completo, con resumen y lectura a tu nivel (básico, intermedio, experto). Con un clic lo guardas en tu cerebro y queda integrado en el grafo.
- **Ver tu conocimiento.** Un grafo con dos vistas: Estructura (tus carpetas y proyectos) y Neuronas (cómo se conectan los conceptos entre sí).
- **Elegir dónde vive la IA.** En la nube (OpenRouter, el modelo que tú elijas) o 100% local con Ollama, sin que un byte salga de casa. Cambias de un modo a otro con un botón, y cada mensaje muestra un badge de si fue ☁️ nube o 🔒 local.
- **Buscar en internet.** Buscador privado SearXNG integrado: la IA puede buscar en la web cuando se lo pides.
- **Sesiones de chat** que se guardan y puedes retomar.
- **Varios cerebros** en el mismo ordenador, cada uno con su bóveda aislada.
- **Copias de seguridad** del vault completo en un `.tar.gz`, para llevar a otro dispositivo.
- **Acceso remoto opcional** desde el móvil u otro PC vía Cloudflare Tunnel.
- **Actualizaciones desde la interfaz**: la campana te avisa, un clic actualiza y tus datos no se tocan.

---

## ¿Qué necesitas antes de empezar?

Tres cosas, todas gratis:

1. **Virtualización activada** — Docker la necesita para funcionar. La mayoría de ordenadores modernos ya la tienen.
   - **Compruébalo**: abre el Administrador de tareas (`Ctrl+Shift+Esc`) → pestaña **Rendimiento** → **CPU**. Abajo a la derecha dice "Virtualización".
   - **Si dice "Habilitado"**: listo, salta al punto 2.
   - **Si dice "Deshabilitado"**: hay que activarla en la BIOS/UEFI (es seguro, solo cambia un ajuste):
     1. Reinicia el ordenador y pulsa la tecla de entrada a BIOS/UEFI mientras arranca — suele ser **Supr**, **F2** o **F10** (depende del fabricante; si no sabes cuál es, busca "cómo entrar en la BIOS + tu marca de ordenador").
     2. Busca un ajuste llamado **"Intel Virtualization Technology"** (o "VT-x", "Intel VT-x") en procesadores Intel, o **"SVM Mode"** en AMD. Suele estar en Advanced, CPU Configuration o similar.
     3. Actívalo (**Enabled**), guarda y sal (normalmente **F10** = guardar y reiniciar).
     4. Al volver a Windows, activa las características de Windows: Panel de control → Programas → "Activar o desactivar las características de Windows" → marca **"Plataforma de máquina virtual"** y **"Subsistema de Windows para Linux"** → Aceptar → reinicia si te lo pide. (Opcionalmente, más rápido: abre una terminal y ejecuta `wsl --install`, y reinicia.)
   - Si algo falta, Docker Desktop te avisará él solo al arrancarlo.

2. **Docker Desktop** — el motor que hace funcionar Cerebro Virtual.
   - Descárgalo de https://www.docker.com/products/docker-desktop/
   - Instálalo y ábrelo una vez (debe quedar corriendo en segundo plano, lo verás en la barra de tareas).

3. **Una clave de OpenRouter** — para la IA en la nube.
   - Ve a https://openrouter.ai/ y créate una cuenta (gratis).
   - Entra en https://openrouter.ai/keys y pulsa "Create Key".
   - Copia la clave que te da (empieza por `sk-or-...`). La necesitarás más abajo.

> ¿No quieres depender de la nube? También puedes usar IA local con Ollama (se instala sola desde la pestaña Modelos) o simplemente usar Cerebro Virtual como organizador de documentos. La IA es opcional; el vault funciona sin ella.

---

## Instalación en 2 pasos

Descargas **un solo archivo**, lo abres, y el propio gestor te pregunta lo que necesita. Sin terminal, sin editar archivos a mano.

### 1. Descargar el Gestor de Cerebros

Ve a [Releases](https://github.com/karmaescopeta/Cerebro-Virtual/releases) y descarga el gestor de tu sistema:

- **Windows:** `GestorDeCerebros.exe`
- **Linux:** `GestorDeCerebros-linux` (tras descargar: `chmod +x GestorDeCerebros-linux && ./GestorDeCerebros-linux`)

> El ejecutable de Windows no está firmado: al abrirlo por primera vez Windows muestra SmartScreen → pulsa **"Más información" → "Ejecutar igualmente"**.

Doble clic. Se abre tu navegador con el gestor, que te guía solo:

1. Primero pregunta **"¿Ya tienes Cerebro Virtual instalado en este ordenador?"** — si es tu primera vez, elige **"No — instalarlo ahora"**.
2. Llega la pregunta **"¿Dónde guardo tus cerebros?"** — se abre el explorador de archivos de toda la vida: navega hasta la carpeta que quieras (por ejemplo `D:\`) y crea una nueva si hace falta. Vale cualquier disco. (Opcional: marca *"Instalar aquí también todo lo que Docker descarga"* para liberar espacio del disco de Windows.)
3. Pulsa **"Instalar en esta carpeta"** — el gestor descarga e instala el sistema (~un minuto), con una pantalla de progreso en todo momento.
4. Mientras, mira los **requisitos** (Docker, etc.): si falta algo, el botón **"Instalar dependencias"** lo instala todo de golpe (acepta el aviso de Windows). Si Docker ya está instalado pero parado, el botón **"Arrancar Docker"** lo enciende por ti.

Dentro de la carpeta que elijas queda esta estructura:

```
la carpeta que elegiste\
└── gestor_de_cerebros\        ← tus cerebros: una carpeta por cada uno
    ├── cerebro1\               ← un cerebro = una carpeta con su nombre
    │   └── vault\              ← los datos de ESE cerebro, aquí y solo aquí
    ├── cerebro2\
    │   └── vault\
    └── imagen_Sistema_Base\    ← el programa en sí (no hace falta tocarlo)
```

Cada cerebro con todos sus archivos vive en su propia carpeta, con su nombre. Si algún día quieres buscar a mano tus notas, sabes exactamente dónde están. El programa en sí vive aparte, en `imagen_Sistema_Base`, para que la carpeta de tus cerebros quede limpia y fácil de leer.

> En Windows, el gestor crea un acceso directo en el escritorio la primera vez que lo abres. Puedes moverlo donde quieras: el gestor recuerda dónde vive tu sistema.

### 2. Crear tu primer cerebro

Pulsa **"Nuevo cerebro"**, dale un nombre y dale a **Iniciar**. La primera vez tarda varios minutos (descarga las imágenes de Docker, ~3GB): el panel muestra un reloj, la última línea de actividad y las descargas en español, para que veas que sigue trabajando.

Los **puertos se asignan solos, una única vez, y quedan fijos** para siempre — no hay que configurar nada, y si algún día usas el acceso remoto, no se te desconfigura.

Cuando termine, pulsa **Abrir**: aparece un asistente que te pide la clave de OpenRouter, el nombre de tu agente, una contraseña de acceso y los modelos. Todo trae valores por defecto; solo la clave es imprescindible si quieres usar la nube.

> **¿Necesitas cambiar algo después?** Entra en tu cerebro → pestaña **Ajustes**: desde ahí cambias la clave, los modelos, la contraseña, el túnel de acceso remoto, las copias de seguridad, etc. (Lo del gestor — carpeta del sistema, mudanzas, espacio del disco — está en la **tuerca** de arriba a la derecha del gestor.)

---

## ¿Ya lo tenías instalado? (actualizar o cambiar de ordenador)

El gestor nuevo no necesita reinstalar nada. Al abrirlo, si no encuentra tu sistema, la primera pregunta es si ya lo tienes instalado — y todo lo demás vive en **Ajustes** (la tuerca, arriba a la derecha):

- **"Usar un sistema ya instalado"** — le dice al gestor dónde vive tu sistema (porque acabas de bajar un gestor nuevo, o porque moviste la carpeta a mano). Señalas la carpeta y al momento aparecen todos tus cerebros. No copia ni mueve nada.
- **"Cambiar de carpeta o disco"** — muda físicamente el sistema completo a otra carpeta o disco, por ejemplo de `C:` a `D:`. Los cerebros encendidos se apagan un momento durante el traslado y se vuelven a encender solos al terminar.
- **"Liberar espacio del disco de Windows"** — lleva todo lo que Docker descarga desde `C:` a la carpeta de tus cerebros.

Cada ajuste lleva su explicación al lado en el propio panel. Y si el gestor encuentra cerebros instalados en otras carpetas del equipo, te lo avisa y te ofrece centralizarlos.

---

## La interfaz

Una interfaz oscura, estilo Obsidian, con estas pestañas:

- **Dashboard** — vista general del sistema y de tus cerebros.
- **Chat** — la conversación con tu IA (más abajo explicamos sus modos).
- **Cerebro** — tus documentos organizados en proyectos, con un lector/editor integrado.
- **Grafo** — Estructura y Neuronas: cómo se conecta todo lo que sabes.
- **Modelos** — qué IA usa cada parte del sistema, e IA local (Ollama) con descarga de modelos y terminal propia.
- **Actualizaciones** — qué versión hay de cada componente y actualización con un clic.
- **Ajustes** — configuración, copias de seguridad, túnel de acceso remoto.

## El chat y sus modos

Arriba del cuadro de mensaje tienes botones que cambian el comportamiento:

- **Chat normal** — conversación directa con el asistente.
- **Pensamiento profundo** — el modelo se lo piensa más antes de responder. Útil para problemas complicados.
- **Cerebro** — activado, la IA responde **solo con tus documentos**. Lee las páginas wiki de tu vault antes de contestar. Es el modo para "¿qué decía aquel contrato?" en vez de preguntar al mundo.
- **Internet** — la IA busca en la web con el buscador privado SearXNG. Se puede combinar con el modo Cerebro para responder con lo tuyo y lo nuevo.
- **Investigar** — selecciona mensajes de la conversación o escribe un tema, y obtienes un documento completo: resumen arriba, desarrollo abajo, con tu nivel de lectura elegido. Puedes editarlo en el visor, guardar el borrador o añadirlo al cerebro, donde entra directamente al grafo.

Las conversaciones se guardan en sesiones: cierras, vuelves, y sigues donde estabas.

---

## Actualizar a una nueva versión

La campana de la interfaz te avisa cuando hay versión nueva. Pulsas, revisas el changelog, y el sistema descarga y reconstruye los contenedores él solo (con copia de seguridad y vuelta atrás automática si algo falla).

Tus datos (el vault, tus cerebros, tu configuración) no se tocan. Solo se actualiza el código.

---

## Si algo falla

Todo esto se resuelve desde el gestor o desde la propia interfaz — sin terminales:

**El gestor dice que falta Docker** → En la pantalla de requisitos, el botón **"Arrancar Docker"** lo enciende por ti. Si no aparece, usa **"Instalar dependencias"** y acepta el aviso de Windows. El gestor detecta solo cuándo Docker está listo (la página se refresca cada pocos segundos).

**Docker se queja de virtualización / WSL / Hyper-V** → Tu ordenador no tiene la virtualización activada. Arriba, en "¿Qué necesitas antes de empezar?", el paso 1 explica cómo activarla (es un cambio en la BIOS + una característica de Windows + reinicio).

**La instalación no avanza** → Normal. La primera vez se descargan ~3GB de imágenes y tarda varios minutos. El panel de instalación del gestor muestra un reloj y la última línea de actividad para que veas que sigue trabajando. No cierres esa página.

**"La IA no responde"** → Entra en tu cerebro (botón **Abrir**) → **Ajustes** y comprueba que tu clave de OpenRouter es correcta y tiene saldo. Crea una nueva en https://openrouter.ai/keys si hace falta.

**Un cerebro no arranca / se quedó a medias** → En la tabla de cerebros, **Parar** y vuelve a dar a **Iniciar**. El panel del gestor muestra el log completo del arranque: la última línea dice qué pasó. Si un cerebro grande tarda en pararse, el gestor te lo dice — dale un momento y reintenta.

**Cosas raras con puertos** → No los toques: cada cerebro recibe sus puertos automáticamente la primera vez y quedan fijos (dos cerebros nunca comparten puertos). Si un día el gestor avisa de que otro programa ocupó el puerto de un cerebro, cierra ese programa y vuelve a dar a **Iniciar** — el cerebro no cambia de puertos.

**Nada de esto funciona** → Abre un [issue](https://github.com/karmaescopeta/Cerebro-Virtual/issues) pegando las últimas líneas del panel del gestor.

### Para técnicos

Si prefieres los comandos, los logs también están a un paso:
```bash
docker compose logs -f backend           # qué hace el backend
docker compose logs -f sistema-agente    # qué hace el agente IA
docker compose down                      # parar todo
```

---

## ¿Dónde se guardan mis datos?

Todo lo que subes y genera un cerebro vive en `vault/`, dentro de la carpeta con su nombre: `gestor_de_cerebros\<nombre del cerebro>\vault\`. Es solo tuyo: no se sube a internet y no lo ve nadie más. Si borras esa carpeta, pierdes los datos de ese cerebro (haz copias con el botón Exportar en los Ajustes de la app, dentro de tu cerebro).

¿Lo quieres en otro disco? **Ajustes (la tuerca, arriba a la derecha) → "Cambiar de carpeta o disco"** en el gestor hace la mudanza solo. El mismo panel tiene **"Liberar espacio del disco de Windows"**: mueve todo lo que Docker descarga (suelen ser varios GB) desde `C:` a la carpeta de tus cerebros.

---

## Acceso remoto: Cloudflare Tunnel (opcional)

Si solo vas a usar Cerebro Virtual en este ordenador, **ignora esta sección**. Es para entrar desde el móvil, una tablet u otro PC fuera de casa.

Cloudflare Tunnel crea un pasadizo cifrado entre tu Cerebro y una dirección pública. Tu router no se abre, tu IP no se expone, y el acceso lo controlas desde Cloudflare Zero Trust (por ejemplo, exigiendo login con tu cuenta de Google).

### ¿Cómo se configura?

**Opción fácil (desde la interfaz):** Ajustes → sección del túnel → pega tu token ahí. El sistema lo guarda y activa el túnel.

**Opción manual (editando `.env`):** pega el token en el `.env` del cerebro (`gestor_de_cerebros\<nombre del cerebro>\.env`):

```
CLOUDFLARE_TUNNEL_TOKEN=eyJ...todo-el-token...
```

Y vuelve a dar a **Iniciar** en el gestor (el túnel se activa solo al arrancar).

Para conseguir el token:
1. Crea una cuenta gratis en https://one.dash.cloudflare.com/
2. En el panel: **Networks → Tunnels → Create a tunnel**.
3. Sigue los pasos. Te dará un token largo (empieza por `eyJ...`).
4. Configura el túnel para que apunte a `http://frontend:80` — es la dirección interna del cerebro y no depende de los puertos que tenga asignados.

Con eso, accedes desde el móvil con la URL que te dé Cloudflare.

### ¿Y si no lo quiero?

No lo configures: Cerebro funciona igual, solo en `localhost`. Si ya lo activaste y quieres quitarlo: Ajustes → "Desactivar túnel", o borra el token del `.env` y reinicia.

---

## Para los técnicos

Aquí va lo que un perfil más técnico querrá saber antes de tocar nada.

### Arquitectura

Todo corre en Docker Compose, una red privada por instancia:

```
Cerebro Virtual
├── backend        (FastAPI, :8000)        — orquestador: API, vault, grafo, jobs, updates
├── frontend       (React + Nginx, :5173)  — la interfaz
├── sistema-agente (Hermes Agent, :8080)   — la IA, con perfiles y su propio panel
├── omniroute      (:20128)                — gateway multi-proveedor de modelos
├── ollama                                 — IA local, volumen persistente de modelos
├── searxng        (:8888)                 — metabuscador privado
├── herramientas                           — Whisper / OCR / markitdown bajo demanda
└── cloudflared    (opcional)              — túnel de acceso remoto
```

El backend orquesta al agente vía `hermes chat` dentro del contenedor: los perfiles se cargan con la variable `HERMES_CONFIG` y el modelo se elige por llamada (`--provider custom -m <modelo>`). Cerebro Virtual **no es un fork de Hermes**: es una capa encima. Config, perfiles y vault viven en volúmenes externos; el único código que toca Hermes es un patch de autenticación del dashboard, idempotente y a prueba de fallos, así que las actualizaciones de Hermes no rompen el proyecto.

### El vault

```
vault/
├── raw/      → lo que subes (inmutable, original)
├── wiki/     → conocimiento procesado (Markdown enlazado)
├── outputs/  → informes y documentos generados
└── system/   → graph.json, agent-config, etiquetas, identidad
```

### RAG grafo-primero

En modo Cerebro no hay búsqueda vectorial: el chat consulta primero `vault/system/graph.json`, el índice de nodos y aristas, recupera las páginas wiki asociadas y responde con ese contexto, dando prioridad al contexto más reciente sobre el historial de sesión. Si el grafo no cubre la pregunta, el agente lo dice en vez de rellenar.

El grafo lo construye **Graphify**: cada archivo que entra al cerebro genera sus neuronas (nodos y aristas) en un trabajo en segundo plano, con reintentos; si el resultado sale vacío, se marca en rojo en lugar de fingir éxito. Al editar un archivo se re-grafía solo ese archivo, y la escritura del contenido crudo es instantánea (el formateo con LLM va después, en background), así que el RAG ve tus cambios en segundos.

### Modelos: OmniRoute como gateway

Ni el frontend ni el agente hablan directamente con OpenRouter: todo pasa por OmniRoute, que expone **combos**, listas ordenadas de modelos con estrategia de prioridad. Los combos de nube llevan prefijo de proveedor (`openrouter/...`) y los locales (`ollama/...`) se generan según el tamaño de los modelos que tengas descargados. El backend provisiona los combos al arrancar (de forma idempotente) y los sincroniza con la configuración del agente. Ventaja práctica: si el primer modelo de un combo falla o se agota, enruta al siguiente sin que hagas nada.

La extracción de texto de documentos usa `markitdown` (con OCR como respaldo para escaneados y Whisper para audio y vídeo), y la salida siempre es un `.txt` hermano en Markdown que el backend mantiene sincronizado al renombrar o borrar.

### Multi-instancia

Un solo `docker-compose.yml` (en `imagen_Sistema_Base/`) parameterizado: `VAULT_DIR`, `ENV_FILE`, `COMPOSE_PROJECT_NAME` y los puertos vienen del `.env` de cada cerebro (`gestor_de_cerebros\<nombre>\.env`). Cada cerebro es su proyecto de compose con su red aislada; no hay comunicación entre instancias. Los puertos los asigna el gestor automáticamente la primera vez que enciendes cada cerebro y a partir de ahí quedan fijos en el `.env` — nunca dos cerebros comparten puertos, y los apaga/enciende cuantas veces quieras sin que cambien.

### Seguridad

- Las credenciales (clave OpenRouter, token del túnel, contraseñas) viven en el `.env` del host, excluido del repositorio. El export del vault va sanitizado: no lleva credenciales aunque las tengas dentro del sistema.
- Toda operación de archivos está confinada al vault (validación de rutas en el backend), el HTML renderizado va escapado y los endpoints de configuración validan los valores de modelo en la API, no en scripts del contenedor.
- El túnel se controla desde Cloudflare Zero Trust: puedes exigir login con Google y restringirlo a tu correo.

### Configuración avanzada

El asistente y la pantalla de Ajustes cubren todo el flujo normal. Si quieres preconfigurar algo antes de arrancar (puertos, nombre del proyecto de compose, rutas), existe un `.env` (copia de `.env.example`) que puedes editar a mano. Las variables principales: `COMPOSE_PROJECT_NAME`, `OPENROUTER_API_KEY`, `BACKEND_PORT`, `FRONTEND_PORT`, `AGENT_PORT`, `SEARXNG_PORT`, `CLOUDFLARE_TUNNEL_TOKEN`, `VAULT_HOST_PATH`, `GITHUB_REPO`.

---

## Licencia y contribuciones

Este proyecto es open source. Si algo no funciona o quieres proponer algo, abre un [issue](https://github.com/karmaescopeta/Cerebro-Virtual/issues).
