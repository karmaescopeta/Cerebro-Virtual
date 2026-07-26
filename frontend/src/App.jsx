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
import AjustesView from './components/views/AjustesView'

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

  // Cerebro
  const [cerebroSubtab, setCerebroSubtab] = useState('raw')
  const [rawFiles, setRawFiles] = useState([])
  const [outputFiles, setOutputFiles] = useState([])
  const [cerebroSearch, setCerebroSearch] = useState('')
  const [cerebroSelected, setCerebroSelected] = useState({})
  const [cerebroDeleting, setCerebroDeleting] = useState(false)

  // Vault
  const [vaultMessage, setVaultMessage] = useState('')
  const [vaultMessageType, setVaultMessageType] = useState('')
  const [vaultImporting, setVaultImporting] = useState(false)
  const importFileRef = useRef(null)

  useEffect(() => { checkConfiguration() }, [])
  useEffect(() => { if (activeTab === 'cerebro') loadCerebroFiles() }, [activeTab])

  // === Data loading ===
  async function checkConfiguration() {
    try {
      const res = await fetch('/api/init/status')
      const data = await res.json()
      setIsConfigured(data.configured)
      if (data.configured) {
        await startAgent()
        await Promise.all([loadData(), loadAgentKeys(), loadAgentConfig(), loadSystemInfo(), loadContainersStatus(), loadWikiGraph()])
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
        await Promise.all([loadData(), loadAgentKeys(), loadAgentConfig(), loadSystemInfo(), loadContainersStatus(), loadWikiGraph()])
      }
    } finally { setAgentStarting(false) }
  }

  // === Chat ===
  async function handleUploadChatFile(file) {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['pdf','png','jpg','jpeg','gif','webp','txt','md','markdown','mp3','wav','ogg','m4a','mp4','webm','mov','csv','json','yaml','yml'].includes(ext)) { alert('Tipo no soportado'); return }
    setChatUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const d = await (await fetch('/api/vault/upload?topic=chat', { method: 'POST', body: fd })).json()
      if (d.success || d.path || d.name) {
        const fn = d.name || file.name
        setChatAttachedFile({ name: fn, path: `raw/chat/${fn}`, preview_type: d.preview_type || 'document', wiki_path: d.wiki_path, size: d.file_size, local_url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null })
        if (d.wiki_path) { setChatMessages(p => [...p, { role: 'assistant', content: `✅ ${fn} procesado → ${d.wiki_path}` }]); await loadData(); await loadWikiGraph() }
      } else { alert('Error: ' + (d.message || 'desconocido')) }
    } catch { alert('Error al subir') } finally { setChatUploading(false) }
  }

  async function handleSendChat() {
    if (!chatMessage.trim() && !chatAttachedFile) return
    setChatLoading(true)
    let msg = chatMessage
    if (chatAttachedFile) {
      const note = `El usuario ha subido el archivo «${chatAttachedFile.name}» que ya está guardado en raw/chat/${chatAttachedFile.name}. Procésalo si es necesario.`
      msg = msg ? `${msg}\n\n${note}` : note
    }
    setChatMessages(p => [...p, { role: 'user', content: msg, attachment: chatAttachedFile }])
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) })
      let txt = ''
      if (!res.ok) { const e = await res.json().catch(() => ({})); txt = 'Error: ' + (e.detail || e.message || `HTTP ${res.status}`) }
      else { const d = await res.json(); txt = d.response || d.message || d.reply || 'Sin respuesta' }
      setChatMessages(p => [...p, { role: 'assistant', content: txt }])
      setChatMessage(''); setChatAttachedFile(null)
    } catch {
      try {
        const d = await (await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) })).json()
        setChatMessages(p => [...p, { role: 'assistant', content: d.response || 'Sin respuesta' }])
        setChatMessage(''); setChatAttachedFile(null)
      } catch { setChatMessages(p => [...p, { role: 'assistant', content: 'Error al conectar con ' + (editAgentName || 'Hermes') }]) }
    } finally { setChatLoading(false) }
  }

  // === Cerebro ===
  async function handleCerebroDelete() {
    const items = Object.entries(cerebroSelected).filter(([, v]) => v).map(([k]) => { const [cat, ...p] = k.split('|'); return { category: cat, path: p.join('|') } })
    if (!items.length) return
    if (!confirm(`¿Eliminar ${items.length} archivo(s)?`)) return
    setCerebroDeleting(true)
    try {
      const d = await (await fetch('/api/vault/batch-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(items) })).json()
      if (d.errors?.length) alert('Errores: ' + d.errors.map(e => e.path).join(', '))
      setCerebroSelected({}); await loadCerebroFiles(); await loadWikiGraph()
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

  async function handleExportVault() {
    setVaultMessage('⏳ Exportando...'); setVaultMessageType('info')
    try {
      const blob = await (await fetch('/api/vault/export')).blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'vault-export.tar.gz'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
      setVaultMessage('✅ Exportado'); setVaultMessageType('success')
    } catch { setVaultMessage('❌ Error'); setVaultMessageType('error') }
  }

  async function handleImportVault(file) {
    if (!confirm('⚠️ Importar reemplazará datos actuales.')) return
    setVaultImporting(true); setVaultMessage('⏳ Importando...'); setVaultMessageType('info')
    try {
      const fd = new FormData(); fd.append('file', file)
      const d = await (await fetch('/api/vault/import', { method: 'POST', body: fd })).json()
      if (d.success) { setVaultMessage('✅ Importado. Recargando...'); setVaultMessageType('success'); setTimeout(() => window.location.reload(), 1500) }
      else { setVaultMessage('❌ ' + (d.message || '')); setVaultMessageType('error') }
    } catch { setVaultMessage('❌ Error'); setVaultMessageType('error') } finally { setVaultImporting(false) }
  }

  // === Drag-drop ===
  const handleChatDragOver = (e) => { e.preventDefault(); setChatDragOver(true) }
  const handleChatDragLeave = (e) => { e.preventDefault(); setChatDragOver(false) }
  const handleChatDrop = (e) => { e.preventDefault(); setChatDragOver(false); if (e.dataTransfer.files?.length) handleUploadChatFile(e.dataTransfer.files[0]) }

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
      <Header status={status} />
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="app-main">
        {activeTab === 'dashboard' && <DashboardView vaultInfo={vaultInfo} systemInfo={systemInfo} containers={containers} editAgentName={editAgentName} />}
        {activeTab === 'chat' && (
          <ChatView editAgentName={editAgentName} chatMessages={chatMessages} chatMessage={chatMessage} chatLoading={chatLoading}
            chatUploading={chatUploading} chatAttachedFile={chatAttachedFile} chatDragOver={chatDragOver}
            setChatMessage={setChatMessage} setChatAttachedFile={setChatAttachedFile}
            onSend={handleSendChat} onUploadFile={handleUploadChatFile}
            onDragOver={handleChatDragOver} onDragLeave={handleChatDragLeave} onDrop={handleChatDrop} fileInputRef={fileInputRef} />
        )}
        {activeTab === 'cerebro' && (
          <CerebroView subtab={cerebroSubtab} setSubtab={setCerebroSubtab} rawFiles={rawFiles} outputFiles={outputFiles}
            search={cerebroSearch} setSearch={setCerebroSearch} selected={cerebroSelected} setSelected={setCerebroSelected}
            onDelete={handleCerebroDelete} deleting={cerebroDeleting} />
        )}
        {activeTab === 'graph' && <GrafoView nodes={wikiGraph.nodes || []} edges={wikiGraph.edges || []} />}
        {activeTab === 'settings' && (
          <AjustesView editAgentName={editAgentName} editPersonality={editPersonality} editingAgent={editingAgent}
            editSaving={editSaving} editMessage={editMessage} editMessageType={editMessageType} restarting={restarting}
            hermesKey={hermesKey} setHermesKey={setHermesKey} keySaving={keySaving} keyMessage={keyMessage} keyMessageType={keyMessageType}
            agentKeys={agentKeys} systemInfo={systemInfo} status={status} vaultMessage={vaultMessage} vaultMessageType={vaultMessageType} vaultImporting={vaultImporting}
            onEdit={() => setEditingAgent(true)} onCancelEdit={() => { setEditingAgent(false); loadAgentConfig() }}
            onSaveEdit={handleSaveAgentEdit} setEditAgentName={setEditAgentName} setEditPersonality={setEditPersonality}
            onRestart={handleRestartAgent} onSaveKey={handleSaveHermesKey} onDeleteKey={handleDeleteHermesKey}
            onExport={handleExportVault} onImport={handleImportVault} onReset={handleResetConfig} />
        )}
      </main>
      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default App