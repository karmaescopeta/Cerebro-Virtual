import React, { useState, useEffect, useRef } from 'react'

// Cluster arriba-derecha: selector de tema (sol/luna) + campana de updates.
// ponytail: lógica de updates = Header original, sin cambios de comportamiento.
function TopRight({ updates, researchRunning, researchBadge, researchBadgeError, onOpenResearch }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [cerebroUpdating, setCerebroUpdating] = useState(false)
  const [hermesUpdating, setHermesUpdating] = useState(false)
  const [cerebroError, setCerebroError] = useState(null)
  const [hermesError, setHermesError] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setDropdownOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const hasUpdates = updates?.cerebro?.update || updates?.hermes?.update

  const handleCerebro = async () => {
    setCerebroUpdating(true); setCerebroError(null)
    try { const d = await (await fetch('/api/updates/cerebro', { method: 'POST' })).json()
      if (!d.success) setCerebroError(d.message || 'Error')
    } catch { setCerebroError('Error') }
    finally { setCerebroUpdating(false) }
  }

  const handleHermes = async () => {
    setHermesUpdating(true); setHermesError(null)
    try { const d = await (await fetch('/api/updates/hermes', { method: 'POST' })).json()
      if (!d.success && d.needsRollback) setHermesError(d.message)
      else if (!d.success) setHermesError(d.message || 'Error')
    } catch { setHermesError('Error') }
    finally { setHermesUpdating(false) }
  }

  const handleRollback = async () => {
    setHermesUpdating(true)
    try { await fetch('/api/updates/rollback/hermes', { method: 'POST' }); setHermesError(null) }
    catch { setHermesError('Rollback falló') }
    finally { setHermesUpdating(false) }
  }

  return (
    <div className="top-right">
      {/* fase 3 visor-md: investigación/importaciones accesibles desde cualquier pestaña */}
      <button className={`topright-research ${researchRunning ? 'running' : ''}`} title="Investigación" aria-label="Investigación" onClick={onOpenResearch}>
        <span className="material-symbols-outlined">science</span>
        {researchBadge && <span className="topright-research-dot" />}
        {researchBadgeError && <span className="topright-research-dot error" title="Guardado sin neuronas o fallido — ábrelo para más info" />}
      </button>
      <div className="notif-container" ref={ref}>
        <button
          className="notif-btn"
          title="Actualizaciones"
          aria-label="Notificaciones de actualizaciones"
          onClick={() => setDropdownOpen(v => !v)}
        >
          <span className="material-symbols-outlined">notifications</span>
          {hasUpdates && <span className="notif-badge" />}
        </button>
        {dropdownOpen && (
          <div className="notif-dropdown">
            {updates?.cerebro?.update && (
              <div className="notif-section">
                <div className="notif-section-title">Cerebro Virtual</div>
                <div className="notif-versions">
                  <span className="notif-ver">{updates.cerebro.current}</span>
                  <span className="notif-arrow">→</span>
                  <span className="notif-ver-new">{updates.cerebro.latest} {updates.cerebro.date && <span className="notif-date">({updates.cerebro.date})</span>}</span>
                </div>
                {updates.cerebro.changelog && (
                  <div className="notif-changelog">{updates.cerebro.changelog}</div>
                )}
                {!cerebroError && (
                  <button className="btn-app btn-app-primary notif-action" onClick={handleCerebro} disabled={cerebroUpdating}>
                    {cerebroUpdating ? <><div className="notif-spinner" /> Actualizando...</> : 'Actualizar Cerebro'}
                  </button>
                )}
                {cerebroError && <div className="notif-error">{cerebroError}</div>}
              </div>
            )}
            {updates?.hermes?.update && (
              <div className="notif-section">
                <div className="notif-section-title">Hermes Agent</div>
                <div className="notif-versions">
                  <span className="notif-ver">{updates.hermes.current}</span>
                  <span className="notif-arrow">→</span>
                  <span className="notif-ver-new">{updates.hermes.latest} {updates.hermes.date && <span className="notif-date">({updates.hermes.date})</span>}</span>
                </div>
                {updates.hermes.changelog && (
                  <div className="notif-changelog">{updates.hermes.changelog}</div>
                )}
                {!hermesError && (
                  <button className="btn-app btn-app-primary notif-action" onClick={handleHermes} disabled={hermesUpdating}>
                    {hermesUpdating ? <><div className="notif-spinner" /> Actualizando...</> : 'Actualizar Hermes'}
                  </button>
                )}
                {hermesError && (
                  <>
                    <div className="notif-error">{hermesError}</div>
                    <button className="btn-app btn-app-danger notif-action" onClick={handleRollback} disabled={hermesUpdating}>
                      {hermesUpdating ? '...' : 'Rollback'}
                    </button>
                  </>
                )}
              </div>
            )}
            {!hasUpdates && (
              <div className="notif-section">
                <div className="notif-ok" style={{ textAlign: 'center', padding: 'var(--space-3)' }}>✓ Todo actualizado</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default TopRight