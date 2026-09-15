import React, { useState, useEffect } from 'react'

const DEFAULT_MODELS = {
  'chat-default': 'combo/cerebro-default',
  'chat-smart': 'combo/cerebro-smart',
  'cerebro': 'combo/cerebro-cerebro',
  'investigador': 'combo/cerebro-smart',
  'graphify': 'combo/cerebro-graphify',
}
const DEFAULT_NAMES = {
  'chat-default': 'Chat Default',
  'chat-smart': 'Chat Inteligente',
  'cerebro': 'Cerebro',
  'investigador': 'Investigador',
  'graphify': 'Graphify (Neuronas)',
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
                  placeholder="combo/nombre-cloud"
                  title="Combo cloud o modelo OpenRouter"
                />
                <input
                  className="input-app modelos-model-input"
                  value={editModelsLocal[p.key] || ''}
                  onChange={e => setEditModelsLocal(s => ({ ...s, [p.key]: e.target.value }))}
                  placeholder="combo/nombre-local"
                  title="Combo local (Ollama) para el toggle Local del chat"
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

      {/* ponytail: OmniRoute redirige a rutas absolutas y colisiona /api tras proxy → link directo al puerto publicado */}
      <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
        <a href={`http://${location.hostname}:20128`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--color-primary)' }}>
          Editar los modelos de cada combo en el panel OmniRoute <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: '-2px' }}>open_in_new</span>
        </a>
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

      <RoutesSection />
      <LocalAISection />
    </div>
  )
}

export default ModelosView

// ponytail: IA Local — terminal Ollama WS + tarjetas modelos instalados + rename label
function LocalAISection() {
  const [status, setStatus] = useState(null)
  const [conns, setConns] = useState(null)
  const [provisioning, setProvisioning] = useState(false)
  const [provMsg, setProvMsg] = useState('')
  const [editingLabel, setEditingLabel] = useState(null)
  const [labelDraft, setLabelDraft] = useState('')
  const [pullModel, setPullModel] = useState('')
  const [pullLog, setPullLog] = useState('')
  const [pulling, setPulling] = useState(false)
  const [terminalOut, setTerminalOut] = useState('')
  const [cmdInput, setCmdInput] = useState('')
  const wsRef = React.useRef(null)

  useEffect(() => { loadStatus(); loadConns() }, [])

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
        const c = (data.created || []).map(x => `${x.provider} (${x.status})`).join(', ')
        setProvMsg(c ? 'Creadas: ' + c : 'Proveedores ya configurados')
        await loadConns()
      } else {
        setProvMsg('Error: ' + (data.detail || 'fallo'))
      }
    } catch { setProvMsg('Error de conexión') }
    setProvisioning(false)
  }

  async function saveLabel(model, alias) {
    try {
      await fetch('/api/localai/model-label', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, label: alias }),
      })
      await loadStatus()
    } catch { alert('Error al guardar alias') }
    setEditingLabel(null)
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
      <h2 className="section-title" style={{ marginBottom: 'var(--space-2)' }}>IA Local</h2>
      <p className="section-subtitle" style={{ marginBottom: 'var(--space-5)' }}>
        Modelos locales con Ollama. Terminal del contenedor para instalar lo que quieras.
      </p>

      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div className="label-caps">Enrutamiento (OmniRoute)</div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <a className="btn-app btn-app-secondary" style={{ padding: 'var(--space-2) var(--space-3)', minWidth: 'auto', textDecoration: 'none' }}
              href={`http://${location.hostname}:20128`} target="_blank" rel="noopener noreferrer"
              title="Abrir interfaz web de OmniRoute">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span> Dashboard
            </a>
            <button className="btn-app btn-app-secondary" style={{ padding: 'var(--space-2) var(--space-3)', minWidth: 'auto' }} onClick={provision} disabled={provisioning}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sync</span>
              {provisioning ? 'Configurando...' : 'Configurar proveedores'}
            </button>
          </div>
        </div>
        {conns ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {conns.connections.length === 0 && <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Sin conexiones. Pulsa Configurar proveedores.</span>}
            {conns.connections.map(c => (
              <span key={c.id || c.provider} className="label-caps" style={{ background: 'var(--color-surface-high)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: 12 }}>
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
                  {editingLabel === m.name ? (
                    <input
                      className="input-app modelos-name-input"
                      value={labelDraft}
                      onChange={e => setLabelDraft(e.target.value)}
                      onBlur={() => saveLabel(m.name, labelDraft)}
                      onKeyDown={e => { if (e.key === 'Enter') saveLabel(m.name, labelDraft); if (e.key === 'Escape') setEditingLabel(null) }}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="label-caps modelos-card-name"
                      style={{ cursor: 'pointer' }}
                      title="Click para renombrar"
                      onClick={() => { setEditingLabel(m.name); setLabelDraft(m.label || m.name) }}
                    >
                      {m.label || m.name}
                      <span className="material-symbols-outlined" style={{ fontSize: 14, opacity: 0.5, marginLeft: 'var(--space-2)' }}>edit</span>
                    </span>
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
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <input
                className="input-app"
                style={{ flex: 1 }}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div className="label-caps">Terminal del contenedor (ollama)</div>
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
              <input
                className="input-app"
                style={{ flex: 1, fontFamily: 'monospace' }}
                value={cmdInput}
                onChange={e => setCmdInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendCmd() }}
                placeholder="ollama pull llama3.2:3b"
                disabled={!wsRef.current}
              />
              <button className="btn-app btn-app-primary" onClick={sendCmd} disabled={!wsRef.current || !cmdInput.trim()}>
                Enviar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ponytail: Rutas section — labels editable, URLs read-only, copy button
function RoutesSection() {
  const [routes, setRoutes] = useState([])
  const [editingLabel, setEditingLabel] = useState(null)
  const [labelDraft, setLabelDraft] = useState('')
  const [copied, setCopied] = useState(null)

  useEffect(() => { loadRoutes() }, [])

  async function loadRoutes() {
    try {
      const res = await fetch('/api/instances/routes')
      if (res.ok) setRoutes((await res.json()).services || [])
    } catch {}
  }

  async function saveLabel(service) {
    try {
      await fetch('/api/instances/routes/labels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, label: labelDraft }),
      })
      setRoutes(rs => rs.map(r => r.service === service ? { ...r, label: labelDraft || r.service } : r))
    } catch { alert('Error al guardar etiqueta') }
    setEditingLabel(null)
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
      <h2 className="section-title" style={{ marginBottom: 'var(--space-2)' }}>Rutas</h2>
      <p className="section-subtitle" style={{ marginBottom: 'var(--space-5)' }}>
        URLs internas de cada contenedor. Cópialas para configurar el túnel de Cloudflare.
      </p>
      <div className="modelos-grid">
        {visible.map((r, i) => (
          <div key={r.service} className="card modelos-card">
            <div className="modelos-card-header">
              {editingLabel === r.service ? (
                <input
                  className="input-app modelos-name-input"
                  value={labelDraft}
                  onChange={e => setLabelDraft(e.target.value)}
                  onBlur={() => saveLabel(r.service)}
                  onKeyDown={e => { if (e.key === 'Enter') saveLabel(r.service); if (e.key === 'Escape') setEditingLabel(null) }}
                  autoFocus
                />
              ) : (
                <span
                  className="label-caps modelos-card-name"
                  style={{ cursor: 'pointer' }}
                  title="Click para editar etiqueta"
                  onClick={() => { setEditingLabel(r.service); setLabelDraft(r.label) }}
                >
                  {r.label}
                  <span className="material-symbols-outlined" style={{ fontSize: 14, opacity: 0.5, marginLeft: 'var(--space-2)' }}>edit</span>
                </span>
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