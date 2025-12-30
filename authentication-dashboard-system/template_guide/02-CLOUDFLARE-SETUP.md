# 02 - Cloudflare Setup

## Prerequisites

- Cloudflare account (free tier is sufficient)
- Domain registered (can be with Cloudflare or external)
- Wrangler CLI installed (`npm install -g wrangler`)

## Step 1: Login to Cloudflare

```bash
wrangler login
```

This will open a browser window to authenticate.

## Step 2: Get Your Account ID

```bash
wrangler whoami
```

Copy your Account ID and update it in `/worker/wrangler.toml`:

```toml
account_id = "your-account-id-here"
```

## Step 3: Create D1 Database

```bash
cd worker

# Create the database
wrangler d1 create your_project_database
```

**Example output:**
```
✅ Successfully created DB 'your_project_database'

[[d1_databases]]
binding = "DB"
database_name = "your_project_database"
database_id = "abc123-def456-ghi789"
```

**Copy the `database_id`** and update `/worker/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "your_project_database"
database_id = "abc123-def456-ghi789"  # Your actual ID
```

## Step 4: Create KV Namespaces

### 4.1 Create Production KV Namespace

```bash
wrangler kv:namespace create "RATE_LIMIT_KV"
```

**Example output:**
```
✅ Success!
Add the following to your wrangler.toml:

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "xyz789abc123def456"
```

**Copy the `id`** value.

### 4.2 Create Preview KV Namespace

```bash
wrangler kv:namespace create "RATE_LIMIT_KV" --preview
```

**Example output:**
```
✅ Success!
Add the following to your wrangler.toml:

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
preview_id = "preview123abc456def"
```

**Copy the `preview_id`** value.

### 4.3 Update wrangler.toml

Update `/worker/wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "xyz789abc123def456"           # Production ID from step 4.1
preview_id = "preview123abc456def"  # Preview ID from step 4.2
```

## Step 5: Create Cloudflare Pages Project

### 5.1 Create Pages Project

```bash
# Make sure you're in the root directory
cd ..

# Build the project first
npm run build

# Create the Pages project
wrangler pages deploy ./dist --project-name=your-project-name
```

This will create the project and deploy it for the first time.

### 5.2 Create Preview Pages Project (Optional)

```bash
wrangler pages deploy ./dist --project-name=your-project-name-preview
```

## Step 6: Set Up Custom Domains

### 6.1 Add Your Domain to Cloudflare

1. Go to Cloudflare Dashboard
2. Click **"Add a Site"**
3. Enter your domain name
4. Follow the nameserver setup instructions
5. Wait for DNS to propagate (can take 24-48 hours)

### 6.2 Configure Pages Custom Domain

1. Go to **Workers & Pages** in Cloudflare Dashboard
2. Click on your **Pages project** (`your-project-name`)
3. Go to **Custom domains** tab
4. Click **Set up a custom domain**
5. Enter: `dashboard.your-domain.com` (or just `your-domain.com`)
6. Click **Activate domain**

### 6.3 Configure Worker Custom Domain

1. Go to **Workers & Pages** in Cloudflare Dashboard
2. Click on your **Worker** (`your-project-api`)
3. Go to **Triggers** tab
4. Under **Custom Domains**, click **Add Custom Domain**
5. Enter: `api.your-domain.com`
6. Click **Add Custom Domain**

Cloudflare will automatically create DNS records and SSL certificates.

## Step 7: Verify DNS Configuration

After adding custom domains, verify these DNS records exist:

**For Frontend** (`dashboard.your-domain.com`):
- Type: `CNAME`
- Name: `dashboard` (or `@` for root)
- Target: `your-project-name.pages.dev`

**For API** (`api.your-domain.com`):
- Type: `CNAME`
- Name: `api`
- Target: `your-project-api.workers.dev`

## Step 8: Update CORS Configuration

Once you know your domains, update the worker CORS configuration:

Open `/worker/index.js` and find all instances of:

```javascript
'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://dashboard.your-domain.com'
```

You can either:

**Option A**: Set it as a secret (recommended):
```javascript
'Access-Control-Allow-Origin': env.CORS_ORIGIN
```

Then set the secret (see [05-SECRETS-MANAGEMENT.md](./05-SECRETS-MANAGEMENT.md)):
```bash
wrangler secret put CORS_ORIGIN
# Enter: https://dashboard.your-domain.com
```

**Option B**: Hardcode it (simpler but less flexible):
```javascript
'Access-Control-Allow-Origin': 'https://dashboard.your-domain.com'
```

## Step 9: Create API Token for CI/CD (Optional)

If you want automated deployments:

1. Go to **Cloudflare Dashboard** → **My Profile** → **API Tokens**
2. Click **Create Token**
3. Use **Edit Cloudflare Workers** template
4. Configure:
   - **Permissions**: `Cloudflare Pages - Edit`, `Workers - Edit`
   - **Account Resources**: Include your account
   - **Zone Resources**: Include your domain
5. Click **Continue to summary**
6. Click **Create Token**
7. **Copy the token** (you won't see it again)
8. Store it securely (e.g., in your CI/CD secrets)

## Verification Checklist

- [ ] Account ID added to `wrangler.toml`
- [ ] D1 database created and ID added to config
- [ ] KV namespaces created (production and preview)
- [ ] KV namespace IDs added to config
- [ ] Pages project created
- [ ] Custom domains configured
- [ ] DNS records verified
- [ ] SSL certificates active (automatic)
- [ ] CORS configuration updated
- [ ] API token created (if using CI/CD)

## Troubleshooting

### Issue: "Database not found"
**Solution**: Make sure the `database_id` in `wrangler.toml` matches exactly

### Issue: "KV namespace not found"
**Solution**: Verify the KV namespace IDs are correct in `wrangler.toml`

### Issue: "Custom domain not activating"
**Solution**: 
- Wait a few minutes for DNS propagation
- Check that your domain's nameservers point to Cloudflare
- Verify no conflicting DNS records exist

### Issue: "SSL certificate not provisioning"
**Solution**: Cloudflare automatically provisions SSL. Wait up to 24 hours.

## Next Steps

Continue to [03-DATABASE-SCHEMA.md](./03-DATABASE-SCHEMA.md) to initialize your database.

