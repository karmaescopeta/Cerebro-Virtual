import React, { useState, useEffect } from 'react'

function WelcomeScreen({ onStart }) {
  const [version, setVersion] = useState('')
  useEffect(() => {
    fetch('/api/version').then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.current && d.current !== 'unknown') setVersion(d.current) })
      .catch(() => {})
  }, [])
  return (
    <div className="wizard-root welcome-screen">
      <div className="welcome-bg-glow" />
      <div className="welcome-content">
        <h1 className="welcome-title">Cerebro Virtual</h1>
        <p className="welcome-tagline">Crea tu propio asistente</p>
        <button className="welcome-start-btn" onClick={onStart}>
                  Empezar
                </button>
      </div>
      {version && <span className="welcome-version">v{version}</span>}
    </div>
  )
}

export default WelcomeScreen