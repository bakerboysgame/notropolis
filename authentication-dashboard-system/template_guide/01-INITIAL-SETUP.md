# 01 - Initial Setup

This guide walks you through cloning the template and configuring it for your project.

## Step 1: Clone the Repository

```bash
# Clone the repository
git clone <your-repo-url> <new-project-name>
cd <new-project-name>

# Remove existing git history (optional - if you want a fresh start)
rm -rf .git
git init
git add .
git commit -m "Initial commit from template"
```

## Step 2: Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install worker dependencies
cd worker
npm install
cd ..
```

## Step 3: Update Project Configuration

### 3.1 Update `package.json`

Open `/package.json` and update:

```json
{
  "name": "your-project-name",
  "version": "1.0.0",
  "scripts": {
    "deploy": "wrangler pages deploy ./dist --project-name=your-dashboard",
    "deploy:preview": "wrangler pages deploy ./dist --project-name=your-dashboard-preview"
  }
}
```

### 3.2 Update Worker `wrangler.toml`

Open `/worker/wrangler.toml` and update the placeholders:

```toml
name = "your-app-api"
compatibility_date = "2024-09-23"
account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"  # Get from Cloudflare dashboard
main = "index.js"

# D1 Database Bindings (IDs generated in step 02)
[[d1_databases]]
binding = "DB"
database_name = "your-app-database"
database_id = "YOUR_D1_DATABASE_ID"

# KV Namespace Bindings (IDs generated in step 02)
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "YOUR_KV_NAMESPACE_ID"
preview_id = "YOUR_KV_PREVIEW_NAMESPACE_ID"

[vars]
# Basic configuration
JWT_EXPIRES_IN = "24h"
SESSION_TIMEOUT = "3600000"
BRAND_NAME = "Your App"
CLIENT_URL = "https://dashboard.your-domain.com"
SERVER_URL = "https://api.your-domain.com"

# Email sender configuration
SENDER_NAME = "Your App"
SENDER_EMAIL = "app@your-domain.com"

# Rate Limiting Configuration
RATE_LIMIT_LOGIN = "20"
RATE_LIMIT_LOGIN_WINDOW = "900"
RATE_LIMIT_API = "100"
RATE_LIMIT_API_WINDOW = "60"
SESSION_IDLE_TIMEOUT = "1800000"

[env.production]
name = "your-app-api"

[env.production.vars]
ENVIRONMENT = "production"
# Copy all vars from above for production

[env.preview]
name = "your-app-api-preview"

[env.preview.vars]
ENVIRONMENT = "preview"
```

**Note:** The `account_id`, `database_id`, and KV namespace IDs will be filled in during [02-CLOUDFLARE-SETUP.md](./02-CLOUDFLARE-SETUP.md).

### 3.3 Update Frontend Configuration

Open `/src/config/environment.ts`:

```typescript
export const config = {
  // API Configuration
  API_BASE_URL: (import.meta as any).env?.VITE_API_BASE_URL || 'https://api.your-domain.com',

  // Application Configuration
  APP_NAME: (import.meta as any).env?.VITE_APP_NAME || 'Your App',
  APP_VERSION: (import.meta as any).env?.VITE_APP_VERSION || '1.0.0',
  APP_DESCRIPTION: (import.meta as any).env?.VITE_APP_DESCRIPTION || 'Your app description',

  // Environment
  ENVIRONMENT: (import.meta as any).env?.VITE_ENVIRONMENT || 'development',

  // Feature flags
  FEATURES: {
    MAGIC_LINK: true,           // Passwordless login via email
    TWO_FACTOR: true,           // Email-based 2FA (mandatory)
    TOTP: true,                 // Optional authenticator app 2FA
    COMPANY_MANAGEMENT: true,   // Multi-tenant company management
    AUDIT_LOGGING: true,        // Comprehensive audit logging
    ROLE_MANAGEMENT: true,      // Custom role and page access
  },

  // Brand colors
  COLORS: {
    PRIMARY: '#0194F9',  // Your brand color
    WHITE: '#FFFFFF',
    GRAY: '#666666',
  }
} as const;
```

### 3.4 Update `index.html`

Open `/index.html` and update:

```html
<title>Your App Name</title>
<meta name="description" content="Your app description" />
```

## Step 4: Update Branding Files

### 4.1 Replace Logos

Replace these files in `/public/`:
- `logo.png` - Full logo (used in sidebar expanded, login page)
- `logo-icon.png` - Icon only (used in sidebar collapsed)
- `favicon.ico` - Browser favicon
- `apple-touch-icon.png` - iOS icon
- `android-chrome-*.png` - Android icons

### 4.2 Update ProtectedPageRoute (if adding pages)

If you add new pages, update `/src/components/ProtectedPageRoute.tsx`:

```typescript
const PAGE_ROUTES: Record<string, { path: string; name: string }> = {
  dashboard: { path: '/', name: 'Dashboard' },
  analytics: { path: '/analytics', name: 'Analytics' },
  reports: { path: '/reports', name: 'Reports' },
  settings: { path: '/settings', name: 'Settings' },
  user_management: { path: '/user-management', name: 'User Management' },
  company_users: { path: '/company-users', name: 'Company Users' },
  audit_logs: { path: '/audit-logs', name: 'Audit Logs' },
  // Add your custom pages here
};
```

**Important:** The magic link flow requires two components working together:

**ProtectedPageRoute.tsx** - Allows token through before auth redirect:
```typescript
// Check for magic link token in URL - allow through so Dashboard can process it
const tokenFromUrl = searchParams.get('token');
if (tokenFromUrl) {
  return <>{children}</>;  // Let Dashboard process the token
}
```

**DashboardPage.tsx** - Processes the token:
```typescript
useEffect(() => {
  const token = searchParams.get('token');
  if (token && !processingToken) {
    setProcessingToken(true);
    apiHelpers.clearToken();  // Clear existing auth first
    apiHelpers.setToken(token);
    refreshUser().then(() => {
      setSearchParams({}, { replace: true });  // Use React Router
      setProcessingToken(false);
    });
  }
}, [searchParams, setSearchParams, navigate, refreshUser, processingToken]);
```

**Flow:**
1. User clicks magic link → API returns 302 redirect to Dashboard with `?token=JWT`
2. ProtectedPageRoute detects the token and allows the request through
3. Dashboard extracts token, stores it, refreshes user, clears URL

## Step 5: Create Local Development Environment

### 5.1 Create `.env` for Frontend

Create `/.env`:

```env
VITE_API_BASE_URL=http://localhost:8787
VITE_APP_NAME=Your App (Dev)
VITE_APP_VERSION=1.0.0
VITE_ENVIRONMENT=development
```

### 5.2 Create `.dev.vars` for Worker (Local Secrets)

Create `/worker/.dev.vars`:

```env
JWT_SECRET=your-local-jwt-secret-for-development-only
BREVO_API_KEY=your-brevo-api-key
CORS_ORIGIN=http://localhost:5173
```

**Note:** `.dev.vars` is used by `wrangler dev` for local development. Production secrets are set via `wrangler secret put`.

## Step 6: Verify Configuration

Run this checklist:

- [ ] `package.json` name and deploy scripts updated
- [ ] `/worker/wrangler.toml` vars updated (CLIENT_URL, SERVER_URL, BRAND_NAME, SENDER_*)
- [ ] `/src/config/environment.ts` updated
- [ ] `/index.html` title and description updated
- [ ] Logo files replaced in `/public/`
- [ ] Dependencies installed (npm install in both root and worker)
- [ ] `.env` created for frontend
- [ ] `.dev.vars` created for worker

## Step 7: Test Local Build

```bash
# Build frontend
npm run build

# Should complete without errors
```

## Next Steps

Continue to [02-CLOUDFLARE-SETUP.md](./02-CLOUDFLARE-SETUP.md) to create Cloudflare resources (D1 database, KV namespace).

---

## Troubleshooting

### Build fails with TypeScript errors

Run `npm run build` and check the error output. Common issues:
- Missing imports after renaming
- Type mismatches in configuration

### Dependencies fail to install

```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm install

cd worker
rm -rf node_modules package-lock.json
npm install
```

### Wrangler not found

```bash
npm install -g wrangler
wrangler login
```
