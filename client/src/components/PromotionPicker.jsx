import React from 'react';

const PIECE_OPTIONS = [
  { id: 'q', white: '♕', black: '♛', label: 'Dame' },
  { id: 'r', white: '♖', black: '♜', label: 'Tour' },
  { id: 'b', white: '♗', black: '♝', label: 'Fou' },
  { id: 'n', white: '♘', black: '♞', label: 'Cavalier' }
];

export const PromotionPicker = ({ isOpen, color, onSelect, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-shell modal-shell--narrow" onClick={(event) => event.stopPropagation()}>
        <div className="modal-panel promotion-modal">
          <div className="modal-header">
            <div className="modal-title-group">
              <span className="modal-kicker">Promotion</span>
              <h2 className="modal-title">Choisissez votre piece</h2>
              <p className="modal-subtitle">Le choix est disponible aussi en tap-to-move sur mobile.</p>
            </div>
            <button className="modal-close-btn" onClick={onCancel} aria-label="Fermer">✕</button>
          </div>
          <div className="modal-body">
            <div className="promotion-grid">
              {PIECE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className="promotion-piece-btn"
                  onClick={() => onSelect(option.id)}
                >
                  <span className="promotion-piece-icon">
                    {color === 'black' ? option.black : option.white}
                  </span>
                  <span className="promotion-piece-label">{option.label}</span>
                </button>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary promotion-cancel-btn" onClick={onCancel}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
