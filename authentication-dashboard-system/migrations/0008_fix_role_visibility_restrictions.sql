-- Migration: 0008_fix_role_visibility_restrictions.sql
-- Recreate role_visibility_restrictions without CHECK constraint (generic/flexible)

-- Drop existing table and indexes (table is empty)
DROP INDEX IF EXISTS idx_rvr_lookup;
DROP INDEX IF EXISTS idx_rvr_role;
DROP TABLE IF EXISTS role_visibility_restrictions;

-- Recreate without CHECK constraint - validation will be in application code
-- This allows future flexibility as your entities evolve
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

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_rvr_lookup ON role_visibility_restrictions(client_company_id, role_name, restriction_type, is_active);
CREATE INDEX IF NOT EXISTS idx_rvr_role ON role_visibility_restrictions(role_name, is_active);
