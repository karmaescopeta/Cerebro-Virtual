import React from 'react'
import StepIndicator from './StepIndicator'

function WizardStep3({ formData, onComplete }) {
  return (
    <div className="wizard-root">
      <div className="wizard-progress-bar">
        <div className="wizard-progress-fill" style={{ width: '100%' }} />
      </div>
      <div className="wizard-card completion-screen">
        <StepIndicator current={3} />

        <div className="completion-icon-wrapper">
          <div className="completion-icon-glow" />
          <span className="material-symbols-outlined completion-icon">check_circle</span>
        </div>

        <h2 className="completion-title">¡Todo listo!</h2>
        <p className="completion-text">
          Tu Cerebro Virtual está configurado y listo para usarse.
        </p>

        <div className="completion-info">
          <div className="completion-info-row">
            <span className="label">AGENTE</span>
            <span className="value">{formData.agentName}</span>
          </div>
          <div className="completion-info-row">
            <span className="label">MODELO</span>
            <span className="value">OpenRouter (Cloud)</span>
          </div>
          <div className="completion-info-row">
            <span className="label">DASHBOARD</span>
            <span className="value">
              {formData.dashboardUser ? `${formData.dashboardUser} (protegido)` : 'Público'}
            </span>
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={onComplete}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>dashboard</span>
          IR AL DASHBOARD
        </button>
      </div>
    </div>
  )
}

export default WizardStep3
