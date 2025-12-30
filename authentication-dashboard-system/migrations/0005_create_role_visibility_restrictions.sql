-- Migration: 0005_create_role_visibility_restrictions.sql
-- Restricts what data roles within a company can see
-- Roles without any restrictions see all data visible to their company
-- Uses allowlist model: if restrictions exist, only those items are accessible
-- Generic restriction_type - validation handled in application code

CREATE TABLE IF NOT EXISTS role_visibility_restrictions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    client_company_id TEXT NOT NULL,
    role_name TEXT NOT NULL,                 -- 'user', 'analyst', 'viewer', or custom role name
    restriction_type TEXT NOT NULL,          -- Application validates: 'location', 'equipment_type', 'priority', 'technician', etc.
    restriction_value TEXT NOT NULL,         -- The actual value to restrict to
    granted_by TEXT NOT NULL,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME,
    revoked_by TEXT,
    is_active INTEGER DEFAULT 1,
    notes TEXT,
    FOREIGN KEY (client_company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rvr_lookup ON role_visibility_restrictions(client_company_id, role_name, restriction_type, is_active);
CREATE INDEX IF NOT EXISTS idx_rvr_role ON role_visibility_restrictions(role_name, is_active);
