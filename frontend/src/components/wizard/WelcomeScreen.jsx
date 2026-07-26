import React from 'react'

function WelcomeScreen({ onStart }) {
  return (
    <div className="wizard-root welcome-screen">
      <div className="welcome-bg-glow" />
      <div className="welcome-content">
        <h1 className="welcome-title">Cerebro Virtual</h1>
        <button className="welcome-start-btn" onClick={onStart}>
          START
        </button>
      </div>
      <span className="welcome-version">v1.0.4-stable</span>
    </div>
  )
}

export default WelcomeScreen
