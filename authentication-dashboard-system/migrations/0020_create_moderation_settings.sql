-- 0020_create_moderation_settings.sql

-- Single row table for global moderation settings
CREATE TABLE moderation_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  model TEXT NOT NULL DEFAULT 'deepseek-chat',
  temperature REAL NOT NULL DEFAULT 0,
  max_tokens INTEGER NOT NULL DEFAULT 256,
  system_prompt TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,

  FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Moderation log for audit trail
CREATE TABLE moderation_log (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  message_content TEXT NOT NULL,
  model_used TEXT NOT NULL,
  allowed INTEGER NOT NULL,
  rejection_reason TEXT,
  response_time_ms INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (company_id) REFERENCES game_companies(id)
);

CREATE INDEX idx_moderation_log_company ON moderation_log(company_id);
CREATE INDEX idx_moderation_log_time ON moderation_log(created_at);
CREATE INDEX idx_moderation_log_rejected ON moderation_log(allowed) WHERE allowed = 0;

-- Insert default settings
INSERT INTO moderation_settings (id, model, temperature, max_tokens, system_prompt, enabled)
VALUES (
  'global',
  'deepseek-chat',
  0,
  256,
  'You are a content moderator for a multiplayer business strategy game called Notropolis.

Review the following message and determine if it should be allowed on the public message board.

REJECT messages that contain:
- Hate speech, slurs, or discrimination
- Sexual or explicit content
- Real threats or violence
- Personal information or doxxing attempts
- External links or advertisements
- Real-money trading offers (RMT)
- Excessive spam or caps lock (>50% caps)
- Impersonation of admins or staff

ALLOW messages that contain:
- Normal game discussion and strategy
- Friendly banter and trash talk (within reason)
- In-game trading offers
- Questions and help requests

Respond with ONLY valid JSON:
{"allowed": true} or {"allowed": false, "reason": "brief explanation"}',
  1
);
