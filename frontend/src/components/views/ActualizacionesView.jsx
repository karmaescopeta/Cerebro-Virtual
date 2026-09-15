import React, { useState, useEffect } from 'react'

function ActualizacionesView() {
  const [components, setComponents] = useState([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(null)   // id en curso
  const [result, setResult] = useState(null)       // {id, ok, message, rolledBack}
  const [expanded, setExpanded] = useState(null)   // id con resumen completo

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/updates/check')
      const data = await res.json()
      setComponents(data.components || [])
    } catch {
      setComponents([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const apply = async (id) => {
    setApplying(id)
    setResult(null)
    try {
      const res = await fetch(`/api/updates/apply/${id}`, { method: 'POST' })
      const data = await res.json()
      setResult({ id, ok: !!data.success, message: data.message || '', rolledBack: !!data.rolledBack })
    } catch (e) {
      setResult({ id, ok: false, message: String(e) })
    }
    setApplying(null)
    load()
  }

  return (
    <div>
      <h1 className="section-title">Actualizaciones</h1>
      <p className="section-subtitle">
        Componentes del sistema, versiones y actualizaciones disponibles.
      </p>

      {result && (
        <div className="card" style={{
          marginBottom: 'var(--space-5)', padding: 'var(--space-4)',
          borderColor: result.ok ? 'rgba(78,222,163,0.3)' : 'rgba(255,180,171,0.3)',
        }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span className="material-symbols-outlined" style={{
              color: result.ok ? 'var(--color-success)' : 'var(--color-error)', fontSize: 20
            }}>{result.ok ? 'check_circle' : 'error'}</span>
            <span style={{ fontWeight: 500 }}>
              {result.ok ? `${result.id}: actualizado correctamente` :
                `${result.id}: fallo${result.rolledBack ? ' — rollback automático aplicado' : ''}`}
            </span>
          </div>
          {result.message && (
            <div style={{ marginTop: 'var(--space-2)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)', wordBreak: 'break-word' }}>
              {result.message}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--color-text-secondary)' }}>Comprobando…</div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {components.map(c => (
            <div key={c.id} className="card" style={{ padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontWeight: 600, fontSize: 16 }}>{c.name}</span>
                    {c.update ? (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,180,171,0.12)', color: 'var(--color-error)', fontWeight: 600 }}>ACTUALIZACIÓN</span>
                    ) : (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(78,222,163,0.1)', color: 'var(--color-success)', fontWeight: 600 }}>AL DÍA</span>
                    )}
                  </div>
                  <div style={{ marginTop: 'var(--space-1)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {c.current} → {c.latest}
                    {c.date && <span style={{ marginLeft: 'var(--space-2)' }}>{c.date}</span>}
                  </div>
                  {c.summary && (
                    <div style={{
                      marginTop: 'var(--space-3)', fontSize: 13, color: 'var(--color-text-secondary)',
                      display: '-webkit-box', WebkitLineClamp: expanded === c.id ? 'unset' : 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-line',
                    }}>
                      {c.summary}
                    </div>
                  )}
                  {c.summary && expanded !== c.id && (
                    <button className="btn-app btn-app-secondary" style={{ marginTop: 'var(--space-2)', fontSize: 12 }}
                      onClick={() => setExpanded(c.id)}>
                      Más info
                    </button>
                  )}
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noreferrer"
                      style={{ display: 'inline-block', marginLeft: 'var(--space-2)', marginTop: 'var(--space-2)', fontSize: 12, color: 'var(--color-primary)' }}>
                      Release en GitHub ↗
                    </a>
                  )}
                </div>
                <div>
                  <button
                    className={`btn-app ${c.update ? 'btn-app-primary' : 'btn-app-secondary'}`}
                    disabled={!!applying}
                    onClick={() => apply(c.id)}
                  >
                    {applying === c.id ? 'Actualizando…' : c.update ? 'Actualizar' : 'Revisar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ActualizacionesView
