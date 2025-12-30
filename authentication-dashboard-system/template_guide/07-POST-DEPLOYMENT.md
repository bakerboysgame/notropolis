# 07 - Post-Deployment Verification

## Overview

After deployment, verify everything works correctly before going live.

## Step 1: Health Check

### Test Worker Health

```bash
# Test health endpoint
curl https://api.your-domain.com/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-10-08T12:00:00.000Z"
}
```

### Test Frontend Access

```bash
# Check frontend is accessible
curl -I https://dashboard.your-domain.com

# Expected: HTTP/2 200
```

## Step 2: Test Authentication

### Test Login Endpoint

```bash
curl -X POST https://api.your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@your-domain.com",
    "password": "admin123"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "admin@your-domain.com",
    "role": "master_admin",
    ...
  }
}
```

### Test Magic Link Request

```bash
curl -X POST https://api.your-domain.com/api/auth/magic-link/request \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@your-domain.com"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "message": "Magic link sent to your email"
}
```

**Verify**: Check your email inbox for the magic link

## Step 3: Test Security Features

### Test Rate Limiting

```bash
# Try logging in 21 times rapidly (rate limit is 20)
for i in {1..21}; do
  echo "Request $i"
  curl -X POST https://api.your-domain.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    -w "\nStatus: %{http_code}\n"
done
```

**Expected**: After 20 attempts, you should get a `429 Too Many Requests` error

### Test Password Validation

```bash
# Test with weak password
curl -X POST https://api.your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "weak"
  }'
```

**Expected response:**
```json
{
  "success": false,
  "error": "Password must be at least 8 characters long"
}
```

### Test Security Headers

```bash
curl -I https://api.your-domain.com/api/health
```

**Verify these headers exist:**
- `x-content-type-options: nosniff`
- `x-frame-options: DENY`
- `x-xss-protection: 1; mode=block`
- `strict-transport-security: max-age=31536000`
- `content-security-policy: ...`

## Step 4: Test Database Connectivity

### Check Companies

```bash
cd worker
npx wrangler d1 execute your_project_database --command="SELECT * FROM companies;"
```

**Expected**: Should list your companies including "System"

### Check Users

```bash
npx wrangler d1 execute your_project_database --command="
SELECT u.id, u.email, u.role, c.name as company 
FROM users u 
JOIN companies c ON u.company_id = c.id;
"
```

**Expected**: Should list your admin user

### Check Sessions

```bash
npx wrangler d1 execute your_project_database --command="
SELECT COUNT(*) as active_sessions 
FROM sessions 
WHERE expires_at > datetime('now');
"
```

## Step 5: Test Email Functionality

### Send Test Magic Link

1. Go to `https://dashboard.your-domain.com/login`
2. Click "Send Magic Link"
3. Enter your email
4. Check inbox for email
5. Click the magic link
6. Verify you're logged in

### Test Password Reset

```bash
curl -X POST https://api.your-domain.com/api/auth/password-reset/request \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@your-domain.com"
  }'
```

**Expected**:
- Response: `{"success": true, "message": "..."}`
- Email received with reset link

## Step 6: Test Frontend Features

### Manual Testing Checklist

Login to `https://dashboard.your-domain.com` and test:

- [ ] **Login Page**
  - [ ] Login with email/password
  - [ ] Magic link request
  - [ ] Password reset request
  - [ ] Error messages display correctly

- [ ] **Dashboard**
  - [ ] Dashboard loads after login
  - [ ] Navigation works
  - [ ] User menu in header works

- [ ] **User Management** (if master_admin)
  - [ ] View users list
  - [ ] Create new user
  - [ ] Edit user
  - [ ] Delete user (soft delete)

- [ ] **Company Management** (if master_admin)
  - [ ] View companies list
  - [ ] Create new company
  - [ ] Edit company
  - [ ] Delete company

- [ ] **Audit Logs**
  - [ ] View audit logs
  - [ ] Filter logs
  - [ ] Export logs

- [ ] **Settings**
  - [ ] Update profile
  - [ ] Change password
  - [ ] Enable 2FA
  - [ ] Update preferences

## Step 7: Test CORS Configuration

### Test from Browser Console

1. Open `https://dashboard.your-domain.com`
2. Open DevTools Console (F12)
3. Run:

```javascript
fetch('https://api.your-domain.com/api/health')
  .then(r => r.json())
  .then(data => console.log('Success:', data))
  .catch(err => console.error('CORS Error:', err));
```

**Expected**: Should log `Success: {status: "healthy", ...}`

**If CORS error**: Check `CORS_ORIGIN` secret matches frontend URL exactly

## Step 8: Monitor Worker Logs

### Watch Real-Time Logs

```bash
cd worker
npx wrangler tail
```

Keep this running and perform actions in the frontend. You should see:
- API requests
- Authentication attempts
- Errors (if any)

### Check for Errors

Look for:
- ❌ Uncaught exceptions
- ❌ Database connection errors
- ❌ Email sending failures
- ✅ Successful requests with 200 status codes

## Step 9: Performance Testing

### Test Response Times

```bash
# Test health endpoint response time
time curl https://api.your-domain.com/api/health

# Test login endpoint response time
time curl -X POST https://api.your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@your-domain.com","password":"admin123"}'
```

**Expected**: Response times under 500ms

### Test Load

```bash
# Simple load test (requires 'ab' - Apache Bench)
ab -n 100 -c 10 https://api.your-domain.com/api/health

# Or use curl in a loop
for i in {1..100}; do
  curl -s https://api.your-domain.com/api/health > /dev/null
  echo "Request $i completed"
done
```

## Step 10: Security Verification

### SSL Certificate Check

```bash
# Check SSL certificate
openssl s_client -connect api.your-domain.com:443 -servername api.your-domain.com < /dev/null

# Should show valid certificate chain
```

### Security Scan

Use online tools to scan:
- [SSL Labs](https://www.ssllabs.com/ssltest/) - Check SSL configuration
- [Security Headers](https://securityheaders.com/) - Check security headers
- [Mozilla Observatory](https://observatory.mozilla.org/) - Overall security scan

## Step 11: Create Monitoring Alerts (Optional)

### Cloudflare Workers Analytics

1. Go to **Cloudflare Dashboard** → **Workers & Pages**
2. Click on your worker
3. Go to **Metrics** tab
4. Review:
   - Request volume
   - Error rate
   - CPU time
   - Duration

### Set Up Health Check Monitoring

Use a service like:
- **UptimeRobot** (free) - https://uptimerobot.com/
- **Pingdom**
- **Cloudflare Workers** health check

Monitor:
- `https://api.your-domain.com/api/health`
- `https://dashboard.your-domain.com`

## Step 12: Backup Configuration

### Document Your Setup

Create a secure document with:

```markdown
# Production Configuration

## Domain
- Frontend: https://dashboard.your-domain.com
- API: https://api.your-domain.com

## Cloudflare
- Account ID: [your-account-id]
- Worker Name: your-project-api
- Pages Project: your-project-name
- D1 Database: your_project_database
- KV Namespace: RATE_LIMIT_KV

## Admin Account
- Email: admin@your-domain.com
- Password: [change this from default!]
- Company: [your-company-name]

## Secrets Set
- JWT_SECRET: ✓
- BREVO_API_KEY: ✓
- BREVO_WEBHOOK_SECRET: (optional)

## Deployment Date
- Initial: [date]
- Last Updated: [date]

## Team Access
- [Name] - Master Admin
- [Name] - Admin
```

## Verification Checklist

### Core Functionality
- [ ] Health check returns 200 OK
- [ ] Frontend loads correctly
- [ ] Can log in with admin account
- [ ] Magic link emails work
- [ ] Password reset emails work
- [ ] Dashboard loads after login

### Security
- [ ] SSL certificates active (A+ rating)
- [ ] Security headers present
- [ ] Rate limiting works
- [ ] Password validation works
- [ ] CORS properly configured
- [ ] Audit logs recording actions

### Database
- [ ] D1 database accessible
- [ ] All tables created
- [ ] Admin user exists
- [ ] Companies exist
- [ ] Queries execute successfully

### Email
- [ ] Brevo integration working
- [ ] Magic link emails received
- [ ] Password reset emails received
- [ ] Email templates rendering correctly
- [ ] Links in emails work

### Performance
- [ ] API response times < 500ms
- [ ] Frontend loads < 2 seconds
- [ ] No console errors
- [ ] No network errors
- [ ] Worker CPU time acceptable

## Troubleshooting Common Issues

### Issue: "Cannot connect to API"
**Solution**:
1. Check worker is deployed: `wrangler deployments list`
2. Verify DNS: `nslookup api.your-domain.com`
3. Check CORS_ORIGIN secret
4. Review worker logs: `wrangler tail`

### Issue: "Magic link emails not received"
**Solution**:
1. Check spam folder
2. Verify Brevo API key: `wrangler secret list`
3. Check Brevo account status
4. Review worker logs for email errors
5. Test Brevo API directly (see 04-BREVO-SETUP.md)

### Issue: "Rate limiting not working"
**Solution**:
1. Verify KV namespace bound: check `wrangler.toml`
2. List KV namespaces: `wrangler kv:namespace list`
3. Check KV namespace IDs match
4. Redeploy worker

### Issue: "Database errors"
**Solution**:
1. Verify D1 database exists: `wrangler d1 list`
2. Check database_id in `wrangler.toml`
3. Test query: `wrangler d1 execute DB --command="SELECT 1"`
4. Review schema was applied

## Next Steps

Your application is now deployed and verified! 

Continue to:
- [08-CUSTOMIZATION.md](./08-CUSTOMIZATION.md) - Customize branding and features
- [09-MAINTENANCE.md](./09-MAINTENANCE.md) - Ongoing maintenance tasks
- [10-SCALING.md](./10-SCALING.md) - Scaling for production use

## Emergency Contacts

Keep these handy:

- **Cloudflare Support**: https://support.cloudflare.com/
- **Brevo Support**: https://www.brevo.com/support/
- **Your Team**: [list emergency contacts]

## Success! 🎉

Your application is now live and operational. Make sure to:

1. **Change the default admin password** from `admin123`
2. **Set up monitoring** for uptime and errors
3. **Schedule regular backups** of the database
4. **Review security** settings periodically
5. **Update secrets** every 90 days

