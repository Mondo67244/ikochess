import { Chess } from 'chess.js';

const toNamedColor = (color) => {
  if (color === 'w' || color === 'white') return 'white';
  if (color === 'b' || color === 'black') return 'black';
  return null;
};

const withTurn = (fen, turn) => {
  const parts = String(fen || '').split(' ');
  if (parts.length < 2) return fen;
  parts[1] = turn;
  return parts.join(' ');
};

export const normalizeMoveEntry = (entry, index = 0) => {
  if (!entry) return null;

  const baseMove = entry.move && typeof entry.move === 'object' ? entry.move : entry;
  if (!baseMove || typeof baseMove !== 'object') return null;

  return {
    ply: index + 1,
    san: baseMove.san || entry.san || '',
    from: baseMove.from || entry.from || null,
    to: baseMove.to || entry.to || null,
    color: toNamedColor(baseMove.color || entry.color),
    piece: baseMove.piece || entry.piece || null,
    captured: baseMove.captured || entry.captured || null,
    promotion: baseMove.promotion || entry.promotion || null,
    flags: baseMove.flags || entry.flags || '',
    fenAfter: entry.fenAfter || entry.fen || baseMove.after || null
  };
};

export const normalizeMoveHistory = (moves = []) =>
  (Array.isArray(moves) ? moves : [])
    .map((entry, index) => normalizeMoveEntry(entry, index))
    .filter(Boolean);

export const getLastMove = (moveHistory = []) => {
  const lastEntry = moveHistory[moveHistory.length - 1];
  if (!lastEntry) return null;
  return {
    from: lastEntry.from,
    to: lastEntry.to,
    san: lastEntry.san,
    color: lastEntry.color
  };
};

export const getCheckStateForGame = (game) => {
  if (!game?.fen) {
    return { whiteInCheck: false, blackInCheck: false };
  }

  const fen = game.fen();
  const whiteGame = new Chess();
  const blackGame = new Chess();
  whiteGame.load(withTurn(fen, 'w'));
  blackGame.load(withTurn(fen, 'b'));

  return {
    whiteInCheck: whiteGame.isCheck(),
    blackInCheck: blackGame.isCheck()
  };
};

export const findKingSquare = (game, color) => {
  const rows = game?.board?.() || [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    for (let colIndex = 0; colIndex < rows[rowIndex].length; colIndex += 1) {
      const piece = rows[rowIndex][colIndex];
      if (piece?.type === 'k' && piece.color === color) {
        return `${String.fromCharCode(97 + colIndex)}${8 - rowIndex}`;
      }
    }
  }
  return null;
};

export const buildMoveRows = (moveHistory = []) => {
  const rows = [];
  for (let index = 0; index < moveHistory.length; index += 2) {
    rows.push({
      moveNumber: Math.floor(index / 2) + 1,
      white: moveHistory[index] || null,
      black: moveHistory[index + 1] || null
    });
  }
  return rows;
};
