# 08 - Customization Guide

## Overview

This guide covers customizing the template for your brand and specific use case.

## Part 1: Branding

### 1.1 Update Application Name

**File**: `/src/config/environment.ts`

```typescript
export const config = {
  APP_NAME: 'Your Application Name',
  APP_DESCRIPTION: 'Your application description',
  // ...
}
```

**File**: `/index.html`

```html
<title>Your Application Name</title>
<meta name="description" content="Your application description" />
```

### 1.2 Update Brand Colors

**File**: `/src/config/environment.ts`

```typescript
export const config = {
  COLORS: {
    PRIMARY: '#0194F9',    // Your primary brand color
    WHITE: '#FFFFFF',
    GRAY: '#666666',
  }
}
```

**File**: `/tailwind.config.js`

Update the entire color scheme:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f7ff',
          100: '#bae7ff',
          200: '#91d5ff',
          300: '#69c0ff',
          400: '#40a9ff',
          500: '#1890ff',  // Main primary color
          600: '#0194F9',  // Your brand color
          700: '#096dd9',
          800: '#0050b3',
          900: '#003a8c',
        },
        // Add more custom colors as needed
      }
    }
  }
}
```

### 1.3 Update Logo and Favicon

**Replace these files:**

- `/public/favicon.ico`
- `/public/favicon-16x16.png`
- `/public/favicon-32x32.png`
- `/public/android-chrome-192x192.png`
- `/public/android-chrome-512x512.png`
- `/public/apple-touch-icon.png`

**Generate favicons:**
- Use [Favicon Generator](https://realfavicongenerator.net/)
- Upload your logo
- Download and replace files

### 1.4 Update Application Logo

**File**: `/src/components/Sidebar.tsx`

Find and update the logo section:

```tsx
<div className="flex items-center gap-2 px-4 py-6">
  <img src="/logo.png" alt="Your Brand" className="w-8 h-8" />
  <h1 className="text-xl font-bold text-gray-900">Your Brand</h1>
</div>
```

Add your logo to `/public/logo.png`

### 1.5 Update Email Branding

**File**: `/worker/wrangler.toml`

```toml
BRAND_NAME = "Your Brand Name"
```

Update Brevo email templates (see [04-BREVO-SETUP.md](./04-BREVO-SETUP.md)) with your brand colors and logo.

## Part 2: Feature Customization

### 2.1 Feature Flags

**File**: `/src/config/environment.ts`

```typescript
export const config = {
  FEATURES: {
    MAGIC_LINK: true,           // Enable/disable magic link auth
    TWO_FACTOR: true,            // Enable/disable 2FA
    COMPANY_MANAGEMENT: true,    // Enable/disable multi-tenant features
    AUDIT_LOGGING: true,         // Enable/disable audit logs
    EMAIL_VERIFICATION: true,    // Require email verification
    PASSWORD_RESET: true,        // Allow password resets
  }
}
```

### 2.2 Disable Multi-Tenant Features

If you don't need multi-company support:

1. **Hide company management UI**:

```typescript
// src/config/environment.ts
FEATURES: {
  COMPANY_MANAGEMENT: false,  // Disable company features
}
```

2. **Simplify user creation**:
   - Users will all belong to a single default company
   - Remove company selection from UI

3. **Update database**:
   - Keep the companies table (required for schema)
   - Create one default company
   - All users join this company

### 2.3 Change User Roles

**File**: `/worker/src/database.js` and `/src/services/api.ts`

Find role definitions and update:

```javascript
// Current roles:
role IN ('master_admin', 'admin', 'analyst', 'viewer', 'user')

// Customize to your needs:
role IN ('admin', 'manager', 'employee', 'guest')
```

Update everywhere role checks occur:
- Database schema
- Worker auth logic
- Frontend type definitions
- UI role selectors

### 2.4 Customize Rate Limits

**File**: `/worker/wrangler.toml`

```toml
[vars]
# Login rate limiting
RATE_LIMIT_LOGIN = "20"              # Max login attempts
RATE_LIMIT_LOGIN_WINDOW = "900"     # Time window in seconds (15 min)

# API rate limiting
RATE_LIMIT_API = "100"               # Max API requests
RATE_LIMIT_API_WINDOW = "60"        # Time window in seconds (1 min)

# Session timeout
SESSION_IDLE_TIMEOUT = "1800000"    # 30 minutes in milliseconds
SESSION_TIMEOUT = "3600000"         # 1 hour in milliseconds
```

### 2.5 JWT Token Expiration

**File**: `/worker/wrangler.toml`

```toml
JWT_EXPIRES_IN = "24h"  # Options: "1h", "24h", "7d", "30d"
```

## Part 3: UI Customization

### 3.1 Update Navigation

**File**: `/src/components/Sidebar.tsx`

Customize navigation items:

```tsx
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Analytics', href: '/analytics', icon: BarChart },
  { name: 'Your Custom Page', href: '/custom', icon: YourIcon },
  // Add/remove items as needed
];
```

### 3.2 Customize Dashboard

**File**: `/src/pages/Dashboard.tsx`

Replace example charts and metrics with your data:

```tsx
// Remove placeholder/example content
// Add your own metrics, charts, and widgets
// The default template includes sample stats for:
// - Revenue, Customers, Work Orders, Completion Rate
// Customize these for your specific use case
```

### 3.3 Update Footer

**File**: `/src/components/Layout.tsx` or create a `Footer.tsx`

```tsx
<footer className="bg-white border-t border-gray-200 py-4">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <p className="text-center text-gray-500 text-sm">
      © 2024 Your Company Name. All rights reserved.
    </p>
  </div>
</footer>
```

### 3.4 Customize Login Page

**File**: `/src/components/auth/LoginForm.tsx`

Update messaging and styling:

```tsx
<h2 className="text-3xl font-bold text-gray-900">
  Welcome to Your Application
</h2>
<p className="mt-2 text-gray-600">
  Sign in to access your custom features
</p>
```

## Part 4: Security Customization

### 4.1 Password Requirements

**File**: `/worker/src/security.js`

Find `validatePassword()` and customize:

```javascript
validatePassword(password) {
  const minLength = 10;  // Change from 8
  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters`);
  }
  
  // Add custom requirements
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain uppercase letter');
  }
  
  // Add more rules as needed
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
```

### 4.2 Session Duration

**File**: `/worker/wrangler.toml`

```toml
SESSION_TIMEOUT = "7200000"  # 2 hours
SESSION_IDLE_TIMEOUT = "3600000"  # 1 hour
```

### 4.3 HIPAA Compliance

If you don't need HIPAA compliance:

**File**: `/worker/src/database.js`

Remove or simplify:
- PHI access level checks
- Data classification
- Extra audit logging

**File**: Database schema

You can ignore these fields but keep them in schema:
- `phi_access_level`
- `data_classification`
- `hipaa_compliant`

## Part 5: Email Template Customization

This template uses **inline HTML templates** defined in `/worker/src/email-templates.js`. No Brevo template IDs are needed.

### 5.1 Update Email Sender

**File**: `/worker/wrangler.toml`

```toml
[vars]
SENDER_NAME = "Your Company Name"
SENDER_EMAIL = "noreply@your-domain.com"
```

### 5.2 Customize Email Templates

**File**: `/worker/src/email-templates.js`

Edit the template functions directly:

```javascript
export function buildMagicLinkEmail({ brandName, firstName, magicCode, magicLink }) {
  const brandColor = '#0194F9'; // Change to your brand color

  return {
    subject: `Your ${brandName} Login Code: ${magicCode}`,
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <!-- Add your logo -->
        <img src="https://your-domain.com/logo.png" alt="${brandName}" />

        <!-- Your custom content -->
        <h1>Welcome, ${firstName}!</h1>
        <p>Your login code is: <strong>${magicCode}</strong></p>

        <!-- Custom styled button -->
        <a href="${magicLink}" style="background: ${brandColor}; color: white; padding: 12px 24px;">
          Log In
        </a>

        <!-- Custom footer -->
        <p>© 2024 Your Company. All rights reserved.</p>
      </body>
      </html>
    `
  };
}
```

### 5.3 Available Email Templates

Customize these functions in `/worker/src/email-templates.js`:

| Function | Purpose |
|----------|---------|
| `buildMagicLinkEmail()` | Passwordless login with code |
| `build2FACodeEmail()` | Two-factor authentication codes |
| `buildPasswordResetEmail()` | Password reset links |
| `buildVerificationEmail()` | Email verification |
| `buildUserInvitationEmail()` | User invitations |
| `buildInvitationEmail()` | Admin invitations |
| `buildCompanyWelcomeEmail()` | Company welcome emails |
| `buildPHIAccessNotificationEmail()` | PHI access alerts |

### 5.4 Add Custom Email Types

To add a new email type:

1. Add template function in `/worker/src/email-templates.js`:

```javascript
export function buildCustomEmail({ brandName, firstName, customData }) {
  const brandColor = '#0194F9';

  return {
    subject: `${brandName} - Your Custom Subject`,
    htmlContent: `<!-- Your HTML here -->`
  };
}
```

2. Import and use in `/worker/src/email.js`:

```javascript
import { buildCustomEmail } from './email-templates.js';

async sendCustomEmail(email, firstName, customData) {
  const template = buildCustomEmail({
    brandName: this.env.BRAND_NAME,
    firstName,
    customData
  });

  const emailData = {
    sender: this.getSender(),
    to: [{ email, name: firstName }],
    subject: template.subject,
    htmlContent: template.htmlContent
  };

  // Send via Brevo API
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': this.env.BREVO_API_KEY
    },
    body: JSON.stringify(emailData)
  });
}

## Part 6: Analytics Customization

### 6.1 Remove Email Analytics

If you don't need Brevo analytics:

**Files to modify:**
- `/worker/analytics_handlers.js` - Remove or simplify
- `/worker/index.js` - Remove analytics routes
- Database - Keep tables (they won't grow if unused)

### 6.2 Add Custom Analytics

**Create**: `/worker/src/custom_analytics.js`

```javascript
export class CustomAnalytics {
  constructor(env, db) {
    this.env = env;
    this.db = db;
  }
  
  async track(event, data) {
    // Your custom analytics logic
    await this.db.execute(`
      INSERT INTO custom_events (event, data, timestamp)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, [event, JSON.stringify(data)]);
  }
}
```

Add to database schema:

```sql
CREATE TABLE custom_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  data TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Part 7: Domain-Specific Customization

### 7.1 Healthcare/Medical

Keep HIPAA features:
- Audit logging
- PHI access controls
- Data classification
- Retention policies

### 7.2 E-commerce

Add features:
- Product catalog tables
- Order management
- Payment integration
- Customer tracking

### 7.3 SaaS Application

Add features:
- Subscription management
- Usage tracking
- Billing integration
- Plan limits

### 7.4 Internal Tool

Simplify:
- Remove public-facing features
- Simplify user management
- Add internal workflows
- Connect to internal systems

## Part 8: Performance Optimization

### 8.1 Enable Caching

**File**: `/worker/index.js`

Add caching for static data:

```javascript
// Cache public data
const cacheKey = `cache:${path}`;
const cached = await env.RATE_LIMIT_KV.get(cacheKey);

if (cached) {
  return new Response(cached, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300'
    }
  });
}

// ... fetch data ...

await env.RATE_LIMIT_KV.put(cacheKey, JSON.stringify(data), {
  expirationTtl: 300  // 5 minutes
});
```

### 8.2 Database Indexes

Add custom indexes for your queries:

```sql
-- Example: Index for frequent lookups
CREATE INDEX idx_custom_field ON users(custom_field);
```

### 8.3 Lazy Loading

**File**: Frontend components

```tsx
// Lazy load heavy components
const Analytics = lazy(() => import('./pages/Analytics'));
const Reports = lazy(() => import('./pages/Reports'));
```

## Part 9: Integration

### 9.1 Add External APIs

**File**: `/worker/src/integrations/your_api.js`

```javascript
export class YourAPIIntegration {
  constructor(env) {
    this.apiKey = env.YOUR_API_KEY;
    this.baseUrl = 'https://api.your-service.com';
  }
  
  async fetchData() {
    const response = await fetch(`${this.baseUrl}/endpoint`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    return response.json();
  }
}
```

### 9.2 Webhooks

Add webhook receivers:

```javascript
// In worker/index.js
if (path === '/api/webhooks/your-service') {
  return handleYourServiceWebhook(request, env);
}
```

## Part 10: Testing Customizations

### 10.1 Test Locally

```bash
# Frontend
npm run dev

# Worker
cd worker
npx wrangler dev
```

### 10.2 Test Build

```bash
npm run build
```

Check for:
- TypeScript errors
- Build warnings
- Bundle size

### 10.3 Test Deployment

```bash
# Deploy to preview first
npm run deploy:preview
cd worker && npx wrangler deploy --env preview
```

Test thoroughly before deploying to production.

## Customization Checklist

- [ ] Brand name updated everywhere
- [ ] Colors customized
- [ ] Logo and favicons replaced
- [ ] Email templates customized
- [ ] Feature flags configured
- [ ] UI navigation updated
- [ ] Dashboard customized
- [ ] Security settings adjusted
- [ ] Roles customized (if needed)
- [ ] Rate limits configured
- [ ] Domain references updated
- [ ] Tested locally
- [ ] Tested in preview environment
- [ ] Documentation updated

## Next Steps

After customization:

1. **Test thoroughly** in preview environment
2. **Update documentation** with your customizations
3. **Train your team** on new features
4. **Deploy to production** when ready
5. **Monitor** for issues after deployment

## Additional Resources

- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [React TypeScript Docs](https://react-typescript-cheatsheet.netlify.app/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Brevo API Docs](https://developers.brevo.com/)

