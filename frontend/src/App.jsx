import React, { useState, useEffect } from 'react'
import SetupWizard from './SetupWizard'
import './styles.css'

function App() {
  const [loading, setLoading] = useState(true)
  const [isConfigured, setIsConfigured] = useState(false)
  const [agentStarting, setAgentStarting] = useState(false)
  const [status, setStatus] = useState(null)
  const [vaultInfo, setVaultInfo] = useState(null)
  const [notes, setNotes] = useState([])
  const [activeTab, setActiveTab] = useState('dashboard')
  const [chatMessage, setChatMessage] = useState('')
  const [chatResponse, setChatResponse] = useState('')
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

  useEffect(() => {
    checkConfiguration()
  }, [])

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

      const notesRes = await fetch('/api/notes')
      const notesData = await notesRes.json()
      setNotes(notesData.notes)
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
      }
    } catch (error) {
      console.error('Error en handleWizardComplete:', error)
    } finally {
      setAgentStarting(false)
    }
  }

  const handleSendChat = async () => {
    if (!chatMessage.trim()) return
    setChatLoading(true)
    setChatResponse('')

    try {
      // El chat ahora habla directamente con el Coordinador (Hermes en :8080)
      // El Coordinador es el único agente accesible desde el frontend.
      // Los demás subagentes son internos y solo se invocan por delegación.
      const res = await fetch('http://localhost:8080/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: chatMessage })
      })
      if (!res.ok) {
        // Fallback al backend si Hermes no responde
        console.warn('Hermes no responde en :8080, fallback al backend')
        const fallbackRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: chatMessage })
        })
        const fallbackData = await fallbackRes.json()
        setChatResponse(fallbackData.response)
      } else {
        const data = await res.json()
        setChatResponse(data.response || data.message || 'Sin respuesta')
      }
      setChatMessage('')
    } catch (error) {
      console.error('Error en chat:', error)
      // Fallback al backend si hay error de conexión con Hermes
      try {
        const fallbackRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: chatMessage })
        })
        const fallbackData = await fallbackRes.json()
        setChatResponse(fallbackData.response)
        setChatMessage('')
      } catch (fallbackError) {
        setChatResponse('❌ Error al conectar con ' + (editAgentName || 'Hermes'))
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
        headers: {
          'Content-Type': 'application/json'
        },
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
      const res = await fetch('/api/agents/hermes/key', {
        method: 'DELETE'
      })
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
        headers: {
          'Content-Type': 'application/json'
        },
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
        setIsConfigured(false)
        window.location.reload()
      } else {
        alert('❌ Error al restablecer la configuración')
      }
    } catch (error) {
      console.error('Error reseteando:', error)
      alert('❌ Error al restablecer la configuración')
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
            className={`nav-item ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            📝 Notas
          </button>
          <button 
            className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            💬 {editAgentName || 'Hermes'}
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

          {activeTab === 'notes' && (
            <div className="notes-view">
              <div className="notes-list">
                <h2>📝 Notas</h2>
                {notes.length === 0 ? (
                  <p className="empty-message">No hay notas aún. ¡Crea tu primera nota!</p>
                ) : (
                  <ul className="notes-list-items">
                    {notes.map(note => (
                      <li key={note.id} className="note-item">
                        <span className="note-title">{note.title}</span>
                        <span className="note-date">{new Date(note.updatedAt).toLocaleDateString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="chat-view">
              <h2>💬 Habla con {editAgentName || 'Hermes'}</h2>
              <div className="chat-container">
                <div className="chat-messages">
                  {chatResponse && (
                    <div className="chat-message assistant">
                      <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>
                        {chatResponse}
                      </div>
                    </div>
                  )}
                  {!chatResponse && !chatLoading && (
                    <p className="chat-placeholder">
                      Pregúntale a {editAgentName || 'Hermes'} sobre tus notas, proyectos o cualquier cosa en tu cerebro virtual.
                    </p>
                  )}
                  {chatLoading && (
                    <div className="chat-message assistant">
                      <div className="message-content">⏳ {editAgentName || 'Hermes'} está pensando...</div>
                    </div>
                  )}
                </div>
                <div className="chat-input">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Escribe tu pregunta..."
                    onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                    disabled={chatLoading}
                  />
                  <button onClick={handleSendChat} disabled={chatLoading}>
                    {chatLoading ? '⏳' : 'Enviar'}
                  </button>
                </div>
              </div>
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
                <h3>🔑 Apis Agentes</h3>
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

              {/* Sección: Estado del Sistema */}
              <div className="settings-card" style={{ marginBottom: '1.5rem' }}>
                <h3>📊 Estado del Sistema</h3>
                <p><strong>Agente:</strong> {editAgentName || 'Hermes'}</p>
                <p><strong>API Key:</strong> {agentKeys.hermes?.configured ? '✅ Configurada' : '❌ No configurada'}</p>
                <p><strong>Vault Path:</strong> {status?.vault_path}</p>
                <p><strong>Versión:</strong> 1.0.0</p>
              </div>

              {/* Sección: Configuración Avanzada del Agente */}
              <div className="settings-card">
                <h3>🎛️ Configuración Avanzada del Agente</h3>
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
                  onMouseEnter={(e) => { e.target.style.background = '#374151'; }}
                  onMouseLeave={(e) => { e.target.style.background = '#1f2937'; }}
                >
                  🔗 Abrir Panel de {editAgentName || 'Hermes'}
                </a>
              </div>

              {/* Sección: Restablecer */}
              <div className="settings-card" style={{ marginTop: '1.5rem', borderColor: '#ef4444' }}>
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
                  onMouseEnter={(e) => { e.target.style.background = '#dc2626'; }}
                  onMouseLeave={(e) => { e.target.style.background = '#ef4444'; }}
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