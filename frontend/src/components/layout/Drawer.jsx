import React from 'react'

// Drawer escritorio (≥768px): panel oculto a la izquierda que se desliza hacia la derecha
// para aparecer y hacia la izquierda para guardarse. Ancho = sidebar histórico (240px).
// Overlay: el contenido NO se reflow — al cerrar, la ventana queda al completo.
// ponytail: campana NO vive aquí — está en TopRight (arriba-dcha) como en el resto de versiones.

const ITEMS = [
  { id: 'dashboard', icon: 'dashboard', label: 'Panel' },
  { id: 'chat', icon: 'chat', label: null /* = nombre del agente */ },
  { id: 'cerebro', icon: 'psychology', label: 'Cerebro' },
  { id: 'graph', icon: 'hub', label: 'Grafo' },
  { id: 'modelos', icon: 'memory', label: 'Modelos' },
  { id: 'updates', icon: 'update', label: 'Actualizaciones' },
  { id: 'settings', icon: 'settings', label: 'Ajustes' },
]

function Drawer({ open, activeTab, onTabChange, agentName }) {
  return (
    <>
      <aside className={`drawer ${open ? 'open' : ''}`}>
        <nav className="drawer-nav">
          {ITEMS.map((item) => (
            <button
              key={item.id}
              className={`drawer-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => onTabChange(item.id)}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.id === 'chat' ? (agentName || 'Hermes') : item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  )
}

export default Drawer