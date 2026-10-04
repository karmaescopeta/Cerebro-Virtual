import React from 'react'

// Dock móvil (<768px): iconos, sin campana (la campana vive en TopRight).
const ITEMS = [
  { id: 'dashboard', icon: 'dashboard', label: 'Panel' },
  { id: 'chat', icon: 'chat', label: null },
  { id: 'cerebro', icon: 'psychology', label: 'Cerebro' },
  { id: 'graph', icon: 'hub', label: 'Grafo' },
  { id: 'modelos', icon: 'memory', label: 'Modelos' },
  { id: 'updates', icon: 'update', label: 'Actualizaciones' },
  { id: 'settings', icon: 'settings', label: 'Ajustes' },
]

function Dock({ activeTab, onTabChange, agentName }) {
  return (
    <nav className="dock">
      {ITEMS.map((item) => {
        const label = item.id === 'chat' ? (agentName || 'Hermes') : item.label
        return (
          <button
            key={item.id}
            title={label}
            aria-label={label}
            className={`dock-btn ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default Dock
