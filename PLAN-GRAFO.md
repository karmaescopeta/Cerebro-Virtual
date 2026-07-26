# Plan: migración del grafo de conocimiento de Cerebro Virtual

## Estado actual (2026-07-26)

- Backend: `GET /api/wiki/graph` → lee `wiki/**/*.md`, extrae `[[wikilinks]]` con regex, devuelve `{nodes, edges}`.
- Frontend: `GrafoView` en `App.jsx` → SVG circular (`angle = i/N * 2π`), zoom, leyenda. Sin lib de grafos.
- Importancia: **meramente visual** (el usuario lo mira, no navega por él).
- Escala objetivo: 50-500 nodos, idealmente sin techo.
- Uso real: secundario. Lo principal es chat + RAG.

## Decisión

**No migrar a Graphify.** Graphify es un *analizador* de codebases/papers (tree-sitter + subagentes Claude para extraer relaciones implícitas), no una lib de *visualización*. Cerebro Virtual tiene wikilinks explícitos — las relaciones ya están en el texto, no hay nada que inferir.

**No migrar todavía.** Para 50 nodos el SVG circular basta. Migrar antes de que sea necesario = YAGNI.

## Trigger de migración

Migrar cuando se cumpla **ALGUNO**:

1. El grafo pasa de ~80 nodos y el layout circular se ilegible (nodos apiñados, overlapping de labels).
2. El usuario pide explícitamente grafo navegable (click → abrir página wiki).
3. El usuario quiere agrupación visual por tema/cluster.

Si solo se da #2 o #3 pero el grafo sigue siendo pequeño (<80 nodos), añadir interacción sin cambiar de lib — SVG plano + onClick basta.

## Cuando toque migrar: lib a usar

**D3-force** (no Cytoscape, no vis-network, no Graphify).

Razones ponytail:
- D3 ya es estándar de facto. Mucho material, mucho ejemplo.
- `d3-force` es una lib pequeña, no un framework monolítico.
- Layout force-directed escala bien a cientos/miles de nodos.
- Integración directa con SVG/React — no hay que cambiar el stack.
- Cytoscape es más pesado y su API es más opaca. vis-network es más simple pero menos flexible.

Alternativa válida: **`react-force-graph`** (wrapper React sobre d3-force + WebGL para miles de nodos). Usar **solo** si el grafo pasa de ~1000 nodos — WebGL pinta más rápido que SVG. Para 500 nodos SVG+d3-force sobra.

## Plan de ejecución (cuando el trigger se cumpla)

### Fase 1 — añadir dependencia

```bash
cd "C:\proyectoBueno\cerebro virtual\frontend"
npm install d3-force
```

No instalar `d3` entero (monolítico) — solo `d3-force` para el layout. El render sigue siendo SVG/React como ahora.

### Fase 2 — refactor `GrafoView`

Archivo: `frontend/src/components/views/GrafoView.jsx` (o donde esté en el momento de la migración — buscar `GrafoView` o `WikiGraphView`).

Cambios:
1. Sustituir layout circular (`angle = i/N * 2π`) por simulación d3-force:
   - `forceManyBody()` — repulsión entre nodos
   - `forceLink(edges)` — atracción según aristas
   - `forceCenter()` — centrar el grafo
2. Mantener SVG + `<line>` para edges + `<circle>` + `<text>` para nodes. No migrar a Canvas/WebGL salto a miles de nodos.
3. Mantener zoom/pan actual.
4. Tick de simulación: actualizar state de React en cada tick (o usar `useEffect` + ref para evitar re-renders excesivos — ver si el rendimiento lo pide).

Diff aproximado: ~50-80 líneas. No reescribir el componente entero, solo el cálculo de posiciones.

### Fase 3 — escalado a 500+

Si con d3-force + SVG el rendimiento cae al pasar de 500 nodos:
- Opción A: desactivar `forceSimulation` después de N ticks y congelar posiciones (layout estático).
- Opción B: render WebGL con `react-force-graph` (migración mayor, solo si A no basta).

No preoptimizar. Medir primero.

### Fase 4 — opcional: cluster por tema

Si el usuario quiere agrupación visual:
- `d3-force-cluster` o `forceCollide` con radius por comunidad.
- Comunidad = carpeta de `raw/<topic>/` que generó la página wiki (metadato ya disponible en el nombre del archivo o en el `source_file` inferido del stem).

No implementar Leiden/Louvain — los temas ya están explícitos en la estructura de carpetas del vault. YAGNI.

### Fase 5 — opcional: grafo navegable

Si el usuario pide click → abrir página:
- `onClick` en nodo → cambia tab activa a Chat/Cerebro + pasa `path` del nodo como prop.
- No hace falta nueva ruta ni estado global complicado — un callback al padre (`App.jsx`) basta.

No implementar hasta que el usuario lo pida. "Por ahora lo dejamos" = no hacerlo.

## Lo que NO hay que hacer

- **No** instalar Graphify. No resuelve el problema de Cerebro (visualización de wikilinks explícitos).
- **No** instalar Cytoscape/vis-network sin razón — d3-force es más simple y suficiente.
- **No** añadirá Click-to-navigate hasta que el usuario lo pida explícitamente.
- **No** añadir community detection con Leiden/Louvain — los temas están en carpetas.
- **No** reescribir `GrafoView` entero — shortest diff que sustituya el layout circular por force-directed.
- **No** migrar a WebGL/Canvas antes de que SVG falle a 500 nodos — medir primero.

## Verificación post-migración

1. `npm run build` pasa sin errores.
2. `docker compose up -d --build frontend` sirve el nuevo build.
3. Browser: `http://localhost:5173` → tab Grafo → nodos se distribuyen con force-directed, no en círculo.
4. Zoom/pan sigue funcionando.
5. Nodos azules/grises (con/sin archivo) siguen diferenciados.
6. Crear 10 páginas wiki nuevas con wikilinks → grafo las muestra correctamente.

## Prompt para ejecutar en otra sesión

```
Sesión de desarrollo sobre Cerebro Virtual (proyecto en C:\proyectoBueno\cerebro virtual).
PONYTAIL + CAVEMAN activos. Skill cerebro-virtual cargada.

TAREA: migrar el grafo de conocimiento de layout circular a d3-force.

CONTEXTO:
- Grafo actual: SVG circular en GrafoView (frontend/src/components/views/GrafoView.jsx o App.jsx — buscar "GrafoView" o "WikiGraphView"). Layout: angle = i/N * 2π. Zoom ya implementado.
- Backend: GET /api/wiki/graph devuelve {nodes: [{id, title, path}], edges: [{source, target}]}. NO tocar el backend.
- Decisiones ya tomadas (NO re-abrir):
  * NO usar Graphify (es analizador, no visualizador).
  * NO hacer grafo navegable (click → abrir página) salvo que yo lo pida explícitamente.
  * NO usar Cytoscape/vis-network. d3-force + SVG basta para 500 nodos.
  * NO community detection con Leiden — los temas están en carpetas del vault.
  * NO reescribir GrafoView entero. Shortest diff: sustituir cálculo de posiciones por d3-force, mantener SVG + zoom + leyenda.

PASOS:
1. Lee el skill cerebro-virtual y el componente GrafoView actual antes de tocar nada.
2. npm install d3-force en frontend/.
3. Refactor GrafoView: sustituir layout circular por forceSimulation (forceManyBody + forceLink + forceCenter). Render sigue siendo SVG con <line>, <circle>, <text>.
4. Mantener zoom/pan actual. Mantener colores: azules = página con archivo, grises = wikilink sin archivo.
5. npm run build — debe pasar sin errores.
6. docker compose up -d --build frontend.
7. Verificar en navegador: http://localhost:5173 → tab Grafo → layout force-directed visible.
8. Crear 3-5 páginas wiki de prueba con wikilinks cruzados → grafo las muestra correctamente.

REGLAS:
- Shortest working diff. No reescribir lo que no cambia.
- Deletar dead code del layout circular viejo (angle = i/N * 2π) — no dejar ambas rutas.
- Si el rendimiento cae con >500 nodos, documentarlo y plantear Opción A (congelar posiciones tras N ticks). No migrar a WebGL sin medir primero.
- No añadir onClick a nodos salvo que yo lo pida.

ENTREGABLE:
- Grafo funcional con d3-force, build verde, verificado en navegador.
- Report: qué cambiaste, qué lines borraste, qué skipaste (YAGNI), cuándo migrar a WebGL.
```
