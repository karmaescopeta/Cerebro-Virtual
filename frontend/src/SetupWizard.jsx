import React, { useState, useEffect } from 'react'
import './SetupWizard.css'

function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(2) // ponytail: skip step 1, only openrouter
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [installLog, setInstallLog] = useState([])
  const [errors, setErrors] = useState({})

  const [formData, setFormData] = useState({
    agentName: 'Hermes',
    personality:
      'Eres un asistente útil, amigable y profesional. Ayudas a organizar el conocimiento y responder preguntas de manera clara y concisa.',
    apiKey: '',
    channels: { telegram: false, whatsapp: false, discord: false },
    telegramToken: '',
    discordToken: '',
    whatsappPhone: '',
    dashboardUser: '',
    dashboardPassword: '',
  })

  useEffect(() => {
    fetch('/api/init/status')
      .then((r) => r.json())
      .catch(() => {})
  }, [])

  const updateForm = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }))

  const validateStep2 = () => {
    const newErrors = {}
    if (!formData.agentName.trim()) newErrors.agentName = 'El nombre del agente es obligatorio'
    if (!formData.personality.trim()) newErrors.personality = 'La personalidad es obligatoria'
    if (!formData.apiKey.trim()) {
      newErrors.apiKey = 'La API Key de OpenRouter es obligatoria'
    }
    if (formData.dashboardUser.trim() && formData.dashboardPassword.length < 4) {
      newErrors.dashboardPassword = 'La contraseña debe tener al menos 4 caracteres'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNextFromStep2 = () => {
    if (!validateStep2()) return
    setStep(3)
  }

  const handleBack = () => {
    if (step === 3) setStep(2)
  }

  // ---- Instalación final ----
  const handleCreate = async () => {
    setLoading(true)
    setInstallLog([])
    const log = (msg) => {
      setInstallLog((prev) => [...prev, msg])
      setStatusMessage(msg)
    }

    try {
      log('⚙️ Guardando configuración del agente...')
      const configureRes = await fetch('/api/init/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: formData.agentName,
          personality: formData.personality,
          apiKey: formData.apiKey,
          modelMode: 'openrouter',
          channels: formData.channels,
          dashboardUser: formData.dashboardUser,
          dashboardPassword: formData.dashboardPassword,
          telegramToken: formData.telegramToken,
          discordToken: formData.discordToken,
          whatsappPhone: formData.whatsappPhone,
        }),
      })
      const configureData = await configureRes.json()

      if (!configureData.success) {
        throw new Error(configureData.message || 'Error al guardar la configuración')
      }
      log('✅ Configuración guardada correctamente')

      log('🚀 Iniciando el agente...')
      try {
        await fetch('/api/agent/start', { method: 'POST' })
        log('✅ Agente iniciado')
      } catch {
        log('⚠️ No se pudo arrancar el agente automáticamente (puedes iniciarlo luego)')
      }

      log('🎉 ¡Cerebro virtual creado con éxito!')
      setTimeout(() => {
        onComplete()
      }, 1500)
    } catch (error) {
      console.error('Error en la instalación:', error)
      log('❌ Error: ' + error.message)
      setLoading(false)
    }
  }

  // =================== STEP INDICATOR ===================
  const StepIndicator = () => (
    <div className="channels-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '1.5rem' }}>
      {[2, 3].map((s) => (
        <div
          key={s}
          className="channel-card"
          style={{
            cursor: 'default',
            borderColor: step >= s ? '#3b82f6' : '#1f2937',
            background: step >= s ? 'rgba(59, 130, 246, 0.1)' : '#0a0a0a',
            opacity: step >= s ? 1 : 0.5,
            padding: '0.6rem 0.5rem',
          }}
        >
          <span className="channel-emoji" style={{ fontSize: '1.2rem' }}>
            {step > s ? '✅' : s - 1}
          </span>
          <span className="channel-name">
            {s === 2 ? 'Configuración' : 'Confirmar'}
          </span>
        </div>
      ))}
    </div>
  )

  // =================== STEP 2: Formulario ===================
  if (step === 2) {
    return (
      <div className="wizard-container">
        <div className="wizard-box form-box">
          <div className="wizard-header">
            <span className="wizard-icon-small">🧠</span>
            <h1>Configuración del Agente</h1>
            <p>Paso 1 de 2 — OpenRouter (Nube)</p>
          </div>

          <StepIndicator />

          <div className="wizard-form">
            <div className="form-group">
              <label>🔑 API Key de OpenRouter</label>
              <input
                type="password"
                value={formData.apiKey}
                onChange={(e) => updateForm('apiKey', e.target.value)}
                placeholder="sk-or-v1-..."
                className={errors.apiKey ? 'error' : ''}
              />
              {errors.apiKey && <span className="form-error">{errors.apiKey}</span>}
              <div className="form-info-box">
                <span className="info-icon">ℹ️</span>
                <div>
                  <p>
                    Obtén tu API key en{' '}
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
                      OpenRouter
                    </a>
                  </p>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>📝 Nombre del agente</label>
              <input
                type="text"
                value={formData.agentName}
                onChange={(e) => updateForm('agentName', e.target.value)}
                placeholder="Ej: Hermes, Athena, etc."
                className={errors.agentName ? 'error' : ''}
              />
              {errors.agentName && <span className="form-error">{errors.agentName}</span>}
            </div>

            <div className="form-group">
              <label>🧬 Personalidad</label>
              <textarea
                value={formData.personality}
                onChange={(e) => updateForm('personality', e.target.value)}
                placeholder="Describe la personalidad de tu agente..."
                rows={4}
                className={errors.personality ? 'error' : ''}
              />
              {errors.personality && <span className="form-error">{errors.personality}</span>}
            </div>

            <div
              className="form-group"
              style={{ borderTop: '1px solid #1f2937', paddingTop: '1rem', marginTop: '0.5rem' }}
            >
              <label>🔒 Credenciales del Dashboard</label>
              <p className="form-sub-label">
                Protege el acceso al dashboard. Deja en blanco para acceso público (solo localhost).
              </p>
              <input
                type="text"
                value={formData.dashboardUser}
                onChange={(e) => updateForm('dashboardUser', e.target.value)}
                placeholder="Usuario (ej: admin)"
                style={{ marginBottom: '0.5rem', marginTop: '0.5rem' }}
              />
              <input
                type="password"
                value={formData.dashboardPassword}
                onChange={(e) => updateForm('dashboardPassword', e.target.value)}
                placeholder="Contraseña (mínimo 4 caracteres)"
                className={errors.dashboardPassword ? 'error' : ''}
              />
              {errors.dashboardPassword && (
                <span className="form-error">{errors.dashboardPassword}</span>
              )}
            </div>

            {/* Canales de mensajería */}
            <div
              className="form-group"
              style={{ borderTop: '1px solid #1f2937', paddingTop: '1rem', marginTop: '0.5rem' }}
            >
              <label>📡 Canales de mensajería (opcional)</label>
              <p className="form-sub-label">
                Conecta tu agente a otras plataformas. Deja en blanco si solo quieres la web.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={formData.channels.telegram}
                  onChange={(e) => updateForm('channels', { ...formData.channels, telegram: e.target.checked })}
                />
                <span style={{ fontSize: '0.875rem', color: '#e5e7eb' }}>Telegram</span>
              </div>
              {formData.channels.telegram && (
                <input
                  type="text"
                  value={formData.telegramToken}
                  onChange={(e) => updateForm('telegramToken', e.target.value)}
                  placeholder="Token del bot (BotFather)"
                  style={{ width: '100%', padding: '0.5rem 0.75rem', background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: '6px', color: '#e5e7eb', fontSize: '0.875rem', marginTop: '0.25rem' }}
                />
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={formData.channels.discord}
                  onChange={(e) => updateForm('channels', { ...formData.channels, discord: e.target.checked })}
                />
                <span style={{ fontSize: '0.875rem', color: '#e5e7eb' }}>Discord</span>
              </div>
              {formData.channels.discord && (
                <input
                  type="text"
                  value={formData.discordToken}
                  onChange={(e) => updateForm('discordToken', e.target.value)}
                  placeholder="Token del bot (Discord Developer Portal)"
                  style={{ width: '100%', padding: '0.5rem 0.75rem', background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: '6px', color: '#e5e7eb', fontSize: '0.875rem', marginTop: '0.25rem' }}
                />
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={formData.channels.whatsapp}
                  onChange={(e) => updateForm('channels', { ...formData.channels, whatsapp: e.target.checked })}
                />
                <span style={{ fontSize: '0.875rem', color: '#e5e7eb' }}>WhatsApp</span>
              </div>
              {formData.channels.whatsapp && (
                <input
                  type="text"
                  value={formData.whatsappPhone}
                  onChange={(e) => updateForm('whatsappPhone', e.target.value)}
                  placeholder="Número de teléfono (ej: +34 600 000 000)"
                  style={{ width: '100%', padding: '0.5rem 0.75rem', background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: '6px', color: '#e5e7eb', fontSize: '0.875rem', marginTop: '0.25rem' }}
                />
              )}
            </div>

            <div className="form-actions" style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn-primary btn-submit"
                onClick={handleNextFromStep2}
                disabled={loading}
                style={{ flex: 1 }}
              >
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =================== STEP 3: Resumen + Crear ===================
  if (step === 3) {
    return (
      <div className="wizard-container">
        <div className="wizard-box form-box">
          <div className="wizard-header">
            <span className="wizard-icon-small">🧠</span>
            <h1>Confirmar y Crear</h1>
            <p>Paso 2 de 2 — Revisa la configuración antes de crear tu cerebro virtual.</p>
          </div>

          <StepIndicator />

          <div className="wizard-form">
            <div
              style={{
                background: '#0a0a0a',
                border: '1px solid #1f2937',
                borderRadius: '8px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
              }}
            >
              <SummaryRow label="Tipo de modelo" value="☁️ OpenRouter" />
              <SummaryRow label="API Key" value={formData.apiKey ? '••••••••' + formData.apiKey.slice(-4) : '—'} />
              <SummaryRow label="Nombre del agente" value={formData.agentName} />
              <SummaryRow
                label="Personalidad"
                value={formData.personality.length > 80 ? formData.personality.substring(0, 80) + '...' : formData.personality}
              />
              <SummaryRow
                label="Dashboard"
                value={formData.dashboardUser ? `${formData.dashboardUser} (protegido)` : 'Público (localhost)'}
              />
            </div>

            {installLog.length > 0 && (
              <div
                style={{
                  background: '#0a0a0a',
                  border: '1px solid #1f2937',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginTop: '0.5rem',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: '#9ca3af',
                }}
              >
                {installLog.map((line, i) => (
                  <div key={i} style={{ marginBottom: '0.25rem' }}>
                    {line}
                  </div>
                ))}
              </div>
            )}

            {loading && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 0.75rem' }}></div>
                <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>{statusMessage}</p>
              </div>
            )}

            <div className="form-actions" style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn-secondary"
                onClick={handleBack}
                disabled={loading}
                style={{ flex: '0 0 auto' }}
              >
                ← Atrás
              </button>
              <button
                className="btn-primary btn-submit"
                onClick={handleCreate}
                disabled={loading}
                style={{ flex: 1 }}
              >
                {loading ? '⏳ Creando...' : '🧠 Crear cerebro virtual'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Fallback
  return (
    <div className="wizard-container">
      <div className="wizard-box welcome-box">
        <div className="wizard-icon">🧠</div>
        <h1>Cerebro Virtual</h1>
        <button className="btn-primary btn-large" onClick={() => setStep(2)}>
          🚀 Comenzar
        </button>
      </div>
    </div>
  )
}

// Helper component para filas del resumen
function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
      <span style={{ color: '#6b7280', fontSize: '0.8125rem', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#e5e7eb', fontSize: '0.875rem', textAlign: 'right', wordBreak: 'break-word' }}>
        {value}
      </span>
    </div>
  )
}

export default SetupWizard
