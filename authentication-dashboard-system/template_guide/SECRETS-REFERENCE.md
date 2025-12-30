# Secrets Reference Sheet

## Overview

This document lists all secrets and environment variables needed for the application.

## Cloudflare Worker Secrets

These must be set via `wrangler secret put SECRET_NAME` or in the Cloudflare Dashboard.

### Required Secrets

| Secret Name | Purpose | Example/Format | How to Generate |
|------------|---------|----------------|-----------------|
| `JWT_SECRET` | Signs JWT authentication tokens | `xK7m9P4vWq2Hn8Zt5Rg1Yb3Lc6Jd0Fa7Xe9Nv2Mu4Sw8=` | `openssl rand -base64 32` |
| `BREVO_API_KEY` | Brevo email service API key | `xkeysib-abc123...` | Brevo Dashboard → API Keys |

### Optional Secrets

| Secret Name | Purpose | Example/Format | When Needed |
|------------|---------|----------------|-------------|
| `BREVO_WEBHOOK_SECRET` | Webhook signature verification | Random string | Only if using Brevo webhooks |

**Note**: This template uses **inline HTML email templates**. No Brevo template IDs are needed as secrets.

## Environment Variables (Non-Secret)

These are configured in `/worker/wrangler.toml` and are NOT encrypted.

### Application Configuration

```toml
[vars]
# JWT Configuration
JWT_EXPIRES_IN = "24h"              # Token expiration: "1h", "24h", "7d", "30d"
SESSION_TIMEOUT = "3600000"         # Session timeout in ms (1 hour)

# Branding
BRAND_NAME = "Your Brand Name"      # Displayed in emails and UI

# URLs
CLIENT_URL = "https://dashboard.your-domain.com"  # Frontend URL
SERVER_URL = "https://api.your-domain.com"        # API URL

# Security & Rate Limiting
RATE_LIMIT_LOGIN = "20"             # Max login attempts
RATE_LIMIT_LOGIN_WINDOW = "900"    # Time window in seconds (15 min)
RATE_LIMIT_API = "100"              # Max API requests
RATE_LIMIT_API_WINDOW = "60"       # Time window in seconds (1 min)
SESSION_IDLE_TIMEOUT = "1800000"   # Idle timeout in ms (30 min)

# Webhook (Optional)
BREVO_WEBHOOK_SECRET = "your-webhook-secret-here"  # Can also be a secret
```

### Cloudflare Bindings

These are configured in `/worker/wrangler.toml`:

```toml
# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "your_database_name"
database_id = "abc123-def456-ghi789"

# KV Namespace (Rate Limiting)
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "production-kv-id"
preview_id = "preview-kv-id"
```

## Frontend Environment Variables

These are used in the frontend and can be set in `.env.local` for development.

### Development Only (.env.local)

```env
VITE_API_BASE_URL=http://localhost:8787
VITE_APP_NAME=Your App Name
VITE_APP_VERSION=1.0.0
VITE_ENVIRONMENT=development
```

### Production

Production values are set in `/src/config/environment.ts` with fallbacks:

```typescript
API_BASE_URL: (import.meta as any).env?.VITE_API_BASE_URL || 'https://api.your-domain.com',
APP_NAME: (import.meta as any).env?.VITE_APP_NAME || 'Your Application Name',
```

## Setting Secrets

### Via Wrangler CLI

```bash
cd worker

# Set a secret
wrangler secret put SECRET_NAME
# You'll be prompted to enter the value

# List all secrets (doesn't show values)
wrangler secret list

# Delete a secret
wrangler secret delete SECRET_NAME
```

### Via Cloudflare Dashboard

1. Go to **Cloudflare Dashboard**
2. Select **Workers & Pages**
3. Click on your worker
4. Go to **Settings** → **Variables and Secrets**
5. Click **Add variable**
6. Select **Secret** type
7. Enter name and value
8. Click **Save**

## Secret Generation Guide

### JWT_SECRET

```bash
# Option 1: OpenSSL (recommended)
openssl rand -base64 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Requirements:**
- Minimum 32 characters
- Random and unpredictable
- Store securely (password manager)
- Rotate every 90 days

### BREVO_WEBHOOK_SECRET

```bash
# Generate random string
openssl rand -hex 32
```

**Note:** Must match the secret configured in Brevo webhooks settings.

## Security Best Practices

### ✅ Do

- Generate strong, random secrets (32+ characters)
- Store secrets in a password manager
- Use different secrets for production and preview
- Rotate secrets every 90 days
- Limit who has access to secrets
- Use Cloudflare secrets for sensitive data
- Document when secrets were last rotated

### ❌ Don't

- Commit secrets to Git
- Share secrets via email or Slack
- Use weak or guessable secrets
- Reuse secrets across projects
- Log secret values
- Store secrets in plain text files

## Secret Rotation Schedule

| Secret | Rotation Frequency | Impact | Steps |
|--------|-------------------|--------|-------|
| `JWT_SECRET` | Every 90 days | ⚠️ Invalidates all user sessions | 1. Generate new secret<br>2. Set via wrangler<br>3. Deploy worker<br>4. Users must re-login |
| `BREVO_API_KEY` | Yearly or if compromised | ⚠️ Email sending stops if old key deleted | 1. Generate new key in Brevo<br>2. Set via wrangler<br>3. Test email sending<br>4. Delete old key |
| `BREVO_WEBHOOK_SECRET` | Yearly or if compromised | ⚠️ Webhooks will fail | 1. Generate new secret<br>2. Update in Brevo<br>3. Set via wrangler<br>4. Deploy worker |

## Backup & Recovery

### Backup Your Secrets

Create a secure document (store in password manager):

```
Project: [Your Project Name]
Environment: Production
Last Updated: [Date]

JWT_SECRET: [paste value]
BREVO_API_KEY: [paste value]
BREVO_WEBHOOK_SECRET: [paste value] (optional)

wrangler.toml Configuration:
- BRAND_NAME: Your App
- CLIENT_URL: https://dashboard.your-domain.com
- SERVER_URL: https://api.your-domain.com
- SENDER_NAME: Your App
- SENDER_EMAIL: noreply@your-domain.com

Database ID: [abc123-def456]
KV Namespace ID: [xyz789-abc123]

Note: Email templates are inline HTML - no Brevo template IDs needed

Next Rotation Due: [Date + 90 days]
```

### Recovery Steps

If you lose secrets:

1. **JWT_SECRET**: Generate new one, all users must re-login
2. **BREVO_API_KEY**: Generate new key in Brevo dashboard
3. **Database/KV IDs**: Find in Cloudflare dashboard or `wrangler.toml`

## Verification Checklist

Before going live:

- [ ] JWT_SECRET is strong and random (32+ chars)
- [ ] BREVO_API_KEY is valid and tested
- [ ] wrangler.toml vars configured (CLIENT_URL, SERVER_URL, SENDER_*, etc.)
- [ ] Webhook secret matches Brevo (if using webhooks)
- [ ] All secrets backed up securely
- [ ] Team members know where to find secrets
- [ ] Rotation schedule documented

## Environment-Specific Configurations

### Production

```bash
# Set production secrets
wrangler secret put JWT_SECRET
wrangler secret put BREVO_API_KEY
wrangler secret put CORS_ORIGIN
```

### Preview/Staging

```bash
# Set preview secrets (different from production)
wrangler secret put JWT_SECRET --env preview
wrangler secret put BREVO_API_KEY --env preview
wrangler secret put CORS_ORIGIN --env preview
```

**Tip:** Use the same Brevo account but different JWT secrets.

## Troubleshooting

### Issue: "Cannot access env.JWT_SECRET"

**Cause**: Secret not set or worker not redeployed

**Solution**:
```bash
wrangler secret list  # Verify secret exists
wrangler deploy       # Redeploy worker
```

### Issue: "Brevo authentication failed"

**Cause**: Invalid or expired API key

**Solution**:
1. Test API key: `curl -H "api-key: YOUR_KEY" https://api.brevo.com/v3/account`
2. Generate new key in Brevo if needed
3. Update secret: `wrangler secret put BREVO_API_KEY`

### Issue: "CORS error from frontend"

**Cause**: CORS_ORIGIN doesn't match frontend URL

**Solution**:
1. Check frontend URL (including https://, no trailing slash)
2. Update secret: `wrangler secret put CORS_ORIGIN`
3. Enter exact URL: `https://dashboard.your-domain.com`

## Contact

For secret management questions, contact:
- **System Administrator**: [Contact info]
- **Security Team**: [Contact info]

---

**Last Updated**: [Date]  
**Next Review**: [Date + 90 days]

