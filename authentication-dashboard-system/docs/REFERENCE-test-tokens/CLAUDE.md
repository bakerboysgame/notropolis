# Notropolis Project Rules

## CRITICAL RULES FOR ALL CLAUDE WORKERS

**These rules are MANDATORY. Follow them exactly.**

### Rule 1: Token Management

When you need an API token for testing:

1. **FIRST**: Check the "Current Valid Tokens" section below
2. **IF token exists and not expired**: Use it directly (don't generate a new one)
3. **IF token is expired OR doesn't exist for the role you need**:
   - Generate a new token using the steps in "How to Generate a New Token"
   - **IMMEDIATELY update this file** with the new token details
   - Include: Last Updated timestamp, Expires timestamp, User email, Role

**WHY**: Generating tokens sends emails and creates database entries. Reusing valid tokens avoids spam and unnecessary operations.

---

## Current Valid Tokens (24hr expiry)

**REUSE THESE TOKENS UNTIL EXPIRED - DO NOT GENERATE NEW ONES UNNECESSARILY**

Check expiry dates below. Only generate new tokens if these are expired.

### Master Admin Token

| Field | Value |
|-------|-------|
| **Last Updated** | 2026-01-02 21:30 UTC |
| **Expires** | 2026-04-02 (90 day mobile token) |
| **User** | rikibaker+notro@gmail.com |
| **Role** | master_admin |
| **Status** | VALID - Use this token for all testing |

```
eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJtYXN0ZXItYWRtaW4tMDAxIiwiY29tcGFueUlkIjoic3lzdGVtIiwicm9sZSI6Im1hc3Rlcl9hZG1pbiIsInBoaUFjY2Vzc0xldmVsIjoibm9uZSIsImlzTW9iaWxlIjp0cnVlLCJpc3N1ZWRBdCI6MTc2NzM4MTYwOCwiZGF0YUNsYXNzaWZpY2F0aW9uIjoicHVibGljIiwic2Vzc2lvbklkIjoiNzk4ODlkMDctNWE5ZC00OGU3LWFkNWUtYWNjMjE4NGEwZmVjIiwiY29tcGFueUNvbnRleHQiOnsiaWQiOiJzeXN0ZW0iLCJyb2xlIjoibWFzdGVyX2FkbWluIiwicGVybWlzc2lvbnMiOltdfSwiaWF0IjoxNzY3MzgxNjA4LCJleHAiOjE3NzUxNTc2MDgsImlzcyI6Imh0dHBzOi8vYXBpLm5vdHJvcG9saXMubmV0IiwiYXVkIjoiaHR0cHM6Ly9ib3NzLm5vdHJvcG9saXMubmV0IiwianRpIjoiMWVmOTlmNWEtMTM0Yy00ZjE4LTkzZWItNTExYzE5MDA0NmY5In0.rLq3QmY4x7fc0sK4YvlASjCWSn-vw9JVsN5GOCQUJ-E
```

> **REMINDER**: If you generate a new token, you MUST update this file with the new token, timestamps, and role. See "Rule 1: Token Management" at the top of this file.

---

## Project Overview

Notropolis is a multi-tenant SaaS authentication dashboard for game management.

- **Frontend**: React + TypeScript + Vite (in `/src`)
- **Backend**: Cloudflare Worker (in `/worker`)
- **Database**: Cloudflare D1 (SQLite)
- **API URL**: `https://api.notropolis.net`
- **App URL**: `https://bossmode.notropolis.net`

---

## How to Use the Token for API Testing

**CRITICAL**: Shell command substitution like `$(cat file)` often FAILS SILENTLY in some environments, sending literal text instead of the file contents. Use Python for reliable testing.

### RECOMMENDED: Python Method (Always Works)

Save the token to a file first, then use Python:

```bash
# Save token (copy from above, no trailing newline)
echo -n 'eyJhbGciOiJIUzI1NiJ9...' > /tmp/token.txt

# Test any endpoint with Python
python3 -c "
import urllib.request
import json

with open('/tmp/token.txt', 'r') as f:
    token = f.read().strip()

req = urllib.request.Request('https://api.notropolis.net/api/admin/assets/queue')
req.add_header('Authorization', f'Bearer {token}')

try:
    with urllib.request.urlopen(req) as resp:
        print(json.dumps(json.loads(resp.read()), indent=2))
except urllib.error.HTTPError as e:
    print(f'HTTP Error {e.code}: {e.read().decode()}')"
```

### Alternative: Get Token from Database Directly

If you need a fresh working token, get it directly from the sessions table:

```bash
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler d1 execute notropolis-database --remote --json \
--command "SELECT token FROM sessions WHERE user_id = 'master-admin-001' ORDER BY created_at DESC LIMIT 1" \
2>/dev/null | jq -r '.[0].results[0].token' | tr -d '\n' > /tmp/token.txt
```

### AVOID: These Methods Often Fail

```bash
# DO NOT USE - command substitution fails silently in some shells
curl -H "Authorization: Bearer $(cat /tmp/token.txt)" ...

# DO NOT USE - shell variables get truncated
TOKEN="eyJhbGciOiJIUzI1NiJ9..."
curl -H "Authorization: Bearer $TOKEN" ...
```

---

## How to Generate a New Token (Only if Expired)

Follow these steps EXACTLY in order. Each step must complete before the next.

### Step 1: Request a magic link code

Run this command:

```bash
curl -s -X POST "https://api.notropolis.net/api/auth/magic-link/request" -H "Content-Type: application/json" -d '{"email": "rikibaker+notro@gmail.com"}'
```

You should see: `{"success":true,"data":{"message":"Magic link sent to your email"}}`

### Step 2: Get the 6-digit code from the database

Run this command:

```bash
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" npx wrangler d1 execute notropolis-database --remote --json --command "SELECT magic_link_code FROM users WHERE email = 'rikibaker+notro@gmail.com'" 2>/dev/null | jq -r '.[0].results[0].magic_link_code'
```

This outputs a 6-digit code like `430969`. Copy this code.

### Step 3: Exchange the code for a JWT token

Replace `XXXXXX` with the 6-digit code from Step 2:

```bash
curl -s -X POST "https://api.notropolis.net/api/auth/magic-link/verify-code" -H "Content-Type: application/json" -d '{"email": "rikibaker+notro@gmail.com", "code": "XXXXXX"}'
```

The response JSON contains `data.token` - this is your JWT token.

To extract just the token:

```bash
curl -s -X POST "https://api.notropolis.net/api/auth/magic-link/verify-code" -H "Content-Type: application/json" -d '{"email": "rikibaker+notro@gmail.com", "code": "XXXXXX"}' | jq -r '.data.token'
```

### Step 4: Update this file

After getting a new token, UPDATE the "Current Valid Token" section at the top of this file with:
- The new token
- Current UTC timestamp as "Last Updated"
- Expiry time (24 hours from now)
- User email and role

---

## Test Users

| Email | Type | Use For |
|-------|------|---------|
| `rikibaker+notro@gmail.com` | master_admin | Full system access |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Authentication required" error | Token expired. Generate a new one using steps above. |
| Code expired (15 min limit) | Run Step 1 again to get a fresh code. |
| Empty response from curl | Make sure you're pasting the token directly, not using a variable. |
| Token looks truncated | JWT tokens are long. Copy the ENTIRE token from the code block above. |

---

## Database Access

Use wrangler to query the D1 database:

```bash
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" npx wrangler d1 execute notropolis-database --remote --command "YOUR_SQL"
```

For JSON output (useful for parsing):

```bash
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" npx wrangler d1 execute notropolis-database --remote --json --command "YOUR_SQL"
```

---

## How to Deploy the Dashboard

Deploy the authentication dashboard to Cloudflare Pages.

### Step 1: Build the project

From the `authentication-dashboard-system` directory:

```bash
npm run build
```

This runs TypeScript compilation and Vite build, outputting to the `dist` folder.

### Step 2: Deploy to Cloudflare Pages

```bash
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler pages deploy dist \
  --project-name=notropolis-dashboard \
  --branch=main \
  --commit-dirty=true
```

The deployment will return a URL like: `https://1883f137.notropolis-dashboard.pages.dev`

### Deployment Troubleshooting

| Problem | Solution |
|---------|----------|
| ENOENT: no such file or directory | Make sure you're in the `authentication-dashboard-system` directory when running the build command |
| Path not found (authentication-dashboard-system/authentication-dashboard-system) | Don't use `--prefix` with deploy command. Use the commands above from the correct directory |
| Uncommitted changes warning | Add `--commit-dirty=true` flag to the deploy command |
| Build fails with TypeScript errors | Fix TypeScript errors before deploying. Run `npm run build` to see errors |

---

## Available User Roles

| Role | Access Level |
|------|--------------|
| `master_admin` | Full system access, all companies |
| `admin` | Company administrator |
| `analyst` | Data analysis |
| `viewer` | Read-only |
| `user` | Standard user |

---

## Key Files

- `worker/index.js` - Main API router
- `worker/src/auth.js` - Authentication service
- `worker/src/middleware/authorization.js` - Role-based access control
- `worker/src/database.js` - Database operations
- `worker/src/email-postmark.js` - Email service (Postmark)
