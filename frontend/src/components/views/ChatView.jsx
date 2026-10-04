import React, { useRef, useState, useEffect } from 'react'
import AddFilesPopup from '../shared/AddFilesPopup'
import MarkdownViewer from '../shared/MarkdownViewer'
import DocReader from '../shared/DocReader'
import { startSaveJob } from '../../mdSave'
import ResearchPanel from '../shared/ResearchPanel'

function ChatView({ editAgentName, chatMessages, chatMessage, chatLoading, chatUploading, chatAttachedFile, chatDragOver,
  setChatMessage, setChatAttachedFile, onSend, onUploadFile, onDragOver, onDragLeave, onDrop, fileInputRef, onRefreshGraph, projects, onReloadProjects,
  onInvestigate, onSaveOutput, brainUpdating,
  activeSessionId, sessions, onNewSession, onSwitchSession, onDeleteSession, onRenameSession,
  chatSmart, setChatSmart, cerebroMode, setCerebroMode, internetMode, setInternetMode,
  investigationMode, setInvestigationMode, selectedMessages, setSelectedMessages,
    researchPanel, onCloseResearch, onFetchResearchQuestions, onCreateResearch, onDeepenResearch, onLevelResearch,
      onConfirmTopic, onOpenInvestigation, onCancelInvestigation, onGenerateTopic, onToggleSelectMessages, onOpenResearch, onDismissResearch,
  researchHistory, onSetResearchView, onOpenHistoryDoc, onNewResearch,
      iaMode, iaLocal, onToggleIaLocal, toast }) {

    const touchXRef = useRef(null) // ponytail: swipe móvil — borde izq abre chats, deslizar a la izq cierra
    // fase 2 visor-md: preview del doc investigado desde el panel → DocReader (con edición)
    const [docPreview, setDocPreview] = useState(null)
  const handleTouchStart = (e) => { touchXRef.current = e.touches[0].clientX }
  const handleTouchMove = (e) => {
    if (touchXRef.current == null) return
    const dx = e.touches[0].clientX - touchXRef.current
    if (!showSessionPanel && touchXRef.current < 30 && dx > 60) { setShowSessionPanel(true); touchXRef.current = null }
    else if (showSessionPanel && dx < -60) { setShowSessionPanel(false); touchXRef.current = null }
  }

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
  const [newProjectColor, setNewProjectColor] = useState('#6FCF97')
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
      className="chat-root" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {chatDragOver && (
        <div style={{ position: 'absolute', inset: 0, background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', border: '3px dashed var(--color-primary)', borderRadius: 'var(--radius-lg)', zIndex: 10, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-primary)', background: 'var(--color-bg)', padding: '1rem 2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary)' }}>Suelta tu archivo aquí</div>
        </div>
      )}

      {/* Chat header — solo botón Chats (desktop); el título vive en la barra superior. Móvil: swipe */}
      <div className="chat-header" style={{ marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid color-mix(in srgb, var(--color-surface-high) 60%, transparent)' }}>
        <button className="chat-chats-btn btn-app btn-app-secondary" onClick={() => setShowSessionPanel(!showSessionPanel)}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>forum</span>
          Chats
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Panel lateral sesiones */}
        {showSessionPanel && (
          // ponytail: móvil → overlay full-ventana; desktop → columna lateral
          <div className="chat-sessions" style={{ width: 260, borderRight: '1px solid color-mix(in srgb, var(--color-surface-high) 60%, transparent)', overflowY: 'auto', flexShrink: 0, paddingRight: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                      <span className="label-caps">Chats</span>
                      {/* ponytail: en móvil fullscreen el botón Chats queda tapado — salida visible */}
                      <button onClick={() => setShowSessionPanel(false)} className="btn-app btn-app-secondary" style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                      </button>
                    </div>
                    <button className="btn-app btn-app-primary" onClick={() => { onNewSession?.(); setShowSessionPanel(false) }} style={{ width: '100%', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                      Nuevo chat
                    </button>
                    {(sessions || []).map(s => (
                      <div key={s.id} style={{ padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-2)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: s.id === activeSessionId ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent', border: '1px solid', borderColor: s.id === activeSessionId ? 'var(--color-primary)' : 'var(--color-surface-high)', transition: 'all var(--transition-fast)' }}
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
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--color-text-tertiary)', marginTop: 2 }}>{s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : ''}</div>
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
                      <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 'var(--space-5)', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                        {investigationMode && (
                          <input type="checkbox" checked={selectedMessages.includes(i)} onChange={() => toggleMessageSelection(i)} style={{ marginTop: 8, cursor: 'pointer', accentColor: 'var(--color-primary)' }} />
                        )}
                        {msg.role === 'assistant' && (
                          // ponytail: avatar agente — electric_bolt en círculo color-mix primary
                          <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-full)', background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>electric_bolt</span>
                          </div>
                        )}
                        <div style={{
                          maxWidth: '75%', padding: 'var(--space-4) var(--space-5)',
                          borderRadius: 'var(--radius-md)',
                          borderTopRightRadius: msg.role === 'user' ? '2px' : 'var(--radius-md)',
                          borderTopLeftRadius: msg.role === 'assistant' ? '2px' : 'var(--radius-md)',
                          // ponytail: menos bordes — solo borde cuando el mensaje está seleccionado en modo investigar
                          background: investigationMode && selectedMessages.includes(i) ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : msg.role === 'user' ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--color-surface-container)',
                          border: investigationMode && selectedMessages.includes(i) ? '1px solid var(--color-primary)' : 'none',
                        }}>
                          {msg.role === 'assistant' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                              <span className="label-caps" style={{ color: 'var(--color-primary)' }}>{(editAgentName || 'HERMES').toUpperCase()}</span>
                              {/* ponytail: badge chip Privado/Nube = estado del toggle al enviar (ctx.local persiste en sesión) */}
                              {msg.context && typeof msg.context.local === 'boolean' && (
                                <span title={msg.context.local ? 'Respuesta generada localmente (privada)' : 'Respuesta generada por nube'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', padding: '1px 8px', borderRadius: 'var(--radius-full)', background: `color-mix(in srgb, ${msg.context.local ? 'var(--color-success)' : 'var(--color-cloud)'} 15%, transparent)`, color: msg.context.local ? 'var(--color-success)' : 'var(--color-cloud)' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{msg.context.local ? 'lock' : 'cloud'}</span>
                                  {msg.context.local ? 'PRIVADO' : 'NUBE'}
                                </span>
                              )}
                            </div>
                          )}
                <div style={{ lineHeight: 1.6, fontSize: 15 }}>
                  {/* ponytail: markdown en burbujas — MarkdownViewer ya existente; fallback pre-wrap para user/errores */}
                  {msg.role === 'assistant'
                                      ? <MarkdownViewer content={msg.content} compact />
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
                    <button className="chat-action-btn" onClick={() => handleDownload(msg.full_doc || msg.fullDoc || msg.content, msg._originalQuery || 'investigacion')} disabled={chatLoading}><span className="material-symbols-outlined">download</span>Descargar</button>
                                                            <button className="chat-action-btn" onClick={() => setPreviewDoc({ content: msg.full_doc || msg.fullDoc || msg.content, query: msg._originalQuery, brainPath: (msg.context && msg.context.brain_path) || '' })} disabled={chatLoading}><span className="material-symbols-outlined">visibility</span>Visualizar</button>
                                                            <button className="chat-action-btn primary" onClick={() => { setShowSavePopup({ content: msg.full_doc || msg.fullDoc || msg.content }); setSaveName(''); setSaveDesc('') }} disabled={chatLoading}><span className="material-symbols-outlined">psychology</span>Añadir al cerebro</button>
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
              {/* ponytail: fila única nowrap — Investigar nunca cae de línea (queja desktop estrecho) */}
              <div className="chat-tools-row">
                <button className="btn-app btn-app-secondary" onClick={() => setShowAddPopup(true)} disabled={chatLoading || chatUploading} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', whiteSpace: 'nowrap', flexShrink: 1, minWidth: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                  <span className="chat-btn-label">Añadir archivos</span>
                </button>
                {/* Chat inteligente — toggle */}
                <button className={`chat-tool-btn${chatSmart ? ' active-primary' : ''}`} onClick={() => setChatSmart(!chatSmart)} disabled={chatLoading || cerebroMode}
                  style={{ opacity: cerebroMode ? 0.4 : undefined }}
                  title="Chat con modelo más inteligente">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: chatSmart ? "'FILL' 1" : 'normal' }}>auto_awesome</span>
                  <span className="chat-btn-label">Chat inteligente</span>
                </button>
                {/* Cerebro — toggle */}
                <button className={`chat-tool-btn${cerebroMode ? ' active-success' : ''}`} onClick={toggleCerebro} disabled={chatLoading}
                  title={cerebroMode ? 'Cerebro ON — busca en tu conocimiento' : 'Cerebro OFF — chat normal'}>
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: cerebroMode ? "'FILL' 1" : 'normal' }}>psychology</span>
                  <span className="chat-btn-label">Cerebro</span>
                </button>
                {/* Internet — solo visible si Cerebro ON */}
                {cerebroMode && (
                  <button className={`chat-tool-btn${internetMode ? ' active-primary' : ''}`} onClick={() => setInternetMode(!internetMode)} disabled={chatLoading}
                    title="Buscar también en internet">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: internetMode ? "'FILL' 1" : 'normal' }}>public</span>
                    <span className="chat-btn-label">Internet</span>
                  </button>
                )}
                {/* ponytail: toggle Privado/Nube — solo en modo both (fijos se muestran como estado) */}
                {iaMode && (iaMode.mode === 'both' || iaMode.localMode) && (
                  <button className={`chat-tool-btn${iaLocal ? ' active-success' : ' active-cloud'}`} onClick={() => iaMode.mode === 'both' && onToggleIaLocal?.()} disabled={chatLoading}
                    title={iaMode.mode === 'both' ? (iaLocal ? 'Privado — tus datos no salen de tu máquina' : 'Nube — usa modelos en la nube') : (iaLocal ? 'Modo fijo: Privado' : 'Modo fijo: Nube')}>
                    <span className="material-symbols-outlined">{iaLocal ? 'lock' : 'cloud'}</span>
                    <span className="chat-btn-label">{iaLocal ? 'Privado' : 'Nube'}</span>
                  </button>
                )}
                {/* Investigar — abre el panel directamente (tema tecleado o selección de mensajes). Sin botón primario: el panel manda */}
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                                                  {investigationMode ? (
                                                    <>
                                                      <button className="btn-app btn-app-secondary" onClick={onCancelInvestigation} disabled={chatLoading}>Cancelar</button>
                                                      <button className="btn-app btn-app-secondary" onClick={onOpenResearch} disabled={chatLoading}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', whiteSpace: 'nowrap' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>science</span>
                                                        Investigador
                                                      </button>
                                                    </>
                                                  ) : (
                                    <button className="btn-app btn-app-secondary" onClick={onOpenInvestigation} disabled={chatLoading}
                                      style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', whiteSpace: 'nowrap' }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>search</span>
                                      Investigar
                                    </button>
                                  )}
                                </div>
              </div>
        <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => { if (e.target.files.length) { handleFileSelect(e.target.files); e.target.value = '' } }} />
        {/* fase investigador: guardados en curso + modo cerebro → avisar que puede responder con datos aún no actualizados */}
        {cerebroMode && brainUpdating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-2)', borderRadius: 'var(--radius-md)', background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
            <span className="material-symbols-outlined research-spin" style={{ fontSize: 16 }}>progress_activity</span>
            Actualizando documentos del cerebro — el chat puede responder con datos aún no actualizados
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2)' }}>
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

      {/* Vista previa modal → DocReader */}
            {previewDoc && (
              <DocReader title="Vista previa" context={previewDoc.query} content={previewDoc.content} onClose={() => setPreviewDoc(null)}
                status={{ in_graph: !!previewDoc.brainPath, stale: false }}
                onSaveEdit={(draft) => {
                  // fase investigador: job en background — matraz anima + toast al terminar
                  const name = (draft.match(/^#\s+(.+)$/m) || [])[1] || previewDoc.query || 'investigacion'
                  startSaveJob({ path: previewDoc.brainPath, oldContent: previewDoc.content, newContent: draft, name, sessionId: activeSessionId }).catch(e => toast?.({ type: 'error', text: String(e.message || e) }))
                  setPreviewDoc(null)
                }}
                actions={[
                  <button key="dl" className="chat-action-btn" onClick={() => handleDownload(previewDoc.content, previewDoc.query)}><span className="material-symbols-outlined">download</span>Descargar .md</button>,
                  <button key="save" className="chat-action-btn primary" onClick={() => { setShowSavePopup({ content: previewDoc.content }); setPreviewDoc(null); setSaveName(''); setSaveDesc('') }}><span className="material-symbols-outlined">psychology</span>Añadir al cerebro</button>,
                ]} />
            )}

      {/* Investigador v2 — panel deslizante derecho (estado en App) */}
            {researchPanel && researchPanel.open && (
              <ResearchPanel panel={researchPanel} onClose={onCloseResearch} onQuestions={onFetchResearchQuestions}
                        onCreate={onCreateResearch} onDeepen={onDeepenResearch} onLevel={onLevelResearch}
                                  onConfirmTopic={onConfirmTopic}
                                  onGenerateTopic={onGenerateTopic}
                                  selectingMessages={investigationMode}
                                  onToggleSelectMessages={onToggleSelectMessages}
                                  researchHistory={researchHistory}
                                  onSetView={onSetResearchView}
                                  onOpenHistoryDoc={onOpenHistoryDoc}
                                  onNewResearch={onNewResearch}
                                  onDownload={handleDownload}
                                                      onSaveBrain={(content) => { setShowSavePopup({ content }); setSaveName(''); setSaveDesc('') }}
                                                      onPreviewDoc={(content, topic, brainPath) => setDocPreview({ content, topic, brainPath: brainPath || '' })}
                                                      toast={toast} />
                                                  )}

                                                  {/* fase 2 visor-md: Ver documento del investigador → DocReader (encima del panel, z-index 100 > 98) */}
                                                  {docPreview && (
                                                    <DocReader
                                                      title={docPreview.topic || 'Investigación'} context="Investigación" content={docPreview.content}
                                                      status={{ in_graph: !!docPreview.brainPath, stale: false }}
                                                      onClose={() => setDocPreview(null)}
                                                      onSaveEdit={(draft) => {
                                                        // fase investigador: job en background — matraz anima + toast al terminar
                                                        const name = (draft.match(/^#\s+(.+)$/m) || [])[1] || docPreview.topic || 'investigacion'
                                                        startSaveJob({ path: docPreview.brainPath, oldContent: docPreview.content, newContent: draft, name, sessionId: activeSessionId }).catch(e => toast?.({ type: 'error', text: String(e.message || e) }))
                                                        setDocPreview(null)
                                                      }}
                                                      actions={[
                                                        <a key="dl" className="chat-action-btn" download={`${(docPreview.topic || 'investigacion').slice(0, 40)}.md`} href={`data:text/markdown;charset=utf-8,${encodeURIComponent(docPreview.content)}`}>
                                                          <span className="material-symbols-outlined">download</span>Descargar
                                                        </a>,
                                                        <button key="brain" className="chat-action-btn primary" onClick={() => { setShowSavePopup({ content: docPreview.content }); setSaveName(''); setSaveDesc('') }}>
                                                          <span className="material-symbols-outlined">psychology</span>Añadir al cerebro
                                                        </button>,
                                                      ]} />
                                                  )}

                {/* fase 3: el cartel flotante de investigación se quitó — su función la cumple el icono TopRight (animado/bolita) */}

      {/* Popup añadir al cerebro */}
      {showSavePopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }} onClick={() => setShowSavePopup(null)}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-high)', borderRadius: 'var(--radius-lg)', maxWidth: 480, width: '100%', padding: 'var(--space-6)' }} onClick={e => e.stopPropagation()}>
            <span className="label-caps" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Guardar</span>
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
              <button className="btn-app btn-app-primary" onClick={handleSaveSubmit} disabled={chatLoading}>
                {chatLoading
                  ? <><span className="material-symbols-outlined research-spin" style={{ fontSize: 16 }}>progress_activity</span>Guardando…</>
                  : 'Añadir al cerebro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddPopup && <AddFilesPopup onClose={handleClosePopup} projects={projects || []} onReloadProjects={onReloadProjects} />}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default ChatView
