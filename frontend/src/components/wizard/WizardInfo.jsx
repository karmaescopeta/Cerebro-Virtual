import React, { useState } from 'react'

// ponytail: un icono info por pantalla; el texto de ayuda se despliega al pulsar
function WizardInfo({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="wizard-head">
        <h2 className="wizard-title">{title}</h2>
        <button
          type="button"
          className="btn-link wizard-info-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-label="Más información"
          aria-expanded={open}
        >
          <span className="material-symbols-outlined">info</span>
        </button>
      </div>
      {open && (
        <div className="form-hint wizard-info-box">
          <span className="material-symbols-outlined">info</span>
          <p>{children}</p>
        </div>
      )}
    </>
  )
}

export default WizardInfo