import { getPlayerName } from '../db.js'
import { ensureCachedGame } from '../runtimeState.js'
import { verifySignedToken } from '../tokens.js'

export const registerSpectatorHandlers = (io, socket, games, spectators) => {
  socket.on('join-spectate', async ({ gameId, token }) => {
    const watchSession = verifySignedToken(token, 'watch')
    const resolvedGameId = watchSession?.gameId || gameId
    if (!watchSession || !resolvedGameId || watchSession.gameId !== resolvedGameId) {
      socket.emit('error', { message: 'Lien spectateur invalide ou expiré' })
      return
    }

    const gameData = await ensureCachedGame(resolvedGameId, games, io)
    if (!gameData || ['expired', 'cancelled'].includes(gameData.status)) {
      socket.emit('error', { message: 'Game not found' })
      return
    }

    socket.authContext = { kind: 'watch', gameId: resolvedGameId }
    socket.join(resolvedGameId)

    if (!spectators.has(resolvedGameId)) spectators.set(resolvedGameId, new Set())
    spectators.get(resolvedGameId).add(socket.id)
    
    const newCount = spectators.get(resolvedGameId).size
    io.to(resolvedGameId).emit('spectator-count', { count: newCount })

    const whiteName = await getPlayerName(gameData.white)
    const blackName = await getPlayerName(gameData.black)

    socket.emit('spectate-started', {
      gameId: resolvedGameId,
      white: gameData.white, black: gameData.black,
      whiteName, blackName,
      fen: gameData.game.fen(),
      isAiGame: gameData.isAiGame,
      aiDifficulty: gameData.aiDifficulty,
      timers: gameData.timers,
      moveHistory: gameData.moves,
      ready: gameData.ready,
      status: gameData.status
    })
  })
}
