# Chess App ♟️

Real-time chess game with Telegram integration and ELO rankings.

**Live Demo:** [chess.ikouni.site](https://chess.ikouni.site)

## Features

- ✅ Playable chess board (drag & drop pieces)
- ✅ Move validation (no illegal moves)
- ✅ Check/Checkmate detection
- ✅ Turn-based gameplay with Telegram notifications
- ✅ ELO ranking system
- ✅ Game history
- ✅ Play against anyone in the group
- ✅ Real-time multiplayer via WebSocket

## Tech Stack

- **Frontend:** React + Vite + react-chessboard
- **Backend:** Node.js + Express + Socket.io
- **Database:** Supabase (PostgreSQL)
- **Auth:** Telegram ID
- **Hosting:** Docker on VPS with Caddy

## Quick Start

### Development

```bash
# Install all dependencies
npm run install:all

# Start dev servers (client + server)
npm run dev

# Access at http://localhost:5173
```

### Production (Docker)

```bash
# Build and run
docker compose up -d --build

# Access at http://localhost:3000
```

## Deployment

### 1. Set up Supabase Database

Run the SQL schema in your Supabase SQL Editor:

```bash
# Copy supabase-schema.sql and run in Supabase dashboard
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
- Supabase URL and service key
- Telegram bot token (for notifications)

### 3. Deploy to VPS

```bash
# Clone repo
git clone https://github.com/Mondo-Corp-inc/chess-app.git
cd chess-app

# Start with Docker
docker compose up -d --build
```

### 4. Configure Caddy

Add to your Caddyfile:

```caddy
chess.ikouni.site {
    reverse_proxy localhost:3000
    tls your-email@example.com
}
```

## API Endpoints

- `GET /health` - Server health check
- `GET /api/rankings` - Get player rankings
- `GET /api/game/:gameId` - Get game state

## WebSocket Events

**Client → Server:**
- `create-game` - Create new game
- `join-game` - Join existing game
- `make-move` - Submit a move

**Server → Client:**
- `game-created` - Game created successfully
- `game-started` - Game started (both players)
- `opponent-move` - Opponent made a move
- `game-over` - Game finished
- `game-available` - Broadcast for opponents

## Game Rules

- Standard chess rules (FIDE)
- Auto-queen promotion
- No time control (unlimited)
- ELO: Starts at 1200, K-factor = 32

## Project Structure

```
chess-app/
├── client/              # React frontend
│   ├── src/
│   │   ├── App.jsx     # Main component
│   │   ├── index.css   # Styles
│   │   └── main.jsx    # Entry point
│   └── index.html
├── server/              # Node.js backend
│   └── server.js       # Express + Socket.io
├── docker-compose.yml   # Docker config
├── Dockerfile
└── supabase-schema.sql # Database schema
```

## License

MIT

---

Built with ❤️ by the Devs Playground crew
