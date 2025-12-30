# 05 - Secrets Management

## Overview

Cloudflare Workers use **secrets** for sensitive configuration values. Secrets are:
- Encrypted at rest
- Not visible in logs or wrangler.toml
- Accessible only to your worker at runtime
- Set via Wrangler CLI or Cloudflare Dashboard

**Important**: This template does NOT use `.env` files for the backend. All configuration is via:
- **Secrets** (encrypted) - For sensitive values like API keys
- **wrangler.toml [vars]** (not encrypted) - For non-sensitive configuration

## Required Secrets

| Secret Name | Purpose | Required |
|------------|---------|----------|
| `JWT_SECRET` | JWT token signing | **Yes** |
| `BREVO_API_KEY` | Brevo email service authentication | **Yes** (if using Brevo) |
| `POSTMARK_SERVER_TOKEN` | Postmark email service authentication | **Yes** (if using Postmark) |
| `BREVO_WEBHOOK_SECRET` | Brevo webhook authentication | Optional |

**Note**: Choose ONE email provider (Brevo OR Postmark). Both use inline HTML email templates.

## Step 1: Generate JWT Secret

Create a strong random secret for JWT signing:

```bash
# Option 1: Using OpenSSL (Mac/Linux)
openssl rand -hex 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Copy the output** - this is your `JWT_SECRET`.

Example output: `a7f3d2e1c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2`

## Step 2: Set Required Secrets via Wrangler CLI

```bash
cd worker

# Set JWT Secret (REQUIRED)
wrangler secret put JWT_SECRET
# When prompted, paste your generated secret

# Set Email Provider Secret (REQUIRED - choose ONE)

# Option A: If using Brevo
wrangler secret put BREVO_API_KEY
# When prompted, paste your Brevo API key

# Option B: If using Postmark
wrangler secret put POSTMARK_SERVER_TOKEN
# When prompted, paste your Postmark Server API Token
```

## Step 3: Set Optional Secrets

```bash
# Set Webhook Secret (OPTIONAL - only if using Brevo webhooks)
wrangler secret put BREVO_WEBHOOK_SECRET
# Enter: your webhook secret from Brevo
```

## Step 4: Set Secrets via Cloudflare Dashboard (Alternative)

If you prefer using the dashboard:

1. Go to **Cloudflare Dashboard**
2. Select **Workers & Pages**
3. Click on your worker: `your-project-api`
4. Go to **Settings** tab
5. Scroll to **Variables and Secrets**
6. Click **Add variable**
7. For each secret:
   - Type: **Secret**
   - Variable name: e.g., `JWT_SECRET`
   - Value: Paste the secret value
   - Click **Save**

## Step 5: Verify Secrets

List all secrets (won't show values):

```bash
cd worker
wrangler secret list
```

**Expected output (example with Brevo):**
```
┌──────────────────────────────┐
│ Name                         │
├──────────────────────────────┤
│ JWT_SECRET                   │
│ BREVO_API_KEY                │
│ BREVO_WEBHOOK_SECRET         │
└──────────────────────────────┘
```

**Or with Postmark:**
```
┌──────────────────────────────┐
│ Name                         │
├──────────────────────────────┤
│ JWT_SECRET                   │
│ POSTMARK_SERVER_TOKEN        │
└──────────────────────────────┘
```

## Configuration Variables (wrangler.toml)

These are NOT secrets - they go in `/worker/wrangler.toml` under `[vars]`:

```toml
[vars]
# Application Configuration
BRAND_NAME = "Your App"
CLIENT_URL = "https://dashboard.your-domain.com"
SERVER_URL = "https://api.your-domain.com"

# Email Sender Configuration
SENDER_NAME = "Your App"
SENDER_EMAIL = "noreply@your-domain.com"

# JWT Configuration
JWT_EXPIRES_IN = "24h"

# Session Configuration
SESSION_TIMEOUT = "3600000"
SESSION_IDLE_TIMEOUT = "1800000"

# Rate Limiting Configuration
RATE_LIMIT_LOGIN = "20"
RATE_LIMIT_LOGIN_WINDOW = "900"
RATE_LIMIT_API = "100"
RATE_LIMIT_API_WINDOW = "60"
```

## Local Development (.dev.vars)

For local development with `wrangler dev`, create `/worker/.dev.vars`:

```env
JWT_SECRET=local-development-secret-not-for-production

# Choose ONE email provider:
BREVO_API_KEY=your-brevo-api-key
# OR
POSTMARK_SERVER_TOKEN=your-postmark-server-token
```

**Important**: Add `.dev.vars` to `.gitignore`:

```
.dev.vars
```

## Secrets vs Variables Quick Reference

| Type | Where to Set | Encrypted | Use For |
|------|-------------|-----------|---------|
| **Secret** | `wrangler secret put` | Yes | API keys, JWT secrets |
| **Variable** | `wrangler.toml [vars]` | No | URLs, brand name, timeouts |
| **Local Secret** | `.dev.vars` | No | Local development only |

## Secret Management Best Practices

### Do's

- Use strong, random secrets (32+ characters)
- Rotate secrets periodically (every 90 days)
- Use different secrets for production and preview
- Store secrets securely (password manager)
- Limit access to secrets (only authorized team members)

### Don'ts

- Never commit secrets to git
- Don't use weak or guessable secrets
- Don't share secrets in plain text (email, Slack, etc.)
- Don't reuse secrets across projects
- Don't log secret values

## Rotating Secrets

To rotate a secret:

```bash
# Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# Update the secret
wrangler secret put JWT_SECRET
# Paste the new secret

# Deploy to apply changes
wrangler deploy
```

**Warning**: Rotating `JWT_SECRET` will invalidate all existing user sessions.

## Delete a Secret

If you need to remove a secret:

```bash
wrangler secret delete SECRET_NAME
```

## Environment-Specific Secrets

### Production Secrets

```bash
# Set production secrets (default)
wrangler secret put JWT_SECRET

# Or explicitly specify production
wrangler secret put JWT_SECRET --env production
```

### Preview Secrets

```bash
# Set preview/staging secrets
wrangler secret put JWT_SECRET --env preview
```

**Tip**: Use different secrets for production and preview environments.

## Secret Reference Sheet

Create this sheet and store it securely (e.g., password manager):

```
Project: Your Project Name
Environment: Production
Email Provider: Brevo / Postmark (choose one)

JWT_SECRET: [stored in password manager]

# If using Brevo:
BREVO_API_KEY: [stored in password manager]
BREVO_WEBHOOK_SECRET: [stored in password manager]

# If using Postmark:
POSTMARK_SERVER_TOKEN: [stored in password manager]

Last Updated: [date]
Next Rotation: [date + 90 days]
```

## Verification Checklist

- [ ] JWT_SECRET generated (32+ characters, random)
- [ ] JWT_SECRET set via `wrangler secret put`
- [ ] Email provider secret set (choose one):
  - [ ] BREVO_API_KEY set via `wrangler secret put` (if using Brevo)
  - [ ] POSTMARK_SERVER_TOKEN set via `wrangler secret put` (if using Postmark)
- [ ] BREVO_WEBHOOK_SECRET set (if using Brevo webhooks)
- [ ] Secrets verified with `wrangler secret list`
- [ ] wrangler.toml vars configured (BRAND_NAME, URLs, etc.)
- [ ] `.dev.vars` created for local development
- [ ] `.dev.vars` added to `.gitignore`
- [ ] Secrets documented in secure location (password manager)

## Troubleshooting

### Issue: "Secret not found"

**Solution**: Make sure you're in the `/worker` directory when running `wrangler secret` commands

### Issue: "Cannot access secret in worker"

**Solution**:
- Verify secret is set: `wrangler secret list`
- Redeploy worker: `wrangler deploy`
- Check secret name matches exactly (case-sensitive)

### Issue: "CORS error in browser"

**Solution**:
- Set `CLIENT_URL` correctly in `wrangler.toml`
- Ensure it matches your frontend URL exactly (including `https://`)
- No trailing slash in the URL

### Issue: "Email not sending"

**Solution for Brevo**:
- Verify `BREVO_API_KEY` is correct
- Test API key with curl (see [04A-BREVO-SETUP.md](./04A-BREVO-SETUP.md))
- Check Brevo account status

**Solution for Postmark**:
- Verify `POSTMARK_SERVER_TOKEN` is correct
- Test API token with curl (see [04B-POSTMARK-SETUP.md](./04B-POSTMARK-SETUP.md))
- Check Postmark server status and sender verification

### Issue: "JWT invalid signature"

**Solution**:
- Ensure `JWT_SECRET` is set correctly
- Check that production and local secrets match if testing locally
- Redeploy after setting secrets: `wrangler deploy`

## Next Steps

Continue to [06-DEPLOYMENT.md](./06-DEPLOYMENT.md) to deploy your application.

