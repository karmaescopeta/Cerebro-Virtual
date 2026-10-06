import React from 'react'
import StepIndicator from './StepIndicator'
import WizardInfo from './WizardInfo'
import { containerUrl } from '../../lib/ports.js'

const COMBOS = [
  { name: 'chat-default', what: 'Hablar contigo' },
  { name: 'chat-smart', what: 'Pensar más a fondo' },
  { name: 'cerebro', what: 'Leer tus documentos' },
  { name: 'graphify', what: 'Hacer los mapas de conocimiento' },
  { name: 'investigador', what: 'Buscar en internet' },
]

function WizardStepProviders({ onNext, onBack }) {
  return (
    <div className="wizard-root">
      <div className="wizard-progress-bar">
        <div className="wizard-progress-fill" style={{ width: '60%' }} />
      </div>
      <div className="wizard-card">
        <StepIndicator current={3} />

        <WizardInfo title="Proveedores de IA">
          Opcional: el asistente ya funciona con la API Key. Aquí puedes darle más modelos.
        </WizardInfo>

        <div className="summary-box">
          <p className="form-hint-text" style={{ marginBottom: 'var(--space-2)' }}>
            Cada tarea de tu asistente usa un modelo. Estos son sus 5 puestos:
          </p>
          {COMBOS.map((c) => (
            <div key={c.name} className="summary-row" style={{ padding: 'var(--space-2) 0' }}>
              <span className="summary-label">{c.name}</span>
              <span className="summary-value" style={{ flex: 1, justifyContent: 'flex-end', textAlign: 'right', fontSize: 13 }}>{c.what}</span>
            </div>
          ))}
        </div>

        <div className="form-hint" style={{ marginTop: 'var(--space-4)' }}>
          <span className="material-symbols-outlined">settings</span>
          <p>
            ¿Más modelos? Entra en el <strong>panel de OmniRoute</strong>, añade tus proveedores con su API key y elige quién hace cada tarea. Puede ser después, en Ajustes.
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