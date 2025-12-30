-- Migration: 0004_create_user_permissions.sql
-- Per-user granular permissions with optional expiration

CREATE TABLE IF NOT EXISTS user_permissions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    permission TEXT NOT NULL,        -- e.g., 'view_repairs', 'export_data', 'manage_equipment'
    resource TEXT,                   -- Optional: specific resource identifier
    granted_by TEXT,                 -- Who granted this permission
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,             -- Optional expiration
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_up_user ON user_permissions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_up_company ON user_permissions(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_up_permission ON user_permissions(permission, is_active);
