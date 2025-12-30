-- Migration: 0006_fix_custom_roles_trigger.sql
-- Add missing updated_at trigger to custom_roles table

CREATE TRIGGER IF NOT EXISTS update_custom_roles_updated_at
    AFTER UPDATE ON custom_roles
    FOR EACH ROW
BEGIN
    UPDATE custom_roles SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
