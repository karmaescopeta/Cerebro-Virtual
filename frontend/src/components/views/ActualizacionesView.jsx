import React, { useState, useEffect } from 'react'

function ActualizacionesView() {
  const [components, setComponents] = useState([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(null)   // id en curso
  const [progress, setProgress] = useState(null)   // {total, done:[{id,ok}], current}
  const [result, setResult] = useState(null)       // {id, ok, message, rolledBack}

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
    setProgress({ total: 1, done: [], current: id })
    setResult(null)
    try {
      const res = await fetch(`/api/updates/apply/${id}`, { method: 'POST' })
      const data = await res.json()
      setResult({ id, ok: !!data.success, message: data.message || '', rolledBack: !!data.rolledBack })
    } catch (e) {
      setResult({ id, ok: false, message: String(e) })
    }
    setApplying(null)
    setProgress(null)
    load()
  }

  const applyAll = async () => {
    const targets = components.filter(c => c.update)
    setApplying('all')
    setProgress({ total: targets.length, done: [], current: targets[0]?.id })
    let ok = 0
    for (const c of targets) {
      let done = false
      try {
        const res = await fetch(`/api/updates/apply/${c.id}`, { method: 'POST' })
        done = (await res.json()).success
      } catch {}
      if (done) ok++
      setProgress(p => ({ ...p, done: [...p.done, { id: c.id, ok: done }], current: targets[targets.indexOf(c) + 1]?.id }))
    }
    setApplying(null)
    setProgress(null)
    setResult({ id: 'todos', ok: ok === targets.length, message: `${ok}/${targets.length} componentes actualizados` })
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        <h1 className="section-title" style={{ marginBottom: 0 }}>Actualizaciones</h1>
        {components.some(c => c.update) && (
          <button className="btn-app btn-app-primary" disabled={!!applying} onClick={applyAll}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span> Actualizar todo
          </button>
        )}
      </div>

      {applying && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'color-mix(in srgb, var(--color-background) 80%, transparent)',
          display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="loading-spinner" />
          <div style={{ fontWeight: 600 }}>
            {applying === 'all' ? 'Actualizando componentes' : `Actualizando ${applying}`}
          </div>
          {progress && (
            <div style={{ minWidth: 300, maxWidth: '90vw', display: 'grid', gap: 'var(--space-2)' }}>
              {progress.done.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 13.5 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: d.ok ? 'var(--color-success)' : 'var(--color-error)' }}>{d.ok ? 'check_circle' : 'error'}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{d.id} — {d.ok ? 'actualizado' : 'fallo (rollback si había backup)'}</span>
                </div>
              ))}
              {progress.current && !progress.done.some(d => d.id === progress.current) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 13.5 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }}>progress_activity</span>
                  <span>{progress.current} — actualizando…</span>
                </div>
              )}
              <div style={{ height: 6, background: 'var(--color-surface-high)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress.total ? (progress.done.length / progress.total) * 100 : 0}%`, background: 'var(--color-primary)', borderRadius: 999, transition: 'width .3s' }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                {progress.done.length} de {progress.total} terminados — la aplicación queda bloqueada hasta terminar
              </div>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="card" style={{
          marginBottom: 'var(--space-5)', padding: 'var(--space-4)',
          borderColor: result.ok ? 'color-mix(in srgb, var(--color-success) 30%, transparent)' : 'color-mix(in srgb, var(--color-error) 30%, transparent)',
        }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span className="material-symbols-outlined" style={{
              color: result.ok ? 'var(--color-success)' : 'var(--color-error)', fontSize: 20
            }}>{result.ok ? 'check_circle' : 'error'}</span>
            <span style={{ fontWeight: 500 }}>
              {result.ok
                ? (result.message || `${result.id}: actualizado correctamente`)
                : (result.message ? `${result.id}: fallo — ${result.message}` : `${result.id}: fallo${result.rolledBack ? ' — rollback automático aplicado' : ''}`)}
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
        <div className="modelos-grid">
          {/* modelos-grid reutilizado: 4 col escritorio, 2 col móvil (patrón de Modelos) */}
          {components.map(c => (
            <div key={c.id} className="card updates-card" style={{
              display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', minWidth: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</span>
                  {c.latest === 'unknown' ? (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--color-surface-high)', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>SIN DATOS</span>
                  ) : c.update ? (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-error) 12%, transparent)', color: 'var(--color-error)', fontWeight: 600 }}>ACTUALIZACIÓN</span>
                    ) : (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-success) 10%, transparent)', color: 'var(--color-success)', fontWeight: 600 }}>AL DÍA</span>
                    )}
                  </div>
                    <div style={{ marginTop: 'var(--space-1)', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--color-text-secondary)', wordBreak: 'break-all' }}>
                        {c.latest === 'unknown' ? c.current : `${c.current} → ${c.target || c.latest}`}
                        {c.date && <span style={{ marginLeft: 'var(--space-2)' }}>· {c.date}</span>}
                      </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 'auto', flexWrap: 'wrap' }}>
                      {c.url && (
                        <a href={c.url} target="_blank" rel="noreferrer" className="btn-app btn-app-secondary updates-more"
                          style={{ textDecoration: 'none', fontSize: 12, padding: '6px 8px', gap: 4, whiteSpace: 'nowrap' }}
                          title="Más info">
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
                          <span className="updates-more-label">Más info</span>
                        </a>
                      )}
                      {c.update && (
                        <button
                          className="btn-app btn-app-primary"
                          style={{ fontSize: 12, padding: '6px 8px', gap: 4, whiteSpace: 'nowrap' }}
                          disabled={!!applying}
                          onClick={() => apply(c.id)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>sync</span>
                          {applying === c.id ? 'Actualizando…' : 'Actualizar'}
                        </button>
                      )}
                    </div>
                  </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ActualizacionesView
