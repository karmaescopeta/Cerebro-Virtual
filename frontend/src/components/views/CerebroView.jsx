import React, { useState, useRef, useEffect } from 'react'
import AddFilesPopup from '../shared/AddFilesPopup'

function CerebroView({ subtab, setSubtab, rawFiles, outputFiles, search, setSearch, selected, setSelected, onDelete, deleting, onReloadRaw, onRefreshGraph, onReloadProjects }) {
  const [showPopup, setShowPopup] = useState(false)
  const [projects, setProjects] = useState([])
  const [expandedFolders, setExpandedFolders] = useState({})

  // ponytail: cargar proyectos al montar
  useEffect(() => {
    if (subtab === 'raw') loadProjects()
  }, [subtab])

  async function loadProjects() {
    try { const d = await (await fetch('/api/projects')).json(); setProjects(d.projects || []) } catch {}
  }

  // ponytail: agrupar raw files por carpeta (proyecto). Excluir entradas "folder" del listing de archivos.
  const groupedRaw = React.useMemo(() => {
    const groups = {}
    rawFiles.forEach(f => {
      if (f.ext === 'folder') return // las carpetas se muestran como header, no como archivo
      const folder = f.path.split('/')[0] || 'individual'
      if (!groups[folder]) groups[folder] = []
      groups[folder].push(f)
    })
    // ponytail: incluir carpetas vacías de proyecto que vienen del backend
    rawFiles.forEach(f => {
      if (f.ext === 'folder') {
        const fid = f.path.replace('/', '')
        if (!groups[fid]) groups[fid] = []
      }
    })
    return groups
  }, [rawFiles])

  const files = subtab === 'raw' ? rawFiles.filter(f => f.ext !== 'folder') : outputFiles
  const filtered = search ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase())) : files
  const selectedCount = Object.entries(selected).filter(([k, v]) => v && k.startsWith(subtab + '|')).length

  const fileIcon = (ext) =>
    ext === 'folder' ? 'folder' :
    ['png','jpg','jpeg','gif','webp','bmp'].includes(ext) ? 'image' :
    ['mp3','wav','ogg','m4a','aac','flac'].includes(ext) ? 'audio_file' :
    ['mp4','webm','mov','avi','mkv'].includes(ext) ? 'movie' : 'description'

  // ponytail: obtener color/metadatos del proyecto por folder name
  const projectMeta = (folderId) => {
    const p = projects.find(p => p.id === folderId)
    return p || { id: folderId, name: folderId, color: '#666' }
  }

  const toggleFolder = (folder) => setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }))

  async function handleDeleteProject(projectId) {
    if (!confirm(`¿Borrar proyecto "${projectMeta(projectId).name}" y todos sus archivos?`)) return
    try { await fetch(`/api/projects/${projectId}`, { method: 'DELETE' }); await loadProjects(); onReloadProjects?.(); onReloadRaw?.(); onRefreshGraph?.() } catch {}
  }

  // ponytail: cerrar popup → refrescar todo
  const handleClosePopup = () => {
    setShowPopup(false)
    loadProjects()
    onReloadProjects?.()
    onReloadRaw?.()
    onRefreshGraph?.()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 28 }}>science</span>
          <h1 className="section-title" style={{ marginBottom: 0 }}>Cerebro</h1>
        </div>
        {subtab === 'raw' && (
          <button className="btn-app btn-app-primary" onClick={() => setShowPopup(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            Añadir archivos
          </button>
        )}
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
        ) : subtab === 'raw' ? (
          // ponytail: vista de carpetas por proyecto en Raw
          Object.entries(groupedRaw).map(([folder, folderFiles]) => {
            const meta = projectMeta(folder)
            const isExpanded = expandedFolders[folder] ?? true
            const filteredFolder = search ? folderFiles.filter(f => f.name.toLowerCase().includes(search.toLowerCase())) : folderFiles
            if (!filteredFolder.length && search) return null
            return (
              <div key={folder}>
                {/* Folder header */}
                <div className="card card-hover" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}
                  onClick={() => toggleFolder(folder)}>
                  <span className="material-symbols-outlined" style={{ color: meta.color, fontSize: 22 }}>{isExpanded ? 'folder_open' : 'folder'}</span>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{meta.name || folder}</span>
                  <span className="label-caps" style={{ color: 'var(--color-text-tertiary)' }}>({folderFiles.length})</span>
                  <div style={{ flex: 1 }} />
                  {projects.find(p => p.id === folder) && (
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(folder) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 'var(--space-1)' }}
                      title="Borrar proyecto">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                    </button>
                  )}
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-text-tertiary)', fontSize: 18, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>chevron_right</span>
                </div>
                {/* Files in folder */}
                {isExpanded && filteredFolder.map(f => {
                  const key = `raw|${f.path}`
                  return (
                    <div key={key} className="card" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginLeft: 'var(--space-6)', borderLeft: `3px solid ${meta.color}` }}>
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
                })}
              </div>
            )
          })
        ) : (
          // Outputs: lista plana (sin cambios)
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

      {showPopup && <AddFilesPopup onClose={handleClosePopup} projects={projects} onReloadProjects={loadProjects} />}
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
