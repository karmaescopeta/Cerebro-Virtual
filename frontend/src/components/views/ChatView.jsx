import React, { useRef, useState } from 'react'

const ALLOWED_EXTS = ['pdf','png','jpg','jpeg','gif','webp','txt','md','markdown','mp3','wav','ogg','m4a','mp4','webm','mov','csv','json','yaml','yml']

function ChatView({ editAgentName, chatMessages, chatMessage, chatLoading, chatUploading, chatAttachedFile, chatDragOver,
  setChatMessage, setChatAttachedFile, onSend, onUploadFile, onDragOver, onDragLeave, onDrop, fileInputRef }) {

  const localRef = useRef(null)

  const handleFileSelect = (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!ALLOWED_EXTS.includes(ext)) { alert('Tipo no soportado: .' + ext); return }
    onUploadFile(file)
  }

  const previewIcon = (type) => ({ image: 'image', audio: 'audio_file', video: 'movie', document: 'description' }[type] || 'description')

  return (
    <div
      style={{ position: 'relative', minHeight: 'calc(100vh - 72px - 2 * var(--space-7))', display: 'flex', flexDirection: 'column' }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drag overlay */}
      {chatDragOver && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(173,198,255,0.15)', border: '3px dashed var(--color-primary)', borderRadius: 'var(--radius-lg)', zIndex: 10, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-primary)', background: 'var(--color-bg)', padding: '1rem 2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary)' }}>
            Suelta tu archivo aquí
          </div>
        </div>
      )}

      {/* Chat header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-surface-high)' }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>chat</span>
            Habla con {editAgentName || 'Hermes'}
          </h2>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 'var(--space-4)' }}>
        {chatMessages.length === 0 && !chatLoading && (
          <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '3rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3 }}>forum</span>
            <p style={{ marginTop: 'var(--space-3)' }}>Pregúntale a {editAgentName || 'Hermes'} sobre tu cerebro virtual.</p>
          </div>
        )}
        {chatMessages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 'var(--space-4)' }}>
            <div style={{
              maxWidth: '75%', padding: 'var(--space-4) var(--space-5)',
              borderRadius: 'var(--radius-md)',
              borderTopRightRadius: msg.role === 'user' ? '2px' : 'var(--radius-md)',
              borderTopLeftRadius: msg.role === 'assistant' ? '2px' : 'var(--radius-md)',
              background: msg.role === 'user' ? 'var(--color-surface-high)' : 'var(--color-surface-container)',
              border: '1px solid var(--color-surface-high)',
              borderLeft: msg.role === 'assistant' ? '3px solid var(--color-primary)' : '1px solid var(--color-surface-high)',
            }}>
              {msg.role === 'assistant' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>electric_bolt</span>
                  <span className="label-caps" style={{ color: 'var(--color-primary)' }}>{(editAgentName || 'HERMES').toUpperCase()}</span>
                </div>
              )}
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 15 }}>
                {msg.content}
                {msg.attachment && (
                  <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-surface-high)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-surface-high)', fontSize: '0.85rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>attach_file</span>
                    {msg.attachment.name}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {chatLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: 'var(--space-4) var(--space-5)', background: 'var(--color-surface-container)', borderRadius: 'var(--radius-md)', borderTopLeftRadius: '2px', borderLeft: '3px solid var(--color-primary)', border: '1px solid var(--color-surface-high)' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <span className="thinking-dot">●</span>
                <span className="thinking-dot">●</span>
                <span className="thinking-dot">●</span>
              </div>
            </div>
          </div>
        )}
        {chatUploading && (
          <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 'var(--space-3)' }}>
            <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>sync</span>
            Subiendo y procesando...
          </div>
        )}
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
            <div style={{ fontSize: '0.75rem', color: chatAttachedFile.wiki_path ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}>
              {chatAttachedFile.wiki_path ? 'Wiki indexado' : 'Procesando…'}
            </div>
          </div>
          <button onClick={() => setChatAttachedFile(null)} style={{ background: 'var(--color-error)', color: 'white', border: 'none', borderRadius: 'var(--radius-full)', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
          </button>
        </div>
      )}

      {/* Input */}
      <div style={{ position: 'sticky', bottom: 0, paddingTop: 'var(--space-4)' }}>
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) { handleFileSelect(e.target.files[0]); e.target.value = '' } }}
          accept={ALLOWED_EXTS.map(e => '.' + e).join(',')} />
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', background: 'var(--color-surface-high)', border: '1px solid var(--color-surface-high)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}>
          <button onClick={() => fileInputRef.current?.click()} disabled={chatLoading || chatUploading} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 'var(--space-2)' }} title="Adjuntar archivo">
            <span className="material-symbols-outlined">attach_file</span>
          </button>
          <input
            className="input-app"
            style={{ background: 'transparent', border: 'none', flex: 1 }}
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
            placeholder="Escribe tu pregunta... (arrastra archivos para adjuntar)"
            disabled={chatLoading}
          />
          <button onClick={onSend} disabled={chatLoading || chatUploading} className="btn-app btn-app-primary" style={{ padding: 'var(--space-2) var(--space-3)' }}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
          </button>
        </div>
      </div>

      <style>{`.thinking-dot{animation:blink 1.4s infinite both;font-size:8px;color:var(--color-text-tertiary)}.thinking-dot:nth-child(2){animation-delay:.2s}.thinking-dot:nth-child(3){animation-delay:.4s}@keyframes blink{0%{opacity:.2}20%{opacity:1}100%{opacity:.2}}`}</style>
    </div>
  )
}

export default ChatView