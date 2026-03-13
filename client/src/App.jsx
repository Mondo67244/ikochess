import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { io } from 'socket.io-client';
import './App.css';

import { GameOverModal } from './components/GameOverModal';
import { Leaderboard } from './components/Leaderboard';
import { ChessBoardComponent } from './components/ChessBoardComponent';
import { ChatAndSpectator } from './components/ChatAndSpectator';
import { PlayerBadge } from './components/PlayerBadge';
import { GameActions } from './components/GameActions';
import { GameStatusBar } from './components/GameStatusBar';
import { MoveHistorySheet } from './components/MoveHistorySheet';
import { PromotionPicker } from './components/PromotionPicker';
import ThemeSelector from './components/ThemeSelector';
import {
  findKingSquare,
  getCheckStateForGame,
  getLastMove,
  normalizeMoveHistory
} from './lib/chessUi';
import { applyTelegramTheme } from './lib/telegramTheme';

const API_URL = import.meta.env.VITE_SERVER_URL || '';
const EMPTY_READY = { white: false, black: false };
const EMPTY_CHECKS = { whiteInCheck: false, blackInCheck: false };

const buildGameInstance = (fen) => {
  const game = new Chess();
  game.load(fen);
  return game;
};

const mergeSquareStyle = (styles, square, nextStyle) => {
  if (!square) return;
  const current = styles[square] || {};
  styles[square] = { ...current, ...nextStyle };

  if (current.boxShadow || nextStyle.boxShadow) {
    styles[square].boxShadow = [current.boxShadow, nextStyle.boxShadow].filter(Boolean).join(', ');
  }
};

function App() {
  const [socket, setSocket] = useState(null);
  const [game, setGame] = useState(new Chess());
  const [gameId, setGameId] = useState(null);

  const [myColor, setMyColor] = useState(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [isAiGame, setIsAiGame] = useState(false);
  const [players, setPlayers] = useState({ white: {}, black: {} });

  const [status, setStatus] = useState('connecting');
  const [playersReady, setPlayersReady] = useState(EMPTY_READY);
  const [liveSpectators, setLiveSpectators] = useState(0);

  const [timers, setTimers] = useState({ white: 300000, black: 300000, lastUpdate: null });
  const [moveHistory, setMoveHistory] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [checks, setChecks] = useState(EMPTY_CHECKS);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);

  const [gameOverData, setGameOverData] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojis, setActiveEmojis] = useState({ white: null, black: null });
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [drawOfferFrom, setDrawOfferFrom] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showMoveHistory, setShowMoveHistory] = useState(false);
  const [hasGameId, setHasGameId] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [boardTheme, setBoardTheme] = useState({ light_color: '#6490b1', dark_color: '#2b5278' });
  const [pendingMove, setPendingMove] = useState(null);
  const [statusNotice, setStatusNotice] = useState(null);
  const [pendingPromotionMove, setPendingPromotionMove] = useState(null);
  const [clockNow, setClockNow] = useState(Date.now());

  const myColorRef = useRef(null);
  const isSpectatorRef = useRef(false);
  const isAiGameRef = useRef(false);
  const playersRef = useRef({ white: {}, black: {} });
  const gameRef = useRef(game);
  const moveHistoryRef = useRef(moveHistory);
  const noticeTimeoutRef = useRef(null);
  const lastRealtimeKeyRef = useRef(null);

  useEffect(() => {
    myColorRef.current = myColor;
  }, [myColor]);

  useEffect(() => {
    isSpectatorRef.current = isSpectator;
  }, [isSpectator]);

  useEffect(() => {
    isAiGameRef.current = isAiGame;
  }, [isAiGame]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    moveHistoryRef.current = moveHistory;
  }, [moveHistory]);

  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const telegramWebApp = window.Telegram?.WebApp;
    if (!telegramWebApp) return undefined;

    const syncTelegramTheme = () => {
      applyTelegramTheme(telegramWebApp);
    };

    try {
      telegramWebApp.ready?.();
      telegramWebApp.expand?.();
      syncTelegramTheme();
      telegramWebApp.onEvent?.('themeChanged', syncTelegramTheme);
    } catch {
      syncTelegramTheme();
    }

    return () => {
      telegramWebApp.offEvent?.('themeChanged', syncTelegramTheme);
    };
  }, []);

  useEffect(() => () => {
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
  }, []);

  const isReady = myColor ? playersReady[myColor] : false;
  const oppColorForReady = myColor === 'white' ? 'black' : (myColor === 'black' ? 'white' : null);
  const isOpponentReady = oppColorForReady ? playersReady[oppColorForReady] : false;
  const isGameFullyReady = (playersReady.white && playersReady.black) || isSpectator;

  const updateNotice = (text, tone = 'muted') => {
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    if (!text) {
      setStatusNotice(null);
      return;
    }
    setStatusNotice({ text, tone });
    noticeTimeoutRef.current = setTimeout(() => {
      setStatusNotice(null);
    }, 2800);
  };

  const setSeatContext = ({ color, spectator, aiGame }) => {
    myColorRef.current = color;
    isSpectatorRef.current = spectator;
    isAiGameRef.current = aiGame;
    setMyColor(color);
    setIsSpectator(spectator);
    setIsAiGame(aiGame);
  };

  const setPlayerState = (nextPlayers) => {
    playersRef.current = nextPlayers;
    setPlayers(nextPlayers);
  };

  const applyAuthoritativeState = (data, overrides = {}) => {
    if (!data?.fen) return;

    const nextGame = buildGameInstance(data.fen);
    const nextMoveHistory = Array.isArray(data.moveHistory)
      ? normalizeMoveHistory(data.moveHistory)
      : data.move
        ? normalizeMoveHistory([...moveHistoryRef.current, data.move])
        : moveHistoryRef.current;
    const nextLastMove = data.lastMove || getLastMove(nextMoveHistory);
    const nextChecks = data.checks || getCheckStateForGame(nextGame);
    const nextTurn = data.turn || (nextGame.turn() === 'w' ? 'white' : 'black');

    const effectiveColor = Object.prototype.hasOwnProperty.call(overrides, 'color')
      ? overrides.color
      : myColorRef.current;
    const effectiveSpectator = Object.prototype.hasOwnProperty.call(overrides, 'spectator')
      ? overrides.spectator
      : isSpectatorRef.current;
    const effectiveAiGame = Object.prototype.hasOwnProperty.call(overrides, 'isAiGame')
      ? overrides.isAiGame
      : isAiGameRef.current;
    const effectiveWhite = overrides.white ?? data.white ?? playersRef.current.white?.id;
    const effectiveBlack = overrides.black ?? data.black ?? playersRef.current.black?.id;

    let nextStatus = 'waiting';
    if (data.status === 'finished') {
      nextStatus = 'finished';
    } else if (!effectiveWhite || (!effectiveBlack && !effectiveAiGame)) {
      nextStatus = 'waiting';
    } else if (effectiveSpectator) {
      nextStatus = 'opponent-turn';
    } else if (effectiveColor) {
      nextStatus = nextTurn === effectiveColor ? 'your-turn' : 'opponent-turn';
    }

    setGame(nextGame);
    gameRef.current = nextGame;
    setMoveHistory(nextMoveHistory);
    moveHistoryRef.current = nextMoveHistory;
    setLastMove(nextLastMove);
    setChecks(nextChecks);
    setSelectedSquare(null);
    setLegalMoves([]);
    setPendingPromotionMove(null);
    if (data.timers) {
      setTimers({
        white: data.timers.white,
        black: data.timers.black,
        lastUpdate: Date.now()
      });
    }
    if (data.ready) {
      setPlayersReady(data.ready);
    }
    setPendingMove(null);
    setStatus(nextStatus);
  };

  const applyMoveEvent = (data) => {
    const moveCount = Array.isArray(data.moveHistory) ? data.moveHistory.length : moveHistoryRef.current.length;
    const moveKey = `${data.gameId || gameId}:${data.fen}:${moveCount}:${data.move?.san || data.lastMove?.san || ''}`;
    if (lastRealtimeKeyRef.current === moveKey) return;
    lastRealtimeKeyRef.current = moveKey;
    applyAuthoritativeState(data);
    updateNotice(null);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const playGameId = params.get('gameId') || params.get('game');
    const watchGameId = params.get('watch');
    const gid = playGameId || watchGameId;
    const isWatchMode = Boolean(watchGameId);
    const seatToken = params.get('seat');
    const spectateToken = params.get('spectate');

    if (!gid) {
      setHasGameId(false);
      return undefined;
    }

    setHasGameId(true);
    setGameId(gid);

    if ((isWatchMode && !spectateToken) || (!isWatchMode && !seatToken)) {
      setStatus('finished');
      setGameOverData({
        title: 'Lien invalide',
        message: 'Ce lien de partie a expiré ou est incomplet.',
        players: {
          white: { name: 'IkoChess' },
          black: { name: 'OpenClaw' }
        },
        eloChanges: {
          white: { newElo: null, change: null },
          black: { newElo: null, change: null }
        }
      });
      return undefined;
    }

    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      if (isWatchMode) {
        newSocket.emit('join-spectate', { gameId: gid, token: spectateToken });
      } else {
        newSocket.emit('join-challenge', { token: seatToken });
      }
    });

    newSocket.on('active-theme', (theme) => {
      if (theme) setBoardTheme(theme);
    });

    newSocket.on('spectate-started', (data) => {
      setSeatContext({ color: null, spectator: true, aiGame: data.isAiGame });
      setPlayerState({
        white: { id: data.white, name: data.whiteName },
        black: { id: data.black, name: data.blackName }
      });
      setPlayersReady(data.ready || EMPTY_READY);
      applyAuthoritativeState(data, {
        color: null,
        spectator: true,
        isAiGame: data.isAiGame,
        white: data.white,
        black: data.black
      });
    });

    newSocket.on('game-started', (data) => {
      setSeatContext({
        color: data.color || null,
        spectator: !data.color,
        aiGame: data.isAiGame
      });
      setPlayerState({
        white: { id: data.white, name: data.whiteName },
        black: { id: data.black, name: data.blackName }
      });
      setPlayersReady(data.ready || EMPTY_READY);
      applyAuthoritativeState(data, {
        color: data.color || null,
        spectator: !data.color,
        isAiGame: data.isAiGame,
        white: data.white,
        black: data.black
      });

      if (data.authenticatedPlayerId) {
        newSocket.emit('get-active-theme');
      }
    });

    newSocket.on('player-ready-update', (data) => {
      setPlayersReady((prev) => ({ ...prev, [data.color]: data.ready }));
    });

    newSocket.on('timer_sync', (nextTimers) => {
      setTimers((prev) => ({
        ...prev,
        white: nextTimers.white,
        black: nextTimers.black,
        lastUpdate: Date.now()
      }));
    });

    newSocket.on('spectator-count', (data) => {
      setLiveSpectators(data.count);
    });

    newSocket.on('move-applied', applyMoveEvent);
    newSocket.on('opponent-move', applyMoveEvent);

    newSocket.on('move-rejected', (data) => {
      if (data?.fen) {
        applyAuthoritativeState(data);
      } else {
        setPendingMove(null);
      }
      updateNotice(data?.reason || 'Coup refusé', 'danger');
    });

    newSocket.on('emoji', (data) => {
      setActiveEmojis((prev) => ({ ...prev, [data.color]: data.emoji }));
      setTimeout(() => {
        setActiveEmojis((prev) => ({ ...prev, [data.color]: null }));
      }, 3000);
    });

    newSocket.on('draw-offered', (data) => {
      setDrawOfferReceived(true);
      setDrawOfferFrom(data.from);
    });

    newSocket.on('draw-declined', () => {
      setDrawOfferReceived(false);
      setDrawOfferFrom(null);
      updateNotice('Proposition de nulle annulée.', 'muted');
    });

    newSocket.on('game-ready-to-play', () => {
      setPlayersReady({ white: true, black: true });
      if (!isSpectatorRef.current && myColorRef.current) {
        setStatus(gameRef.current.turn() === (myColorRef.current === 'white' ? 'w' : 'b') ? 'your-turn' : 'opponent-turn');
      }
    });

    newSocket.on('game-over', (data) => {
      setPendingMove(null);
      setStatus('finished');

      const spectator = isSpectatorRef.current;
      const currentColor = myColorRef.current;
      const isDraw = data.result === 'draw';
      const isMyWin = currentColor ? data.result.includes(currentColor) : false;

      const reasonMap = {
        checkmate: 'Échec et mat',
        resignation: 'Abandon',
        timeout: 'Temps écoulé',
        stalemate: 'Pat',
        'threefold-repetition': 'Triple répétition',
        'insufficient-material': 'Matériel insuffisant',
        'fifty-move-rule': 'Règle des 50 coups',
        agreement: 'Accord mutuel',
        draw: 'Nulle'
      };

      let title = '🤝 Match nul';
      if (!isDraw && spectator) {
        title = data.result === 'white-wins' ? '♔ Victoire des Blancs' : '♚ Victoire des Noirs';
      } else if (!isDraw && isMyWin) {
        title = '🏆 Victoire !';
      } else if (!isDraw) {
        title = '💔 Défaite';
      }

      setGameOverData({
        title,
        message: reasonMap[data.reason] || data.reason,
        players: {
          white: { name: `${data.whiteTitle?.icon || '♟'} ${data.whiteName}` },
          black: { name: `${data.blackTitle?.icon || '♟'} ${data.blackName}` }
        },
        eloChanges: {
          white: { newElo: data.whiteElo, change: data.whiteChange },
          black: { newElo: data.blackElo, change: data.blackChange }
        }
      });
    });

    newSocket.on('error', (err) => {
      updateNotice(err.message || 'Une erreur est survenue', 'danger');
    });

    newSocket.on('game-expired', (data) => {
      setPendingMove(null);
      setStatus('finished');
      setGameOverData({
        title: '⌛ Partie expirée',
        message: data?.message || 'Cette partie a expiré.',
        players: {
          white: { name: 'Blancs' },
          black: { name: 'Noirs' }
        },
        eloChanges: {
          white: { newElo: null, change: null },
          black: { newElo: null, change: null }
        }
      });
    });

    return () => {
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
      newSocket.disconnect();
    };
  }, []);

  const submitMove = (moveRequest) => {
    if (!socket || status !== 'your-turn' || !myColor) return false;

    try {
      const nextGame = new Chess(game.fen());
      const result = nextGame.move(moveRequest);
      if (!result) return false;

      setGame(nextGame);
      gameRef.current = nextGame;
      setChecks(getCheckStateForGame(nextGame));
      setSelectedSquare(null);
      setLegalMoves([]);
      setPendingPromotionMove(null);
      setPendingMove({
        submittedAt: Date.now(),
        move: {
          san: result.san,
          from: result.from,
          to: result.to,
          color: result.color === 'w' ? 'white' : 'black'
        }
      });
      setStatus('opponent-turn');
      socket.emit('make-move', { gameId, move: result.san });
      return true;
    } catch {
      return false;
    }
  };

  const onPieceDrop = (sourceSquare, targetSquare) => {
    if (pendingMove || status !== 'your-turn' || !myColor) return false;

    const movingPiece = game.get(sourceSquare);
    if (movingPiece?.type === 'p') {
      const isPromotion = (movingPiece.color === 'w' && targetSquare[1] === '8') ||
        (movingPiece.color === 'b' && targetSquare[1] === '1');
      if (isPromotion) {
        return false;
      }
    }

    return submitMove({ from: sourceSquare, to: targetSquare });
  };

  const onPromotionCheck = (sourceSquare, targetSquare) => {
    const movingPiece = game.get(sourceSquare);
    if (!movingPiece || movingPiece.type !== 'p') return false;
    return (movingPiece.color === 'w' && targetSquare[1] === '8') ||
      (movingPiece.color === 'b' && targetSquare[1] === '1');
  };

  const onPromotionPieceSelect = (piece, promoteFromSquare, promoteToSquare) => {
    if (!piece) return false;
    const promotionPiece = piece[1]?.toLowerCase();
    if (!promotionPiece) return false;
    return submitMove({
      from: promoteFromSquare,
      to: promoteToSquare,
      promotion: promotionPiece
    });
  };

  const onSquareClick = useCallback((square) => {
    if (pendingMove || status !== 'your-turn' || isSpectator || !isGameFullyReady) return;

    const piece = game.get(square);

    if (selectedSquare) {
      if (legalMoves.some((move) => move.to === square)) {
        const movingPiece = game.get(selectedSquare);
        const isPromotion = movingPiece?.type === 'p' &&
          ((movingPiece.color === 'w' && square[1] === '8') || (movingPiece.color === 'b' && square[1] === '1'));

        if (isPromotion) {
          setPendingPromotionMove({ from: selectedSquare, to: square });
          return;
        }

        submitMove({ from: selectedSquare, to: square });
        return;
      }

      if (square === selectedSquare) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }
    }

    if (piece && piece.color === (myColor === 'white' ? 'w' : 'b')) {
      setSelectedSquare(square);
      setLegalMoves(game.moves({ square, verbose: true }));
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [game, isGameFullyReady, isSpectator, legalMoves, myColor, pendingMove, selectedSquare, status]);

  const handleEmojiSend = (emoji) => {
    if (!socket || !myColor || isSpectator) return;
    socket.emit('send-emoji', { gameId, emoji });
    setShowEmojiPicker(false);
  };

  const handleReady = () => {
    if (!socket) return;
    socket.emit('player-ready', { gameId });
    if (myColor) {
      setPlayersReady((prev) => ({ ...prev, [myColor]: true }));
    }
  };

  const handlePromotionSelect = (piece) => {
    if (!pendingPromotionMove) return;
    submitMove({
      from: pendingPromotionMove.from,
      to: pendingPromotionMove.to,
      promotion: piece
    });
  };

  const pendingMoveVisible = Boolean(pendingMove && clockNow - pendingMove.submittedAt > 150);
  const visualLastMove = pendingMove?.move || lastMove;

  const customSquareStyles = {};

  if (visualLastMove?.from && visualLastMove?.to) {
    const isOpponentMove = myColor ? visualLastMove.color !== myColor : true;
    mergeSquareStyle(customSquareStyles, visualLastMove.from, {
      backgroundColor: isOpponentMove ? 'rgba(255, 171, 64, 0.24)' : 'rgba(100, 181, 246, 0.20)'
    });
    mergeSquareStyle(customSquareStyles, visualLastMove.to, {
      backgroundColor: isOpponentMove ? 'rgba(255, 138, 101, 0.38)' : 'rgba(79, 195, 247, 0.30)'
    });
  }

  const whiteKingSquare = checks.whiteInCheck ? findKingSquare(game, 'w') : null;
  const blackKingSquare = checks.blackInCheck ? findKingSquare(game, 'b') : null;
  mergeSquareStyle(customSquareStyles, whiteKingSquare, {
    boxShadow: 'inset 0 0 0 999px rgba(229, 57, 53, 0.26)'
  });
  mergeSquareStyle(customSquareStyles, blackKingSquare, {
    boxShadow: 'inset 0 0 0 999px rgba(229, 57, 53, 0.26)'
  });

  if (selectedSquare) {
    mergeSquareStyle(customSquareStyles, selectedSquare, {
      backgroundColor: 'rgba(255, 235, 59, 0.34)',
      boxShadow: 'inset 0 0 0 2px rgba(255, 241, 118, 0.65)'
    });

    legalMoves.forEach((move) => {
      const targetPiece = game.get(move.to);
      customSquareStyles[move.to] = targetPiece
        ? {
            ...customSquareStyles[move.to],
            background: 'radial-gradient(circle, rgba(239,68,68,0.55) 78%, transparent 79%)',
            borderRadius: '50%'
          }
        : {
            ...customSquareStyles[move.to],
            background: 'radial-gradient(circle, rgba(255,255,255,0.32) 22%, transparent 24%)',
            borderRadius: '50%'
          };
    });
  }

  const getOpponentColor = () => (myColor === 'white' ? 'black' : 'white');
  const opponentInfo = myColor ? players[getOpponentColor()] : players.black;
  const myInfo = myColor ? players[myColor] : players.white;
  const oppColor = myColor ? getOpponentColor() : 'black';
  const mySide = myColor || 'white';
  const canManageTheme = Boolean(myColor && !isSpectator);

  const clocksLive = playersReady.white && playersReady.black && status !== 'finished' && status !== 'connecting' && status !== 'waiting';
  const activeClockColor = clocksLive ? (game.turn() === 'w' ? 'white' : 'black') : null;
  const getDisplayedTimer = (color) => {
    const base = Number(timers[color] ?? 0);
    if (!clocksLive || !timers.lastUpdate || activeClockColor !== color) return base;
    return Math.max(0, base - Math.max(0, clockNow - timers.lastUpdate));
  };

  if (!hasGameId) {
    return (
      <div className="app-container landing">
        <div className="top-bar">
          <h1 className="app-title">♟️ IkoChess</h1>
        </div>
        <div className="landing-hero">
          <div className="landing-icon">♛</div>
          <h2>Bienvenue sur IkoChess</h2>
          <p>Pour commencer une partie, utilisez la commande <code>/chess</code> dans un groupe Telegram avec le bot <strong>OpenClaw</strong>.</p>
        </div>
        <Leaderboard isOpen={true} onClose={() => {}} embedded={true} />
      </div>
    );
  }

  return (
    <div className="app-container" onClick={() => setShowEmojiPicker(false)}>
      <ChatAndSpectator
        liveSpectators={liveSpectators}
        showLeaderboard={showLeaderboard}
        setShowLeaderboard={setShowLeaderboard}
        themeButton={canManageTheme ? <button className="theme-btn" onClick={() => setShowThemeSelector(true)}>🎨</button> : null}
        historyButton={
          <button className="btn btn-secondary history-toggle-btn" onClick={() => setShowMoveHistory(true)}>
            📜 Coups
          </button>
        }
      />

      {showThemeSelector && canManageTheme && (
        <ThemeSelector
          socket={socket}
          onThemeChange={(theme) => setBoardTheme(theme)}
          onClose={() => setShowThemeSelector(false)}
        />
      )}

      <MoveHistorySheet
        isOpen={showMoveHistory}
        onClose={() => setShowMoveHistory(false)}
        moveHistory={moveHistory}
      />

      <PromotionPicker
        isOpen={Boolean(pendingPromotionMove)}
        color={myColor || 'white'}
        onSelect={handlePromotionSelect}
        onCancel={() => setPendingPromotionMove(null)}
      />

      <PlayerBadge
        name={opponentInfo?.name}
        color={oppColor}
        isActive={game.turn() === oppColor.charAt(0)}
        timer={getDisplayedTimer(oppColor)}
        isMe={false}
        gameStatus={status}
        fen={game.fen()}
        selectedEmoji={activeEmojis[oppColor]}
      />

      <div className="board-wrapper">
        <ChessBoardComponent
          game={game}
          fen={game.fen()}
          boardOrientation={myColor || 'white'}
          onPieceDrop={onPieceDrop}
          onSquareClick={onSquareClick}
          customSquareStyles={customSquareStyles}
          isDraggablePiece={({ piece }) => {
            if (!piece) return false;
            if (pendingMove) return false;
            if (isSpectator) return false;
            if (!isGameFullyReady) return false;
            if (myColor && piece.charAt(0) !== myColor.charAt(0)) return false;
            if (status !== 'your-turn') return false;
            return true;
          }}
          onPromotionPieceSelect={onPromotionPieceSelect}
          onPromotionCheck={onPromotionCheck}
          customLightSquareStyle={{ backgroundColor: boardTheme.light_color }}
          customDarkSquareStyle={{ backgroundColor: boardTheme.dark_color }}
        />

        <GameStatusBar
          status={status}
          isSpectator={isSpectator}
          isReady={isReady}
          isOpponentReady={isOpponentReady}
          playersReady={playersReady}
          pendingMove={pendingMove}
          pendingMoveVisible={pendingMoveVisible}
          notice={statusNotice}
          lastMove={visualLastMove}
          checks={checks}
          myColor={myColor}
          game={game}
        />
      </div>

      <PlayerBadge
        name={myInfo?.name}
        color={mySide}
        isActive={game.turn() === mySide.charAt(0)}
        timer={getDisplayedTimer(mySide)}
        isMe={true}
        isSpectator={isSpectator}
        gameStatus={status}
        onEmojiTrigger={() => setShowEmojiPicker(!showEmojiPicker)}
        showEmojiPicker={showEmojiPicker}
        fen={game.fen()}
        selectedEmoji={activeEmojis[mySide]}
      />

      <GameActions
        isPlaying={!isSpectator && status !== 'connecting' && status !== 'waiting' && players.white?.id && players.black?.id}
        isSpectator={isSpectator}
        gameStatus={status}
        isAiGame={isAiGame}
        isReady={isReady}
        drawOfferReceived={drawOfferReceived}
        drawOfferFrom={drawOfferFrom}
        onReady={handleReady}
        onResign={() => socket && socket.emit('resign', { gameId })}
        onOfferDraw={() => socket && socket.emit('offer-draw', { gameId })}
        onAcceptDraw={() => {
          socket && socket.emit('accept-draw', { gameId });
          setDrawOfferReceived(false);
          setDrawOfferFrom(null);
        }}
        onDeclineDraw={() => {
          socket && socket.emit('decline-draw', { gameId });
          setDrawOfferReceived(false);
          setDrawOfferFrom(null);
        }}
      />

      {showEmojiPicker && (
        <div className="emoji-picker-overlay" onClick={(event) => { event.stopPropagation(); setShowEmojiPicker(false); }}>
          {['👍', '👎', '🤬', '👏', '😂', '🔥', '🤔', '💀', '😤', '😎'].map((emoji) => (
            <button key={emoji} className="emoji-btn" onClick={() => handleEmojiSend(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      <Leaderboard isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />

      <GameOverModal
        isOpen={!!gameOverData}
        onClose={() => setGameOverData(null)}
        {...gameOverData}
      />
    </div>
  );
}

export default App;
