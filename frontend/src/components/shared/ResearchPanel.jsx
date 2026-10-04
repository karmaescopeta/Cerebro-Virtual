import React, { useState, useEffect } from 'react'
import MarkdownViewer from './MarkdownViewer'

// ponytail: panel de investigación v2 — estado vive en App (researchPanel); vive aquí por simetría con MarkdownViewer
// Pestañas: crear (confirm → questions → result) / ver investigaciones (de esta conversación)
function ResearchPanel({ panel, onClose, onQuestions, onCreate, onDeepen, onLevel, onConfirmTopic, onGenerateTopic,
  selectingMessages, onToggleSelectMessages, researchHistory, onSetView, onOpenHistoryDoc, onNewResearch, onDownload, onSaveBrain, onPreviewDoc }) {
  const [picks, setPicks] = useState({}) // ponytail: {i: {pick, free}} — opción marcada + texto libre por pregunta
  const [deepenText, setDeepenText] = useState('')
  const [topicDraft, setTopicDraft] = useState(panel.topic)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => { setPicks({}) }, [panel.questions])
  useEffect(() => { setTopicDraft(panel.topic) }, [panel.topic])

  const collected = () => panel.questions
    .map((q, i) => (picks[i]?.free || '').trim() || (picks[i]?.pick >= 0 ? q.options[picks[i].pick] : ''))
    .filter(Boolean)

  const togglePick = (i, j) => setPicks(p => ({ ...p, [i]: { pick: p[i]?.pick === j ? -1 : j, free: p[i]?.free || '' } }))
  const setFree = (i, v) => setPicks(p => ({ ...p, [i]: { pick: p[i]?.pick ?? -1, free: v } }))

  const closeBtn = (
    <button onClick={onClose} className="btn-app btn-app-secondary" style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
    </button>
  )

  const loadingText = panel.loadingText || (panel.result ? 'Añadiendo sección…' : 'Investigando…')
  // ponytail: overlay de carga — cubre TODO el panel, el usuario sabe que la petición corre
  const overlay = panel.loading && (
    <div className="research-loading-overlay">
      <span className="material-symbols-outlined research-spin">progress_activity</span>
      <span>{loadingText}</span>
    </div>
  )

  // --- Cabecera: pestañas Crear/Ver + info + close ---
  const head = (
    <div className="research-head">
      <button className={`research-head-tab${panel.view === 'historia' ? '' : ' active'}`} onClick={() => onSetView('crear')} disabled={panel.loading}>
        <span className="material-symbols-outlined research-head-tab-ico">add</span>
        <span className="research-btn-label">Crear investigación</span>
        <span className="research-btn-label-sm">Crear</span>
      </button>
      <button className={`research-head-tab${panel.view === 'historia' ? ' active' : ''}`} onClick={() => onSetView('historia')} disabled={panel.loading}>
        <span className="material-symbols-outlined research-head-tab-ico">description</span>
        <span className="research-btn-label">Ver investigaciones</span>
        <span className="research-btn-label-sm">Ver</span>
      </button>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
        {panel.view !== 'historia' && !panel.result && panel.round > 0 && <span className="research-round">Ronda {panel.round} de 3</span>}
        <button className="research-info-btn" onClick={() => setShowInfo(true)} title="Cómo funciona el investigador">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
        </button>
        {closeBtn}
      </span>
    </div>
  )

  // --- Explicación de uso ---
  const infoBox = showInfo && (
    <div className="research-info-overlay" onClick={() => setShowInfo(false)}>
      <div className="research-info-box" onClick={e => e.stopPropagation()}>
        <span className="label-caps" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>Cómo funciona el investigador</span>
        <ol>
          <li>Escribe el tema directamente en el recuadro.</li>
          <li>O pulsa «Seleccionar mensajes» — el panel se cierra para que marques mensajes del chat — y vuelve con el botón «Investigador» de la barra. Los marcados aparecen listados; «Identificar tema» extrae el tema (siempre editable).</li>
          <li>Elige nivel: principiante (sin jerga, con analogías), intermedio o experto (técnico). Cambia el TONO del documento, no su estructura.</li>
          <li>«Generar preguntas» crea 5 preguntas con opciones clicables para afinar el enfoque. «Más preguntas» afina más, máximo 3 tandas.</li>
          <li>«Crear investigación» genera el documento buscando en internet; las fuentes quedan citadas y son rastreables.</li>
          <li>En el resultado: Descargar (.md), Añadir al cerebro, Profundizar en… (añade una sección nueva al mismo documento) y Nueva investigación (empezar de cero).</li>
          <li>«Ver investigaciones» lista las de esta conversación: clic para abrir una y extenderla.</li>
        </ol>
        <button className="btn-app btn-app-primary" onClick={() => setShowInfo(false)}>Entendido</button>
      </div>
    </div>
  )

  // --- Pestaña Ver investigaciones: listado de las de esta conversación ---
  if (panel.view === 'historia') {
    return (
      <>
        <div className="research-overlay" onClick={onClose} />
        <div className="research-panel">
          {head}
          {infoBox}
          <div className="research-scroll">
            {(researchHistory || []).length === 0 && (
              <div className="research-empty">Aún no hay investigaciones en esta conversación. Crea una en la pestaña «Crear».</div>
            )}
            {[...(researchHistory || [])].reverse().map(item => (
              <button key={item.id} className="research-hist-item" onClick={() => onOpenHistoryDoc(item)} disabled={panel.loading}>
                <span className="material-symbols-outlined">description</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span className="research-hist-topic" style={{ flex: 1, minWidth: 0 }}>{item.topic.slice(0, 80)}{item.topic.length > 80 ? '…' : ''}</span>
                    {/* fase investigador: estado del documento — en el cerebro o solo borrador */}
                    <span className={`research-hist-state${item.inBrain ? ' in' : ''}`} title={item.inBrain ? 'Guardado en el cerebro' : 'Borrador — aún no está en el cerebro'}>
                      <span className="material-symbols-outlined">{item.inBrain ? 'psychology' : 'edit_note'}</span>
                      {item.inBrain ? 'En el cerebro' : 'Borrador'}
                    </span>
                  </span>
                  <span className="research-hist-meta">{(item.doc.length / 1000).toFixed(1)}k caracteres · clic para abrir y extender contenido</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </>
    )
  }

  // --- Resultado: doc + Descargar / Añadir al cerebro / Nueva investigación / Profundizar ---
  if (panel.result) {
    return (
      <>
        <div className="research-overlay" onClick={onClose} />
        <div className="research-panel">
          {head}
          {infoBox}
          {overlay}
          <div className="research-scroll">
            <MarkdownViewer content={panel.result} compact />
          </div>
          {panel.error && <div className="research-error" style={{ margin: '0 var(--space-5)' }}>{panel.error}</div>}
          <div className="research-actions">
                      {/* fase 2 visor-md: abrir el doc en el visor completo (índice + edición) */}
                      <button className="chat-action-btn primary" onClick={() => onPreviewDoc?.(panel.result, panel.topic, panel.brainPath)} disabled={panel.loading}>
                        <span className="material-symbols-outlined">visibility</span><span className="research-btn-label">Ver documento</span>
                      </button>
                      <button className="chat-action-btn" onClick={() => onDownload(panel.result, panel.topic)} disabled={panel.loading}>
                        <span className="material-symbols-outlined">download</span><span className="research-btn-label">Descargar</span>
                      </button>
            <button className="chat-action-btn" onClick={() => onSaveBrain(panel.result)} disabled={panel.loading}>
              <span className="material-symbols-outlined">psychology</span><span className="research-btn-label">Añadir al cerebro</span>
            </button>
            <button className="chat-action-btn" onClick={onNewResearch} disabled={panel.loading}>
              <span className="material-symbols-outlined">refresh</span><span className="research-btn-label">Nueva investigación</span>
            </button>
            <div className="research-deepen-box">
              <input className="input-app" style={{ flex: 1, fontSize: 13 }} placeholder="Profundizar en…" value={deepenText}
                onChange={e => setDeepenText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && deepenText.trim() && !panel.loading) onDeepen(deepenText.trim()) }} />
              <button className="btn-app btn-app-primary" style={{ padding: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                disabled={panel.loading || !deepenText.trim()}
                onClick={() => { onDeepen(deepenText.trim()); setDeepenText('') }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // --- Fase confirmación: tema (directo o identificado desde mensajes) ---
  if (panel.phase === 'confirm') {
    return (
      <>
        <div className="research-overlay" onClick={onClose} />
        <div className="research-panel">
          {head}
          {infoBox}
          {overlay}
          <div className="research-scroll">
            <div className="research-confirm-hint">Escribe el tema, o pulsa «Seleccionar mensajes» (el panel se cierra para marcarlos en el chat), vuelve con el botón «Investigador» y usa «Identificar tema».</div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="label-caps">Nivel</span>
              {['principiante', 'intermedio', 'experto'].map(l => (
                <button key={l} className={`research-chip${panel.level === l ? ' active' : ''}`} onClick={() => onLevel(l)}>{l}</button>
              ))}
            </div>
            <textarea className="input-app" style={{ width: '100%', minHeight: 110, fontSize: 13, resize: 'vertical' }}
              value={topicDraft} onChange={e => setTopicDraft(e.target.value)} placeholder="Tema a investigar…" />
            <div className="research-confirm-tools" style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
              <button className="chat-action-btn" onClick={onToggleSelectMessages}
                title="Marca los mensajes del chat que quieres usar como contexto del investigador">
                <span className="material-symbols-outlined">{selectingMessages ? 'visibility_off' : 'visibility'}</span>
                <span className="research-btn-label">{selectingMessages ? 'Dejar de seleccionar' : 'Seleccionar mensajes'}</span>
              </button>
              {panel.messages?.length > 0 && (
                <button className="chat-action-btn" onClick={onGenerateTopic} disabled={panel.generatingTopic}
                  title="Analiza los mensajes seleccionados y extrae el tema a investigar">
                  {panel.generatingTopic
                    ? <><span className="material-symbols-outlined research-spin">progress_activity</span><span className="research-btn-label">Identificando tema…</span></>
                    : <><span className="material-symbols-outlined">auto_awesome</span><span className="research-btn-label">Identificar tema</span></>}
                </button>
              )}
            </div>
            {panel.error && <div className="research-error" style={{ marginTop: 'var(--space-3)' }}>{panel.error}</div>}
            {panel.messages?.length > 0 && (
              <div className="research-selected-list">
                {panel.messages.map((m, i) => (
                  <div key={i} className="research-selected-item">
                    <span className="research-selected-idx">#{(m.idx ?? i) + 1}</span>
                    <span>{(m.content || '').slice(0, 70)}{(m.content || '').length > 70 ? '…' : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="research-actions research-actions-main">
            <button className="btn-app btn-app-primary" disabled={panel.loading || !topicDraft.trim()} onClick={() => onConfirmTopic(topicDraft.trim(), 'questions')}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>psychology</span>
              <span className="research-btn-label">Generar preguntas</span>
            </button>
            <button className="btn-app btn-app-secondary" disabled={panel.loading || !topicDraft.trim()} onClick={() => onConfirmTopic(topicDraft.trim(), 'doc')}
              title="Crear el documento directamente, sin preguntas">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>science</span>
              <span className="research-btn-label">Crear investigación</span>
            </button>
          </div>
        </div>
      </>
    )
  }

  // --- Cuestionario: tandas de preguntas clicables ---
  const techo = panel.round >= 3 // ponytail: techo visible — 3 tandas máximo
  return (
    <>
      <div className="research-overlay" onClick={onClose} />
      <div className="research-panel">
        {head}
        {infoBox}
        {overlay}
        <div className="research-scroll">
          <div className="research-topic">{panel.topic.slice(0, 160)}{panel.topic.length > 160 ? '…' : ''}</div>
          {panel.error && (
            <div className="research-error">
              {panel.error}
              <button className="chat-action-btn" onClick={() => onQuestions([])}>
                <span className="material-symbols-outlined">refresh</span><span className="research-btn-label">Reintentar</span>
              </button>
            </div>
          )}
          {panel.questions.map((q, i) => (
            <div className="research-question" key={i}>
              <div className="research-q">{q.q}</div>
              {q.options.map((opt, j) => (
                <button key={j} className={`research-opt${picks[i]?.pick === j ? ' active' : ''}`} onClick={() => togglePick(i, j)}>{opt}</button>
              ))}
              <input className="input-app" style={{ fontSize: 13, width: '100%' }} placeholder="Otra cosa…"
                value={picks[i]?.free || ''} onChange={e => setFree(i, e.target.value)} />
            </div>
          ))}
        </div>
        <div className="research-actions research-actions-main">
          <button className="btn-app btn-app-primary" onClick={() => onCreate(collected())} disabled={panel.loading}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>science</span>
            <span className="research-btn-label">Crear investigación</span>
          </button>
          <button className="btn-app btn-app-secondary" onClick={() => onQuestions(collected())} disabled={panel.loading || techo}
                      title={techo ? 'Máximo 3 tandas de preguntas' : 'Refina con otra tanda de preguntas'}>
                      <span className="research-btn-label">Más preguntas</span>
                      <span className="research-btn-label-sm">Más</span>
                    </button>
        </div>
      </div>
    </>
  )
}

export default ResearchPanel
