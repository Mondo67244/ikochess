import {
  AI_PLAYER_ID,
  ensurePlayer,
  getActiveTournaments,
  getClanMembers,
  getClanRankings,
  setPlayerClan,
  createTournament,
  joinTournament,
  supabase
} from './db.js'
import {
  ACCEPTED_CHALLENGE_TTL_MS,
  CHALLENGE_OPEN_STATUSES,
  PENDING_CHALLENGE_TTL_MS,
  isExpiredIso,
  toFutureIso
} from './chessConfig.js'
import { buildRealtimeGameState } from './game/statePayload.js'
import { buildPlayUrl, buildWatchUrl } from './tokens.js'
import {
  buildPublicActiveGameFromRuntime,
  ensureActiveGameFromChallenge,
  getActiveGamesAvailability,
  listPublicActiveGames,
  updateActiveGameByGameId
} from './activeGames.js'
import { ensureCachedGame } from './runtimeState.js'

const expireChallenge = async (gameId) => {
  const nowIso = new Date().toISOString()
  await Promise.all([
    supabase.from('chess_challenges').update({ status: 'expired' }).eq('game_id', gameId).in('status', CHALLENGE_OPEN_STATUSES),
    updateActiveGameByGameId(gameId, { status: 'expired', reason: 'expired', finished_at: nowIso, last_activity_at: nowIso })
  ])
}

const getChallengeByGameId = async (gameId, { autoExpire = true } = {}) => {
  const { data, error } = await supabase.from('chess_challenges').select('*').eq('game_id', gameId).maybeSingle()
  if (error || !data) return null

  if (autoExpire && CHALLENGE_OPEN_STATUSES.includes(data.status) && isExpiredIso(data.expires_at)) {
    await expireChallenge(gameId)
    return { ...data, status: 'expired' }
  }

  return data
}

export const setupRoutes = (app, games) => {
  app.post('/api/challenge', async (req, res) => {
    const { challengerId, challengerName, groupChatId, isAiGame, aiDifficulty } = req.body
    const aiGame = Boolean(isAiGame)
    const gameId = `game_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
    const expiresAt = toFutureIso(aiGame ? ACCEPTED_CHALLENGE_TTL_MS : PENDING_CHALLENGE_TTL_MS)

    await ensurePlayer(challengerId, challengerName)

    const insertPayload = {
      game_id: gameId,
      challenger_id: challengerId,
      challenger_name: challengerName,
      group_chat_id: groupChatId,
      is_ai_game: aiGame,
      ai_difficulty: aiDifficulty || 'medium',
      status: aiGame ? 'accepted' : 'pending',
      expires_at: expiresAt
    }

    if (aiGame) {
      insertPayload.opponent_id = AI_PLAYER_ID
      insertPayload.opponent_name = 'OpenClaw AI'
    }

    const { data: challenge, error } = await supabase.from('chess_challenges').insert(insertPayload).select('*').single()
    if (error) return res.status(500).json({ error: error.message })

    let playerUrl = null
    let watchUrl = null
    if (aiGame) {
      await ensureActiveGameFromChallenge(challenge)
      playerUrl = buildPlayUrl({ gameId, telegramId: String(challenge.challenger_id) })
      watchUrl = buildWatchUrl({ gameId })
    }

    res.json({ gameId, playerUrl, watchUrl })
  })

  app.post('/api/challenge/:gameId/accept', async (req, res) => {
    const { opponentId, opponentName } = req.body
    const { gameId } = req.params

    const challenge = await getChallengeByGameId(gameId)
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' })
    }

    if (challenge.status === 'expired') {
      return res.status(400).json({ error: 'Challenge expired', isExpired: true })
    }

    if (challenge.status !== 'pending') {
      return res.status(400).json({ error: 'Challenge already accepted, expired, or finished' })
    }

    if (String(challenge.challenger_id) === String(opponentId)) {
      return res.status(400).json({ error: 'Cannot accept your own challenge' })
    }

    await ensurePlayer(opponentId, opponentName)

    const expiresAt = toFutureIso(ACCEPTED_CHALLENGE_TTL_MS)
    const { data: acceptedChallenge, error } = await supabase
      .from('chess_challenges')
      .update({
        opponent_id: opponentId,
        opponent_name: opponentName,
        status: 'accepted',
        expires_at: expiresAt
      })
      .eq('game_id', gameId)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle()

    if (error) return res.status(500).json({ error: error.message })
    if (!acceptedChallenge) {
      return res.status(400).json({ error: 'Challenge already accepted, expired, or finished' })
    }

    await ensureActiveGameFromChallenge(acceptedChallenge)

    res.json({
      success: true,
      challenge: acceptedChallenge,
      challengerUrl: buildPlayUrl({ gameId, telegramId: String(acceptedChallenge.challenger_id) }),
      opponentUrl: buildPlayUrl({ gameId, telegramId: String(acceptedChallenge.opponent_id) }),
      watchUrl: buildWatchUrl({ gameId })
    })
  })

  app.post('/api/challenge/:gameId/cancel', async (req, res) => {
    const { challengerId } = req.body
    const { gameId } = req.params

    const challenge = await getChallengeByGameId(gameId, { autoExpire: false })
    if (!challenge) return res.status(404).json({ error: 'Challenge not found' })

    if (String(challenge.challenger_id) !== String(challengerId)) {
      return res.status(403).json({ error: 'Only the challenger can cancel this challenge' })
    }

    if (!['pending', 'accepted'].includes(challenge.status)) {
      return res.status(400).json({ error: 'Challenge can no longer be cancelled' })
    }

    const nowIso = new Date().toISOString()
    await Promise.all([
      supabase.from('chess_challenges').update({ status: 'cancelled', expires_at: nowIso }).eq('game_id', gameId),
      updateActiveGameByGameId(gameId, { status: 'cancelled', reason: 'cancelled', finished_at: nowIso, last_activity_at: nowIso })
    ])

    if (games.has(gameId)) games.delete(gameId)
    res.json({ success: true })
  })

  app.get('/api/challenge/:gameId', async (req, res) => {
    const challenge = await getChallengeByGameId(req.params.gameId)
    if (!challenge) return res.status(404).json({ error: 'Challenge not found' })
    res.json(challenge)
  })

  app.get('/api/rankings', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('telegram_id, username, elo, score, games_played, games_won, games_lost, games_drawn')
        .order('elo', { ascending: false })
        .limit(50)
      if (error) throw error
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  app.get('/api/game/:gameId', async (req, res) => {
    const gameData = await ensureCachedGame(req.params.gameId, games, null)
    if (!gameData) return res.status(404).json({ error: 'Game not found' })

    res.json({
      ...buildRealtimeGameState(req.params.gameId, gameData),
      moves: gameData.moves,
      white: gameData.white,
      black: gameData.black,
      isAiGame: gameData.isAiGame,
      ready: gameData.ready,
      status: gameData.status
    })
  })

  app.get('/api/active-games', async (req, res) => {
    try {
      const runtimeGames = await Promise.all(
        Array.from(games.entries())
          .filter(([, gameData]) => gameData && !gameData.finished && gameData.status === 'playing')
          .map(([runtimeGameId, gameData]) => buildPublicActiveGameFromRuntime(runtimeGameId, gameData))
      )

      if (getActiveGamesAvailability() === false) {
        return res.json(runtimeGames)
      }

      const activeGames = await listPublicActiveGames()
      if (getActiveGamesAvailability() === false) {
        return res.json(runtimeGames)
      }
      res.json(activeGames)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  app.post('/api/setclan', async (req, res) => {
    const { telegramId, groupId, groupName } = req.body
    const normalizedGroupId = String(groupId)
    const numericGroupId = Number(normalizedGroupId)

    await ensurePlayer(telegramId)

    const { data: existingGroup } = await supabase
      .from('groups')
      .select('telegram_chat_id')
      .eq('telegram_chat_id', numericGroupId)
      .single()

    if (!existingGroup && groupName) {
      await supabase.from('groups').insert({
        telegram_chat_id: numericGroupId,
        title: groupName,
        name: groupName
      })
    }

    const result = await setPlayerClan(telegramId, normalizedGroupId)
    if (!result.success) return res.status(400).json({ error: result.error })
    res.json({ success: true, message: 'Clan mis à jour avec succès.' })
  })

  app.get('/api/groups/rankings', async (req, res) => {
    const rankings = await getClanRankings(20)
    res.json(rankings)
  })

  app.get('/api/groups/:groupId/members', async (req, res) => {
    const members = await getClanMembers(String(req.params.groupId))
    res.json(members)
  })

  app.post('/api/tournaments', async (req, res) => {
    const { groupId, name, format, maxPlayers } = req.body
    if (!groupId || !name) return res.status(400).json({ error: 'groupId et name requis' })
    const result = await createTournament(String(groupId), name, format, maxPlayers)
    if (!result.success) return res.status(500).json({ error: result.error })
    res.json(result)
  })

  app.get('/api/tournaments', async (req, res) => {
    const { groupId } = req.query
    const tournaments = await getActiveTournaments(groupId ? String(groupId) : null)
    res.json(tournaments)
  })

  app.post('/api/tournaments/:id/join', async (req, res) => {
    const { telegramId } = req.body
    if (!telegramId) return res.status(400).json({ error: 'telegramId requis' })
    const result = await joinTournament(req.params.id, telegramId)
    if (!result.success) return res.status(400).json({ error: result.error })
    res.json({ success: true, message: 'Inscription réussie.' })
  })
}
