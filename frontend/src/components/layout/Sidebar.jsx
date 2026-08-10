import React from 'react'

const ITEMS = [
  { id: 'dashboard', icon: 'dashboard', label: 'DASHBOARD' },
  { id: 'chat', icon: 'chat', label: '__AGENT_NAME__' },
  { id: 'cerebro', icon: 'psychology', label: 'CEREBRO' },
  { id: 'graph', icon: 'hub', label: 'GRAFO' },
  { id: 'modelos', icon: 'memory', label: 'MODELOS' },
  { id: 'settings', icon: 'settings', label: 'AJUSTES' },
]

function Sidebar({ activeTab, onTabChange, agentName }) {
  const items = ITEMS.map(i => i.id === 'chat' ? { ...i, label: (agentName || 'Hermes').toUpperCase() } : i)
  return (
    <aside className="app-sidebar">
      <nav className="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-version">
          <div className="label">VERSION</div>
          <div className="value">v1.0.4-stable</div>
        </div>
        <button className="sidebar-item" style={{ color: 'var(--color-error)' }}>
          <span className="material-symbols-outlined">logout</span>
          <span>LOGOUT</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar