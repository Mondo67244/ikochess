import React from 'react';
import { GameActions } from './GameActions';

export const ChatAndSpectator = ({
  liveSpectators,
  showLeaderboard,
  setShowLeaderboard,
  themeButton,
  historyButton
}) => {
  return (
    <div className="chat-spectator-container">
      <div className="top-bar">
        <h1 className="app-title">
          ♘ Telegram Chess
        </h1>
        <div className="top-bar-actions">
          {themeButton}
          {historyButton}
          {liveSpectators > 0 && (
            <div className="live-spectators" title="Spectateurs en direct">
              👁 {liveSpectators}
            </div>
          )}
          <button className="btn btn-secondary top-bar-btn" onClick={() => setShowLeaderboard(true)}>
            🏆 Classement
          </button>
        </div>
      </div>
    </div>
  );
};
