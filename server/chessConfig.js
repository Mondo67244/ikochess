export const DEFAULT_TIME_MS = 15 * 60 * 1000
export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export const PENDING_CHALLENGE_TTL_MS = 10 * 60 * 1000
export const ACCEPTED_CHALLENGE_TTL_MS = 15 * 60 * 1000
export const READY_TIMEOUT_MS = 5 * 60 * 1000

export const SEAT_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const WATCH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const PUBLIC_ACTIVE_GAME_LIMIT = 20
export const CACHE_CLEANUP_DELAY_MS = 60 * 1000

export const ACTIVE_GAME_PLAYABLE_STATUSES = ['accepted', 'playing']
export const CHALLENGE_OPEN_STATUSES = ['pending', 'accepted', 'playing']

export const toFutureIso = (ms) => new Date(Date.now() + ms).toISOString()

export const isExpiredIso = (value) => {
  if (!value) return false
  return new Date(value).getTime() <= Date.now()
}
