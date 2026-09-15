import React, { useState, useEffect } from 'react'
import './components/wizard/wizard.css'
import WelcomeScreen from './components/wizard/WelcomeScreen'
import WizardStep1 from './components/wizard/WizardStep1'
import WizardStepModels from './components/wizard/WizardStepModels'
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
  const [step, setStep] = useState(0) // 0=welcome, 1=config, 2=models, 3=confirm, 4=done
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [installLog, setInstallLog] = useState([])
  const [errors, setErrors] = useState({})

  const [formData, setFormData] = useState({
    agentName: 'Hermes',
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

  useEffect(() => {
    fetch('/api/init/status').then((r) => r.json()).catch(() => {})
  }, [])

  const updateForm = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }))

  const validate = () => {
    const e = {}
    if (!formData.agentName.trim()) e.agentName = 'El nombre del agente es obligatorio'
    if (!formData.personality.trim()) e.personality = 'La personalidad es obligatoria'
    if (!formData.apiKey.trim()) e.apiKey = 'La API Key de OpenRouter es obligatoria'
    if (formData.dashboardUser.trim() && formData.dashboardPassword.length < 4)
      e.dashboardPassword = 'La contraseña debe tener al menos 4 caracteres'
    setErrors(e)
    return Object.keys(e).length === 0
  }

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

      log('✅ Configuración guardada correctamente')
      log('🚀 Iniciando el agente...')

      try {
        await fetch('/api/agent/start', { method: 'POST' })
        log('✅ Agente iniciado')
      } catch {
        log('⚠️ No se pudo arrancar el agente automáticamente (puedes iniciarlo luego)')
      }

      log('🎉 ¡Cerebro virtual creado con éxito!')
      setLoading(false)
      setStep(4)
    } catch (error) {
      console.error('Error en la instalación:', error)
      log('❌ Error: ' + error.message)
      setLoading(false)
    }
  }

  // --- Step routing ---
  if (step === 0)
    return <WelcomeScreen onStart={() => setStep(1)} />

  if (step === 1)
    return (
      <WizardStep1
        formData={formData}
        errors={errors}
        updateForm={updateForm}
        onNext={() => validate() && setStep(2)}
      />
    )

  if (step === 2)
    return (
      <WizardStepModels
        formData={formData}
        updateForm={updateForm}
        onBack={() => setStep(1)}
        onNext={() => setStep(3)}
      />
    )

  if (step === 3)
    return (
      <WizardStep2
        formData={formData}
        installLog={installLog}
        loading={loading}
        statusMessage={statusMessage}
        onBack={() => setStep(2)}
        onCreate={handleCreate}
      />
    )

  if (step === 4)
    return <WizardStep3 formData={formData} onComplete={onComplete} />

  return null
}

export default SetupWizard
