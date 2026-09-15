import React from 'react'

const ITEMS = [
  { id: 'dashboard', icon: 'dashboard', label: 'Dash' },
  { id: 'chat', icon: 'chat', label: 'Hermes' },
  { id: 'cerebro', icon: 'psychology', label: 'Cerebro' },
  { id: 'graph', icon: 'hub', label: 'Grafo' },
  { id: 'modelos', icon: 'memory', label: 'Modelos' },
  { id: 'updates', icon: 'update', label: 'Updates' },
  { id: 'settings', icon: 'settings', label: 'Ajustes' },
]

function MobileNav({ activeTab, onTabChange }) {
  return (
    <nav className="mobile-nav">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          className={`mobile-nav-item ${activeTab === item.id ? 'active' : ''}`}
          onClick={() => onTabChange(item.id)}
        >
          <span className="material-symbols-outlined">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default MobileNav