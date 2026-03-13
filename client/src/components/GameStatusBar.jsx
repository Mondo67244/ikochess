import React from 'react';

const getPrimaryStatus = ({
  status,
  isSpectator,
  isReady,
  isOpponentReady,
  pendingMoveVisible,
  pendingMove,
  myColor,
  game,
  playersReady
}) => {
  if (pendingMoveVisible) {
    return { tone: 'pending', label: 'En attente de validation...' };
  }
  if (status === 'connecting') {
    return { tone: 'muted', label: 'Connexion au serveur...' };
  }
  if (status === 'waiting') {
    return { tone: 'muted', label: 'En attente des joueurs...' };
  }
  if (status === 'finished') {
    return { tone: 'muted', label: 'Partie terminée' };
  }
  if (isSpectator) {
    return { tone: 'info', label: 'Mode spectateur' };
  }
  if (!isReady) {
    return { tone: 'muted', label: 'Veuillez confirmer que vous êtes prêt.' };
  }
  if (isReady && !isOpponentReady) {
    return { tone: 'muted', label: "L'adversaire n'est pas prêt." };
  }
  if (playersReady.white && playersReady.black && myColor) {
    const myTurn = game.turn() === (myColor === 'white' ? 'w' : 'b');
    return myTurn
      ? { tone: 'success', label: 'À vous de jouer' }
      : { tone: 'opponent', label: 'Tour de l’adversaire' };
  }

  if (pendingMove?.move?.san) {
    return { tone: 'pending', label: `Validation de ${pendingMove.move.san}` };
  }

  return { tone: 'muted', label: 'Synchronisation...' };
};

export const GameStatusBar = ({
  status,
  isSpectator,
  isReady,
  isOpponentReady,
  playersReady,
  pendingMove,
  pendingMoveVisible,
  notice,
  lastMove,
  checks,
  myColor,
  game
}) => {
  const primary = getPrimaryStatus({
    status,
    isSpectator,
    isReady,
    isOpponentReady,
    pendingMoveVisible,
    pendingMove,
    myColor,
    game,
    playersReady
  });

  const checkLabel = checks.whiteInCheck
    ? (myColor === 'white' && !isSpectator ? 'Vous êtes en échec' : 'Roi blanc en échec')
    : checks.blackInCheck
      ? (myColor === 'black' && !isSpectator ? 'Vous êtes en échec' : 'Roi noir en échec')
      : null;

  return (
    <div className="game-status-bar">
      <div className={`status-pill ${primary.tone}`}>{primary.label}</div>

      {lastMove?.san && (
        <div className={`status-pill ${lastMove.color && myColor && lastMove.color !== myColor ? 'opponent-move' : 'info'}`}>
          Dernier coup: {lastMove.san}
        </div>
      )}

      {checkLabel && (
        <div className="status-pill danger">
          {checkLabel}
        </div>
      )}

      {notice?.text && (
        <div className={`status-pill ${notice.tone || 'muted'}`}>
          {notice.text}
        </div>
      )}
    </div>
  );
};
