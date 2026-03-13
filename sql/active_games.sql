-- IkoChess / active_games
-- Execute this in the Supabase SQL Editor.
-- This table stores the durable live state for active or resumable chess games.

CREATE TABLE IF NOT EXISTS public.active_games (
  game_id TEXT PRIMARY KEY,
  challenge_id BIGINT REFERENCES public.chess_challenges(id) ON DELETE SET NULL,
  white_player_id TEXT NOT NULL,
  black_player_id TEXT NOT NULL,
  group_chat_id TEXT,
  is_ai_game BOOLEAN NOT NULL DEFAULT FALSE,
  ai_difficulty TEXT NOT NULL DEFAULT 'medium',
  fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves JSONB NOT NULL DEFAULT '[]'::jsonb,
  timers JSONB NOT NULL DEFAULT '{"white":900000,"black":900000}'::jsonb,
  ready JSONB NOT NULL DEFAULT '{"white":false,"black":false}'::jsonb,
  draw_offer TEXT,
  status TEXT NOT NULL DEFAULT 'accepted',
  result TEXT,
  reason TEXT,
  winner_id TEXT,
  last_tick_time TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  CONSTRAINT active_games_status_check
    CHECK (status IN ('accepted', 'playing', 'finished', 'cancelled', 'expired')),
  CONSTRAINT active_games_ai_difficulty_check
    CHECK (ai_difficulty IN ('easy', 'medium', 'hard', 'master')),
  CONSTRAINT active_games_moves_is_array
    CHECK (jsonb_typeof(moves) = 'array'),
  CONSTRAINT active_games_timers_is_object
    CHECK (jsonb_typeof(timers) = 'object'),
  CONSTRAINT active_games_ready_is_object
    CHECK (jsonb_typeof(ready) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_active_games_status
  ON public.active_games(status);

CREATE INDEX IF NOT EXISTS idx_active_games_last_activity
  ON public.active_games(last_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_active_games_expires_at
  ON public.active_games(expires_at);

CREATE INDEX IF NOT EXISTS idx_active_games_white_player
  ON public.active_games(white_player_id);

CREATE INDEX IF NOT EXISTS idx_active_games_black_player
  ON public.active_games(black_player_id);

CREATE INDEX IF NOT EXISTS idx_active_games_group_chat
  ON public.active_games(group_chat_id);
