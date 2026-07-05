import React, { useState, useEffect } from 'react'
import './SetupWizard.css'

function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [installLog, setInstallLog] = useState([])
  const [errors, setErrors] = useState({})

  const [modelType, setModelType] = useState(null) // 'openrouter' | 'local'

  const [formData, setFormData] = useState({
    agentName: 'Hermes',
    personality:
      'Eres un asistente útil, amigable y profesional. Ayudas a organizar el conocimiento y responder preguntas de manera clara y concisa.',
    apiKey: '',
    channels: { telegram: false, whatsapp: false, discord: false },
    dashboardUser: '',
    dashboardPassword: '',
  })

  const [hardware, setHardware] = useState({
    cpu: 'Intel i5',
    ram_gb: 16,
    gpu: 'Sin GPU',
    vram_gb: 0,
  })

  useEffect(() => {
    // Verificamos si ya hay configuración existente (solo informativo)
    fetch('/api/init/status')
      .then((r) => r.json())
      .catch(() => {})
  }, [])

  const updateForm = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }))

  const updateHardware = (field, value) =>
    setHardware((prev) => ({ ...prev, [field]: value }))

  const validateStep2 = () => {
    const newErrors = {}
    if (!formData.agentName.trim()) newErrors.agentName = 'El nombre del agente es obligatorio'
    if (!formData.personality.trim()) newErrors.personality = 'La personalidad es obligatoria'
    if (modelType === 'openrouter' && !formData.apiKey.trim()) {
      newErrors.apiKey = 'La API Key de OpenRouter es obligatoria'
    }
    if (formData.dashboardUser.trim() && formData.dashboardPassword.length < 4) {
      newErrors.dashboardPassword = 'La contraseña debe tener al menos 4 caracteres'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNextFromStep1 = (type) => {
    setModelType(type)
    setErrors({})
    setStep(2)
  }

  const handleNextFromStep2 = () => {
    if (!validateStep2()) return
    setStep(3)
  }

  const handleBack = () => {
    if (step === 2) setStep(1)
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
      // 1. Configurar
      log('⚙️ Guardando configuración del agente...')
      const configureBody = {
        agentName: formData.agentName,
        personality: formData.personality,
        channels: formData.channels,
        dashboardUser: formData.dashboardUser,
        dashboardPassword: formData.dashboardPassword,
      }
      if (modelType === 'openrouter') {
        configureBody.apiKey = formData.apiKey
      } else {
        configureBody.modelType = 'local'
      }

      const configureRes = await fetch('/api/init/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configureBody),
      })
      const configureData = await configureRes.json()

      if (!configureData.success) {
        throw new Error(configureData.message || 'Error al guardar la configuración')
      }
      log('✅ Configuración guardada correctamente')

      // 2. Si es local: hardware + instalar modelos
      if (modelType === 'local') {
        log('🖥️ Enviando perfil de hardware...')
        const hwRes = await fetch('/api/init/hardware', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(hardware),
        })
        const hwData = await hwRes.json()
        if (!hwRes.ok) {
          throw new Error(hwData.message || 'Error al enviar el hardware')
        }
        log('✅ Hardware registrado')

        if (hwData.recommended_models && hwData.recommended_models.length > 0) {
          log(`📦 Modelos recomendados: ${hwData.recommended_models.join(', ')}`)
        }

        log('⏳ Instalando modelos de Ollama (esto puede tardar varios minutos)...')
        const installRes = await fetch('/api/init/install-models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            models: hwData.recommended_models || [],
          }),
        })
        const installData = await installRes.json()
        if (!installRes.ok) {
          throw new Error(installData.message || 'Error al instalar los modelos')
        }
        log('✅ Modelos instalados correctamente')
      }

      // 3. Arrancar agente
      log('🚀 Iniciando el agente...')
      try {
        await fetch('/api/agent/start', { method: 'POST' })
        log('✅ Agente iniciado')
      } catch {
        log('⚠️ No se pudo arrancar el agente automáticamente (puedes iniciarlo luego)')
      }

      log('🎉 ¡Cerebro virtual creado con éxito!')
      // Pequeña pausa para que el usuario vea el resultado
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
    <div className="channels-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.5rem' }}>
      {[1, 2, 3].map((s) => (
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
            {step > s ? '✅' : s}
          </span>
          <span className="channel-name">
            {s === 1 ? 'Tipo' : s === 2 ? 'Configuración' : 'Confirmar'}
          </span>
        </div>
      ))}
    </div>
  )

  // =================== STEP 1: Tipo de modelo ===================
  if (step === 1) {
    return (
      <div className="wizard-container">
        <div className="wizard-box form-box">
          <div className="wizard-header">
            <span className="wizard-icon-small">🧠</span>
            <h1>Crear Cerebro Virtual</h1>
            <p>Paso 1 de 3 — Elige cómo quieres ejecutar tu agente.</p>
          </div>

          <StepIndicator />

          <div className="channels-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div
              className="channel-card"
              style={{ padding: '1.5rem 1rem', textAlign: 'center' }}
              onClick={() => handleNextFromStep1('openrouter')}
            >
              <span className="channel-emoji" style={{ fontSize: '2rem' }}>☁️</span>
              <span className="channel-name" style={{ fontSize: '1rem', fontWeight: 600, color: '#e5e7eb' }}>
                OpenRouter (Nube)
              </span>
              <span className="form-note" style={{ display: 'block', marginTop: '0.5rem' }}>
                Modelos en la nube. Rápido, sin requisitos de hardware.
              </span>
            </div>
            <div
              className="channel-card"
              style={{ padding: '1.5rem 1rem', textAlign: 'center' }}
              onClick={() => handleNextFromStep1('local')}
            >
              <span className="channel-emoji" style={{ fontSize: '2rem' }}>🖥️</span>
              <span className="channel-name" style={{ fontSize: '1rem', fontWeight: 600, color: '#e5e7eb' }}>
                Local (Ollama)
              </span>
              <span className="form-note" style={{ display: 'block', marginTop: '0.5rem' }}>
                Modelos locales con Ollama. Privado, sin dependencia de internet.
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =================== STEP 2: Formulario ===================
  if (step === 2) {
    const selectStyle = {
      width: '100%',
      padding: '0.625rem 0.75rem',
      background: '#0a0a0a',
      border: '1px solid #1f2937',
      borderRadius: '6px',
      color: '#e5e7eb',
      fontSize: '0.875rem',
      fontFamily: 'inherit',
    }

    return (
      <div className="wizard-container">
        <div className="wizard-box form-box">
          <div className="wizard-header">
            <span className="wizard-icon-small">🧠</span>
            <h1>Configuración del Agente</h1>
            <p>
              Paso 2 de 3 —{' '}
              {modelType === 'openrouter' ? 'OpenRouter (Nube)' : 'Local (Ollama)'}
            </p>
          </div>

          <StepIndicator />

          <div className="wizard-form">
            {/* API Key solo para OpenRouter */}
            {modelType === 'openrouter' && (
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
                    <p className="info-small">También puedes usar cualquier API key compatible con OpenAI.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Nombre del agente */}
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

            {/* Personalidad */}
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

            {/* Hardware solo para local */}
            {modelType === 'local' && (
              <div
                className="form-group"
                style={{ borderTop: '1px solid #1f2937', paddingTop: '1rem', marginTop: '0.5rem' }}
              >
                <label>🖥️ Hardware del equipo</label>
                <p className="form-sub-label">
                  Esta información se usa para recomendar los mejores modelos para tu máquina.
                </p>

                <label style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#9ca3af' }}>
                  CPU
                </label>
                <select
                  style={selectStyle}
                  value={hardware.cpu}
                  onChange={(e) => updateHardware('cpu', e.target.value)}
                >
                  <optgroup label="Intel">
                    <option value="Intel i3">Intel i3</option>
                    <option value="Intel i5">Intel i5</option>
                    <option value="Intel i7">Intel i7</option>
                    <option value="Intel i9">Intel i9</option>
                  </optgroup>
                  <optgroup label="AMD Ryzen">
                    <option value="AMD Ryzen 3">AMD Ryzen 3</option>
                    <option value="AMD Ryzen 5">AMD Ryzen 5</option>
                    <option value="AMD Ryzen 7">AMD Ryzen 7</option>
                    <option value="AMD Ryzen 9">AMD Ryzen 9</option>
                  </optgroup>
                </select>

                <label style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#9ca3af' }}>
                  RAM
                </label>
                <select
                  style={selectStyle}
                  value={hardware.ram_gb}
                  onChange={(e) => updateHardware('ram_gb', parseInt(e.target.value, 10))}
                >
                  <option value={8}>8 GB</option>
                  <option value={16}>16 GB</option>
                  <option value={32}>32 GB</option>
                  <option value={64}>64 GB</option>
                </select>

                <label style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#9ca3af' }}>
                  GPU
                </label>
                <select
                  style={selectStyle}
                  value={hardware.gpu}
                  onChange={(e) => updateHardware('gpu', e.target.value)}
                >
                  <option value="Sin GPU">Sin GPU</option>
                  <option value="NVIDIA 4GB">NVIDIA 4GB</option>
                  <option value="NVIDIA 8GB">NVIDIA 8GB</option>
                  <option value="NVIDIA 12GB+">NVIDIA 12GB+</option>
                  <option value="AMD">AMD</option>
                </select>

                <label style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#9ca3af' }}>
                  VRAM
                </label>
                <select
                  style={selectStyle}
                  value={hardware.vram_gb}
                  onChange={(e) => updateHardware('vram_gb', parseInt(e.target.value, 10))}
                >
                  <option value={0}>0 GB</option>
                  <option value={4}>4 GB</option>
                  <option value={8}>8 GB</option>
                  <option value={12}>12 GB</option>
                  <option value={16}>16 GB</option>
                </select>
              </div>
            )}

            {/* Credenciales del dashboard */}
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
            <p>Paso 3 de 3 — Revisa la configuración antes de crear tu cerebro virtual.</p>
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
              <SummaryRow label="Tipo de modelo" value={modelType === 'openrouter' ? '☁️ OpenRouter (Nube)' : '🖥️ Local (Ollama)'} />
              {modelType === 'openrouter' && (
                <SummaryRow label="API Key" value={formData.apiKey ? '••••••••' + formData.apiKey.slice(-4) : '—'} />
              )}
              <SummaryRow label="Nombre del agente" value={formData.agentName} />
              <SummaryRow
                label="Personalidad"
                value={formData.personality.length > 80 ? formData.personality.substring(0, 80) + '...' : formData.personality}
              />
              {modelType === 'local' && (
                <>
                  <SummaryRow label="CPU" value={hardware.cpu} />
                  <SummaryRow label="RAM" value={`${hardware.ram_gb} GB`} />
                  <SummaryRow label="GPU" value={hardware.gpu} />
                  <SummaryRow label="VRAM" value={`${hardware.vram_gb} GB`} />
                </>
              )}
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

  // Fallback (no debería llegar aquí)
  return (
    <div className="wizard-container">
      <div className="wizard-box welcome-box">
        <div className="wizard-icon">🧠</div>
        <h1>Cerebro Virtual</h1>
        <button className="btn-primary btn-large" onClick={() => setStep(1)}>
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
