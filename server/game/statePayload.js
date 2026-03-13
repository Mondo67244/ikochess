import { Chess } from 'chess.js'

const toNamedColor = (color) => {
  if (color === 'w' || color === 'white') return 'white'
  if (color === 'b' || color === 'black') return 'black'
  return null
}

const toFenWithTurn = (fen, turn) => {
  const parts = String(fen || '').split(' ')
  if (parts.length < 2) return fen
  parts[1] = turn
  return parts.join(' ')
}

export const normalizeMoveEntry = (entry, index = 0) => {
  if (!entry) return null

  const baseMove = entry.move && typeof entry.move === 'object' ? entry.move : entry
  if (!baseMove || typeof baseMove !== 'object') return null

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
  }
}

export const normalizeMoveHistory = (moves = []) =>
  (Array.isArray(moves) ? moves : [])
    .map((entry, index) => normalizeMoveEntry(entry, index))
    .filter(Boolean)

export const createMoveEntry = (moveResult, ply, fenAfter) =>
  normalizeMoveEntry({
    ...moveResult,
    ply,
    fenAfter: fenAfter || moveResult?.after || null
  }, Math.max(0, (ply || 1) - 1))

export const getLastMove = (moveHistory = []) => {
  const lastEntry = moveHistory[moveHistory.length - 1]
  if (!lastEntry) return null
  return {
    from: lastEntry.from,
    to: lastEntry.to,
    san: lastEntry.san,
    color: lastEntry.color
  }
}

export const getTurnColor = (game) => (game?.turn?.() === 'w' ? 'white' : 'black')

export const getCheckState = (game) => {
  if (!game?.fen) {
    return { whiteInCheck: false, blackInCheck: false }
  }

  const fen = game.fen()
  const whiteGame = new Chess()
  const blackGame = new Chess()
  whiteGame.load(toFenWithTurn(fen, 'w'))
  blackGame.load(toFenWithTurn(fen, 'b'))

  return {
    whiteInCheck: whiteGame.isCheck(),
    blackInCheck: blackGame.isCheck()
  }
}

export const buildRealtimeGameState = (gameId, gameData) => {
  const moveHistory = normalizeMoveHistory(gameData?.moves)

  return {
    gameId,
    fen: gameData?.game?.fen?.() || null,
    turn: getTurnColor(gameData?.game),
    moveHistory,
    lastMove: getLastMove(moveHistory),
    status: gameData?.status || null,
    timers: {
      white: Number(gameData?.timers?.white ?? 0),
      black: Number(gameData?.timers?.black ?? 0)
    },
    checks: getCheckState(gameData?.game)
  }
}
