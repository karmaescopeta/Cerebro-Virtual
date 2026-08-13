import React from 'react'
import StepIndicator from './StepIndicator'

const DEFAULT_MODELS = {
  coordinador: 'deepseek/deepseek-v4-flash',
  editor: 'deepseek/deepseek-v4-flash',
  indexador: 'deepseek/deepseek-v4-flash',
  sintetizador: 'deepseek/deepseek-v4-flash',
  investigador: 'deepseek/deepseek-v4-flash',
  graphify: 'google/gemma-4-26b-a4b-it:free',
}

const PROFILE_LABELS = [
  { key: 'coordinador', label: 'Sistema Base' },
  { key: 'editor', label: 'Editor' },
  { key: 'indexador', label: 'Indexador' },
  { key: 'sintetizador', label: 'Sintetizador' },
  { key: 'investigador', label: 'Investigador' },
  { key: 'graphify', label: 'Graphify (Neuronas)' },
]

function WizardStepModels({ formData, updateForm, onBack, onNext }) {
  const models = formData.models || DEFAULT_MODELS
  const allFilled = PROFILE_LABELS.every((p) => (models[p.key] || '').trim())

  const updateModel = (key, value) =>
    updateForm('models', { ...models, [key]: value })

  const fillDefaults = () =>
    updateForm('models', { ...DEFAULT_MODELS })

  return (
    <div className="wizard-root">
      <div className="wizard-progress-bar">
        <div className="wizard-progress-fill" style={{ width: '50%' }} />
      </div>
      <div className="wizard-card">
        <StepIndicator current={2} />

        <h2 className="wizard-title">Asignación de Modelos</h2>
        <p className="wizard-subtitle">
          Define el modelo de OpenRouter para cada perfil del sistema.
        </p>

        <div className="form-hint" style={{ marginBottom: 'var(--space-5)' }}>
          <span className="material-symbols-outlined">info</span>
          <p>
            Introduce la URL del modelo tal como aparece en{' '}
            <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer">OpenRouter</a>.
            Ejemplo: <code style={{ color: 'var(--color-primary)' }}>deepseek/deepseek-v4-flash</code>
          </p>
        </div>

        <div className="wizard-form">
          {PROFILE_LABELS.map((p) => (
            <div key={p.key} className="form-group">
              <label className="form-label">{p.label}</label>
              <input
                type="text"
                className="form-input"
                value={models[p.key] || ''}
                onChange={(e) => updateModel(p.key, e.target.value)}
                placeholder="proveedor/modelo"
              />
            </div>
          ))}
        </div>

        <div className="btn-actions">
          <button className="btn btn-secondary" onClick={onBack}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            ATRÁS
          </button>
          <button className="btn btn-secondary" onClick={fillDefaults}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
            MODELOS POR DEFECTO
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={onNext}
            disabled={!allFilled}
          >
            SIGUIENTE
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default WizardStepModels