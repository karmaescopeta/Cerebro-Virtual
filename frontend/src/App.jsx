import React, { useState, useEffect, useRef } from 'react'
import SetupWizard from './SetupWizard'
import './styles.css'

function App() {
  const [loading, setLoading] = useState(true)
  const [isConfigured, setIsConfigured] = useState(false)
  const [agentStarting, setAgentStarting] = useState(false)
  const [status, setStatus] = useState(null)
  const [vaultInfo, setVaultInfo] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [chatMessage, setChatMessage] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  // Estado para Apis Agentes
  const [agentKeys, setAgentKeys] = useState({ hermes: { configured: false, key: '' } })
  const [hermesKey, setHermesKey] = useState('')
  const [keySaving, setKeySaving] = useState(false)
  const [keyMessage, setKeyMessage] = useState('')
  const [keyMessageType, setKeyMessageType] = useState('')

  // Estado para editar agente
  const [editingAgent, setEditingAgent] = useState(false)
  const [editAgentName, setEditAgentName] = useState('')
  const [editPersonality, setEditPersonality] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editMessage, setEditMessage] = useState('')
  const [editMessageType, setEditMessageType] = useState('')

  // Estado para reinicio del agente
  const [restarting, setRestarting] = useState(false)

  // NUEVO: Información del sistema
  const [systemInfo, setSystemInfo] = useState(null)
  const [containers, setContainers] = useState(null)
  // NUEVO: Estado para archivos adjuntos en el chat
  const [chatAttachedFile, setChatAttachedFile] = useState(null) // {name, path}
  const [chatUploading, setChatUploading] = useState(false)
  const [chatDragOver, setChatDragOver] = useState(false)
  const [chatMessages, setChatMessages] = useState([]) // historial de mensajes
  const [wikiGraph, setWikiGraph] = useState({ nodes: [], edges: [] })
  const fileInputRef = useRef(null)

  // ponytail: estado menú Cerebro (raw/outputs + delete)
  const [cerebroSubtab, setCerebroSubtab] = useState('raw')
  const [rawFiles, setRawFiles] = useState([])
  const [outputFiles, setOutputFiles] = useState([])
  const [cerebroSearch, setCerebroSearch] = useState('')
  const [cerebroSelected, setCerebroSelected] = useState({})
  const [cerebroDeleting, setCerebroDeleting] = useState(false)

  // NUEVO: Estado para Vault export/import
  const [vaultMessage, setVaultMessage] = useState('')
  const [vaultMessageType, setVaultMessageType] = useState('')
  const [vaultImporting, setVaultImporting] = useState(false)
  const importFileRef = useRef(null)

  useEffect(() => {
    checkConfiguration()
  }, [])

  // ponytail: cargar archivos cerebro al entrar al tab
  useEffect(() => {
    if (activeTab === 'cerebro') loadCerebroFiles()
  }, [activeTab])

  const checkConfiguration = async () => {
    try {
      const res = await fetch('/api/init/status')
      const data = await res.json()
      setIsConfigured(data.configured)

      if (data.configured) {
        // Si hay configuración, intentar iniciar el agente si no está corriendo
        await startAgent()
        await loadData()
        await loadAgentKeys()
        await loadAgentConfig()
        await loadSystemInfo()
        await loadContainersStatus()
        await loadWikiGraph()
      }

      setLoading(false)
    } catch (error) {
      console.error('Error checking configuration:', error)
      setLoading(false)
    }
  }

  const loadData = async () => {
    try {
      const healthRes = await fetch('/api/health')
      const healthData = await healthRes.json()
      setStatus(healthData)

      const vaultRes = await fetch('/api/vault/status')
      const vaultData = await vaultRes.json()
      setVaultInfo(vaultData)
    } catch (error) {
      console.error('Error cargando datos:', error)
    }
  }

  const loadAgentKeys = async () => {
    try {
      const res = await fetch('/api/agents/keys')
      const data = await res.json()
      const agents = data.agents || []
      const keysMap = {}
      agents.forEach(a => {
        keysMap[a.name] = { configured: a.configured, key: '' }
      })
      setAgentKeys(keysMap)
    } catch (error) {
      console.error('Error cargando agent keys:', error)
    }
  }

  const loadAgentConfig = async () => {
    try {
      const res = await fetch('/api/agent/config')
      if (res.ok) {
        const data = await res.json()
        setEditAgentName(data.agentName || 'Hermes')
        setEditPersonality(data.personality || '')
      }
    } catch (error) {
      console.error('Error cargando configuración del agente:', error)
    }
  }

  // NUEVO: Cargar información del sistema
  const loadSystemInfo = async () => {
    try {
      const res = await fetch('/api/system/info')
      if (res.ok) {
        const data = await res.json()
        setSystemInfo(data)
      }
    } catch (error) {
      console.error('Error cargando info del sistema:', error)
    }
  }

  // NUEVO: Cargar estado de contenedores
  const loadContainersStatus = async () => {
    try {
      const res = await fetch('/api/containers/status')
      if (res.ok) {
        const data = await res.json()
        setContainers(data)
      }
    } catch (error) {
      console.error('Error cargando estado de contenedores:', error)
    }
  }

  const loadWikiGraph = async () => {
    try {
      const res = await fetch('/api/wiki/graph')
      if (res.ok) {
        const data = await res.json()
        setWikiGraph(data)
      }
    } catch (error) {
      console.error('Error cargando grafo wiki:', error)
    }
  }

  // ponytail: cargar raw/outputs para menú Cerebro
  const loadCerebroFiles = async () => {
    try {
      const [rawRes, outRes] = await Promise.all([
        fetch('/api/vault/raw'),
        fetch('/api/vault/outputs')
      ])
      if (rawRes.ok) setRawFiles((await rawRes.json()).files || [])
      if (outRes.ok) setOutputFiles((await outRes.json()).files || [])
    } catch (e) { console.error('Error cargando archivos cerebro:', e) }
  }

  const handleCerebroDelete = async () => {
    const items = Object.entries(cerebroSelected)
      .filter(([, v]) => v)
      .map(([key]) => {
        const [category, ...pathParts] = key.split('|')
        return { category, path: pathParts.join('|') }
      })
    if (!items.length) return
    if (!confirm(`¿Eliminar ${items.length} archivo(s)? Se borrará su contenido del cerebro y el grafo se actualizará.`)) return
    setCerebroDeleting(true)
    try {
      const res = await fetch('/api/vault/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items)
      })
      if (res.ok) {
        const data = await res.json()
        setCerebroSelected({})
        await loadCerebroFiles()
        await loadWikiGraph()
        if (data.errors?.length) alert(`Errores: ${data.errors.map(e => e.path).join(', ')}`)
      }
    } catch (e) { console.error('Error eliminando:', e) }
    setCerebroDeleting(false)
  }

  const startAgent = async () => {
    setAgentStarting(true)
    try {
      const res = await fetch('/api/agent/start', { method: 'POST' })
      const data = await res.json()
      if (!data.success) {
        console.error('Error al iniciar el agente:', data.message)
        alert('❌ Error al iniciar el agente: ' + data.message)
        return false
      }
      return true
    } catch (error) {
      console.error('Error al iniciar el agente:', error)
      alert('❌ Error al iniciar el agente')
      return false
    } finally {
      setAgentStarting(false)
    }
  }

  const handleWizardComplete = async () => {
    // La configuración ya se guardó en el wizard, ahora iniciamos el agente
    setAgentStarting(true)
    try {
      const success = await startAgent()
      if (success) {
        setIsConfigured(true)
        await loadData()
        await loadAgentKeys()
        await loadAgentConfig()
        await loadSystemInfo()
        await loadContainersStatus()
        await loadWikiGraph()
      }
    } catch (error) {
      console.error('Error en handleWizardComplete:', error)
    } finally {
      setAgentStarting(false)
    }
  }

  // NUEVO: Subir archivo adjunto al chat
  const handleUploadChatFile = async (file) => {
    if (!file) return
    const allowedExts = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'md', 'markdown', 'mp3', 'wav', 'ogg', 'm4a', 'mp4', 'webm', 'mov', 'csv', 'json', 'yaml', 'yml']
    const ext = file.name.split('.').pop().toLowerCase()
    if (!allowedExts.includes(ext)) {
      alert('❌ Tipo de archivo no soportado: .' + ext)
      return
    }

    setChatUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/vault/upload?topic=chat', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.success || data.path || data.name) {
        const filename = data.name || file.name
        setChatAttachedFile({
          name: filename,
          path: `raw/chat/${filename}`,
          preview_type: data.preview_type || 'document',
          wiki_path: data.wiki_path,
          size: data.file_size,
          // ponytail: local object URL for image preview before server serves it
          local_url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
        })
        if (data.wiki_path) {
          setChatMessages(prev => [...prev, { role: 'assistant', content: `✅ ${filename} procesado → ${data.wiki_path}` }])
          await loadData()
          await loadWikiGraph()
        }
      } else {
        alert('❌ Error al subir archivo: ' + (data.message || 'desconocido'))
      }
    } catch (error) {
      console.error('Error subiendo archivo:', error)
      alert('❌ Error al subir archivo')
    } finally {
      setChatUploading(false)
    }
  }

  const handleSendChat = async () => {
    if (!chatMessage.trim() && !chatAttachedFile) return
    setChatLoading(true)

    // Construir el mensaje final
    let finalMessage = chatMessage
    if (chatAttachedFile) {
      const attachNote = `El usuario ha subido el archivo «${chatAttachedFile.name}» que ya está guardado en raw/chat/${chatAttachedFile.name}. Procésalo si es necesario.`
      finalMessage = finalMessage
        ? `${finalMessage}\n\n${attachNote}`
        : attachNote
    }

    // Añadir el mensaje del usuario al historial
    const userMsg = { role: 'user', content: finalMessage, attachment: chatAttachedFile }
    setChatMessages(prev => [...prev, userMsg])

    try {
      // El chat habla con el backend (que hace de proxy con Hermes/OpenRouter)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: finalMessage })
      })
      let responseText = ''
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        responseText = '❌ Error: ' + (errData.detail || errData.message || `HTTP ${res.status}`)
      } else {
        const data = await res.json()
        responseText = data.response || data.message || data.reply || 'Sin respuesta'
      }
      setChatMessages(prev => [...prev, { role: 'assistant', content: responseText }])
      setChatMessage('')
      setChatAttachedFile(null)
    } catch (error) {
      console.error('Error en chat:', error)
      try {
        const fallbackRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: finalMessage })
        })
        const fallbackData = await fallbackRes.json()
        setChatMessages(prev => [...prev, { role: 'assistant', content: fallbackData.response || 'Sin respuesta' }])
        setChatMessage('')
        setChatAttachedFile(null)
      } catch (fallbackError) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: '❌ Error al conectar con ' + (editAgentName || 'Hermes') }])
      }
    } finally {
      setChatLoading(false)
    }
  }

  const handleSaveHermesKey = async () => {
    if (!hermesKey.trim()) {
      setKeyMessage('Por favor, introduce una API key válida')
      setKeyMessageType('error')
      return
    }

    setKeySaving(true)
    setKeyMessage('')
    setKeyMessageType('')

    try {
      const res = await fetch('/api/agents/hermes/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: hermesKey.trim() })
      })
      const data = await res.json()

      if (data.success) {
        setKeyMessage('✅ API key guardada correctamente')
        setKeyMessageType('success')
        setHermesKey('')
        await loadAgentKeys()
        await loadData()
      } else {
        setKeyMessage('❌ Error al guardar: ' + (data.message || 'desconocido'))
        setKeyMessageType('error')
      }
    } catch (error) {
      console.error('Error guardando key:', error)
      setKeyMessage('❌ Error al conectar con el servidor')
      setKeyMessageType('error')
    } finally {
      setKeySaving(false)
    }
  }

  const handleDeleteHermesKey = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar la API key de Hermes?')) return

    setKeySaving(true)
    setKeyMessage('')
    setKeyMessageType('')

    try {
      const res = await fetch('/api/agents/hermes/key', { method: 'DELETE' })
      const data = await res.json()

      if (data.success) {
        setKeyMessage('✅ API key eliminada correctamente')
        setKeyMessageType('success')
        await loadAgentKeys()
        await loadData()
      } else {
        setKeyMessage('❌ Error al eliminar: ' + (data.message || 'desconocido'))
        setKeyMessageType('error')
      }
    } catch (error) {
      console.error('Error eliminando key:', error)
      setKeyMessage('❌ Error al conectar con el servidor')
      setKeyMessageType('error')
    } finally {
      setKeySaving(false)
    }
  }

  const handleSaveAgentEdit = async () => {
    setEditSaving(true)
    setEditMessage('')
    setEditMessageType('')

    try {
      const res = await fetch('/api/agent/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: editAgentName || 'Hermes',
          personality: editPersonality || ''
        })
      })
      const data = await res.json()

      if (data.success) {
        setEditMessage('✅ Configuración del agente actualizada')
        setEditMessageType('success')
        setEditingAgent(false)
        await loadAgentConfig()
      } else {
        setEditMessage('❌ Error: ' + (data.message || 'desconocido'))
        setEditMessageType('error')
      }
    } catch (error) {
      console.error('Error actualizando agente:', error)
      setEditMessage('❌ Error al conectar con el servidor')
      setEditMessageType('error')
    } finally {
      setEditSaving(false)
    }
  }

  const handleRestartAgent = async () => {
    if (!confirm('¿Reiniciar el agente? Esto aplicará los cambios recientes de nombre y personalidad en el dashboard de Hermes (puerto 8080).')) return

    setRestarting(true)
    try {
      const res = await fetch('/api/agent/restart', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        alert('✅ ' + data.message)
      } else {
        alert('❌ Error: ' + data.message)
      }
    } catch (error) {
      console.error('Error reiniciando agente:', error)
      alert('❌ Error al reiniciar el agente')
    } finally {
      setRestarting(false)
    }
  }

  const handleResetConfig = async () => {
    if (!confirm('⚠️ ¿Estás seguro? Esto borrará toda la configuración del agente y tendrás que volver a configurarlo desde cero. Tus notas y archivos NO se perderán.')) {
      return
    }

    if (!confirm('🔄 Confirmación final: ¿Seguro que quieres restablecer la configuración?')) {
      return
    }

    try {
      const res = await fetch('/api/init/reset', { method: 'DELETE' })
      if (res.ok) {
        const data = await res.json()
        alert('✅ ' + data.message)
        // Recargar tras reset
        window.location.reload()
      } else {
        alert('❌ Error al restablecer la configuración')
      }
    } catch (error) {
      console.error('Error reseteando:', error)
      alert('❌ Error al restablecer la configuración')
    }
  }

  // NUEVO: Exportar vault
  const handleExportVault = async () => {
    setVaultMessage('⏳ Exportando vault...')
    setVaultMessageType('info')
    try {
      const res = await fetch('/api/vault/export')
      if (!res.ok) throw new Error('Error en export')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'vault-export.tar.gz'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      setVaultMessage('✅ Vault exportado correctamente')
      setVaultMessageType('success')
    } catch (error) {
      console.error('Error exportando vault:', error)
      setVaultMessage('❌ Error al exportar vault')
      setVaultMessageType('error')
    }
  }

  // NUEVO: Importar vault
  const handleImportVault = async (file) => {
    if (!file) return
    if (!confirm('⚠️ ¿Estás seguro? Importar un vault reemplazará los datos actuales. Esta acción no se puede deshacer.')) {
      return
    }

    setVaultImporting(true)
    setVaultMessage('⏳ Importando vault...')
    setVaultMessageType('info')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/vault/import', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        setVaultMessage('✅ Vault importado correctamente. Recargando datos...')
        setVaultMessageType('success')
        await loadData()
        await loadSystemInfo()
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        setVaultMessage('❌ Error: ' + (data.message || 'desconocido'))
        setVaultMessageType('error')
      }
    } catch (error) {
      console.error('Error importando vault:', error)
      setVaultMessage('❌ Error al importar vault')
      setVaultMessageType('error')
    } finally {
      setVaultImporting(false)
    }
  }

  // NUEVO: Handlers drag-and-drop del chat
  const handleChatDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setChatDragOver(true)
  }
  const handleChatDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setChatDragOver(false)
  }
  const handleChatDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setChatDragOver(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleUploadChatFile(files[0])
    }
  }

  // Pantalla de carga mientras se inicia el agente
  if (agentStarting) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>🚀 Iniciando el agente... Esto puede tomar unos minutos.</p>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
          Construyendo el entorno de Hermes Agent...
        </p>
      </div>
    )
  }

  if (!loading && !isConfigured) {
    return <SetupWizard onComplete={handleWizardComplete} />
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Cargando Cerebro Virtual...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>🧠 Cerebro Virtual</h1>
          <div className="header-status">
            <span className={`status-dot ${status?.status === 'healthy' ? 'online' : 'offline'}`}></span>
            <span>{status?.status || 'desconocido'}</span>
          </div>
        </div>
      </header>

      <div className="container">
        <nav className="sidebar">
          <button
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button
            className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            💬 {editAgentName || 'Hermes'}
          </button>
          <button
            className={`nav-item ${activeTab === 'cerebro' ? 'active' : ''}`}
            onClick={() => setActiveTab('cerebro')}
          >
            🧬 Cerebro
          </button>
          <button
            className={`nav-item ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
          >
            🧠 Grafo
          </button>
          <button
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Ajustes
          </button>
        </nav>

        <main className="content">
          {activeTab === 'dashboard' && (
            <div className="dashboard">
              <h2>📊 Dashboard</h2>

              <div className="stats-grid">
                <div className="stat-card">
                  <h3>📖 Wiki</h3>
                  <p className="stat-number">{vaultInfo?.stats?.wiki_pages || 0}</p>
                </div>
                <div className="stat-card">
                  <h3>📦 Raw</h3>
                  <p className="stat-number">{vaultInfo?.stats?.raw_files || 0}</p>
                </div>
                <div className="stat-card">
                  <h3>📤 Outputs</h3>
                  <p className="stat-number">{vaultInfo?.stats?.outputs || 0}</p>
                </div>
              </div>

              {/* NUEVA sección: Información del sistema */}
              <div className="info-card">
                <h3>🖥️ Información del sistema</h3>
                <p>
                  <strong>Versión del sistema:</strong>{' '}
                  {systemInfo?.version || 'desconocida'}
                </p>
                <p>
                  <strong>Nombre del agente:</strong> {editAgentName || 'Hermes'}
                </p>
                <p>
                  <strong>Puerto de Hermes:</strong>{' '}
                  <span style={{ fontFamily: 'monospace', color: '#3b82f6' }}>8080</span>
                </p>

                {/* Estado de contenedores */}
                <div style={{ marginTop: '1rem' }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Estado de contenedores:</strong>
                  {!containers ? (
                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Cargando...</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {Object.entries(containers.containers || containers).map(([name, info]) => {
                        const running = info?.running !== undefined ? info.running : info?.status === 'running'
                        return (
                          <div
                            key={name}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.4rem 0.75rem',
                              background: '#1a2332',
                              borderRadius: '6px',
                              border: '1px solid #1f2937',
                              fontSize: '0.875rem'
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-block',
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                background: running ? '#10b981' : '#ef4444',
                                flexShrink: 0
                              }}
                            ></span>
                            <span style={{ fontWeight: 500 }}>{name}</span>
                            <span style={{ color: running ? '#10b981' : '#ef4444', fontSize: '0.75rem', marginLeft: 'auto' }}>
                              {running ? '● running' : '● stopped'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {vaultInfo?.manifest && (
                <div className="info-card">
                  <h3>ℹ️ Información del Vault</h3>
                  <p><strong>Nombre:</strong> {vaultInfo.manifest.name}</p>
                  <p><strong>Versión:</strong> {vaultInfo.manifest.schemaVersion}</p>
                  <p><strong>Creado:</strong> {new Date(vaultInfo.manifest.createdAt).toLocaleDateString()}</p>
                  <p><strong>Agente:</strong> {editAgentName || 'Hermes'}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'chat' && (
            <div
              className="chat-view"
              onDragOver={handleChatDragOver}
              onDragLeave={handleChatDragLeave}
              onDrop={handleChatDrop}
              style={{ position: 'relative', minHeight: '400px' }}
            >
              <h2>💬 Habla con {editAgentName || 'Hermes'}</h2>

              {/* Overlay drag-and-drop */}
              {chatDragOver && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '3px dashed #3b82f6',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    pointerEvents: 'none'
                  }}
                >
                  <div style={{
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    color: '#3b82f6',
                    background: '#0a0a0a',
                    padding: '1rem 2rem',
                    borderRadius: '12px',
                    border: '1px solid #3b82f6'
                  }}>
                    📎 Suelta tu archivo aquí
                  </div>
                </div>
              )}

              <div className="chat-container">
                <div className="chat-messages">
                  {chatMessages.length === 0 && !chatLoading && (
                    <p className="chat-placeholder">
                      Pregúntale a {editAgentName || 'Hermes'} sobre tus notas, proyectos o cualquier cosa en tu cerebro virtual.
                    </p>
                  )}
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-message ${msg.role}`}>
                      <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                        {msg.attachment && (
                          <div style={{
                            marginTop: '0.5rem',
                            padding: '0.4rem 0.75rem',
                            background: '#1a2332',
                            borderRadius: '6px',
                            border: '1px solid #374151',
                            fontSize: '0.8rem',
                            color: '#3b82f6'
                          }}>
                            📎 {msg.attachment.name}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="chat-message assistant">
                      <div className="message-content">⏳ {editAgentName || 'Hermes'} está pensando...</div>
                    </div>
                  )}
                  {chatUploading && (
                    <div className="chat-message assistant">
                      <div className="message-content">📤 Subiendo y procesando a wiki...</div>
                    </div>
                  )}
                </div>

                {/* Preview de archivo adjunto (whatsapp-style) */}
                {chatAttachedFile && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem',
                    background: '#1a2332',
                    borderRadius: '8px',
                    border: '1px solid #3b82f6',
                    marginBottom: '0.5rem',
                    fontSize: '0.85rem',
                    maxWidth: '320px'
                  }}>
                    {chatAttachedFile.preview_type === 'image' && (
                      <img
                        src={chatAttachedFile.local_url || `/vault-static/${chatAttachedFile.path}`}
                        alt={chatAttachedFile.name}
                        style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }}
                      />
                    )}
                    {chatAttachedFile.preview_type === 'audio' && (
                      <div style={{ width: '48px', height: '48px', borderRadius: '6px', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🎵</div>
                    )}
                    {chatAttachedFile.preview_type === 'video' && (
                      <div style={{ width: '48px', height: '48px', borderRadius: '6px', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🎬</div>
                    )}
                    {chatAttachedFile.preview_type === 'document' && (
                      <div style={{ width: '48px', height: '48px', borderRadius: '6px', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>📄</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ color: '#e5e7eb', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {chatAttachedFile.name}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '0.7rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {chatAttachedFile.wiki_path ? (
                          <span style={{ color: '#10b981' }}>✅ Wiki</span>
                        ) : (
                          <span>Procesando…</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setChatAttachedFile(null)}
                      style={{
                        background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%',
                        width: '20px', height: '20px', cursor: 'pointer', fontSize: '0.75rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1
                      }}
                    >✕</button>
                  </div>
                )}

                <div className="chat-input">
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleUploadChatFile(e.target.files[0])
                        e.target.value = ''
                      }
                    }}
                    accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.markdown,.mp3,.wav,.ogg,.m4a,.mp4,.webm,.mov,.csv,.json,.yaml,.yml"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={chatLoading || chatUploading}
                    title="Adjuntar archivo"
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: '#1f2937',
                      color: '#e5e7eb',
                      border: '1px solid #374151',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      flexShrink: 0
                    }}
                  >
                    📎
                  </button>
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Escribe tu pregunta... (arrastra archivos para adjuntar)"
                    onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                    disabled={chatLoading}
                  />
                  <button onClick={handleSendChat} disabled={chatLoading || chatUploading}>
                    {chatLoading ? '⏳' : 'Enviar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cerebro' && (
            <div className="dashboard">
              <h2>🧬 Cerebro</h2>
              <p style={{ color: '#9ca3af', marginBottom: '1rem', fontSize: '0.875rem' }}>
                Gestión de archivos raw y outputs. Eliminar un archivo borra su contenido del cerebro y actualiza el grafo.
              </p>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                  className={`nav-item ${cerebroSubtab === 'raw' ? 'active' : ''}`}
                  style={{ flex: 0, padding: '0.5rem 1rem' }}
                  onClick={() => setCerebroSubtab('raw')}
                >
                  📦 Raw ({rawFiles.length})
                </button>
                <button
                  className={`nav-item ${cerebroSubtab === 'outputs' ? 'active' : ''}`}
                  style={{ flex: 0, padding: '0.5rem 1rem' }}
                  onClick={() => setCerebroSubtab('outputs')}
                >
                  📤 Outputs ({outputFiles.length})
                </button>
              </div>

              <input
                type="text"
                placeholder="Buscar archivo..."
                value={cerebroSearch}
                onChange={(e) => setCerebroSearch(e.target.value)}
                style={{
                  width: '100%', padding: '0.5rem', marginBottom: '1rem',
                  background: '#1a2332', border: '1px solid #1f2937',
                  borderRadius: '6px', color: '#fff', fontSize: '0.875rem'
                }}
              />

              {(() => {
                const files = cerebroSubtab === 'raw' ? rawFiles : outputFiles
                const filtered = cerebroSearch
                  ? files.filter(f => f.name.toLowerCase().includes(cerebroSearch.toLowerCase()))
                  : files
                const selectedCount = Object.entries(cerebroSelected)
                  .filter(([k, v]) => v && k.startsWith(cerebroSubtab + '|')).length

                if (!filtered.length) return (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                    No hay archivos {cerebroSubtab === 'raw' ? 'raw' : 'de outputs'}
                  </p>
                )

                return (
                  <>
                    <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                        {selectedCount} seleccionado(s) de {filtered.length}
                      </span>
                      <button
                        onClick={handleCerebroDelete}
                        disabled={!selectedCount || cerebroDeleting}
                        style={{
                          padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer',
                          background: selectedCount ? '#dc2626' : '#374151',
                          color: '#fff', border: 'none', fontSize: '0.875rem',
                          opacity: (!selectedCount || cerebroDeleting) ? 0.5 : 1
                        }}
                      >
                        {cerebroDeleting ? 'Eliminando...' : `🗑️ Eliminar (${selectedCount})`}
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {filtered.map(f => {
                        const key = `${cerebroSubtab}|${f.path}`
                        return (
                          <div key={key} style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.75rem', background: '#1a2332',
                            border: '1px solid #1f2937', borderRadius: '6px'
                          }}>
                            <input
                              type="checkbox"
                              checked={!!cerebroSelected[key]}
                              onChange={(e) => setCerebroSelected(prev => ({
                                ...prev, [key]: e.target.checked
                              }))}
                              style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                            />
                            <span style={{ fontSize: '1.25rem' }}>
                              {{ image: '🖼️', audio: '🎵', video: '🎬', document: '📄' }[
                                ['png','jpg','jpeg','gif','webp','bmp'].includes(f.ext) ? 'image' :
                                ['mp3','wav','ogg','m4a','aac','flac'].includes(f.ext) ? 'audio' :
                                ['mp4','webm','mov','avi','mkv'].includes(f.ext) ? 'video' : 'document'
                              ]}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: '#fff', fontSize: '0.875rem' }}>{f.name}</div>
                              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                                {f.path} · {(f.size / 1024).toFixed(1)} KB
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {activeTab === 'graph' && (
            <div className="dashboard">
              <h2>🧠 Grafo de Conocimiento</h2>
              <p style={{ color: '#9ca3af', marginBottom: '1rem', fontSize: '0.875rem' }}>
                {wikiGraph.nodes?.length || 0} páginas · {wikiGraph.edges?.length || 0} enlaces
              </p>
              <WikiGraphView nodes={wikiGraph.nodes || []} edges={wikiGraph.edges || []} />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="settings-view">
              <h2>⚙️ Ajustes</h2>

              {/* Sección: Agente Principal */}
              <div className="settings-card" style={{ marginBottom: '1.5rem' }}>
                <h3>🧠 Agente Principal</h3>
                <p style={{ color: '#9ca3af', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  Configura el nombre y la personalidad de tu agente.
                </p>

                {editingAgent ? (
                  <div style={{
                    background: '#1a2332',
                    borderRadius: '8px',
                    padding: '1rem',
                    border: '1px solid #1f2937'
                  }}>
                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Nombre del agente</label>
                      <input
                        type="text"
                        value={editAgentName}
                        onChange={(e) => setEditAgentName(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          background: '#0a0a0a',
                          border: '1px solid #1f2937',
                          borderRadius: '6px',
                          color: '#e5e7eb',
                          fontSize: '0.875rem'
                        }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Personalidad</label>
                      <textarea
                        value={editPersonality}
                        onChange={(e) => setEditPersonality(e.target.value)}
                        rows={4}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          background: '#0a0a0a',
                          border: '1px solid #1f2937',
                          borderRadius: '6px',
                          color: '#e5e7eb',
                          fontSize: '0.875rem',
                          resize: 'vertical',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={handleSaveAgentEdit}
                        disabled={editSaving}
                        style={{
                          padding: '0.5rem 1.5rem',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        {editSaving ? '⏳ Guardando...' : '💾 Guardar'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingAgent(false)
                          loadAgentConfig()
                        }}
                        style={{
                          padding: '0.5rem 1.5rem',
                          background: '#1f2937',
                          color: '#e5e7eb',
                          border: '1px solid #374151',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleRestartAgent}
                        disabled={restarting}
                        style={{
                          padding: '0.5rem 1.5rem',
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        {restarting ? '⏳ Reiniciando...' : '🔄 Reiniciar agente'}
                      </button>
                    </div>
                    {editMessage && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        background: editMessageType === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: editMessageType === 'success' ? '#10b981' : '#ef4444',
                        fontSize: '0.875rem'
                      }}>
                        {editMessage}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    background: '#1a2332',
                    borderRadius: '8px',
                    padding: '1rem',
                    border: '1px solid #1f2937',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>{editAgentName || 'Hermes'}</div>
                      <div style={{ fontSize: '0.875rem', color: '#9ca3af', maxWidth: '400px' }}>
                        {editPersonality ? editPersonality.slice(0, 100) + '...' : 'Sin personalidad definida'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        onClick={() => setEditingAgent(true)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#1f2937',
                          color: '#e5e7eb',
                          border: '1px solid #374151',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={handleRestartAgent}
                        disabled={restarting}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        {restarting ? '⏳' : '🔄 Reiniciar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sección: Apis Agentes */}
              <div className="settings-card" style={{ marginBottom: '1.5rem' }}>
                <h3>🔑 APIs Agentes</h3>
                <p style={{ color: '#9ca3af', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  Configura las API keys para los agentes del sistema.
                </p>

                <div className="agent-config" style={{
                  background: '#1a2332',
                  borderRadius: '8px',
                  padding: '1rem',
                  border: '1px solid #1f2937'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <strong style={{ fontSize: '1rem' }}>🧠 {editAgentName || 'Hermes'}</strong>
                      <span style={{
                        marginLeft: '0.75rem',
                        fontSize: '0.75rem',
                        color: agentKeys.hermes?.configured ? '#10b981' : '#6b7280',
                        background: agentKeys.hermes?.configured ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                        padding: '2px 10px',
                        borderRadius: '12px'
                      }}>
                        {agentKeys.hermes?.configured ? '✅ Configurada' : '❌ No configurada'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>OpenRouter</span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input
                      type="password"
                      value={hermesKey}
                      onChange={(e) => setHermesKey(e.target.value)}
                      placeholder="sk-or-v1-..."
                      style={{
                        flex: 1,
                        padding: '0.5rem 0.75rem',
                        background: '#111827',
                        border: '1px solid #374151',
                        borderRadius: '6px',
                        color: '#e5e7eb',
                        fontSize: '0.875rem',
                        fontFamily: 'monospace'
                      }}
                    />
                    <button
                      onClick={handleSaveHermesKey}
                      disabled={keySaving}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '0.875rem'
                      }}
                    >
                      {keySaving ? '⏳' : 'Guardar'}
                    </button>
                    {agentKeys.hermes?.configured && (
                      <button
                        onClick={handleDeleteHermesKey}
                        disabled={keySaving}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '500',
                          fontSize: '0.875rem'
                        }}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>

                  {keyMessage && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      background: keyMessageType === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: keyMessageType === 'success' ? '#10b981' : '#ef4444',
                      fontSize: '0.875rem'
                    }}>
                      {keyMessage}
                    </div>
                  )}

                  <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>
                    💡 Obtén tu API key en <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>OpenRouter</a>
                  </div>
                </div>
              </div>

              {/* NUEVA Sección: Vault */}
              <div className="settings-card" style={{ marginBottom: '1.5rem' }}>
                <h3>📦 Vault</h3>
                <p style={{ color: '#9ca3af', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  Exporta o importa el vault completo (incluye wiki, raw files y outputs).
                </p>

                <div style={{
                  background: '#1a2332',
                  borderRadius: '8px',
                  padding: '1rem',
                  border: '1px solid #1f2937',
                  display: 'flex',
                  gap: '0.75rem',
                  flexWrap: 'wrap'
                }}>
                  <button
                    onClick={handleExportVault}
                    style={{
                      padding: '0.6rem 1.5rem',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    📤 Exportar vault
                  </button>
                  <input
                    type="file"
                    ref={importFileRef}
                    style={{ display: 'none' }}
                    accept=".tar.gz,.tgz,application/gzip"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleImportVault(e.target.files[0])
                        e.target.value = ''
                      }
                    }}
                  />
                  <button
                    onClick={() => importFileRef.current?.click()}
                    disabled={vaultImporting}
                    style={{
                      padding: '0.6rem 1.5rem',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: vaultImporting ? 'not-allowed' : 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    {vaultImporting ? '⏳ Importando...' : '📥 Importar vault'}
                  </button>
                </div>

                {vaultMessage && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    background: vaultMessageType === 'success' ? 'rgba(16, 185, 129, 0.15)' : vaultMessageType === 'info' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: vaultMessageType === 'success' ? '#10b981' : vaultMessageType === 'info' ? '#3b82f6' : '#ef4444',
                    fontSize: '0.875rem'
                  }}>
                    {vaultMessage}
                  </div>
                )}
              </div>

              {/* Sección: Estado del Sistema */}
              <div className="settings-card" style={{ marginBottom: '1.5rem' }}>
                <h3>📊 Estado del Sistema</h3>
                <p><strong>Agente:</strong> {editAgentName || 'Hermes'}</p>
                <p><strong>API Key:</strong> {agentKeys.hermes?.configured ? '✅ Configurada' : '❌ No configurada'}</p>
                <p><strong>Vault Path:</strong> {status?.vault_path}</p>
                <p><strong>Versión:</strong> {systemInfo?.version || '1.0.0'}</p>
              </div>

              {/* Sección: Canales de mensajería */}
              <div className="settings-card" style={{ marginBottom: '1.5rem' }}>
                <h3>📡 Canales de mensajería</h3>
                <p style={{ color: '#9ca3af', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  Conecta tu agente a Telegram, Discord o WhatsApp. Reinicia el agente tras cambiar.
                </p>
                <div style={{ background: '#1a2332', borderRadius: '8px', padding: '1rem', border: '1px solid #1f2937' }}>
                  <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                    Para añadir o modificar canales, ve al <a href="http://localhost:8080" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Panel de Hermes</a> → Settings → Gateway.
                  </p>
                  <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
                    Hermes soporta: Telegram, Discord, Slack, WhatsApp, Signal, Email, SMS, Matrix, Teams y más.
                  </p>
                </div>
              </div>

              {/* Sección: Panel de Hermes */}
              <div className="settings-card" style={{ marginBottom: '1.5rem' }}>
                <h3>🔗 Panel de Hermes</h3>
                <p style={{ color: '#9ca3af', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  Accede al panel completo de control de tu agente para gestionar skills, herramientas y canales.
                </p>
                <a
                  href="http://localhost:8080"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    padding: '0.75rem 1.5rem',
                    background: '#1f2937',
                    color: '#e5e7eb',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: '500',
                    border: '1px solid #374151',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#374151'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#1f2937'; }}
                >
                  🔗 Abrir Panel de {editAgentName || 'Hermes'}
                </a>
              </div>

              {/* Sección: Zona Peligrosa */}
              <div className="settings-card" style={{ borderColor: '#ef4444' }}>
                <h3 style={{ color: '#ef4444' }}>⚠️ Zona Peligrosa</h3>
                <p style={{ color: '#9ca3af', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  Restablecer toda la configuración del agente. Esta acción no se puede deshacer.
                  <br />
                  <strong>Tus notas y archivos NO se perderán.</strong>
                </p>
                <button
                  onClick={handleResetConfig}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#dc2626'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#ef4444'; }}
                >
                  🗑️ Restablecer configuración
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App


function WikiGraphView({ nodes, edges }) {
  // ponytail: SVG estático, sin lib de grafo. Layout circular.
  if (!nodes.length) {
    return (
      <div style={{ color: '#6b7280', textAlign: 'center', padding: '3rem' }}>
        No hay páginas wiki todavía. Procesa archivos desde el chat para crearlas.
      </div>
    )
  }

  const W = 700, H = 500, R = 200, cx = W / 2, cy = H / 2
  const pos = {}
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2
    pos[n.id] = { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) }
  })

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: '700px', margin: '0 auto', display: 'block' }}>
      {/* aristas */}
      {edges.map((e, i) => {
        const s = pos[e.source], t = pos[e.target]
        if (!s || !t) return null
        return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#374151" strokeWidth="1.5" />
      })}
      {/* nodos */}
      {nodes.map((n) => {
        const p = pos[n.id]
        if (!p) return null
        const isPage = !!n.path
        return (
          <g key={n.id}>
            <circle cx={p.x} cy={p.y} r={isPage ? 8 : 5} fill={isPage ? '#3b82f6' : '#6b7280'} stroke="#0a0a0a" strokeWidth="1" />
            <text x={p.x} y={p.y - 12} textAnchor="middle" fill="#9ca3af" fontSize="10" style={{ pointerEvents: 'none' }}>
              {n.title.length > 15 ? n.title.slice(0, 12) + '…' : n.title}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
