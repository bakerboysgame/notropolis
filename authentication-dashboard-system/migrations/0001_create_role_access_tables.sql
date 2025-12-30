-- Migration: 0001_create_role_access_tables.sql
-- Role-based page access control
-- Controls which pages a role can access (allowlist model)
-- If no entries exist for a role, they have full page access
-- If any entries exist, only those pages are accessible

CREATE TABLE IF NOT EXISTS role_page_access (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    client_company_id TEXT NOT NULL,
    role_name TEXT NOT NULL,           -- 'user' or custom role name (not 'admin')
    page_key TEXT NOT NULL,            -- e.g., 'dashboard', 'analytics', 'reports', 'settings'
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE(client_company_id, role_name, page_key)
);

CREATE INDEX IF NOT EXISTS idx_rpa_lookup ON role_page_access(client_company_id, role_name);
CREATE INDEX IF NOT EXISTS idx_rpa_page ON role_page_access(page_key);
