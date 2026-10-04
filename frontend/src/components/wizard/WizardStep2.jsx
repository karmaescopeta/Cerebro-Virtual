import React from 'react'
import StepIndicator from './StepIndicator'
import WizardInfo from './WizardInfo'

const LOG_ICON = {
  run: 'progress_activity',
  ok: 'check_circle',
  warn: 'warning',
  err: 'warning',
}

const IA_LABEL = {
  local: { icon: 'lock', text: 'En tu máquina (Ollama)' },
  cloud: { icon: 'cloud', text: 'En la nube (OpenRouter)' },
  both: { icon: 'swap_horiz', text: 'Local + nube' },
}

function WizardStep2({ formData, installLog, loading, statusMessage, onBack, onCreate }) {
  const maskKey = formData.apiKey ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' + formData.apiKey.slice(-4) : '\u2014'
  const ia = IA_LABEL[formData.iaMode] || IA_LABEL.both

  return (
    <div className="wizard-root">
      <div className="wizard-progress-bar">
        <div className="wizard-progress-fill" style={{ width: '80%' }} />
      </div>
      <div className="wizard-card">
        <StepIndicator current={4} />

        <WizardInfo title="Tu Cerebro, así">
          Comprueba que todo está como quieres. Al pulsar el botón se crea tu asistente.
        </WizardInfo>

        <div className="summary-box">
          <div className="summary-row">
            <span className="summary-label">Inteligencia</span>
            <span className="summary-value">
              <span className="material-symbols-outlined">{ia.icon}</span>
              {ia.text}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">API Key</span>
            <span className="summary-value">{maskKey}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Nombre</span>
            <span className="summary-value">{formData.agentName}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Personalidad</span>
            <span className="summary-value" style={{ textAlign: 'right', maxWidth: 240 }}>
              {formData.personality.length > 80 ? formData.personality.substring(0, 80) + '...' : formData.personality}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Panel</span>
            <span className="summary-value">
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-success)' }}>lock</span>
              {formData.dashboardUser ? `${formData.dashboardUser} (protegido)` : 'Abierto solo en tu red local'}
            </span>
          </div>
        </div>

        {installLog.length > 0 && (
          <>
            <div className="terminal-header">
              <span className="terminal-header-label">INSTALACIÓN EN CURSO</span>
              <div className="terminal-dots">
                <div className="terminal-dot" style={{ background: 'color-mix(in srgb, var(--color-error) 40%, transparent)' }} />
                <div className="terminal-dot" style={{ background: 'var(--color-surface-high)' }} />
                <div className="terminal-dot" style={{ background: 'color-mix(in srgb, var(--color-success) 40%, transparent)' }} />
              </div>
            </div>
            <div className="terminal" role="log" aria-live="polite">
              {installLog.map((line, i) => (
                <div key={i} className={`terminal-line ${line.status || 'ok'}`}>
                  <span className="material-symbols-outlined">{LOG_ICON[line.status] || LOG_ICON.ok}</span>
                  <span>{line.text}</span>
                </div>
              ))}
              {loading && (
                <div className="terminal-line">
                  <span className="cursor">_</span>
                </div>
              )}
            </div>
          </>
        )}

        {loading && statusMessage && (
          <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
              <div className="spinner" />
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>{statusMessage}</span>
            </div>
          </div>
        )}

        <div className="btn-actions">
          <button className="btn btn-secondary" onClick={onBack} disabled={loading}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Atrás
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onCreate} disabled={loading}>
            {loading ? (
              <>
                <div className="spinner" />
                Dándole vida...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>psychology</span>
                Crear mi Cerebro Virtual
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default WizardStep2
