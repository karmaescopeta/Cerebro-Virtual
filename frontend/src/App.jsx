import React, { useState, useEffect, useRef } from 'react'
import SetupWizard from './SetupWizard'
import './app.css'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import MobileNav from './components/layout/MobileNav'
import DashboardView from './components/views/DashboardView'
import ChatView from './components/views/ChatView'
import CerebroView from './components/views/CerebroView'
import GrafoView from './components/views/GrafoView'
import ModelosView from './components/views/ModelosView'
import AjustesView from './components/views/AjustesView'
import ExportPopup from './components/shared/ExportPopup'
import VersionBanner from './components/shared/VersionBanner'

function App() {
  const [loading, setLoading] = useState(true)
  const [isConfigured, setIsConfigured] = useState(false)
  const [agentStarting, setAgentStarting] = useState(false)
  const [status, setStatus] = useState(null)
  const [vaultInfo, setVaultInfo] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')

  // Chat
  const [chatMessage, setChatMessage] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatAttachedFile, setChatAttachedFile] = useState(null)
  const [chatUploading, setChatUploading] = useState(false)
  const [chatDragOver, setChatDragOver] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [sessions, setSessions] = useState([])
  const [chatSmart, setChatSmart] = useState(false)
  const [cerebroMode, setCerebroMode] = useState(false)
  const [internetMode, setInternetMode] = useState(false)
  const [investigationMode, setInvestigationMode] = useState(false)
  const [selectedMessages, setSelectedMessages] = useState([])
  const fileInputRef = useRef(null)

  // Agent keys
  const [agentKeys, setAgentKeys] = useState({ hermes: { configured: false, key: '' } })
  const [hermesKey, setHermesKey] = useState('')
  const [keySaving, setKeySaving] = useState(false)
  const [keyMessage, setKeyMessage] = useState('')
  const [keyMessageType, setKeyMessageType] = useState('')

  // Agent edit
  const [editingAgent, setEditingAgent] = useState(false)
  const [editAgentName, setEditAgentName] = useState('')
  const [editPersonality, setEditPersonality] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editMessage, setEditMessage] = useState('')
  const [editMessageType, setEditMessageType] = useState('')
  const [restarting, setRestarting] = useState(false)

  // System
  const [systemInfo, setSystemInfo] = useState(null)
  const [containers, setContainers] = useState(null)
  const [wikiGraph, setWikiGraph] = useState({ nodes: [], edges: [] })
  const [projects, setProjects] = useState([])

  // Cerebro
  const [cerebroSubtab, setCerebroSubtab] = useState('estructura')
  const [rawFiles, setRawFiles] = useState([])
  const [outputFiles, setOutputFiles] = useState([])
  const [cerebroSearch, setCerebroSearch] = useState('')
  const [cerebroSelected, setCerebroSelected] = useState({})
  const [cerebroDeleting, setCerebroDeleting] = useState(false)

  // Vault
  const [vaultMessage, setVaultMessage] = useState('')
  const [vaultMessageType, setVaultMessageType] = useState('')
  const [vaultImporting, setVaultImporting] = useState(false)
  const [showExportPopup, setShowExportPopup] = useState(false)
  const importFileRef = useRef(null)

  useEffect(() => { checkConfiguration() }, [])
  useEffect(() => { if (activeTab === 'cerebro') loadCerebroFiles() }, [activeTab])
  useEffect(() => { if (activeTab === 'chat' && isConfigured) loadSessions() }, [activeTab, isConfigured])

  // === Data loading ===
  async function checkConfiguration() {
    try {
      const res = await fetch('/api/init/status')
      const data = await res.json()
      setIsConfigured(data.configured)
      if (data.configured) {
        await startAgent()
        await Promise.all([loadData(), loadAgentKeys(), loadAgentConfig(), loadSystemInfo(), loadContainersStatus(), loadWikiGraph(), loadProjects()])
      }
      setLoading(false)
    } catch { setLoading(false) }
  }

  async function loadData() {
    try {
      const [h, v] = await Promise.all([fetch('/api/health'), fetch('/api/vault/status')])
      setStatus(await h.json())
      setVaultInfo(await v.json())
    } catch {}
  }

  async function loadAgentKeys() {
    try {
      const data = await (await fetch('/api/agents/keys')).json()
      const m = {}
      ;(data.agents || []).forEach(a => { m[a.name] = { configured: a.configured, key: '' } })
      setAgentKeys(m)
    } catch {}
  }

  async function loadAgentConfig() {
    try {
      const res = await fetch('/api/agent/config')
      if (res.ok) { const d = await res.json(); setEditAgentName(d.agentName || 'Hermes'); setEditPersonality(d.personality || '') }
    } catch {}
  }

  async function loadSystemInfo() {
    try { const res = await fetch('/api/system/info'); if (res.ok) setSystemInfo(await res.json()) } catch {}
  }

  async function loadContainersStatus() {
    try { const res = await fetch('/api/containers/status'); if (res.ok) setContainers(await res.json()) } catch {}
  }

  async function loadWikiGraph() {
    try { const res = await fetch('/api/wiki/graph'); if (res.ok) setWikiGraph(await res.json()) } catch {}
  }

  async function loadProjects() {
    try { const res = await fetch('/api/projects'); if (res.ok) setProjects((await res.json()).projects || []) } catch {}
  }

  async function loadCerebroFiles() {
    try {
      const [r, o] = await Promise.all([fetch('/api/vault/raw'), fetch('/api/vault/outputs')])
      if (r.ok) setRawFiles((await r.json()).files || [])
      if (o.ok) setOutputFiles((await o.json()).files || [])
    } catch {}
  }

  // === Agent ===
  async function startAgent() {
    setAgentStarting(true)
    try {
      const d = await (await fetch('/api/agent/start', { method: 'POST' })).json()
      if (!d.success) { alert('Error: ' + d.message); return false }
      return true
    } catch { alert('Error al iniciar agente'); return false }
    finally { setAgentStarting(false) }
  }

  async function handleWizardComplete() {
    setAgentStarting(true)
    try {
      if (await startAgent()) {
        setIsConfigured(true)
        await Promise.all([loadData(), loadAgentKeys(), loadAgentConfig(), loadSystemInfo(), loadContainersStatus(), loadWikiGraph(), loadProjects()])
      }
    } finally { setAgentStarting(false) }
  }

  // === Chat ===
  async function handleUploadChatFile(file) {
    // ponytail: sin filtro de extensiones — aceptar cualquier archivo
    setChatUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const d = await (await fetch('/api/vault/upload?project=individual', { method: 'POST', body: fd })).json()
      if (d.success || d.path || d.name) {
        const fn = d.name || file.name
        setChatAttachedFile({ name: fn, path: `raw/chat/${fn}`, preview_type: d.preview_type || 'document', wiki_path: d.wiki_path, size: d.file_size, local_url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null })
        if (d.wiki_path) { setChatMessages(p => [...p, { role: 'assistant', content: `✅ ${fn} procesado → ${d.wiki_path}` }]); await loadData(); await loadWikiGraph() }
      } else { alert('Error: ' + (d.message || 'desconocido')) }
    } catch { alert('Error al subir') } finally { setChatUploading(false) }
  }

  // === Chat Sessions ===
  async function loadSessions() {
    try {
      const res = await fetch('/api/chat/sessions')
      const data = await res.json()
      setSessions(data.sessions || [])
      // ponytail: cargar la sesión lastActive o crear una nueva
      const active = (data.sessions || []).find(s => s.lastActive)
      if (active) {
        await switchToSession(active.id)
      } else if ((data.sessions || []).length === 0) {
        await createNewSession()
      } else {
        await switchToSession(data.sessions[0].id)
      }
    } catch {}
  }

  async function switchToSession(id) {
    try {
      const res = await fetch(`/api/chat/sessions/${id}`)
      const data = await res.json()
      setActiveSessionId(id)
      setChatMessages(data.messages || [])
      // marcar como activa en backend
      await fetch(`/api/chat/sessions/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lastActive: true }) })
      // refrescar lista
      const listRes = await fetch('/api/chat/sessions')
      setSessions((await listRes.json()).sessions || [])
    } catch {}
  }

  async function createNewSession() {
    try {
      const res = await fetch('/api/chat/sessions', { method: 'POST' })
      const data = await res.json()
      setActiveSessionId(data.id)
      setChatMessages([])
      setInvestigationMode(false)
      setSelectedMessages([])
      const listRes = await fetch('/api/chat/sessions')
      setSessions((await listRes.json()).sessions || [])
    } catch {}
  }

  async function deleteSession(id) {
    try {
      await fetch(`/api/chat/sessions/${id}`, { method: 'DELETE' })
      const listRes = await fetch('/api/chat/sessions')
      const list = (await listRes.json()).sessions || []
      setSessions(list)
      if (activeSessionId === id) {
        if (list.length > 0) {
          await switchToSession(list[0].id)
        } else {
          await createNewSession()
        }
      }
    } catch {}
  }

  async function renameSession(id, title) {
    try {
      await fetch(`/api/chat/sessions/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) })
      const listRes = await fetch('/api/chat/sessions')
      setSessions((await listRes.json()).sessions || [])
    } catch {}
  }

  function computeMode() {
    if (cerebroMode) return internetMode ? 'cerebro+internet' : 'cerebro'
    if (chatSmart) return 'smart'
    return 'default'
  }

  async function handleSendChat() {
    if (!chatMessage.trim() && !chatAttachedFile) return
    setChatLoading(true)
    let msg = chatMessage
    if (chatAttachedFile) {
      const note = `El usuario ha subido el archivo «${chatAttachedFile.name}» que ya está guardado en raw/individual/${chatAttachedFile.name}. Procésalo si es necesario.`
      msg = msg ? `${msg}\n\n${note}` : note
    }
    const mode = computeMode()
    setChatMessages(p => [...p, { role: 'user', content: msg, attachment: chatAttachedFile }])
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, session_id: activeSessionId, mode }) })
      let txt = '', ctx = null
      if (!res.ok) { const e = await res.json().catch(() => ({})); txt = 'Error: ' + (e.detail || e.message || `HTTP ${res.status}`) }
      else { const d = await res.json(); txt = d.response || 'Sin respuesta'; ctx = d.context || null }
      setChatMessages(p => [...p, { role: 'assistant', content: txt, context: ctx, _originalQuery: msg }])
      setChatMessage(''); setChatAttachedFile(null)
      // refrescar lista de sesiones (título auto-actualizado)
      const listRes = await fetch('/api/chat/sessions')
      setSessions((await listRes.json()).sessions || [])
    } catch {
      setChatMessages(p => [...p, { role: 'assistant', content: 'Error al conectar con ' + (editAgentName || 'Hermes') }])
    } finally { setChatLoading(false) }
  }

  // ponytail: investigar — mensajes seleccionados → investigador → resumen + doc completo
    async function handleInvestigate(selectedMsgs) {
      const msgs = selectedMsgs.map(idx => chatMessages[idx]).filter(m => m)
      if (!msgs.length) return
      setChatLoading(true)
      setChatMessages(p => [...p, { role: 'user', content: `🔍 Investigar (${msgs.length} mensajes)` }])
      try {
        const res = await fetch('/api/chat/investigate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: msgs, session_id: activeSessionId }) })
        const d = await res.json()
        setChatMessages(p => [...p, { role: 'assistant', content: d.response || 'Sin respuesta', fullDoc: d.full_doc || d.response || '', context: d.context || null, _originalQuery: 'investigacion' }])
      } catch {
        setChatMessages(p => [...p, { role: 'assistant', content: 'Error al investigar' }])
      } finally { setChatLoading(false); setInvestigationMode(false); setSelectedMessages([]) }
    }

  // ponytail: guardar output en el cerebro
  async function handleSaveOutput(content, projectId, name, description) {
    setChatLoading(true)
    try {
      const res = await fetch('/api/vault/save-output', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, project_id: projectId, name, description }) })
      const d = await res.json()
      if (d.status === 'saved') {
        setChatMessages(p => [...p, { role: 'assistant', content: `✅ **Guardado en el cerebro.**\n\n- Archivo: \`${d.path}\`\n- Wiki: \`${d.wiki_path}\`\n- Grafo actualizado: ${d.graph_updated ? '✓' : '✗'}` }])
        await loadWikiGraph(); await loadData()
      }
    } catch {
      setChatMessages(p => [...p, { role: 'assistant', content: 'Error al guardar' }])
    } finally { setChatLoading(false) }
  }

  // === Cerebro ===
    async function handleCerebroDelete() {
      // ponytail: keys = "estructura|raw|path" o "raw|path" o "outputs|path"
      const items = Object.entries(cerebroSelected).filter(([, v]) => v).map(([k]) => {
        const parts = k.split('|')
        // si primer parte es 'estructura', la segunda es la category real
        const category = parts[0] === 'estructura' ? parts[1] : parts[0]
        const path = parts[0] === 'estructura' ? parts.slice(2).join('|') : parts.slice(1).join('|')
        return { category, path }
      })
      if (!items.length) return
      if (!confirm(`¿Eliminar ${items.length} archivo(s)?`)) return
      setCerebroDeleting(true)
      try {
        const d = await (await fetch('/api/vault/batch-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(items) })).json()
        if (d.errors?.length) alert('Errores: ' + d.errors.map(e => e.path).join(', '))
        setCerebroSelected({}); await loadCerebroFiles(); await loadWikiGraph(); await loadProjects()
      } catch {} finally { setCerebroDeleting(false) }
    }

  // === Settings handlers ===
  async function handleSaveHermesKey() {
    if (!hermesKey.trim()) return
    setKeySaving(true); setKeyMessage('')
    try {
      const d = await (await fetch('/api/agents/hermes/key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: hermesKey.trim() }) })).json()
      if (d.success) { setKeyMessage('✅ Guardada'); setKeyMessageType('success'); setHermesKey(''); await loadAgentKeys(); await loadData() }
      else { setKeyMessage('❌ ' + (d.message || '')); setKeyMessageType('error') }
    } catch { setKeyMessage('❌ Error'); setKeyMessageType('error') } finally { setKeySaving(false) }
  }

  async function handleDeleteHermesKey() {
    if (!confirm('¿Eliminar API key?')) return
    setKeySaving(true)
    try {
      const d = await (await fetch('/api/agents/hermes/key', { method: 'DELETE' })).json()
      if (d.success) { setKeyMessage('✅ Eliminada'); setKeyMessageType('success'); await loadAgentKeys(); await loadData() }
      else { setKeyMessage('❌ ' + (d.message || '')); setKeyMessageType('error') }
    } catch { setKeyMessage('❌ Error'); setKeyMessageType('error') } finally { setKeySaving(false) }
  }

  async function handleSaveAgentEdit() {
    setEditSaving(true); setEditMessage('')
    try {
      const d = await (await fetch('/api/agent/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentName: editAgentName || 'Hermes', personality: editPersonality || '' }) })).json()
      if (d.success) { setEditMessage('✅ Actualizado'); setEditMessageType('success'); setEditingAgent(false); await loadAgentConfig() }
      else { setEditMessage('❌ ' + (d.message || '')); setEditMessageType('error') }
    } catch { setEditMessage('❌ Error'); setEditMessageType('error') } finally { setEditSaving(false) }
  }

  async function handleRestartAgent() {
    if (!confirm('¿Reiniciar agente?')) return
    setRestarting(true)
    try { const d = await (await fetch('/api/agent/restart', { method: 'POST' })).json(); alert(d.success ? '✅ ' + d.message : '❌ ' + d.message) }
    catch { alert('❌ Error') } finally { setRestarting(false) }
  }

  async function handleResetConfig() {
    if (!confirm('⚠️ Esto borrará la configuración. Tus notas NO se pierden.')) return
    if (!confirm('¿Confirmar?')) return
    try { await fetch('/api/init/reset', { method: 'DELETE' }); window.location.reload() } catch { alert('Error') }
  }

  async function handleExportVault(name) {
    setVaultMessage('⏳ Exportando...'); setVaultMessageType('info')
    try {
      const blob = await (await fetch('/api/vault/export')).blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${name}.tar.gz`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
      setVaultMessage('✅ Exportado'); setVaultMessageType('success')
      setTimeout(() => setShowExportPopup(false), 1000)
    } catch { setVaultMessage('❌ Error'); setVaultMessageType('error') }
  }

  async function handleImportVault(file) {
    if (!confirm('⚠️ Importar reemplazará datos actuales.')) return
    setVaultImporting(true); setVaultMessage('⏳ Importando...'); setVaultMessageType('info')
    try {
      const fd = new FormData(); fd.append('file', file)
      const d = await (await fetch('/api/vault/import', { method: 'POST', body: fd })).json()
      if (d.success) {
        setVaultMessage('✅ Importado. Recargando...'); setVaultMessageType('success')
        alert('✅ Importación correcta.\n\nLa página se recargará para cargar todos los datos (grafos, wiki, proyectos).')
        setTimeout(() => window.location.reload(), 500)
      }
      else { setVaultMessage('❌ ' + (d.message || '')); setVaultMessageType('error') }
    } catch { setVaultMessage('❌ Error'); setVaultMessageType('error') } finally { setVaultImporting(false) }
  }

  // === Drag-drop ===
  const handleChatDragOver = (e) => { e.preventDefault(); setChatDragOver(true) }
  const handleChatDragLeave = (e) => { e.preventDefault(); setChatDragOver(false) }
  const handleChatDrop = (e) => { e.preventDefault(); setChatDragOver(false); if (e.dataTransfer.files?.length) { Array.from(e.dataTransfer.files).forEach(f => handleUploadChatFile(f)) } }

  // === Render ===
  if (agentStarting) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Iniciando el agente... Esto puede tomar unos minutos.</p>
      </div>
    )
  }

  if (!loading && !isConfigured) return <SetupWizard onComplete={handleWizardComplete} />

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando Cerebro Virtual...</p>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <VersionBanner />
      <Header status={status} />
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} agentName={editAgentName} />
      <main className="app-main">
        {activeTab === 'dashboard' && <DashboardView vaultInfo={vaultInfo} systemInfo={systemInfo} containers={containers} editAgentName={editAgentName} />}
        {activeTab === 'chat' && (
          <ChatView editAgentName={editAgentName} chatMessages={chatMessages} chatMessage={chatMessage} chatLoading={chatLoading}
            chatUploading={chatUploading} chatAttachedFile={chatAttachedFile} chatDragOver={chatDragOver}
            setChatMessage={setChatMessage} setChatAttachedFile={setChatAttachedFile}
            onSend={handleSendChat} onUploadFile={handleUploadChatFile}
            onDragOver={handleChatDragOver} onDragLeave={handleChatDragLeave} onDrop={handleChatDrop} fileInputRef={fileInputRef}
            onRefreshGraph={loadWikiGraph} onReloadProjects={loadProjects} projects={projects}
            onInvestigate={handleInvestigate} onSaveOutput={handleSaveOutput}
            activeSessionId={activeSessionId} sessions={sessions}
            onNewSession={createNewSession} onSwitchSession={switchToSession}
            onDeleteSession={deleteSession} onRenameSession={renameSession}
            chatSmart={chatSmart} setChatSmart={setChatSmart}
            cerebroMode={cerebroMode} setCerebroMode={setCerebroMode}
            internetMode={internetMode} setInternetMode={setInternetMode}
            investigationMode={investigationMode} setInvestigationMode={setInvestigationMode}
            selectedMessages={selectedMessages} setSelectedMessages={setSelectedMessages} />
        )}
        {activeTab === 'cerebro' && (
          <CerebroView subtab={cerebroSubtab} setSubtab={setCerebroSubtab} rawFiles={rawFiles} outputFiles={outputFiles}
            search={cerebroSearch} setSearch={setCerebroSearch} selected={cerebroSelected} setSelected={setCerebroSelected}
            onDelete={handleCerebroDelete} deleting={cerebroDeleting} onReloadRaw={loadCerebroFiles} onRefreshGraph={loadWikiGraph} onReloadProjects={loadProjects} />
        )}
        {activeTab === 'graph' && <GrafoView nodes={wikiGraph.nodes || []} edges={wikiGraph.edges || []} refreshKey={wikiGraph} projects={projects} />}
        {activeTab === 'modelos' && <ModelosView />}
        {activeTab === 'settings' && (
          <AjustesView editAgentName={editAgentName} editPersonality={editPersonality} editingAgent={editingAgent}
            editSaving={editSaving} editMessage={editMessage} editMessageType={editMessageType} restarting={restarting}
            hermesKey={hermesKey} setHermesKey={setHermesKey} keySaving={keySaving} keyMessage={keyMessage} keyMessageType={keyMessageType}
            agentKeys={agentKeys} systemInfo={systemInfo} status={status} vaultMessage={vaultMessage} vaultMessageType={vaultMessageType} vaultImporting={vaultImporting}
            onEdit={() => setEditingAgent(true)} onCancelEdit={() => { setEditingAgent(false); loadAgentConfig() }}
            onSaveEdit={handleSaveAgentEdit} setEditAgentName={setEditAgentName} setEditPersonality={setEditPersonality}
            onRestart={handleRestartAgent} onSaveKey={handleSaveHermesKey} onDeleteKey={handleDeleteHermesKey}
            onExport={() => { setVaultMessage(''); setShowExportPopup(true) }} onImport={handleImportVault} onReset={handleResetConfig} />
        )}
        {showExportPopup && <ExportPopup onClose={() => setShowExportPopup(false)} onExport={handleExportVault} vaultMessage={vaultMessage} vaultMessageType={vaultMessageType} />}
      </main>
      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default App