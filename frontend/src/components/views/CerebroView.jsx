import React, { useState, useRef, useEffect } from 'react'
import AddFilesPopup from '../shared/AddFilesPopup'
import MarkdownViewer from '../shared/MarkdownViewer'

function CerebroView({ subtab, setSubtab, rawFiles, outputFiles, search, setSearch, selected, setSelected, onDelete, deleting, onReloadRaw, onRefreshGraph, onReloadProjects, projects: parentProjects }) {
  const [showPopup, setShowPopup] = useState(false)
  const [projects, setProjects] = useState([])
  const [expandedFolders, setExpandedFolders] = useState({})
  const [previewDoc, setPreviewDoc] = useState(null)
  // ponytail: modo edición
  const [editMode, setEditMode] = useState(false)
  const [editNames, setEditNames] = useState({}) // {key: newName}
  const [editProjects, setEditProjects] = useState({}) // {projectId: {name, color}}
  const [editSaving, setEditSaving] = useState(false)
  // ponytail: modal reasignar
  const [showReassign, setShowReassign] = useState(false)
  const [reassignTarget, setReassignTarget] = useState('individual')
  const [reassigning, setReassigning] = useState(false)
  // ponytail: modal último archivo
  const [lastFileModal, setLastFileModal] = useState(null) // {projects: [{id, name}], items: [...]}
  const [wikiFiles, setWikiFiles] = useState(null)

  useEffect(() => { loadProjects() }, [subtab])
  useEffect(() => { if (subtab === 'estructura') loadWikiStems() }, [subtab])

  async function loadWikiStems() {
    // ponytail: stems de wiki/ para marcar "Procesando…" — el grafo ya trae nodos wiki con source_file
    try {
      const d = await (await fetch('/api/wiki/graph')).json()
      setWikiFiles((d.nodes || []).map(n => (n.source_file || '').split('/').pop()).filter(Boolean))
    } catch { setWikiFiles([]) }
  }

  async function loadProjects() {
    try { const d = await (await fetch('/api/projects')).json(); setProjects(d.projects || []) } catch {}
  }

  // ponytail: agrupar raw+outputs por proyecto para estructura
  const structure = React.useMemo(() => {
    const groups = {}
    projects.forEach(p => { groups[p.id] = { name: p.name, color: p.color, files: [] } })
    groups['individual'] = { name: 'Individual', color: '#666', files: [] }
    rawFiles.forEach(f => {
      if (f.ext === 'folder') return
      const parts = f.path.split('/')
      const folder = parts.length > 1 ? parts[0] : 'individual'
      if (!groups[folder]) groups[folder] = { name: folder, color: '#666', files: [] }
      // ponytail: wiki_pending — raw sin wiki/<stem>.md y no es texto plano = aún procesando (o OCR falló)
      const stem = f.name.replace(/\.[^.]+$/, '')
      const hasWiki = wikiFiles?.includes(stem + '.md')
      groups[folder].files.push({ ...f, category: 'raw', wiki_pending: !hasWiki && !['txt', 'md'].includes(f.ext) })
    })
    outputFiles.forEach(f => {
      const parts = f.path.split('/')
      const folder = parts.length > 1 ? parts[0] : 'individual'
      if (!groups[folder]) groups[folder] = { name: folder, color: '#666', files: [] }
      groups[folder].files.push({ ...f, category: 'outputs' })
    })
    return groups
  }, [rawFiles, outputFiles, projects, wikiFiles])

  const rawFlat = rawFiles.filter(f => f.ext !== 'folder')
  const files = subtab === 'raw' ? rawFlat : subtab === 'outputs' ? outputFiles : []
  const filtered = search ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase())) : files
  const selectedCount = Object.entries(selected).filter(([k, v]) => v && k.startsWith(subtab + '|')).length

  const fileIcon = (ext) =>
    ext === 'folder' ? 'folder' :
    ['png','jpg','jpeg','gif','webp','bmp'].includes(ext) ? 'image' :
    ['mp3','wav','ogg','m4a','aac','flac'].includes(ext) ? 'audio_file' :
    ['mp4','webm','mov','avi','mkv'].includes(ext) ? 'movie' : 'description'

  const projectMeta = (folderId) => {
    const p = projects.find(p => p.id === folderId)
    return p || { id: folderId, name: folderId, color: '#666' }
  }

  const toggleFolder = (folder) => setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }))

  async function handleDeleteProject(projectId) {
    if (!confirm(`¿Borrar proyecto "${projectMeta(projectId).name}" y todos sus archivos?`)) return
    try { await fetch(`/api/projects/${projectId}`, { method: 'DELETE' }); await loadProjects(); onReloadProjects?.(); onReloadRaw?.(); onRefreshGraph?.() } catch {}
  }

  async function handlePreview(f, category) {
    const ext = f.ext?.toLowerCase() || ''
    if (ext === 'md') {
      try {
        const res = await fetch(`/vault-static/${category}/${f.path}`)
        const content = await res.text()
        setPreviewDoc({ content, name: f.name, ext })
      } catch {}
    } else {
      window.open(`/vault-static/${category}/${f.path}`, '_blank')
    }
  }

  const handleClosePopup = () => {
    setShowPopup(false)
    loadProjects()
    onReloadProjects?.()
    onReloadRaw?.()
    onRefreshGraph?.()
  }

  const structSelectedCount = Object.entries(selected).filter(([k, v]) => v && k.startsWith('estructura|')).length

  // ponytail: detectar últimos archivos por proyecto antes de eliminar
  function checkLastFiles(items) {
    // agrupar items por project_id
    const byProject = {}
    items.forEach(item => {
      const parts = item.path.split('/')
      if (parts.length > 1) {
        const pid = parts[0]
        if (!byProject[pid]) byProject[pid] = []
        byProject[pid].push(item)
      }
    })
    // para cada proyecto, verificar si todos sus archivos están siendo eliminados
    const lastProjects = []
    Object.entries(byProject).forEach(([pid, projItems]) => {
      const projInfo = projects.find(p => p.id === pid)
      if (!projInfo) return // individual o desconocido
      // contar archivos totales del proyecto en estructura
      const allFiles = (structure[pid]?.files || [])
      if (allFiles.length === projItems.length && projItems.length > 0) {
        lastProjects.push({ id: pid, name: projInfo.name })
      }
    })
    return lastProjects
  }

  // ponytail: override onDelete para detectar último archivo
  async function handleSmartDelete() {
    const items = Object.entries(selected).filter(([, v]) => v).map(([k]) => {
      const parts = k.split('|')
      const category = parts[0] === 'estructura' ? parts[1] : parts[0]
      const path = parts[0] === 'estructura' ? parts.slice(2).join('|') : parts.slice(1).join('|')
      return { category, path }
    })
    if (!items.length) return

    const lastProjects = checkLastFiles(items)
    if (lastProjects.length > 0) {
      setLastFileModal({ projects: lastProjects, items })
      return
    }
    onDelete()
  }

  // ponytail: eliminar todo (proyectos + archivos)
  async function handleDeleteAll() {
    const { projects: lastProjs, items } = lastFileModal
    setDeletingAll(true)
    try {
      // borrar proyectos completos
      for (const p of lastProjs) {
        await fetch(`/api/projects/${p.id}`, { method: 'DELETE' })
      }
      // borrar archivos restantes que no pertenecen a proyectos eliminados
      const remaining = items.filter(item => {
        const parts = item.path.split('/')
        const pid = parts.length > 1 ? parts[0] : null
        return !lastProjs.some(p => p.id === pid)
      })
      if (remaining.length) {
        await fetch('/api/vault/batch-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(remaining) })
      }
      setSelected({})
      await loadProjects()
      onReloadProjects?.()
      onReloadRaw?.()
      onRefreshGraph?.()
    } catch {} finally { setDeletingAll(false); setLastFileModal(null) }
  }

  // ponytail: conservar proyecto, solo borrar archivos
  async function handleKeepProject() {
    setLastFileModal(null)
    onDelete()
  }

  // ponytail: guardar edición
  async function handleSaveEdit() {
    setEditSaving(true)
    try {
      // renombrar archivos — preservar extensión original
      for (const [key, newStem] of Object.entries(editNames)) {
        if (!newStem.trim()) continue
        // key = "category|path"
        const parts = key.split('|')
        let category = parts[0]
        let path = parts.slice(1).join('|')
        let oldName = path.split('/').pop()
        // ponytail: extraer extensión original y reenviarla
        let ext = oldName.includes('.') ? '.' + oldName.split('.').pop() : ''
        let newName = newStem + ext
        if (newName !== oldName) {
          await fetch('/api/vault/rename', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, path, newName })
          })
        }
      }
      // renombrar/editar proyectos
      for (const [pid, edits] of Object.entries(editProjects)) {
        const body = {}
        if (edits.name !== undefined) body.name = edits.name
        if (edits.color !== undefined) body.color = edits.color
        if (Object.keys(body).length) {
          await fetch(`/api/projects/${pid}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
        }
      }
      setEditNames({})
      setEditProjects({})
      setEditMode(false)
      await loadProjects()
      onReloadProjects?.()
      onReloadRaw?.()
      onRefreshGraph?.()
    } catch {} finally { setEditSaving(false) }
  }

  // ponytail: reasignar archivos
  async function handleReassign() {
    setReassigning(true)
    try {
      const items = Object.entries(selected).filter(([, v]) => v).map(([k]) => {
        const parts = k.split('|')
        const category = parts[0] === 'estructura' ? parts[1] : parts[0]
        const path = parts[0] === 'estructura' ? parts.slice(2).join('|') : parts.slice(1).join('|')
        return { category, path }
      })
      if (!items.length) return
      const d = await fetch('/api/vault/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, targetProject: reassignTarget })
      }).then(r => r.json())
      if (d.errors?.length) alert('Errores: ' + d.errors.map(e => e.path).join(', '))
      setSelected({})
      setShowReassign(false)
      await loadProjects()
      onReloadProjects?.()
      onReloadRaw?.()
      onRefreshGraph?.()
    } catch {} finally { setReassigning(false) }
  }

  // ponytail: helper para cerebroDeleting state local (handleDeleteAll necesita su propio loading)
  const [deletingAll, setDeletingAll] = useState(false)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 28 }}>science</span>
          <h1 className="section-title" style={{ marginBottom: 0 }}>Cerebro</h1>
        </div>
        {(subtab === 'estructura' || subtab === 'raw') && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {subtab === 'estructura' && (
              <>
                {editMode ? (
                  <button className="btn-app btn-app-primary" onClick={handleSaveEdit} disabled={editSaving}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
                    {editSaving ? 'Guardando...' : 'Guardar'}
                  </button>
                ) : (
                  <button className="btn-app btn-app-secondary" onClick={() => { setEditMode(true); setEditNames({}); setEditProjects({}) }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                    Editar
                  </button>
                )}
                {structSelectedCount > 0 && !editMode && (
                  <button className="btn-app btn-app-secondary" onClick={() => setShowReassign(true)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>swap_horiz</span>
                    Reasignar ({structSelectedCount})
                  </button>
                )}
              </>
            )}
            <button className="btn-app btn-app-primary" onClick={() => setShowPopup(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              Añadir archivos
            </button>
          </div>
        )}
      </div>
      <p className="section-subtitle">Estructura organiza archivos por proyecto. Raw y Outputs muestran archivos planos.</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
        <TabButton active={subtab === 'estructura'} onClick={() => setSubtab('estructura')} icon="account_tree" label="Estructura" />
        <TabButton active={subtab === 'raw'} onClick={() => setSubtab('raw')} icon="inventory_2" label="Raw" count={rawFlat.length} />
        <TabButton active={subtab === 'outputs'} onClick={() => setSubtab('outputs')} icon="upload" label="Outputs" count={outputFiles.length} />
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
        <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', fontSize: 20 }}>search</span>
        <input className="input-app" style={{ paddingLeft: 40 }} placeholder="Buscar archivo..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Actions bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>{subtab === 'estructura' ? structSelectedCount : selectedCount} seleccionado(s)</span>
        {!editMode && (
          <button className="btn-app btn-app-danger" onClick={subtab === 'estructura' ? handleSmartDelete : onDelete} disabled={!(subtab === 'estructura' ? structSelectedCount : selectedCount) || deleting} style={{ opacity: (!(subtab === 'estructura' ? structSelectedCount : selectedCount) || deleting) ? 0.5 : 1 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
            Eliminar ({subtab === 'estructura' ? structSelectedCount : selectedCount})
          </button>
        )}
      </div>

      {/* File list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {subtab === 'estructura' ? (
          Object.entries(structure).map(([folder, info]) => {
            if (info.files.length === 0 && folder !== 'individual') return null
            const isExpanded = expandedFolders[folder] ?? true
            const filteredFiles = search ? info.files.filter(f => f.name.toLowerCase().includes(search.toLowerCase())) : info.files
            if (!filteredFiles.length && search) return null
            return (
              <div key={folder}>
                <div className="card card-hover" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}
                  onClick={() => toggleFolder(folder)}>
                  <div style={{ width: 12, height: 12, borderRadius: 'var(--radius-full)', background: editProjects[folder]?.color || info.color, boxShadow: `0 0 6px ${editProjects[folder]?.color || info.color}`, flexShrink: 0 }} />
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: editProjects[folder]?.color || info.color }}>{isExpanded ? 'folder_open' : 'folder'}</span>
                  {editMode && projects.find(p => p.id === folder) ? (
                    <>
                      <input
                        value={editProjects[folder]?.name ?? info.name}
                        onChange={(e) => setEditProjects(prev => ({ ...prev, [folder]: { ...prev[folder], name: e.target.value } }))}
                        onClick={e => e.stopPropagation()}
                        style={{ fontWeight: 600, fontSize: 15, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', color: 'var(--color-text-primary)', minWidth: 100 }}
                      />
                      <input
                        type="color"
                        value={editProjects[folder]?.color || info.color}
                        onChange={(e) => setEditProjects(prev => ({ ...prev, [folder]: { ...prev[folder], color: e.target.value } }))}
                        onClick={e => e.stopPropagation()}
                        style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
                      />
                    </>
                  ) : (
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{info.name}</span>
                  )}
                  <span className="label-caps" style={{ color: 'var(--color-text-tertiary)' }}>({info.files.length})</span>
                  <div style={{ flex: 1 }} />
                  {projects.find(p => p.id === folder) && !editMode && (
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(folder) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 'var(--space-1)' }}
                      title="Borrar proyecto">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                    </button>
                  )}
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-text-tertiary)', fontSize: 18, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>chevron_right</span>
                </div>
                {isExpanded && filteredFiles.map(f => {
                  const key = `estructura|${f.category}|${f.path}`
                  const editKey = `${f.category}|${f.path}`
                  return (
                    <div key={key} className="card" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginLeft: 'var(--space-6)', borderLeft: `3px solid ${editProjects[folder]?.color || info.color}` }}>
                      {!editMode && (
                        <input type="checkbox" checked={!!selected[key]} onChange={(e) => setSelected(prev => ({ ...prev, [key]: e.target.checked }))}
                          style={{ width: 18, height: 18, accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
                      )}
                      <span className="material-symbols-outlined" style={{ color: 'var(--color-text-tertiary)', fontSize: 18 }}>{f.category === 'raw' ? 'inventory_2' : 'upload'}</span>
                      <span className="material-symbols-outlined" style={{ color: 'var(--color-text-tertiary)' }}>{fileIcon(f.ext)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {editMode ? (
                          <input
                            value={editNames[editKey] ?? f.name.replace(/\.[^.]+$/, '')}
                            onChange={(e) => setEditNames(prev => ({ ...prev, [editKey]: e.target.value }))}
                            style={{ fontWeight: 500, fontSize: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', color: 'var(--color-text-primary)', width: '100%', maxWidth: 300 }}
                          />
                        ) : (
                          <>
                            <div style={{ fontWeight: 500, fontSize: 14 }}>
                              {f.name}
                              {f.category === 'raw' && f.wiki_pending && (
                                <span title="Procesando a wiki en segundo plano" style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 13, animation: 'spin 2s linear infinite', display: 'inline-block' }}>progress_activity</span>
                                  Procesando…
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 2 }}>
                              <span className="label-caps" style={{ color: f.category === 'raw' ? 'var(--color-primary)' : 'var(--color-success)' }}>{f.category}</span>
                              <span style={{ color: 'var(--color-text-tertiary)' }}>•</span>
                              <span className="label-caps">{f.path}</span>
                              <span style={{ color: 'var(--color-text-tertiary)' }}>•</span>
                              <span className="label-caps">{(f.size / 1024).toFixed(1)} KB</span>
                            </div>
                          </>
                        )}
                      </div>
                      {!editMode && (
                        <>
                          <button onClick={() => handlePreview(f, f.category)} title="Visualizar"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 'var(--space-1)', flexShrink: 0 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>visibility</span>
                          </button>
                          <a href={`/vault-static/${f.category}/${f.path}`} download={f.name} title="Descargar"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 'var(--space-1)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>download</span>
                          </a>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })
        ) : filtered.length === 0 ? (
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
                <button onClick={() => handlePreview(f, subtab)} title="Visualizar"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 'var(--space-1)', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>visibility</span>
                </button>
                <a href={`/vault-static/${subtab}/${f.path}`} download={f.name} title="Descargar"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 'var(--space-1)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>download</span>
                </a>
              </div>
            )
          })
        )}
      </div>

      {showPopup && <AddFilesPopup onClose={handleClosePopup} projects={projects} onReloadProjects={loadProjects} />}

      {/* ponytail: modal visualizador .md */}
      {previewDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }} onClick={() => setPreviewDoc(null)}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-high)', borderRadius: 'var(--radius-lg)', maxWidth: 700, maxHeight: '80vh', width: '100%', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-surface-high)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>description</span>{previewDoc.name}
              </h3>
              <button onClick={() => setPreviewDoc(null)} className="btn-app btn-app-secondary" style={{ width: 32, height: 32, padding: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: 'var(--space-5)', flex: 1 }}>
              <MarkdownViewer content={previewDoc.content} />
            </div>
          </div>
        </div>
      )}

      {/* ponytail: modal último archivo */}
      {lastFileModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }} onClick={() => setLastFileModal(null)}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-high)', borderRadius: 'var(--radius-lg)', maxWidth: 480, width: '100%', padding: 'var(--space-6)' }} onClick={e => e.stopPropagation()}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--color-warning)', display: 'block', textAlign: 'center', marginBottom: 'var(--space-3)' }}>warning</span>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', textAlign: 'center', marginBottom: 'var(--space-3)' }}>Último archivo del proyecto</h3>
            <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', marginBottom: 'var(--space-2)' }}>
              Este es el último archivo de: <strong>{lastFileModal.projects.map(p => p.name).join(', ')}</strong>
            </p>
            <p style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', fontSize: 14, marginBottom: 'var(--space-5)' }}>
              ¿Eliminar también el proyecto o conservarlo vacío?
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
              <button className="btn-app btn-app-danger" onClick={handleDeleteAll} disabled={deletingAll}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete_forever</span>
                {deletingAll ? 'Eliminando...' : 'Eliminar todo'}
              </button>
              <button className="btn-app btn-app-secondary" onClick={handleKeepProject}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>keep</span>
                Conservar proyecto
              </button>
              <button className="btn-app btn-app-secondary" onClick={() => setLastFileModal(null)} style={{ width: 32, height: 32, padding: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ponytail: modal reasignar */}
      {showReassign && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }} onClick={() => setShowReassign(false)}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-high)', borderRadius: 'var(--radius-lg)', maxWidth: 420, width: '100%', padding: 'var(--space-6)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>swap_horiz</span>
              Reasignar {structSelectedCount} archivo(s)
            </h3>
            <label style={{ fontSize: 14, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--space-2)' }}>Proyecto destino:</label>
            <select className="input-app" value={reassignTarget} onChange={(e) => setReassignTarget(e.target.value)} style={{ width: '100%', marginBottom: 'var(--space-4)' }}>
              <option value="individual">Individual</option>
              {Object.entries(structure).filter(([id]) => id !== 'individual').map(([id, info]) => <option key={id} value={id}>{info.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn-app btn-app-secondary" onClick={() => setShowReassign(false)}>Cancelar</button>
              <button className="btn-app btn-app-primary" onClick={handleReassign} disabled={reassigning}>
                {reassigning ? 'Moviendo...' : 'Mover'}
              </button>
            </div>
          </div>
        </div>
      )}
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
      {count !== undefined && <span className="label-caps" style={{ color: active ? 'var(--color-primary)' : 'var(--color-text-tertiary)', opacity: 0.7 }}>({count})</span>}
    </button>
  )
}

export default CerebroView