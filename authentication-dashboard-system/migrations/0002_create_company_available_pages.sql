-- Migration: 0002_create_company_available_pages.sql
-- Master admin controls which pages are available to each company
-- By default (no entries), all pages are available

CREATE TABLE IF NOT EXISTS company_available_pages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    client_company_id TEXT NOT NULL,
    page_key TEXT NOT NULL,
    is_enabled INTEGER DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE(client_company_id, page_key)
);

CREATE INDEX IF NOT EXISTS idx_cap_company ON company_available_pages(client_company_id);
CREATE INDEX IF NOT EXISTS idx_cap_page ON company_available_pages(page_key);

-- Trigger to update updated_at
CREATE TRIGGER IF NOT EXISTS update_company_available_pages_updated_at
    AFTER UPDATE ON company_available_pages
    FOR EACH ROW
BEGIN
    UPDATE company_available_pages SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
