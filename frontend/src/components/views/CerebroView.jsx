import React from 'react'

function CerebroView({ subtab, setSubtab, rawFiles, outputFiles, search, setSearch, selected, setSelected, onDelete, deleting }) {
  const files = subtab === 'raw' ? rawFiles : outputFiles
  const filtered = search ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase())) : files
  const selectedCount = Object.entries(selected).filter(([k, v]) => v && k.startsWith(subtab + '|')).length

  const fileIcon = (ext) =>
    ['png','jpg','jpeg','gif','webp','bmp'].includes(ext) ? 'image' :
    ['mp3','wav','ogg','m4a','aac','flac'].includes(ext) ? 'audio_file' :
    ['mp4','webm','mov','avi','mkv'].includes(ext) ? 'movie' : 'description'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 28 }}>science</span>
        <h1 className="section-title" style={{ marginBottom: 0 }}>Cerebro</h1>
      </div>
      <p className="section-subtitle">Gestión de archivos raw y outputs. Eliminar actualiza el grafo.</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <TabButton active={subtab === 'raw'} onClick={() => setSubtab('raw')} icon="inventory_2" label="Raw" count={rawFiles.length} />
        <TabButton active={subtab === 'outputs'} onClick={() => setSubtab('outputs')} icon="upload" label="Outputs" count={outputFiles.length} />
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
        <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', fontSize: 20 }}>search</span>
        <input className="input-app" style={{ paddingLeft: 40 }} placeholder="Buscar archivo..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Actions bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>{selectedCount} seleccionado(s) de {filtered.length}</span>
        <button className="btn-app btn-app-danger" onClick={onDelete} disabled={!selectedCount || deleting} style={{ opacity: (!selectedCount || deleting) ? 0.5 : 1 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
          Eliminar ({selectedCount})
        </button>
      </div>

      {/* File list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '3rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3 }}>folder_off</span>
            <p style={{ marginTop: 'var(--space-2)' }}>No hay archivos {subtab === 'raw' ? 'raw' : 'de outputs'}</p>
          </div>
        ) : (
          filtered.map(f => {
            const key = `${subtab}|${f.path}`
            return (
              <div key={key} className="card card-hover" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <input type="checkbox" checked={!!selected[key]} onChange={(e) => setSelected(prev => ({ ...prev, [key]: e.target.checked }))}
                  style={{ width: 18, height: 18, accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
                <span className="material-symbols-outlined" style={{ color: 'var(--color-text-tertiary)' }}>{fileIcon(f.ext)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{f.name}</div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 2 }}>
                    <span className="label-caps">{f.path}</span>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>•</span>
                    <span className="label-caps">{(f.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, icon, label, count }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-2)',
      padding: 'var(--space-3) var(--space-4)', minWidth: 120, borderRadius: 'var(--radius-md)', cursor: 'pointer',
      background: active ? 'rgba(173,198,255,0.1)' : 'rgba(255,255,255,0.03)',
      border: active ? '1px solid rgba(173,198,255,0.2)' : '1px solid rgba(255,255,255,0.1)',
      transition: 'all var(--transition-fast)',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 24, color: active ? 'var(--color-primary)' : 'var(--color-text-tertiary)' }}>{icon}</span>
      <span style={{ fontSize: 16, fontWeight: 500, color: active ? 'var(--color-primary)' : 'var(--color-text-tertiary)' }}>{label}</span>
      <span className="label-caps" style={{ color: active ? 'var(--color-primary)' : 'var(--color-text-tertiary)', opacity: 0.7 }}>({count})</span>
    </button>
  )
}

export default CerebroView