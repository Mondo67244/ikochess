import React, { useEffect } from 'react';

// ELO Change display formatter
const formatEloChange = (change) => {
  if (change == null) return null;
  const sign = change > 0 ? '+' : '';
  const className = change > 0 ? 'elo-gain' : change < 0 ? 'elo-loss' : 'elo-neutral';
  return <span className={`elo-change ${className}`}>({sign}{Math.round(change)})</span>;
};

const formatRating = (value) => (value == null ? '-' : Math.round(value));

export const GameOverModal = ({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  players, 
  eloChanges 
}) => {
  useEffect(() => {
    if (isOpen) {
      // Small vibration effect on game over (if supported)
      if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
        try {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        } catch (e) {}
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-shell modal-shell--narrow" onClick={(event) => event.stopPropagation()}>
        <div className="modal-panel modal-panel--gameover">
          <div className="modal-header">
            <div className="modal-title-group">
              <span className="modal-kicker">Partie terminee</span>
              <h2 className={`modal-title ${title.includes('Victoire') ? 'text-success' : title.includes('Défaite') ? 'text-danger' : ''}`}>
                {title}
              </h2>
              <p className="modal-subtitle">Resultat final, message et evolution des ELO.</p>
            </div>
            <button className="modal-close-btn" onClick={onClose} aria-label="Fermer">✕</button>
          </div>

          <div className="modal-body modal-scroll">
            <div className="game-over-hero">
              <div className="game-over-icon-badge">
                {title.includes('Victoire') ? '🏆' : title.includes('Défaite') ? '💔' : '🤝'}
              </div>
              <p className="game-over-message">{message}</p>
            </div>

            <div className="result-player-grid">
              <div className="result-player-card">
                <span className="result-player-label">Blancs</span>
                <strong>{players?.white?.name || 'Blancs'}</strong>
              </div>
              <div className="result-player-divider">VS</div>
              <div className="result-player-card">
                <span className="result-player-label">Noirs</span>
                <strong>{players?.black?.name || 'Noirs'}</strong>
              </div>
            </div>

        {eloChanges && Object.keys(eloChanges).length > 0 && (
              <div className="elo-results">
                <h3>Evolution ELO</h3>
                <div className="elo-players">
                  <div className="elo-player">
                    <div className="elo-name">{players?.white?.name || 'Blancs'}</div>
                    <div className="elo-values">
                      <span className="elo-current">{formatRating(eloChanges.white?.newElo)}</span>
                      {formatEloChange(eloChanges.white?.change)}
                    </div>
                  </div>
                  <div className="elo-divider">VS</div>
                  <div className="elo-player">
                    <div className="elo-name">{players?.black?.name || 'Noirs'}</div>
                    <div className="elo-values">
                      <span className="elo-current">{formatRating(eloChanges.black?.newElo)}</span>
                      {formatEloChange(eloChanges.black?.change)}
                    </div>
                  </div>
                </div>
              </div>
        )}

            <div className="modal-footer">
              <button className="btn btn-primary modal-primary-btn" onClick={onClose}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
