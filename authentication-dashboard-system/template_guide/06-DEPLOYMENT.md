# 06 - Deployment

## Overview

You'll deploy two components:
1. **Worker (Backend API)** - Cloudflare Workers
2. **Frontend (Dashboard)** - Cloudflare Pages

## Prerequisites

Make sure you've completed:
- [✓] 01 - Initial Setup
- [✓] 02 - Cloudflare Setup  
- [✓] 03 - Database Schema
- [✓] 04 - Brevo Setup
- [✓] 05 - Secrets Management

## Part 1: Deploy Worker (Backend API)

### Step 1: Test Locally First

```bash
cd worker

# Start local development server
npx wrangler dev
```

This starts the worker on `http://localhost:8787`

### Step 2: Test Local Worker

```bash
# Test health endpoint
curl http://localhost:8787/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-10-08T12:00:00.000Z",
  "version": "1.0.0"
}
```

### Step 3: Deploy Worker to Production

```bash
# Make sure you're in the worker directory
cd worker

# Deploy to production
npx wrangler deploy
```

**Expected output:**
```
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded your-project-api (X.XX sec)
Published your-project-api (X.XX sec)
  https://your-project-api.YOUR_SUBDOMAIN.workers.dev
Current Deployment ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Step 4: Verify Worker Deployment

```bash
# Test production worker (replace with your worker URL)
curl https://api.your-domain.com/api/health
```

If using custom domain:
```bash
curl https://api.your-domain.com/api/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-10-08T12:00:00.000Z"
}
```

## Part 2: Deploy Frontend (Dashboard)

### Step 1: Update Environment for Production

Open `/src/config/environment.ts` and verify:

```typescript
API_BASE_URL: (import.meta as any).env?.VITE_API_BASE_URL || 'https://api.your-domain.com',
```

### Step 2: Build Frontend

```bash
# Make sure you're in the root directory
cd ..  # if you're in /worker
# or
cd /path/to/your/project

# Install dependencies (if not done already)
npm install

# Build for production
npm run build
```

**Expected output:**
```
vite v4.5.0 building for production...
✓ XXXX modules transformed.
dist/index.html                   X.XX kB
dist/assets/index-XXXXXXXX.css   XX.XX kB │ gzip: XX.XX kB
dist/assets/index-XXXXXXXX.js   XXX.XX kB │ gzip: XX.XX kB
✓ built in X.XXs
```

### Step 3: Deploy to Cloudflare Pages

```bash
# Deploy to production
npm run deploy

# Or manually:
npx wrangler pages deploy ./dist --project-name=your-project-name
```

**Expected output:**
```
✨ Compiled Worker successfully
🌎 Uploading... (XXX files)
✨ Success! Uploaded XXX files (X.XX sec)

✨ Deployment complete! Take a peek over at
   https://xxxxx.your-project-name.pages.dev
```

### Step 4: Deploy Preview Environment (Optional)

```bash
# Deploy to preview
npm run deploy:preview

# Or manually:
npx wrangler pages deploy ./dist --project-name=your-project-name-preview
```

## Part 3: Verify Full Deployment

### Step 1: Check DNS Propagation

```bash
# Check frontend domain
nslookup dashboard.your-domain.com

# Check API domain
nslookup api.your-domain.com
```

### Step 2: Test Authentication Flow

1. Open your browser to `https://dashboard.your-domain.com`
2. Try logging in with the admin account you created:
   - Email: `admin@your-domain.com`
   - Password: `admin123`

### Step 3: Check Network Tab

1. Open browser DevTools (F12)
2. Go to Network tab
3. Try logging in
4. Verify:
   - API calls go to `https://api.your-domain.com`
   - Responses return 200 OK
   - CORS headers are present

### Step 4: Test Magic Link Email

1. Click "Send Magic Link" on login page
2. Enter your email
3. Check your inbox for the email
4. Click the magic link
5. Verify you're redirected and logged in

## Part 4: Set Up Automatic Deployments (Optional)

### Option A: Cloudflare Pages Git Integration

1. Go to **Cloudflare Dashboard** → **Workers & Pages**
2. Click on your Pages project
3. Go to **Settings** → **Builds & deployments**
4. Click **Connect to Git**
5. Choose your Git provider (GitHub, GitLab, etc.)
6. Select your repository
7. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (or leave blank)
8. Click **Save and Deploy**

Now pushes to `main` will automatically deploy!

### Option B: CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches:
      - main
      - develop

jobs:
  deploy-worker:
    runs-on: ubuntu-latest
    name: Deploy Worker
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        working-directory: ./worker
        run: npm ci
      
      - name: Deploy Worker
        working-directory: ./worker
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  
  deploy-frontend:
    runs-on: ubuntu-latest
    name: Deploy Frontend
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Cloudflare Pages
        run: npx wrangler pages deploy ./dist --project-name=your-project-name
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

Add `CLOUDFLARE_API_TOKEN` to your GitHub repository secrets.

## Part 5: Environment-Specific Deployments

### Production Deployment

```bash
# Deploy worker to production
cd worker
npx wrangler deploy --env production

# Deploy frontend to production
cd ..
npm run deploy
```

### Preview/Staging Deployment

```bash
# Deploy worker to preview
cd worker
npx wrangler deploy --env preview

# Deploy frontend to preview
cd ..
npm run deploy:preview
```

## Deployment Checklist

### Pre-Deployment
- [ ] All secrets configured (JWT_SECRET, BREVO_API_KEY)
- [ ] Database schema applied
- [ ] Brevo sender verified (no templates needed - inline templates used)
- [ ] Custom domains configured
- [ ] DNS propagated

### Worker Deployment
- [ ] Worker deployed successfully
- [ ] Health check returns 200 OK
- [ ] Custom domain working
- [ ] CORS headers present
- [ ] Rate limiting active

### Frontend Deployment
- [ ] Build completed without errors
- [ ] Pages deployed successfully
- [ ] Custom domain working
- [ ] SSL certificate active
- [ ] API calls connecting to worker

### Post-Deployment
- [ ] Can access login page
- [ ] Can log in with admin account
- [ ] Magic link emails working
- [ ] Dashboard loads correctly
- [ ] All features functional

## Monitoring Deployment

### View Worker Logs

```bash
# Tail worker logs in real-time
cd worker
npx wrangler tail
```

### Check Deployment Status

```bash
# List worker deployments
npx wrangler deployments list

# Check Pages deployment
npx wrangler pages deployment list --project-name=your-project-name
```

### Cloudflare Dashboard

1. **Worker Logs**: Workers & Pages → your-project-api → Logs
2. **Pages Analytics**: Workers & Pages → your-project-name → Analytics
3. **Real-time Logs**: Workers & Pages → Logs → Real-time logs

## Rollback Deployment

### Rollback Worker

```bash
cd worker

# List recent deployments
npx wrangler deployments list

# Rollback to previous deployment
npx wrangler rollback --deployment-id <deployment-id>
```

### Rollback Pages

1. Go to **Cloudflare Dashboard** → **Workers & Pages**
2. Click on your Pages project
3. Go to **Deployments** tab
4. Find the working deployment
5. Click **...** → **Rollback to this deployment**

## Troubleshooting

### Issue: "Build failed"
**Solution**: 
- Check `package.json` scripts
- Run `npm run build` locally first
- Check for TypeScript errors
- Verify all dependencies installed

### Issue: "Worker deployment failed"
**Solution**:
- Verify `account_id` in `wrangler.toml`
- Check secrets are set: `wrangler secret list`
- Ensure D1 database exists
- Verify KV namespace IDs are correct

### Issue: "CORS errors in browser"
**Solution**:
- Check `CORS_ORIGIN` secret matches frontend URL
- Verify worker is deployed with latest code
- Check browser console for exact error

### Issue: "Database not found"
**Solution**:
- Verify D1 database exists: `wrangler d1 list`
- Check `database_id` in `wrangler.toml`
- Ensure schema was applied

### Issue: "Rate limit errors"
**Solution**:
- Verify KV namespace is bound correctly
- Check KV namespace IDs in `wrangler.toml`
- Ensure KV namespaces exist

### Issue: "SSL certificate not working"
**Solution**:
- Wait up to 24 hours for provisioning
- Verify domain DNS points to Cloudflare
- Check domain is active in Cloudflare

## Performance Optimization

### Enable Caching

Add to worker for static responses:

```javascript
return new Response(JSON.stringify(data), {
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300'
  }
});
```

### Minify Build

Already enabled in Vite config, but verify:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    minify: 'esbuild',
    sourcemap: false
  }
})
```

## Next Steps

Continue to [07-POST-DEPLOYMENT.md](./07-POST-DEPLOYMENT.md) for post-deployment verification and testing.

