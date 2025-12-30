# Database Schema Reference

## Overview

This document provides a complete reference for the D1 database schema used in this application.

## Schema Files

The database schema is split across multiple files:

**Main Schema Files:**
1. **`auth_schema.sql`** - Primary schema (authentication, users, companies, audit logs)
2. **`analytics_schema.sql`** - Email analytics tracking

**Migrations (apply in order):**
3. **`migrations/0001_create_role_access_tables.sql`** - role_page_access table
4. **`migrations/0002_create_company_available_pages.sql`** - company_available_pages table
5. **`migrations/0003_create_custom_roles.sql`** - custom_roles table
6. **`migrations/0004_create_user_permissions.sql`** - Extended user_permissions
7. **`migrations/0005_create_role_visibility_restrictions.sql`** - role_visibility_restrictions table
8. **`migrations/0006_fix_custom_roles_trigger.sql`** - Trigger fixes
9. **`migrations/0007_fix_user_permissions.sql`** - User permissions fixes
10. **`migrations/0008_fix_role_visibility_restrictions.sql`** - Visibility restrictions fixes

**Note:** The role management tables (9-13) use `client_company_id` instead of `company_id` for clarity in multi-tenant contexts.

## Complete Table Structure

### Core Tables

#### 1. companies

Multi-tenant company structure for isolating data.

```sql
CREATE TABLE companies (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    domain TEXT UNIQUE,
    admin_user_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_retention_days INTEGER DEFAULT 2555,
    hipaa_compliant INTEGER DEFAULT 1,
    FOREIGN KEY (admin_user_id) REFERENCES users(id)
);
```

**Purpose**: Stores company/organization information
**Key Points**:
- One company can have many users
- Each company has an admin user
- System company (id='system') used for internal operations
- HIPAA compliant by default (7 year retention)

**Indexes**:
- `idx_companies_admin_user_id` on `admin_user_id`
- `idx_companies_domain` on `domain`

#### 2. users

User accounts with authentication and authorization.

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    company_id TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('master_admin', 'admin', 'analyst', 'viewer', 'user')),
    is_active INTEGER DEFAULT 1,
    verified INTEGER DEFAULT 0,
    two_factor_enabled INTEGER DEFAULT 0,
    two_factor_secret TEXT,
    two_factor_recovery_codes TEXT,
    magic_link_enabled INTEGER DEFAULT 0,
    magic_link_token TEXT,
    magic_link_code TEXT,              -- 6-digit code for mobile app
    magic_link_expires DATETIME,
    phi_access_level TEXT DEFAULT 'none' CHECK (phi_access_level IN ('none', 'limited', 'full')),
    data_classification TEXT DEFAULT 'public' CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')),
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

**Purpose**: Stores user authentication and profile data
**Key Points**:
- Email and username must be unique
- Password stored as bcrypt hash
- Soft delete via `deleted_at` field
- Supports 2FA and magic link authentication
- HIPAA compliance via PHI access levels

**Indexes**:
- `idx_users_email` on `email`
- `idx_users_username` on `username`
- `idx_users_company_id` on `company_id`
- `idx_users_magic_link_token` on `magic_link_token`

#### 3. sessions

JWT token management and session tracking.

```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    is_mobile INTEGER DEFAULT 0,
    user_agent TEXT,
    ip_address TEXT,
    browser TEXT,
    os TEXT,
    device_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Purpose**: Tracks active user sessions with device information
**Key Points**:
- Each login creates a new session
- Sessions automatically expire
- Token is the JWT token hash
- Tracks mobile vs desktop sessions
- Stores device fingerprint (browser, OS, device name)
- IP address for security auditing

**Indexes**:
- `idx_sessions_token` on `token`
- `idx_sessions_user_id` on `user_id`

#### 4. audit_logs

Comprehensive security and compliance logging.

```sql
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT,
    company_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details TEXT,                       -- JSON stored as TEXT
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    phi_accessed INTEGER DEFAULT 0,
    data_classification TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    related_company_id TEXT,            -- For cross-company actions
    related_user_id TEXT,               -- For user-related actions
    changed_fields TEXT,                -- JSON array of field names
    old_values TEXT,                    -- JSON of previous values
    new_values TEXT,                    -- JSON of new values
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

**Purpose**: Audit trail for security and compliance
**Key Points**:
- Logs all user actions
- HIPAA compliance tracking (PHI access)
- Stores IP address and user agent
- JSON details field for additional context
- Tracks before/after values for changes
- Related company/user IDs for cross-reference

**Indexes**:
- `idx_audit_logs_user_id` on `user_id`
- `idx_audit_logs_company_id` on `company_id`
- `idx_audit_logs_created_at` on `created_at`
- `idx_audit_logs_action` on `action`

#### 5. user_permissions

Granular resource-based access control.

```sql
CREATE TABLE user_permissions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    permission TEXT NOT NULL,
    resource TEXT,
    granted_by TEXT,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (granted_by) REFERENCES users(id)
);
```

**Purpose**: Fine-grained permission management
**Key Points**:
- Permissions can be resource-specific
- Time-limited permissions via `expires_at`
- Tracks who granted the permission
- Can be enabled/disabled

**Indexes**:
- `idx_user_permissions_user_id` on `user_id`
- `idx_user_permissions_company_id` on `company_id`

#### 6. data_retention_policies

HIPAA-compliant data retention configuration.

```sql
CREATE TABLE data_retention_policies (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    company_id TEXT NOT NULL,
    data_type TEXT NOT NULL,
    retention_days INTEGER NOT NULL,
    auto_delete INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

**Purpose**: Configure data retention per company
**Key Points**:
- Different retention periods for different data types
- Optional automatic deletion
- HIPAA default: 7 years (2555 days)

#### 7. user_preferences

User-specific settings and preferences.

```sql
CREATE TABLE user_preferences (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    preference_key TEXT NOT NULL,
    preference_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, preference_key)
);
```

**Purpose**: Store user settings
**Key Points**:
- Key-value store
- One key per user (UNIQUE constraint)
- Can store JSON in preference_value

**Indexes**:
- `idx_user_preferences_user_id` on `user_id`

#### 8. company_data_views

Company-specific data view definitions.

```sql
CREATE TABLE company_data_views (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    company_id TEXT NOT NULL,
    view_name TEXT NOT NULL,
    view_definition TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

**Purpose**: Define custom data views per company
**Key Points**:
- Stores SQL query definitions
- Can be enabled/disabled
- Used for integrations (e.g., ClickHouse)

### Role Management Tables

#### 9. role_page_access

Controls which pages each role can access (allowlist model).

```sql
CREATE TABLE role_page_access (
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
```

**Purpose**: Role-based page access control
**Key Points**:
- Uses **allowlist model**: if no entries exist for a role, they have full page access
- If any entries exist, only those pages are accessible
- Per-company role configuration
- Links roles to page keys
- Used by PermissionsContext on frontend

**Indexes**:
- `idx_rpa_lookup` on `(client_company_id, role_name)`
- `idx_rpa_page` on `page_key`

#### 10. company_available_pages

Master admin controls which pages are available to each company.

```sql
CREATE TABLE company_available_pages (
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
```

**Purpose**: Company-level page availability
**Key Points**:
- By default (no entries), all pages are available
- Master admin can enable/disable pages per company
- Company admins can only assign pages that are available

**Indexes**:
- `idx_cap_company` on `client_company_id`
- `idx_cap_page` on `page_key`

#### 11. custom_roles

Company admins can create custom roles.

```sql
CREATE TABLE custom_roles (
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
```

**Purpose**: Custom role definitions per company
**Key Points**:
- Extends the built-in roles (admin, analyst, viewer, user)
- Can have custom display names and descriptions
- Base permissions as JSON array
- Page access configured via role_page_access table

**Indexes**:
- `idx_cr_company` on `(client_company_id, is_active)`

#### 12. audit_logs_display

Denormalized audit logs for fast UI queries.

```sql
CREATE TABLE audit_logs_display (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    original_log_id TEXT NOT NULL,
    timestamp DATETIME,
    action_type TEXT,
    severity_level TEXT DEFAULT 'INFO',  -- CRITICAL, ERROR, WARNING, INFO
    user_email TEXT,
    user_name TEXT,
    user_id TEXT,
    company_name TEXT,
    company_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    action_description TEXT,             -- Human-readable description
    resource_type TEXT,
    resource_identifier TEXT,
    details_summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (original_log_id) REFERENCES audit_logs(id)
);
```

**Purpose**: Pre-joined audit log data for fast queries
**Key Points**:
- Contains user email/name and company name
- Avoids joins when displaying audit logs
- Human-readable action descriptions
- Severity levels for filtering
- Synced from audit_logs table via triggers or application code

**Indexes**:
- `idx_audit_display_company_id` on `(company_id, created_at DESC)`
- `idx_audit_display_user_id` on `(user_id, created_at DESC)`
- `idx_audit_display_action` on `action_type`
- `idx_audit_display_severity` on `severity_level`
- `idx_audit_display_timestamp` on `timestamp DESC`

#### 13. role_visibility_restrictions

Restricts what data roles within a company can see.

```sql
CREATE TABLE role_visibility_restrictions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    client_company_id TEXT NOT NULL,
    role_name TEXT NOT NULL,             -- 'user', 'analyst', 'viewer', or custom role name
    restriction_type TEXT NOT NULL,      -- 'location', 'equipment_type', 'priority', 'technician', etc.
    restriction_value TEXT NOT NULL,     -- The actual value to restrict to
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
```

**Purpose**: Restrict which data a role can see/access
**Key Points**:
- Uses **allowlist model**: if restrictions exist, only those items are accessible
- Roles without any restrictions see all data visible to their company
- Generic restriction_type - validation handled in application code
- Tracks who granted and revoked restrictions

**Indexes**:
- `idx_rvr_lookup` on `(client_company_id, role_name, restriction_type, is_active)`
- `idx_rvr_role` on `(role_name, is_active)`

### Analytics Tables

#### 14. company_analytics

Company-level email analytics aggregation.

```sql
CREATE TABLE company_analytics (
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
    analytics_data TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

**Purpose**: Aggregate email metrics per company
**Key Points**:
- Time-series data (period_start/period_end)
- Pre-calculated rates for performance
- Additional data stored as JSON

**Indexes**:
- `idx_company_analytics_company_id` on `company_id`
- `idx_company_analytics_period` on `(period_start, period_end)`

#### 15. email_events

Individual email event tracking.

```sql
CREATE TABLE email_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

**Purpose**: Track individual email events
**Key Points**:
- Event types: sent, delivered, opened, clicked, bounced, failed
- Event data stored as JSON
- High-volume table

**Indexes**:
- `idx_email_events_company_id` on `company_id`
- `idx_email_events_user_email` on `user_email`
- `idx_email_events_created_at` on `created_at`

#### 16. template_performance

Email template performance metrics.

```sql
CREATE TABLE template_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    template_name TEXT NOT NULL,
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
```

**Purpose**: Track performance of email templates
**Key Points**:
- Metrics per template per company
- Time-series data
- Pre-calculated rates

**Indexes**:
- `idx_template_performance_company_id` on `company_id`
- `idx_template_performance_template_id` on `template_id`

#### 17. user_email_activity

Per-user email engagement summary.

```sql
CREATE TABLE user_email_activity (
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
    engagement_score REAL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    UNIQUE(company_id, user_email)
);
```

**Purpose**: User-level email engagement tracking
**Key Points**:
- Aggregate metrics per user email
- Engagement score for targeting
- Last activity timestamps

**Indexes**:
- `idx_user_email_activity_company_id` on `company_id`
- `idx_user_email_activity_user_email` on `user_email`

## Common Queries

### User Management

```sql
-- Get all users with company info
SELECT 
    u.id, 
    u.email, 
    u.username, 
    u.role, 
    u.is_active,
    c.name as company_name
FROM users u
JOIN companies c ON u.company_id = c.id
WHERE u.deleted_at IS NULL;

-- Get user by email
SELECT * FROM users WHERE email = ? AND deleted_at IS NULL;

-- Soft delete user
UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?;
```

### Authentication

```sql
-- Create session
INSERT INTO sessions (user_id, token, expires_at, is_mobile)
VALUES (?, ?, datetime('now', '+24 hours'), ?);

-- Validate session
SELECT s.*, u.* 
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.token = ? AND s.expires_at > datetime('now');

-- Clean expired sessions
DELETE FROM sessions WHERE expires_at < datetime('now');
```

### Audit Logging

```sql
-- Log action
INSERT INTO audit_logs (
    user_id, company_id, action, resource_type, 
    resource_id, details, ip_address, user_agent
) VALUES (?, ?, ?, ?, ?, ?, ?, ?);

-- Get recent logs for user
SELECT * FROM audit_logs 
WHERE user_id = ? 
ORDER BY created_at DESC 
LIMIT 100;

-- Get company audit trail
SELECT 
    al.*,
    u.email as user_email
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.company_id = ?
ORDER BY al.created_at DESC;
```

### Analytics

```sql
-- Get company email stats
SELECT * FROM company_analytics
WHERE company_id = ?
ORDER BY period_start DESC
LIMIT 30;

-- Get email events for user
SELECT * FROM email_events
WHERE user_email = ?
ORDER BY created_at DESC
LIMIT 100;
```

## Maintenance Queries

### Clean Up Expired Data

```sql
-- Delete expired sessions
DELETE FROM sessions WHERE expires_at < datetime('now');

-- Delete old audit logs (older than retention period)
DELETE FROM audit_logs 
WHERE created_at < datetime('now', '-2555 days');

-- Delete old email events (older than 90 days)
DELETE FROM email_events
WHERE created_at < datetime('now', '-90 days');
```

### Database Statistics

```sql
-- Count records in each table
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'companies', COUNT(*) FROM companies
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs;

-- Active sessions count
SELECT COUNT(*) as active_sessions
FROM sessions
WHERE expires_at > datetime('now');

-- Users per company
SELECT 
    c.name as company,
    COUNT(u.id) as user_count
FROM companies c
LEFT JOIN users u ON c.id = u.company_id AND u.deleted_at IS NULL
GROUP BY c.id, c.name;
```

## Backup Commands

```bash
# Export entire database
wrangler d1 export your_database_name --output=backup.sql

# Export specific table
wrangler d1 execute your_database_name \
  --command="SELECT * FROM users" \
  --output=users_backup.json

# Restore from backup
wrangler d1 execute your_database_name --file=backup.sql
```

## Migration Best Practices

### Adding a Column

```sql
ALTER TABLE users ADD COLUMN new_field TEXT;
```

### Adding an Index

```sql
CREATE INDEX idx_new_field ON users(new_field);
```

### Modifying Data

```sql
-- Always use transactions for data modifications
BEGIN TRANSACTION;
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
COMMIT;
```

## Schema Version History

Keep track of schema changes:

- **v1.0** (Initial): Basic auth schema
- **v1.1**: Added analytics tables
- **v1.2**: Added 2FA fields
- **v1.3**: Added soft delete for users

## Next Steps

- See [03-DATABASE-SCHEMA.md](./03-DATABASE-SCHEMA.md) for setup instructions
- See worker code in `/worker/src/database.js` for query implementations

