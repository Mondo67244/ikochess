import { Chess } from 'chess.js'

import { AI_PLAYER_ID, getPlayerName, supabase } from './db.js'
import {
  DEFAULT_TIME_MS,
  INITIAL_FEN,
  PUBLIC_ACTIVE_GAME_LIMIT
} from './chessConfig.js'
import { buildWatchUrl } from './tokens.js'

let activeGamesAvailable = null

const isMissingActiveGamesError = (error) => {
  const message = error?.message || ''
  return message.includes("public.active_games") || message.includes("relation \"active_games\" does not exist")
}

const markActiveGamesUnavailable = (error) => {
  if (activeGamesAvailable === false) return
  activeGamesAvailable = false
  console.warn('active_games persistence disabled:', error?.message || 'table unavailable')
}

const normalizeTimers = (timers) => ({
  white: Number(timers?.white ?? DEFAULT_TIME_MS),
  black: Number(timers?.black ?? DEFAULT_TIME_MS)
})

const normalizeReady = (ready, isAiGame) => ({
  white: Boolean(ready?.white ?? isAiGame),
  black: Boolean(ready?.black ?? isAiGame)
})

const toIsoOrNull = (value) => {
  if (!value) return null
  return new Date(value).toISOString()
}

export const buildGameDataFromChallenge = (challenge) => {
  const isAiGame = Boolean(challenge.is_ai_game)
  return {
    game: new Chess(),
    white: challenge.challenger_id,
    black: isAiGame ? AI_PLAYER_ID : challenge.opponent_id,
    moves: [],
    isAiGame,
    aiDifficulty: challenge.ai_difficulty || 'medium',
    createdAt: new Date(challenge.created_at || Date.now()),
    timers: { white: DEFAULT_TIME_MS, black: DEFAULT_TIME_MS },
    lastTickTime: null,
    timerInterval: null,
    drawOffer: null,
    finished: false,
    ready: normalizeReady(null, isAiGame),
    status: challenge.status || 'accepted',
    expiresAt: challenge.expires_at || null,
    groupChatId: challenge.group_chat_id || null,
    challengeId: challenge.id || null,
    winnerId: null,
    result: null,
    reason: null,
    finishedAt: null
  }
}

export const buildGameDataFromRecord = (record) => {
  const game = new Chess()
  game.load(record.fen || INITIAL_FEN)

  return {
    game,
    white: record.white_player_id,
    black: record.black_player_id,
    moves: Array.isArray(record.moves) ? record.moves : [],
    isAiGame: Boolean(record.is_ai_game),
    aiDifficulty: record.ai_difficulty || 'medium',
    createdAt: new Date(record.created_at || Date.now()),
    timers: normalizeTimers(record.timers),
    lastTickTime: record.last_tick_time ? new Date(record.last_tick_time).getTime() : null,
    timerInterval: null,
    drawOffer: record.draw_offer || null,
    finished: ['finished', 'expired', 'cancelled'].includes(record.status),
    ready: normalizeReady(record.ready, record.is_ai_game),
    status: record.status || 'accepted',
    expiresAt: record.expires_at || null,
    groupChatId: record.group_chat_id || null,
    challengeId: record.challenge_id || null,
    winnerId: record.winner_id || null,
    result: record.result || null,
    reason: record.reason || null,
    finishedAt: record.finished_at || null
  }
}

export const serializeGameData = (gameId, gameData) => ({
  game_id: gameId,
  challenge_id: gameData.challengeId || null,
  white_player_id: gameData.white,
  black_player_id: gameData.black,
  group_chat_id: gameData.groupChatId || null,
  is_ai_game: gameData.isAiGame,
  ai_difficulty: gameData.aiDifficulty || 'medium',
  fen: gameData.game?.fen() || INITIAL_FEN,
  moves: Array.isArray(gameData.moves) ? gameData.moves : [],
  timers: normalizeTimers(gameData.timers),
  ready: normalizeReady(gameData.ready, gameData.isAiGame),
  draw_offer: gameData.drawOffer || null,
  status: gameData.status || (gameData.finished ? 'finished' : 'accepted'),
  result: gameData.result || null,
  reason: gameData.reason || null,
  winner_id: gameData.winnerId || null,
  last_tick_time: toIsoOrNull(gameData.lastTickTime),
  last_activity_at: new Date().toISOString(),
  expires_at: gameData.expiresAt || null,
  created_at: toIsoOrNull(gameData.createdAt) || new Date().toISOString(),
  finished_at: gameData.finishedAt || null
})

export const persistActiveGame = async (gameId, gameData) => {
  if (activeGamesAvailable === false) return null
  const record = serializeGameData(gameId, gameData)
  const { error } = await supabase.from('active_games').upsert(record, { onConflict: 'game_id' })
  if (error) {
    if (isMissingActiveGamesError(error)) {
      markActiveGamesUnavailable(error)
      return null
    }
    throw error
  }
  activeGamesAvailable = true
  return record
}

export const loadActiveGameRecord = async (gameId) => {
  if (activeGamesAvailable === false) return null
  const { data, error } = await supabase.from('active_games').select('*').eq('game_id', gameId).maybeSingle()
  if (error) {
    if (isMissingActiveGamesError(error)) {
      markActiveGamesUnavailable(error)
      return null
    }
    throw error
  }
  activeGamesAvailable = true
  return data || null
}

export const loadActiveGame = async (gameId) => {
  const record = await loadActiveGameRecord(gameId)
  if (record) return buildGameDataFromRecord(record)

  if (activeGamesAvailable === false) {
    const { data: challenge, error } = await supabase
      .from('chess_challenges')
      .select('*')
      .eq('game_id', gameId)
      .eq('status', 'accepted')
      .maybeSingle()
    if (error || !challenge) return null
    return buildGameDataFromChallenge(challenge)
  }

  return null
}

export const ensureActiveGameFromChallenge = async (challenge) => {
  const existing = await loadActiveGameRecord(challenge.game_id)
  if (existing) return buildGameDataFromRecord(existing)

  if (activeGamesAvailable === false && challenge.status === 'playing') {
    return null
  }

  const gameData = buildGameDataFromChallenge(challenge)
  await persistActiveGame(challenge.game_id, gameData)
  return gameData
}

export const updatePersistentGameStatus = async (gameId, status, fields = {}) => {
  if (activeGamesAvailable === false) return
  const payload = {
    status,
    last_activity_at: new Date().toISOString(),
    ...fields
  }
  const { error } = await supabase.from('active_games').update(payload).eq('game_id', gameId)
  if (error) {
    if (isMissingActiveGamesError(error)) {
      markActiveGamesUnavailable(error)
      return
    }
    throw error
  }
  activeGamesAvailable = true
}

export const listPublicActiveGames = async () => {
  if (activeGamesAvailable === false) {
    const { data, error } = await supabase
      .from('chess_challenges')
      .select('game_id, challenger_name, opponent_name, is_ai_game, ai_difficulty')
      .eq('status', 'playing')
      .order('created_at', { ascending: false })
      .limit(PUBLIC_ACTIVE_GAME_LIMIT)
    if (error) throw error
    return (data || []).map((row) => ({
      gameId: row.game_id,
      challengerName: row.challenger_name || 'Joueur',
      opponentName: row.is_ai_game ? 'OpenClaw AI' : (row.opponent_name || 'Joueur'),
      isAiGame: row.is_ai_game,
      aiDifficulty: row.ai_difficulty || 'medium',
      watchUrl: buildWatchUrl({ gameId: row.game_id })
    }))
  }

  const { data, error } = await supabase
    .from('active_games')
    .select('game_id, white_player_id, black_player_id, is_ai_game, ai_difficulty, status, last_activity_at')
    .eq('status', 'playing')
    .order('last_activity_at', { ascending: false })
    .limit(PUBLIC_ACTIVE_GAME_LIMIT)

  if (error) {
    if (isMissingActiveGamesError(error)) {
      markActiveGamesUnavailable(error)
      return listPublicActiveGames()
    }
    throw error
  }
  activeGamesAvailable = true

  const rows = data || []
  return Promise.all(rows.map(async (row) => ({
    gameId: row.game_id,
    challengerName: await getPlayerName(row.white_player_id),
    opponentName: row.is_ai_game ? 'OpenClaw AI' : await getPlayerName(row.black_player_id),
    isAiGame: row.is_ai_game,
    aiDifficulty: row.ai_difficulty || 'medium',
    watchUrl: buildWatchUrl({ gameId: row.game_id })
  })))
}
