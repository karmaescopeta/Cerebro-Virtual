import React, { useState, useEffect } from 'react'

const DEFAULT_MODELS = {
  coordinador: 'deepseek/deepseek-v4-flash',
  editor: 'deepseek/deepseek-v4-flash',
  indexador: 'deepseek/deepseek-v4-flash',
  sintetizador: 'deepseek/deepseek-v4-flash',
  investigador: 'deepseek/deepseek-v4-flash',
  graphify: 'google/gemma-4-26b-a4b-it:free',
}
const DEFAULT_NAMES = {
  coordinador: 'Sistema Base',
  editor: 'Editor',
  indexador: 'Indexador',
  sintetizador: 'Sintetizador',
  investigador: 'Investigador',
  graphify: 'Graphify (Neuronas)',
}

function ModelosView() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editModels, setEditModels] = useState({})
  const [editNames, setEditNames] = useState({})
  const [summary, setSummary] = useState(null)

  useEffect(() => { loadModels() }, [])

  async function loadModels() {
    try {
      const res = await fetch('/api/profiles/models')
      if (res.ok) {
        const data = await res.json()
        setProfiles(data.profiles || [])
        const m = {}, n = {}
        data.profiles.forEach(p => { m[p.key] = p.model; n[p.key] = p.name })
        setEditModels(m); setEditNames(n)
      }
    } catch {} finally { setLoading(false) }
  }

  async function handleSave() {
    setSaving(true); setSummary(null)
    try {
      const res = await fetch('/api/profiles/models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models: editModels, profileNames: editNames }),
      })
      const data = await res.json()
      if (data.success) {
        setSummary(data.changes || [])
        setEditing(false)
        await loadModels()
      } else {
        alert('Error: ' + (data.message || 'No se pudo guardar'))
      }
    } catch { alert('Error de conexión') } finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando modelos...</p>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="section-title">Modelos</h1>
          <p className="section-subtitle">Gestiona el modelo de IA asignado a cada perfil del sistema.</p>
        </div>
        {!editing ? (
          <button className="btn-app btn-app-secondary" onClick={() => setEditing(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span> Editar
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn-app btn-app-secondary" onClick={() => { setEditModels({ ...DEFAULT_MODELS }); setEditNames({ ...DEFAULT_NAMES }) }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span> Por defecto
            </button>
            <button className="btn-app btn-app-primary" onClick={handleSave} disabled={saving}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        )}
      </div>

      <div className="modelos-grid">
        {profiles.map(p => (
          <div key={p.key} className="card modelos-card">
            {editing ? (
              <>
                <div className="modelos-card-header">
                  <input
                    className="input-app modelos-name-input"
                    value={editNames[p.key] || ''}
                    onChange={e => setEditNames(s => ({ ...s, [p.key]: e.target.value }))}
                    placeholder="Nombre del perfil"
                  />
                </div>
                <input
                  className="input-app modelos-model-input"
                  value={editModels[p.key] || ''}
                  onChange={e => setEditModels(s => ({ ...s, [p.key]: e.target.value }))}
                  placeholder="proveedor/modelo"
                />
              </>
            ) : (
              <>
                <div className="modelos-card-header">
                  <span className="material-symbols-outlined modelos-card-icon">memory</span>
                  <span className="label-caps modelos-card-name">{p.name}</span>
                </div>
                <div className="modelos-card-model">{p.model}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {summary !== null && (
        <div className="modelos-summary-overlay" onClick={() => setSummary(null)}>
          <div className="modelos-summary-card" onClick={e => e.stopPropagation()}>
            <div className="modelos-summary-icon">
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--color-success)' }}>check_circle</span>
            </div>
            <h2 className="modelos-summary-title">Cambios aplicados</h2>
            {summary.length === 0 ? (
              <p className="modelos-summary-text">No se detectaron cambios en los modelos.</p>
            ) : (
              <div className="modelos-summary-list">
                {summary.map((c, i) => (
                  <div key={i} className="modelos-summary-row">
                    <span className="label-caps">{c.name}</span>
                    <div className="modelos-summary-change">
                      <span className="modelos-summary-old">{c.oldModel}</span>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-text-tertiary)' }}>arrow_forward</span>
                      <span className="modelos-summary-new">{c.newModel}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="btn-app btn-app-primary" style={{ width: '100%', marginTop: 'var(--space-5)' }} onClick={() => setSummary(null)}>
              Aceptar
            </button>
          </div>
        </div>
      )}

      {saving && (
        <div className="modelos-saving-overlay">
          <div className="modelos-saving-content">
            <div className="loading-spinner" />
            <p className="modelos-saving-text">Reiniciando agente...</p>
            <p className="modelos-saving-subtext">Aplicando nuevos modelos a los perfiles</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default ModelosView