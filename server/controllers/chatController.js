import { persistActiveGame } from '../activeGames.js'
import { handleGameOver } from '../game/engine.js'

const getAuthorizedSeatColor = (socket, gameData, gameId) => {
  if (socket.authContext?.kind !== 'seat' || socket.authContext.gameId !== gameId) return null
  if (String(gameData.white) === String(socket.authContext.telegramId)) return 'white'
  if (String(gameData.black) === String(socket.authContext.telegramId)) return 'black'
  return null
}

export const registerChatHandlers = (io, socket, games) => {
  socket.on('offer-draw', async ({ gameId }) => {
    const gameData = games.get(gameId)
    if (!gameData || gameData.finished || gameData.isAiGame) return

    const playerColor = getAuthorizedSeatColor(socket, gameData, gameId)
    if (!playerColor) return
    if (gameData.drawOffer === playerColor) return

    gameData.drawOffer = playerColor
    await persistActiveGame(gameId, gameData)
    socket.to(gameId).emit('draw-offered', { from: playerColor })
  })

  socket.on('accept-draw', async ({ gameId }) => {
    const gameData = games.get(gameId)
    if (!gameData || gameData.finished || !gameData.drawOffer) return

    const playerColor = getAuthorizedSeatColor(socket, gameData, gameId)
    if (!playerColor) return
    if (gameData.drawOffer === playerColor) return 

    await handleGameOver(gameId, gameData, games, io, 'agreement', null)
  })

  socket.on('decline-draw', async ({ gameId }) => {
    const gameData = games.get(gameId)
    if (!gameData || !gameData.drawOffer) return

    const playerColor = getAuthorizedSeatColor(socket, gameData, gameId)
    if (!playerColor) return

    gameData.drawOffer = null
    await persistActiveGame(gameId, gameData)
    io.to(gameId).emit('draw-declined', {})
  })

  socket.on('send-emoji', ({ gameId, emoji }) => {
    const gameData = games.get(gameId)
    if (!gameData || gameData.finished) return

    const playerColor = getAuthorizedSeatColor(socket, gameData, gameId)
    if (!playerColor) return
    const allowedEmojis = ['👍', '👎', '🤬', '👏', '😂', '🔥', '🤔', '💀', '😤', '😎']
    if (!allowedEmojis.includes(emoji)) return

    socket.to(gameId).emit('emoji', { emoji, color: playerColor })
  })
}
