# 03 - Database Schema Setup

## Overview

This project uses three main schema files:
1. `auth_schema.sql` - Core authentication and user management
2. `analytics_schema.sql` - Email analytics tracking (Brevo integration)
3. `schema.sql` - Simplified schema (legacy, can be ignored)

## Step 1: Review Schema Files

All schema files are in the root directory:
- `/auth_schema.sql` - **PRIMARY SCHEMA** (use this one)
- `/analytics_schema.sql` - Email analytics tables
- `/schema.sql` - Legacy/simplified schema

## Step 2: Initialize Core Authentication Schema

```bash
cd worker

# Execute the auth schema
wrangler d1 execute your_project_database --file=../auth_schema.sql
```

**What this creates:**
- `companies` - Multi-tenant company structure
- `users` - User accounts with authentication
- `sessions` - JWT token management
- `audit_logs` - Security and compliance logging
- `user_permissions` - Granular access control
- `data_retention_policies` - HIPAA compliance
- `user_preferences` - User settings
- `company_data_views` - Company-specific data views

## Step 3: Initialize Analytics Schema

```bash
# Execute the analytics schema
wrangler d1 execute your_project_database --file=../analytics_schema.sql
```

**What this creates:**
- `company_analytics` - Company-level email analytics
- `email_events` - Individual email event tracking
- `template_performance` - Email template metrics
- `user_email_activity` - Per-user email engagement

## Step 4: Verify Database Schema

```bash
# List all tables
wrangler d1 execute your_project_database --command="SELECT name FROM sqlite_master WHERE type='table';"
```

**Expected output:**
```
┌─────────────────────────────┐
│ name                        │
├─────────────────────────────┤
│ companies                   │
│ users                       │
│ sessions                    │
│ audit_logs                  │
│ user_permissions            │
│ data_retention_policies     │
│ user_preferences            │
│ company_data_views          │
│ company_analytics           │
│ email_events                │
│ template_performance        │
│ user_email_activity         │
└─────────────────────────────┘
```

## Step 5: Create System Company (Required)

The system needs a default "System" company for internal operations:

```bash
wrangler d1 execute your_project_database --command="
INSERT INTO companies (id, name, domain, is_active, hipaa_compliant)
VALUES ('system', 'System', NULL, 1, 1);
"
```

## Step 6: Create Your First Company

```bash
wrangler d1 execute your_project_database --command="
INSERT INTO companies (name, domain, is_active, hipaa_compliant)
VALUES ('Your Company Name', 'your-domain.com', 1, 1);
"
```

## Step 7: Get Your Company ID

```bash
wrangler d1 execute your_project_database --command="
SELECT id, name FROM companies WHERE name = 'Your Company Name';
"
```

**Copy the `id`** - you'll need it for creating users.

## Step 8: Create First Admin User

Replace `YOUR_COMPANY_ID` with the ID from Step 7:

```bash
wrangler d1 execute your_project_database --command="
INSERT INTO users (
  email, 
  username, 
  password, 
  first_name, 
  last_name, 
  company_id, 
  role, 
  is_active, 
  verified, 
  phi_access_level
) VALUES (
  'admin@your-domain.com',
  'admin',
  '\$2a\$10\$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Admin',
  'User',
  'YOUR_COMPANY_ID',
  'master_admin',
  1,
  1,
  'full'
);
"
```

**Default Password**: `admin123`

**⚠️ IMPORTANT**: Change this password immediately after first login!

## Step 9: Verify User Creation

```bash
wrangler d1 execute your_project_database --command="
SELECT 
  u.id, 
  u.email, 
  u.username, 
  u.role, 
  c.name as company_name
FROM users u
JOIN companies c ON u.company_id = c.id;
"
```

## Step 10: Update Company Admin Reference

Get the user ID from Step 9, then update the company:

```bash
wrangler d1 execute your_project_database --command="
UPDATE companies 
SET admin_user_id = 'USER_ID_HERE'
WHERE id = 'YOUR_COMPANY_ID';
"
```

## Database Schema Details

### Key Tables

#### companies
- Multi-tenant company structure
- Each company is isolated
- Stores data retention and compliance settings

#### users
- User authentication and profile
- Linked to a company
- Roles: `master_admin`, `admin`, `analyst`, `viewer`, `user`
- PHI access levels for HIPAA compliance
- Supports 2FA and magic link authentication

#### sessions
- JWT token management
- Automatic expiration
- Tracks mobile vs desktop sessions

#### audit_logs
- Comprehensive security logging
- Tracks all user actions
- HIPAA compliance tracking
- Includes IP address and user agent

#### user_permissions
- Granular resource-based permissions
- Can grant/revoke specific permissions
- Time-limited permissions support

### Indexes

All tables have appropriate indexes for performance:
- Email lookups (users)
- Session validation (sessions)
- Audit log queries (audit_logs)
- Permission checks (user_permissions)

## Database Management Commands

### View all companies
```bash
wrangler d1 execute your_project_database --command="SELECT * FROM companies;"
```

### View all users
```bash
wrangler d1 execute your_project_database --command="
SELECT u.id, u.email, u.role, c.name as company 
FROM users u 
JOIN companies c ON u.company_id = c.id;
"
```

### View recent audit logs
```bash
wrangler d1 execute your_project_database --command="
SELECT * FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 10;
"
```

### Count active sessions
```bash
wrangler d1 execute your_project_database --command="
SELECT COUNT(*) as active_sessions 
FROM sessions 
WHERE expires_at > datetime('now');
"
```

### Clean expired sessions
```bash
wrangler d1 execute your_project_database --command="
DELETE FROM sessions 
WHERE expires_at < datetime('now');
"
```

## Verification Checklist

- [ ] Auth schema executed successfully
- [ ] Analytics schema executed successfully
- [ ] All tables created (12 total)
- [ ] System company created
- [ ] First company created
- [ ] Company ID obtained
- [ ] First admin user created
- [ ] User verified in database
- [ ] Company admin reference updated

## Troubleshooting

### Issue: "Table already exists"
**Solution**: This is normal if you're re-running the schema. Use `DROP TABLE IF EXISTS table_name;` first if you need a fresh start.

### Issue: "Foreign key constraint failed"
**Solution**: Make sure you created the `companies` table before creating `users`.

### Issue: "Cannot insert user"
**Solution**: 
- Verify the company_id exists
- Check that email/username are unique
- Ensure password hash is properly escaped

### Issue: "Password not working"
**Solution**: The default password is `admin123`. If you changed it, you'll need to generate a new bcrypt hash.

## Security Notes

1. **Default Password**: Change `admin123` immediately after first login
2. **Password Hashing**: Passwords use bcrypt with 10 rounds
3. **JWT Tokens**: Stored in `sessions` table with expiration
4. **Audit Logging**: All authentication actions are logged
5. **HIPAA Compliance**: PHI access levels control sensitive data access

## Next Steps

Continue to [04-BREVO-SETUP.md](./04-BREVO-SETUP.md) to configure email services.

