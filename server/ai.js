import { createRequire } from 'module'
import path from 'path'

const require = createRequire(import.meta.url)
const Stockfish = require('stockfish/bin/stockfish-18-asm.js')
const { Chess } = require('chess.js')
const STOCKFISH_BIN_DIR = path.dirname(require.resolve('stockfish/bin/stockfish-18-asm.js'))

const resolveStockfishAsset = (file) =>
  path.join(STOCKFISH_BIN_DIR, file.replace(/^\.?\//, ''))

const createEngine = async () =>
  Stockfish()({
    locateFile: resolveStockfishAsset
  })

const getDifficultySettings = (difficulty) => {
  switch (difficulty) {
    case 'easy':
      return { skillLevel: 1, depth: 3 }
    case 'medium':
      return { skillLevel: 5, depth: 5 }
    case 'hard':
      return { skillLevel: 15, depth: 10 }
    case 'master':
    case 'grandmaster':
      return { skillLevel: 20, depth: 15 }
    default:
      return { skillLevel: 5, depth: 5 }
  }
}

export const getAiMove = async (game, difficulty) => {
  let engine = null

  return new Promise(async (resolve) => {
    let finished = false
    let timeout = null

    const finish = (value) => {
      if (finished) return
      finished = true
      if (timeout) clearTimeout(timeout)
      try {
        engine?.ccall?.('command', null, ['string'], ['quit'])
      } catch {}
      try {
        engine?.terminate?.()
      } catch {}
      resolve(value)
    }

    const { skillLevel, depth } = getDifficultySettings(difficulty)

    try {
      engine = await createEngine()
    } catch (error) {
      console.error('Failed to initialize Stockfish engine:', error)
      finish(null)
      return
    }

    timeout = setTimeout(() => {
      console.error('Stockfish timed out')
      finish(null)
    }, 8000)

    const send = (command) => {
      try {
        engine.ccall('command', null, ['string'], [command])
      } catch (error) {
        console.error(`Stockfish command failed (${command}):`, error)
        finish(null)
      }
    }

    engine.listener = (msg) => {
      if (finished) return
      if (typeof msg !== 'string') msg = String(msg || '')
      if (!msg.startsWith('bestmove')) return

      const parts = msg.trim().split(/\s+/)
      const bestMoveUci = parts[1]
      if (!bestMoveUci || bestMoveUci === '(none)') {
        finish(null)
        return
      }

      try {
        const testGame = new Chess(game.fen())
        const moveResult = testGame.move({
          from: bestMoveUci.slice(0, 2),
          to: bestMoveUci.slice(2, 4),
          promotion: bestMoveUci.length > 4 ? bestMoveUci[4] : undefined
        })
        finish(moveResult?.san || bestMoveUci)
      } catch (error) {
        console.error('Failed parsing Stockfish output to SAN:', error)
        finish(bestMoveUci)
      }
    }

    send('uci')
    send(`setoption name Skill Level value ${skillLevel}`)
    send('setoption name Threads value 1')
    send('ucinewgame')
    send(`position fen ${game.fen()}`)
    send(`go depth ${depth}`)
  })
}
