-- Migration: 0003_create_custom_roles.sql
-- Custom roles created by company admins

CREATE TABLE IF NOT EXISTS custom_roles (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    client_company_id TEXT NOT NULL,
    role_name TEXT NOT NULL,
    display_name TEXT,                       -- Human-friendly name
    description TEXT,
    base_permissions TEXT DEFAULT '["read"]', -- JSON array of base permissions
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (client_company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE(client_company_id, role_name)
);

CREATE INDEX IF NOT EXISTS idx_cr_company ON custom_roles(client_company_id, is_active);

-- Trigger to update updated_at
CREATE TRIGGER IF NOT EXISTS update_custom_roles_updated_at
    AFTER UPDATE ON custom_roles
    FOR EACH ROW
BEGIN
    UPDATE custom_roles SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
