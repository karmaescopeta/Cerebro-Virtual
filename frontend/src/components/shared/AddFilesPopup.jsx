import React, { useState, useRef } from 'react'

// ponytail: popup compartido — elegir destino → seleccionar archivos → confirmar → subir
function AddFilesPopup({ onClose, projects, onReloadProjects }) {
  const [step, setStep] = useState('choose') // choose | individual | project-choose | project-new | project-existing | pending | uploading | done
  const [newProject, setNewProject] = useState({ name: '', description: '', color: '#4edea3' })
  const [selectedProject, setSelectedProject] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [pendingFiles, setPendingFiles] = useState([])
  const [pendingProject, setPendingProject] = useState('individual')
  const [uploadResults, setUploadResults] = useState({ ok: 0, fail: 0 })
  const fileRef = useRef(null)

  // ponytail: seleccionar archivos → lista de pendientes (no sube aún)
  const pickFiles = (projectId) => {
    fileRef.current.onchange = (e) => {
      if (e.target.files.length) {
        setPendingFiles(Array.from(e.target.files))
        setPendingProject(projectId)
        setStep('pending')
      }
      e.target.value = ''
    }
    fileRef.current?.click()
  }

  // ponytail: subir solo cuando el usuario confirma
  async function confirmUpload() {
    setStep('uploading')
    let ok = 0, fail = 0
    for (const file of pendingFiles) {
      try {
        const fd = new FormData(); fd.append('file', file)
        const d = await (await fetch(`/api/vault/upload?project=${pendingProject}`, { method: 'POST', body: fd })).json()
        if (d.success || d.path) ok++
        else fail++
      } catch { fail++ }
    }
    setUploadResults({ ok, fail })
    setUploadStatus(`✅ ${ok} subido(s)${fail ? `, ❌ ${fail} fallido(s)` : ''}`)
    setStep('done')
  }

  async function createProjectAndUpload(fileList) {
    // ponytail: Array.from — FileList no tiene .map, crashea el render
    const files = Array.from(fileList)
    try {
      const d = await (await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProject) })).json()
      if (d.id) { await onReloadProjects?.(); setPendingProject(d.id); setPendingFiles(files); setStep('pending') }
      else { setUploadStatus('❌ Error creando proyecto'); setStep('done') }
    } catch (e) { setUploadStatus('❌ Error: ' + e.message); setStep('done') }
  }

  const fileIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase()
    return ['png','jpg','jpeg','gif','webp','bmp'].includes(ext) ? 'image' :
      ['mp3','wav','ogg','m4a','aac','flac'].includes(ext) ? 'audio_file' :
      ['mp4','webm','mov','avi','mkv'].includes(ext) ? 'movie' : 'description'
  }

  const popupStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  }
  const cardStyle = {
    background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-surface-high)',
    padding: 'var(--space-6)', minWidth: 400, maxWidth: 520, maxHeight: '85vh', overflowY: 'auto',
  }

  return (
    <div style={popupStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={cardStyle}>
        <input type="file" multiple ref={fileRef} style={{ display: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>upload_file</span>
            Añadir archivos
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {step === 'choose' && (
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <PopupChoice icon="description" title="Individual" subtitle="Sin proyecto" onClick={() => pickFiles('individual')} />
            <PopupChoice icon="folder" title="Proyecto" subtitle="A un proyecto" onClick={() => setStep('project-choose')} />
          </div>
        )}

        {step === 'project-choose' && (
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <PopupChoice icon="create_new_folder" title="Nuevo" subtitle="Crear proyecto" onClick={() => setStep('project-new')} />
            <PopupChoice icon="folder_open" title="Existente" subtitle="Elegir proyecto" onClick={() => setStep('project-existing')} />
          </div>
        )}

        {step === 'project-new' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <input className="input-app" placeholder="Nombre del proyecto *" value={newProject.name}
              onChange={(e) => setNewProject(p => ({ ...p, name: e.target.value }))} />
            <input className="input-app" placeholder="Descripción (opcional)" value={newProject.description}
              onChange={(e) => setNewProject(p => ({ ...p, description: e.target.value }))} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <label className="label-caps">Color</label>
              <input type="color" value={newProject.color} onChange={(e) => setNewProject(p => ({ ...p, color: e.target.value }))} style={{ width: 40, height: 30, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn-app btn-app-secondary" onClick={() => setStep('project-choose')}>← Atrás</button>
              <button className="btn-app btn-app-primary" disabled={!newProject.name.trim()}
                onClick={() => { fileRef.current.onchange = (e) => { if (e.target.files.length) createProjectAndUpload(e.target.files); e.target.value = '' }; fileRef.current?.click() }}>
                Seleccionar archivos
              </button>
            </div>
          </div>
        )}

        {step === 'project-existing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {projects.length === 0 ? (
              <p style={{ color: 'var(--color-text-tertiary)' }}>No hay proyectos. Crea uno nuevo.</p>
            ) : (
              <select className="input-app" value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
                <option value="">Selecciona un proyecto...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn-app btn-app-secondary" onClick={() => setStep('project-choose')}>← Atrás</button>
              <button className="btn-app btn-app-primary" disabled={!selectedProject}
                onClick={() => pickFiles(selectedProject)}>
                Seleccionar archivos
              </button>
            </div>
          </div>
        )}

        {/* ponytail: step pending — lista de archivos + confirmar antes de subir */}
        {step === 'pending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>folder</span>
              <span style={{ fontSize: 14 }}>Destino: <strong>{pendingProject}</strong></span>
            </div>
            <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {pendingFiles.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-surface-container)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-surface-high)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--color-text-tertiary)' }}>{fileIcon(f.name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                    <div className="label-caps" style={{ color: 'var(--color-text-tertiary)' }}>{(f.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <button onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', padding: 'var(--space-1)' }} title="Quitar">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn-app btn-app-secondary" onClick={() => setStep('choose')}>← Atrás</button>
              <button className="btn-app btn-app-primary" disabled={!pendingFiles.length} onClick={confirmUpload}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>cloud_upload</span>
                Cargar contenido ({pendingFiles.length})
              </button>
            </div>
          </div>
        )}

        {step === 'uploading' && (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
            <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite', display: 'inline-block', fontSize: 48, color: 'var(--color-primary)' }}>sync</span>
            <p style={{ marginTop: 'var(--space-3)' }}>Subiendo archivos...</p>
          </div>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: uploadResults.fail ? 'var(--color-error)' : 'var(--color-success)' }}>
              {uploadResults.fail ? 'error' : 'check_circle'}
            </span>
            <p style={{ marginTop: 'var(--space-3)', fontWeight: 500 }}>{uploadStatus}</p>
            <button className="btn-app btn-app-primary" style={{ marginTop: 'var(--space-4)' }} onClick={onClose}>Cerrar</button>
          </div>
        )}
      </div>
    </div>
  )
}

function PopupChoice({ icon, title, subtitle, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)',
      padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', cursor: 'pointer', flex: 1,
      background: 'var(--color-surface-container)', border: '1px solid var(--color-surface-high)',
      transition: 'all var(--transition-fast)',
    }}
    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-surface-high)'}>
      <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--color-primary)' }}>{icon}</span>
      <span style={{ fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>{subtitle}</span>
    </div>
  )
}

export default AddFilesPopup
