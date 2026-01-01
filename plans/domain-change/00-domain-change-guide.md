# Domain Change Guide

This document provides step-by-step instructions for changing the Notropolis domain to a new domain and subdomain.

## Overview

The application uses environment variables for most domain references, making domain changes straightforward. The main areas requiring updates are:

1. **Cloudflare Worker** (wrangler.toml)
2. **Cloudflare Pages** (environment variables)
3. **DNS Configuration** (new domain)
4. **Email Provider** (Postmark domain verification)

---

## Prerequisites

Before starting, ensure you have:

- [ ] Access to Cloudflare dashboard
- [ ] Access to your new domain's DNS management
- [ ] Access to Postmark account
- [ ] The new domain registered and pointing to Cloudflare nameservers (recommended)

---

## Stage 1: Cloudflare Worker Configuration

### 1.1 Update wrangler.toml

Edit `authentication-dashboard-system/worker/wrangler.toml` and update these variables in **both** the default `[vars]` section AND the `[env.production.vars]` section:

```toml
# Replace these values with your new domain
CLIENT_URL = "https://dashboard.newdomain.com"
SERVER_URL = "https://api.newdomain.com"
CORS_ORIGIN = "https://dashboard.newdomain.com"
SENDER_EMAIL = "no-reply@newdomain.com"
SUPPORT_EMAIL = "support@newdomain.com"
BRAND_NAME = "Your New Brand Name"
```

**File locations to update:**
- Lines 51-58 (default vars)
- Lines 75-80 (production vars)

### 1.2 Optional: Additional CORS Origins

If you need to support multiple subdomains, add them as a comma-separated list:

```toml
ADDITIONAL_CORS_ORIGINS = "https://app.newdomain.com,https://admin.newdomain.com"
```

---

## Stage 2: Cloudflare Pages Configuration

### 2.1 Set Environment Variable

In the Cloudflare dashboard:

1. Go to **Workers & Pages** > **notropolis-dashboard** > **Settings** > **Environment variables**
2. Add or update:
   - **Variable name:** `VITE_API_BASE_URL`
   - **Value:** `https://api.newdomain.com`
3. Set for both **Production** and **Preview** environments

### 2.2 Update Custom Domain

1. Go to **Workers & Pages** > **notropolis-dashboard** > **Custom domains**
2. Remove the old domain (e.g., `boss.notropolis.net`)
3. Add the new domain (e.g., `dashboard.newdomain.com`)
4. Cloudflare will automatically provision SSL

---

## Stage 3: Cloudflare Worker Custom Domain

### 3.1 Update Worker Route

1. Go to **Workers & Pages** > **notropolis-api** > **Triggers** > **Custom Domains**
2. Remove the old domain (e.g., `api.notropolis.net`)
3. Add the new domain (e.g., `api.newdomain.com`)

---

## Stage 4: DNS Configuration

### 4.1 Required DNS Records

Add these records to your new domain's DNS:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `api` | `notropolis-api.workers.dev` | Proxied |
| CNAME | `dashboard` | `notropolis-dashboard.pages.dev` | Proxied |

**Note:** If using a root domain for the dashboard, use a CNAME flattening or ALIAS record.

### 4.2 Email DNS Records (for Postmark)

These will be provided by Postmark in Stage 5. Typically:

| Type | Name | Value |
|------|------|-------|
| TXT | `_dmarc` | `v=DMARC1; p=none;` |
| TXT | `@` or subdomain | SPF record from Postmark |
| CNAME | `pm-bounces` | Postmark bounce tracking |
| CNAME | Various | DKIM records from Postmark |

---

## Stage 5: Postmark Email Configuration

### 5.1 Add New Sender Domain

1. Log into Postmark dashboard
2. Go to **Sender Signatures** > **Add Domain or Sender**
3. Add your new domain (e.g., `newdomain.com`)
4. Postmark will provide DNS records to add

### 5.2 Verify DNS Records

1. Add all required DNS records from Postmark
2. Wait for DNS propagation (usually 5-30 minutes)
3. Click **Verify** in Postmark dashboard
4. Ensure DKIM, SPF, and Return-Path are all verified

### 5.3 Update Sender Address

The sender address is configured via `SENDER_EMAIL` in wrangler.toml (already done in Stage 1).

---

## Stage 6: Deploy Changes

### 6.1 Deploy Worker

```bash
cd authentication-dashboard-system/worker
npx wrangler deploy --env production
```

### 6.2 Trigger Pages Rebuild

Either:
- Push a commit to trigger automatic deployment, OR
- Go to Cloudflare Pages dashboard and click **Retry deployment**

---

## Stage 7: Verification Checklist

### 7.1 API Verification

```bash
# Health check
curl https://api.newdomain.com/api/health

# Expected: {"status":"healthy",...}
```

### 7.2 Frontend Verification

1. Navigate to `https://dashboard.newdomain.com`
2. Open browser DevTools > Network tab
3. Verify API calls go to `https://api.newdomain.com`
4. Check no CORS errors in Console

### 7.3 Email Verification

1. Trigger a magic link login
2. Verify email arrives from `no-reply@newdomain.com`
3. Verify links in email point to new domain
4. Check email doesn't land in spam

### 7.4 CORS Verification

```bash
# Test CORS preflight
curl -X OPTIONS https://api.newdomain.com/api/health \
  -H "Origin: https://dashboard.newdomain.com" \
  -H "Access-Control-Request-Method: GET" \
  -v 2>&1 | grep -i "access-control"

# Expected: Access-Control-Allow-Origin: https://dashboard.newdomain.com
```

---

## Quick Reference: Files to Update

| File | Variables | Purpose |
|------|-----------|---------|
| `worker/wrangler.toml` | CLIENT_URL, SERVER_URL, CORS_ORIGIN, SENDER_EMAIL, SUPPORT_EMAIL | Worker config |
| Cloudflare Pages Dashboard | VITE_API_BASE_URL | Frontend API endpoint |
| Cloudflare Pages Dashboard | Custom domain | Frontend URL |
| Cloudflare Workers Dashboard | Custom domain | API URL |
| DNS Provider | CNAME, TXT records | Routing & email |
| Postmark Dashboard | Sender domain | Email delivery |

---

## Rollback Procedure

If issues occur, revert by:

1. Restore original values in `wrangler.toml`
2. Redeploy worker: `npx wrangler deploy --env production`
3. Update Cloudflare Pages env var back to original
4. Re-add original custom domains in Cloudflare
5. Trigger Pages rebuild

---

## Notes

- **SSL Certificates:** Cloudflare handles SSL automatically for proxied domains
- **Propagation Time:** DNS changes can take up to 48 hours, but usually complete within 30 minutes with Cloudflare
- **Downtime:** With proper DNS TTL settings, migration can be zero-downtime
- **Old Domain:** Keep old domain active for a transition period to handle cached links/bookmarks
