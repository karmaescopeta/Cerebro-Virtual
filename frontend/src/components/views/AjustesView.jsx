import React, { useRef } from 'react'

function AjustesView({
  editAgentName, editPersonality, editingAgent, editSaving, editMessage, editMessageType,
  restarting, hermesKey, setHermesKey, keySaving, keyMessage, keyMessageType,
  agentKeys, systemInfo, status, vaultMessage, vaultMessageType, vaultImporting,
  onEdit, onCancelEdit, onSaveEdit, setEditAgentName, setEditPersonality, onRestart,
  onSaveKey, onDeleteKey, onExport, onImport, onReset,
}) {
  const importRef = useRef(null)

  return (
    <div>
      <h1 className="section-title">Ajustes</h1>
      <p className="section-subtitle">Configura los parámetros globales de tu segundo cerebro.</p>

      {/* Agente Principal */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 className="section-heading" style={{ marginBottom: 'var(--space-1)' }}>Agente Principal</h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Personalidad central del sistema.</p>
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
              <textarea className="input-app" rows={4} value={editPersonality} onChange={(e) => setEditPersonality(e.target.value)} style={{ resize: 'vertical', fontFamily: 'var(--font-body)' }} />
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-4)' }}>
            <div className="card">
              <div className="label-caps" style={{ marginBottom: 'var(--space-3)' }}>NOMBRE DEL AGENTE</div>
              <div style={{ fontSize: 16 }}>{editAgentName || 'Hermes'}</div>
            </div>
            <div className="card">
              <div className="label-caps" style={{ marginBottom: 'var(--space-3)' }}>PERSONALIDAD</div>
              <div style={{ fontSize: 14, fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
                {editPersonality ? (editPersonality.length > 100 ? editPersonality.slice(0, 100) + '...' : editPersonality) : '—'}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* APIs Agentes */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 className="section-heading">APIs Agentes</h2>
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-full)', background: 'var(--color-surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-surface-high)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 18 }}>terminal</span>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ fontWeight: 600 }}>{editAgentName || 'Hermes'}</span>
                {agentKeys.hermes?.configured && (
                  <span style={{ padding: '2px 8px', background: 'rgba(78,222,163,0.1)', color: 'var(--color-success)', borderRadius: 'var(--radius-sm)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid rgba(78,222,163,0.2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check</span> CONFIGURADA
                  </span>
                )}
              </div>
              <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>OpenRouter</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flex: 1, maxWidth: 500 }}>
            <input className="input-app" type="password" value={hermesKey} onChange={(e) => setHermesKey(e.target.value)} placeholder="sk-or-v1-..." style={{ fontFamily: 'var(--font-mono)' }} />
            <button className="btn-app btn-app-primary" onClick={onSaveKey} disabled={keySaving}>{keySaving ? '...' : 'Guardar'}</button>
            {agentKeys.hermes?.configured && <button className="btn-app btn-app-danger" onClick={onDeleteKey} disabled={keySaving}>Eliminar</button>}
          </div>
        </div>
        {keyMessage && <MsgBox type={keyMessageType} message={keyMessage} />}
      </section>

      {/* Vault */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 className="section-heading">Vault</h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>Gestiona persistencia y copias de seguridad.</p>
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <button className="btn-app btn-app-secondary" onClick={onExport}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span> Exportar
          </button>
          <input type="file" ref={importRef} style={{ display: 'none' }} accept=".tar.gz,.tgz,.tar" onChange={(e) => { if (e.target.files[0]) { onImport(e.target.files[0]); e.target.value = '' } }} />
          <button className="btn-app btn-app-success" onClick={() => importRef.current?.click()} disabled={vaultImporting}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload</span>
            {vaultImporting ? 'Importando...' : 'Importar'}
          </button>
        </div>
        {vaultMessage && <MsgBox type={vaultMessageType} message={vaultMessage} />}
      </section>

      {/* Estado del Sistema */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 className="section-heading">
          <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 18 }}>sensors</span>
          Estado del Sistema
        </h2>
        <div className="card">
          <InfoRow label="Agente" value={agentKeys.hermes?.configured ? 'Conectado' : 'Desconectado'} />
          <InfoRow label="API Key" value={agentKeys.hermes?.configured ? 'Configurada' : 'No configurada'} />
          <InfoRow label="Vault Path" value={status?.vault_path || '—'} mono />
          <InfoRow label="Versión" value={systemInfo?.version || '—'} mono last />
        </div>
      </section>

      {/* Canales */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 className="section-heading">Canales de Mensajería</h2>
        <div className="card">
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Vincula tu Cerebro Virtual con <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Telegram</span>,
            <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}> Discord</span> y
            <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}> WhatsApp</span> mediante el puente Hermes.
          </p>
          <div style={{ marginTop: 'var(--space-4)', textAlign: 'right' }}>
            <a href="http://localhost:8080" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              Ir al Panel de Hermes
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
            </a>
          </div>
        </div>
      </section>

      {/* Zona Peligrosa */}
      <section style={{ borderTop: '1px solid var(--color-surface-container)', paddingTop: 'var(--space-8)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: 0, top: 0, opacity: 0.05, pointerEvents: 'none' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 180, color: 'var(--color-error)' }}>warning</span>
        </div>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 600 }}>
          <h2 className="section-heading" style={{ color: 'var(--color-error)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>dangerous</span>
            Zona Peligrosa
          </h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-5)' }}>
            Restablecer borrará preferencias de API y conexiones. Tus datos del vault NO se pierden.
          </p>
          <button className="btn-app btn-app-danger" onClick={onReset}>
            Restablecer configuración
          </button>
        </div>
      </section>
    </div>
  )
}

function MsgBox({ type, message }) {
  const color = type === 'success' ? 'var(--color-success)' : type === 'info' ? 'var(--color-primary)' : 'var(--color-error)'
  const bg = type === 'success' ? 'rgba(78,222,163,0.15)' : type === 'info' ? 'rgba(173,198,255,0.15)' : 'rgba(255,180,171,0.15)'
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

export default AjustesView