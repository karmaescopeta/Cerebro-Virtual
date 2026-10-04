import React, { useEffect, useState } from 'react'

// ponytail: opciones de consumo fijas (plan dashboard.md); coste por hora OmniRoute no lo expone → 'hour' = solo tokens
const USAGE_OPTIONS = [
  { label: 'Hora a hora — último día', granularity: 'hour', period: 1 },
  { label: 'Día a día — última semana', granularity: 'day', period: 7 },
  { label: 'Día a día — último mes', granularity: 'day', period: 30 },
  { label: 'Mes a mes — último año', granularity: 'month', period: 365 },
]

const EMPTY_USAGE = { total_tokens: 0, total_cost: 0, by_provider: [], buckets: [] }

function DashboardView({ vaultInfo, systemInfo, containers, editAgentName, projects, onTabChange }) {
  const stats = vaultInfo?.stats || {}
  const containerList = Object.entries(containers?.containers || containers || {})

  const [usageOpts, setUsageOpts] = useState(USAGE_OPTIONS[2])
  const [usage, setUsage] = useState(null)
  const [versions, setVersions] = useState(null)
  const [showFiles, setShowFiles] = useState(false)
  const [neurons, setNeurons] = useState(null)
  const [hoverBar, setHoverBar] = useState(null)

  useEffect(() => {
    let dead = false
    fetch('/api/system/versions').then(r => r.ok ? r.json() : null).then(d => { if (!dead) setVersions(d) }).catch(() => {})
    return () => { dead = true }
  }, [])

  useEffect(() => {
    let dead = false
    setUsage(null)
    fetch(`/api/usage/summary?granularity=${usageOpts.granularity}&period=${usageOpts.period}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!dead) setUsage(d || EMPTY_USAGE) })
      .catch(() => { if (!dead) setUsage(EMPTY_USAGE) })
    return () => { dead = true }
  }, [usageOpts])

  useEffect(() => {
    let dead = false
    fetch('/api/graph/full').then(r => r.ok ? r.json() : { nodes: [], edges: [] }).then(d => { if (!dead) setNeurons(d) }).catch(() => {})
    return () => { dead = true }
  }, [])

  const rawTotal = (stats.raw_files || 0) + (stats.outputs || 0)
  const counters = [
    { icon: 'description', label: 'ARCHIVOS', value: rawTotal, onClick: () => setShowFiles(v => !v) },
    { icon: 'psychology', label: 'NODOS', value: neurons?.nodes?.length || 0, onClick: () => onTabChange('graph') },
    { icon: 'hub', label: 'RELACIONES', value: neurons?.edges?.length || 0, onClick: () => onTabChange('graph') },
    { icon: 'folder', label: 'PROYECTOS', value: projects?.length || 0, onClick: () => onTabChange('cerebro') },
  ]

  const buckets = usage?.buckets || []
  const maxTok = Math.max(1, ...buckets.map(b => b.tokens || 0))
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 6))
  const provMax = Math.max(0.0000001, ...(usage?.by_provider || []).map(p => p.cost))

  return (
    <div>
      <h1 className="section-title">Panel general</h1>

      {/* Contadores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
        {counters.map(c => (
          <div key={c.label} className="card card-hover" role="button" tabIndex={0}
            onClick={c.onClick}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.onClick() } }}
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 120, cursor: 'pointer' }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)', color: 'var(--color-primary)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{c.icon}</span>
            </div>
            <div>
              <div className="label-caps" style={{ marginBottom: 'var(--space-1)' }}>{c.label}</div>
              <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--color-primary-container)', lineHeight: 1, letterSpacing: '-0.04em' }}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      {showFiles && (
        <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-5)' }}>
          <div className="label-caps" style={{ marginBottom: 'var(--space-3)' }}>DESGLOSE DE ARCHIVOS</div>
          <InfoRow label="RAW (aportados por ti)" value={stats.raw_files || 0} />
          <InfoRow label="OUTPUT (generados por el sistema)" value={stats.outputs || 0} />
        </div>
      )}

      {/* Consumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-surface-high)', flexWrap: 'wrap' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 20 }}>electric_bolt</span>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Tokens</h2>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {usage ? usage.total_tokens.toLocaleString('es-ES') : '…'}
            </span>
            <select value={usageOpts.label} onChange={e => setUsageOpts(USAGE_OPTIONS.find(o => o.label === e.target.value))}
              style={{ marginLeft: 'auto', fontSize: 13, padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}>
              {USAGE_OPTIONS.map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
            </select>
          </div>
          <Chart bars={buckets} maxTok={maxTok} labelEvery={labelEvery} loading={!usage} hover={hoverBar} onHover={setHoverBar} />
        </div>

        <div className="card">
          <CardHeader icon="cloud" title="Consumo económico" />
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {usage ? `$${usage.total_cost.toFixed(usage.total_cost > 0 && usage.total_cost < 0.01 ? 4 : 2)}` : '…'}
          </div>
          <div className="label-caps" style={{ margin: 'var(--space-4) 0 var(--space-2)' }}>POR PROVEEDOR</div>
          {!usage
            ? <p style={{ color: 'var(--color-text-tertiary)' }}>Cargando…</p>
            : (usage.by_provider || []).map(p => (
              <div key={p.provider} style={{ marginBottom: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>{p.provider}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: p.cost > 0 ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>${p.cost.toFixed(p.cost > 0 && p.cost < 0.01 ? 4 : 2)}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)' }}>
                  <div style={{ width: `${(p.cost / provMax) * 100}%`, height: '100%', borderRadius: 3, background: p.cost > 0 ? 'var(--color-primary)' : 'transparent' }} />
                </div>
              </div>
            ))}
          <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 'var(--space-3)' }}>Estimación de OmniRoute. IA local (Ollama): coste $0.</p>
        </div>
      </div>

      {/* Sistema + Tu Cerebro */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        <div className="card">
          <CardHeader icon="memory" title="Sistema" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
            <div>
              <div className="label-caps" style={{ marginBottom: 'var(--space-3)' }}>VERSIONES</div>
              {versions
                ? Object.entries(versions).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', padding: '5px 0', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{k}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, overflowWrap: 'anywhere', textAlign: 'right' }}>{v || '—'}</span>
                  </div>
                ))
                : <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Cargando…</p>}
            </div>
            <div>
              <div className="label-caps" style={{ marginBottom: 'var(--space-3)' }}>CONTENEDORES</div>
              {containerList.map(([name, info]) => {
                const running = info?.running !== undefined ? info.running : info?.status === 'running'
                return (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-2)', background: 'color-mix(in srgb, var(--color-text-primary) 5%, transparent)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span className={`status-dot ${running ? 'activo' : 'parado'}`} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>{name}</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: running ? 'var(--color-success)' : 'var(--color-error)' }}>● {running ? 'activo' : 'parado'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="card">
          <CardHeader icon="encrypted" title="Tu Cerebro" />
          {vaultInfo?.manifest ? (
            <>
              <InfoRow label="Fecha de creación" value={vaultInfo.manifest.createdAt ? new Date(vaultInfo.manifest.createdAt).toLocaleDateString('es-ES') : '—'} />
              <InfoRow label="Ubicación del vault" mono value={vaultInfo.vault_host_path || systemInfo?.vault_path || '—'} />
              <InfoRow label="Nombre del agente" badge value={editAgentName || 'Hermes'} />
            </>
          ) : (
            <p style={{ color: 'var(--color-text-tertiary)' }}>Cargando información del vault...</p>
          )}
        </div>
      </div>
    </div>
  )
}

function CardHeader({ icon, title, chip }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-surface-high)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 20 }}>{icon}</span>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>{title}</h2>
      </div>
      {chip}
    </div>
  )
}

function Chart({ bars, maxTok, labelEvery, loading, hover, onHover }) {
  if (loading) return <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Cargando gráfico…</div>
  if (!bars.length) return <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Sin datos en este período</div>
  const h = hover != null ? bars[hover] : null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }} role="img" aria-label="Tokens por período"
        onMouseLeave={() => onHover(null)}>
        {bars.map((b, i) => (
          <div key={i}
            onMouseEnter={() => onHover(i)}
            style={{ flex: 1, display: 'flex', alignItems: 'flex-end', height: '100%', cursor: 'default', padding: '0 1px', borderRadius: 2, background: hover === i ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent' }}>
            <div style={{ flex: 1, height: `${Math.max(2, ((b.tokens || 0) / maxTok) * 100)}%`, background: 'var(--color-primary)', opacity: hover == null || hover === i ? 0.85 : 0.35, borderRadius: 2, minHeight: 2 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
        {bars.map((b, i) => (
          <div key={i} style={{ flex: 1, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'visible' }}>
            {i % labelEvery === 0 ? b.label : ''}
          </div>
        ))}
      </div>
      <div style={{ height: 20, marginTop: 8, fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
        {h ? `${h.label}: ${(h.tokens || 0).toLocaleString('es-ES')} tokens` : ''}
      </div>
    </div>
  )
}

function InfoRow({ label, value, badge, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-surface)' }}>
      <span style={{ color: 'var(--color-text-secondary)', fontSize: 15 }}>{label}</span>
      {badge ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '4px 12px', background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', borderRadius: 'var(--radius-full)', border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)' }}>
          <span className="status-dot running" />
          <span style={{ color: 'var(--color-primary)', fontSize: 14, fontWeight: 500 }}>{value}</span>
        </div>
      ) : (
        <span style={{ fontWeight: 500, ...(mono ? { fontFamily: 'var(--font-mono)', fontSize: 13, overflowWrap: 'anywhere' } : {}) }}>{value}</span>
      )}
    </div>
  )
}

export default DashboardView
