import { supabase } from './db.js'
import { CHALLENGE_OPEN_STATUSES } from './chessConfig.js'
import { updateActiveGamesByGameIds } from './activeGames.js'
import { stopTimer } from './game/engine.js'

export const expireDueChallenges = async (games, io) => {
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('chess_challenges')
    .select('game_id')
    .in('status', CHALLENGE_OPEN_STATUSES)
    .not('expires_at', 'is', null)
    .lte('expires_at', nowIso)

  if (error) {
    console.error('Challenge expiration scan failed:', error.message)
    return
  }

  const gameIds = (data || []).map((row) => row.game_id).filter(Boolean)
  if (gameIds.length === 0) return

  await Promise.all([
    supabase.from('chess_challenges').update({ status: 'expired' }).in('game_id', gameIds),
    updateActiveGamesByGameIds(gameIds, { status: 'expired', reason: 'expired', finished_at: nowIso, last_activity_at: nowIso })
  ])

  for (const gameId of gameIds) {
    const gameData = games.get(gameId)
    if (!gameData) continue
    stopTimer(gameId, games)
    gameData.finished = true
    gameData.status = 'expired'
    io.to(gameId).emit('game-expired', { message: 'Cette partie a expiré.' })
    games.delete(gameId)
  }
}
