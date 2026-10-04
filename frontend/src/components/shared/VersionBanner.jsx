import React, { useState, useEffect } from 'react'

// ponytail: version banner — checks GitHub releases once per day, dismissable for 7 days
function VersionBanner() {
  const [newVersion, setNewVersion] = useState(null)
  const [releaseUrl, setReleaseUrl] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const checkVersion = async () => {
      try {
        // Check dismissal
        const dismissUntil = localStorage.getItem('dismiss_version_until')
        if (dismissUntil && Date.now() < parseInt(dismissUntil)) {
          setDismissed(true)
          return
        }

        // Get current version
        const verRes = await fetch('/api/version')
        const verData = await verRes.json()
        if (!verData.current || !verData.githubRepo) return

        // Get latest GitHub release
        const ghRes = await fetch(`https://api.github.com/repos/${verData.githubRepo}/releases/latest`)
        if (!ghRes.ok) return
        const ghData = await ghRes.json()

        const latest = (ghData.tag_name || '').replace(/^v/, '')
        if (latest && latest !== verData.current && isNewer(latest, verData.current)) {
          setNewVersion(latest)
          setReleaseUrl(ghData.html_url)
        }
      } catch {
        // ponytail: fail silently — no banner if GitHub is unreachable
      }
    }
    checkVersion()
  }, [])

  const dismiss = () => {
    const sevenDays = Date.now() + 7 * 24 * 60 * 60 * 1000
    localStorage.setItem('dismiss_version_until', sevenDays.toString())
    setDismissed(true)
  }

  if (!newVersion || dismissed) return null

  return (
    <div style={{
      background: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
      borderBottom: '1px solid color-mix(in srgb, var(--color-success) 20%, transparent)',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      fontSize: 14,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-success)' }}>system_update</span>
      <span>Nueva versión disponible: <strong>v{newVersion}</strong></span>
      {releaseUrl && (
        <a href={releaseUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
          Ver notas
        </a>
      )}
      <button onClick={dismiss} style={{
        background: 'none', border: 'none', color: 'var(--color-text-secondary)',
        cursor: 'pointer', fontSize: 13, padding: '2px 8px',
      }}>
        No molestar
      </button>
    </div>
  )
}

// ponytail: naive semver compare — split by dots, compare numeric
function isNewer(latest, current) {
  const l = latest.split('.').map(Number)
  const c = current.split('.').map(Number)
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lv = l[i] || 0
    const cv = c[i] || 0
    if (lv > cv) return true
    if (lv < cv) return false
  }
  return false
}

export default VersionBanner
