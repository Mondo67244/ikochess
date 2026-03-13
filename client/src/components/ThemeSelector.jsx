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

export default function ThemeSelector({ socket, onThemeChange, onClose }) {
  const [themes, setThemes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!socket) return

    socket.emit('get-themes')

    const handler = (data) => {
      setThemes(data)
      setLoading(false)
    }
    socket.on('themes-data', handler)

    const changedHandler = (theme) => {
      if (onThemeChange) onThemeChange(theme)
      // Refresh the list to update active state
      socket.emit('get-themes')
    }
    socket.on('theme-changed', changedHandler)

    return () => {
      socket.off('themes-data', handler)
      socket.off('theme-changed', changedHandler)
    }
  }, [socket])

  const selectTheme = (themeId) => {
    socket.emit('set-theme', { themeId })
  }

  if (loading) return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-shell modal-shell--wide" onClick={e => e.stopPropagation()}>
        <div className="theme-selector modal-panel modal-panel--wide">
          <div className="modal-header">
            <div className="modal-title-group">
              <span className="modal-kicker">Themes</span>
              <h3 className="modal-title">Personnalisation du plateau</h3>
              <p className="modal-subtitle">Chargement des themes disponibles.</p>
            </div>
            <button className="modal-close-btn" onClick={onClose} aria-label="Fermer">✕</button>
          </div>
          <div className="modal-body modal-scroll">
            <p className="theme-loading">Chargement...</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-shell modal-shell--wide" onClick={e => e.stopPropagation()}>
        <div className="theme-selector modal-panel modal-panel--wide">
          <div className="modal-header">
            <div className="modal-title-group">
              <span className="modal-kicker">Themes</span>
              <h3 className="modal-title">Plateaux Telegram</h3>
              <p className="modal-subtitle">Une presentation plus nette, plus coherente et scrollable sur mobile.</p>
            </div>
            <button className="modal-close-btn" onClick={onClose} aria-label="Fermer">✕</button>
          </div>
          <div className="modal-body modal-scroll">
            <div className="theme-grid">
          {themes.map(t => (
            <button
              key={t.id}
              type="button"
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
            </button>
          ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
