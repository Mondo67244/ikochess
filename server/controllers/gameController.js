import {
  AI_PLAYER_ID,
  ensurePlayer,
  getLeaderboard,
  getPlayerActiveTheme,
  getPlayerName,
  getPlayerProfile,
  getThemes,
  setActiveTheme,
  supabase
} from '../db.js'
import { ensureActiveGameFromChallenge, persistActiveGame, updateActiveGameByGameId } from '../activeGames.js'
import {
  ACTIVE_GAME_PLAYABLE_STATUSES,
  CHALLENGE_OPEN_STATUSES,
  READY_TIMEOUT_MS,
  isExpiredIso,
  toFutureIso
} from '../chessConfig.js'
import { getAiMove } from '../ai.js'
import { handleGameOver, startTimer } from '../game/engine.js'
import { buildRealtimeGameState, createMoveEntry } from '../game/statePayload.js'
import { ensureCachedGame } from '../runtimeState.js'
import { verifySignedToken } from '../tokens.js'

const addPlayerSocket = (players, telegramId, socketId) => {
  if (!players.has(telegramId)) players.set(telegramId, new Set())
  players.get(telegramId).add(socketId)
}

const getPlayerColor = (gameData, telegramId) => {
  if (String(gameData.white) === String(telegramId)) return 'white'
  if (String(gameData.black) === String(telegramId)) return 'black'
  return null
}

const canControlSeat = (gameData, telegramId) => Boolean(getPlayerColor(gameData, telegramId))

const expireChallenge = async (gameId) => {
  const nowIso = new Date().toISOString()
  await Promise.all([
    supabase.from('chess_challenges').update({ status: 'expired', expires_at: nowIso }).eq('game_id', gameId).in('status', CHALLENGE_OPEN_STATUSES),
    updateActiveGameByGameId(gameId, { status: 'expired', reason: 'expired', finished_at: nowIso, last_activity_at: nowIso })
  ])
}

const emitMoveRejected = (socket, gameId, gameData, reason) => {
  socket.emit('move-rejected', {
    reason,
    ...(gameData ? buildRealtimeGameState(gameId, gameData) : {})
  })
}

const emitMoveApplied = (io, gameId, gameData, moveEntry) => {
  const payload = {
    ...buildRealtimeGameState(gameId, gameData),
    move: moveEntry
  }

  io.to(gameId).emit('move-applied', payload)
  return payload
}

const scheduleAiMove = (gameId, gameData, games, io) => {
  if (!gameData.ready.white || !gameData.ready.black || gameData.finished) return
  if (!gameData.isAiGame || gameData.black !== AI_PLAYER_ID || gameData.game.turn() !== 'b') return

  if (gameData.aiMoveTimeout) {
    clearTimeout(gameData.aiMoveTimeout)
    gameData.aiMoveTimeout = null
  }

  const delay = 1000 + Math.random() * 2000
  gameData.aiMoveTimeout = setTimeout(async () => {
    gameData.aiMoveTimeout = null
    if (!games.has(gameId) || gameData.finished || gameData.game.turn() !== 'b') return

    const difficulty = gameData.aiDifficulty || 'medium'
    const aiMoveSan = await getAiMove(gameData.game, difficulty)
    if (!aiMoveSan) return

    try {
      const moveResult = gameData.game.move(aiMoveSan)
      if (!moveResult) return

      const moveEntry = createMoveEntry(moveResult, gameData.moves.length + 1, gameData.game.fen())
      if (!moveEntry) return

      gameData.moves.push(moveEntry)
      gameData.lastTickTime = Date.now()
      await persistActiveGame(gameId, gameData)

      const payload = emitMoveApplied(io, gameId, gameData, moveEntry)
      io.to(gameId).emit('opponent-move', payload)

      if (gameData.game.isGameOver()) {
        await handleGameOver(gameId, gameData, games, io)
      }
    } catch (err) {
      console.error('AI move execution error:', err)
    }
  }, delay)
}

const syncChallengeState = async (gameId, status, expiresAt) => {
  await supabase
    .from('chess_challenges')
    .update({ status, expires_at: expiresAt })
    .eq('game_id', gameId)
    .in('status', ['accepted', 'playing'])
}

const emitGameStarted = async (socket, gameId, gameData, telegramId) => {
  const whiteName = await getPlayerName(gameData.white)
  const blackName = await getPlayerName(gameData.black)
  const color = getPlayerColor(gameData, telegramId)

  socket.emit('game-started', {
    ...buildRealtimeGameState(gameId, gameData),
    gameId,
    color,
    authenticatedPlayerId: telegramId,
    white: gameData.white,
    black: gameData.black,
    whiteName,
    blackName,
    isAiGame: gameData.isAiGame,
    aiDifficulty: gameData.aiDifficulty,
    ready: gameData.ready,
    status: gameData.status
  })
}

export const registerGameHandlers = (io, socket, games, players) => {
  socket.on('join-challenge', async ({ token }) => {
    const seatSession = verifySignedToken(token, 'seat')
    if (!seatSession?.gameId || !seatSession?.telegramId) {
      socket.emit('error', { message: 'Lien joueur invalide ou expiré' })
      return
    }

    const gameId = seatSession.gameId
    const telegramId = String(seatSession.telegramId)
    const { data: challenge } = await supabase.from('chess_challenges').select('*').eq('game_id', gameId).maybeSingle()

    if (!challenge) {
      socket.emit('error', { message: 'Partie introuvable ou lien expiré' })
      return
    }

    if (CHALLENGE_OPEN_STATUSES.includes(challenge.status) && isExpiredIso(challenge.expires_at)) {
      await expireChallenge(gameId)
      socket.emit('error', { message: 'Partie introuvable ou lien expiré' })
      return
    }

    if (!ACTIVE_GAME_PLAYABLE_STATUSES.includes(challenge.status)) {
      socket.emit('error', { message: 'Partie introuvable ou lien expiré' })
      return
    }

    const allowedIds = [String(challenge.challenger_id)]
    if (challenge.opponent_id) allowedIds.push(String(challenge.opponent_id))
    if (!allowedIds.includes(telegramId)) {
      socket.emit('error', { message: 'Ce lien ne vous appartient pas' })
      return
    }

    let gameData = await ensureCachedGame(gameId, games, io)
    if (!gameData) {
      gameData = await ensureActiveGameFromChallenge(challenge)
      if (!gameData) {
        socket.emit('error', { message: 'Cette partie active ne peut pas être reprise pour le moment.' })
        return
      }
      games.set(gameId, gameData)
    }

    if (!canControlSeat(gameData, telegramId)) {
      socket.emit('error', { message: 'Ce lien ne correspond à aucune place active' })
      return
    }

    socket.telegramId = telegramId
    socket.authContext = { kind: 'seat', gameId, telegramId }
    addPlayerSocket(players, telegramId, socket.id)
    socket.join(gameId)

    await ensurePlayer(telegramId, String(challenge.challenger_id) === telegramId ? challenge.challenger_name : challenge.opponent_name)

    if (gameData.status === 'accepted') {
      gameData.status = 'playing'
      gameData.expiresAt = gameData.isAiGame ? null : toFutureIso(READY_TIMEOUT_MS)
      await Promise.all([
        syncChallengeState(gameId, 'playing', gameData.expiresAt),
        persistActiveGame(gameId, gameData)
      ])
    }

    await emitGameStarted(socket, gameId, gameData, telegramId)

    if (gameData.isAiGame) {
      gameData.expiresAt = null
      gameData.status = 'playing'
      await Promise.all([
        syncChallengeState(gameId, 'playing', null),
        persistActiveGame(gameId, gameData)
      ])
      startTimer(gameId, games, io)
      io.to(gameId).emit('game-ready-to-play')
      if (gameData.game.turn() === 'b' && gameData.black === AI_PLAYER_ID) {
        scheduleAiMove(gameId, gameData, games, io)
      }
    }
  })

  socket.on('player-ready', async ({ gameId }) => {
    if (socket.authContext?.kind !== 'seat' || socket.authContext.gameId !== gameId) {
      socket.emit('error', { message: 'Session joueur invalide' })
      return
    }

    const gameData = games.get(gameId) || await ensureCachedGame(gameId, games, io)
    if (!gameData || gameData.finished) return

    const playerColor = getPlayerColor(gameData, socket.authContext.telegramId)
    if (!playerColor) {
      socket.emit('error', { message: 'Place joueur invalide' })
      return
    }

    gameData.ready[playerColor] = true
    io.to(gameId).emit('player-ready-update', { color: playerColor, ready: true })

    if (gameData.ready.white && gameData.ready.black) {
      gameData.status = 'playing'
      gameData.expiresAt = null
      await Promise.all([
        syncChallengeState(gameId, 'playing', null),
        persistActiveGame(gameId, gameData)
      ])
      startTimer(gameId, games, io)
      io.to(gameId).emit('game-ready-to-play')

      if (gameData.isAiGame && gameData.game.turn() === 'b' && gameData.black === AI_PLAYER_ID) {
        scheduleAiMove(gameId, gameData, games, io)
      }
      return
    }

    if (!gameData.expiresAt) {
      gameData.expiresAt = toFutureIso(READY_TIMEOUT_MS)
      await syncChallengeState(gameId, 'playing', gameData.expiresAt)
    }
    await persistActiveGame(gameId, gameData)
  })

  socket.on('make-move', async ({ gameId, move }) => {
    if (socket.authContext?.kind !== 'seat' || socket.authContext.gameId !== gameId) {
      emitMoveRejected(socket, gameId, null, 'Session joueur invalide')
      return
    }

    const gameData = games.get(gameId) || await ensureCachedGame(gameId, games, io)
    if (!gameData || gameData.finished) {
      emitMoveRejected(socket, gameId, gameData, 'Partie introuvable')
      return
    }

    if (!gameData.ready.white || !gameData.ready.black) {
      emitMoveRejected(socket, gameId, gameData, 'Les deux joueurs doivent être prêts !')
      return
    }

    const currentTurn = gameData.game.turn() === 'w' ? 'white' : 'black'
    const playerColor = getPlayerColor(gameData, socket.authContext.telegramId)
    if (!playerColor) {
      emitMoveRejected(socket, gameId, gameData, 'Place joueur invalide')
      return
    }

    if (currentTurn !== playerColor) {
      emitMoveRejected(socket, gameId, gameData, "Ce n'est pas votre tour !")
      return
    }

    try {
      const moveResult = gameData.game.move(move)
      if (!moveResult) {
        emitMoveRejected(socket, gameId, gameData, 'Coup invalide')
        return
      }

      const moveEntry = createMoveEntry(moveResult, gameData.moves.length + 1, gameData.game.fen())
      if (!moveEntry) {
        emitMoveRejected(socket, gameId, gameData, 'Coup invalide')
        return
      }

      gameData.moves.push(moveEntry)
      gameData.lastTickTime = Date.now()
      gameData.expiresAt = null

      if (gameData.drawOffer) {
        gameData.drawOffer = null
        io.to(gameId).emit('draw-declined', {})
      }

      await persistActiveGame(gameId, gameData)

      const payload = emitMoveApplied(io, gameId, gameData, moveEntry)
      socket.to(gameId).emit('opponent-move', payload)

      if (gameData.game.isGameOver()) {
        await handleGameOver(gameId, gameData, games, io)
      } else if (gameData.isAiGame) {
        scheduleAiMove(gameId, gameData, games, io)
      }
    } catch (error) {
      console.error('Invalid move error:', error)
      emitMoveRejected(socket, gameId, gameData, 'Coup non autorisé')
    }
  })

  socket.on('resign', async ({ gameId }) => {
    if (socket.authContext?.kind !== 'seat' || socket.authContext.gameId !== gameId) {
      socket.emit('error', { message: 'Session joueur invalide' })
      return
    }

    const gameData = games.get(gameId) || await ensureCachedGame(gameId, games, io)
    if (!gameData || gameData.finished) return

    const playerColor = getPlayerColor(gameData, socket.authContext.telegramId)
    if (!playerColor) {
      socket.emit('error', { message: 'Place joueur invalide' })
      return
    }

    const winnerColor = playerColor === 'white' ? 'black' : 'white'
    await handleGameOver(gameId, gameData, games, io, 'resignation', winnerColor)
  })

  socket.on('get-profile', async () => {
    const targetId = socket.authContext?.telegramId
    if (!targetId) return socket.emit('error', { message: 'Session joueur invalide' })

    const profile = await getPlayerProfile(targetId)
    if (!profile) return socket.emit('error', { message: 'Joueur introuvable' })
    socket.emit('player-profile', profile)
  })

  socket.on('get-leaderboard', async ({ limit }) => {
    const leaderboard = await getLeaderboard(limit || 20)
    socket.emit('leaderboard-data', leaderboard)
  })

  socket.on('get-themes', async () => {
    const targetId = socket.authContext?.telegramId
    if (!targetId) return socket.emit('error', { message: 'Session joueur invalide' })
    const themes = await getThemes(targetId)
    socket.emit('themes-data', themes)
  })

  socket.on('set-theme', async ({ themeId }) => {
    const targetId = socket.authContext?.telegramId
    if (!targetId || !themeId) return socket.emit('error', { message: 'Session joueur invalide' })
    const result = await setActiveTheme(targetId, themeId)
    if (result.success) {
      const theme = await getPlayerActiveTheme(targetId)
      socket.emit('theme-changed', theme)
    } else {
      socket.emit('error', { message: result.error })
    }
  })

  socket.on('get-active-theme', async () => {
    const targetId = socket.authContext?.telegramId
    if (!targetId) return
    const theme = await getPlayerActiveTheme(targetId)
    socket.emit('active-theme', theme)
  })
}
