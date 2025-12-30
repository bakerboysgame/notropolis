-- Analytics Tables for Brevo Email Tracking
-- Company-specific email analytics and event tracking

-- Company Analytics Summary Table
CREATE TABLE IF NOT EXISTS company_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    total_events INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    emails_delivered INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    emails_bounced INTEGER DEFAULT 0,
    emails_failed INTEGER DEFAULT 0,
    delivery_rate REAL DEFAULT 0,
    open_rate REAL DEFAULT 0,
    click_rate REAL DEFAULT 0,
    bounce_rate REAL DEFAULT 0,
    analytics_data TEXT, -- JSON data from Brevo
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Individual Email Events Tracking
CREATE TABLE IF NOT EXISTS email_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'
    event_data TEXT, -- JSON data with additional event details
    created_at TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Email Template Performance by Company
CREATE TABLE IF NOT EXISTS template_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    template_id TEXT NOT NULL, -- Brevo template ID (181, 182, 183)
    template_name TEXT NOT NULL, -- 'magic_link', 'verification', 'password_reset'
    emails_sent INTEGER DEFAULT 0,
    emails_delivered INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    delivery_rate REAL DEFAULT 0,
    open_rate REAL DEFAULT 0,
    click_rate REAL DEFAULT 0,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- User Email Activity Summary
CREATE TABLE IF NOT EXISTS user_email_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    total_emails_sent INTEGER DEFAULT 0,
    total_emails_delivered INTEGER DEFAULT 0,
    total_emails_opened INTEGER DEFAULT 0,
    total_emails_clicked INTEGER DEFAULT 0,
    last_email_sent TEXT,
    last_email_opened TEXT,
    last_email_clicked TEXT,
    engagement_score REAL DEFAULT 0, -- Calculated engagement score
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    UNIQUE(company_id, user_email)
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_company_analytics_company_id ON company_analytics(company_id);
CREATE INDEX IF NOT EXISTS idx_company_analytics_period ON company_analytics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_email_events_company_id ON email_events(company_id);
CREATE INDEX IF NOT EXISTS idx_email_events_user_email ON email_events(user_email);
CREATE INDEX IF NOT EXISTS idx_email_events_created_at ON email_events(created_at);
CREATE INDEX IF NOT EXISTS idx_template_performance_company_id ON template_performance(company_id);
CREATE INDEX IF NOT EXISTS idx_template_performance_template_id ON template_performance(template_id);
CREATE INDEX IF NOT EXISTS idx_user_email_activity_company_id ON user_email_activity(company_id);
CREATE INDEX IF NOT EXISTS idx_user_email_activity_user_email ON user_email_activity(user_email);
