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
| **Last Updated** | 2026-01-01 13:56 UTC |
| **Expires** | 2026-01-02 13:56 UTC |
| **User** | rikibaker+notro@gmail.com |
| **Role** | master_admin |
| **Status** | VALID - Use this token for all testing |

```
eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJtYXN0ZXItYWRtaW4tMDAxIiwiY29tcGFueUlkIjoic3lzdGVtIiwicm9sZSI6Im1hc3Rlcl9hZG1pbiIsInBoaUFjY2Vzc0xldmVsIjoibm9uZSIsImlzTW9iaWxlIjpmYWxzZSwiaXNzdWVkQXQiOjE3NjcyNzU3NDksImRhdGFDbGFzc2lmaWNhdGlvbiI6InB1YmxpYyIsInNlc3Npb25JZCI6IjMwNGU1MGJlLWRlMmQtNGE4YS1hMjRlLTcyNjI5YTc3ZGU4ZiIsImNvbXBhbnlDb250ZXh0Ijp7ImlkIjoic3lzdGVtIiwicm9sZSI6Im1hc3Rlcl9hZG1pbiIsInBlcm1pc3Npb25zIjpbXX0sImlhdCI6MTc2NzI3NTc0OSwiZXhwIjoxNzY3MzYyMTQ5LCJpc3MiOiJodHRwczovL2FwaS5ub3Ryb3BvbGlzLm5ldCIsImF1ZCI6Imh0dHBzOi8vYm9zcy5ub3Ryb3BvbGlzLm5ldCIsImp0aSI6Ijg4NjQ5MThlLTJjNzQtNDg3NS05OWZiLWIxNjBhZTUxZTNkMSJ9.jLfCZDja5Qn56_AcjZBp-SKoeTu96rsOk-0hfbLMRB0
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

**CRITICAL**: When using curl, paste the token DIRECTLY into the command. Do NOT use shell variables - they don't work reliably with long JWT tokens.

### Correct Way (paste token directly)

```bash
curl -s "https://api.notropolis.net/api/auth/me" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOi..." | jq
```

### Wrong Way (shell variables fail silently)

```bash
# DO NOT DO THIS - the token gets truncated/lost
TOKEN="eyJhbGciOiJIUzI1NiJ9..."
curl -s "https://api.notropolis.net/api/endpoint" -H "Authorization: Bearer $TOKEN"
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
