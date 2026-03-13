# ♟️ IkoChess Architecture Documentation

Welcome to the architectural overview of **IkoChess**, a modern, real-time, multi-player chess application seamlessly integrated with Telegram.

This document serves to explain the evolution of the project from its initial monolithic design (V1) to its new, scalable, and decentralized architecture (V2).

Important note: this document explains the broad architecture. For the current hardened Telegram/OpenClaw flow, signed links, challenge lifecycle, and usage guide, read [**NOUVEAU_SYSTEME.md**](./NOUVEAU_SYSTEME.md).

---

## 🏗️ Evolution: From Monolith (V1) to Micro-Services (V2)

### The Old Architecture (V1)
In the initial version, the application was built fast to prove the concept:
- **Client Monolith**: `App.jsx` contained everything: the chessboard, the chat, the HUD, the spectator logic, and the timer formatting. It stood at ~600 lines, making it difficult to maintain or style individual components without side effects.
- **Server Monolith**: `sockets.js` handled every single WebSocket event from matchmaking, moving pieces, spectator mode, and emojis.
- **State Management**: Game state (`games`, `players`, `spectators`) was stored purely in-memory using Node.js `Map` objects. This meant the server could not be horizontally scaled.
- **AI Integration**: The AI logic relied on LLMs (Qwen API). While creative, it often required a fallback to random moves due to the LLM "hallucinating" illegal chess moves.

### The New Architecture (V2)
The refactored **IkoChess** introduces separation of concerns, higher reliability, and massive scalability.

#### 1. Frontend: Component-Driven Design
The frontend has been broken down into isolated, reusable React components:
- **`ChessBoardComponent.jsx`**: Handles the `react-chessboard` integration and move interactions.
- **`PlayerBadge.jsx`**: Handles player plaques, captured material summary, emojis, and clocks.
- **`ChatAndSpectator.jsx`**: Isolates the social features—emoji throwing, draw/resign actions, and the live spectator count.
- **`App.jsx`**: Remains the main container/controller for socket orchestration, authoritative move sync, board state, and game-status UX.
- **`GameStatusBar.jsx`** and **`MoveHistorySheet.jsx`**: Add the new gameplay readability layer (last move, check state, compact move history).
- **Responsive Telegram UI layer**: The shell now consumes Telegram Mini App theme params, uses a Telegram-like palette by default, and standardizes popups into scrollable mobile-first modals/sheets.

#### 2. Backend: Modular Service-Oriented Logic
The server has been split into specific controllers:
- **`gameController.js`**: Core game logic (moves, ready-checks).
- **`chatController.js`**: Social interactions (emojis, draw logic).
- **`spectatorController.js`**: Observer management.

The current runtime also standardizes live board sync through a single authoritative payload:

- **`move-applied`**: broadcast to every participant and spectator after each validated move.
- **`move-rejected`**: sent back to the acting player when a move must be rolled back to server state.
- **`statePayload.js`**: normalizes move history, last move, timers, and check state for client consumption.
- **`activeGames.js`**: owns the durable live-state bridge, `active_games` probing, and fallback behavior when the table has not been created yet.

#### 3. Scaling: Redis Adapter
By integrating the `@socket.io/redis-adapter` and connecting to a Redis instance, the real-time pub/sub features are decoupled from a single Node.js process. This allows spinning up multiple Docker containers of the backend to handle thousands of concurrent players without WebSockets dropping or missing messages.

Current note: the hardening pass is already live without requiring Redis. The most immediate persistence dependency is the `active_games` table in Supabase, with SQL available in [`sql/active_games.sql`](./sql/active_games.sql) and the broader runtime schema in [`supabase-schema.sql`](./supabase-schema.sql).

#### 4. The Intelligence: Stockfish Automation
We replaced the LLM-based API with **Stockfish.js** running directly on the server.
- **Why?** Stockfish is the absolute gold standard for chess engines. It guarantees 100% legal moves, evaluates millions of positions per second, and accurately scales its difficulty (Skill Level).
- **Result**: Zero API costs, zero illegal moves, and a much sharper AI opponent for the "Master" difficulty setting.

---

## 📡 The Telegram Integration (OpenClaw)

One of the most unique aspects of IkoChess is its deep integration with the **OpenClaw Telegram Bot**:
1. **Matchmaking**: Players type `/chess` in a Telegram Group to throw down a gauntlet.
2. **Deep Linking**: OpenClaw asks IkoChess to mint signed player and spectator URLs. Group messages keep callback buttons, while player-specific play links are sent in DM.
3. **Seamless Auth**: The web app joins with signed `seat` and `spectate` tokens validated server-side. Sensitive actions no longer trust a client-supplied `telegramId`.
4. **Lifecycle Ownership**: OpenClaw remains the Telegram delivery layer, while IkoChess is the authoritative service for challenge lifecycle, gameplay, timers, rankings, and spectator access.

*Built with ❤️ for the Telegram gaming community.*
