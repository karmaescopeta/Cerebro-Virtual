import React, { useRef, useState } from 'react'
import StepIndicator from './StepIndicator'

const SUGERIDO_MEDIO = 'qwen2.5:7b' // ponytail: recomendación 1 modelo medio para cerebro/graphify (7B clase)

function WizardStepModels({ formData, updateForm, onBack, onNext }) {
  const iaMode = formData.iaMode || 'both'
  const [pullQueue, setPullQueue] = useState(formData.localModels?.map(m => ({ name: m, status: 'listo' })) || [])
  const [pullCmd, setPullCmd] = useState('')
  const [pulling, setPulling] = useState(false)
  const abortRef = useRef(null)

  const setIaMode = (v) => updateForm('iaMode', v)

  const extractName = (cmd) => {
    const m = cmd.trim().match(/ollama\s+pull\s+([\w.:/-]+)/i) || cmd.trim().match(/^([\w.:/-]+):[\w.-]+$/)
    return (m ? m[1] : cmd.trim().split(/\s+/)[0]).replace(/^ollama\//, '')
  }

  const addPull = () => {
    const name = extractName(pullCmd)
    if (!name || !/^[A-Za-z0-9._:/-]+$/.test(name)) return
    if (pullQueue.some(q => q.name === name)) { setPullCmd(''); return }
    setPullQueue(q => [...q, { name, status: 'en cola' }])
    setPullCmd('')
    // ponytail: pull SSE existente — cola secuencial; el último manda
    startPull(name)
  }

  const startPull = async (name) => {
    setPulling(true)
    setPullQueue(q => q.map(p => p.name === name ? { ...p, status: 'descargando…' } : p))
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await fetch(`/api/localai/pull?model=${encodeURIComponent(name)}`, { signal: ctrl.signal })
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let last = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        last += dec.decode(value, { stream: true })
        const lines = last.split('\n').filter(l => l.startsWith('data: '))
        if (lines.length) {
          const txt = lines[lines.length - 1].slice(6)
          setPullQueue(q => q.map(p => p.name === name ? { ...p, status: txt.includes('[DONE') ? (txt.includes('rc=0') ? '✅ instalado' : '❌ error') : txt.slice(-60) } : p))
          if (txt.includes('[DONE')) {
            const ok = txt.includes('rc=0')
            updateForm('localModels', [...(formData.localModels || []).filter(m => m !== name), ...(ok ? [name] : [])])
            break
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError')
        setPullQueue(q => q.map(p => p.name === name ? { ...p, status: '❌ error de conexión' } : p))
    } finally { setPulling(false); abortRef.current = null }
  }

  const needsLocal = iaMode === 'local' || iaMode === 'both'

  return (
    <div className="wizard-root">
      <div className="wizard-progress-bar">
        <div className="wizard-progress-fill" style={{ width: '50%' }} />
      </div>
      <div className="wizard-card">
        <StepIndicator current={2} />

        <h2 className="wizard-title">Modo de IA</h2>
        <p className="wizard-subtitle">
          ¿Dónde se ejecutan los modelos? Puedes cambiarlo en cualquier momento desde el chat.
        </p>

        <div className="wizard-form">
          {[
            { v: 'local', icon: 'lock', t: 'Solo local', d: 'Máxima privacidad — tus documentos nunca salen de tu máquina. Requiere Ollama.' },
            { v: 'cloud', icon: 'cloud', t: 'Solo cloud', d: 'Usa OpenRouter. Configuración mínima, tus datos van al proveedor.' },
            { v: 'both', icon: 'swap_horiz', t: 'Ambos (recomendado)', d: 'Toggle Local/Cloud en el chat. Local para lo privado, cloud para potencia.' },
          ].map(o => (
            <div key={o.v} className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input type="radio" name="iaMode" checked={iaMode === o.v} onChange={() => setIaMode(o.v)} />
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{o.icon}</span>
                {o.t}
              </label>
              <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', margin: '4px 0 0 28px' }}>{o.d}</p>
            </div>
          ))}
        </div>

        {needsLocal && (
          <div style={{ marginTop: 'var(--space-5)', padding: 'var(--space-4)', border: '1px solid var(--color-surface-high)', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--space-2)' }}>Modelos locales (Ollama)</h3>
            <div className="form-hint" style={{ marginBottom: 'var(--space-3)' }}>
              <span className="material-symbols-outlined">info</span>
              <p>
                Recomendado: <strong>1 modelo medio</strong> para el cerebro y Graphify, p. ej.{' '}
                <code style={{ color: 'var(--color-primary)' }}>ollama pull {SUGERIDO_MEDIO}</code>. Pega el comando y pulsa añadir.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <input
                type="text"
                className="form-input"
                style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
                value={pullCmd}
                onChange={(e) => setPullCmd(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPull() } }}
                placeholder={`ollama pull ${SUGERIDO_MEDIO}`}
              />
              <button className="btn btn-secondary" onClick={addPull} disabled={pulling && !pullCmd.trim()}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                AÑADIR
              </button>
            </div>
            {pullQueue.length > 0 && (
              <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-2) var(--space-3)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                {pullQueue.map(q => (
                  <div key={q.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', padding: '2px 0', color: q.status.startsWith('❌') ? 'var(--color-error)' : q.status.startsWith('✅') ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                    <span>{q.name}</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>{q.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {needsLocal && (
          <div className="form-hint" style={{ marginTop: 'var(--space-4)' }}>
            <span className="material-symbols-outlined">settings</span>
            <p>
              ¿Claves o conexiones avanzadas? Configura OmniRoute en su{' '}
              <a href="/omniroute/" target="_blank" rel="noopener noreferrer">panel <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: '-2px' }}>open_in_new</span></a>{' '}
              y vuelve aquí con «Ya terminé».
            </p>
          </div>
        )}

        <div className="btn-actions">
          <button className="btn btn-secondary" onClick={onBack}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            ATRÁS
          </button>
          <button className="btn btn-secondary" onClick={() => { window.open('/omniroute/', '_blank') }} disabled={!needsLocal}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span>
            YA TERMINÉ, CONTINUAR
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onNext}
            disabled={needsLocal && pullQueue.some(q => q.status === 'descargando…' || q.status === 'en cola')}>
            SIGUIENTE
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default WizardStepModels
