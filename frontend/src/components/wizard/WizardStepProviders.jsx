import React, { useEffect, useState } from 'react'
import StepIndicator from './StepIndicator'
import WizardInfo from './WizardInfo'
import { containerUrl } from '../../lib/ports.js'

const PUESTOS = ['cerebro-default', 'cerebro-smart', 'cerebro-cerebro', 'cerebro-graphify', 'cerebro-investigador']

function WizardStepProviders({ formData, onNext, onBack }) {
  const [state, setState] = useState(null)
  const [newProvider, setNewProvider] = useState('')
  const [newKey, setNewKey] = useState('')
  const [addMsg, setAddMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // v1.6.3: registra la contraseña unificada y provisiona conexiones+combos YA (idempotente:
    // el 'Crear' final repite lo mismo). Así el usuario ve sus combos y puede añadir proveedores.
    fetch('/api/omni/preconfigure', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dashboardPassword: formData.dashboardPassword,
        apiKey: formData.apiKey,
        iaMode: formData.iaMode,
      }),
    }).catch(() => {})
    let tries = 0
    const load = async () => {
      tries++
      try {
        const r = await fetch('/api/omni/state')
        const d = await r.json()
        if (d.ready || tries > 15) { setState(d); clearInterval(t) }
      } catch { /* reintenta */ }
    }
    load()
    const t = setInterval(load, 2500)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addProvider = async () => {
    setBusy(true); setAddMsg('')
    try {
      const r = await fetch('/api/omni/providers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: newProvider.trim(), apiKey: newKey.trim() }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || 'Error')
      setAddMsg('✓ Conectado'); setNewProvider(''); setNewKey('')
      const s = await (await fetch('/api/omni/state')).json()
      if (s.ready) setState(s)
    } catch (e) { setAddMsg('✗ ' + e.message) } finally { setBusy(false) }
  }

  const byName = {}
  ;(state?.combos || []).forEach((c) => { byName[c.name] = c })

  return (
    <div className="wizard-root">
      <div className="wizard-progress-bar">
        <div className="wizard-progress-fill" style={{ width: '60%' }} />
      </div>
      <div className="wizard-card">
        <StepIndicator current={3} />

        <WizardInfo title="Proveedores de IA">
          Con la API Key del paso anterior ya está todo conectado. Estos son los 5 puestos de tu asistente — puedes añadir más proveedores ahora o en Ajustes.
        </WizardInfo>

        <div className="summary-box">
          <p className="form-hint-text" style={{ marginBottom: 'var(--space-2)' }}>
            Cada tarea de tu asistente usa un combo (equipo de modelos):
          </p>
          {!state && <p className="form-hint-text">Preparando OmniRoute…</p>}
          {state && !state.ready && (
            <p className="form-hint-text">
              OmniRoute se configurará con tu contraseña al pulsar Crear.
            </p>
          )}
          {state?.ready && PUESTOS.map((n) => {
            const c = byName[n]
            return (
              <div key={n} className="summary-row" style={{ padding: 'var(--space-2) 0' }}>
                <span className="summary-label">{n}</span>
                <span
                  className="summary-value"
                  style={{
                    flex: 1, justifyContent: 'flex-end', textAlign: 'right', fontSize: 13,
                    color: c ? 'inherit' : 'var(--color-text-tertiary)',
                  }}
                >
                  {c
                    ? (c.models[0] || '') + (c.models.length > 1 ? ` (+${c.models.length - 1})` : '')
                    : 'pendiente'}
                </span>
              </div>
            )
          })}
          {state?.ready && (
            <p className="form-hint-text" style={{ marginTop: 'var(--space-2)' }}>
              Proveedores conectados:{' '}
              {state.providers.length
                ? state.providers.map((p) => p.provider).join(', ')
                : 'ninguno todavía'}
            </p>
          )}
        </div>

        <div className="wizard-form" style={{ marginTop: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label">
              Añadir proveedor{' '}
              <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(opcional)</span>
            </label>
            <div className="form-row">
              <input
                type="text"
                className="form-input"
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
                placeholder="groq, openai, together…"
              />
              <input
                type="password"
                className="form-input"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="API key"
              />
            </div>
            {addMsg && <span className="form-hint-text">{addMsg}</span>}
            <button
              className="btn btn-secondary"
              style={{ marginTop: 'var(--space-2)' }}
              disabled={busy || !newProvider.trim() || !newKey.trim()}
              onClick={addProvider}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_link</span>
              Conectar proveedor
            </button>
          </div>
        </div>

        <div className="form-hint" style={{ marginTop: 'var(--space-3)' }}>
          <span className="material-symbols-outlined">settings</span>
          <p>
            Ajuste fino en el <strong>panel de OmniRoute</strong> — entra con el usuario y la contraseña de este wizard.
          </p>
        </div>

        <div className="btn-actions">
          <button className="btn btn-secondary" onClick={onBack}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Atrás
          </button>
          <button className="btn btn-secondary" onClick={async () => { window.open(await containerUrl('omniroute', 20128), '_blank') }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span>
            Abrir panel de OmniRoute
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onNext}>
            Siguiente
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default WizardStepProviders