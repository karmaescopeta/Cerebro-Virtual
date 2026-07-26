import React, { useRef, useState, useEffect } from 'react'

function GrafoView({ nodes, edges }) {
  const svgRef = useRef(null)
  const [zoom, setZoom] = useState(1)

  if (!nodes.length) {
    return (
      <div>
        <h1 className="section-title">Grafo de Conocimiento</h1>
        <p className="section-subtitle">Visualización de conexiones entre páginas wiki.</p>
        <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '4rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 64, opacity: 0.3 }}>hub</span>
          <p style={{ marginTop: 'var(--space-4)' }}>No hay páginas wiki todavía. Procesa archivos desde el chat.</p>
        </div>
      </div>
    )
  }

  const W = 1000, H = 700, cx = W / 2, cy = H / 2
  const R = Math.min(W, H) * 0.35

  const pos = {}
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2
    pos[n.id] = { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) }
  })

  return (
    <div style={{ height: 'calc(100vh - 72px - 2 * var(--space-7))', display: 'flex', flexDirection: 'column' }}>
      <h1 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>hub</span>
        Grafo de Conocimiento
      </h1>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {nodes.length} páginas
        <span style={{ opacity: 0.3 }}>●</span>
        {edges.length} enlaces
      </p>

      {/* Graph canvas */}
      <div style={{ flex: 1, position: 'relative', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-surface-high)', overflow: 'hidden' }}>
        {/* Ambient glow */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, height: 400, background: 'rgba(173,198,255,0.05)', borderRadius: 'var(--radius-full)', filter: 'blur(80px)', pointerEvents: 'none' }} />

        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', transform: `scale(${zoom})`, transition: 'transform var(--transition-base)' }}>
          <defs>
            <filter id="node-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Edges */}
          <g>
            {edges.map((e, i) => {
              const s = pos[e.source], t = pos[e.target]
              if (!s || !t) return null
              return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="var(--color-border)" strokeWidth="0.75" opacity="0.15" />
            })}
          </g>

          {/* Nodes */}
          <g>
            {nodes.map(n => {
              const p = pos[n.id]
              if (!p) return null
              const isPage = !!n.path
              return (
                <g key={n.id} style={{ cursor: 'pointer' }}>
                  {isPage && <circle cx={p.x} cy={p.y} r="8" fill="var(--color-primary)" filter="url(#node-glow)" />}
                  {!isPage && <circle cx={p.x} cy={p.y} r="4" fill="var(--color-text-tertiary)" />}
                  {isPage && (
                    <text x={p.x} y={p.y - 14} textAnchor="middle" fill="var(--color-text-primary)"
                      style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500, pointerEvents: 'none', letterSpacing: '-0.02em' }}>
                      {n.title.length > 15 ? n.title.slice(0, 12) + '…' : n.title}
                    </text>
                  )}
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
          <button className="btn-app btn-app-secondary" style={{ width: 40, height: 40, padding: 0 }} onClick={() => setZoom(1)}>
            <span className="material-symbols-outlined">center_focus_strong</span>
          </button>
        </div>

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 'var(--space-5)', left: 'var(--space-5)', background: 'rgba(42,42,42,0.8)', backdropFilter: 'blur(12px)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-surface-high)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: 'var(--color-primary)', boxShadow: '0 0 8px var(--color-primary)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>Página Wiki</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{ width: 8, height: 8, borderRadius: 'var(--radius-full)', background: 'var(--color-text-tertiary)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text-tertiary)' }}>Referencia</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GrafoView