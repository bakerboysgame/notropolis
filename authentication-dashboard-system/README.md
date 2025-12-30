# Multi-Tenant SaaS Authentication Dashboard Template v2.0

A production-ready SaaS dashboard template built on Cloudflare's edge infrastructure with multi-tenant architecture, advanced role-based access control, comprehensive audit logging, and secure authentication.

## What's New in v2.0

- **Advanced Role Management** - Custom roles with page-level access control
- **Page-Level Permissions** - Control which pages each role can access
- **Company-Specific Page Configuration** - Enable/disable pages per company
- **Enhanced Audit Logging** - Dual-table system with denormalized display view
- **Authorization Middleware** - Centralized pattern-based endpoint authorization
- **Rate Limiting** - KV-based rate limiting for login and API requests
- **Security Service** - Comprehensive security utilities
- **User Permission Overrides** - Granular per-user permissions with expiration
- **Improved Email Service** - Brevo API with inline HTML templates

## Features

### Authentication
- **Password + 2FA** - Mandatory email-based 2FA for password login
- **Magic Link** - Passwordless login with 15-minute expiring links + 6-digit codes
- **TOTP Support** - Optional authenticator app setup with recovery codes
- **Session Management** - Multi-device sessions with device tracking
- **Password Reset** - Secure password reset flow

### Role-Based Access Control
- **Hierarchical Roles**: `master_admin` > `admin` > `analyst` > `viewer` > `user`
- **Custom Roles** - Companies can create their own roles
- **Page-Level Access** - Control which pages each role can see
- **Built-in Pages** - Admins always have access to user management and audit logs

### Multi-Tenancy
- **Complete Company Isolation** - Data is isolated per company
- **Company-Specific Configuration** - Pages and roles configured per company
- **Cross-Company Admin** - Master admin can manage all companies

### Audit Logging
- **Comprehensive Tracking** - All auth and admin actions logged
- **Dual-Table System** - Raw logs + denormalized display table
- **Severity Levels** - CRITICAL, ERROR, WARNING, INFO
- **HIPAA Compliance** - PHI access tracking and data classification

### Security
- **Rate Limiting** - 20 login attempts / 15 min, 100 API requests / min
- **JWT Tokens** - 24h web sessions, 90d mobile sessions
- **Security Headers** - HSTS, X-Frame-Options, CSP
- **IP Blocking** - Temporary IP blocking for abuse

## Tech Stack

### Infrastructure (All Cloudflare)
- **Cloudflare Workers** - Serverless API backend
- **Cloudflare D1** - SQLite database
- **Cloudflare KV** - Rate limiting storage
- **Cloudflare Pages** - Frontend hosting
- **Cloudflare R2** - File storage (optional)

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Vite** for build tooling
- **React Router** for navigation

### Email (Choose One)
- **Brevo API** - Free tier: 300 emails/day, good for getting started
- **Postmark API** - Better deliverability, built-in tracking, webhooks
- **Inline HTML Templates** - Same templates work with both providers

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd authentication-dashboard-system

# Install frontend dependencies
npm install

# Install worker dependencies
cd worker && npm install && cd ..
```

### 2. Create Cloudflare Resources

```bash
# Create D1 database
wrangler d1 create your-app-database

# Create KV namespace for rate limiting
wrangler kv:namespace create RATE_LIMIT_KV
wrangler kv:namespace create RATE_LIMIT_KV --preview

# (Optional) Create R2 bucket
wrangler r2 bucket create your-app-data
```

### 3. Configure wrangler.toml

Update `worker/wrangler.toml` with your resource IDs:

```toml
account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"

[[d1_databases]]
binding = "DB"
database_name = "your-app-database"
database_id = "YOUR_D1_DATABASE_ID"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "YOUR_KV_NAMESPACE_ID"
preview_id = "YOUR_KV_PREVIEW_NAMESPACE_ID"

[vars]
CLIENT_URL = "https://dashboard.your-domain.com"
SERVER_URL = "https://api.your-domain.com"
BRAND_NAME = "Your App"
SENDER_NAME = "Your App"
SENDER_EMAIL = "app@your-domain.com"
```

### 4. Set Cloudflare Secrets

```bash
cd worker

# Required secrets
wrangler secret put JWT_SECRET
wrangler secret put CORS_ORIGIN

# Email provider (choose one):
wrangler secret put BREVO_API_KEY       # If using Brevo
# OR
wrangler secret put POSTMARK_SERVER_TOKEN  # If using Postmark
```

### 5. Initialize Database

```bash
# Apply main schema
wrangler d1 execute your-app-database --file=../auth_schema.sql

# Apply migrations
wrangler d1 execute your-app-database --file=../migrations/0001_create_audit_logs_display.sql
wrangler d1 execute your-app-database --file=../migrations/0002_create_role_page_access.sql
wrangler d1 execute your-app-database --file=../migrations/0003_create_custom_roles.sql
wrangler d1 execute your-app-database --file=../migrations/0004_create_user_permissions.sql
wrangler d1 execute your-app-database --file=../migrations/0005_create_role_visibility_restrictions.sql
```

### 6. Create Master Admin

```bash
# Create your first master admin
wrangler d1 execute your-app-database --command "INSERT INTO companies (id, name, is_active) VALUES ('master-company', 'System', 1);"

wrangler d1 execute your-app-database --command "INSERT INTO users (id, email, username, password, first_name, last_name, company_id, role, is_active, verified) VALUES ('master-admin', 'admin@your-domain.com', 'admin@your-domain.com', '\$2b\$10\$hashedpassword', 'Admin', 'User', 'master-company', 'master_admin', 1, 1);"
```

### 7. Deploy

```bash
# Deploy worker
cd worker
wrangler deploy

# Deploy frontend
cd ..
npm run build
wrangler pages deploy dist --project-name=your-dashboard
```

### 8. Update Frontend Environment

Create `.env` for local development:

```bash
VITE_API_BASE_URL=http://localhost:8787
VITE_APP_NAME="Your App"
```

For production, set these in Cloudflare Pages environment variables.

## Project Structure

```
authentication-dashboard-system/
├── src/                          # Frontend React application
│   ├── components/
│   │   ├── auth/                # Auth components (LoginForm, TOTPSetup, etc.)
│   │   ├── modals/              # Modal components (AddUser, EditUser, etc.)
│   │   └── ui/                  # UI components (Button, Input, Modal)
│   ├── contexts/
│   │   ├── AuthContext.tsx      # Authentication state
│   │   ├── PermissionsContext.tsx  # Page access permissions
│   │   └── ThemeContext.tsx     # Dark mode support
│   ├── pages/
│   │   ├── AuditLogsPage.tsx    # Audit log viewer
│   │   ├── CompanyUserManagement.tsx  # Company admin panel
│   │   ├── UserManagement.tsx   # Master admin panel
│   │   ├── Settings.tsx         # User settings
│   │   └── ...
│   ├── services/api.ts          # API client
│   └── config/environment.ts    # Frontend configuration
├── worker/                       # Cloudflare Worker API
│   ├── src/
│   │   ├── middleware/
│   │   │   └── authorization.js # Centralized authorization
│   │   ├── auth.js              # Authentication logic
│   │   ├── database.js          # Database operations
│   │   ├── email.js             # Brevo email service (default)
│   │   ├── email-postmark.js    # Postmark email service (alternative)
│   │   ├── email-templates.js   # Inline HTML email templates (works with both)
│   │   ├── security.js          # Rate limiting & security
│   │   ├── jwt.js               # JWT token handling
│   │   └── analytics.js         # Email analytics
│   ├── index.js                 # Worker entry point (API routes)
│   └── wrangler.toml            # Worker configuration
├── migrations/                   # Database migrations
├── auth_schema.sql              # Main database schema
└── template_guide/              # Setup documentation
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Password login (returns 2FA requirement)
- `POST /api/auth/2fa/request` - Request 2FA code
- `POST /api/auth/2fa/verify` - Verify 2FA and get token
- `POST /api/auth/magic-link/request` - Request magic link
- `POST /api/auth/magic-link/verify` - Verify magic link token
- `POST /api/auth/magic-link/verify-code` - Verify 6-digit code
- `GET /api/auth/me` - Get current user
- `GET /api/auth/sessions` - Get user's sessions
- `DELETE /api/auth/sessions/{id}` - Terminate session

### TOTP
- `POST /api/auth/totp/setup` - Initialize TOTP
- `POST /api/auth/totp/verify-setup` - Complete TOTP setup
- `POST /api/auth/totp/disable` - Disable TOTP
- `GET /api/auth/totp/status` - Get TOTP status

### User Management (Admin)
- `GET /api/users` - List users
- `POST /api/users/invite` - Invite user
- `PATCH /api/users/{id}` - Update user
- `POST /api/users/{id}/archive` - Archive user
- `POST /api/users/{id}/restore` - Restore user
- `DELETE /api/users/{id}` - Delete user

### Role Management (Admin)
- `GET /api/company/roles` - Get company roles
- `POST /api/company/roles` - Create custom role
- `GET /api/company/roles/{role}/pages` - Get role's page access
- `PUT /api/company/roles/{role}/pages` - Set role's page access

### Permissions
- `GET /api/user/permissions` - Get current user's permissions
- `GET /api/company/available-pages` - Get pages available for company

### Company Management (Master Admin)
- `GET /api/companies` - List companies
- `POST /api/companies/create-with-admin` - Create company with admin
- `GET /api/companies/stats` - Get company statistics

### Audit Logs (Admin)
- `GET /api/audit` - Get audit logs (paginated, filterable)

## User Roles

| Role | Scope | Capabilities |
|------|-------|--------------|
| `master_admin` | All companies | Full system access, create companies, view all data |
| `admin` | Own company | Manage users, roles, view audit logs |
| `analyst` | Own company | View analytics and reports |
| `viewer` | Own company | Read-only access |
| `user` | Own company | Basic access |
| Custom roles | Own company | Configured page access |

## Customization

### Branding
1. Replace `/public/logo.png` and `/public/logo-icon.png`
2. Update `src/config/environment.ts` with your app name
3. Update `worker/wrangler.toml` with your brand name
4. Update `index.html` title and meta tags

### Colors
Edit `tailwind.config.js` and `src/config/environment.ts`:
```typescript
COLORS: {
  PRIMARY: '#0194F9',  // Your brand color
  ...
}
```

### Email Templates
Edit `worker/src/email-templates.js` to customize email HTML.

## Local Development

```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Worker (with local D1)
cd worker
wrangler dev --local --persist
```

## Documentation

See the [template_guide](./template_guide/) folder for detailed documentation:

- [Quick Start Checklist](./template_guide/QUICK-START-CHECKLIST.md)
- [Cloudflare Setup](./template_guide/02-CLOUDFLARE-SETUP.md)
- [Database Schema](./template_guide/03-DATABASE-SCHEMA.md)
- [Brevo Setup](./template_guide/04A-BREVO-SETUP.md) (Email Option A)
- [Postmark Setup](./template_guide/04B-POSTMARK-SETUP.md) (Email Option B)
- [Secrets Management](./template_guide/05-SECRETS-MANAGEMENT.md)
- [Deployment](./template_guide/06-DEPLOYMENT.md)
- [Customization](./template_guide/08-CUSTOMIZATION.md)
- [Troubleshooting](./template_guide/09_TROUBLESHOOTING_AND_KNOWN_ISSUES.md)

## License

[Your License Here]

---

**Built on Cloudflare's Edge Platform**
