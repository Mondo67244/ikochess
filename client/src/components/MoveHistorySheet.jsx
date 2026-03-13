import React from 'react';
import { buildMoveRows } from '../lib/chessUi';

export const MoveHistorySheet = ({ isOpen, onClose, moveHistory }) => {
  if (!isOpen) return null;

  const rows = buildMoveRows(moveHistory);
  const lastPly = moveHistory.length;

  return (
    <div className="modal-overlay history-modal-overlay" onClick={onClose}>
      <div className="modal-shell modal-shell--wide history-modal-shell" onClick={(event) => event.stopPropagation()}>
        <div className="modal-panel history-modal-panel">
        <div className="history-sheet-header">
          <div className="modal-title-group">
            <span className="modal-kicker">Coups</span>
            <div className="history-sheet-title">Historique</div>
            <div className="history-sheet-subtitle">
              {moveHistory.length ? `${moveHistory.length} demi-coups` : 'Aucun coup joué'}
            </div>
          </div>
          <button className="modal-close-btn history-close-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="history-sheet-body modal-scroll">
          {rows.length === 0 && (
            <div className="history-empty">
              L’historique apparaîtra ici dès le premier coup.
            </div>
          )}

          {rows.map((row) => (
            <div key={row.moveNumber} className="history-row">
              <div className="history-move-number">{row.moveNumber}.</div>
              <div className={`history-move-cell ${row.white?.ply === lastPly ? 'latest' : ''}`}>
                {row.white?.san || '...'}
              </div>
              <div className={`history-move-cell ${row.black?.ply === lastPly ? 'latest' : ''}`}>
                {row.black?.san || ''}
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
};
