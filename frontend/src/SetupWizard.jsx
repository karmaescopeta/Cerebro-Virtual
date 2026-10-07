import React, { useState, useEffect } from 'react'
import './components/wizard/wizard.css'
import WelcomeScreen from './components/wizard/WelcomeScreen'
import WizardStepIdentity from './components/wizard/WizardStepIdentity'
import WizardStep1 from './components/wizard/WizardStep1'
import WizardStepProviders from './components/wizard/WizardStepProviders'
import WizardStep2 from './components/wizard/WizardStep2'
import WizardStep3 from './components/wizard/WizardStep3'

const DEFAULT_MODELS = {
  'chat-default': 'combo/cerebro-default',
  'chat-smart': 'combo/cerebro-smart',
  'cerebro': 'combo/cerebro-cerebro',
  'investigador': 'combo/cerebro-smart',
  'graphify': 'combo/cerebro-graphify',
}

function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0) // 0=welcome, 1=identidad, 2=conexión, 3=inteligencia, 4=confirmar, 5=listo
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [installLog, setInstallLog] = useState([])
  const [errors, setErrors] = useState({})

  const [formData, setFormData] = useState({
    agentName: 'Hermes',
    avatar: '',
    personality:
      'Eres un asistente de IA técnico y preciso. Respondes con claridad, priorizando el código, la arquitectura de sistemas y la resolución de problemas estructurada.',
    apiKey: '',
    cloudflareTunnelToken: '',
    channels: { telegram: false, whatsapp: false, discord: false },
    telegramToken: '',
    discordToken: '',
    whatsappPhone: '',
    dashboardUser: '',
    dashboardPassword: '',
    models: { ...DEFAULT_MODELS },
    iaMode: 'both',
    localModels: [],
  })

  // ponytail: el wizard siempre en oscuro (primera impresión); restauramos el tema al salir
  useEffect(() => {
    const html = document.documentElement
    const prev = html.dataset.theme
    html.dataset.theme = 'dark'
    return () => { html.dataset.theme = prev }
  }, [])

  useEffect(() => {
    fetch('/api/init/status').then((r) => r.json()).catch(() => {})
  }, [])

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  const validators = {
    agentName: () => (formData.agentName.trim() ? '' : 'Ponle un nombre'),
    personality: () => (formData.personality.trim() ? '' : 'Escoge una personalidad o escríbela'),
    apiKey: () => (formData.apiKey.trim() ? '' : 'Pega aquí tu API Key'),
    dashboardPassword: () => (formData.dashboardUser.trim() && formData.dashboardPassword.length < 4 ? 'Mínimo 4 caracteres' : ''),
  }
  const validateField = (field) => (validators[field] ? validators[field]() : '')
  const onBlurField = (field) => {
    const m = validateField(field)
    setErrors((prev) => ({ ...prev, [field]: m || undefined }))
  }

  const validate = (fields) => {
    const e = {}
    ;(fields || Object.keys(validators)).forEach((k) => { const m = validateField(k); if (m) e[k] = m })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleCreate = async () => {
    setLoading(true)
    setInstallLog([])
    const log = (text, status = 'ok') => {
      setInstallLog((prev) => [...prev, { text, status }])
      setStatusMessage(text)
    }

    try {
      log('Guardando la configuración de tu agente...', 'run')
      const configureRes = await fetch('/api/init/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: formData.agentName,
          personality: formData.personality,
          apiKey: formData.apiKey,
          cloudflareTunnelToken: formData.cloudflareTunnelToken,
          modelMode: 'openrouter',
          channels: formData.channels,
          dashboardUser: formData.dashboardUser,
          dashboardPassword: formData.dashboardPassword,
          telegramToken: formData.telegramToken,
          discordToken: formData.discordToken,
          whatsappPhone: formData.whatsappPhone,
          models: formData.models,
          iaMode: formData.iaMode,
        }),
      })
      const configureData = await configureRes.json()

      if (!configureData.success)
        throw new Error(configureData.message || 'Error al guardar la configuración')

      log('Configuración guardada', 'ok')

      if (formData.avatar) {
        log('Guardando la imagen de tu agente...', 'run')
        try {
          const avatarRes = await fetch('/api/agent/avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatar: formData.avatar }),
          })
          if (!avatarRes.ok) throw new Error('HTTP ' + avatarRes.status)
          log('Imagen guardada', 'ok')
        } catch {
          log('No se pudo guardar la imagen: tu Cerebro seguirá funcionando sin ella.', 'warn')
        }
      }

      log('Arrancando tu agente...', 'run')

      try {
        await fetch('/api/agent/start', { method: 'POST' })
        log('Agente en marcha', 'ok')
      } catch {
        log('No se pudo arrancar el agente automáticamente: puedes iniciarlo desde el panel.', 'warn')
      }

      log('¡Tu Cerebro Virtual está listo!', 'ok')
      setLoading(false)
      setStep(5)
    } catch (error) {
      console.error('Error en la instalación:', error)
      log('Algo ha fallado: ' + error.message, 'err')
      setLoading(false)
    }
  }

  // --- Step routing ---
  if (step === 0)
    return <WelcomeScreen onStart={() => setStep(1)} />

  if (step === 1)
    return (
      <WizardStepIdentity
        formData={formData}
        errors={errors}
        updateForm={updateForm}
        onBlurField={onBlurField}
        onNext={() => validate(['agentName', 'personality']) && setStep(2)}
      />
    )

  if (step === 2)
    return (
      <WizardStep1
        formData={formData}
        errors={errors}
        updateForm={updateForm}
        onBlurField={onBlurField}
        onBack={() => setStep(1)}
        onNext={() => validate(['apiKey', 'dashboardPassword']) && setStep(3)}
      />
    )

  if (step === 3)
    return (
      <WizardStepProviders
        formData={formData}
        onBack={() => setStep(2)}
        onNext={() => setStep(4)}
      />
    )

  if (step === 4)
    return (
      <WizardStep2
        formData={formData}
        installLog={installLog}
        loading={loading}
        statusMessage={statusMessage}
        onBack={() => setStep(3)}
        onCreate={handleCreate}
      />
    )

  if (step === 5)
    return <WizardStep3 formData={formData} onComplete={onComplete} />

  return null
}

export default SetupWizard
