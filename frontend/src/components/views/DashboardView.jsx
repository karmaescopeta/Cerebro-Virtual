import React from 'react'

function DashboardView({ vaultInfo, systemInfo, containers, editAgentName }) {
  const stats = vaultInfo?.stats || {}
  const containerList = Object.entries(containers?.containers || containers || {})

  return (
    <div>
      <h1 className="section-title">Systems Overview</h1>
      <p className="section-subtitle">
        Monitoring internal knowledge synthesis and agent health parameters.
      </p>

      {/* Stats bento */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-5)', marginBottom: 'var(--space-8)' }}>
        <StatCard icon="book_5" label="WIKI PAGES" value={stats.wiki_pages || 0} color="primary" />
        <StatCard icon="database" label="RAW FILES" value={stats.raw_files || 0} color="primary" />
        <StatCard icon="send" label="OUTPUTS" value={stats.outputs || 0} color="success" />
      </div>

      {/* System + Vault info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
        {/* System info */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-surface-high)' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 20 }}>memory</span>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>System Information</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
            <div>
              <div className="label-caps" style={{ marginBottom: 'var(--space-1)' }}>SYSTEM VERSION</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{systemInfo?.version || '—'}</div>
            </div>
            <div>
              <div className="label-caps" style={{ marginBottom: 'var(--space-1)' }}>ACTIVE AGENT</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{editAgentName || 'Hermes'}</div>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div className="label-caps" style={{ marginBottom: 'var(--space-1)' }}>HERMES PORT</div>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-primary)', background: 'rgba(173,198,255,0.05)', padding: '4px 12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(173,198,255,0.2)' }}>/agent</code>
            </div>
          </div>
          {/* Containers */}
          <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-5)', borderTop: '1px solid var(--color-surface-high)' }}>
            <div className="label-caps" style={{ marginBottom: 'var(--space-4)' }}>CONTAINER HEALTH STACK</div>
            {containerList.map(([name, info]) => {
              const running = info?.running !== undefined ? info.running : info?.status === 'running'
              return (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3)', marginBottom: 'var(--space-2)', background: 'rgba(14,14,14,0.5)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span className={`status-dot ${running ? 'running' : 'stopped'}`} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500 }}>{name}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: running ? 'var(--color-success)' : 'var(--color-error)' }}>● {running ? 'running' : 'stopped'}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Vault info */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-surface-high)' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 20 }}>encrypted</span>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Vault Information</h2>
          </div>
          {vaultInfo?.manifest ? (
            <>
              <InfoRow label="Vault Name" value={vaultInfo.manifest.name || 'Main Vault'} />
              <InfoRow label="Schema Version" value={vaultInfo.manifest.schemaVersion || '—'} />
              <InfoRow label="Created Date" value={new Date(vaultInfo.manifest.createdAt).toLocaleDateString()} />
              <InfoRow label="Assigned Agent" value={editAgentName || 'Hermes'} badge />
            </>
          ) : (
            <p style={{ color: 'var(--color-text-tertiary)' }}>Cargando información del vault...</p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  const c = color === 'success' ? 'var(--color-success)' : 'var(--color-primary)'
  return (
    <div className="card card-hover" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: `rgba(${color === 'success' ? '78,222,163' : '173,198,255'},0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid rgba(${color === 'success' ? '78,222,163' : '173,198,255'},0.2)`, color: c }}>
          <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{icon}</span>
        </div>
      </div>
      <div>
        <div className="label-caps" style={{ marginBottom: 'var(--space-1)' }}>{label}</div>
        <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--color-primary-container)', lineHeight: 1, letterSpacing: '-0.04em' }}>{value}</div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, badge }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-surface)' }}>
      <span style={{ color: 'var(--color-text-secondary)', fontSize: 15 }}>{label}</span>
      {badge ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '4px 12px', background: 'rgba(173,198,255,0.1)', borderRadius: 'var(--radius-full)', border: '1px solid rgba(173,198,255,0.2)' }}>
          <span className="status-dot running" />
          <span style={{ color: 'var(--color-primary)', fontSize: 14, fontWeight: 500 }}>{value}</span>
        </div>
      ) : (
        <span style={{ fontWeight: 500 }}>{value}</span>
      )}
    </div>
  )
}

export default DashboardView