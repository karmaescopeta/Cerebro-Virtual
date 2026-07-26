# Plan: integrar Graphify en Cerebro Virtual (grafo dual + chat potenciado)

## Decisión de diseño

Graphify procesa **todo tipo de archivo** (código, docs, PDFs, imágenes, audio) y genera `graph.json` estructurado con nodos, edges, confidence y relaciones inferidas. El Sintetizador lee ese JSON y genera `wiki/<stem>.md` legible con wikilinks. Dos outputs coexisten:

1. **Grafo "Estructura"** (wikilinks): el actual. Lee `[[wikilinks]]` de `wiki/*.md`. SVG circular. Por proyecto/tema.
2. **Grafo "Neuronas"** (Graphify): nuevo. Lee `graph.json`. SVG con nodos/edges de Graphify. Global, todo el vault.

El chat usa ambos: RAG de texto (wiki/*.md) + graph query (graph.json) para consultas estructuradas.

## Backends de Graphify

Graphify `llm.py` soporta múltiples backends: Claude, OpenAI, Gemini, Ollama, DeepSeek, Kimi, Azure, Bedrock.

**Config para Cerebro Virtual** (OpenRouter + modelo free):
```
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_API_KEY=<key de OpenRouter>
GRAPHIFY_OPENAI_MODEL=google/gemma-2-9b-it:free
```

Graphify Pass 1 (código, tree-sitter) = gratis, sin LLM.
Graphify Pass 3 (docs/PDF/imagen, Gemma free) = gratis, OpenRouter.

Pass 2 (Whisper) NO se usa — Cerebro ya tiene `cerebro-herramientas` con Whisper.

## Arquitectura

```
Usuario sube archivo (cualquier tipo)
      ↓
POST /api/vault/upload?topic=<t>
      ↓
Backend detecta tipo:
  ├── Código (.py, .js, ...) → Graphify Pass 1 (tree-sitter, gratis)
  ├── Audio/video            → cerebro-herramientas Whisper (actual)
  ├── PDF/doc/imagen/txt     → cerebro-herramientas OCR/PDF (actual)
  └── Markdown               → texto directo (actual)
      ↓
Texto extraído + archivo original → Graphify Pass 3 (Gemma free, OpenRouter)
      ↓
graph.json (nodos, edges, confidence)
      ↓
Sintetizador Hermes lee graph.json → wiki/<stem>.md con [[wikilinks]]
      ↓
  ┌────────────────┐          ┌──────────────────┐
  │ wiki/*.md       │          │ graph.json       │
  └───────┬────────┘          └────────┬─────────┘
          ↓                            ↓
  GET /api/wiki/graph           GET /api/graph/full
  (regex wikilinks)             (lee graph.json)
          ↓                            ↓
  GrafoView: "Estructura"       GrafoView: "Neuronas"
  SVG circular                  SVG (circular por ahora)
  azules = con archivo           colores por confidence:
  grises = sin archivo           verde = EXTRACTED
                                amarillo = INFERRED
                                rojo = AMBIGUO

Chat: "¿qué sabes de X?"
      ↓
POST /api/chat
      ↓
Backend:
  1. search_vault(query) → texto de wiki/*.md (RAG actual)
  2. search_graph(query) → nodos/edges relevantes de graph.json
  3. Combina ambos contextos
      ↓
docker exec cerebro-agente hermes chat -q "<msg + contexto combinado>"
      ↓
Coordinador → (delega si complejo) → respuesta
```

## Cambios necesarios

### 1. Contenedor `cerebro-herramientas`

Instalar Graphify + dependencias en `herramientas/Dockerfile`:

```dockerfile
RUN pip install graphify networkx tiktoken
```

Si Graphify no está en PyPI:
```dockerfile
RUN pip install git+https://github.com/Graphify-Labs/graphify.git@f5a3592882ad54e5394c5cd5391786a589110bd1
```

Variables de entorno en `docker-compose.yml` (servicio `cerebro-herramientas`):
```yaml
environment:
  - OPENAI_BASE_URL=https://openrouter.ai/api/v1
  - OPENAI_API_KEY=${OPENROUTER_API_KEY}
  - GRAPHIFY_OPENAI_MODEL=google/gemma-2-9b-it:free
```

Verificar: `docker exec cerebro-herramientas python -c "from graphify.llm import BACKENDS; print(BACKENDS['openai'])"`.

### 2. Script `run_graphify.sh` en `herramientas/scripts/`

Nuevo script que ejecuta Graphify sobre un archivo o directorio:

```bash
#!/bin/bash
# run_graphify.sh <input_path> <output_dir>
# Ejecuta Graphify Pass 1 (código) + Pass 3 (docs) sobre el input.
# Output: graph.json en <output_dir>.
INPUT="$1"
OUTPUT_DIR="$2"
graphify extract "$INPUT" --backend openai --output "$OUTPUT_DIR" --no-pass-2
```

> `--no-pass-2` skipa Whisper (Cerebro ya lo tiene). Flag exacta a verificar en `graphify --help`.

### 3. Backend `backend/app/main.py`

#### 3a. Pipeline de upload/process modificado

En `/api/vault/upload` y `/api/vault/process`:
1. Extraer texto (flujo actual: Whisper/OCR/PDF/txt).
2. **Nuevo**: ejecutar Graphify sobre el archivo original + texto extraído → `graph.json` parcial.
3. Merge con `graph.json` global del vault.
4. Pasar graph.json parcial al Sintetizador Hermes → genera `wiki/<stem>.md`.
5. Guardar ambos: `wiki/<stem>.md` + actualizar `vault/system/graph.json`.

```python
# Pseudocódigo del pipeline modificado
def process_upload(file_path, topic):
    # 1. Extraer texto (actual)
    extracted_text = extract_text(file_path)  # Whisper/OCR/PDF/txt

    # 2. Graphify extrae estructura
    graphify_result = docker_run("cerebro-herramientas",
        f"run_graphify.sh {file_path} /tmp/graphify-out")

    # 3. Merge con graph.json global
    merge_graph(graphify_result, "vault/system/graph.json")

    # 4. Sintetizador lee graph.json parcial → wiki.md
    wiki_content = synthesize_wiki_from_graph(graphify_result, extracted_text)

    # 5. Guardar ambos
    save_wiki(wiki_content, stem)
    save_graph_json("vault/system/graph.json")
```

#### 3b. Limpieza de graph.json al borrar archivos

En `_delete_vault_item()` (helper de borrado actual), después de borrar el archivo, limpiar `vault/system/graph.json`:

```python
def _prune_graph_json(source_file):
    # ponytail: O(n) scan, suficiente hasta miles de nodos
    graph_path = "vault/system/graph.json"
    if not os.path.exists(graph_path):
        return
    with open(graph_path) as f:
        graph = json.load(f)
    graph["nodes"] = [n for n in graph["nodes"] if n.get("source_file") != source_file]
    valid_ids = {n["id"] for n in graph["nodes"]}
    graph["edges"] = [e for e in graph["edges"]
                      if e["source"] in valid_ids and e["target"] in valid_ids]
    with open(graph_path, "w") as f:
        json.dump(graph, f)
```

Llamar desde `_delete_vault_item()` con el `source_file` del archivo borrado. Así el grafo "Neuronas" no muestra nodos fantasma tras borrar desde la tab Cerebro.

### 3c. Nuevo endpoint: `GET /api/graph/full`

Devuelve graph.json completo para el grafo "Neuronas":

```python
@app.get("/api/graph/full")
def get_full_graph():
    graph_path = "vault/system/graph.json"
    if not os.path.exists(graph_path):
        return {"nodes": [], "edges": []}
    with open(graph_path) as f:
        return json.load(f)
```

#### 3d. Nuevo endpoint: `GET /api/graph/query`

Búsqueda en el grafo para RAG del chat:

```python
@app.get("/api/graph/query")
def query_graph(q: str, limit: int = 10):
    # Busca nodos cuyo label matchea q → devuelve nodos + edges adyacentes
    graph = load_graph_json()
    matching = [n for n in graph["nodes"] if q.lower() in n["label"].lower()]
    # + edges conectados a esos nodos
    ...
```

#### 3e. RAG del chat ampliado

En `POST /api/chat`:
1. `search_vault(query)` → texto de wiki/*.md (actual).
2. `query_graph(query)` → nodos/edges relevantes de graph.json (nuevo).
3. Combinar: contexto textual + contexto estructural.

```python
def build_chat_context(message):
    text_context = search_vault(message)  # actual
    graph_context = query_graph(message)  # nuevo
    combined = f"Contexto wiki:\n{text_context}\n\nGrafo de conocimiento:\n{graph_context}"
    return combined
```

### 4. Frontend `GrafoView`

Toggle dentro del tab "Grafo":

```
┌─────────────────────────────────────┐
│  [Estructura] [Neuronas]  ← toggle  │
│─────────────────────────────────────│
│                                     │
│         SVG del grafo               │
│                                     │
└─────────────────────────────────────┘
```

- **Estructura**: llama a `GET /api/wiki/graph` (actual). SVG circular. Azules/grises.
- **Neuronas**: llama a `GET /api/graph/full` (nuevo). SVG circular por ahora. Colores por confidence:
  - Verde = EXTRACTED (relación explícita en source)
  - Amarillo = INFERRED (inferida por LLM, con score)
  - Rojo = AMBIGUO (incierta, flagged)
- Toggle via state `viewMode: 'structure' | 'neurons'`.
- Zoom/pan compartido.

Cambios en `GrafoView.jsx` (o `components/views/GrafoView.jsx`):
- State `viewMode`.
- `useEffect` fetch distinto según `viewMode`.
- Render de nodos con color distinto según `viewMode`.
- Labels en edges cuando `viewMode === 'neurons'` (mostrar `relation` + `confidence`).

### 5. `vault/system/graph.json`

Archivo nuevo. Grafo global de Graphify. Se actualiza en cada upload/process. Estructura NetworkX node-link:

```json
{
  "nodes": [
    {"id": "fotosintesis", "label": "Fotosíntesis", "file_type": "document", "source_file": "fotosintesis.pdf"},
    {"id": "cloroplastos", "label": "Cloroplastos", "file_type": "concept", "source_file": "fotosintesis.pdf"}
  ],
  "edges": [
    {"source": "fotosintesis", "target": "cloroplastos", "relation": "occurs_in", "confidence": "EXTRACTED", "confidence_score": 1.0}
  ]
}
```

### 6. Skill `cerebro-virtual`

Añadir `references/graphify-integration.md`:
- Decisión de diseño (grafo dual, OpenRouter+Gemma free)
- Config de backends de Graphify
- Flujo del pipeline modificado
- Endpoints nuevos (`/api/graph/full`, `/api/graph/query`)
- Limitación: Graphify Pass 3 con Gemma free puede ser menos preciso que Claude. Si calidad insuficiente, subir a modelo de pago.

Actualizar SKILL.md:
- Sección "5 Subagentes" → Sintetizador ahora usa Graphify para extraer estructura.
- Sección "Endpoints clave" → añadir `/api/graph/full`, `/api/graph/query`.
- Sección "Grafo de conocimiento" → ahora dual (Estructura + Neuronas).

## Lo que NO se hace

- **No** reemplazar el Sintetizador. Sigue siendo Hermes. Lee graph.json en vez de texto crudo, pero el agente es el mismo.
- **No** crear nuevo subagente. Los 5 se mantienen.
- **No** usar Pass 2 (Whisper) de Graphify. Cerebro ya tiene Whisper.
- **No** migrar GrafoView a D3-force todavía. SVG circular para ambos grafos. Migrar cuando pase de ~80 nodos (plan en PLAN-GRAFO.md).
- **No** usar community detection (Leiden). Temas en carpetas del vault.
- **No** eliminar el grafo de wikilinks. Coexiste con el de Graphify.
- **No** usar graph.json como única fuente del chat. RAG combina texto + grafo.
- **No** exportar a Obsidian. Cerebro tiene su vault.

## Verificación post-implementación

1. `docker compose --profile agent --profile tools up -d --build herramientas` — Graphify instalado.
2. `docker exec cerebro-herramientas python -c "from graphify.llm import BACKENDS; print('ok')"` — Pass 3 disponible.
3. Subir PDF pequeño → `vault/system/graph.json` se crea con nodos/edges.
4. Subir `.py` pequeño → Graphify Pass 1 extrae funciones/calls.
5. `GET /api/graph/full` → devuelve graph.json.
6. `GET /api/wiki/graph` → sigue funcionando (wikilinks).
7. Browser: tab Grafo → toggle "Estructura" muestra wikilinks, toggle "Neuronas" muestra graph.json.
8. Chat: "¿qué sabes de X?" → respuesta usa contexto de wiki + grafo.
9. `npm run build` — sin errores.
10. Subir `.pdf` → flujo actual (Whisper/OCR) sigue funcionando sin Graphify Pass 2.
11. Borrar una página wiki desde tab Cerebro → `GET /api/graph/full` no muestra nodos del archivo borrado. `_prune_graph_json` funciona.

## Prompt para ejecutar en otra sesión

```
Sesión de desarrollo sobre Cerebro Virtual (proyecto en C:\proyectoBueno\cerebro virtual).
PONYTAIL + CAVEMAN activos. Skill cerebro-virtual cargada.

TAREA: integrar Graphify en Cerebro Virtual para procesar todos los archivos (código, docs, PDFs, imágenes) y generar un grafo de conocimiento estructurado (graph.json) que coexiste con el grafo de wikilinks actual. El chat usa ambos para responder.

CONTEXTO:
- Graphify: https://github.com/Graphify-Labs/graphify/tree/f5a3592882ad54e5394c5cd5391786a589110bd1
- Graphify tiene 3 passes: Pass 1 (código, tree-sitter, gratis), Pass 2 (audio/video, Whisper), Pass 3 (docs/PDF/imagen, LLM).
- Solo usamos Pass 1 y Pass 3. Pass 2 NO — Cerebro ya tiene Whisper en cerebro-herramientas.
- Graphify llm.py soporta backend "openai" con OPENAI_BASE_URL configurable. OpenRouter es OpenAI-compatible.
- Config: OPENAI_BASE_URL=https://openrouter.ai/api/v1, GRAPHIFY_OPENAI_MODEL=google/gemma-2-9b-it:free (modelo gratuito).
- Graphify genera graph.json (NetworkX node-link format) con nodes, edges, relation, confidence (EXTRACTED/INFERRED/AMBIGUO).

DECISIONES YA TOMADAS (NO re-abrir):
- Dos grafos coexisten: "Estructura" (wikilinks, actual) y "Neuronas" (Graphify graph.json, nuevo).
- Frontend: un solo tab "Grafo" con toggle interno [Estructura] [Neuronas]. Misma SVG circular. Zoom compartido.
- Sintetizador Hermes NO se reemplaza. Lee graph.json de Graphify y genera wiki/<stem>.md legible. Dos llamadas LLM (Gemma free + Hermes), cero coste.
- Los 5 subagentes se mantienen. No crear nuevos.
- Pass 2 (Whisper) de Graphify NO se usa.
- GrafoView sigue en SVG circular. No migrar a D3-force todavía (ver PLAN-GRAFO.md para cuando migrar).
- No community detection (Leiden). Temas en carpetas del vault.
- No exportar a Obsidian. Cerebro tiene su vault.
- graph.json se guarda en vault/system/graph.json.

PASOS:
1. Lee el skill cerebro-virtual completo. Entiende el flujo actual de upload/process en backend/app/main.py y el GrafoView en frontend.
2. Instala Graphify en cerebro-herramientas:
   - Editar herramientas/Dockerfile: pip install graphify networkx tiktoken (o desde git si no en PyPI).
   - Añadir env vars en docker-compose.yml (servicio cerebro-herramientas): OPENAI_BASE_URL, OPENAI_API_KEY, GRAPHIFY_OPENAI_MODEL.
   - Reconstruir: docker compose --profile tools up -d --build herramientas
   - Verificar: docker exec cerebro-herramientas python -c "from graphify.llm import BACKENDS; print(BACKENDS['openai'])"
3. Crea herramientas/scripts/run_graphify.sh:
   - Recibe: <input_path> <output_dir>
   - Ejecuta: graphify extract <input> --backend openai --output <output_dir> (skip Pass 2 si hay flag).
   - Output: graph.json en output_dir.
4. Modifica backend/app/main.py:
   a. Pipeline de /api/vault/upload y /api/vault/process:
      - Después de extraer texto (flujo actual), ejecutar Graphify sobre el archivo.
      - Merge del resultado con vault/system/graph.json global.
      - Pasar graph.json parcial al Sintetizador → genera wiki/<stem>.md.
      - Guardar wiki + actualizar graph.json.
   b. En _delete_vault_item() (helper de borrado actual): después de borrar, limpiar graph.json de nodos cuyo source_file == archivo borrado. Función _prune_graph_json(source_file) con list comprehension (ver PLAN section 3b). Así el grafo Neuronas no muestra nodos fantasma.
   c. Nuevo endpoint GET /api/graph/full: devuelve vault/system/graph.json completo.
   d. Nuevo endpoint GET /api/graph/query?q=<query>: busca nodos por label, devuelve nodos + edges adyacentes.
   e. Modificar POST /api/chat: además de search_vault(), llamar a query_graph() y combinar contextos.
5. Modifica GrafoView en frontend:
   - Toggle [Estructura] [Neuronas] dentro del tab Grafo.
   - Estructura → GET /api/wiki/graph (actual). Azules/grises.
   - Neuronas → GET /api/graph/full (nuevo). Colores: verde=EXTRACTED, amarillo=INFERRED, rojo=AMBIGUO.
   - Labels en edges cuando viewMode=neurons (relation + confidence).
   - State viewMode. useEffect fetch distinto según modo. Zoom/pan compartido.
6. Actualiza el skill cerebro-virtual:
   - references/graphify-integration.md con decisiones, config, flujo, endpoints nuevos.
   - SKILL.md: actualizar secciones Subagentes, Endpoints, Grafo.
7. Verifica end-to-end:
   - docker compose --profile agent --profile tools up -d --build
   - Subir PDF pequeño → graph.json creado con nodos/edges. wiki/<stem>.md generado.
   - Subir .py pequeño → Graphify Pass 1 extrae funciones/calls.
   - GET /api/graph/full → devuelve graph.json.
   - GET /api/wiki/graph → sigue funcionando.
   - Browser: tab Grafo → toggle Estructura muestra wikilinks, toggle Neuronas muestra graph.json con colores por confidence.
   - Chat: "¿qué sabes de X?" → respuesta usa contexto wiki + grafo.
   - npm run build pasa.
   - Subir audio → flujo Whisper actual sin cambios (Graphify Pass 2 skipado).

REGLAS:
- Shortest working diff. No reescribir el pipeline entero — añadir Graphify como paso extra.
- Deletar dead code si lo hay.
- Si Graphify no soporta --no-pass-2 flag, verificar alternatives (ej: solo procesar archivos no-audio, o filter en backend).
- Si Gemma free no extrae bien (calidad baja), documentarlo y sugerir modelo de pago (ej: google/gemma-2-9b-it sin :free, o claude-3-haiku).
- Ponytail: stdlib primero. Si run_graphify.sh puede ser 5 líneas, no crees módulo Python entero.
- Verificar que OPENROUTER_API_KEY se pasa al contenedor herramientas (env var en docker-compose.yml o -e en docker run).

ENTREGABLE:
- Contenedor cerebro-herramientas con Graphify Pass 1 + Pass 3 funcional (OpenRouter+Gemma free).
- Backend que ejecuta Graphify en upload/process + endpoints /api/graph/full y /api/graph/query.
- Frontend GrafoView con toggle Estructura/Neuronas.
- Chat con RAG ampliado (texto + grafo).
- Skill cerebro-virtual actualizado.
- Report: qué cambiaste, qué skipaste (YAGNI), verificación end-to-end, calidad de extracción de Gemma free.
```
