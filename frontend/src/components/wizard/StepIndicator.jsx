import React from 'react'

const STEPS = [
  { num: 1, label: 'CONFIGURAR' },
  { num: 2, label: 'MODELOS' },
  { num: 3, label: 'CONFIRMAR' },
  { num: 4, label: 'FINALIZAR' },
]

function StepIndicator({ current }) {
  return (
    <div className="step-indicator">
      {STEPS.map((s) => {
        const state = current > s.num ? 'done' : current === s.num ? 'active' : 'pending'
        const itemClass = state === 'pending' ? 'step-item inactive' : 'step-item active'
        return (
          <div key={s.num} className={itemClass}>
            <div className={`step-circle ${state}`}>
              {state === 'done' ? (
                <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>
                  check
                </span>
              ) : (
                s.num
              )}
            </div>
            <span className="step-label">{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default StepIndicator
