import React, { useRef, useState, useEffect } from 'react'
import AddFilesPopup from '../shared/AddFilesPopup'
import MarkdownViewer from '../shared/MarkdownViewer'

function ChatView({ editAgentName, chatMessages, chatMessage, chatLoading, chatUploading, chatAttachedFile, chatDragOver,
  setChatMessage, setChatAttachedFile, onSend, onUploadFile, onDragOver, onDragLeave, onDrop, fileInputRef, onRefreshGraph, projects, onReloadProjects,
  onInvestigate, onSaveOutput,
  activeSessionId, sessions, onNewSession, onSwitchSession, onDeleteSession, onRenameSession,
  chatSmart, setChatSmart, cerebroMode, setCerebroMode, internetMode, setInternetMode,
  investigationMode, setInvestigationMode, selectedMessages, setSelectedMessages,
  iaMode, iaLocal, onToggleIaLocal }) {

  const [showAddPopup, setShowAddPopup] = useState(false)
  const [showSessionPanel, setShowSessionPanel] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameText, setRenameText] = useState('')
  const [saveProjectId, setSaveProjectId] = useState('individual')
  const [previewDoc, setPreviewDoc] = useState(null)
  const [showSavePopup, setShowSavePopup] = useState(null) // ponytail: {content} — popup añadir al cerebro
  const [saveName, setSaveName] = useState('')
  const [saveDesc, setSaveDesc] = useState('')
  const [saveProjectMode, setSaveProjectMode] = useState('existing') // existing | new
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')
  const [newProjectColor, setNewProjectColor] = useState('#4edea3')
  const prevSmartRef = useRef(false) // ponytail: restaurar chatSmart al desactivar cerebro
  const messagesRef = useRef(null) // ponytail: auto-scroll al enviar
  const bottomRef = useRef(null) // ponytail: anchor para scrollIntoView

  // ponytail: auto-scroll al fondo cuando llegan mensajes nuevos o loading
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [chatMessages, chatLoading])

  const handleFileSelect = (files) => {
    if (!files || !files.length) return
    Array.from(files).forEach(file => onUploadFile(file))
  }

  const previewIcon = (type) => ({ image: 'image', audio: 'audio_file', video: 'movie', document: 'description' }[type] || 'description')

  const handleClosePopup = () => {
    setShowAddPopup(false)
    onRefreshGraph?.()
  }

  const handleDownload = (content, query) => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${query.slice(0, 40).replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const toggleCerebro = () => {
    if (!cerebroMode) {
      prevSmartRef.current = chatSmart
      setChatSmart(false)
      setCerebroMode(true)
    } else {
      setCerebroMode(false)
      setInternetMode(false)
      setChatSmart(prevSmartRef.current)
    }
  }

  const toggleMessageSelection = (idx) => {
    setSelectedMessages(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])
  }

  const handleSaveSubmit = async () => {
    let projectId = saveProjectId
    if (saveProjectMode === 'new' && newProjectName.trim()) {
      try {
        const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newProjectName, description: newProjectDesc, color: newProjectColor }) })
        const d = await res.json()
        if (d.id) {
          projectId = d.id
          // ponytail: refrescar lista de proyectos para que el nuevo aparezca
          onReloadProjects?.()
        } else {
          console.error('Proyecto creado sin id:', d)
        }
      } catch (e) { console.error('Error creando proyecto:', e) }
    }
    await onSaveOutput?.(showSavePopup.content, projectId, saveName, saveDesc)
    setShowSavePopup(null); setSaveName(''); setSaveDesc(''); setSaveProjectMode('existing')
  }

  return (
    <div
      style={{ position: 'relative', minHeight: 'calc(100vh - 72px - 2 * var(--space-7))', display: 'flex', flexDirection: 'column' }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {chatDragOver && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(173,198,255,0.15)', border: '3px dashed var(--color-primary)', borderRadius: 'var(--radius-lg)', zIndex: 10, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-primary)', background: 'var(--color-bg)', padding: '1rem 2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary)' }}>Suelta tu archivo aquí</div>
        </div>
      )}

      {/* Chat header — botón Chats + título sesión */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-surface-high)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button className="btn-app btn-app-secondary" onClick={() => setShowSessionPanel(!showSessionPanel)} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>forum</span>
            Chats
          </button>
          <h2 style={{ fontSize: 24, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>chat</span>
            Habla con {editAgentName || 'Hermes'}
          </h2>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Panel lateral sesiones */}
        {showSessionPanel && (
          <div style={{ width: 260, borderRight: '1px solid var(--color-surface-high)', overflowY: 'auto', flexShrink: 0, paddingRight: 'var(--space-3)' }}>
            <button className="btn-app btn-app-primary" onClick={() => { onNewSession?.(); setShowSessionPanel(false) }} style={{ width: '100%', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              Nuevo chat
            </button>
            {(sessions || []).map(s => (
              <div key={s.id} style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-2)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: s.id === activeSessionId ? 'var(--color-surface-container)' : 'transparent', border: '1px solid', borderColor: s.id === activeSessionId ? 'var(--color-primary)' : 'var(--color-surface-high)', transition: 'all var(--transition-fast)' }}
                onClick={() => { onSwitchSession?.(s.id); setShowSessionPanel(false) }}>
                {renamingId === s.id ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input className="input-app" style={{ flex: 1, fontSize: 13 }} value={renameText} onChange={e => setRenameText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { onRenameSession?.(s.id, renameText); setRenamingId(null) } }} autoFocus />
                    <button className="btn-app btn-app-secondary" style={{ padding: '2px 6px' }} onClick={e => { e.stopPropagation(); onRenameSession?.(s.id, renameText); setRenamingId(null) }}>✓</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.title || 'Sin título'}</span>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button onClick={e => { e.stopPropagation(); setRenamingId(s.id); setRenameText(s.title || '') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: '2px' }}><span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span></button>
                      <button onClick={e => { e.stopPropagation(); onDeleteSession?.(s.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', padding: '2px' }}><span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span></button>
                    </div>
                  </div>
                )}
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)', marginTop: 2 }}>{s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : ''}</div>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <div ref={messagesRef} style={{ flex: 1, overflowY: 'auto', marginBottom: 'var(--space-4)', paddingLeft: showSessionPanel ? 'var(--space-4)' : 0 }}>
          {chatMessages.length === 0 && !chatLoading && (
            <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '3rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3 }}>forum</span>
              <p style={{ marginTop: 'var(--space-3)' }}>Pregúntale a {editAgentName || 'Hermes'} sobre tu cerebro virtual.</p>
            </div>
          )}
          {chatMessages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 'var(--space-4)', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
              {investigationMode && (
                <input type="checkbox" checked={selectedMessages.includes(i)} onChange={() => toggleMessageSelection(i)} style={{ marginTop: 8, cursor: 'pointer', accentColor: 'var(--color-primary)' }} />
              )}
              <div style={{
                maxWidth: '75%', padding: 'var(--space-4) var(--space-5)',
                borderRadius: 'var(--radius-md)',
                borderTopRightRadius: msg.role === 'user' ? '2px' : 'var(--radius-md)',
                borderTopLeftRadius: msg.role === 'assistant' ? '2px' : 'var(--radius-md)',
                // ponytail: highlight visual si mensaje está seleccionado en modo investigar
                background: investigationMode && selectedMessages.includes(i) ? 'rgba(173,198,255,0.15)' : msg.role === 'user' ? 'var(--color-surface-high)' : 'var(--color-surface-container)',
                border: investigationMode && selectedMessages.includes(i) ? '1px solid var(--color-primary)' : '1px solid var(--color-surface-high)',
                borderLeft: msg.role === 'assistant' ? '3px solid var(--color-primary)' : '1px solid var(--color-surface-high)',
              }}>
                {msg.role === 'assistant' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>electric_bolt</span>
                    <span className="label-caps" style={{ color: 'var(--color-primary)' }}>{(editAgentName || 'HERMES').toUpperCase()}</span>
                    {/* ponytail: badge 🔒/☁️ = estado del toggle al enviar (ctx.local persiste en sesión) */}
                    {msg.context && typeof msg.context.local === 'boolean' && (
                      <span title={msg.context.local ? 'Respuesta generada localmente (privada)' : 'Respuesta generada por cloud'} style={{ fontSize: 13 }}>{msg.context.local ? '🔒' : '☁️'}</span>
                    )}
                  </div>
                )}
                <div style={{ lineHeight: 1.6, fontSize: 15 }}>
                  {/* ponytail: markdown en burbujas — MarkdownViewer ya existente; fallback pre-wrap para user/errores */}
                  {msg.role === 'assistant'
                    ? <MarkdownViewer content={msg.content} />
                    : <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>}
                  {msg.attachment && (
                    <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-surface-high)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-surface-high)', fontSize: '0.85rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>attach_file</span>
                      {msg.attachment.name}
                    </div>
                  )}
                </div>
                {/* ponytail: botones post-respuesta de investigación — usan fullDoc, no el resumen del bubble */}
                {msg.role === 'assistant' && msg.context && msg.context.is_document && msg.context.offer_save && (
                  <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <button className="chat-action-btn" onClick={() => handleDownload(msg.fullDoc || msg.content, msg._originalQuery || 'investigacion')} disabled={chatLoading}>⬇️ Descargar</button>
                    <button className="chat-action-btn" onClick={() => setPreviewDoc({ content: msg.fullDoc || msg.content, query: msg._originalQuery })} disabled={chatLoading}>👁️ Visualizar</button>
                    <button className="chat-action-btn primary" onClick={() => { setShowSavePopup({ content: msg.fullDoc || msg.content }); setSaveName(''); setSaveDesc('') }} disabled={chatLoading}>🧠 Añadir al cerebro</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {chatLoading && (
            // ponytail: loading text dinámico según modo activo
            (() => {
              const loadingText = investigationMode ? 'Investigando...' : cerebroMode ? 'Buscando en mi cerebro...' : chatSmart ? 'Pensamiento profundo...' : 'Pensando...'
              const loadingIcon = investigationMode ? 'search' : cerebroMode ? 'psychology' : chatSmart ? 'auto_awesome' : 'lightbulb'
              return (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: 'var(--space-4) var(--space-5)', background: 'var(--color-surface-container)', borderRadius: 'var(--radius-md)', borderTopLeftRadius: '2px', borderLeft: '3px solid var(--color-primary)', border: '1px solid var(--color-surface-high)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, animation: 'spin 2s linear infinite', display: 'inline-block' }}>{loadingIcon}</span>
                  {loadingText}
                </div>
              </div>
            </div>
              )
            })()
          )}
          {chatUploading && (
            <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 'var(--space-3)' }}>
              <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>sync</span>
              Subiendo y procesando...
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Attached file preview */}
      {chatAttachedFile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary)', marginBottom: 'var(--space-2)', maxWidth: 320 }}>
          {chatAttachedFile.preview_type === 'image' && chatAttachedFile.local_url && (
            <img src={chatAttachedFile.local_url || `/vault-static/${chatAttachedFile.path}`} alt={chatAttachedFile.name} style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
          )}
          {chatAttachedFile.preview_type !== 'image' && (
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--color-text-tertiary)' }}>{previewIcon(chatAttachedFile.preview_type)}</span>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chatAttachedFile.name}</div>
            <div style={{ fontSize: '0.75rem', color: chatAttachedFile.wiki_path ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}>{chatAttachedFile.wiki_path ? 'Wiki indexado' : 'Procesando…'}</div>
          </div>
          <button onClick={() => setChatAttachedFile(null)} style={{ background: 'var(--color-error)', color: 'white', border: 'none', borderRadius: 'var(--radius-full)', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
          </button>
        </div>
      )}

      {/* Barra de botones + input */}
      <div style={{ position: 'sticky', bottom: 0, paddingTop: 'var(--space-4)' }}>
        <div style={{ marginBottom: 'var(--space-2)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-app btn-app-secondary" onClick={() => setShowAddPopup(true)} disabled={chatLoading || chatUploading} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            Añadir archivos
          </button>
          {/* Chat inteligente — toggle */}
          <button onClick={() => setChatSmart(!chatSmart)} disabled={chatLoading || cerebroMode}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', cursor: chatLoading || cerebroMode ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, background: chatSmart ? 'var(--color-primary)' : 'var(--color-surface-high)', border: chatSmart ? '1px solid var(--color-primary)' : '1px solid var(--color-border)', color: chatSmart ? '#0e0e0e' : 'var(--color-text-secondary)', opacity: cerebroMode ? 0.4 : 1, transition: 'all var(--transition-fast)' }}
            title="Chat con modelo más inteligente">
            <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: chatSmart ? "'FILL' 1" : 'normal' }}>auto_awesome</span>
            Chat inteligente
          </button>
          {/* Cerebro — toggle */}
          <button onClick={toggleCerebro} disabled={chatLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', cursor: chatLoading ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, background: cerebroMode ? 'var(--color-success)' : 'var(--color-surface-high)', border: cerebroMode ? '1px solid var(--color-success)' : '1px solid var(--color-border)', color: cerebroMode ? '#0e0e0e' : 'var(--color-text-secondary)', transition: 'all var(--transition-fast)' }}
            title={cerebroMode ? 'Cerebro ON — busca en tu conocimiento' : 'Cerebro OFF — chat normal'}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: cerebroMode ? "'FILL' 1" : 'normal' }}>psychology</span>
            Cerebro
          </button>
          {/* Búsqueda Internet — solo visible si Cerebro ON */}
          {cerebroMode && (
            <button onClick={() => setInternetMode(!internetMode)} disabled={chatLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', cursor: chatLoading ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, background: internetMode ? 'var(--color-primary)' : 'var(--color-surface-high)', border: internetMode ? '1px solid var(--color-primary)' : '1px solid var(--color-border)', color: internetMode ? '#0e0e0e' : 'var(--color-text-secondary)', transition: 'all var(--transition-fast)' }}
              title="Buscar también en internet">
              <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: internetMode ? "'FILL' 1" : 'normal' }}>public</span>
              Búsqueda en Internet
            </button>
          )}
          {/* ponytail: toggle Local/Cloud — solo en modo both (local/cloud fijos se muestran como estado) */}
          {iaMode && (iaMode.mode === 'both' || iaMode.localMode) && (
            <button onClick={() => iaMode.mode === 'both' && onToggleIaLocal?.()} disabled={chatLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', cursor: iaMode.mode === 'both' && !chatLoading ? 'pointer' : 'default', fontSize: 13, fontWeight: 600, background: iaLocal ? 'var(--color-success)' : '#f59e0b', border: '1px solid', borderColor: iaLocal ? 'var(--color-success)' : '#f59e0b', color: '#0e0e0e', transition: 'all var(--transition-fast)' }}
              title={iaMode.mode === 'both' ? (iaLocal ? 'Local — tus datos no salen de tu máquina' : 'Cloud — usa modelos en la nube') : (iaLocal ? 'Modo fijo: Local' : 'Modo fijo: Cloud')}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{iaLocal ? 'lock' : 'cloud'}</span>
              {iaLocal ? 'Local' : 'Cloud'}
            </button>
          )}
          {/* Investigar — toggle. Cuando activo, botón Investigar envía el input directo sin seleccionar mensajes */}
          <div style={{ marginLeft: 'auto' }}>
            {investigationMode ? (
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button className="btn-app btn-app-secondary" onClick={() => { setInvestigationMode(false); setSelectedMessages([]) }} disabled={chatLoading}>Cancelar</button>
                <button className="btn-app btn-app-primary" onClick={() => {
                  if (chatMessage.trim()) {
                    onInvestigate?.([{ role: 'user', content: chatMessage }])
                    setChatMessage('')
                  } else if (selectedMessages.length > 0) {
                    onInvestigate?.(selectedMessages)
                  }
                }} disabled={chatLoading || (!chatMessage.trim() && selectedMessages.length === 0)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>search</span>
                  {chatMessage.trim() ? 'Investigar' : `Investigar (${selectedMessages.length})`}
                </button>
              </div>
            ) : (
              <button className="btn-app btn-app-secondary" onClick={() => setInvestigationMode(true)} disabled={chatLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>search</span>
                Investigar
              </button>
            )}
          </div>
        </div>
        <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => { if (e.target.files.length) { handleFileSelect(e.target.files); e.target.value = '' } }} />
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', background: 'var(--color-surface-high)', border: `1.5px solid ${iaLocal ? 'var(--color-success)' : '#f59e0b'}`, borderRadius: 'var(--radius-md)', padding: 'var(--space-2)', transition: 'border-color var(--transition-fast)' }}>
          <button onClick={() => fileInputRef.current?.click()} disabled={chatLoading || chatUploading} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 'var(--space-2)' }} title="Adjuntar archivo rápido">
            <span className="material-symbols-outlined">attach_file</span>
          </button>
          <input className="input-app" style={{ background: 'transparent', border: 'none', flex: 1 }}
            value={chatMessage} onChange={(e) => setChatMessage(e.target.value)}
            // ponytail: en modo investigar, Enter envía directo a investigate
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (investigationMode && chatMessage.trim()) { onInvestigate?.([{ role: 'user', content: chatMessage }]); setChatMessage('') } else { onSend() } } }}
            placeholder={cerebroMode ? (internetMode ? 'Pregunta al cerebro + internet...' : 'Pregunta al cerebro...') : 'Escribe tu pregunta... (arrastra archivos para adjuntar)'}
            disabled={chatLoading} />
          <button onClick={onSend} disabled={chatLoading || chatUploading} className="btn-app btn-app-primary" style={{ padding: 'var(--space-2) var(--space-3)' }}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
          </button>
        </div>
      </div>

      {/* Vista previa modal */}
      {previewDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }} onClick={() => setPreviewDoc(null)}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-high)', borderRadius: 'var(--radius-lg)', maxWidth: 700, maxHeight: '80vh', width: '100%', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-surface-high)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>description</span>Vista previa
              </h3>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button className="chat-action-btn" onClick={() => handleDownload(previewDoc.content, previewDoc.query)}>⬇️ Descargar .md</button>
                <button className="chat-action-btn primary" onClick={() => { setShowSavePopup({ content: previewDoc.content }); setPreviewDoc(null); setSaveName(''); setSaveDesc('') }}>🧠 Añadir al cerebro</button>
                <button onClick={() => setPreviewDoc(null)} className="btn-app btn-app-secondary" style={{ width: 32, height: 32, padding: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', padding: 'var(--space-5)', flex: 1 }}>{previewDoc && <MarkdownViewer content={previewDoc.content} />}</div>
          </div>
        </div>
      )}

      {/* Popup añadir al cerebro */}
      {showSavePopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }} onClick={() => setShowSavePopup(null)}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-high)', borderRadius: 'var(--radius-lg)', maxWidth: 480, width: '100%', padding: 'var(--space-6)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-primary)', marginBottom: 'var(--space-4)' }}>Añadir al cerebro</h3>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>Nombre del documento</label>
              <input className="input-app" style={{ width: '100%' }} value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Auto-generado si vacío" />
            </div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>Descripción</label>
              <input className="input-app" style={{ width: '100%' }} value={saveDesc} onChange={e => setSaveDesc(e.target.value)} placeholder="Descripción opcional" />
            </div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>Asignar a proyecto</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <button className={saveProjectMode === 'existing' ? 'btn-app btn-app-primary' : 'btn-app btn-app-secondary'} onClick={() => setSaveProjectMode('existing')} style={{ fontSize: 13 }}>Proyecto existente</button>
                <button className={saveProjectMode === 'new' ? 'btn-app btn-app-primary' : 'btn-app btn-app-secondary'} onClick={() => setSaveProjectMode('new')} style={{ fontSize: 13 }}>Crear proyecto</button>
              </div>
              {saveProjectMode === 'existing' ? (
                <select className="input-app" style={{ width: '100%' }} value={saveProjectId} onChange={e => setSaveProjectId(e.target.value)}>
                  <option value="individual">Individual (sin proyecto)</option>
                  {(projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <input className="input-app" placeholder="Nombre del proyecto" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} />
                  <input className="input-app" placeholder="Descripción" value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <label style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Color:</label>
                    <input type="color" value={newProjectColor} onChange={e => setNewProjectColor(e.target.value)} style={{ width: 40, height: 30, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn-app btn-app-secondary" onClick={() => setShowSavePopup(null)}>Cancelar</button>
              <button className="btn-app btn-app-primary" onClick={handleSaveSubmit} disabled={chatLoading}>Añadir al cerebro</button>
            </div>
          </div>
        </div>
      )}

      {showAddPopup && <AddFilesPopup onClose={handleClosePopup} projects={projects || []} onReloadProjects={onReloadProjects} />}

      <style>{`.chat-action-btn{padding:4px 12px;background:var(--color-surface-high);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:var(--radius-md);cursor:pointer;font-size:13px}.chat-action-btn:hover{background:var(--color-surface-container)}.chat-action-btn.primary{background:var(--color-primary);color:#0e0e0e;border-color:var(--color-primary)}.chat-action-btn:disabled{opacity:.5;cursor:default}.chat-action-select{padding:4px 8px;background:var(--color-surface-high);color:var(--color-text-primary);border:1px solid var(--color-border);border-radius:var(--radius-sm);font-size:13px}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default ChatView
