import React, { useState, useEffect } from 'react'
import { containerUrl } from '../../lib/ports.js'

// v1.5.6: link a OmniRoute con el puerto REAL de este cerebro (su .env) — el 20128 a fuego
// apuntaba al puerto de otro cerebro o a ninguno. hostname dinámico = también funciona por LAN.
function OmniRouteLink({ children, style, title }) {
  const [url, setUrl] = useState(`http://${location.hostname}:20128`)
  useEffect(() => { containerUrl('omniroute', 20128).then(setUrl).catch(() => {}) }, [])
  return (
    <a className="btn-app btn-app-secondary" style={{ textDecoration: 'none', ...style }} href={url} target="_blank" rel="noopener noreferrer" title={title}>
      {children}
    </a>
  )
}

// ponytail: una lista alimenta el modal info y el autocomplete del terminal — solo lo básico
const OLLAMA_COMMANDS = [
  { short: 'list', arg: '', desc: 'Lista los modelos instalados.' },
  { short: 'ps', arg: '', desc: 'Muestra los modelos ejecutándose ahora mismo.' },
  { short: 'stop', arg: '<modelo>', desc: 'Detiene un modelo en ejecución.' },
  { short: 'pull', arg: '<modelo>', desc: 'Descarga un modelo nuevo desde la librería de Ollama.' },
  { short: 'run', arg: '<modelo>', desc: 'Inicia una conversación con un modelo concreto.' },
]

// ponytail: header de sección repetido 3 veces — un solo componente; info modal en vez de subtítulo
function SectionHeader({ title, info, children }) {
  const [showInfo, setShowInfo] = useState(false)
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>{title}</h2>
          {info && (
            <button className="btn-app btn-app-secondary" style={{ padding: '2px 6px', minWidth: 'auto' }} title="¿Qué es esta sección?" onClick={() => setShowInfo(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
            </button>
          )}
        </div>
        {children}
      </div>
      {showInfo && (
        <div className="modelos-summary-overlay" onClick={() => setShowInfo(false)}>
          <div className="modelos-summary-card" onClick={e => e.stopPropagation()}>
            <div className="modelos-summary-icon">
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--color-primary)' }}>info</span>
            </div>
            <h2 className="modelos-summary-title">{title}</h2>
            <p className="modelos-summary-text">{info}</p>
            <button className="btn-app btn-app-primary" style={{ width: '100%', marginTop: 'var(--space-5)' }} onClick={() => setShowInfo(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function ModelosView() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editModels, setEditModels] = useState({})
  const [editModelsLocal, setEditModelsLocal] = useState({})
  const [editNames, setEditNames] = useState({})
  const [summary, setSummary] = useState(null)

  useEffect(() => { loadModels() }, [])

  async function loadModels() {
    try {
      const res = await fetch('/api/profiles/models')
      if (res.ok) {
        const data = await res.json()
        setProfiles(data.profiles || [])
        const m = {}, ml = {}, n = {}
        data.profiles.forEach(p => { m[p.key] = p.model; ml[p.key] = p.modelLocal || ''; n[p.key] = p.name })
        setEditModels(m); setEditModelsLocal(ml); setEditNames(n)
      }
    } catch {} finally { setLoading(false) }
  }

  async function handleSave() {
    setSaving(true); setSummary(null)
    try {
      const res = await fetch('/api/profiles/models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models: editModels, modelsLocal: editModelsLocal, profileNames: editNames }),
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

  // ponytail: reasignar modelos locales tras borrar uno — reutiliza el PUT existente; si hay edición cloud a medio hacer, se guarda junto
  async function saveLocalAssignments(changes) {
    const newLocal = { ...editModelsLocal, ...changes }
    setEditModelsLocal(newLocal)
    setSaving(true)
    try {
      const res = await fetch('/api/profiles/models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models: editModels, modelsLocal: newLocal, profileNames: editNames }),
      })
      const data = await res.json()
      if (!data.success) alert('Error: ' + (data.message || 'No se pudo guardar'))
    } catch { alert('Error de conexión') }
    setSaving(false)
    await loadModels()
  }

  return (
    <div style={{ position: 'relative' }}>
      <SectionHeader title="Modelos del Sistema" info="Cada tarjeta es un perfil del sistema: el modelo ☁️ es el que usa en la nube y el 🔒 el que usa con el toggle Local del chat. Pulsa Editar para cambiar el nombre visible del perfil.">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {!editing ? (
                  <button className="btn-app btn-app-secondary" onClick={() => setEditing(true)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span> Editar
                  </button>
                ) : (
                  <button className="btn-app btn-app-primary" onClick={handleSave} disabled={saving}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                )}
                {/* ponytail: OmniRoute redirige a rutas absolutas y colisiona /api tras proxy → link directo al puerto publicado */}
                <OmniRouteLink>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span> Editar combo
                </OmniRouteLink>
              </div>
            </SectionHeader>

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
                  readOnly
                  title="Combo cloud o modelo OpenRouter — solo editable desde Editar combo"
                />
                <input
                  className="input-app modelos-model-input"
                  value={editModelsLocal[p.key] || ''}
                  onChange={e => setEditModelsLocal(s => ({ ...s, [p.key]: e.target.value }))}
                  placeholder="combo/local-* o modelo ollama"
                  title="Combo local (Ollama) para el toggle Local del chat — los combos se configuran en OmniRoute"
                />
              </>
            ) : (
              <>
                <div className="modelos-card-header">
                  <span className="material-symbols-outlined modelos-card-icon">memory</span>
                  <span className="label-caps modelos-card-name">{p.name}</span>
                </div>
                <div className="modelos-card-model">☁️ {p.model}</div>
                {p.modelLocal && <div className="modelos-card-model" style={{ color: 'var(--color-success)' }}>🔒 {p.modelLocal}</div>}
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

            <LocalAISection profiles={profiles} saveLocalAssignments={saveLocalAssignments} />

      <RoutesSection />

    </div>

  )

}



export default ModelosView


// ponytail: IA Local — terminal Ollama WS + tarjetas modelos instalados + rename label
function LocalAISection({ profiles, saveLocalAssignments }) {
  const [status, setStatus] = useState(null)
  const [conns, setConns] = useState(null)
  const [provisioning, setProvisioning] = useState(false)
  const [provMsg, setProvMsg] = useState('')
  const [editingLocal, setEditingLocal] = useState(false)
    const [labelDrafts, setLabelDrafts] = useState({})
    const [pullModel, setPullModel] = useState('')
    const [pullLog, setPullLog] = useState('')
  const [pulling, setPulling] = useState(false)
  const [terminalOut, setTerminalOut] = useState('')
    const [cmdInput, setCmdInput] = useState('')
    const [showCmdInfo, setShowCmdInfo] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [deleteChoice, setDeleteChoice] = useState({})
    const [deleting, setDeleting] = useState(false)
  const [cmdIdx, setCmdIdx] = useState(0)
    const wsRef = React.useRef(null)

  const [gpu, setGpu] = useState(null)

  useEffect(() => { loadStatus(); loadConns(); loadGpu() }, [])

  async function loadGpu() {
    try {
      const res = await fetch('/api/localai/gpu')
      if (res.ok) setGpu(await res.json())
    } catch {}
  }

  async function loadStatus() {
    try {
      const res = await fetch('/api/localai/status')
      if (res.ok) setStatus(await res.json())
    } catch {}
  }

  async function loadConns() {
    try {
      const res = await fetch('/api/localai/omniroute-connections')
      if (res.ok) setConns(await res.json())
    } catch {}
  }

  async function provision() {
    setProvisioning(true); setProvMsg('')
    try {
      const res = await fetch('/api/localai/provision', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        setProvMsg('Conexiones listas (openrouter + ollama local)')
        await loadConns()
      } else {
        setProvMsg('Error: ' + (data.detail || (data.errors || []).join(', ') || 'fallo'))
      }
    } catch { setProvMsg('Error de conexión') }
    setProvisioning(false)
  }

  async function saveLabels() {
      try {
        for (const m of (status.ollama.models || [])) {
          const d = labelDrafts[m.name]
          if (d !== undefined && d !== (m.label || m.name)) {
            await fetch('/api/localai/model-label', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: m.name, label: d }),
            })
          }
        }
        await loadStatus()
      } catch { alert('Error al guardar alias') }
      setEditingLocal(false)
      }

      // ponytail: lista de sugerencias del terminal mientras se escribe "/" sin espacio
      const cmdMatches = (cmdInput.startsWith('/') && !cmdInput.includes(' '))
      ? OLLAMA_COMMANDS.filter(c => ('/' + c.short).startsWith(cmdInput.toLowerCase()))
      : []
      const hlIdx = Math.min(cmdIdx, Math.max(cmdMatches.length - 1, 0))

      function openDelete(m) {
      setDeleteChoice({})
      setDeleteTarget(m)
      }

      async function confirmDelete() {
      setDeleting(true)
      try {
        const res = await fetch('/api/localai/model', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: deleteTarget.name }),
        })
        const data = await res.json()
        if (res.ok && data.success) {
          const orphans = profiles.filter(p => (p.modelLocal || '') === deleteTarget.name)
          if (orphans.length) {
            await saveLocalAssignments(Object.fromEntries(orphans.map(p => [p.key, deleteChoice[p.key] || ''])))
          }
          await loadStatus()
          setDeleteTarget(null)
        } else {
          alert('Error: ' + (data.detail || 'No se pudo eliminar'))
        }
      } catch { alert('Error de conexión') }
      setDeleting(false)
      }

  async function startPull() {
    if (!pullModel.trim() || pulling) return
    setPulling(true); setPullLog('')
    try {
      const res = await fetch(`/api/localai/pull?model=${encodeURIComponent(pullModel.trim())}`)
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n\n')
        buf = lines.pop()
        lines.forEach(l => {
          if (l.startsWith('data: ')) {
            const msg = l.slice(6)
            setPullLog(s => (s + msg + '\n').slice(-4000))
          }
        })
      }
      await loadStatus()
    } catch { setPullLog(s => s + '\n[error de conexión]\n') }
    setPulling(false)
  }

  function connectTerminal() {
    if (wsRef.current) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ollama-ws/terminal/ollama`)
    ws.onmessage = e => setTerminalOut(s => (s + e.data).slice(-20000))
    ws.onclose = () => { wsRef.current = null }
    wsRef.current = ws
    setTerminalOut(s => s + '\n[terminal conectado — escribe un comando]\n')
  }

  function sendCmd() {
    if (!wsRef.current || !cmdInput.trim()) return
    wsRef.current.send(cmdInput)
    setCmdInput('')
  }

  useEffect(() => () => { if (wsRef.current) wsRef.current.close() }, [])

  if (!status) return null
  const ollamaUp = status.ollama?.running

  return (
    <div style={{ marginTop: 'var(--space-8)' }}>
      <SectionHeader title="Modelos locales" info="Modelos instalados en el contenedor de Ollama. Puedes renombrarlos, borrarlos, descargar nuevos o usar el terminal directo del contenedor.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <a className="btn-app btn-app-secondary" style={{ textDecoration: 'none' }} href="https://ollama.com" target="_blank" rel="noopener noreferrer">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>public</span> Ir Ollama
          </a>
          {ollamaUp && (!editingLocal ? (
                <button className="btn-app btn-app-secondary" onClick={() => {
                  setLabelDrafts(Object.fromEntries((status.ollama.models || []).map(m => [m.name, m.label || m.name])))
                  setEditingLocal(true)
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span> Editar
                </button>
              ) : (
                <button className="btn-app btn-app-primary" onClick={saveLabels}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span> Guardar
                </button>
              ))}
        </div>
      </SectionHeader>

      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div className="label-caps">Enrutamiento (OmniRoute)</div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <OmniRouteLink style={{ padding: 'var(--space-2) var(--space-3)', minWidth: 'auto' }} title="Abrir interfaz web de OmniRoute">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span> Configurar proveedores
            </OmniRouteLink>
            <button className="btn-app btn-app-secondary" style={{ padding: 'var(--space-2) var(--space-3)', minWidth: 'auto' }} onClick={provision} disabled={provisioning}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sync</span>
              {provisioning ? 'Comprobando...' : 'Comprobar proveedores'}
            </button>
          </div>
        </div>
        {conns ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {conns.connections.length === 0 && <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Sin conexiones. Pulsa Comprobar proveedores.</span>}
            {conns.connections.map(c => (
              <span key={c.id || c.provider} className="label-caps" style={{ background: 'var(--color-surface-high)', color: 'var(--color-text-primary)', fontWeight: 600, padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: 12 }}>
                {c.provider}{c.isActive === 0 ? ' (inactiva)' : ''}
              </span>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Cargando...</span>
        )}
        {provMsg && <div style={{ marginTop: 'var(--space-3)', fontSize: 13, color: provMsg.startsWith('Error') ? 'var(--color-danger)' : 'var(--color-success)' }}>{provMsg}</div>}
      </div>

      {!ollamaUp && (
        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-warning)', verticalAlign: 'middle' }}>warning</span>{' '}
          Contenedor Ollama no está corriendo. Arranca el stack para usar IA local.
        </div>
      )}

      {ollamaUp && (
        <>
          <div className="modelos-grid" style={{ marginBottom: 'var(--space-5)' }}>
            {(status.ollama.models || []).map(m => (
              <div key={m.name} className="card modelos-card">
                <div className="modelos-card-header">
                  <span className="material-symbols-outlined modelos-card-icon">memory</span>
                  {editingLocal ? (
                                      <div style={{ display: 'flex', gap: 'var(--space-2)', flex: 1, alignItems: 'center' }}>
                                        <input
                                          className="input-app modelos-name-input"
                                          style={{ flex: 1 }}
                                          value={labelDrafts[m.name] ?? (m.label || m.name)}
                                          onChange={e => setLabelDrafts(s => ({ ...s, [m.name]: e.target.value }))}
                                          placeholder={m.name}
                                        />
                                        <button className="btn-app btn-app-secondary" style={{ padding: 'var(--space-2)', minWidth: 'auto' }} title="Eliminar modelo del contenedor" onClick={() => openDelete(m)}>
                                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-danger)' }}>delete</span>
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="label-caps modelos-card-name">{m.label || m.name}</span>
                                    )}
                </div>
                <div className="modelos-card-model">{m.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
                  {m.size}{m.modified ? ` · ${m.modified}` : ''}
                </div>
              </div>
            ))}
            {(status.ollama.models || []).length === 0 && (
              <div className="card modelos-card" style={{ opacity: 0.6 }}>
                <div className="modelos-card-model">Sin modelos instalados</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
                  Descarga uno abajo o usa el terminal.
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div className="label-caps" style={{ marginBottom: 'var(--space-3)' }}>Descargar modelo</div>
            {gpu && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 13, marginBottom: 'var(--space-3)', color: gpu.gpu ? 'var(--color-success)' : 'var(--color-warning)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{gpu.gpu ? 'bolt' : 'warning'}</span>
                <span>
                  {gpu.gpu
                    ? `Tu GPU: ${gpu.gpu} (${Math.round(gpu.vram_mb / 1024)} GB) — recomendado: modelos de ${gpu.advice}`
                    : gpu.advice}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <input
                className="input-app"
                style={{ flex: 1, minWidth: 0 }}
                value={pullModel}
                onChange={e => setPullModel(e.target.value)}
                placeholder="ej: llama3.2:3b, qwen2.5:7b..."
                onKeyDown={e => { if (e.key === 'Enter') startPull() }}
                disabled={pulling}
              />
              <button className="btn-app btn-app-primary" onClick={startPull} disabled={pulling || !pullModel.trim()}>
                {pulling ? 'Descargando...' : 'Descargar'}
              </button>
            </div>
            {pullLog && (
              <pre style={{ marginTop: 'var(--space-3)', maxHeight: 200, overflow: 'auto', fontSize: 12, background: 'var(--color-surface-high)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', whiteSpace: 'pre-wrap' }}>
                {pullLog}
              </pre>
            )}
          </div>

          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <div className="label-caps">Terminal del contenedor (ollama)</div>
                <button className="btn-app btn-app-secondary" style={{ padding: '2px 6px', minWidth: 'auto' }} title="Ver comandos disponibles" onClick={() => setShowCmdInfo(true)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
                </button>
              </div>
              {!wsRef.current && (
                <button className="btn-app btn-app-secondary" style={{ padding: 'var(--space-2) var(--space-3)', minWidth: 'auto' }} onClick={connectTerminal}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>terminal</span> Conectar
                </button>
              )}
            </div>
            <pre
              ref={el => { if (el && terminalOut) el.scrollTop = el.scrollHeight }}
              style={{ background: '#0d1117', color: '#c9d1d9', fontSize: 12, padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', height: 260, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
            >{terminalOut || '[desconectado — pulsa Conectar]'}</pre>
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
              <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                <input
                  className="input-app"
                  style={{ width: '100%', fontFamily: 'monospace' }}
                  value={cmdInput}
                  onChange={e => { setCmdInput(e.target.value); setCmdIdx(0) }}
                  onKeyDown={e => {
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      if (cmdMatches.length) {
                        setCmdIdx(i => e.key === 'ArrowDown' ? Math.min(i + 1, cmdMatches.length - 1) : Math.max(i - 1, 0))
                        e.preventDefault()
                      }
                      return
                    }
                    if (e.key !== 'Enter') return
                    if (cmdInput.startsWith('/') && !cmdInput.includes(' ')) {
                      if (cmdMatches.length) setCmdInput('/' + cmdMatches[hlIdx].short + ' ')
                      e.preventDefault()
                      return
                    }
                    sendCmd()
                  }}
                  placeholder="ollama pull llama3.2:3b — escribe / para ver comandos"
                  disabled={!wsRef.current}
                />
                {cmdMatches.length > 0 && (
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 'calc(100% + 4px)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', zIndex: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                    {cmdMatches.map((c, i) => (
                      <div key={c.short} style={{ padding: 'var(--space-2) var(--space-3)', cursor: 'pointer', display: 'flex', gap: 'var(--space-3)', alignItems: 'baseline', background: i === hlIdx ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent' }}
                        onMouseEnter={() => setCmdIdx(i)}
                        onMouseDown={e => { e.preventDefault(); setCmdInput('/' + c.short + ' ') }}>
                        <code style={{ fontSize: 13, fontWeight: 600 }}>/{c.short}{c.arg ? ' ' + c.arg : ''}</code>
                        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{c.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn-app btn-app-primary" onClick={sendCmd} disabled={!wsRef.current || !cmdInput.trim()}>
                Enviar
              </button>
            </div>
          </div>
        </>
      )}

      {showCmdInfo && (
        <div className="modelos-summary-overlay" onClick={() => setShowCmdInfo(false)}>
          <div className="modelos-summary-card" onClick={e => e.stopPropagation()}>
            <div className="modelos-summary-icon">
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--color-primary)' }}>terminal</span>
            </div>
            <h2 className="modelos-summary-title">Comandos del terminal</h2>
            <div style={{ maxHeight: '50vh', overflow: 'auto', textAlign: 'left' }}>
              {OLLAMA_COMMANDS.map(c => (
                <div key={c.short} style={{ marginBottom: 'var(--space-3)' }}>
                  <code style={{ fontSize: 13, fontWeight: 600 }}>ollama {c.short}{c.arg ? ' ' + c.arg : ''}</code>
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{c.desc}</div>
                </div>
              ))}
            </div>
            <button className="btn-app btn-app-primary" style={{ width: '100%', marginTop: 'var(--space-5)' }} onClick={() => setShowCmdInfo(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modelos-summary-overlay" onClick={() => { if (!deleting) setDeleteTarget(null) }}>
          <div className="modelos-summary-card" onClick={e => e.stopPropagation()}>
            <div className="modelos-summary-icon">
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--color-danger)' }}>dangerous</span>
            </div>
            <h2 className="modelos-summary-title">Eliminar modelo</h2>
            <p className="modelos-summary-text">
              Se borrará <strong>{deleteTarget.label}</strong> ({deleteTarget.name}{deleteTarget.size ? `, ${deleteTarget.size}` : ''}) del contenedor. Esta acción no se puede deshacer.
            </p>
            {profiles.filter(p => (p.modelLocal || '') === deleteTarget.name).length > 0 && (
              <div style={{ marginTop: 'var(--space-4)', textAlign: 'left' }}>
                <div className="label-caps" style={{ marginBottom: 'var(--space-2)' }}>Perfiles que lo usan como modelo local</div>
                {profiles.filter(p => (p.modelLocal || '') === deleteTarget.name).map(p => (
                  <div key={p.key} className="modelos-summary-row" style={{ marginBottom: 'var(--space-2)' }}>
                    <span className="label-caps">{p.name}</span>
                    <select
                      className="input-app"
                      style={{ maxWidth: '55%', padding: 'var(--space-1) var(--space-2)', fontSize: 13 }}
                      value={deleteChoice[p.key] || ''}
                      onChange={e => setDeleteChoice(s => ({ ...s, [p.key]: e.target.value }))}
                    >
                      <option value="">(vacío)</option>
                      {(status.ollama.models || []).filter(m2 => m2.name !== deleteTarget.name).map(m2 => (
                        <option key={m2.name} value={m2.name}>{m2.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
            <button className="btn-app btn-app-primary" style={{ width: '100%', marginTop: 'var(--space-5)', background: 'var(--color-error)', borderColor: 'var(--color-error)', color: '#fff' }} onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ponytail: Rutas section — labels editable, URLs read-only, copy button
function RoutesSection() {
  const [routes, setRoutes] = useState([])
  const [editing, setEditing] = useState(false)
    const [drafts, setDrafts] = useState({})
    const [copied, setCopied] = useState(null)

  useEffect(() => { loadRoutes() }, [])

  async function loadRoutes() {
    try {
      const res = await fetch('/api/instances/routes')
      if (res.ok) setRoutes((await res.json()).services || [])
    } catch {}
  }

  async function saveLabels() {
      try {
        for (const r of visible) {
          const d = drafts[r.service]
          if (d !== undefined && d !== r.label) {
            await fetch('/api/instances/routes/labels', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ service: r.service, label: d }),
            })
          }
        }
        await loadRoutes()
      } catch { alert('Error al guardar etiqueta') }
      setEditing(false)
    }

  function copyUrl(url, idx) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(idx)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  const visible = routes.filter(r => r.url)

  return (
    <div style={{ marginTop: 'var(--space-8)' }}>
      <SectionHeader title="Rutas" info="URLs internas de cada contenedor. Cópialas para configurar el túnel de Cloudflare; puedes renombrar la etiqueta de cada una.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <a className="btn-app btn-app-secondary" style={{ textDecoration: 'none' }} href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>public</span> Ir Cloudflare
          </a>
          {(!editing ? (
            <button className="btn-app btn-app-secondary" onClick={() => {
              setDrafts(Object.fromEntries(visible.map(r => [r.service, r.label])))
              setEditing(true)
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span> Editar
            </button>
          ) : (
            <button className="btn-app btn-app-primary" onClick={saveLabels}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span> Guardar
            </button>
          ))}
        </div>
      </SectionHeader>
      <div className="modelos-grid">
        {visible.map((r, i) => (
          <div key={r.service} className="card modelos-card">
            <div className="modelos-card-header">
              {editing ? (
                            <input
                              className="input-app modelos-name-input"
                              value={drafts[r.service] ?? r.label}
                              onChange={e => setDrafts(s => ({ ...s, [r.service]: e.target.value }))}
                            />
                          ) : (
                            <span className="label-caps modelos-card-name">{r.label}</span>
                          )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
              <code style={{ flex: 1, fontSize: 13, color: 'var(--color-text-secondary)', background: 'var(--color-surface-high)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.url}
              </code>
              <button
                className="btn-app btn-app-secondary"
                style={{ padding: 'var(--space-2) var(--space-3)', minWidth: 'auto' }}
                onClick={() => copyUrl(r.url, i)}
                title="Copiar URL"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {copied === i ? 'check' : 'content_copy'}
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}