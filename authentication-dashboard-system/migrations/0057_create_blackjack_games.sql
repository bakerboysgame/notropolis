-- Create blackjack games table for server-side game state
CREATE TABLE IF NOT EXISTS blackjack_games (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES game_companies(id) ON DELETE CASCADE,
  bet_amount INTEGER NOT NULL,
  deck TEXT NOT NULL, -- JSON array of remaining cards
  player_hand TEXT NOT NULL, -- JSON array of player cards
  dealer_hand TEXT NOT NULL, -- JSON array of dealer cards
  state TEXT NOT NULL DEFAULT 'player_turn', -- betting, player_turn, dealer_turn, finished
  result TEXT, -- blackjack, win, lose, push, bust, dealer_bust, dealer_blackjack
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for finding active games by company
CREATE INDEX IF NOT EXISTS idx_blackjack_games_company ON blackjack_games(company_id, state);

-- Index for cleanup of old games
CREATE INDEX IF NOT EXISTS idx_blackjack_games_created ON blackjack_games(created_at);
