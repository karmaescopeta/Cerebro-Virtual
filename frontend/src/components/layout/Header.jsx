import React from 'react'

function Header({ status }) {
  const healthy = status?.status === 'healthy'
  return (
    <header className="app-header">
      <div className="header-badge">
        <span className="dot" style={{ background: healthy ? 'var(--color-success)' : 'var(--color-error)' }} />
        <span style={{ color: healthy ? 'var(--color-success)' : 'var(--color-error)' }}>
          {healthy ? 'SYSTEM HEALTHY' : 'SYSTEM OFFLINE'}
        </span>
      </div>
      <div className="header-title">Cerebro Virtual</div>
      <div style={{ flex: 1 }} />
    </header>
  )
}

export default Header