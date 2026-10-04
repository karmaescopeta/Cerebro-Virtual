import React, { useRef, useState, useEffect, useCallback } from 'react'
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from 'd3-force'
import MarkdownViewer from '../shared/MarkdownViewer'

const confidenceColor = (conf) => ({
  EXTRACTED: 'var(--color-success)',
  INFERRED: 'var(--color-cloud)',
  AMBIGUO: 'var(--color-error)',
}[conf] || 'var(--color-primary)')

function GrafoView({ nodes, edges, refreshKey, projects }) {
  const svgRef = useRef(null)
  const gRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [viewMode, setViewMode] = useState('structure')
  const [hideKidLabels, setHideKidLabels] = useState(false) // ponytail: ojo — oculta labels de las hijas grises
  const [highlightFile, setHighlightFile] = useState(null) // ponytail: archivo seleccionado — luz en 3 niveles (archivo+hijas > proyecto > resto)
  // ponytail: el pseudo-proyecto Individual del backend (#fbff00) es REAL y colorea sus nodos;
  // solo se oculta la fila gris hardcodeada si ya viene en la lista (anti-duplicado)
  const projectsF = projects || []
  const [neuronsGraph, setNeuronsGraph] = useState({ nodes: [], edges: [] })
  const [positions, setPositions] = useState({})
  const [selectedNode, setSelectedNode] = useState(null)       // wiki preview panel
  const [selectedProject, setSelectedProject] = useState(null) // project info panel
  const [selectedNeuron, setSelectedNeuron] = useState(null)   // neuron mini-panel
  const [highlightProject, setHighlightProject] = useState(null)
  const [legendOpen, setLegendOpen] = useState(() => window.matchMedia('(min-width: 769px)').matches)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [wikiContent, setWikiContent] = useState('')
    const [infoOpen, setInfoOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches)
    const [layout, setLayout] = useState(null)          // { positions: { id: {x,y,fixed} } } del servidor
    const [hintOpen, setHintOpen] = useState(false)
      const [rawMap, setRawMap] = useState({})            // archivo → proyecto (verdad del disco)
      const [resetConfirm, setResetConfirm] = useState(false)
    const [simVersion, setSimVersion] = useState(0)     // fuerza re-sim al reiniciar posiciones
    const simRef = useRef(null)
    const dragRef = useRef(null) // { pan: true, startX, startY, panX, panY } | { id, moved }
    const zpRef = useRef({ z: 1, x: 0, y: 0 })
    const pointersRef = useRef(new Map()) // pointerId → {x,y} — pinch con 2 dedos
    const pinchRef = useRef(null)         // { prevDist, prevMid }
    const fixedRef = useRef(new Map())    // id → {x,y} — posiciones fijadas por drag, sobreviven a rebuilds de sim
    const lastTapRef = useRef(null)       // { id, t } — doble tap en móvil libera nodo fijado
    const hierRef = useRef(null)          // id → {parentId, angle, radius} | {x,y} — árbol jerárquico (spring de neurona)
      const saveTimerRef = useRef(null)
      const positionsRef = useRef(null)     // posiciones actuales para auto-aim
        const aimRef = useRef(null)
        const compRef = useRef(null)          // Set de ids del componente del nodo arrastrado
        const snapRef = useRef(null)          // [{node, x, y}] nodos fuera del componente
        const dragStateRef = useRef(null)     // { parentId, kids: [nodeRefs] } — fuerza magnética

    useEffect(() => {
      const mq = window.matchMedia('(max-width: 768px)')
      const on = () => setIsMobile(mq.matches)
      mq.addEventListener('change', on)
      return () => mq.removeEventListener('change', on)
    }, [])

    // ponytail: cargar layout persistido del servidor (posiciones visuales que sobreviven a refresh)
      useEffect(() => {
        fetch('/api/graph/layout').then(r => r.ok ? r.json() : { positions: {} }).then(setLayout).catch(() => setLayout({ positions: {} }))
      }, [])

      // ponytail: mapa archivo → proyecto desde el disco (cubre todos los orígenes, incluidos sueltos)
      useEffect(() => {
        fetch('/api/raw/projects-map').then(r => r.ok ? r.json() : {}).then(setRawMap).catch(() => {})
      }, [])

  const W = 1000, H = 700, cx = W / 2, cy = H / 2

  // ponytail: fetch Neuronas on mount, on viewMode change, and on refreshKey change
  useEffect(() => {
    fetch('/api/graph/full').then(r => r.ok ? r.json() : { nodes: [], edges: [] }).then(setNeuronsGraph).catch(() => {})
  }, [viewMode, refreshKey])

  const activeNodes = viewMode === 'neurons' ? neuronsGraph.nodes : nodes
  const activeEdges = viewMode === 'neurons' ? neuronsGraph.edges : edges
  zpRef.current = { z: zoom, x: pan.x, y: pan.y }
  positionsRef.current = positions

  // ponytail: layout jerárquico — raíz al centro, hijos en anillo, nietos alrededor de su padre (ambos grafos)
    useEffect(() => {
      if (!activeNodes.length) { setPositions({}); return }

      const simNodes = activeNodes.map(n => ({ ...n }))
      const simEdges = activeEdges.map(e => ({ ...e }))
      const byId = new Map(simNodes.map(n => [n.id, n]))
      const place = (n, x, y) => { if (n.fx != null) return; n.x = x; n.y = y; n.vx = 0; n.vy = 0 }

      // 1) fijados: siempre se respetan (drag del usuario)
      simNodes.forEach(n => {
        const f = fixedRef.current.get(n.id) || (() => {
          const lp = layout?.positions?.[n.id]
          if (lp?.fixed) { fixedRef.current.set(n.id, { x: lp.x, y: lp.y }); return lp }
          return null
        })()
        if (f) { n.fx = f.x; n.fy = f.y; n.x = f.x; n.y = f.y }
      })

      // 2) adjacencia
      const adj = new Map()
      simEdges.forEach(e => {
        if (!adj.has(e.source)) adj.set(e.source, [])
        if (!adj.has(e.target)) adj.set(e.target, [])
        adj.get(e.source).push(e.target); adj.get(e.target).push(e.source)
      })

      // 3) clusters jerárquicos: { center (nodo o virtual), groups: [{node|null, kids}] }
      const clusters = []
      const assigned = new Set()
      if (viewMode === 'structure') {
        // árbol: proyecto → archivos → hijas grises; docs sueltos → mini-raíz
        simNodes.filter(n => n.type === 'project' && !assigned.has(n.id)).forEach(root => {
          assigned.add(root.id)
          const groups = (adj.get(root.id) || []).map(y => byId.get(y)).filter(f => f && !assigned.has(f.id)).map(f => {
            assigned.add(f.id)
            const kids = (adj.get(f.id) || []).map(y => byId.get(y)).filter(k => k && !assigned.has(k.id))
            kids.forEach(k => assigned.add(k.id))
            return { node: f, kids }
          })
          clusters.push({ center: root, groups })
        })
        simNodes.filter(n => !assigned.has(n.id) && n.path).forEach(doc => {
          assigned.add(doc.id)
          const kids = (adj.get(doc.id) || []).map(y => byId.get(y)).filter(k => k && !assigned.has(k.id))
          kids.forEach(k => assigned.add(k.id))
          // ponytail: doc suelto = centro, cada hija grisa como grupo en anillo R1 alrededor (spring a doc)
          clusters.push({ center: doc, groups: kids.map(k => ({ node: k, kids: [] })) })
        })
        const rest = simNodes.filter(n => !assigned.has(n.id))
        if (rest.length) clusters.push({ center: null, groups: rest.map(n => ({ node: n, kids: [] })) })
      } else {
        // Neuronas: cluster por proyecto (verdad del disco), sub-grupos por archivo
        const byProject = new Map()
        simNodes.filter(n => n.fx == null).forEach(n => {
          const sf = (n.source_file || '').split('/').pop()
          const pid = rawMap[sf] || 'individual'
          if (!byProject.has(pid)) byProject.set(pid, new Map())
          const byFile = byProject.get(pid)
          if (!byFile.has(sf)) byFile.set(sf, [])
          byFile.get(sf).push(n)
        })
        byProject.forEach((byFile, pid) => {
          clusters.push({ center: null, groups: [...byFile.entries()].map(([sf, arr]) => ({ node: null, sf, kids: arr })) })
        })
        // fijados sueltos → cluster propio (no se mueven)
        const fixedLoose = simNodes.filter(n => n.fx != null && !assigned.has(n.id))
        fixedLoose.forEach(n => assigned.add(n.id))
        if (fixedLoose.length) clusters.push({ center: null, groups: fixedLoose.map(n => ({ node: null, sf: '', kids: [n] })) })
      }

      // 4) radios adaptativos con margen — los anillos de nietos no se solapan entre hermanos
      // ponytail: radio = circunferencia necesaria / 2π. Neuronas compactas (leyenda salta entre clusters),
      // Estructura moderada. spacing ≥ 22px en Neuronas = suelo físico de collide (r7+glow)
      const K = viewMode === 'neurons'
        ? { spacing: 26, r2min: 26, r1min: 70, kRing: 30, margin: 18, ringRmin: 90 }
        : { spacing: 18, r2min: 36, r1min: 115, kRing: 40, margin: 30, ringRmin: 120 }
      const extents = clusters.map(c => {
        const maxR2 = Math.max(...c.groups.map(g => Math.max(K.r2min, ((g.kids?.length || 0) * K.spacing) / 6.283)), K.r2min)
        const R1 = c.center ? Math.max(K.r1min, 2 * maxR2 + K.margin) : Math.max(70, (c.groups.length * K.kRing) / 6.283)
        return { R1, maxR2, R: R1 + maxR2 + K.margin }
      })
      const ringR = Math.max(K.ringRmin, (extents.reduce((s, e) => s + 2 * e.R, 0)) / 6.283)
      const hier = new Map()
      clusters.forEach((c, ci) => {
        const a0 = (ci / Math.max(clusters.length, 1)) * 6.283
        const single = clusters.length === 1
        const ccx = single ? cx : cx + Math.cos(a0) * ringR
        const ccy = single ? cy : cy + Math.sin(a0) * ringR
        if (c.center) {
          place(c.center, ccx, ccy)
          // ponytail: ancla del centro del cluster — la repulsión no arrastra el cluster de su sitio;
          // tras place(), x/y = posición fijada si el usuario la fijó (el drag del usuario siempre gana)
          hier.set(c.center.id, { x: c.center.x, y: c.center.y })
        }
        c.groups.forEach((g, gi) => {
          const ga = a0 + (ci % 2 ? -1 : 1) * (gi / Math.max(c.groups.length, 1)) * 6.283
          const gcx = (c.center ? c.center.x : ccx) + Math.cos(ga) * extents[ci].R1
          const gcy = (c.center ? c.center.y : ccy) + Math.sin(ga) * extents[ci].R1
          const R2 = Math.max(40, ((g.kids?.length || 0) * 20) / 6.283 * 2)
          if (g.node) {
            place(g.node, gcx, gcy)
            hier.set(g.node.id, { parentId: c.center.id, angle: ga, radius: extents[ci].R1 })
          }
          ;(g.kids || []).forEach((k, ki) => {
            const ka = ga + (ki / Math.max(g.kids.length, 1)) * 6.283
            const kx = gcx + Math.cos(ka) * R2, ky = gcy + Math.sin(ka) * R2
            place(k, kx, ky)
            // ponytail: Estructura → cuelga de su archivo (spring vivo). Neuronas → grupo de archivo con centroide vivo (mismo movimiento)
            hier.set(k.id, g.node ? { parentId: g.node.id, angle: ka, radius: R2 } : { ids: g.kids.map(x => x.id), angle: ka, radius: R2 })
          })
        })
      })
      hierRef.current = hier
    if (simRef.current) simRef.current.stop()

    const sim = forceSimulation(simNodes)
      .force('charge', forceManyBody().strength(viewMode === 'neurons' ? -80 : -120))
      .force('link', forceLink(simEdges).id(d => d.id).distance(viewMode === 'neurons' ? 60 : 80).strength(0.3))
      .force('center', forceCenter(cx, cy))
      .force('collide', forceCollide().radius(d => nodeRadius(d) + 4))
      // ponytail: spring de neurona — cada nodo cuelga de su padre (proyecto→archivo→grisa) en su anillo;
      // target se recalcula del padre VIVO cada tick → mover el padre arrastra hijas y nietas
      .force('hier', (alpha) => {
        const hier = hierRef.current
        if (!hier) return
        hier.forEach((h, id) => {
          const n = byId.get(id)
          if (!n || n.fx != null) return
          let tx, ty
          if (h.parentId != null) {
            const p = byId.get(h.parentId)
            if (!p) return
            tx = p.x + Math.cos(h.angle) * h.radius
            ty = p.y + Math.sin(h.angle) * h.radius
          } else if (h.ids) {
            // ponytail: Neuronas — target = centroide VIVO del grupo de archivo + offset polar → el grupo sigue al nodo arrastrado
            let sx = 0, sy = 0, m = 0
            h.ids.forEach(gid => { const g = byId.get(gid); if (g) { sx += g.x; sy += g.y; m++ } })
            if (!m) return
            tx = sx / m + Math.cos(h.angle) * h.radius
            ty = sy / m + Math.sin(h.angle) * h.radius
          } else { tx = h.x; ty = h.y }
          n.vx += (tx - n.x) * 0.12 * alpha
          n.vy += (ty - n.y) * 0.12 * alpha
        })
      })
      // ponytail: repulsión global a corto alcance (hermanas y de clusters distintos) — las neuronas
      // jamás se solapan y los clusters mantienen forma de neurona independientemente de la posición
      .force('sep', (alpha) => {
        const SEP = viewMode === 'neurons' ? 26 : 18
        const nodes = simNodes.filter(n => n.fx == null)
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i], b = nodes[j]
            const dx = b.x - a.x, dy = b.y - a.y
            const dist = Math.hypot(dx, dy)
            if (dist > 0.5 && dist < SEP) {
              const f = (SEP - dist) * 0.08 * alpha
              a.vx -= (dx / dist) * f; a.vy -= (dy / dist) * f
              b.vx += (dx / dist) * f; b.vy += (dy / dist) * f
            }
          }
        }
      })
      .alphaDecay(0.03)

    sim.on('tick', () => {
      const pos = {}
      simNodes.forEach(n => { pos[n.id] = { x: n.x, y: n.y } })
      setPositions(pos)
    })

    const hasLayout = !!(layout && Object.keys(layout.positions).length)
    const newNodes = hasLayout ? simNodes.filter(n => n.fx == null && !layout.positions[n.id]) : []
    if (hasLayout) sim.alpha(newNodes.length ? 0.3 : 0.1) // ponytail: con layout, no se reordena al cargar; si hay nodos nuevos, alpha para asentarlos
    // ponytail: tras reinicio (simVersion>0 sin layout) la colocación ya es correcta — alpha baja + repulsión
    // suave para que la sim no esparza los clusters por todo el campo
    else if (simVersion > 0) {
      sim.alpha(0.3)
      sim.force('charge').strength(viewMode === 'neurons' ? -40 : -60)
    }

    simRef.current = sim
    window.__grafoSim = simRef // ponytail: diagnóstico/verificación en navegador
    window.__grafoHier = hierRef
    window.__grafoComp = compRef
    window.__grafoSnap = snapRef

        return () => sim.stop()
      }, [activeNodes, activeEdges, viewMode, layout, simVersion])

      // ponytail: guardar layout actual del sim en el servidor
      const saveLayout = useCallback(() => {
        if (!simRef.current) return
        const positions = {}
        simRef.current.nodes().forEach(n => {
          positions[n.id] = { x: n.x, y: n.y, fixed: n.fx != null }
        })
        fetch('/api/graph/layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ positions }) }).catch(() => {})
      }, [])

      // ponytail: liberar nodo fijado (dblclick desktop / doble tap móvil) — solo si está fijado
      const releaseNode = useCallback((nodeId) => {
        if (!fixedRef.current.has(nodeId)) return false
        const node = simRef.current?.nodes().find(n => n.id === nodeId)
        if (!node) return false
        node.fx = null; node.fy = null
        fixedRef.current.delete(nodeId)
        simRef.current.alpha(0.3).restart()
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(saveLayout, 2000) // guardar tras asentarse
        return true
      }, [saveLayout])

  // ponytail: fetch wiki content — para archivo seleccionado, o para el PADRE de una neurona (mismo doc)
    useEffect(() => {
      if (selectedNode?.path) {
        fetch(`/vault-static/${selectedNode.path}`).then(r => r.ok ? r.text() : '').then(setWikiContent).catch(() => {})
        return
      }
      if (selectedNeuron && viewMode === 'neurons') {
        const sf = (selectedNeuron.source_file || '').split('/').pop()
        const stem = sf.replace(/\.(md|txt)$/i, '')
        fetch(`/vault-static/wiki/${stem}.md`).then(r => r.ok ? r.text() : '').then(setWikiContent).catch(() => setWikiContent(''))
        return
      }
      setWikiContent('')
    }, [selectedNode, selectedNeuron, viewMode])

  // ponytail: search documents in structure mode
  useEffect(() => {
    if (!searchQuery.trim() || viewMode !== 'structure') { setSearchResults([]); return }
    const q = searchQuery.toLowerCase()
    setSearchResults(activeNodes.filter(n =>
      (n.title || n.id || '').toLowerCase().includes(q) && n.path
    ).slice(0, 10))
  }, [searchQuery, activeNodes, viewMode])

  // ponytail: coords en espacio sim vía CTM del <g> — drag/zoom/pan comparten UNA transformación
  // (arregla drag descolocado con zoom≠1 o pan activo: no hay que compensar a mano)
  const toSim = useCallback((clientX, clientY) => {
    const svg = svgRef.current, g = gRef.current
    if (!svg || !g) return null
    const ctm = g.getScreenCTM()
    if (!ctm) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX; pt.y = clientY
    return pt.matrixTransform(ctm.inverse())
  }, [])

  // ponytail: zoom con rueda hacia el cursor (listener nativo: React onWheel es passive)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e) => {
      e.preventDefault()
      const p = toSim(e.clientX, e.clientY)
      if (!p) return
      const { z, x, y } = zpRef.current
      const z2 = Math.min(3, Math.max(0.4, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
      if (z2 === z) return
      setZoom(z2)
      // el punto sim p bajo el cursor se mantiene fijo: pan' = pan + p*(z - z2)
      setPan({ x: x + p.x * (z - z2), y: y + p.y * (z - z2) })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [activeNodes.length, toSim])

  // ponytail: pointer events cubren mouse + táctil con un solo código (touch-action:none en el svg)
    const trackPointer = (e) => {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointersRef.current.size === 2) {
        // pinch: 2 dedos — cancela cualquier drag y guarda dist/mid iniciales
        dragRef.current = null
        const [a, b] = [...pointersRef.current.values()]
        pinchRef.current = {
          prevDist: Math.hypot(a.x - b.x, a.y - b.y),
          prevMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        }
      }
    }

    const onSvgPointerDown = (e) => {
        if (aimRef.current) { cancelAnimationFrame(aimRef.current); aimRef.current = null }
        trackPointer(e)
      dragRef.current = { pan: true, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ponytail: pointerId sintético/inactivo */ }
    }

    const onNodePointerDown = (e, n) => {
      e.stopPropagation()
      trackPointer(e)
      dragRef.current = { id: n.id, moved: false }
      try { svgRef.current.setPointerCapture(e.pointerId) } catch { /* ponytail: pointerId sintético */ }
    }

    const pinchMove = (e) => {
      if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (!pinchRef.current || pointersRef.current.size < 2) return
      const [a, b] = [...pointersRef.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const { prevDist, prevMid } = pinchRef.current
      pinchRef.current = { prevDist: dist, prevMid: mid }
      const s = svgRef.current?.getScreenCTM()?.a
      if (!s || prevDist <= 0) return
      const p = toSim(mid.x, mid.y)
      if (!p) return
      const { z, x, y } = zpRef.current
      const z2 = Math.min(3, Math.max(0.4, z * (dist / prevDist)))
      if (z2 !== z) {
        setZoom(z2)
        setPan({
          x: x + p.x * (z - z2) + (mid.x - prevMid.x) / s,
          y: y + p.y * (z - z2) + (mid.y - prevMid.y) / s,
        })
      } else {
        setPan({
          x: zpRef.current.x + (mid.x - prevMid.x) / s,
          y: zpRef.current.y + (mid.y - prevMid.y) / s,
        })
      }
    }

    const onPointerMove = (e) => {
      if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointersRef.current.size >= 2) { pinchMove(e); return }
      const d = dragRef.current
      if (!d) return
      if (d.pan) {
        // pan de fondo en unidades SVG (CTM.a = escala viewBox→cliente, uniforme)
        const s = svgRef.current?.getScreenCTM()?.a
        if (!s) return
        setPan({ x: d.panX + (e.clientX - d.startX) / s, y: d.panY + (e.clientY - d.startY) / s })
        return
      }
      const p = toSim(e.clientX, e.clientY)
      const node = simRef.current?.nodes().find(n => n.id === d.id)
      if (!p || !node) return
      // ponytail: las grises se pueden mover pero JAMÁS fijan — al soltar el spring las devuelve a su anillo
      const grayDrag = viewMode !== 'neurons' && !node.path && node.type !== 'project'
      if (!d.moved) {
                  d.moved = true
                  node.fx = p.x; node.fy = p.y
                  // ponytail: charge 0 durante drag — los no enlazados no derivan; solo link force + colisión
                  simRef.current.force('charge').strength(0)
                  // ponytail: vecindad de drag = 1 hop (nodo + vecinos directos) — el resto del grafo NO se toca
                                    const links = simRef.current.force('link').links()
                                    const adj = new Map()
                                    links.forEach(l => {
                                      const s = l.source?.id ?? l.source, t = l.target?.id ?? l.target
                                      if (!adj.has(s)) adj.set(s, [])
                                      if (!adj.has(t)) adj.set(t, [])
                                      adj.get(s).push(t); adj.get(t).push(s)
                                    })
                                    const comp2 = grayDrag
                                      ? new Set([d.id]) // ponytail: arrastrar una gris NO arrastra su archivo — comp = solo ella
                                      : new Set([d.id, ...(adj.get(d.id) || [])])
                                    // ponytail: TODO el subárbol jerárquico sigue al nodo arrastrado (proyecto → archivos → grisas);
                                    // se expande transitivamente por hier (parentId) y por grupo de archivo (ids, modo Neuronas)
                                    let grew = true
                                    while (grew) {
                                      grew = false
                                      hierRef.current?.forEach((h, kid) => {
                                        if (h.parentId != null && !comp2.has(kid) && comp2.has(h.parentId)) { comp2.add(kid); grew = true }
                                        if (h.ids && h.ids.some(id => comp2.has(id))) h.ids.forEach(id => { if (!comp2.has(id)) { comp2.add(id); grew = true } })
                                      })
                                    }
                                    compRef.current = comp2
                                    // ponytail: cancelar tweens/timers del drag ANTERIOR — sin esto, el restore en marcha
                                    // pelea con el nuevo drag (tiembla y hace movimientos extraños al arrastrar rápido)
                                    if (restoreFrameRef.current) { cancelAnimationFrame(restoreFrameRef.current); restoreFrameRef.current = null }
                                    clearTimeout(settleTimerRef.current)
                                    clearTimeout(saveTimerRef.current)
                                    // solo links DENTRO de la vecindad tienen fuerza — los wikilinks a otros docs no empequeñecen nada
                                    simRef.current.force('link').strength(l => comp2.has(l.source?.id ?? l.source) && comp2.has(l.target?.id ?? l.target) ? 0.3 : 0)
                                    // snapshot de posiciones fuera de la vecindad — se restauran al soltar
                                    snapRef.current = simRef.current.nodes().filter(n => !comp2.has(n.id)).map(n => ({ node: n, x: n.x, y: n.y }))
                                    // ponytail: fuerza magnética — todos los vecinos sin fijar se repelen (imanes): cerca del padre, no pegados
                                    dragStateRef.current = { parentId: d.id }
                                    simRef.current.force('magnet', (alpha) => {
                                      const comp = compRef.current
                                      if (!comp || !dragStateRef.current) return
                                      const nodes = simRef.current.nodes().filter(n => comp.has(n.id) && n.fx == null && n.id !== dragStateRef.current.parentId)
                                      const SEP = 60
                                                                            const al = alpha // ponytail: fade suave con el decay — sin suelo que corte en seco
                                                                            for (let i = 0; i < nodes.length; i++) {
                                                                              for (let j = i + 1; j < nodes.length; j++) {
                                                                                const a = nodes[i], b = nodes[j]
                                                                                const dx = b.x - a.x, dy = b.y - a.y
                                                                                let dist = Math.hypot(dx, dy)
                                                                                if (dist < 1) {
                                                                                  // ponytail: par degenerado (uno sobre otro) — empujón aleatorio, si no se queda pegado para siempre
                                                                                  const ang = Math.random() * Math.PI * 2
                                                                                  a.vx -= Math.cos(ang) * 0.5; a.vy -= Math.sin(ang) * 0.5
                                                                                  b.vx += Math.cos(ang) * 0.5; b.vy += Math.sin(ang) * 0.5
                                                                                  continue
                                                                                }
                                                                                if (dist < SEP) {
                                                                                  const f = (SEP - dist) * 0.06 * al // ponytail: suave — el imán separa, no pelea con el spring
                                                                                  a.vx -= (dx / dist) * f; a.vy -= (dy / dist) * f
                                                                                  b.vx += (dx / dist) * f; b.vy += (dy / dist) * f
                                                                                }
                                                                              }
                                                                            }
                                    })
                                    simRef.current.alphaTarget(0.12).restart() // ponytail: alpha bajo durante drag = menos oscilación (tirones)
                } else {
        node.fx = p.x; node.fy = p.y
      }
      // ponytail: auto-pan en el borde durante el drag — la vista sigue para alejar nodos lejos sin soltar
      const rect = svgRef.current?.getBoundingClientRect()
      if (rect) {
        const M = 70, SPD = 9
        const vx = e.clientX - rect.left < M ? SPD : (rect.right - e.clientX < M ? -SPD : 0)
        const vy = e.clientY - rect.top < M ? SPD : (rect.bottom - e.clientY < M ? -SPD : 0)
        if (vx || vy) {
          if (!edgePanRef.current) edgePanRef.current = { id: setInterval(() => {
            const v = edgePanRef.current
            if (v) setPan(p0 => ({ x: p0.x + v.vx, y: p0.y + v.vy }))
          }, 16), vx, vy }
          else { edgePanRef.current.vx = vx; edgePanRef.current.vy = vy }
        } else if (edgePanRef.current) { clearInterval(edgePanRef.current.id); edgePanRef.current = null }
      }
    }

    const restoreFrameRef = useRef(null)
    const edgePanRef = useRef(null) // ponytail: {id, vx, vy} — auto-pan mientras arrastro cerca del borde
    const settleTimerRef = useRef(null)
    const restoreRest = () => {
    // ponytail: restauración ANIMADA (tween 600ms) — el teleport instantáneo era el "golpe" a los 3s
    const items = snapRef.current
    if (!items || !items.length) return
    window.__restores = (window.__restores || [])
    window.__restores.push({ t: Date.now() % 1000000, n: items.length, ids: items.slice(0, 4).map(it => it.node.id) })
    if (restoreFrameRef.current) cancelAnimationFrame(restoreFrameRef.current)
    // ponytail: sim PARADA durante el tween — el collide no empuja el subárbol arrastrado mientras el resto vuelve
    simRef.current?.stop()
    const start = items.map(it => ({ x: it.node.x, y: it.node.y }))
    const t0 = performance.now()
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 600)
      const e = 1 - Math.pow(1 - k, 2)
      items.forEach((it, i) => {
        it.node.x = start[i].x + (it.x - start[i].x) * e
        it.node.y = start[i].y + (it.y - start[i].y) * e
      })
      const pos = {}
      simRef.current?.nodes().forEach(n => { pos[n.id] = { x: n.x, y: n.y } })
      setPositions(pos)
      if (k < 1) restoreFrameRef.current = requestAnimationFrame(step)
      else simRef.current?.alpha(0.3).restart() // ponytail: tras el tween, asentamiento con energía — sigue hasta su anillo (Q1)
    }
    restoreFrameRef.current = requestAnimationFrame(step)
    }

      const onPointerUp = (e) => {
          const d = dragRef.current
        dragRef.current = null
        if (edgePanRef.current) { clearInterval(edgePanRef.current.id); edgePanRef.current = null } // ponytail: para el auto-pan al soltar
        pointersRef.current.delete(e.pointerId)
        if (pointersRef.current.size < 2) pinchRef.current = null
        if (simRef.current) {
                simRef.current.alphaTarget(0)
                              // ponytail: NO congelar — los subnodos sin fijar siguen al nodo arrastrado (efecto neurona)
                              // mientras alpha decae naturalmente (~2-3s); charge se quedó en 0, así los no enlazados no derivan
                              if (d && d.id && d.moved) {
                                const node = simRef.current.nodes().find(n => n.id === d.id)
                                const isGray = viewMode !== 'neurons' && node && !node.path && node.type !== 'project'
                                if (node && isGray) { node.fx = null; node.fy = null } // ponytail: gris sin posición fija — el spring la devuelve a su anillo
                                else if (node) fixedRef.current.set(d.id, { x: node.fx, y: node.fy })
                                // ponytail: al soltar se QUITA el imán — sin él, el spring jerárquico asienta el subárbol
                                // en anillos alrededor de la NUEVA posición (el imán residual lo empujaba de vuelta)
                                simRef.current.force('magnet', null)
                                dragStateRef.current = null
                                // ponytail: settle sostenido — alpha mínimo 4s tras soltar: las hijas SIEMPRE
                                // llegan a su anillo (forma de neurona) aunque el drag haya sido rápido
                                simRef.current.alphaTarget(0.05)
                                clearTimeout(settleTimerRef.current)
                                settleTimerRef.current = setTimeout(() => { if (simRef.current) simRef.current.alphaTarget(0) }, 4000)
                                // ponytail: el subárbol arrastrado JAMÁS se restaura a su posición antigua — solo el resto del grafo
                                if (compRef.current) snapRef.current = (snapRef.current || []).filter(it => !compRef.current.has(it.node.id))
                                restoreRest() // ponytail: el resto del grafo vuelve a donde estaba (punto 3)
                            }
            }
            if (!d) return
    if (d.id && !d.moved) {
          // click/doble-tap: doble tap sobre nodo fijado lo libera; sino, seleccionar
          const now = Date.now()
          const isDouble = lastTapRef.current && lastTapRef.current.id === d.id && now - lastTapRef.current.t < 400
          lastTapRef.current = { id: d.id, t: now }
          if (isDouble) {
            releaseNode(d.id)
          } else {
            const n = activeNodes.find(n => n.id === d.id)
            if (n) handleNodeClick(n)
          }
        } else if (d.pan) {
          const dx = e.clientX - d.startX, dy = e.clientY - d.startY
          if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
            // tap en fondo → cerrar selección
            setSelectedNeuron(null); setSelectedNode(null); setSelectedProject(null); setHighlightProject(null); setHighlightFile(null); setInfoOpen(false)
          }
        } else if (d.id && d.moved) {
                  // guardar layout diferido (al asentarse) — con restore del resto por si el settle los movió
                  clearTimeout(saveTimerRef.current)
                  saveTimerRef.current = setTimeout(() => { restoreRest(); saveLayout() }, 3000)
                }
          }

          // ponytail: doble click libera el nodo fijado
  const onNodeDoubleClick = (e, nodeId) => {
      e.stopPropagation()
      releaseNode(nodeId)
    }

  // ponytail: handle project click from legend — auto-aim: anima la vista hacia el nodo del proyecto
    const handleProjectClick = (proj) => {
      setSelectedProject(proj)
      setSelectedNode(null)
      setSelectedNeuron(null)
      const wasSelected = highlightProject === proj.id
      setHighlightProject(prev => prev === proj.id ? null : proj.id)
      if (!wasSelected) aimAtProject(proj.id)
    }

    // ponytail: auto-aim en modo neuronas — apunta al centroide de las neuronas del proyecto
    const aimAtProject = (pid) => {
      if (viewMode === 'neurons') {
        const ps = activeNodes.filter(n => neuronProject(n.id) === pid)
          .map(n => positionsRef.current?.[n.id]).filter(Boolean)
        if (ps.length) {
          const ax = ps.reduce((s, p) => s + p.x, 0) / ps.length
          const ay = ps.reduce((s, p) => s + p.y, 0) / ps.length
          const z2 = Math.max(zpRef.current.z, 1.6)
          tweenView(z2, { x: W / 2 - ax * z2, y: H / 2 - ay * z2 }, 400)
          return
        }
      }
      aimAt(pid)
    }

    // ponytail: auto-aim — anima pan+zoom hasta centrar el nodo (~400ms)
    const tweenView = (z2, tp, ms = 450) => {
      const start = { z: zpRef.current.z, x: zpRef.current.x, y: zpRef.current.y }
      if (aimRef.current) cancelAnimationFrame(aimRef.current)
      const t0 = performance.now()
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / ms)
        const e = 1 - Math.pow(1 - k, 2)
        setZoom(start.z + (z2 - start.z) * e)
        setPan({ x: start.x + (tp.x - start.x) * e, y: start.y + (tp.y - start.y) * e })
        if (k < 1) aimRef.current = requestAnimationFrame(step)
      }
      aimRef.current = requestAnimationFrame(step)
    }
    const aimAt = (nodeId) => {
      const p = positionsRef.current?.[nodeId]
      if (!p) return
      const z2 = Math.max(zpRef.current.z, 1.6)
      tweenView(z2, { x: W / 2 - p.x * z2, y: H / 2 - p.y * z2 }, 400)
    }

    // ponytail: vista central — encuadra TODO el grafo (caja de todos los nodos) con zoom automático
    const fitAll = () => {
      const ps = Object.values(positionsRef.current || {})
      if (!ps.length) return
      const xs = ps.map(p => p.x), ys = ps.map(p => p.y)
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
      const z2 = Math.min(2, Math.max(0.35, Math.min((W * 0.85) / Math.max(maxX - minX, 120), (H * 0.85) / Math.max(maxY - minY, 120))))
      tweenView(z2, { x: W / 2 - ((minX + maxX) / 2) * z2, y: H / 2 - ((minY + maxY) / 2) * z2 })
    }

  // ponytail: node click (llega vía pointerup sin drag)
  const handleNodeClick = (n) => {
    window.__clicks = (window.__clicks || 0) + 1 // ponytail: diagnóstico
    if (viewMode === 'neurons') {
      setSelectedNeuron(prev => prev?.id === n.id ? null : n)
      setSelectedNode(null); setSelectedProject(null); setHighlightProject(null)
      return
    }
    if (n.type === 'project') {
      const proj = (projectsF || []).find(p => p.id === n.id) || { id: n.id, name: n.title, color: n.color }
      setHighlightFile(null)
      handleProjectClick(proj)
      return
    }
    if (!n.path) return
    const next = highlightFile === n.id ? null : n.id
    setHighlightFile(next) // ponytail: luz 3 niveles — el archivo y sus hijas destacan, el resto del proyecto iluminado
    if (next) {
      // ponytail: click directo en archivo — ilumina su proyecto entero sin pasar por la leyenda
      const fp = fileProject[n.id] || rawMap[(n.source_file || '').split('/').pop()] || null
      setHighlightProject(fp || null)
      setSelectedProject(fp ? ((projectsF || []).find(p => p.id === fp) || null) : null)
      setSelectedNode(n)
    } else {
      setHighlightProject(null); setSelectedProject(null); setSelectedNode(null)
    }
    setSelectedNeuron(null)
  }

  // ponytail: helpers
    const nodeRadius = (n) => {
      if (viewMode === 'neurons') return 7
      // ponytail: jerarquía visual — proyecto > archivo > hija grisa
      return n.type === 'project' ? 20 : (n.path ? 10 : 3)
    }

  const nodeFill = (n) => {
      if (viewMode === 'neurons') {
        // ponytail: sin proyecto → todas "despiertas" en el color primario; con proyecto → activas en SU color, inactivas gris claro
        if (highlightProject) {
          if (neuronProject(n.id) === highlightProject) return projColor || 'var(--color-primary)'
          return 'color-mix(in srgb, var(--color-text-tertiary) 55%, white)'
        }
        return 'var(--color-primary)'
      }
    // ponytail: si un proyecto está seleccionado y este nodo está highlight, usar color del proyecto
        if (fileColor[n.id]) return fileColor[n.id] // ponytail: archivos de un proyecto SIEMPRE con su color (Estructura)
        if (highlightProject && isHighlighted(n.id) && n.id !== highlightProject) {
      const proj = (projectsF || []).find(p => p.id === highlightProject)
      if (proj) return proj.color
      // ponytail: "individual" no está en projects array, color hardcodeado
      if (highlightProject === 'individual') return '#808080'
    }
    return n.color || (n.path ? 'var(--color-primary)' : 'var(--color-text-tertiary)')
  }

  const nodeLabel = (n) => viewMode === 'neurons' ? (n.label || n.id) : (n.title || n.id)

  const isHighlighted = (nodeId) => {
    if (!highlightProject) return false
    if (nodeId === highlightProject) return true
    // ponytail: highlight directo + transitivo (proyecto → archivos → wikilinks)
    const direct = activeEdges.some(e =>
      (e.source === highlightProject && e.target === nodeId) ||
      (e.target === highlightProject && e.source === nodeId)
    )
    if (direct) return true
    // ponytail: transitivo — nodos conectados a archivos del proyecto
    const projectFiles = new Set(
      activeEdges.filter(e => e.source === highlightProject).map(e => e.target)
    )
    return activeEdges.some(e =>
      projectFiles.has(e.source) && e.target === nodeId
    )
  }

  const isEdgeHighlighted = (e) => {
    if (!highlightProject) return false
    if (e.source === highlightProject || e.target === highlightProject) return true
    // ponytail: transitivo — edge entre archivo del proyecto y su wikilink
    const projectFiles = new Set(
      activeEdges.filter(e2 => e2.source === highlightProject).map(e2 => e2.target)
    )
    return projectFiles.has(e.source) || projectFiles.has(e.target)
  }

  // ponytail: highlight de neuronas — click resalta adyacentes, resto se atenúa
    const neuronSel = viewMode === 'neurons' ? selectedNeuron?.id : null
    const isNeuronAdjacent = (nodeId) =>
      nodeId === neuronSel ||
      activeEdges.some(e => (e.source === neuronSel && e.target === nodeId) || (e.target === neuronSel && e.source === nodeId))
    const isEdgeAdjacent = (e) => e.source === neuronSel || e.target === neuronSel

    // ponytail: mapa archivo → proyecto vía edges de Estructura (project → archivo) — colorear neuronas por proyecto
    const fileProject = {}
    const projectIds = new Set((projectsF || []).map(p => p.id))
    ;(edges || []).forEach(e => { if (projectIds.has(e.source)) fileProject[e.target] = e.source })
    // ponytail: color de archivo por su proyecto (Estructura por defecto)
    const fileColor = {}
    ;(edges || []).forEach(e => {
      if (projectIds.has(e.source)) {
        const pc = (projectsF || []).find(pp => pp.id === e.source)
        if (pc) fileColor[e.target] = pc.color
      }
    })
    const activeById = new Map(activeNodes.map(n => [n.id, n]))
    const neuronProject = (nodeId) => {
          const sf = (activeById.get(nodeId)?.source_file || '').split('/').pop()
          if (rawMap[sf]) return rawMap[sf]
          return fileProject[sf.replace(/\.(md|txt)$/i, '')] || null
        }
    const projColor = highlightProject ? ((projectsF || []).find(p => p.id === highlightProject)?.color || '#808080') : null

    // ponytail: luz en 3 niveles al seleccionar archivo — archivo+hijas+nodo padre del proyecto (1) > resto del proyecto (0.85) > resto (0.15)
    const starred = new Set(highlightFile ? [highlightFile] : [])
    if (highlightFile) {
      activeEdges.forEach(e => { if (e.source === highlightFile) starred.add(e.target) })
      const fp = fileProject[highlightFile] // ponytail: el nodo padre (proyecto) también destaca
      if (fp) starred.add(fp)
    }
    // ponytail: documentos individuales de verdad — asignados al proyecto individual (vía edges o mapa de disco)
    const individualDocs = activeNodes.filter(n => n.path && !n.type && (fileProject[n.id] || rawMap[(n.source_file || '').split('/').pop()] || 'individual') === 'individual')

    // ponytail: reinicio de posiciones — borra fijados + layout del servidor y re-simula desde cero
  const handleResetLayout = () => {
    setResetConfirm(false)
    fixedRef.current.clear()
    clearTimeout(saveTimerRef.current)
    fetch('/api/graph/layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ positions: {} }) }).catch(() => {})
    setLayout({ positions: {} })
    setSimVersion(v => v + 1)
  }

  const infoLit = !!(selectedNode || selectedProject || selectedNeuron)

    if (!activeNodes.length) {
    return (
      <div>
        <h1 className="section-title">Grafo de Conocimiento</h1>
        <ToggleBar viewMode={viewMode} setViewMode={setViewMode} />
        <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '4rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 64, opacity: 0.3 }}>hub</span>
          <p style={{ marginTop: 'var(--space-4)' }}>
            {viewMode === 'neurons' ? 'No hay nodos en graph.json todavía. Sube archivos para que Graphify los procese.' : 'No hay páginas wiki todavía. Procesa archivos desde el chat.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grafo-root">
          <ToggleBar viewMode={viewMode} setViewMode={setViewMode} />

      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {activeNodes.length} {viewMode === 'neurons' ? 'nodos' : 'páginas'}
              <span className="grafo-q" title="Cómo se usa el grafo" onMouseEnter={() => setHintOpen(true)} onMouseLeave={() => setHintOpen(false)} onClick={(e) => { e.stopPropagation(); setHintOpen(o => !o) }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--color-text-tertiary)', cursor: 'help' }}>info</span>
              </span>
              <span style={{ opacity: 0.3 }}>●</span>
              {activeEdges.length} {viewMode === 'neurons' ? 'relaciones' : 'enlaces'}
              <span className="grafo-q" title="Cómo se usa el grafo" onMouseEnter={() => setHintOpen(true)} onMouseLeave={() => setHintOpen(false)} onClick={(e) => { e.stopPropagation(); setHintOpen(o => !o) }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--color-text-tertiary)', cursor: 'help' }}>info</span>
              </span>
            </p>
            {hintOpen && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)', background: 'var(--color-surface)', border: '1px solid var(--color-surface-high)', borderRadius: 'var(--radius-md)', padding: '6px 10px', marginBottom: 'var(--space-3)', display: 'inline-block', maxWidth: '100%' }}>
                Rueda: zoom · Arrastrar fondo: mover · Arrastrar nodo: fijar · Doble click/tap: liberar
              </p>
            )}

      <div style={{ flex: 1, display: 'flex', gap: 'var(--space-3)', minHeight: 0, position: 'relative' }}>
        {/* Graph canvas — pantalla completa del área de contenido, SIN caja */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, height: 400, background: 'color-mix(in srgb, var(--color-primary) 5%, transparent)', borderRadius: 'var(--radius-full)', filter: 'blur(80px)', pointerEvents: 'none' }} />

          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: 'grab' }}
            onPointerDown={onSvgPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <defs>
              <filter id="node-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* ponytail: zoom+pan+drag comparten esta transformación — todo dentro usa coords sim */}
            <g ref={gRef} transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Edges */}
              <g>
                {activeEdges.map((e, i) => {
                  const s = positions[e.source], t = positions[e.target]
                  if (!s || !t) return null
                  const highlighted = isEdgeHighlighted(e)
                  const adjacent = isEdgeAdjacent(e)
                  // ponytail: edge color = color del proyecto si está highlight, sino e.color o blanco (estructura) / gris (neuronas)
                                    const proj = highlightProject ? (highlightProject === 'individual' ? { color: '#808080' } : (projectsF || []).find(p => p.id === highlightProject)) : null
                                    let stroke = highlighted && proj ? proj.color : (e.color || 'var(--color-text-tertiary)') // ponytail: terciario visible en tema claro y oscuro (antes blanco invisible en claro)
                                    let strokeWidth = highlighted ? '2' : (viewMode === 'neurons' ? '1' : '0.75')
                                    let opacity = highlightFile ? ((e.source === highlightFile || e.target === highlightFile) ? '0.9' : (isEdgeHighlighted(e) ? '0.5' : '0.05')) : (highlightProject ? (highlighted ? '0.8' : '0.05') : '0.4')
                                    if (neuronSel) {
                                      if (adjacent) { stroke = 'var(--color-primary)'; strokeWidth = '2'; opacity = '0.9' }
                                      else opacity = '0.05'
                                    } else if (viewMode === 'neurons' && highlightProject) {
                                                        // proyecto seleccionado: neuronas activas del proyecto + sus relaciones en verde, resto gris claro
                                                        const inP = neuronProject(e.source) === highlightProject || neuronProject(e.target) === highlightProject
                                                        if (inP) { stroke = proj ? proj.color : 'var(--color-primary)'; strokeWidth = '1.5'; opacity = '0.85' }
                                                        else { stroke = 'color-mix(in srgb, var(--color-text-tertiary) 55%, white)'; opacity = '0.15' }
                                                      }
                  return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                  />
                })}
              </g>

              {/* ponytail: etiquetas de relación (references/conceptual) eliminadas a petición del usuario */}

              {/* Nodes */}
              <g>
                {activeNodes.map(n => {
                  const p = positions[n.id]
                  if (!p) return null
                  const fill = nodeFill(n)
                  const r = nodeRadius(n)
                  const label = nodeLabel(n)
                  const highlighted = isHighlighted(n.id)
                  const isSelected = selectedNode?.id === n.id || selectedProject?.id === n.id || selectedNeuron?.id === n.id
                  const neuronDim = neuronSel && !isNeuronAdjacent(n.id)
                  return (
                    <g key={n.id} style={{ cursor: 'pointer' }}
                      onPointerDown={(e) => onNodePointerDown(e, n)}
                      onDoubleClick={(e) => onNodeDoubleClick(e, n.id)}
                    >
                      {/* ponytail: hit area generosa — nodos pequeños seleccionables en táctil */}
                      <circle cx={p.x} cy={p.y} r={Math.max(r + 8, 14)} fill="transparent" />
                      <circle cx={p.x} cy={p.y} r={r}
                        fill={fill}
                        filter={viewMode === 'neurons' || n.path || n.type === 'project' ? 'url(#node-glow)' : undefined}
                        opacity={viewMode === 'neurons'
                                                  ? (highlightProject ? (neuronProject(n.id) === highlightProject ? 1 : 0.6) : (neuronDim ? 0.15 : 1))
                                                  : (highlightFile ? (starred.has(n.id) ? 1 : (highlighted ? 0.85 : 0.15))
                                                     : (highlightProject ? (highlighted ? 1 : 0.2) : 1))}
                        stroke={isSelected ? 'var(--color-primary)' : (highlightFile && starred.has(n.id) && n.id !== highlightFile ? 'var(--color-primary)' : 'none')}
                        strokeWidth={isSelected ? 4 : (highlightFile && starred.has(n.id) && n.id !== highlightFile ? 2.5 : 0)}
                      />
                      {(hideKidLabels && !n.path && n.type !== 'project') ? null : (
                      <text x={p.x} y={p.y - r - 4} textAnchor="middle" fill="var(--color-text-primary)"
                        style={{ fontSize: n.type === 'project' ? 12 : 11, fontFamily: 'var(--font-mono)', fontWeight: n.type === 'project' ? 700 : 500, pointerEvents: 'none', letterSpacing: '-0.02em', opacity: viewMode === 'neurons' ? (neuronDim ? 0.15 : 1) : (highlightFile ? (starred.has(n.id) ? 1 : (highlighted ? 0.85 : 0.15)) : 1) }}>
                        {label && label.length > 15 ? label.slice(0, 12) + '…' : label}
                      </text>
                      )}
                    </g>
                  )
                })}
              </g>
            </g>
          </svg>

          {/* Zoom controls */}
          <div style={{ position: 'absolute', bottom: 'var(--space-5)', right: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <div className="grafo-zoom-pm" style={{ flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'center' }}>
                        <button className="btn-app btn-app-secondary" style={{ width: 40, height: 40, padding: 0 }} onClick={() => setZoom(z => Math.min(z + 0.2, 3))}>
                          <span className="material-symbols-outlined">add</span>
                        </button>
                        <button className="btn-app btn-app-secondary" style={{ width: 40, height: 40, padding: 0 }} onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))}>
                          <span className="material-symbols-outlined">remove</span>
                        </button>
                        <div style={{ height: 1, width: 24, background: 'var(--color-surface-high)', margin: '2px 0' }} />
                      </div>
                      {/* ponytail: ojo — oculta/muestra los textos de las hijas grises para ver proyectos y archivos claros */}
                      <button className="btn-app btn-app-secondary" style={{ width: 40, height: 40, padding: 0 }}
                        title={hideKidLabels ? 'Mostrar textos de las hijas' : 'Ocultar textos de las hijas'}
                        onClick={() => setHideKidLabels(o => !o)}>
                        <span className="material-symbols-outlined">{hideKidLabels ? 'visibility_off' : 'visibility'}</span>
                      </button>
                      <button className="btn-app btn-app-secondary" style={{ width: 40, height: 40, padding: 0 }} title="Ver todo el grafo" onClick={fitAll}>
                                              <span className="material-symbols-outlined">center_focus_strong</span>
                                            </button>
                                            <div style={{ height: 1, width: 24, background: 'var(--color-surface-high)', margin: '2px 0' }} />
                                            <button className="btn-app btn-app-secondary" style={{ width: 40, height: 40, padding: 0 }} title="Reiniciar posiciones" onClick={() => setResetConfirm(true)}>
                                              <span className="material-symbols-outlined">refresh</span>
                                            </button>
                                          </div>

          {/* Legend toggle — ambos modos: pulsa para elegir proyecto y verlo iluminado */}
                    <button className="grafo-legend-toggle btn-app btn-app-secondary" onClick={() => setLegendOpen(o => !o)}
                      style={{ position: 'absolute', top: 'var(--space-4)', left: 'var(--space-4)', zIndex: 7, width: 40, height: 40, padding: 0 }}>
                      <span className="material-symbols-outlined">description</span>
                    </button>

                    {/* Botón info — ambos modos y ambas interfaces: ilumina al seleccionar, abre la info al pulsarlo */}
                    <button className="btn-app btn-app-secondary" onClick={() => { if (infoLit) setInfoOpen(o => !o) }}
                      style={{ position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)', zIndex: 7, width: 40, height: 40, padding: 0,
                        ...(infoLit ? { background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)', color: 'var(--color-primary)' } : {}) }}>
                      <span className="material-symbols-outlined">info</span>
                    </button>

          {/* Mini-panel de neurona eliminado — la info de neurona va por el botón info (panel lateral/ventana completa) */}

          {/* Leyenda — ambos modos: proyectos siempre; individuales y buscador solo en Estructura */}
                    <div className={`grafo-legend${legendOpen ? ' grafo-legend-open' : ''}`}>
                      {/* ponytail: sin texto "Leyenda" — solo el botón cerrar */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 'var(--space-3)' }}>
                        <button onClick={() => setLegendOpen(false)} className="btn-app btn-app-secondary" style={{ width: 24, height: 24, padding: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                        </button>
                      </div>

                      {/* ponytail: buscador de documentos ARRIBA — primero encontrar, luego navegar */}
                      <div style={{ marginBottom: 'var(--space-3)' }}>
                        <div className="label-caps" style={{ marginBottom: 'var(--space-2)' }}>Buscar documento</div>
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar…" style={{
                          width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                          background: 'var(--color-bg)', border: '1px solid var(--color-surface-high)',
                          color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none',
                        }} />
                        {searchResults.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: 'var(--space-2)' }}>
                            {searchResults.map(n => (
                              <button key={n.id} className={`grafo-row${selectedNode?.id === n.id ? ' active' : ''}`} onClick={() => { handleNodeClick(n); aimAt(n.id); setLegendOpen(false) }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || n.id}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Projects */}
                      {projectsF && projectsF.length > 0 && (
                        <div style={{ borderTop: '1px solid var(--color-surface-high)', paddingTop: 'var(--space-3)' }}>
                          <div className="label-caps" style={{ marginBottom: 'var(--space-2)' }}>Proyectos</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {projectsF.filter(p => p.id !== 'individual').map(proj => (
                              <button key={proj.id} className={`grafo-row${highlightProject === proj.id ? ' active' : ''}`} onClick={() => { handleProjectClick(proj); setLegendOpen(false) }}>
                                <span className="grafo-dot" style={{ background: proj.color, boxShadow: `0 0 6px ${proj.color}` }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ponytail: Individual separado por divisoria — hace de cabecera de sus documentos (sin textos "Individuales") */}
                      <div style={{ borderTop: '1px solid var(--color-surface-high)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                        {(() => {
                          const ind = projectsF.find(p => p.id === 'individual') || { id: 'individual', name: 'Individual', color: '#808080' }
                          return (
                            <button className={`grafo-row${highlightProject === ind.id ? ' active' : ''}`} onClick={() => { handleProjectClick(ind); setLegendOpen(false) }}>
                              <span className="grafo-dot" style={{ background: ind.color, boxShadow: `0 0 6px ${ind.color}` }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ind.name}</span>
                            </button>
                          )
                        })()}
                        {viewMode === 'structure' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: 'var(--space-2)' }}>
                          {individualDocs.map(n => (
                            <button key={n.id} className={`grafo-row${selectedNode?.id === n.id ? ' active' : ''}`} onClick={() => { handleNodeClick(n); aimAt(n.id); setLegendOpen(false) }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || n.id}</span>
                            </button>
                          ))}
                          {individualDocs.length === 0 && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>(vacío)</span>
                          )}
                        </div>
                        )}
                      </div>
                    </div>
                                </div>

        {/* Info: móvil → ventana completa slide (CSS); desktop → panel lateral (CSS). infoOpen controla ambos */}
                {infoLit && infoOpen && (
                  <SidePanel
                    selectedNode={selectedNode}
                    selectedProject={selectedProject}
                    selectedNeuron={viewMode === 'neurons' ? selectedNeuron : null}
                    wikiContent={wikiContent}
                    onClose={() => setInfoOpen(false)}
                    onProjectUpdate={(id, desc, color) => {
                      // ponytail: PUT update + refresh
                      fetch(`/api/projects/${id}`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ description: desc, color })
                      }).then(() => window.location.reload())
                    }}
                  />
                )}

                          {/* ponytail: confirmación de reinicio de posiciones (mismo patrón que el modal de Cerebro) */}
                          {resetConfirm && (
                            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }} onClick={() => setResetConfirm(false)}>
                              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-high)', borderRadius: 'var(--radius-lg)', maxWidth: 420, width: '100%', padding: 'var(--space-6)' }} onClick={e => e.stopPropagation()}>
                                <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 22 }}>refresh</span>
                                  Reiniciar posiciones del grafo
                                </h3>
                                <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                                  Se reposicionará <strong>todo el grafo</strong> a su estado por defecto. Las posiciones fijadas y guardadas se perderán.
                                </p>
                                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                                  <button className="btn-app btn-app-secondary" onClick={() => setResetConfirm(false)}>Cancelar</button>
                                  <button className="btn-app btn-app-danger" onClick={handleResetLayout}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
                                    Reiniciar
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  )
                }

                function SidePanel({ selectedNode, selectedProject, selectedNeuron, wikiContent, onClose, onProjectUpdate }) {
  const [panelWidth, setPanelWidth] = useState(340)
  const [dragging, setDragging] = useState(false)
  const [editDesc, setEditDesc] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (selectedProject) {
      setEditDesc(selectedProject.description || '')
      setEditColor(selectedProject.color || '#6FCF97')
      setEditing(false)
    }
  }, [selectedProject])

  const handleMouseDown = (e) => { e.preventDefault(); setDragging(true) }
  useEffect(() => {
    if (!dragging) return
    const handleMove = (e) => {
      const newWidth = window.innerWidth - e.clientX
      setPanelWidth(Math.max(280, Math.min(600, newWidth)))
    }
    const handleUp = () => setDragging(false)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp) }
  }, [dragging])

  return (
    <div className="grafo-side" style={{
      width: panelWidth, flexShrink: 0,
      background: 'var(--color-surface)', border: '1px solid var(--color-surface-high)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* Drag handle */}
      <div className="grafo-side-handle" onMouseDown={handleMouseDown} style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize',
        background: dragging ? 'var(--color-primary)' : 'var(--color-surface-high)',
        transition: 'background var(--transition-fast)', zIndex: 10,
      }} />

      {/* Close button */}
      <button onClick={onClose} className="btn-app btn-app-secondary" style={{
        position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)', width: 28, height: 28, padding: 0, zIndex: 5,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
      </button>

      <div style={{ overflowY: 'auto', padding: 'var(--space-5)', flex: 1 }}>
        {selectedProject ? (
          <div>
            {/* Title = project name */}
            <h2 style={{ color: 'var(--color-primary)', fontSize: 22, fontWeight: 700, marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div style={{ width: 16, height: 16, borderRadius: 'var(--radius-full)', background: selectedProject.color, boxShadow: `0 0 8px ${selectedProject.color}` }} />
              {selectedProject.name}
            </h2>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>
              Creado: {new Date(selectedProject.created).toLocaleDateString()}
            </div>

            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>DESCRIPCIÓN</label>
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4} style={{
                    width: '100%', padding: '8px', marginTop: '4px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-bg)', border: '1px solid var(--color-surface-high)',
                    color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', fontSize: 13, resize: 'vertical', outline: 'none',
                  }} />
                </div>
                <div>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>COLOR</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '4px' }}>
                    <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} style={{ width: 40, height: 32, border: 'none', background: 'transparent', cursor: 'pointer' }} />
                    <input type="text" value={editColor} onChange={e => setEditColor(e.target.value)} style={{
                      padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-bg)', border: '1px solid var(--color-surface-high)',
                      color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none',
                    }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button className="btn-app btn-app-primary" style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => onProjectUpdate(selectedProject.id, editDesc, editColor)}>Guardar</button>
                  <button className="btn-app btn-app-secondary" style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => { setEditDesc(selectedProject.description || ''); setEditColor(selectedProject.color || '#6FCF97'); setEditing(false) }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-1)' }}>DESCRIPCIÓN</div>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
                    {selectedProject.description || '(Sin descripción)'}
                  </p>
                </div>
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-1)' }}>COLOR</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <div style={{ width: 16, height: 16, borderRadius: 'var(--radius-full)', background: selectedProject.color, boxShadow: `0 0 6px ${selectedProject.color}` }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)' }}>{selectedProject.color}</span>
                  </div>
                </div>
                <button className="btn-app btn-app-secondary" style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => setEditing(true)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }}>edit</span>
                  Editar
                </button>
              </div>
            )}
          </div>
        ) : selectedNode ? (
          <div>
            <h2 style={{ color: 'var(--color-primary)', fontSize: 20, fontWeight: 700, marginBottom: 'var(--space-3)' }}>{selectedNode.title || selectedNode.id}</h2>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)' }}>
              {selectedNode.path}
            </div>
            <div style={{ borderTop: '1px solid var(--color-surface-high)', paddingTop: 'var(--space-3)' }}>
              {wikiContent ? <MarkdownViewer content={wikiContent} compact /> : <p style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>Cargando…</p>}
            </div>
          </div>
        ) : selectedNeuron ? (
                  <div>
                    <h2 style={{ color: 'var(--color-primary)', fontSize: 20, fontWeight: 700, marginBottom: 'var(--space-3)', overflowWrap: 'anywhere' }}>{selectedNeuron.label || selectedNeuron.id}</h2>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-4)', overflowWrap: 'anywhere' }}>
                      origen: {selectedNeuron.source_file || selectedNeuron.source || '—'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: confidenceColor(selectedNeuron.confidence), flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)' }}>{selectedNeuron.confidence || selectedNeuron.file_type || '—'}</span>
                    </div>
                    {/* ponytail: la neurona hija muestra el wiki de su archivo padre debajo de su cabecera */}
                    {wikiContent && (
                      <div style={{ borderTop: '1px solid var(--color-surface-high)', paddingTop: 'var(--space-3)' }}>
                        <div className="label-caps" style={{ marginBottom: 'var(--space-2)' }}>Documento de origen</div>
                                                <MarkdownViewer content={wikiContent} compact />
                      </div>
                    )}
                  </div>
                ) : null}
      </div>
    </div>
  )
}

// ponytail: toggle inline
function ToggleBar({ viewMode, setViewMode }) {
  const btn = (mode, icon, label) => (
    <button onClick={() => setViewMode(mode)} style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)',
      borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
      background: viewMode === mode ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
      border: viewMode === mode ? '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)' : '1px solid transparent',
      color: viewMode === mode ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
      transition: 'all var(--transition-fast)',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
      {label}
    </button>
  )
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
      {btn('structure', 'account_tree', 'Estructura')}
      {btn('neurons', 'neurology', 'Neuronas')}
    </div>
  )
}

export default GrafoView