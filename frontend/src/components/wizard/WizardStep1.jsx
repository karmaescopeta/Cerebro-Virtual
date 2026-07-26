import React from 'react'
import StepIndicator from './StepIndicator'

function WizardStep1({ formData, errors, updateForm, onNext }) {
  return (
    <div className="wizard-root">
      <div className="wizard-progress-bar">
        <div className="wizard-progress-fill" style={{ width: '33%' }} />
      </div>
      <div className="wizard-card">
        <StepIndicator current={1} />

        <h2 className="wizard-title">Inicialización del Sistema</h2>
        <p className="wizard-subtitle">Configure los parámetros base para activar la instancia de Cerebro.</p>

        <div className="wizard-form">
          {/* API Key */}
          <div className="form-group">
            <label className="form-label">
              OpenRouter API Key <span className="required">*</span>
            </label>
            <input
              type="password"
              className={`form-input ${errors.apiKey ? 'error' : ''}`}
              value={formData.apiKey}
              onChange={(e) => updateForm('apiKey', e.target.value)}
              placeholder="sk-or-v1-..."
            />
            {errors.apiKey && <span className="form-error">{errors.apiKey}</span>}
            <div className="form-hint">
              <span className="material-symbols-outlined">info</span>
              <p>Obtén tu API key en <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">OpenRouter</a>. Se almacena localmente.</p>
            </div>
          </div>

          {/* Agent Name */}
          <div className="form-group">
            <label className="form-label">Nombre del Agente</label>
            <input
              type="text"
              className={`form-input ${errors.agentName ? 'error' : ''}`}
              value={formData.agentName}
              onChange={(e) => updateForm('agentName', e.target.value)}
              placeholder="Hermes"
            />
            {errors.agentName && <span className="form-error">{errors.agentName}</span>}
          </div>

          {/* Personality */}
          <div className="form-group">
            <label className="form-label">Directiva de Personalidad</label>
            <textarea
              className="form-textarea"
              value={formData.personality}
              onChange={(e) => updateForm('personality', e.target.value)}
              placeholder="Describe la personalidad de tu agente..."
              rows={4}
            />
            {errors.personality && <span className="form-error">{errors.personality}</span>}
          </div>

          {/* Dashboard Credentials */}
          <div className="form-divider">
            <span className="form-divider-label">CREDENCIALES DE ACCESO</span>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Usuario <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.dashboardUser}
                  onChange={(e) => updateForm('dashboardUser', e.target.value)}
                  placeholder="admin"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña <span className="required">*</span></label>
                <input
                  type="password"
                  className={`form-input ${errors.dashboardPassword ? 'error' : ''}`}
                  value={formData.dashboardPassword}
                  onChange={(e) => updateForm('dashboardPassword', e.target.value)}
                  placeholder="••••••••"
                />
                {errors.dashboardPassword && <span className="form-error">{errors.dashboardPassword}</span>}
              </div>
            </div>
          </div>

          {/* Channels */}
          <div className="form-divider">
            <span className="form-divider-label">CANALES (OPCIONAL)</span>
            <div className="channel-toggle">
              <input
                type="checkbox"
                id="ch-telegram"
                checked={formData.channels.telegram}
                onChange={(e) => updateForm('channels', { ...formData.channels, telegram: e.target.checked })}
              />
              <label htmlFor="ch-telegram">Telegram</label>
            </div>
            {formData.channels.telegram && (
              <input
                type="text"
                className="form-input"
                style={{ marginTop: 'var(--space-2)' }}
                value={formData.telegramToken}
                onChange={(e) => updateForm('telegramToken', e.target.value)}
                placeholder="Token del bot (BotFather)"
              />
            )}
            <div className="channel-toggle">
              <input
                type="checkbox"
                id="ch-discord"
                checked={formData.channels.discord}
                onChange={(e) => updateForm('channels', { ...formData.channels, discord: e.target.checked })}
              />
              <label htmlFor="ch-discord">Discord</label>
            </div>
            {formData.channels.discord && (
              <input
                type="text"
                className="form-input"
                style={{ marginTop: 'var(--space-2)' }}
                value={formData.discordToken}
                onChange={(e) => updateForm('discordToken', e.target.value)}
                placeholder="Token del bot (Discord Developer Portal)"
              />
            )}
            <div className="channel-toggle">
              <input
                type="checkbox"
                id="ch-whatsapp"
                checked={formData.channels.whatsapp}
                onChange={(e) => updateForm('channels', { ...formData.channels, whatsapp: e.target.checked })}
              />
              <label htmlFor="ch-whatsapp">WhatsApp</label>
            </div>
            {formData.channels.whatsapp && (
              <input
                type="text"
                className="form-input"
                style={{ marginTop: 'var(--space-2)' }}
                value={formData.whatsappPhone}
                onChange={(e) => updateForm('whatsappPhone', e.target.value)}
                placeholder="Número de teléfono (ej: +34 600 000 000)"
              />
            )}
          </div>
        </div>

        <div className="btn-actions">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onNext}>
            SIGUIENTE
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default WizardStep1
