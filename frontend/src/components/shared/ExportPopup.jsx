import React, { useState } from 'react'

// ponytail: popup de export — mismo estilo que AddFilesPopup
function ExportPopup({ onClose, onExport, vaultMessage, vaultMessageType }) {
  const [name, setName] = useState('vault-export')
  const [exporting, setExporting] = useState(false)

  const popupStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  }
  const cardStyle = {
    background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-surface-high)',
    padding: 'var(--space-6)', minWidth: 400, maxWidth: 520,
  }

  const handleExport = async () => {
    if (!name.trim()) return
    setExporting(true)
    await onExport(name.trim())
    setExporting(false)
  }

  return (
    <div style={popupStyle} onClick={(e) => e.target === e.currentTarget && !exporting && onClose()}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>download</span>
            Exportar vault
          </h2>
          <button onClick={onClose} disabled={exporting} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label className="label-caps" style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--space-2)' }}>Nombre del archivo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input className="input-app" value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !exporting && handleExport()}
                placeholder="vault-export" style={{ flex: 1 }} disabled={exporting} />
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 14, whiteSpace: 'nowrap' }}>.tar.gz</span>
            </div>
          </div>

          {vaultMessage && (
            <div style={{
              padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)',
              background: vaultMessageType === 'success' ? 'rgba(78,222,163,0.1)' : vaultMessageType === 'error' ? 'rgba(255,180,171,0.1)' : 'rgba(173,198,255,0.1)',
              color: vaultMessageType === 'success' ? 'var(--color-success)' : vaultMessageType === 'error' ? 'var(--color-error)' : 'var(--color-primary)',
              fontSize: 14,
            }}>
              {vaultMessage}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn-app btn-app-secondary" onClick={onClose} disabled={exporting}>Cancelar</button>
            <button className="btn-app btn-app-primary" disabled={!name.trim() || exporting}
              onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {exporting ? (
                <><span className="material-symbols-outlined" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>sync</span> Exportando...</>
              ) : (
                <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span> Exportar</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExportPopup
