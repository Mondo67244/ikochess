-- IkoChess runtime schema
-- Apply in Supabase SQL Editor or through an admin migration channel.
-- Secrets stay unchanged; this file only defines tables/columns used by runtime code.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Players
CREATE TABLE IF NOT EXISTS players (
  id BIGSERIAL PRIMARY KEY,
  telegram_id TEXT UNIQUE NOT NULL,
  username TEXT,
  elo INTEGER NOT NULL DEFAULT 1200,
  title TEXT NOT NULL DEFAULT 'Novice',
  score INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  games_lost INTEGER NOT NULL DEFAULT 0,
  games_drawn INTEGER NOT NULL DEFAULT 0,
  win_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  active_theme TEXT NOT NULL DEFAULT 'telegram-blue',
  clan_group_id TEXT,
  clan_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE players ADD COLUMN IF NOT EXISTS active_theme TEXT NOT NULL DEFAULT 'telegram-blue';
ALTER TABLE players ADD COLUMN IF NOT EXISTS clan_group_id TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS clan_changed_at TIMESTAMPTZ;
ALTER TABLE players ADD COLUMN IF NOT EXISTS win_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS best_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Novice';
ALTER TABLE players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN players.clan_group_id IS 'Stores groups.telegram_chat_id as text.';

DROP TRIGGER IF EXISTS update_players_updated_at ON players;
CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Historical archived games
CREATE TABLE IF NOT EXISTS games (
  id BIGSERIAL PRIMARY KEY,
  game_id TEXT UNIQUE NOT NULL,
  white_player_id TEXT NOT NULL,
  black_player_id TEXT NOT NULL,
  winner_id TEXT,
  moves JSONB NOT NULL DEFAULT '[]'::jsonb,
  fen_start TEXT,
  fen_end TEXT,
  result TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE games ADD COLUMN IF NOT EXISTS moves JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE games ADD COLUMN IF NOT EXISTS fen_start TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS fen_end TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS result TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- Challenge lifecycle used by Telegram/OpenClaw orchestration
CREATE TABLE IF NOT EXISTS chess_challenges (
  id BIGSERIAL PRIMARY KEY,
  game_id TEXT UNIQUE NOT NULL,
  challenger_id TEXT NOT NULL,
  challenger_name TEXT,
  opponent_id TEXT,
  opponent_name TEXT,
  group_chat_id TEXT,
  is_ai_game BOOLEAN NOT NULL DEFAULT FALSE,
  ai_difficulty TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE chess_challenges ADD COLUMN IF NOT EXISTS group_chat_id TEXT;
ALTER TABLE chess_challenges ADD COLUMN IF NOT EXISTS is_ai_game BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE chess_challenges ADD COLUMN IF NOT EXISTS ai_difficulty TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE chess_challenges ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE chess_challenges ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Durable live game state used for resume/watch/recovery
CREATE TABLE IF NOT EXISTS active_games (
  game_id TEXT PRIMARY KEY,
  challenge_id BIGINT,
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
  finished_at TIMESTAMPTZ
);

ALTER TABLE active_games ADD COLUMN IF NOT EXISTS challenge_id BIGINT;
ALTER TABLE active_games ADD COLUMN IF NOT EXISTS group_chat_id TEXT;
ALTER TABLE active_games ADD COLUMN IF NOT EXISTS is_ai_game BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE active_games ADD COLUMN IF NOT EXISTS ai_difficulty TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE active_games ADD COLUMN IF NOT EXISTS fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
ALTER TABLE active_games ADD COLUMN IF NOT EXISTS moves JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE active_games ADD COLUMN IF NOT EXISTS timers JSONB NOT NULL DEFAULT '{"white":900000,"black":900000}'::jsonb;
ALTER TABLE active_games ADD COLUMN IF NOT EXISTS ready JSONB NOT NULL DEFAULT '{"white":false,"black":false}'::jsonb;
ALTER TABLE active_games ADD COLUMN IF NOT EXISTS draw_offer TEXT;
ALTER TABLE active_games ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'accepted';
ALTER TABLE active_games ADD COLUMN IF NOT EXISTS result TEXT;
ALTER TABLE active_games ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE active_games ADD COLUMN IF NOT EXISTS winner_id TEXT;
ALTER TABLE active_games ADD COLUMN IF NOT EXISTS last_tick_time TIMESTAMPTZ;
ALTER TABLE active_games ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE active_games ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE active_games ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

-- Themes
CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  light_color TEXT NOT NULL,
  dark_color TEXT NOT NULL,
  unlock_condition TEXT NOT NULL DEFAULT 'free',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE themes ADD COLUMN IF NOT EXISTS unlock_condition TEXT NOT NULL DEFAULT 'free';
ALTER TABLE themes ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE themes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS player_themes (
  player_id TEXT NOT NULL,
  theme_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, theme_id)
);

ALTER TABLE player_themes ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

INSERT INTO themes (id, name, light_color, dark_color, unlock_condition, sort_order)
VALUES
  ('telegram-blue', 'Telegram Blue', '#6490b1', '#2b5278', 'free', 0),
  ('sandstorm', 'Sandstorm', '#f0d9b5', '#b58863', 'wins:5', 10),
  ('emerald', 'Emerald', '#d8f3dc', '#40916c', 'elo:1300', 20)
ON CONFLICT (id) DO NOTHING;

-- Tournaments and seasons
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'elimination',
  max_players INTEGER NOT NULL DEFAULT 8,
  status TEXT NOT NULL DEFAULT 'registration',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS group_id TEXT NOT NULL DEFAULT '';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Tournament';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'elimination';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS max_players INTEGER NOT NULL DEFAULT 8;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'registration';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS tournament_participants (
  tournament_id UUID NOT NULL,
  player_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tournament_id, player_id)
);

ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS season_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  season INTEGER NOT NULL,
  final_elo INTEGER,
  final_title TEXT,
  group_defended TEXT,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  season_end TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, season)
);

ALTER TABLE season_history ADD COLUMN IF NOT EXISTS final_elo INTEGER;
ALTER TABLE season_history ADD COLUMN IF NOT EXISTS final_title TEXT;
ALTER TABLE season_history ADD COLUMN IF NOT EXISTS group_defended TEXT;
ALTER TABLE season_history ADD COLUMN IF NOT EXISTS wins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE season_history ADD COLUMN IF NOT EXISTS losses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE season_history ADD COLUMN IF NOT EXISTS season_end TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Shared OpenClaw groups table expectations
-- Chess code resolves groups by groups.telegram_chat_id, not groups.id.
ALTER TABLE IF EXISTS groups ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
ALTER TABLE IF EXISTS groups ADD COLUMN IF NOT EXISTS group_elo INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE IF EXISTS groups ADD COLUMN IF NOT EXISTS wars_won INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS groups ADD COLUMN IF NOT EXISTS total_wars INTEGER NOT NULL DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_players_telegram ON players(telegram_id);
CREATE INDEX IF NOT EXISTS idx_players_elo ON players(elo DESC);
CREATE INDEX IF NOT EXISTS idx_players_clan_group ON players(clan_group_id);
CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_white ON games(white_player_id);
CREATE INDEX IF NOT EXISTS idx_games_black ON games(black_player_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON chess_challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_expires_at ON chess_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_challenges_group_chat ON chess_challenges(group_chat_id);
CREATE INDEX IF NOT EXISTS idx_active_games_status ON active_games(status);
CREATE INDEX IF NOT EXISTS idx_active_games_last_activity ON active_games(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_active_games_expires_at ON active_games(expires_at);
CREATE INDEX IF NOT EXISTS idx_tournaments_group_status ON tournaments(group_id, status);
CREATE INDEX IF NOT EXISTS idx_season_history_player ON season_history(player_id, season DESC);
