import React from 'react'
import StepIndicator from './StepIndicator'

const IA_LABEL = {
  local: 'En tu máquina (Ollama)',
  cloud: 'En la nube (OpenRouter)',
  both: 'Local + nube',
}

function WizardStep3({ formData, onComplete }) {
  return (
    <div className="wizard-root">
      <div className="wizard-progress-bar">
        <div className="wizard-progress-fill" style={{ width: '100%' }} />
      </div>
      <div className="wizard-card completion-screen">
        <StepIndicator current={5} />

        <div className="completion-icon-wrapper">
          <div className="completion-icon-glow" />
          <span className="material-symbols-outlined completion-icon">check_circle</span>
        </div>

        <h2 className="completion-title">¡Tu Cerebro está vivo!</h2>
        <p className="completion-text">
          Ya puedes hablar con él. Todo se puede cambiar después en Ajustes.
        </p>

        <div className="completion-info">
          <div className="completion-info-row">
            <span className="label">Agente</span>
            <span className="value">{formData.agentName}</span>
          </div>
          <div className="completion-info-row">
            <span className="label">Inteligencia</span>
            <span className="value">{IA_LABEL[formData.iaMode] || IA_LABEL.both}</span>
          </div>
          <div className="completion-info-row">
            <span className="label">Panel</span>
            <span className="value">
              {formData.dashboardUser ? `${formData.dashboardUser} (protegido)` : 'Abierto solo en tu red local'}
            </span>
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={onComplete}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>dashboard</span>
          Entrar a mi Cerebro
        </button>
      </div>
    </div>
  )
}

export default WizardStep3