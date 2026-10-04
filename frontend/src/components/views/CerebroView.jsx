import React, { useState, useRef, useEffect } from 'react'
import AddFilesPopup from '../shared/AddFilesPopup'
import DocReader from '../shared/DocReader'
import { startSaveJob } from '../../mdSave'

function CerebroView({ subtab, setSubtab, rawFiles, outputFiles, search, setSearch, selected, setSelected, onDelete, deleting, onReloadRaw, onRefreshGraph, onReloadProjects, projects: parentProjects, toast, onJobStart, onJobEnd, updatingPaths = [] }) {
  const [showPopup, setShowPopup] = useState(false)
  const [projects, setProjects] = useState([])
  const [expandedFolders, setExpandedFolders] = useState(() => {
    // ponytail: recordar carpetas abiertas entre recargas; primera visita = todo cerrado
    try { return JSON.parse(localStorage.getItem('cerebro-folders') || '{}') } catch { return {} }
  })
  const [previewDoc, setPreviewDoc] = useState(null)
  const [previewStatus, setPreviewStatus] = useState(null) // fase 3: {in_graph, stale} para el icono de cerebro
  // ponytail: modo edición
  const [editMode, setEditMode] = useState(false)
  const [editNames, setEditNames] = useState({}) // {key: newName}
  const [editProjects, setEditProjects] = useState({}) // {projectId: {name, color}}
  const [editSaving, setEditSaving] = useState(false)
  // ponytail: cabecera de carpeta solo refleja el click del usuario (no el estado derivado de los archivos)
  const [folderChecks, setFolderChecks] = useState({})
  // ponytail: modal reasignar
  const [showReassign, setShowReassign] = useState(false)
  const [reassignTarget, setReassignTarget] = useState('individual')
  const [reassigning, setReassigning] = useState(false)
  // ponytail: confirmación de borrado con listado
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [wikiFiles, setWikiFiles] = useState(null)
  useEffect(() => { loadProjects() }, [subtab])
  useEffect(() => { if (subtab === 'estructura') loadWikiStems() }, [subtab])

  async function loadWikiStems() {
    // ponytail: wiki_pending real — /api/notes lista wiki/<stem>.md (el grafo ya no trae source_file y daba falso "Procesando" eterno)
    try {
      const d = await (await fetch('/api/notes')).json()
      setWikiFiles((d.notes || []).map(n => n.id))
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
      const hasWiki = wikiFiles?.includes(stem)
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

  const toggleFolder = (folder) => setExpandedFolders(prev => {
    const next = { ...prev, [folder]: !prev[folder] }
    try { localStorage.setItem('cerebro-folders', JSON.stringify(next)) } catch {}
    return next
  })

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
            setPreviewDoc({ content, name: f.name, ext, path: f.path, cat: category })
            setPreviewStatus(null)
            fetch(`/api/vault/file-status?path=${category}/${f.path}`).then(r => r.json()).then(setPreviewStatus).catch(() => {})
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

  // ponytail: listado de archivos seleccionados (modales Eliminar/Reasignar)
  const selectedFiles = Object.entries(selected).filter(([k, v]) => v && k.startsWith('estructura|') && !k.startsWith('estructura|project|')).map(([k]) => {
    const parts = k.split('|')
    const category = parts[1]
    const path = parts.slice(2).join('|')
    const f = (category === 'raw' ? rawFiles : outputFiles).find(x => x.path === path)
    return { category, path, name: f?.name || path }
  })
  const structSelectedCount = selectedFiles.length
  // ponytail: proyectos vacíos marcados con el checkbox de carpeta (keys estructura|project|<id>)
  const selProjects = Object.entries(selected).filter(([k, v]) => v && k.startsWith('estructura|project|')).map(([k]) => k.split('|')[2])
  const selTotal = structSelectedCount + selProjects.length
  const selectedGroups = Object.values(selectedFiles.reduce((acc, f) => {
    const key = f.path.includes('/') ? f.path.split('/')[0] : 'individual'
    ;(acc[key] = acc[key] || { id: key, files: [] }).files.push(f)
    return acc
  }, {})).map(g => {
    const info = structure[g.id]
    return { ...g, name: info?.name || g.id, color: info?.color || '#666' }
  })
  // ponytail: listado agrupado por carpeta — archivos sueltos caen en "Individual" (avisa de su carpeta)
  const selectedList = selectedFiles.length > 0 && (
    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
      {selectedGroups.map(g => (
        <div key={g.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: g.color, flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--color-text-primary)' }}>{g.name}</span>
            <span className="label-caps" style={{ color: 'var(--color-text-tertiary)' }}>({g.files.length})</span>
          </div>
          {g.files.map(f => (
            <div key={f.path} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 13, minWidth: 0, paddingLeft: 14 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-text-tertiary)' }}>{f.category === 'raw' ? 'inventory_2' : 'upload'}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-primary)' }}>{f.name}</span>
              <span className="label-caps" style={{ color: f.category === 'raw' ? 'var(--color-primary)' : 'var(--color-success)' }}>{f.category}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )

  // ponytail: borrado directo — archivos via batch-delete + proyectos vacíos marcados; sin modal "último archivo"
  const [deletingSel, setDeletingSel] = useState(false)
  async function handleConfirmDelete() {
    setDeletingSel(true)
    try {
      const projectIds = selProjects
      for (const pid of projectIds) {
        await fetch(`/api/projects/${pid}`, { method: 'DELETE' })
      }
      if (selectedFiles.length) {
        await fetch('/api/vault/batch-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selectedFiles.map(f => ({ category: f.category, path: f.path }))) })
      }
      setSelected({})
      await loadProjects()
      onReloadProjects?.(); onReloadRaw?.(); onRefreshGraph?.()
    } catch {} finally { setDeletingSel(false); setDeleteConfirm(false) }
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
      const items = Object.entries(selected).filter(([k, v]) => v && !k.startsWith('estructura|project|')).map(([k]) => {
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
      {/* ponytail: toolbar única — tabs a la izquierda, acciones a la derecha, misma línea */}
      <div className="cerebro-toolbar">
        <div className="cerebro-toolbar-tabs">
          <TabButton active={subtab === 'estructura'} onClick={() => setSubtab('estructura')} icon="account_tree" label="Estructura" />
          <TabButton active={subtab === 'raw'} onClick={() => setSubtab('raw')} icon="inventory_2" label="Raw" count={rawFlat.length} />
          <TabButton active={subtab === 'outputs'} onClick={() => setSubtab('outputs')} icon="upload" label="Outputs" count={outputFiles.length} />
        </div>
        {subtab === 'estructura' && (
          <div className="cerebro-toolbar-actions">
            {editMode && structSelectedCount > 0 && (
              <button className="btn-app btn-app-secondary" onClick={() => setShowReassign(true)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>swap_horiz</span>
                <span className="cbtn-label">Reasignar ({structSelectedCount})</span>
              </button>
            )}
            {editMode && selTotal > 0 && (
              <button className="btn-app btn-app-danger" onClick={() => setDeleteConfirm(true)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                <span className="cbtn-label">Eliminar ({selTotal})</span>
              </button>
            )}
            {editMode ? (
              <button className="btn-app btn-app-primary" onClick={handleSaveEdit} disabled={editSaving}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
                <span className="cbtn-label">{editSaving ? 'Guardando...' : 'Guardar'}</span>
              </button>
            ) : (
              <button className="btn-app btn-app-secondary" onClick={() => { setEditMode(true); setEditNames({}); setEditProjects({}); setFolderChecks({}) }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                <span className="cbtn-label">Editar</span>
              </button>
            )}
            <button className="btn-app btn-app-primary" onClick={() => setShowPopup(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              <span className="cbtn-label">Añadir archivos</span>
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
        <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', fontSize: 20 }}>search</span>
        <input className="input-app" style={{ paddingLeft: 40 }} placeholder="Buscar archivo..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* ponytail: actions bar solo en Raw/Outputs — en Estructura el borrado vive en Editar (botón Eliminar, fuera la papelera) */}
      {subtab !== 'estructura' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>{selectedCount} seleccionado(s)</span>
          <button className="btn-app btn-app-danger" onClick={onDelete} disabled={!selectedCount || deleting} style={{ opacity: (!selectedCount || deleting) ? 0.5 : 1 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
            Eliminar ({selectedCount})
          </button>
        </div>
      )}

      {/* File list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {subtab === 'estructura' ? (
          Object.entries(structure).map(([folder, info]) => {
            // ponytail: proyectos vacíos visibles (se pueden ver y borrar); cerradas por defecto, búsqueda auto-expande
            const isExpanded = search ? true : (expandedFolders[folder] ?? false)
            const filteredFiles = search ? info.files.filter(f => f.name.toLowerCase().includes(search.toLowerCase())) : info.files
            if (!filteredFiles.length && search) return null
            const pending = info.files.filter(f => f.wiki_pending).length
            return (
              <div key={folder}>
                <div className="card card-hover cerebro-folder-row" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}
                  onClick={() => toggleFolder(folder)}>
                  {/* ponytail: selección de carpeta solo en modo Editar — la vacía selecciona el PROYECTO (key estructura|project|<id>) */}
                  {editMode && (info.files.length > 0 ? (
                    <input type="checkbox" title="Seleccionar carpeta"
                                          checked={!!folderChecks[folder]}
                                          onChange={(e) => {
                                            setFolderChecks(prev => ({ ...prev, [folder]: e.target.checked }))
                                            setSelected(prev => {
                                              const next = { ...prev }
                                              filteredFiles.forEach(f => { next[`estructura|${f.category}|${f.path}`] = e.target.checked })
                                              return next
                                            })
                                          }}
                      onClick={e => e.stopPropagation()}
                      style={{ width: 18, height: 18, accentColor: 'var(--color-primary)', cursor: 'pointer', flexShrink: 0 }} />
                  ) : projects.find(p => p.id === folder) ? (
                    <input type="checkbox" title="Seleccionar proyecto vacío"
                      checked={!!selected[`estructura|project|${folder}`]}
                      onChange={(e) => setSelected(prev => ({ ...prev, [`estructura|project|${folder}`]: e.target.checked }))}
                      onClick={e => e.stopPropagation()}
                      style={{ width: 18, height: 18, accentColor: 'var(--color-primary)', cursor: 'pointer', flexShrink: 0 }} />
                  ) : null)}
                  <div style={{ width: 12, height: 12, borderRadius: 'var(--radius-full)', background: editProjects[folder]?.color || info.color, boxShadow: `0 0 6px ${editProjects[folder]?.color || info.color}`, flexShrink: 0 }} />
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: editProjects[folder]?.color || info.color }}>{isExpanded ? 'folder_open' : 'folder'}</span>
                  {editMode && projects.find(p => p.id === folder) ? (
                    <>
                      <input
                        value={editProjects[folder]?.name ?? info.name}
                        onChange={(e) => setEditProjects(prev => ({ ...prev, [folder]: { ...prev[folder], name: e.target.value } }))}
                        onClick={e => e.stopPropagation()}
                        style={{ fontWeight: 600, fontSize: 15, background: 'color-mix(in srgb, var(--color-text-primary) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--color-text-primary) 20%, transparent)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', color: 'var(--color-text-primary)', minWidth: 100 }}
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
                  {info.files.length === 0 && <span className="label-caps" style={{ color: 'var(--color-text-tertiary)', opacity: 0.7 }}>vacío</span>}
                  <span className="label-caps" style={{ color: 'var(--color-text-tertiary)' }}>({info.files.length})</span>
                  {pending > 0 && (
                    <span title="Archivos procesando a wiki" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 13, animation: 'spin 2s linear infinite', display: 'inline-block' }}>progress_activity</span>
                      {pending}
                    </span>
                  )}
                  <div style={{ flex: 1 }} />
                  {/* ponytail: proyectos vacíos se borran con su checkbox + Eliminar (la papelera fija en vacíos era redundante y molesta) */}
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-text-tertiary)', fontSize: 18, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>chevron_right</span>
                </div>
                {isExpanded && filteredFiles.map(f => {
                  const key = `estructura|${f.category}|${f.path}`
                  const editKey = `${f.category}|${f.path}`
                  return (
                    <div key={key} className="card cerebro-file-row" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginLeft: 'var(--space-6)', borderLeft: `3px solid ${editProjects[folder]?.color || info.color}` }}>
                      {/* ponytail: selección de archivos solo en modo Editar */}
                      {editMode && (
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
                            style={{ fontWeight: 500, fontSize: 14, background: 'color-mix(in srgb, var(--color-text-primary) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--color-text-primary) 20%, transparent)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', color: 'var(--color-text-primary)', width: '100%', maxWidth: 300 }}
                          />
                        ) : (
                          <>
                            <div className="cerebro-file-name" style={{ fontWeight: 500, fontSize: 14 }}>
                              {f.name}
                              {f.category === 'raw' && f.wiki_pending && (
                                <span title="Procesando a wiki en segundo plano" style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 13, animation: 'spin 2s linear infinite', display: 'inline-block' }}>progress_activity</span>
                                  Procesando…
                                </span>
                              )}
                            </div>
                            <div className="cerebro-file-meta" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 2 }}>
                              <span className="label-caps" style={{ color: f.category === 'raw' ? 'var(--color-primary)' : 'var(--color-success)' }}>{f.category}</span>
                              <span style={{ color: 'var(--color-text-tertiary)' }}>•</span>
                              <span className="label-caps cerebro-file-path">{f.path}</span>
                              <span style={{ color: 'var(--color-text-tertiary)' }}>•</span>
                              <span className="label-caps">{(f.size / 1024).toFixed(1)} KB</span>
                            </div>
                          </>
                        )}
                      </div>
                      {!editMode && (
                        <>
                          {/* fase investigador: archivo con guardado en curso → candado en vez de Visualizar */}
                          {updatingPaths.includes(`${f.category}/${f.path}`) ? (
                            <span title="Actualizando contenido — espera a que termine para modificarlo"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-tertiary)', fontSize: 11.5, flexShrink: 0, whiteSpace: 'nowrap' }}>
                              <span className="material-symbols-outlined research-spin" style={{ fontSize: 18 }}>progress_activity</span>Actualizando
                            </span>
                          ) : (
                            <button onClick={() => handlePreview(f, f.category)} title="Visualizar"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 'var(--space-1)', flexShrink: 0 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>visibility</span>
                            </button>
                          )}
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
                  <div className="cerebro-file-meta" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 2 }}>
                    <span className="label-caps cerebro-file-path">{f.path}</span>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>•</span>
                    <span className="label-caps">{(f.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
                {/* fase investigador: archivo con guardado en curso → candado en vez de Visualizar */}
                {updatingPaths.includes(`${subtab}/${f.path}`) ? (
                  <span title="Actualizando contenido — espera a que termine para modificarlo"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-tertiary)', fontSize: 11.5, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <span className="material-symbols-outlined research-spin" style={{ fontSize: 18 }}>progress_activity</span>Actualizando
                  </span>
                ) : (
                  <button onClick={() => handlePreview(f, subtab)} title="Visualizar"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 'var(--space-1)', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>visibility</span>
                  </button>
                )}
                <a href={`/vault-static/${subtab}/${f.path}`} download={f.name} title="Descargar"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 'var(--space-1)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>download</span>
                </a>
              </div>
            )
          })
        )}
      </div>

      {showPopup && <AddFilesPopup onClose={handleClosePopup} projects={projects} onReloadProjects={loadProjects} toast={toast} onJobStart={onJobStart} onJobEnd={onJobEnd} />}

      {/* ponytail: modal visualizador .md → DocReader; fase 3: editor rich + pipeline formato Graphify + icono cerebro */}
                        {previewDoc && (
                                                  <DocReader title={previewDoc.name} content={previewDoc.content} onClose={() => setPreviewDoc(null)}
                            status={previewStatus}
                            onSaveEdit={(md) => {
                        // fase investigador: job en background — el archivo queda "Actualizando" en la lista hasta terminar
                        startSaveJob({ path: `${previewDoc.cat}/${previewDoc.path}`, oldContent: previewDoc.content, newContent: md }).catch(e => toast?.({ type: 'error', text: String(e.message || e) }))
                        setPreviewDoc(null)
                      }}
                            actions={[
                              <a key="dl" className="chat-action-btn" href={`/vault-static/${previewDoc.cat}/${previewDoc.path}`} download={previewDoc.name}>
                                <span className="material-symbols-outlined">download</span>Descargar
                              </a>,
                            ]} />
                        )}

      {/* ponytail: confirmación de eliminado con listado (reemplaza al pop nativo) */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }} onClick={() => setDeleteConfirm(false)}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-high)', borderRadius: 'var(--radius-lg)', maxWidth: 480, width: '100%', padding: 'var(--space-6)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>delete_forever</span>
              {[selectedFiles.length > 0 && `Eliminar ${selectedFiles.length} archivo(s)`, selProjects.length > 0 && `Eliminar ${selProjects.length} proyecto(s)`].filter(Boolean).join(' y ')}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
              Se borrarán <strong>definitivamente</strong> del vault:
            </p>
            {selectedList}
            {selProjects.length > 0 && (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>Proyectos vacíos:</div>
                {selProjects.map(pid => (
                  <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-primary)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: projectMeta(pid).color, flexShrink: 0 }} />
                    {projectMeta(pid).name}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn-app btn-app-secondary" onClick={() => setDeleteConfirm(false)}>Cancelar</button>
              <button className="btn-app btn-app-danger" onClick={handleConfirmDelete} disabled={deletingSel}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete_forever</span>
                {deletingSel ? 'Eliminando...' : 'Eliminar'}
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
            {selectedList}
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
    <button className={`cerebro-tab${active ? ' active' : ''}`} onClick={onClick}>
      <span className="material-symbols-outlined">{icon}</span>
      <span className="cerebro-tab-label">{label}</span>
      {count !== undefined && <span className="label-caps cerebro-tab-count">({count})</span>}
    </button>
  )
}

export default CerebroView