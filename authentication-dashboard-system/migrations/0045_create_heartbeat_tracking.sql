-- Heartbeat tracking table for audit and bot detection analysis
CREATE TABLE heartbeat_log (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  turnstile_success INTEGER NOT NULL,
  mouse_move_count INTEGER DEFAULT 0,
  touch_event_count INTEGER DEFAULT 0,
  scroll_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  time_on_page_ms INTEGER DEFAULT 0,
  nonce TEXT NOT NULL,
  ip_address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_heartbeat_company ON heartbeat_log(company_id);
CREATE INDEX idx_heartbeat_nonce ON heartbeat_log(nonce);
CREATE INDEX idx_heartbeat_created ON heartbeat_log(created_at);
