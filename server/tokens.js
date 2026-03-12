import crypto from 'crypto'

import { SEAT_TOKEN_TTL_MS, WATCH_TOKEN_TTL_MS } from './chessConfig.js'

const SIGNING_SECRET = process.env.SUPABASE_SERVICE_KEY || ''

const resolvePublicBaseUrl = () => {
  const baseUrl =
    process.env.CHESS_PUBLIC_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.VITE_SERVER_URL ||
    `http://localhost:${process.env.PORT || 3000}`

  return new URL(baseUrl)
}

const encodePayload = (payload) => Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')

const decodePayload = (encoded) => {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

const signValue = (value) => crypto.createHmac('sha256', SIGNING_SECRET).update(value).digest('base64url')

const safeEqual = (left, right) => {
  const leftBuf = Buffer.from(left)
  const rightBuf = Buffer.from(right)
  if (leftBuf.length !== rightBuf.length) return false
  return crypto.timingSafeEqual(leftBuf, rightBuf)
}

export const createSignedToken = (payload) => {
  const encoded = encodePayload(payload)
  return `${encoded}.${signValue(encoded)}`
}

export const verifySignedToken = (token, expectedKind) => {
  if (!SIGNING_SECRET || !token || typeof token !== 'string') return null

  const [encoded, signature, ...extra] = token.split('.')
  if (!encoded || !signature || extra.length > 0) return null

  const expectedSignature = signValue(encoded)
  if (!safeEqual(signature, expectedSignature)) return null

  const payload = decodePayload(encoded)
  if (!payload) return null
  if (expectedKind && payload.kind !== expectedKind) return null
  if (payload.exp && payload.exp < Date.now()) return null

  return payload
}

export const createSeatToken = ({ gameId, telegramId }) =>
  createSignedToken({
    kind: 'seat',
    v: 1,
    gameId,
    telegramId,
    exp: Date.now() + SEAT_TOKEN_TTL_MS
  })

export const createWatchToken = ({ gameId }) =>
  createSignedToken({
    kind: 'watch',
    v: 1,
    gameId,
    exp: Date.now() + WATCH_TOKEN_TTL_MS
  })

export const buildPlayUrl = ({ gameId, telegramId }) => {
  const url = resolvePublicBaseUrl()
  url.searchParams.set('game', gameId)
  url.searchParams.set('seat', createSeatToken({ gameId, telegramId }))
  return url.toString()
}

export const buildWatchUrl = ({ gameId }) => {
  const url = resolvePublicBaseUrl()
  url.searchParams.set('watch', gameId)
  url.searchParams.set('spectate', createWatchToken({ gameId }))
  return url.toString()
}
