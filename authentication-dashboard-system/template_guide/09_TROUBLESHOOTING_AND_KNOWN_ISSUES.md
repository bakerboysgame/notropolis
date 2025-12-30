# 09. Troubleshooting and Known Issues

This document covers problems encountered during production deployment that weren't addressed in the initial setup guide.

## 1. Cloudflare API Token Authentication Issues

### Problem
When using the API token for deployments, you may encounter:
```
Error: A request to the Cloudflare API (/memberships) failed.
Authentication error [code: 10000]
```

### Solution
- Use `wrangler login` for OAuth authentication instead of API token for initial setup
- API tokens work for most operations but may lack permissions for certain endpoints
- Ensure your API token has the following permissions:
  - Account:Cloudflare Workers Scripts:Edit
  - Account:Cloudflare Pages:Edit
  - Account:Cloudflare D1:Edit
  - Account:Workers KV Storage:Edit

## 2. Database Schema Missing Columns

### Problem
After initial database setup, you may encounter errors like:
```
D1_ERROR: no such column: magic_link_code: SQLITE_ERROR
D1_ERROR: no such column: related_company_id: SQLITE_ERROR
```

### Solution
Add missing columns to the database:
```bash
# Add magic_link_code to users table
wrangler d1 execute contact_buddy_database --command="ALTER TABLE users ADD COLUMN magic_link_code TEXT;" --remote

# Add related columns to audit_logs
wrangler d1 execute contact_buddy_database --command="ALTER TABLE audit_logs ADD COLUMN related_company_id TEXT;" --remote
wrangler d1 execute contact_buddy_database --command="ALTER TABLE audit_logs ADD COLUMN related_user_id TEXT;" --remote

# Add session tracking columns
wrangler d1 execute contact_buddy_database --command="ALTER TABLE sessions ADD COLUMN user_agent TEXT;" --remote
wrangler d1 execute contact_buddy_database --command="ALTER TABLE sessions ADD COLUMN ip_address TEXT;" --remote
wrangler d1 execute contact_buddy_database --command="ALTER TABLE sessions ADD COLUMN browser TEXT;" --remote
wrangler d1 execute contact_buddy_database --command="ALTER TABLE sessions ADD COLUMN os TEXT;" --remote
wrangler d1 execute contact_buddy_database --command="ALTER TABLE sessions ADD COLUMN device_name TEXT;" --remote
```

## 3. Password Format Issues

### Problem
Login fails with "Invalid credentials" even with correct password due to format mismatch.

### Details
The system uses SHA-256 with salt format: `salt:hashedPassword`
- Salt: UUID format (e.g., `12345678-90ab-cdef-ghij-klmnopqrstuv`)
- Hash: SHA-256 of `salt + password`

### Solution
When setting passwords directly in the database:
1. Generate a UUID salt
2. Compute SHA-256 hash of salt + password
3. Store as `salt:hash`

Example:
```javascript
const salt = '12345678-90ab-cdef-ghij-klmnopqrstuv';
const password = 'admin123';
const hash = sha256(salt + password); // Use crypto.subtle.digest
const dbPassword = `${salt}:${hash}`;
```

## 4. EmailService Database Connection Error

### Problem
Magic link emails fail with:
```
Failed to send email: Cannot read properties of undefined (reading 'getUserByEmail')
```

### Root Cause
EmailService trying to use `globalThis.db` instead of instance database.

### Solution
1. Pass database instance to EmailService constructor:
```javascript
const emailService = new EmailService(env, db);  // Added db parameter
```

2. Update EmailService to use `this.db` instead of `globalThis.db`

## 5. Worker Deployment Database Binding Issues

### Problem
API calls fail with:
```
Cannot read properties of undefined (reading 'prepare')
```

### Root Cause
Worker loses database bindings after certain changes or deployments.

### Solution
Re-deploy the worker to restore bindings:
```bash
cd worker
CLOUDFLARE_API_TOKEN="your-token" wrangler deploy
```

### Prevention
- Always deploy from the worker directory
- Verify bindings are shown in deployment output
- Test health endpoint after deployment

## 6. Pages Deployment Permission Issues

### Problem
Automated Pages deployment fails in CI/CD:
```
Error: You must be logged in to deploy a Pages project
```

### Root Cause
API token lacks permissions for Pages deployments (known Cloudflare limitation).

### Workaround
Manual deployment script or use `wrangler login` for OAuth:
```bash
npm run build
CLOUDFLARE_API_TOKEN="your-token" npx wrangler pages deploy dist \
  --project-name=contact-buddy-dashboard \
  --branch=main
```

## 7. Magic Link Redirects to Login Instead of Dashboard

### Problem
When clicking a magic link email, users are redirected to `/login` instead of being logged in via the Dashboard.

### Root Cause
`ProtectedPageRoute` was immediately redirecting unauthenticated users to `/login` before the Dashboard component could process the JWT token from the URL.

### Solution
The fix requires two components:

**1. ProtectedPageRoute.tsx** - Allow magic link tokens through:

```typescript
import { useSearchParams } from 'react-router-dom';

// Inside the component:
const [searchParams] = useSearchParams();
const tokenFromUrl = searchParams.get('token');

// Before the auth check, allow tokens through:
if (tokenFromUrl) {
  return <>{children}</>;  // Let Dashboard process the token
}

// Then check authentication
if (!token || !user) {
  return <Navigate to="/login" replace />;
}
```

**2. DashboardPage.tsx** - Process the token from URL:

```typescript
const [searchParams, setSearchParams] = useSearchParams();
const navigate = useNavigate();
const { refreshUser } = useAuth();
const [processingToken, setProcessingToken] = useState(false);

// Handle magic link token from URL
useEffect(() => {
  const token = searchParams.get('token');
  if (token && !processingToken) {
    setProcessingToken(true);
    // IMPORTANT: Clear any existing auth state first to avoid conflicts
    apiHelpers.clearToken();
    // Then store the new token
    apiHelpers.setToken(token);
    // Refresh user data from AuthContext
    refreshUser().then(() => {
      // Clear the token from URL after successful refresh
      setSearchParams({}, { replace: true }); // Use React Router, not window.history
      setProcessingToken(false);
    }).catch(() => {
      setProcessingToken(false);
      navigate('/login', { replace: true });
    });
  }
}, [searchParams, setSearchParams, navigate, refreshUser, processingToken]);

// Show loading state while processing magic link token
if (processingToken || searchParams.get('token')) {
  return <LoadingSpinner message="Signing you in..." />;
}
```

**Key points:**
- Use `setSearchParams` instead of `window.history.replaceState` (React Router needs to know the URL changed)
- Clear existing auth before setting new token to avoid conflicts
- Add `processingToken` state to prevent double-processing

**Magic link flow:**
1. User clicks magic link → API returns 302 redirect to Dashboard with `?token=JWT`
2. ProtectedPageRoute detects token and allows request through
3. Dashboard extracts token, stores it, refreshes user, clears URL

## 8. 2FA Test Bypass in Production

### Problem
Development code contains 2FA bypass for testing:
```javascript
if (code === '123456' && user.email === 'test@example.com') {
  // REMOVE IN PRODUCTION
}
```

### Solution
Remove all test bypasses before production deployment:
1. Search for `// TEMPORARY` or `// REMOVE IN PRODUCTION` comments
2. Remove test bypass code blocks
3. Re-deploy worker

## 9. Email Not Sending

### Problem
Email sending fails or emails are not received.

### Solution
This template uses **inline HTML templates**, so no Brevo template IDs are needed!

Check these items:
1. **BREVO_API_KEY** is set correctly: `wrangler secret list`
2. **Sender email/domain** is verified in Brevo dashboard
3. **SENDER_NAME** and **SENDER_EMAIL** are set in `wrangler.toml`

Test Brevo API directly:
```bash
curl -X POST "https://api.brevo.com/v3/smtp/email" \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sender": {"email": "noreply@your-domain.com"},
    "to": [{"email": "test@example.com"}],
    "subject": "Test",
    "textContent": "Test email"
  }'
```

## 10. Company Name Updates

### Problem
Default company created with wrong name.

### Solution
```sql
UPDATE companies SET name = 'Your Company Name'
WHERE id = 'your-company-id';
```

## 11. Rate Limiting Not Implemented

### Current State
- KV namespace configured but rate limiting logic not implemented
- Configuration exists but not enforced

### To Implement
Add rate limiting logic to auth endpoints:
```javascript
// Check rate limit before processing
const rateLimitKey = `login:${clientIP}`;
const attempts = await env.RATE_LIMIT_KV.get(rateLimitKey);
if (attempts > env.RATE_LIMIT_LOGIN) {
  return new Response('Too many attempts', { status: 429 });
}
```

## 12. Monitoring Setup Missing

### Recommendation
Set up monitoring services:
- UptimeRobot for uptime monitoring
- Cloudflare Analytics for traffic insights
- Error tracking service (Sentry, etc.)

## 13. Database Backup Strategy

### Current State
No automated backups configured for D1 database.

### Recommendation
- Schedule regular D1 exports
- Store backups in R2 or external service
- Test restore procedures

## Common Deployment Commands

### Quick Reference
```bash
# Deploy worker
cd worker && wrangler deploy

# Deploy frontend
npm run build && npm run deploy

# Check database
wrangler d1 execute your_project_database \
  --command="SELECT COUNT(*) FROM users;" --remote

# View logs
cd worker && npx wrangler tail

# Test health endpoint
curl https://api.your-domain.com/api/health
```

## Debug Checklist

When encountering issues:
1. ✓ Check worker logs with `wrangler tail`
2. ✓ Verify database connection with health endpoint
3. ✓ Confirm environment variables and secrets are set
4. ✓ Check CORS configuration matches frontend domain
5. ✓ Verify JWT_SECRET is consistent across deployments
6. ✓ Ensure database schema matches code expectations
7. ✓ Confirm worker has proper D1 and KV bindings

---
Document created: December 2024
Based on: Production deployment experience