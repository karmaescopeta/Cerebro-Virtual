import React, { useRef, useState } from 'react'
import StepIndicator from './StepIndicator'
import WizardInfo from './WizardInfo'

const PERSONALIDADES = [
  { label: 'Técnico', text: 'Eres un asistente de IA técnico y preciso. Respondes con claridad, priorizando el código, la arquitectura y los datos verificables.' },
  { label: 'Amigable', text: 'Eres un asistente cercano y cordial. Explicas las cosas de forma sencilla y motivadora, sin tecnicismos innecesarios.' },
  { label: 'Conciso', text: 'Eres un asistente directo. Respuestas cortas, al grano, sin relleno ni preámbulos.' },
  { label: 'Creativo', text: 'Eres un asistente creativo e imaginativo. Propones ideas originales y usas ejemplos coloridos.' },
]

function WizardStepIdentity({ formData, errors, updateForm, onNext, onBlurField }) {
  const avatarRef = useRef(null)
  const [avatarMsg, setAvatarMsg] = useState(null)

  const handleAvatarFile = (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) { setAvatarMsg({ type: 'error', text: 'Elige una imagen (JPG, PNG, etc.)' }); return }
    if (f.size > 280_000) { setAvatarMsg({ type: 'error', text: 'Imagen demasiado grande (máx ~280KB)' }); return }
    const reader = new FileReader()
    reader.onload = () => { updateForm('avatar', reader.result); setAvatarMsg(null) }
    reader.readAsDataURL(f)
  }

  return (
    <div className="wizard-root">
      <div className="wizard-progress-bar">
        <div className="wizard-progress-fill" style={{ width: '20%' }} />
      </div>
      <div className="wizard-card">
        <StepIndicator current={1} />

        <WizardInfo title="Crea tu agente">
          Dale nombre, cara y carácter a tu asistente. Todo se puede cambiar después en Ajustes.
        </WizardInfo>

        <div className="agent-identity">
          <div className="agent-identity-head">
            <div className="agent-identity-avatar">
              {formData.avatar
                ? <img src={formData.avatar} alt="Avatar del agente" />
                : <span className="material-symbols-outlined">electric_bolt</span>}
            </div>
            <div className="agent-identity-name-wrap">
              <p className="agent-identity-hola">Hola, soy</p>
              <input
                type="text"
                className={`agent-identity-name ${errors.agentName ? 'error' : ''}`}
                value={formData.agentName}
                onChange={(e) => updateForm('agentName', e.target.value)}
                onBlur={() => onBlurField('agentName')}
                placeholder="Newton"
              />
              {errors.agentName && <span className="form-error">{errors.agentName}</span>}
            </div>
            <div className="agent-identity-actions">
              <button type="button" className="btn-link" onClick={() => avatarRef.current?.click()}>
                <span className="material-symbols-outlined">upload</span>
                {formData.avatar ? 'Cambiar' : 'Ponerle cara'}
              </button>
              {formData.avatar && (
                <button type="button" className="btn-link" onClick={() => updateForm('avatar', '')} aria-label="Quitar imagen">
                  <span className="material-symbols-outlined">delete</span>
                </button>
              )}
              <input ref={avatarRef} type="file" accept="image/*" hidden onChange={handleAvatarFile} />
            </div>
          </div>
          {avatarMsg && <span className="form-error">{avatarMsg.text}</span>}
          <div className="chip-row">
            {PERSONALIDADES.map((p) => (
              <button key={p.label} type="button" className={`chip ${formData.personality === p.text ? 'chip-active' : ''}`} onClick={() => updateForm('personality', p.text)}>
                {p.label}
              </button>
            ))}
          </div>
          <textarea
            className="form-textarea"
            value={formData.personality}
            onChange={(e) => updateForm('personality', e.target.value)}
            onBlur={() => onBlurField('personality')}
            placeholder="O cuéntale cómo es..."
            rows={3}
          />
          {errors.personality && <span className="form-error">{errors.personality}</span>}
        </div>

        <div className="btn-actions">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onNext}>
            Siguiente
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default WizardStepIdentity
