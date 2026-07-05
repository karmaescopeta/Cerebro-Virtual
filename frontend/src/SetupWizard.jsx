import React, { useState, useEffect } from 'react'
import './SetupWizard.css'

function SetupWizard({ onComplete }) {
  const [step, setStep] = useState('welcome')
  const [hasExistingConfig, setHasExistingConfig] = useState(false)
  const [existingConfig, setExistingConfig] = useState(null)
  const [formData, setFormData] = useState({
    agentName: 'Hermes',
    personality: 'Eres un asistente útil, amigable y profesional. Ayudas a organizar el conocimiento y responder preguntas de manera clara y concisa.',
    apiKey: '',
    channels: {
      telegram: false,
      whatsapp: false,
      discord: false
    },
    dashboardUser: '',
    dashboardPassword: ''
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    checkExistingConfig()
  }, [])

  const checkExistingConfig = async () => {
    try {
      const res = await fetch('/api/init/status')
      const data = await res.json()
      
      if (data.hasConfig) {
        setHasExistingConfig(true)
        const configRes = await fetch('/api/init/config')
        const configData = await configRes.json()
        setExistingConfig(configData)
        setFormData({
          agentName: configData.agentName || 'Hermes',
          personality: configData.personality || '',
          apiKey: '',
          channels: configData.channels || { telegram: false, whatsapp: false, discord: false },
          dashboardUser: configData.dashboardUser || '',
          dashboardPassword: ''
        })
      }
    } catch (error) {
      console.error('Error checking config:', error)
    }
  }

  const handleChannelToggle = (channel) => {
    setFormData(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channel]: !prev.channels[channel]
      }
    }))
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.apiKey.trim()) {
      newErrors.apiKey = 'La API Key es obligatoria'
    }
    if (formData.dashboardUser.trim() && formData.dashboardPassword.length < 4) {
      newErrors.dashboardPassword = 'La contraseña debe tener al menos 4 caracteres'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setLoading(true)
    setStep('loading')
    setStatusMessage('Guardando configuración...')

    try {
      const res = await fetch('/api/init/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await res.json()

      if (data.success) {
        setStatusMessage('✅ Configuración guardada. Iniciando el agente...')
        // Llamamos a onComplete inmediatamente para que App maneje el inicio
        onComplete()
      } else {
        setStatusMessage('❌ Error: ' + (data.message || 'desconocido'))
        setStep('form')
        setLoading(false)
      }
    } catch (error) {
      console.error('Error guardando configuración:', error)
      setStatusMessage('❌ Error al conectar con el servidor')
      setStep('form')
      setLoading(false)
    }
  }

  const handleUseExisting = () => {
    setHasExistingConfig(false)
    setStep('form')
  }

  const handleCreateNew = () => {
    setHasExistingConfig(false)
    setFormData({
      agentName: 'Hermes',
      personality: 'Eres un asistente útil, amigable y profesional. Ayudas a organizar el conocimiento y responder preguntas de manera clara y concisa.',
      apiKey: '',
      channels: { telegram: false, whatsapp: false, discord: false },
      dashboardUser: '',
      dashboardPassword: ''
    })
    setStep('form')
  }

  const handleReset = () => {
    if (window.confirm('⚠️ ¿Estás seguro de que quieres eliminar toda la configuración del agente?')) {
      fetch('/api/init/reset', { method: 'DELETE' })
        .then(() => {
          setHasExistingConfig(false)
          setExistingConfig(null)
          setFormData({
            agentName: 'Hermes',
            personality: 'Eres un asistente útil, amigable y profesional. Ayudas a organizar el conocimiento y responder preguntas de manera clara y concisa.',
            apiKey: '',
            channels: { telegram: false, whatsapp: false, discord: false },
            dashboardUser: '',
            dashboardPassword: ''
          })
          setStep('form')
        })
        .catch(err => console.error('Error reseteando:', err))
    }
  }

  // Pantalla de bienvenida
  if (step === 'welcome') {
    return (
      <div className="wizard-container">
        <div className="wizard-box welcome-box">
          <div className="wizard-icon">🧠</div>
          <h1>Bienvenido a tu Cerebro Virtual</h1>
          <p>Configura tu asistente personal para empezar a organizar todo tu conocimiento.</p>
          
          {hasExistingConfig && (
            <div className="existing-config-notice">
              <p>📌 Se ha encontrado una configuración previa.</p>
              <div className="btn-group">
                <button className="btn-primary" onClick={handleUseExisting}>
                  📂 Usar configuración existente
                </button>
                <button className="btn-secondary" onClick={handleCreateNew}>
                  🔄 Crear nueva configuración
                </button>
              </div>
            </div>
          )}
          
          {!hasExistingConfig && (
            <button className="btn-primary btn-large" onClick={() => setStep('form')}>
              🚀 Comenzar configuración
            </button>
          )}
        </div>
      </div>
    )
  }

  // Pantalla de carga (dentro del wizard)
  if (step === 'loading') {
    return (
      <div className="wizard-container">
        <div className="wizard-box loading-box">
          <div className="spinner"></div>
          <h2>Configurando el agente...</h2>
          <p>{statusMessage}</p>
          <div className="loading-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '100%', animation: 'pulse 1.5s ease-in-out infinite' }}></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Formulario
  return (
    <div className="wizard-container">
      <div className="wizard-box form-box">
        <div className="wizard-header">
          <span className="wizard-icon-small">🧠</span>
          <h1>Configuración del Agente</h1>
          <p>Completa estos datos para crear tu asistente personal.</p>
        </div>

        <div className="wizard-form">
          <div className="form-group">
            <label>📝 Nombre del agente</label>
            <input
              type="text"
              value={formData.agentName}
              onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
              placeholder="Ej: Hermes, Athena, etc."
            />
            <span className="form-note">ℹ️ Si lo dejas en blanco, se llamará "Hermes".</span>
          </div>

          <div className="form-group">
            <label>🧬 Personalidad</label>
            <textarea
              value={formData.personality}
              onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
              placeholder="Describe aquí la personalidad de tu agente. Ej: Eres un asistente útil, amigable..."
              rows={4}
            />
            <span className="form-note">ℹ️ Describe la personalidad, no instrucciones de formato.</span>
          </div>

          <div className="form-group">
            <label>🔑 API Key / LLM</label>
            <input
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="sk-or-v1-... o tu API key de otro proveedor"
              className={errors.apiKey ? 'error' : ''}
            />
            {errors.apiKey && <span className="form-error">{errors.apiKey}</span>}
            <div className="form-info-box">
              <span className="info-icon">ℹ️</span>
              <div>
                <p>Obtén tu API key en <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">OpenRouter</a></p>
                <p className="info-small">También puedes usar cualquier API key compatible con OpenAI.</p>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>📡 Canales a activar</label>
            <p className="form-sub-label">Marca los canales que quieras usar. (Web siempre activo)</p>
            <div className="channels-grid">
              <div 
                className={`channel-card ${formData.channels.telegram ? 'active' : ''}`}
                onClick={() => handleChannelToggle('telegram')}
              >
                <span className="channel-emoji">📱</span>
                <span className="channel-name">Telegram</span>
              </div>
              <div 
                className={`channel-card ${formData.channels.whatsapp ? 'active' : ''}`}
                onClick={() => handleChannelToggle('whatsapp')}
              >
                <span className="channel-emoji">💬</span>
                <span className="channel-name">WhatsApp</span>
              </div>
              <div 
                className={`channel-card ${formData.channels.discord ? 'active' : ''}`}
                onClick={() => handleChannelToggle('discord')}
              >
                <span className="channel-emoji">🎮</span>
                <span className="channel-name">Discord</span>
              </div>
            </div>
            <span className="form-note">
              ⚠️ Si no marcas ninguno, puedes añadirlos luego desde <strong>Ajustes avanzados</strong>.
            </span>
          </div>

          {/* 🔒 NUEVA SECCIÓN: Autenticación del Dashboard */}
          <div className="form-group" style={{ borderTop: '1px solid #1f2937', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <label>🔒 Autenticación del Dashboard (opcional)</label>
            <p className="form-sub-label">
              Deja en blanco para acceso público (solo en localhost).
              Si configuras usuario y contraseña, se pedirán al acceder a <strong>http://localhost:8080</strong>.
            </p>
            <input
              type="text"
              value={formData.dashboardUser}
              onChange={(e) => setFormData({ ...formData, dashboardUser: e.target.value })}
              placeholder="Usuario (ej: admin)"
              style={{ marginBottom: '0.5rem' }}
            />
            <input
              type="password"
              value={formData.dashboardPassword}
              onChange={(e) => setFormData({ ...formData, dashboardPassword: e.target.value })}
              placeholder="Contraseña (mínimo 4 caracteres)"
              className={errors.dashboardPassword ? 'error' : ''}
            />
            {errors.dashboardPassword && <span className="form-error">{errors.dashboardPassword}</span>}
            <span className="form-note">
              ℹ️ Si proporcionas usuario y contraseña, el dashboard estará protegido.
            </span>
          </div>

          <div className="form-actions">
            <button className="btn-primary btn-submit" onClick={handleSubmit} disabled={loading}>
              {loading ? '⏳ Guardando...' : '🚀 Guardar y configurar agente'}
            </button>
          </div>

          {existingConfig && (
            <div className="form-footer">
              <button className="btn-link" onClick={handleReset}>
                🗑️ Eliminar configuración existente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SetupWizard