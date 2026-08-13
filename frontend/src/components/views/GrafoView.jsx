import React, { useRef, useState, useEffect, useCallback } from 'react'
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from 'd3-force'
import MarkdownViewer from '../shared/MarkdownViewer'

function GrafoView({ nodes, edges, refreshKey, projects }) {
  const svgRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [viewMode, setViewMode] = useState('structure')
  const [neuronsGraph, setNeuronsGraph] = useState({ nodes: [], edges: [] })
  const [positions, setPositions] = useState({})
  const [selectedNode, setSelectedNode] = useState(null)       // wiki preview panel
  const [selectedProject, setSelectedProject] = useState(null) // project info panel
  const [highlightProject, setHighlightProject] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [wikiContent, setWikiContent] = useState('')
  const [draggingNode, setDraggingNode] = useState(null)
  const simRef = useRef(null)
  const panningRef = useRef(null) // ponytail: { startX, startY, panX, panY } — pan de canvas

  const W = 1000, H = 700, cx = W / 2, cy = H / 2

  // ponytail: fetch Neuronas on mount, on viewMode change, and on refreshKey change
  useEffect(() => {
    fetch('/api/graph/full').then(r => r.ok ? r.json() : { nodes: [], edges: [] }).then(setNeuronsGraph).catch(() => {})
  }, [viewMode, refreshKey])

  const activeNodes = viewMode === 'neurons' ? neuronsGraph.nodes : nodes
  const activeEdges = viewMode === 'neurons' ? neuronsGraph.edges : edges

  // ponytail: force-directed simulation for both views
  useEffect(() => {
    if (!activeNodes.length) { setPositions({}); return }

    // ponytail: shallow copies — d3 mutates objects in place
    const simNodes = activeNodes.map(n => ({ ...n }))
    const simEdges = activeEdges.map(e => ({
      ...e,
      source: e.source,
      target: e.target,
    }))

    // ponytail: stop previous sim
    if (simRef.current) simRef.current.stop()

    const sim = forceSimulation(simNodes)
      .force('charge', forceManyBody().strength(viewMode === 'neurons' ? -80 : -120))
      .force('link', forceLink(simEdges).id(d => d.id).distance(viewMode === 'neurons' ? 60 : 80).strength(0.3))
      .force('center', forceCenter(cx, cy))
      .force('collide', forceCollide().radius(d => nodeRadius(d) + 4))
      .alphaDecay(0.03)

    sim.on('tick', () => {
      const pos = {}
      simNodes.forEach(n => { pos[n.id] = { x: n.x, y: n.y } })
      setPositions(pos)
    })

    simRef.current = sim

    return () => sim.stop()
  }, [activeNodes, activeEdges, viewMode])

  // ponytail: fetch wiki content when a wiki node is selected
  useEffect(() => {
    if (!selectedNode?.path) { setWikiContent(''); return }
    fetch(`/vault-static/${selectedNode.path}`).then(r => r.ok ? r.text() : '').then(setWikiContent).catch(() => {})
  }, [selectedNode])

  // ponytail: search documents in structure mode
  useEffect(() => {
    if (!searchQuery.trim() || viewMode !== 'structure') { setSearchResults([]); return }
    const q = searchQuery.toLowerCase()
    setSearchResults(activeNodes.filter(n =>
      (n.title || n.id || '').toLowerCase().includes(q) && n.path
    ).slice(0, 10))
  }, [searchQuery, activeNodes, viewMode])

  // ponytail: drag handler
  const handleNodeMouseDown = useCallback((e, nodeId) => {
    e.stopPropagation()
    if (simRef.current) simRef.current.alphaTarget(0.3).restart()
    setDraggingNode(nodeId)
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (draggingNode && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      const scaleX = W / rect.width
      const scaleY = H / rect.height
      const x = (e.clientX - rect.left) * scaleX
      const y = (e.clientY - rect.top) * scaleY
      // ponytail: update node position in sim
      if (simRef.current) {
        const node = simRef.current.nodes().find(n => n.id === draggingNode)
        if (node) { node.fx = x; node.fy = y }
      }
      return
    }
    // ponytail: pan de canvas — drag del fondo mueve todo el SVG
    if (panningRef.current) {
      const dx = e.clientX - panningRef.current.startX
      const dy = e.clientY - panningRef.current.startY
      setPan({ x: panningRef.current.panX + dx, y: panningRef.current.panY + dy })
    }
  }, [draggingNode])

  const handleMouseUp = useCallback(() => {
    if (simRef.current) simRef.current.alphaTarget(0)
    setDraggingNode(null)
    panningRef.current = null
  }, [])

  // ponytail: helpers
  const confidenceColor = (conf) => ({
    EXTRACTED: 'var(--color-success)',
    INFERRED: '#fbbf24',
    AMBIGUO: 'var(--color-error)',
  }[conf] || 'var(--color-primary)')

  const nodeRadius = (n) => {
    if (viewMode === 'neurons') return 7
    return n.type === 'project' ? 14 : (n.path ? 8 : 4)
  }

  const nodeFill = (n) => {
    if (viewMode === 'neurons') return confidenceColor(n.confidence)
    // ponytail: si un proyecto está seleccionado y este nodo está highlight, usar color del proyecto
    if (highlightProject && isHighlighted(n.id) && n.id !== highlightProject) {
      const proj = (projects || []).find(p => p.id === highlightProject)
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

  // ponytail: handle project click from legend
  const handleProjectClick = (proj) => {
    setSelectedProject(proj)
    setSelectedNode(null)
    setHighlightProject(prev => prev === proj.id ? null : proj.id)
  }

  // ponytail: handle node click → wiki preview (structure mode only)
  const handleNodeClick = (n) => {
    if (viewMode === 'neurons') return
    if (n.type === 'project') {
      const proj = (projects || []).find(p => p.id === n.id) || { id: n.id, name: n.title, color: n.color }
      handleProjectClick(proj)
      return
    }
    if (!n.path) return
    setSelectedNode(prev => prev?.id === n.id ? null : n)
    setSelectedProject(null)
  }

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
    <div style={{ height: 'calc(100vh - 72px - 2 * var(--space-7))', display: 'flex', flexDirection: 'column' }}>
      <h1 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>hub</span>
        Grafo de Conocimiento
      </h1>

      <ToggleBar viewMode={viewMode} setViewMode={setViewMode} />

      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {activeNodes.length} {viewMode === 'neurons' ? 'nodos' : 'páginas'}
        <span style={{ opacity: 0.3 }}>●</span>
        {activeEdges.length} {viewMode === 'neurons' ? 'relaciones' : 'enlaces'}
      </p>

      <div style={{ flex: 1, display: 'flex', gap: 'var(--space-3)', minHeight: 0 }}>
        {/* Graph canvas */}
        <div style={{ flex: 1, position: 'relative', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-surface-high)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, height: 400, background: 'rgba(173,198,255,0.05)', borderRadius: 'var(--radius-full)', filter: 'blur(80px)', pointerEvents: 'none' }} />

          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: '100%', height: '100%', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: draggingNode || panningRef.current ? 'none' : 'transform var(--transition-base)', cursor: draggingNode ? 'grabbing' : 'grab' }}
            onMouseDown={(e) => { panningRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y } }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <defs>
              <filter id="node-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Edges */}
            <g>
              {activeEdges.map((e, i) => {
                const s = positions[e.source], t = positions[e.target]
                if (!s || !t) return null
                const highlighted = isEdgeHighlighted(e)
                // ponytail: edge color = color del proyecto si está highlight, sino e.color o blanco
                const proj = highlightProject ? (highlightProject === 'individual' ? { color: '#808080' } : (projects || []).find(p => p.id === highlightProject)) : null
                const stroke = highlighted && proj ? proj.color : (e.color || '#ffffff')
                return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  stroke={stroke}
                  strokeWidth={highlighted ? '2' : (viewMode === 'neurons' ? '1' : '0.75')}
                  opacity={highlightProject ? (highlighted ? '0.8' : '0.05') : (viewMode === 'neurons' ? '0.4' : '0.4')}
                />
              })}
            </g>

            {/* Edge labels (Neuronas mode only) */}
            {viewMode === 'neurons' && (
              <g>
                {activeEdges.map((e, i) => {
                  const s = positions[e.source], t = positions[e.target]
                  if (!s || !t || !e.relation) return null
                  const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2
                  const label = e.relation.length > 12 ? e.relation.slice(0, 10) + '…' : e.relation
                  return <text key={`l${i}`} x={mx} y={my} textAnchor="middle" fill="var(--color-text-tertiary)"
                    style={{ fontSize: 8, fontFamily: 'var(--font-mono)', pointerEvents: 'none', opacity: 0.6 }}>{label}</text>
                })}
              </g>
            )}

            {/* Nodes */}
            <g>
              {activeNodes.map(n => {
                const p = positions[n.id]
                if (!p) return null
                const fill = nodeFill(n)
                const r = nodeRadius(n)
                const label = nodeLabel(n)
                const highlighted = isHighlighted(n.id)
                const isSelected = selectedNode?.id === n.id || (selectedProject?.id === n.id)
                return (
                  <g key={n.id} style={{ cursor: 'pointer' }}
                    onMouseDown={(e) => handleNodeMouseDown(e, n.id)}
                    onClick={() => handleNodeClick(n)}
                  >
                    <circle cx={p.x} cy={p.y} r={r}
                      fill={fill}
                      filter={viewMode === 'neurons' || n.path || n.type === 'project' ? 'url(#node-glow)' : undefined}
                      opacity={highlightProject ? (highlighted ? 1 : 0.2) : 1}
                      stroke={isSelected ? 'var(--color-primary)' : 'none'}
                      strokeWidth={isSelected ? 3 : 0}
                    />
                    <text x={p.x} y={p.y - r - 4} textAnchor="middle" fill="var(--color-text-primary)"
                      style={{ fontSize: n.type === 'project' ? 12 : 11, fontFamily: 'var(--font-mono)', fontWeight: n.type === 'project' ? 700 : 500, pointerEvents: 'none', letterSpacing: '-0.02em' }}>
                      {label && label.length > 15 ? label.slice(0, 12) + '…' : label}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>

          {/* Zoom controls */}
          <div style={{ position: 'absolute', bottom: 'var(--space-5)', right: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <button className="btn-app btn-app-secondary" style={{ width: 40, height: 40, padding: 0 }} onClick={() => setZoom(z => Math.min(z + 0.2, 2))}>
              <span className="material-symbols-outlined">add</span>
            </button>
            <button className="btn-app btn-app-secondary" style={{ width: 40, height: 40, padding: 0 }} onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))}>
              <span className="material-symbols-outlined">remove</span>
            </button>
            <div style={{ height: 1, background: 'var(--color-surface-high)', margin: '2px 0' }} />
            <button className="btn-app btn-app-secondary" style={{ width: 40, height: 40, padding: 0 }} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>
              <span className="material-symbols-outlined">center_focus_strong</span>
            </button>
          </div>

          {/* Legend + Project list + Search (left side) — only in structure mode */}
          {viewMode === 'structure' && (
          <div style={{ position: 'absolute', top: 'var(--space-4)', left: 'var(--space-4)', maxHeight: 'calc(100% - 100px)', overflowY: 'auto', width: 200, background: 'rgba(42,42,42,0.85)', backdropFilter: 'blur(12px)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-surface-high)' }}>
            {/* Projects — white text for visibility */}
            {viewMode === 'structure' && projects && projects.length > 0 && (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>PROYECTOS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {projects.map(proj => (
                    <button key={proj.id} onClick={() => handleProjectClick(proj)} style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '6px 8px',
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer', textAlign: 'left',
                      background: highlightProject === proj.id ? 'rgba(173,198,255,0.1)' : 'transparent',
                      border: highlightProject === proj.id ? '1px solid rgba(173,198,255,0.2)' : '1px solid transparent',
                      transition: 'all var(--transition-fast)',
                    }}>
                      <div style={{ width: 12, height: 12, borderRadius: 'var(--radius-full)', background: proj.color, boxShadow: `0 0 6px ${proj.color}`, flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</span>
                    </button>
                  ))}
                  {/* ponytail: botón Individual en lista de proyectos */}
                  <button onClick={() => handleProjectClick({ id: 'individual', name: 'Individual', color: '#808080' })} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer', textAlign: 'left',
                    background: highlightProject === 'individual' ? 'rgba(173,198,255,0.1)' : 'transparent',
                    border: highlightProject === 'individual' ? '1px solid rgba(173,198,255,0.2)' : '1px solid transparent',
                    transition: 'all var(--transition-fast)',
                  }}>
                    <div style={{ width: 12, height: 12, borderRadius: 'var(--radius-full)', background: '#808080', boxShadow: '0 0 6px rgba(128,128,128,0.5)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#ffffff' }}>Individual</span>
                  </button>
                </div>
              </div>
            )}

            {/* Individual documents (structure mode only) */}
            {viewMode === 'structure' && (
              <div style={{ borderTop: '1px solid var(--color-surface-high)', paddingTop: 'var(--space-3)', marginTop: projects && projects.length > 0 ? 'var(--space-3)' : '0' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>INDIVIDUALES</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  {activeNodes.filter(n => n.path && !n.type).map(n => (
                    <button key={n.id} onClick={() => { setSelectedNode(n); setSelectedProject(null); setHighlightProject(null) }} style={{
                      padding: '4px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', textAlign: 'left',
                      background: selectedNode?.id === n.id ? 'rgba(173,198,255,0.1)' : 'transparent',
                      border: '1px solid transparent', color: '#ffffff',
                      fontFamily: 'var(--font-mono)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {n.title || n.id}
                    </button>
                  ))}
                  {activeNodes.filter(n => n.path && !n.type).length === 0 && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>(vacío)</span>
                  )}
                </div>
              </div>
            )}

            {/* Search (structure mode only) */}
            {viewMode === 'structure' && (
              <div style={{ borderTop: '1px solid var(--color-surface-high)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>BUSCAR DOCUMENTO</div>
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar…" style={{
                  width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg)', border: '1px solid var(--color-surface-high)',
                  color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none',
                }} />
                {searchResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}>
                    {searchResults.map(n => (
                      <button key={n.id} onClick={() => { setSelectedNode(n); setSelectedProject(null); setHighlightProject(null) }} style={{
                        padding: '4px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', textAlign: 'left',
                        background: selectedNode?.id === n.id ? 'rgba(173,198,255,0.1)' : 'transparent',
                        border: '1px solid transparent', color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-mono)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {n.title || n.id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>

        {/* Right panel: project info OR wiki preview */}
        {(selectedNode || selectedProject) && (
          <SidePanel
            selectedNode={selectedNode}
            selectedProject={selectedProject}
            wikiContent={wikiContent}
            onClose={() => { setSelectedNode(null); setSelectedProject(null); setHighlightProject(null) }}
            onProjectUpdate={(id, desc, color) => {
              // ponytail: PUT update + refresh
              fetch(`/api/projects/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: desc, color })
              }).then(() => window.location.reload())
            }}
          />
        )}
      </div>
    </div>
  )
}

// ponytail: side panel — slideable, shows project info or wiki preview
function SidePanel({ selectedNode, selectedProject, wikiContent, onClose, onProjectUpdate }) {
  const [panelWidth, setPanelWidth] = useState(340)
  const [dragging, setDragging] = useState(false)
  const [editDesc, setEditDesc] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (selectedProject) {
      setEditDesc(selectedProject.description || '')
      setEditColor(selectedProject.color || '#4edea3')
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
    <div style={{
      width: panelWidth, flexShrink: 0, position: 'relative',
      background: 'var(--color-surface)', border: '1px solid var(--color-surface-high)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* Drag handle */}
      <div onMouseDown={handleMouseDown} style={{
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
                  <button className="btn-app btn-app-secondary" style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => { setEditDesc(selectedProject.description || ''); setEditColor(selectedProject.color || '#4edea3'); setEditing(false) }}>Cancelar</button>
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
              {wikiContent ? <MarkdownViewer content={wikiContent} /> : <p style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>Cargando…</p>}
            </div>
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
      background: viewMode === mode ? 'rgba(173,198,255,0.1)' : 'transparent',
      border: viewMode === mode ? '1px solid rgba(173,198,255,0.2)' : '1px solid transparent',
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

function LegendItem({ color, label, glow, small }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <div style={{ width: small ? 8 : 10, height: small ? 8 : 10, borderRadius: 'var(--radius-full)', background: color, boxShadow: glow ? `0 0 8px ${color}` : 'none' }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: small ? 'var(--color-text-tertiary)' : 'inherit' }}>{label}</span>
    </div>
  )
}

export default GrafoView
