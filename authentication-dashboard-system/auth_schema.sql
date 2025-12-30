-- Multi-Tenant SaaS Authentication Schema
-- Includes company structure, HIPAA compliance, and comprehensive audit logging

-- 1. Companies Table
CREATE TABLE companies (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    domain TEXT UNIQUE, -- Optional: company domain for auto-assignment
    admin_user_id TEXT, -- References users.id (can be reassigned)
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_retention_days INTEGER DEFAULT 2555, -- 7 years default
    hipaa_compliant INTEGER DEFAULT 1,
    FOREIGN KEY (admin_user_id) REFERENCES users(id)
);

-- 2. Enhanced Users Table
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    company_id TEXT NOT NULL, -- Links to companies
    role TEXT DEFAULT 'user' CHECK (role IN ('master_admin', 'admin', 'analyst', 'viewer', 'user')),
    is_active INTEGER DEFAULT 1,
    verified INTEGER DEFAULT 0,
    two_factor_enabled INTEGER DEFAULT 0,
    two_factor_secret TEXT,
    two_factor_recovery_codes TEXT,
    magic_link_enabled INTEGER DEFAULT 0,
    magic_link_token TEXT,
    magic_link_code TEXT,
    magic_link_expires DATETIME,
    -- HIPAA Compliance Fields
    phi_access_level TEXT DEFAULT 'none' CHECK (phi_access_level IN ('none', 'limited', 'full')),
    data_classification TEXT DEFAULT 'public' CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')),
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- 3. Sessions Table for JWT token management
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

-- 4. Enhanced Audit Logs Table
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT,
    company_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details TEXT, -- JSON stored as TEXT
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    -- HIPAA Compliance
    phi_accessed INTEGER DEFAULT 0,
    data_classification TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- Additional tracking fields (added 2024-12-15)
    related_company_id TEXT,
    related_user_id TEXT,
    changed_fields TEXT, -- JSON array of field names
    old_values TEXT, -- JSON of previous values
    new_values TEXT, -- JSON of new values
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- 4b. Audit Logs Display Table (Denormalized for fast UI queries)
CREATE TABLE audit_logs_display (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    original_log_id TEXT NOT NULL,
    timestamp DATETIME,
    action_type TEXT,
    severity_level TEXT DEFAULT 'INFO', -- CRITICAL, ERROR, WARNING, INFO
    user_email TEXT,
    user_name TEXT,
    user_id TEXT,
    company_name TEXT,
    company_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    action_description TEXT, -- Human-readable description
    resource_type TEXT,
    resource_identifier TEXT,
    details_summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (original_log_id) REFERENCES audit_logs(id)
);

-- 5. User Permissions Table (Resource-specific)
CREATE TABLE user_permissions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    permission TEXT NOT NULL, -- Resource-specific: 'view_sales_data', 'export_reports', 'manage_users'
    resource TEXT, -- Specific resource: 'sales_data', 'reports', 'users'
    granted_by TEXT, -- Who granted this permission
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (granted_by) REFERENCES users(id)
);

-- 6. Data Retention Policies Table
CREATE TABLE data_retention_policies (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    company_id TEXT NOT NULL,
    data_type TEXT NOT NULL, -- 'audit_logs', 'user_sessions', 'sales_data'
    retention_days INTEGER NOT NULL,
    auto_delete INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- 7. User Preferences Table
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

-- 8. Company Data Views Table (for ClickHouse integration)
CREATE TABLE company_data_views (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    company_id TEXT NOT NULL,
    view_name TEXT NOT NULL,
    view_definition TEXT NOT NULL, -- SQL query for the view
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Performance Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_magic_link_token ON users(magic_link_token);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
-- Indexes for audit_logs_display (added 2024-12-15)
CREATE INDEX idx_audit_display_company_id ON audit_logs_display(company_id, created_at DESC);
CREATE INDEX idx_audit_display_user_id ON audit_logs_display(user_id, created_at DESC);
CREATE INDEX idx_audit_display_action ON audit_logs_display(action_type);
CREATE INDEX idx_audit_display_severity ON audit_logs_display(severity_level);
CREATE INDEX idx_audit_display_timestamp ON audit_logs_display(timestamp DESC);
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_company_id ON user_permissions(company_id);
CREATE INDEX idx_companies_admin_user_id ON companies(admin_user_id);
CREATE INDEX idx_companies_domain ON companies(domain);