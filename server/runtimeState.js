import { loadActiveGame } from './activeGames.js'
import { handleGameOver, startTimer } from './game/engine.js'

const reconcileRunningTimer = async (gameId, gameData, games, io) => {
  if (!io) return gameData
  if (gameData.finished || gameData.status !== 'playing') return gameData
  if (!gameData.ready.white || !gameData.ready.black) return gameData

  if (gameData.lastTickTime) {
    const activeColor = gameData.game.turn() === 'w' ? 'white' : 'black'
    const elapsed = Math.max(0, Date.now() - gameData.lastTickTime)
    gameData.timers[activeColor] = Math.max(0, gameData.timers[activeColor] - elapsed)
    gameData.lastTickTime = Date.now()

    if (gameData.timers[activeColor] <= 0) {
      await handleGameOver(gameId, gameData, games, io, 'timeout', activeColor === 'white' ? 'black' : 'white')
      return gameData
    }
  }

  startTimer(gameId, games, io)
  return gameData
}

export const ensureCachedGame = async (gameId, games, io) => {
  let gameData = games.get(gameId)
  if (gameData) return gameData

  gameData = await loadActiveGame(gameId)
  if (!gameData) return null

  games.set(gameId, gameData)
  if (io) {
    await reconcileRunningTimer(gameId, gameData, games, io)
  }
  return games.get(gameId) || gameData
}
