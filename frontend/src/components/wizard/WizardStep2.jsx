import React from 'react'
import StepIndicator from './StepIndicator'

function WizardStep2({ formData, installLog, loading, statusMessage, onBack, onCreate }) {
  const maskKey = formData.apiKey ? '••••••••' + formData.apiKey.slice(-4) : '—'

  return (
    <div className="wizard-root">
      <div className="wizard-progress-bar">
        <div className="wizard-progress-fill" style={{ width: '66%' }} />
      </div>
      <div className="wizard-card">
        <StepIndicator current={2} />

        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <h2 className="wizard-title">Resumen de Instalación</h2>
          <p className="wizard-subtitle" style={{ marginBottom: 0 }}>
            Verifica los parámetros antes de desplegar el agente.
          </p>
        </div>

        {/* Summary */}
        <div className="summary-box">
          <div className="summary-row">
            <span className="summary-label">MODELO</span>
            <span className="summary-value">
              <span className="material-symbols-outlined">cloud</span>
              OpenRouter
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">API KEY</span>
            <span className="summary-value">{maskKey}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">NOMBRE</span>
            <span className="summary-value">{formData.agentName}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">PERSONALIDAD</span>
            <span className="summary-value" style={{ textAlign: 'right', maxWidth: 240 }}>
              {formData.personality.length > 80 ? formData.personality.substring(0, 80) + '...' : formData.personality}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">DASHBOARD</span>
            <span className="summary-value">
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-success)' }}>lock</span>
              {formData.dashboardUser ? `${formData.dashboardUser} (protegido)` : 'Público (localhost)'}
            </span>
          </div>
        </div>

        {/* Terminal logs */}
        {installLog.length > 0 && (
          <>
            <div className="terminal-header">
              <span className="terminal-header-label">LOGS DE PREPARACIÓN</span>
              <div className="terminal-dots">
                <div className="terminal-dot" style={{ background: 'rgba(255, 180, 171, 0.4)' }} />
                <div className="terminal-dot" style={{ background: 'var(--color-surface-high)' }} />
                <div className="terminal-dot" style={{ background: 'rgba(78, 222, 163, 0.4)' }} />
              </div>
            </div>
            <div className="terminal">
              {installLog.map((line, i) => (
                <div key={i} className={`terminal-line ${line.includes('✅') || line.includes('🎉') ? 'success' : ''}`}>
                  {line}
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

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
              <div className="spinner" />
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>{statusMessage}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="btn-actions">
          <button className="btn btn-secondary" onClick={onBack} disabled={loading}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            ATRÁS
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onCreate} disabled={loading}>
            {loading ? (
              <>
                <div className="spinner" />
                DESPLEGANDO...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>psychology</span>
                CREAR CEREBRO VIRTUAL
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default WizardStep2
