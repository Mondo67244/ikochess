import { useState, useEffect } from 'react'

const UNLOCK_LABELS = {
  free: '🆓 Gratuit',
}

const getUnlockLabel = (condition) => {
  if (UNLOCK_LABELS[condition]) return UNLOCK_LABELS[condition]
  const [type, val] = condition.split(':')
  if (type === 'elo') return `♜ ELO ≥ ${val}`
  if (type === 'wins') return `🏆 ${val} victoires`
  return condition
}

export default function ThemeSelector({ socket, telegramId, onThemeChange, onClose }) {
  const [themes, setThemes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!socket || !telegramId) return

    socket.emit('get-themes', { telegramId })

    const handler = (data) => {
      setThemes(data)
      setLoading(false)
    }
    socket.on('themes-data', handler)

    const changedHandler = (theme) => {
      if (onThemeChange) onThemeChange(theme)
      // Refresh the list to update active state
      socket.emit('get-themes', { telegramId })
    }
    socket.on('theme-changed', changedHandler)

    return () => {
      socket.off('themes-data', handler)
      socket.off('theme-changed', changedHandler)
    }
  }, [socket, telegramId])

  const selectTheme = (themeId) => {
    socket.emit('set-theme', { telegramId, themeId })
  }

  if (loading) return (
    <div className="theme-selector-overlay" onClick={onClose}>
      <div className="theme-selector" onClick={e => e.stopPropagation()}>
        <p style={{ textAlign: 'center', color: '#aaa' }}>Chargement...</p>
      </div>
    </div>
  )

  return (
    <div className="theme-selector-overlay" onClick={onClose}>
      <div className="theme-selector" onClick={e => e.stopPropagation()}>
        <div className="theme-header">
          <h3>🎨 Thèmes</h3>
          <button className="theme-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="theme-grid">
          {themes.map(t => (
            <div
              key={t.id}
              className={`theme-card ${t.active ? 'active' : ''} ${!t.unlocked ? 'locked' : ''}`}
              onClick={() => t.unlocked && selectTheme(t.id)}
            >
              <div className="theme-preview">
                <div className="theme-square light" style={{ background: t.light_color }} />
                <div className="theme-square dark" style={{ background: t.dark_color }} />
                <div className="theme-square dark" style={{ background: t.dark_color }} />
                <div className="theme-square light" style={{ background: t.light_color }} />
              </div>
              <div className="theme-info">
                <span className="theme-name">{t.name}</span>
                {!t.unlocked && (
                  <span className="theme-lock">{getUnlockLabel(t.unlock_condition)}</span>
                )}
                {t.active && <span className="theme-active-badge">✓ Actif</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
