import React from 'react'
import StepIndicator from './StepIndicator'
import WizardInfo from './WizardInfo'

function WizardStep1({ formData, errors, updateForm, onNext, onBack, onBlurField }) {
  return (
    <div className="wizard-root">
      <div className="wizard-progress-bar">
        <div className="wizard-progress-fill" style={{ width: '40%' }} />
      </div>
      <div className="wizard-card">
        <StepIndicator current={2} />

        <WizardInfo title="Conecta tu agente">
          La API Key conecta tu asistente con la nube y se guarda solo en tu PC. El usuario y contraseña son para entrar al panel.
        </WizardInfo>

        <div className="wizard-form">
          <div className="form-group">
            <label className="form-label">
              OpenRouter API Key <span className="required">*</span>
            </label>
            <input
              type="password"
              className={`form-input ${errors.apiKey ? 'error' : ''}`}
              value={formData.apiKey}
              onChange={(e) => updateForm('apiKey', e.target.value)}
              onBlur={() => onBlurField('apiKey')}
              placeholder="sk-or-v1-..."
            />
            {errors.apiKey && <span className="form-error">{errors.apiKey}</span>}
            <div className="form-hint">
              <span className="material-symbols-outlined">info</span>
              <p>Es la llave que conecta con la nube. Créala gratis en <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">openrouter.ai/keys</a> y pégala aquí.</p>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Acceso desde fuera <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(opcional)</span></label>
            <input
              type="text"
              className="form-input"
              value={formData.cloudflareTunnelToken || ''}
              onChange={(e) => updateForm('cloudflareTunnelToken', e.target.value)}
              placeholder="Comando de Cloudflare Tunnel"
            />
            <div className="form-hint">
              <span className="material-symbols-outlined">cloud</span>
              <p>Si lo abrirás desde fuera de casa: crea un túnel gratis en <a href="https://one.dash.cloudflare.com/" target="_blank" rel="noopener noreferrer">Cloudflare Zero Trust</a> y pega aquí el comando que te dé.</p>
            </div>
          </div>

          <div className="form-divider">
            <span className="form-divider-label">TU CUENTA</span>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Usuario</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.dashboardUser}
                  onChange={(e) => updateForm('dashboardUser', e.target.value)}
                  placeholder="admin"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <input
                  type="password"
                  className={`form-input ${errors.dashboardPassword ? 'error' : ''}`}
                  value={formData.dashboardPassword}
                  onChange={(e) => updateForm('dashboardPassword', e.target.value)}
                  onBlur={() => onBlurField('dashboardPassword')}
                  placeholder="••••••••"
                />
                {errors.dashboardPassword && <span className="form-error">{errors.dashboardPassword}</span>}
              </div>
            </div>
            <p className="form-hint-text">Con esto entras al panel.</p>
          </div>
        </div>

        <div className="btn-actions">
          <button className="btn btn-secondary" onClick={onBack}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Atrás
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

export default WizardStep1
