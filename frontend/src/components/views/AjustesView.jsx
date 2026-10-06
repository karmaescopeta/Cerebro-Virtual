import React, { useRef } from 'react'
import { applyPalette, clearPalette, localPalettes, saveLocalPalette, deleteLocalPalette, localActivePal, setLocalActive, primaryOk, secondaryOk, relLum, onColor, getWebLogo, setWebLogo, getWebFavicon, setWebFavicon, applyWebFavicon } from '../../webTheme.js'
import { containerUrl } from '../../lib/ports.js'

function AjustesView({
  editAgentName, editPersonality, editingAgent, editSaving, editMessage, editMessageType,
  restarting, systemInfo, vaultMessage, vaultMessageType, vaultImporting,
  onEdit, onCancelEdit, onSaveEdit, setEditAgentName, setEditPersonality, onRestart,
  onExport, onImport, onReset, onTabChange, avatarUrl, onAvatarChange, theme, onSetTheme,
  }) {
    const importRef = useRef(null)
    const avatarRef = useRef(null)
    const [avatarMsg, setAvatarMsg] = React.useState(null)
    const [cfgMsg, setCfgMsg] = React.useState('')
    const [expanded, setExpanded] = React.useState(false)
    const [showVaultInfo, setShowVaultInfo] = React.useState(false)
    const [showPanelsInfo, setShowPanelsInfo] = React.useState(false)
  const [showFactoryInfo, setShowFactoryInfo] = React.useState(false)
    const [resetStep, setResetStep] = React.useState(0)
    const [remoteVer, setRemoteVer] = React.useState(null)
    // v1.5.4: links a los paneles con los puertos REALES de este cerebro (su .env), no hardcodes
    const [panelUrls, setPanelUrls] = React.useState({})
    React.useEffect(() => {
      (async () => setPanelUrls({
        agent: await containerUrl('agent', 8080),
        omniroute: await containerUrl('omniroute', 20128),
      }))().catch(() => {})
    }, [])

    React.useEffect(() => {
      fetch('https://raw.githubusercontent.com/karmaescopeta/Cerebro-Virtual/main/VERSION')
        .then(r => r.ok ? r.text() : null).then(t => setRemoteVer(t && t.trim())).catch(() => {})
    }, [])
    const updateAvailable = (() => {
      if (!remoteVer || !systemInfo?.version) return false
      const a = remoteVer.split('.').map(Number), b = systemInfo.version.split('.').map(Number)
      for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0)
      return false
    })()

  const handleAvatarFile = (e) => {
      const f = e.target.files[0]
      e.target.value = ''
      if (!f) return
      if (!f.type.startsWith('image/')) { setAvatarMsg({ type: 'error', text: 'Selecciona una imagen' }); return }
      if (f.size > 280_000) { setAvatarMsg({ type: 'error', text: 'Imagen demasiado grande (máx ~280KB)' }); return }
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const res = await fetch('/api/agent/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar: reader.result }) })
          if (!res.ok) throw new Error('HTTP ' + res.status)
          onAvatarChange(reader.result)
          setAvatarMsg({ type: 'success', text: 'Imagen del agente guardada' })
        } catch (err) { setAvatarMsg({ type: 'error', text: 'Error al guardar: ' + err.message }) }
      }
      reader.readAsDataURL(f)
    }

    const removeAvatar = async () => {
      try {
        await fetch('/api/agent/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar: '' }) })
        onAvatarChange('')
        setAvatarMsg({ type: 'success', text: 'Imagen eliminada' })
      } catch (e) { setAvatarMsg({ type: 'error', text: 'Error: ' + e.message }) }
    }

    const PERSONALIDADES = [
    { label: 'Técnico', text: 'Eres un asistente de IA técnico y preciso. Respondes con claridad, priorizando el código, la arquitectura y los datos verificables.' },
    { label: 'Amigable', text: 'Eres un asistente cercano y cordial. Explicas las cosas de forma sencilla y motivadora, sin tecnicismos innecesarios.' },
    { label: 'Conciso', text: 'Eres un asistente directo. Respuestas cortas, al grano, sin relleno ni preámbulos.' },
    { label: 'Creativo', text: 'Eres un asistente creativo e imaginativo. Propones ideas originales y usas ejemplos coloridos.' },
  ]
  const [cfgType, setCfgType] = React.useState('success')
  const [exporting, setExporting] = React.useState(false)

  const handleExportConfig = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/config/export')
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'agent-config.json'
      a.click()
      URL.revokeObjectURL(a.href)
      setCfgType('success')
      setCfgMsg('Configuración exportada sin secretos')
    } catch (e) {
      setCfgType('error')
      setCfgMsg('Error al exportar: ' + e.message)
    }
    setExporting(false)
  }

  return (
    <div>
      <h1 className="section-title">Ajustes</h1>

      {/* Agente Principal */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 className="section-heading" style={{ marginBottom: 0 }}>Personalización ({editAgentName || 'Hermes'})</h2>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            {!editingAgent && (
              <button className="btn-app btn-app-secondary" onClick={onEdit}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span> Editar
              </button>
            )}
            <button className="btn-app btn-app-secondary" onClick={onRestart} disabled={restarting}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
              {restarting ? 'Reiniciando...' : 'Reiniciar'}
            </button>
          </div>
        </div>

        {editingAgent ? (
          <div className="card">
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label className="label-caps" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>NOMBRE DEL AGENTE</label>
              <input className="input-app" value={editAgentName} onChange={(e) => setEditAgentName(e.target.value)} />
            </div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label className="label-caps" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>PERSONALIDAD</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                {PERSONALIDADES.map(p => (
                  <button
                    key={p.label}
                    className="btn-app btn-app-secondary"
                    style={{ padding: '4px 12px', fontSize: 12 }}
                    onClick={() => setEditPersonality(p.text)}
                  >{p.label}</button>
                ))}
              </div>
              <textarea className="input-app" rows={8} value={editPersonality} onChange={(e) => setEditPersonality(e.target.value)} style={{ resize: 'vertical', fontFamily: 'var(--font-body)' }} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn-app btn-app-primary" onClick={onSaveEdit} disabled={editSaving}>
                {editSaving ? 'Guardando...' : 'Guardar'}
              </button>
              <button className="btn-app btn-app-secondary" onClick={onCancelEdit}>Cancelar</button>
            </div>
            {editMessage && <MsgBox type={editMessageType} message={editMessage} />}
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                className="btn-app btn-app-secondary"
                style={{ width: 56, height: 56, borderRadius: 'var(--radius-full)', padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => avatarRef.current?.click()}
                title="Cambiar imagen del agente"
              >
                {avatarUrl
                  ? <img src={avatarUrl} alt="Agente" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)' }}>{(editAgentName || 'H').charAt(0).toUpperCase()}</span>}
              </button>
              {avatarUrl && (
                <button
                  className="btn-app btn-app-danger"
                  style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 'var(--radius-full)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={removeAvatar}
                  title="Quitar imagen"
                ><span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span></button>
              )}
              <input type="file" ref={avatarRef} accept="image/*" style={{ display: 'none' }} onChange={handleAvatarFile} />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="label-caps" style={{ marginBottom: 'var(--space-1)' }}>NOMBRE DEL AGENTE</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 'var(--space-4)' }}>{editAgentName || 'Hermes'}</div>
              <div className="label-caps" style={{ marginBottom: 'var(--space-1)' }}>PERSONALIDAD</div>
              <div
                style={{
                  fontSize: 14, fontStyle: 'italic', color: 'var(--color-text-secondary)', lineHeight: 1.6,
                  ...(editPersonality && editPersonality.length > 200 && !expanded
                    ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
                    : {}),
                }}
              >
                {editPersonality || '—'}
              </div>
              {editPersonality && editPersonality.length > 200 && (
                <button
                  className="btn-app btn-app-secondary"
                  style={{ padding: '2px 10px', fontSize: 12, marginTop: 'var(--space-2)' }}
                  onClick={() => setExpanded(!expanded)}
                >{expanded ? 'Ver menos' : 'Ver más'}</button>
              )}
              {avatarMsg && <div style={{ marginTop: 'var(--space-3)' }}><MsgBox type={avatarMsg.type} message={avatarMsg.text} /></div>}
            </div>
          </div>
        )}
      </section>

      {/* Personalización de la Web */}
      <WebThemeSection theme={theme} onSetTheme={onSetTheme} />

      {/* Logo y Favicon */}
      <BrandSection />

      {/* Configuración de Bóveda */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <h2 className="section-heading" style={{ marginBottom: 0 }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 18 }}>folder</span>
            Configuración de Bóveda
          </h2>
          <button
                      className="btn-app btn-app-secondary"
                      style={{ padding: '2px 8px', fontSize: 12 }}
                      onClick={() => setShowVaultInfo(!showVaultInfo)}
                      aria-label="Qué es la bóveda"
                    ><span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span></button>
                  </div>
        {showVaultInfo && (
          <div className="card" style={{ marginBottom: 'var(--space-4)', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: 'var(--space-3)' }}>
              La <strong style={{ color: 'var(--color-text-primary)' }}>bóveda</strong> es donde vive todo: tus documentos, notas y páginas wiki. Todo en tu ordenador, nunca en la nube.
            </p>
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <div><strong style={{ color: 'var(--color-text-primary)' }}>⬇ Exportar vault</strong> — descarga una copia completa de tus documentos para guardarla donde quieras.</div>
              <div><strong style={{ color: 'var(--color-text-primary)' }}>⬆ Importar vault</strong> — restaura una copia anterior. Sustituye lo que hay ahora.</div>
              <div><strong style={{ color: 'var(--color-text-primary)' }}>⚙ Exportar configuración</strong> — descarga los ajustes del agente (sin claves ni secretos) para compartirlos o respaldarlos.</div>
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 'var(--space-3)' }}>
          <ActionCard icon="download" title="Exportar vault" desc="Copia completa de tus documentos" onClick={onExport} disabled={false} />
          <input type="file" ref={importRef} style={{ display: 'none' }} accept=".tar.gz,.tgz,.tar" onChange={(e) => { if (e.target.files[0]) { onImport(e.target.files[0]); e.target.value = '' } }} />
          <ActionCard icon="upload" title="Importar vault" desc="Restaura una copia de seguridad" onClick={() => importRef.current?.click()} disabled={vaultImporting} busy={vaultImporting ? 'Importando...' : null} />
          <ActionCard icon="settings" title="Exportar configuración" desc="Ajustes del agente sin secretos" onClick={handleExportConfig} disabled={exporting} busy={exporting ? 'Exportando...' : null} />
        </div>
        {vaultMessage && <MsgBox type={vaultMessageType} message={vaultMessage} />}
        {cfgMsg && <MsgBox type={cfgType} message={cfgMsg} />}
      </section>

      {/* Paneles de control */}
            <section style={{ marginBottom: 'var(--space-8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <h2 className="section-heading" style={{ marginBottom: 0 }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 18 }}>dashboard</span>
                  Paneles de control
                </h2>
                <button
                  className="btn-app btn-app-secondary"
                  style={{ padding: '2px 8px', fontSize: 12 }}
                  onClick={() => setShowPanelsInfo(!showPanelsInfo)}
                  aria-label="Qué son los paneles"
                ><span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span></button>
              </div>
              {showPanelsInfo && (
                <div className="card" style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-4)', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                  Cada componente de Cerebro tiene su propia web de administración avanzada. <strong style={{ color: 'var(--color-text-primary)' }}>Hermes Agent</strong> es el panel del agente (conexiones, sesiones, ajustes finos) y <strong style={{ color: 'var(--color-text-primary)' }}>OmniRoute</strong> gestiona las claves y el reparto de modelos IA. Se abren en otra pestaña y solo funcionan desde este ordenador.
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                <a href={panelUrls.agent || 'http://localhost:8080'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <ActionCard icon="psychology" title="Hermes Agent" desc="Dashboard del agente (sistema-agente)" />
                </a>
                <a href={panelUrls.omniroute || 'http://localhost:20128'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <ActionCard icon="memory" title="OmniRoute" desc="Gateway de modelos IA. Solo desde este PC." />
                </a>
              </div>
            </section>

      {/* Acceso Remoto */}
      <TunnelSection />

      {/* Acerca de */}
      <section>
        <h2 className="section-heading">
          <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 18 }}>info</span>
          Acerca de
        </h2>
        <div className="card">
                  <InfoRow label="Proyecto" value="Cerebro Virtual" />
                  <InfoRow label="Versión" value={systemInfo?.version || '—'} mono />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-surface)' }}>
                    <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Actualización</span>
                    {updateAvailable ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: 'var(--color-error)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sync</span>
                          Nueva versión: {remoteVer}
                        </span>
                        <button className="btn-app btn-app-primary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => onTabChange('updates')}>
                          Ir a Actualizaciones
                        </button>
                      </div>
                    ) : remoteVer ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--color-success)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                        En la última versión
                      </span>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>—</span>
                    )}
                  </div>
                  <a
            href="https://github.com/karmaescopeta/Cerebro-Virtual"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) 0', color: 'var(--color-primary)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
          >
            <span>Ver en GitHub</span>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
          </a>
        </div>
      </section>

      {/* Reinicios — Fábrica y Bóveda, en un recuadro */}
      <section style={{ marginBottom: 'var(--space-8)', borderTop: '1px solid var(--color-surface-container)', paddingTop: 'var(--space-8)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: 0, top: 0, opacity: 0.05, pointerEvents: 'none' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 180, color: 'var(--color-error)' }}>warning</span>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-5)' }}>
          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
              <h2 className="section-heading" style={{ marginBottom: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>dangerous</span>
                Reinicio de Fábrica
              </h2>
              <button
                className="btn-app btn-app-secondary"
                style={{ padding: '2px 8px', fontSize: 12 }}
                onClick={() => setShowFactoryInfo(!showFactoryInfo)}
                aria-label="Qué hace el reinicio de fábrica"
              ><span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span></button>
            </div>
            {showFactoryInfo && (
              <div style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-4)', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Devuelve el sistema a su estado inicial: borra la configuración del agente (clave API, personalización, túnel) y arranca el asistente de configuración como la primera vez. Los documentos de tu bóveda <strong style={{ color: 'var(--color-text-primary)' }}>NO</strong> se pierden.
              </div>
            )}
            <div style={{ marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-app btn-app-danger" onClick={() => setResetStep(1)}>
                Reiniciar
              </button>
            </div>
          </div>
          <VaultResetPane />
        </div>
        {resetStep > 0 && (
          <div style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 55%, transparent)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-5)' }}>
            <div className="card" style={{ maxWidth: 440, padding: 'var(--space-6)', boxShadow: 'var(--shadow-lg, 0 8px 30px rgba(0,0,0,0.3))' }}>
              {resetStep === 1 ? (
                <React.Fragment>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 'var(--space-3)' }}>Reinicio de fábrica</h3>
                  <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-5)' }}>
                    Esto reiniciará <strong style={{ color: 'var(--color-error)' }}>todo el sistema</strong>: se borrará la configuración del agente (clave API, personalización, túnel) y tendrás que pasar de nuevo el asistente de configuración. Tus documentos del vault NO se pierden.
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                    <button className="btn-app btn-app-secondary" onClick={() => setResetStep(0)}>Cancelar</button>
                    <button className="btn-app btn-app-danger" onClick={() => setResetStep(2)}>Continuar</button>
                  </div>
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 'var(--space-3)' }}>¿Estás seguro?</h3>
                  <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-5)' }}>
                    Esta acción no se puede deshacer. Se detendrá el agente y perderás su configuración.
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                    <button className="btn-app btn-app-secondary" onClick={() => setResetStep(0)}>No, cancelar</button>
                    <button className="btn-app btn-app-danger" onClick={() => { setResetStep(0); onReset() }}>Sí, reiniciar</button>
                  </div>
                </React.Fragment>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function VaultResetPane() {
  const [showInfo, setShowInfo] = React.useState(false)
  const [step, setStep] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState(null)

  const downloadVault = async () => {
    try {
      const res = await fetch('/api/vault/export')
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'vault-backup.tar.gz'
      a.click()
      URL.revokeObjectURL(a.href)
      setMsg({ type: 'success', text: 'Copia descargada. Guárdala en un lugar seguro antes de continuar.' })
    } catch (e) { setMsg({ type: 'error', text: 'Error al descargar: ' + e.message }) }
  }

  const doReset = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/vault/reset', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.detail || 'HTTP ' + res.status)
      setStep(0)
      setMsg({ type: 'success', text: d.message || 'Bóveda reiniciada' })
    } catch (e) { setMsg({ type: 'error', text: 'Error: ' + e.message }) }
    setBusy(false)
  }

  return (
    <div className="card" style={{ padding: 'var(--space-5)' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <h2 className="section-heading" style={{ marginBottom: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>folder_delete</span>
            Reinicio de Bóveda
          </h2>
          <button
            className="btn-app btn-app-secondary"
            style={{ padding: '2px 8px', fontSize: 12 }}
            onClick={() => setShowInfo(!showInfo)}
            aria-label="Qué hace el reinicio de bóveda"
          ><span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span></button>
        </div>
        {showInfo && (
          <div style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-4)', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Vacía la bóveda por completo: documentos, páginas wiki, outputs y chats se borran del sistema y el índice/grafo vuelven a cero. El agente sigue funcionando igual que antes, pero ya no sabe nada de los archivos del cerebro. La configuración del agente <strong style={{ color: 'var(--color-text-primary)' }}>NO</strong> se toca.
          </div>
        )}
        <div style={{ marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-app btn-app-danger" onClick={() => { setStep(1); setMsg(null) }}>
            Reiniciar
          </button>
        </div>
        {msg && <MsgBox type={msg.type} message={msg.text} />}
      </div>
      {step > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 55%, transparent)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-5)' }}>
          <div className="card" style={{ maxWidth: 460, padding: 'var(--space-6)', boxShadow: 'var(--shadow-lg, 0 8px 30px rgba(0,0,0,0.3))' }}>
            {step === 1 ? (
              <React.Fragment>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 'var(--space-3)' }}>Reinicio de bóveda</h3>
                <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
                  Esto vaciará la bóveda por completo. <strong style={{ color: 'var(--color-text-primary)' }}>Recomendación:</strong> descarga antes una copia de tu bóveda actual para no perder nada importante.
                </p>
                <button className="btn-app btn-app-secondary" style={{ marginBottom: 'var(--space-5)' }} onClick={downloadVault}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                  Descargar copia de la bóveda
                </button>
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                  <button className="btn-app btn-app-secondary" onClick={() => setStep(0)}>Cancelar</button>
                  <button className="btn-app btn-app-danger" onClick={() => setStep(2)}>Quiero reiniciarla</button>
                </div>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 'var(--space-3)' }}>¿Seguro que quieres reiniciar la bóveda?</h3>
                <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-5)' }}>
                  <strong style={{ color: 'var(--color-error)' }}>Los datos se borrarán del sistema</strong>: documentos, páginas wiki, outputs y chats. Esta acción no se puede deshacer.
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                  <button className="btn-app btn-app-secondary" onClick={() => setStep(0)}>No, cancelar</button>
                  <button className="btn-app btn-app-danger" onClick={doReset} disabled={busy}>
                    {busy ? 'Reiniciando...' : 'Sí, reiniciar bóveda'}
                  </button>
                </div>
              </React.Fragment>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ActionCard({ icon, title, desc, onClick, disabled, busy }) {
  const inner = (
    <div
      className="card"
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1, transition: 'border-color .15s',
      }}
      onClick={disabled ? undefined : onClick}
      onMouseOver={disabled ? undefined : (e) => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
      onMouseOut={disabled ? undefined : (e) => { e.currentTarget.style.borderColor = '' }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 'var(--radius-full)', flexShrink: 0,
        background: 'color-mix(in srgb, var(--color-secondary) 15%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--color-secondary)', fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{busy || title}</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{desc}</div>
      </div>
      <span className="material-symbols-outlined" style={{ color: 'var(--color-text-secondary)', fontSize: 18 }}>chevron_right</span>
    </div>
  )
  return inner
}

const SWATCHES = ['#1E6E52', '#2563EB', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#CA8A04', '#0D9488']
const BACKGROUNDS = [
  { hex: '#FAF8F4', name: 'Claro cálido', light: true },
  { hex: '#FFFFFF', name: 'Claro neutro', light: true },
  { hex: '#0D101D', name: 'Oscuro azulado', light: false },
  { hex: '#000000', name: 'Negro OLED', light: false },
]
const SECONDARY_NEUTRALS = ['#94A3B8', '#64748B']

// ponytail: círculo = fondo del tema (o gradiente primario→secundario) + nombre debajo
function ThemeCircle({ pal, active, selected, onSelect, onDelete, isNew, onNew, theme, disabled }) {
  if (isNew) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 68 }}>
        <button
          onClick={onNew}
          title="Crear nuevo estilo"
          style={{ width: 44, height: 44, borderRadius: 'var(--radius-full)', padding: 0, background: 'transparent', border: '2px dashed var(--color-border-variant)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}
        ><span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span></button>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.2 }}>Crear nuevo estilo</span>
      </div>
    )
  }
  const bgc = pal.background || (theme === 'dark' ? '#0D101D' : '#FAF8F4')
  const grad = `linear-gradient(135deg, ${pal.primary} 50%, ${pal.secondary || pal.primary} 50%)`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 68 }}>
      <div style={{ position: 'relative' }}>
        <button
          onClick={disabled ? undefined : onSelect}
          disabled={disabled}
          title={disabled ? 'No disponible mientras creas un estilo' : pal.name}
          style={{ width: 44, height: 44, borderRadius: 'var(--radius-full)', padding: 0, background: bgc, border: active ? '3px solid var(--color-primary)' : selected ? '2px dashed var(--color-primary)' : '2px solid var(--color-border)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: grad, display: 'block' }} />
        </button>
        {onDelete && (
          <span
            role="button"
            title="Eliminar tema"
            onClick={onDelete}
            style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, lineHeight: 1, color: 'var(--color-text-secondary)', cursor: 'pointer' }}
          >×</span>
        )}
      </div>
      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.2 }}>{pal.name}</span>
    </div>
  )
}

// Logo + favicon personalizados (por dispositivo, como los temas)
function BrandSection() {
  const [logo, setLogoState] = React.useState(getWebLogo)
  const [favicon, setFaviconState] = React.useState(getWebFavicon)
  const [msg, setMsg] = React.useState(null)
  const [showInfo, setShowInfo] = React.useState(false)
  const logoRef = React.useRef(null)
  const favRef = React.useRef(null)

  const upload = (kind) => (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) { setMsg({ type: 'error', text: 'Selecciona una imagen' }); return }
    const max = kind === 'logo' ? 280_000 : 64_000
    if (f.size > max) { setMsg({ type: 'error', text: `Imagen demasiado grande (máx ~${Math.round(max / 1000)}KB)` }); return }
    const reader = new FileReader()
    reader.onload = () => {
      if (kind === 'logo') { setWebLogo(reader.result); setLogoState(reader.result) }
      else { setWebFavicon(reader.result); applyWebFavicon(); setFaviconState(reader.result) }
      setMsg({ type: 'success', text: kind === 'logo' ? 'Logo actualizado' : 'Favicon actualizado' })
    }
    reader.readAsDataURL(f)
  }
  const clear = (kind) => {
    if (kind === 'logo') { setWebLogo(''); setLogoState('') }
    else { setWebFavicon(''); applyWebFavicon(); setFaviconState('') }
    setMsg(null)
  }

  // recuadro: título + botones arriba, imagen abajo dentro del recuadro
  const Box = ({ label, value, inputRef, onPick, onClear, hint }) => (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{hint}</div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input type="file" ref={inputRef} accept="image/*" style={{ display: 'none' }} onChange={onPick} />
          <button className="btn-app btn-app-secondary" onClick={() => inputRef.current?.click()}>Subir</button>
          {value && <button className="btn-app btn-app-secondary" onClick={onClear}>Quitar</button>}
        </div>
      </div>
      <div style={{ marginTop: 'auto', height: 110, borderRadius: 'var(--radius-sm)', border: value ? '1px solid var(--color-border)' : '1px dashed var(--color-border-variant)', background: value ? 'var(--color-surface)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {value
          ? <img src={value} alt={label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          : <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Sin imagen</span>}
      </div>
    </div>
  )

  return (
    <section style={{ marginBottom: 'var(--space-8)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <h2 className="section-heading" style={{ marginBottom: 0 }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 18 }}>brush</span>
          Logo y Favicon
        </h2>
        <button
          className="btn-app btn-app-secondary"
          style={{ padding: '2px 8px', fontSize: 12 }}
          onClick={() => setShowInfo(!showInfo)}
          aria-label="Qué son el logo y el favicon"
        ><span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span></button>
      </div>
      {showInfo && (
        <div className="card" style={{ marginBottom: 'var(--space-4)', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          El <strong style={{ color: 'var(--color-text-primary)' }}>logo</strong> sustituye el icono de «Cerebro» de arriba a la izquierda y el <strong style={{ color: 'var(--color-text-primary)' }}>favicon</strong> es el icono que se ve en la pestaña del navegador. Usa una imagen <strong style={{ color: 'var(--color-text-primary)' }}>cuadrada</strong> en PNG o SVG con fondo transparente: logo hasta ~280KB y favicon hasta ~64KB. Se guardan solo en este dispositivo.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-4)' }}>
        <Box label="Logo" value={logo} inputRef={logoRef} onPick={upload('logo')} onClear={() => clear('logo')} hint="Sustituye el icono de «Cerebro» arriba a la izquierda" />
        <Box label="Favicon" value={favicon} inputRef={favRef} onPick={upload('favicon')} onClear={() => clear('favicon')} hint="El icono de la pestaña del navegador" />
      </div>
      {msg && <MsgBox type={msg.type} message={msg.text} />}
    </section>
  )
}

// opción de color con prohibido cuando no combina (no se puede elegir)
function ColorOption({ hex, ok, active, onClick, title, round = true }) {
  return (
    <div style={{ position: 'relative', width: 34, height: 34 }}>
      <button
        onClick={ok ? onClick : undefined}
        disabled={!ok}
        title={title}
        style={{ width: 34, height: 34, borderRadius: round ? 'var(--radius-full)' : 'var(--radius-sm)', background: hex, cursor: ok ? 'pointer' : 'not-allowed', border: active ? '3px solid var(--color-text-primary)' : '2px solid var(--color-border)', padding: 0, opacity: ok ? 1 : 0.55 }}
      />
      {!ok && (
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: round ? '50%' : 'var(--radius-sm)', background: 'color-mix(in srgb, var(--color-bg) 55%, transparent)', pointerEvents: 'none' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-error)' }}>block</span>
        </span>
      )}
    </div>
  )
}

function WebThemeSection({ theme, onSetTheme }) {
  const [showInfo, setShowInfo] = React.useState(false)
  const [showFieldInfo, setShowFieldInfo] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [local, setLocalList] = React.useState(localPalettes())
  const [global, setGlobalList] = React.useState([])
  const [globalActive, setGlobalActive] = React.useState('')
  const [selected, setSelected] = React.useState(null) // preview: {kind:'user', pal} | {kind:'default', t}
  const [picked, setPicked] = React.useState(null) // {primary, secondary, background} del editor
  const [name, setName] = React.useState('')
  const [msg, setMsg] = React.useState(null)
  const [editThemes, setEditThemes] = React.useState(false) // modo editar: × de borrar + click = editar
  const [editPal, setEditPal] = React.useState(null) // tema que se está editando (precarga editor)

  // confirmaciones se auto-quitan a los 3s
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(cur => (cur && cur.text === m.text) ? null : cur), 3000) }

  React.useEffect(() => {
    const pal = localActivePal()
    if (pal) applyPalette(pal)
    fetch('/api/web/palettes').then(r => r.json()).then(d => {
      setGlobalList(d.palettes || [])
      setGlobalActive(d.active || '')
      if (d.active) {
        const p = (d.palettes || []).find(x => x.name === d.active)
        if (p) applyPalette(p)
      }
    }).catch(() => {})
  }, [])

  const defaultBg = theme === 'dark' ? '#0D101D' : '#FAF8F4'
  const editorBg = picked?.background || defaultBg

  // ponytail: preview en vivo — cada elección del editor se aplica al momento
  React.useEffect(() => {
    if (!editing || !picked) return
    if (picked.primary || picked.background) {
      applyPalette({ primary: picked.primary || undefined, secondary: picked.secondary || '', background: picked.background || '' })
    }
  }, [picked, editing])

  // vuelve al tema activo (y al claro/oscuro del estado de App) al salir del editor
  const restoreActive = () => {
    document.documentElement.dataset.theme = theme
    const act = localActivePal()
    if (act) { applyPalette(act); return }
    const g = (global || []).find(p => p.name === globalActive)
    if (g) { applyPalette(g); return }
    clearPalette()
  }

  const pickPrimary = (hex) => setPicked(p => ({ ...p, primary: hex }))
  const pickSecondary = (hex) => setPicked(p => ({ ...p, secondary: hex || '' }))
  const pickBackground = (hex) => setPicked(p => ({ ...p, background: hex }))

  const saveTheme = () => {
    if (!picked?.primary) { setMsg({ type: 'error', text: 'Elige un color primario' }); return }
    if (!picked?.background) { setMsg({ type: 'error', text: 'Elige un color de fondo — el tema es completo: fondo + colores' }); return }
    const pal = { name: name.trim() || 'Mi tema', primary: picked.primary, background: picked.background }
    if (picked.secondary) pal.secondary = picked.secondary
    saveLocalPalette(pal) // ponytail: mismo nombre = sobrescribe (editar)
    setLocalList(localPalettes())
    setEditing(false)
    setEditPal(null)
    restoreActive() // ponytail: sin esto, el preview del editor queda aplicado sin ningún tema activo
    setName('')
    setPicked(null)
    flash({ type: 'success', text: `Tema "${pal.name}" guardado. Click en él para aplicarlo.` })
  }

  // preview: se ve en vivo en la página (como antes) pero NO se aplica; al salir de Ajustes se restaura
  const previewDefault = (t) => {
    if (editing) return
    setSelected({ kind: 'default', t })
    document.documentElement.dataset.theme = t
    // ponytail: preview de default = tokens base; restoreActive() lo recupera al cancelar o salir
    clearPalette()
  }
  const previewUser = (p) => {
    if (editing) return
    setSelected({ kind: 'user', pal: p })
    applyPalette(p) // con fondo, ya sincroniza dataset.theme al modo
  }
  const cancelPreview = () => { restoreActive(); setSelected(null) }
  // al cambiar de pestaña (unmount de Ajustes) vuelve el tema aplicado
  const restoreRef = React.useRef(null)
  restoreRef.current = restoreActive
  React.useEffect(() => () => restoreRef.current?.(), [])

  const applyPreview = async (scope) => {
    const sel = selected
    if (!sel) return
    if (sel.kind === 'default') {
      onSetTheme(sel.t)
      document.documentElement.dataset.theme = sel.t
      if (localActivePal()) setLocalActive(null)
      if (globalActive) { fetch('/api/web/active', { method: 'DELETE' }).catch(() => {}); setGlobalActive('') }
      const nombre = sel.t === 'light' ? 'claro' : 'oscuro'
      flash({ type: 'success', text: scope === 'global' ? `Tema ${nombre} aplicado a todos los dispositivos` : `Tema ${nombre} aplicado a este dispositivo` })
    } else {
      const pal = sel.pal
      if (scope === 'global') {
        try {
          const res = await fetch('/api/web/palettes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...pal, activate: true }) })
          if (!res.ok) throw new Error('HTTP ' + res.status)
          const d = await res.json()
          setGlobalList(d.palettes || [])
          setGlobalActive(d.active || '')
        } catch (e) { setMsg({ type: 'error', text: 'Error: ' + e.message }); return }
      }
      setLocalActive(pal)
      // el tema de usuario es un tema completo: sincroniza el modo (claro/oscuro) con su fondo
      // ponytail: temas viejos guardados sin fondo no tocan el modo
      if (pal.background) onSetTheme(relLum(pal.background) > 0.5 ? 'light' : 'dark')
      flash({ type: 'success', text: scope === 'global' ? `Tema "${pal.name}" aplicado a todos los dispositivos` : `Tema "${pal.name}" aplicado a este dispositivo` })
    }
    setSelected(null)
  }

  const removeProfile = async (p, isGlobal) => {
    let freshActive = ''
    if (isGlobal) {
      try { await fetch('/api/web/palettes/' + encodeURIComponent(p.name), { method: 'DELETE' }) } catch { return }
      const d = await (await fetch('/api/web/palettes')).json()
      setGlobalList(d.palettes || [])
      setGlobalActive(d.active || '')
      freshActive = d.active || ''
    } else {
      deleteLocalPalette(p.name)
      setLocalList(localPalettes())
    }
    // re-aplicar el tema activo real (el borrado pudo ser el activo o dejar el preview del editor)
    document.documentElement.dataset.theme = theme
    const act = isGlobal ? (global || []).find(x => x.name === freshActive) : localActivePal()
    if (act) applyPalette(act)
    else if (freshActive) applyPalette((global || []).find(x => x.name === freshActive) || null)
    else clearPalette()
  }

  const userThemes = [...local.map(p => ({ ...p, _global: false })), ...global.filter(g => !local.some(l => l.name === g.name)).map(p => ({ ...p, _global: true }))]
  const isUserTheme = (p) => userThemes.some(u => u.name === p.name)
  const activeName = localActivePal()?.name || globalActive
  // exclusividad mutua: con un tema de usuario activo, los defaults quedan sin marcar
  const defaultActive = activeName ? '' : theme

  return (
    <section style={{ marginBottom: 'var(--space-8)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <h2 className="section-heading" style={{ marginBottom: 0 }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 18 }}>palette</span>
          Personalización de la Web
        </h2>
        <button
          className="btn-app btn-app-secondary"
          style={{ padding: '2px 8px', fontSize: 12 }}
          onClick={() => setShowInfo(!showInfo)}
          aria-label="Qué es la personalización de la web"
        ><span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span></button>
        <div style={{ flex: 1 }} />
        <button
          className={`btn-app ${editThemes ? 'btn-app-primary' : 'btn-app-secondary'}`}
          onClick={() => { setEditThemes(v => !v); setSelected(null); setMsg(editThemes ? null : { type: 'info', text: 'Modo edición: click en un tema para editarlo, × para borrarlo.' }) }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
          {editThemes ? 'Hecho' : 'Editar'}
        </button>
      </div>
      {showInfo && (
        <div className="card" style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-4)', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          Elige un tema para verlo en vista previa al instante y confírmalo con los botones de Aplicar (uno solo activo a la vez). Crea el tuyo con tus colores (tema completo: fondo + colores). En modo Editar puedes modificar o borrar tus temas. Los temas por defecto (claro/oscuro) no se pueden eliminar; los tuyos sí.
        </div>
      )}
      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
          {/* Tema por defecto (claro/oscuro) — visibles pero NO selecionables mientras se crea un estilo */}
          <div>
            <div className="label-caps" style={{ marginBottom: 'var(--space-2)' }}>TEMA POR DEFECTO</div>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              {/* colores reales de tokens.css: claro=verde, oscuro=sky+container azul */}
              <ThemeCircle pal={{ name: 'Tema claro', primary: '#1E6E52', secondary: '#1E6E52' }} theme="light" active={defaultActive === 'light'} selected={selected?.kind === 'default' && selected.t === 'light'} disabled={editing} onSelect={() => previewDefault('light')} />
              <ThemeCircle pal={{ name: 'Tema oscuro', primary: '#38BDF8', secondary: '#60A5FA' }} theme="dark" active={defaultActive === 'dark'} selected={selected?.kind === 'default' && selected.t === 'dark'} disabled={editing} onSelect={() => previewDefault('dark')} />
            </div>
          </div>
          {/* Temas creados por el usuario + crear nuevo */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="label-caps" style={{ marginBottom: 'var(--space-2)' }}>TEMAS DEL USUARIO</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              {userThemes.map(p => (
                <ThemeCircle key={(p._global ? 'g' : 'l') + p.name} pal={p} theme={theme} active={activeName === p.name} selected={selected?.kind === 'user' && selected.pal.name === p.name} onSelect={() => {
                  if (editThemes) {
                    setEditing(true); setEditPal(p); setSelected(null); setMsg(null)
                    setName(p.name)
                    setPicked({ primary: p.primary, secondary: p.secondary || '', background: p.background || '' })
                  } else previewUser(p)
                }} onDelete={editThemes ? () => removeProfile(p, p._global) : undefined} />
              ))}
              <ThemeCircle isNew onNew={() => { setEditing(true); setSelected(null); setPicked(null); setMsg(null) }} />
            </div>
          </div>
        </div>

        {selected && (() => {
          const nombre = selected.kind === 'user' ? selected.pal.name : (selected.t === 'light' ? 'claro' : 'oscuro')
          return (
            <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-surface-container)' }}>
              <div style={{ fontSize: 14, marginBottom: 'var(--space-3)' }}>
                Tema <strong style={{ color: 'var(--color-primary)' }}>{nombre}</strong> en vista previa — ¿dónde quieres aplicarlo?
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <button className="btn-app btn-app-primary" onClick={() => applyPreview('local')}>Aplicar a este dispositivo</button>
                <button className="btn-app btn-app-secondary" onClick={() => applyPreview('global')}>Aplicar a todos los dispositivos</button>
                <button className="btn-app btn-app-secondary" onClick={cancelPreview}>Cancelar</button>
              </div>
            </div>
          )
        })()}

        {editing && (
          <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-surface-container)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <div className="label-caps" style={{ margin: 0 }}>{editPal ? 'EDITAR TEMA' : 'NUEVO ESTILO'}</div>
              <button
                className="btn-app btn-app-secondary"
                style={{ padding: '2px 8px', fontSize: 12 }}
                onClick={() => setShowFieldInfo(!showFieldInfo)}
                aria-label="Qué cambia cada campo"
              ><span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span></button>
            </div>
            {showFieldInfo && (
              <div className="card" style={{ marginBottom: 'var(--space-4)', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                <div><strong style={{ color: 'var(--color-text-primary)' }}>Color del fondo</strong> — el color de la página. Elige entre los 4 fondos del sistema; si eliges uno oscuro la interfaz pasa a modo oscuro automáticamente (y viceversa).</div>
                <div style={{ marginTop: 4 }}><strong style={{ color: 'var(--color-text-primary)' }}>Color primario</strong> — botones, menú lateral, enlaces y acentos. Los colores que no contrastan con el fondo elegido aparecen bloqueados.</div>
                <div style={{ marginTop: 4 }}><strong style={{ color: 'var(--color-text-primary)' }}>Color secundario</strong> — acentos suaves: burbujas de iconos, badges y brillos. «Color primario» usa el mismo tono del primario; el resto solo combina si contrasta con el fondo y su tono se separa del primario.</div>
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <input className="input-app" placeholder="Nombre del tema" value={name} onChange={e => setName(e.target.value)} style={{ width: 180 }} />
              <button className="btn-app btn-app-primary" onClick={saveTheme} disabled={!picked?.primary || !picked?.background}>Guardar tema</button>
              <button className="btn-app btn-app-secondary" onClick={() => { setEditing(false); setPicked(null); setName(''); setEditPal(null); restoreActive() }}>Cancelar</button>
            </div>
            <div className="label-caps" style={{ marginBottom: 'var(--space-2)' }}>COLOR DEL FONDO</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>Estilo claro</div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  {BACKGROUNDS.filter(b => b.light).map(b => (
                    <ColorOption key={b.hex} hex={b.hex} ok active={picked?.background === b.hex} onClick={() => pickBackground(b.hex)} title={b.name} round={false} />
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>Estilo oscuro</div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  {BACKGROUNDS.filter(b => !b.light).map(b => (
                    <ColorOption key={b.hex} hex={b.hex} ok active={picked?.background === b.hex} onClick={() => pickBackground(b.hex)} title={b.name} round={false} />
                  ))}
                </div>
              </div>
            </div>
            <div className="label-caps" style={{ marginBottom: 'var(--space-2)' }}>COLOR PRIMARIO</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              {SWATCHES.map(hex => (
                <ColorOption key={hex} hex={hex} ok={primaryOk(hex, editorBg)} active={picked?.primary === hex} onClick={() => pickPrimary(hex)} title={hex} />
              ))}
            </div>
            <div className="label-caps" style={{ marginBottom: 'var(--space-2)' }}>COLOR SECUNDARIO</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
              {picked?.primary && (
                <button
                  className="btn-app btn-app-secondary"
                  style={{ padding: '6px 12px', fontSize: 12, border: !picked?.secondary ? '2px solid var(--color-primary)' : undefined }}
                  onClick={() => pickSecondary('')}
                  title="Toma el mismo color que el primario"
                >Color primario</button>
              )}
              {picked?.primary && [...SWATCHES, ...SECONDARY_NEUTRALS].map(hex => (
                <ColorOption key={hex} hex={hex} ok={secondaryOk(hex, picked.primary, editorBg)} active={picked?.secondary === hex} onClick={() => pickSecondary(hex)} title={hex} />
              ))}
              {!picked?.primary && <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Elige primero un color primario</span>}
            </div>
          </div>
        )}
        {msg && <MsgBox type={msg.type} message={msg.text} />}
      </div>
    </section>
  )
}

function MsgBox({ type, message }) {
  const color = type === 'success' ? 'var(--color-success)' : type === 'info' ? 'var(--color-primary)' : 'var(--color-error)'
  const bg = type === 'success' ? 'color-mix(in srgb, var(--color-success) 15%, transparent)' : type === 'info' ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'color-mix(in srgb, var(--color-error) 15%, transparent)'
  return (
    <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: bg, color, fontSize: 14 }}>
      {message}
    </div>
  )
}

function InfoRow({ label, value, mono, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) 0', borderBottom: last ? 'none' : '1px solid var(--color-surface)' }}>
      <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontFamily: mono ? 'var(--font-mono)' : 'inherit', fontSize: mono ? 13 : 14, color: mono ? 'var(--color-text-secondary)' : 'var(--color-text-primary)' }}>{value}</span>
    </div>
  )
}

function TunnelSection() {
  const [tunnelStatus, setTunnelStatus] = React.useState(null)
  const [showForm, setShowForm] = React.useState(false)
  const [token, setToken] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [msg, setMsg] = React.useState('')

  React.useEffect(() => {
    fetch('/api/tunnel/status').then(r => r.json()).then(setTunnelStatus).catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/tunnel/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudflareTunnelToken: token }),
      })
      const data = await res.json()
      if (data.success) {
        setTunnelStatus({ active: true, hasToken: true })
        setShowForm(false)
        setMsg('Túnel activado correctamente')
      } else {
        setMsg(data.message || 'Error al configurar')
      }
    } catch (e) {
      setMsg('Error: ' + e.message)
    }
    setSaving(false)
    setLoading(false)
  }

  const handleDeactivate = async () => {
    setSaving(true)
    setLoading(true)
    try {
      const res = await fetch('/api/tunnel/deactivate', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setTunnelStatus({ active: false, hasToken: false })
        setMsg('Túnel desactivado')
      }
    } catch (e) {
      setMsg('Error: ' + e.message)
    }
    setSaving(false)
    setLoading(false)
  }

  const active = tunnelStatus?.active
    const [showTunnelInfo, setShowTunnelInfo] = React.useState(false)

    return (
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <h2 className="section-heading" style={{ marginBottom: 0 }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 18 }}>cloud</span>
            Acceso Remoto
          </h2>
          <button
            className="btn-app btn-app-secondary"
            style={{ padding: '2px 8px', fontSize: 12 }}
            onClick={() => setShowTunnelInfo(!showTunnelInfo)}
            aria-label="Qué es el acceso remoto"
          ><span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span></button>
        </div>
        {showTunnelInfo && (
          <div className="card" style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-4)', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            El <strong style={{ color: 'var(--color-text-primary)' }}>túnel de Cloudflare</strong> publica este Cerebro en internet con una dirección segura, para usarlo desde fuera de casa. Sin túnel, solo se accede desde tu red local. Actívalo pegando el comando de Cloudflare Zero Trust y desactívalo cuando no lo necesites.
          </div>
        )}
      <div className="card" style={{ position: 'relative', minHeight: 80 }}>
        {loading && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 10,
            borderRadius: 'inherit'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{
                width: 32, height: 32, border: '3px solid color-mix(in srgb, var(--color-text-primary) 20%, transparent)',
                borderTopColor: 'var(--color-primary)', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
                {saving ? 'Configurando túnel...' : 'Desactivando túnel...'}
              </span>
            </div>
          </div>
        )}
        {active ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
              <span style={{ fontWeight: 600 }}>Túnel Activo</span>
              <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Cloudflare Tunnel conectado</span>
            </div>
            <button className="btn-app btn-app-danger" onClick={handleDeactivate} disabled={saving || loading}>
              {saving ? '...' : 'Desactivar'}
            </button>
          </div>
        ) : showForm ? (
          <div>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
              Pega el comando completo que te da la página de <a href="https://www.cloudflare.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>Cloudflare Zero Trust</a>. El sistema extraerá el token automáticamente.
            </p>
            <input
              className="input-app"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Pega aquí el comando de Cloudflare..."
              style={{ marginBottom: 'var(--space-3)' }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn-app btn-app-primary" onClick={handleSave} disabled={saving || loading || !token.trim()}>
                {saving ? 'Configurando...' : 'Activar Túnel'}
              </button>
              <button className="btn-app btn-app-secondary" onClick={() => setShowForm(false)} disabled={loading}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 600 }}>Sin túnel configurado</span>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Acceso solo en LAN. Activa un túnel para acceso remoto.</p>
            </div>
            <button className="btn-app btn-app-primary" onClick={() => setShowForm(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>cloud</span>
              Iniciar Túnel
            </button>
          </div>
        )}
        {msg && <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)', fontSize: 14 }}>{msg}</div>}
      </div>
    </section>
  )
}

export default AjustesView