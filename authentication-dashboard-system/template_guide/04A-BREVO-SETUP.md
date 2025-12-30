# 04 - Brevo Email Service Setup

## Overview

This template uses **Brevo (formerly Sendinblue)** for transactional emails with **inline HTML templates**. This means:

- **No Brevo templates needed** - All email templates are defined in the worker code
- **Simple setup** - Just get an API key and verify your sender
- **Full control** - Email templates are version-controlled with your code
- **Easy customization** - Edit templates directly in `worker/src/email-templates.js`

**Free Tier**: 300 emails per day

## Email Types Included

The template includes these email types (all with inline HTML templates):

| Email Type | Purpose | Template Function |
|-----------|---------|-------------------|
| Magic Link | Passwordless login with 6-digit code | `buildMagicLinkEmail()` |
| 2FA Code | Two-factor authentication codes | `build2FACodeEmail()` |
| Password Reset | Password reset links | `buildPasswordResetEmail()` |
| Email Verification | New account verification | `buildVerificationEmail()` |
| User Invitation | Invite users to company | `buildUserInvitationEmail()` |
| Admin Invitation | Invite company admins | `buildInvitationEmail()` |
| Company Welcome | Welcome new companies | `buildCompanyWelcomeEmail()` |
| PHI Access Notification | HIPAA compliance alerts | `buildPHIAccessNotificationEmail()` |

## Step 1: Create Brevo Account

1. Go to [https://www.brevo.com/](https://www.brevo.com/)
2. Click **Sign Up Free**
3. Complete registration
4. Verify your email address

## Step 2: Get API Key

1. Log into Brevo dashboard
2. Go to **Settings** (top right) → **SMTP & API**
3. Click **API Keys** tab
4. Click **Generate a new API key**
5. Name it: `Your Project Production API Key`
6. Click **Generate**
7. **Copy the API key** (you won't see it again)
8. Store it securely in a password manager

## Step 3: Verify Sender Email/Domain

For production use, you must verify your sender email or domain:

### Option A: Single Email Verification (Quick Start)

1. Go to **Senders & IP** → **Senders**
2. Click **Add a sender**
3. Enter your email (e.g., `noreply@your-domain.com`)
4. Verify the email via confirmation link sent to that address

### Option B: Domain Authentication (Recommended for Production)

1. Go to **Senders & IP** → **Domains**
2. Click **Add a domain**
3. Enter your domain: `your-domain.com`
4. Add the DNS records shown (DKIM, SPF, DMARC)
5. Wait for verification (can take a few hours)

**DNS Records to Add:**

```
# SPF Record (TXT)
Type: TXT
Name: @
Value: v=spf1 include:sendinblue.com ~all

# DKIM Record (TXT)
Type: TXT
Name: mail._domainkey
Value: [provided by Brevo]

# DMARC Record (TXT)
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@your-domain.com
```

## Step 4: Configure Sender in Worker

Update the sender configuration in `/worker/wrangler.toml`:

```toml
[vars]
# ... other vars ...
SENDER_NAME = "Your App"
SENDER_EMAIL = "noreply@your-domain.com"
```

The email service reads these from environment variables:

```javascript
// In worker/src/email.js
getSender() {
  return {
    name: this.env.SENDER_NAME || 'Your App',
    email: this.env.SENDER_EMAIL || 'app@your-domain.com'
  };
}
```

## Step 5: Test Email Configuration

Test your Brevo API key with a simple curl command:

```bash
curl -X POST "https://api.brevo.com/v3/smtp/email" \
  -H "api-key: YOUR_BREVO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sender": {"email": "noreply@your-domain.com", "name": "Your App"},
    "to": [{"email": "your-test-email@example.com"}],
    "subject": "Test Email",
    "textContent": "This is a test email from Brevo"
  }'
```

**Expected Response:**
```json
{"messageId": "<unique-message-id>"}
```

## Step 6: Set Brevo API Key as Secret

```bash
cd worker
wrangler secret put BREVO_API_KEY
# When prompted, paste your Brevo API key
```

## Step 7: Configure Webhooks (Optional)

Webhooks track email events (opens, clicks, bounces) for analytics:

1. Go to **Settings** → **Webhooks**
2. Click **Add a new webhook**
3. Enter URL: `https://api.your-domain.com/api/webhooks/email`
4. Select events:
   - Email sent
   - Email delivered
   - Email opened
   - Email clicked
   - Email bounced
   - Email failed
5. Generate a webhook secret
6. **Copy the secret** and store it securely

Set the webhook secret:

```bash
wrangler secret put BREVO_WEBHOOK_SECRET
# Enter the webhook secret
```

## Customizing Email Templates

All email templates are in `/worker/src/email-templates.js`. To customize:

### Change Brand Colors

Edit the `brandColor` in each template function:

```javascript
const brandColor = '#0194F9'; // Change to your brand color
```

### Change Logo

Add your logo URL in the HTML templates:

```html
<img src="https://your-domain.com/logo.png" alt="Your App" style="max-width: 150px;">
```

### Modify Email Content

Each template function returns `{ subject, htmlContent }`. Edit the HTML directly:

```javascript
export function buildMagicLinkEmail({ brandName, firstName, magicCode, magicLink }) {
  const brandColor = '#0194F9';

  return {
    subject: `Your ${brandName} Login Code: ${magicCode}`,
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <!-- Your custom HTML here -->
      </html>
    `
  };
}
```

## Email Templates Reference

### Magic Link Email

Sent when user requests passwordless login:
- **Subject**: "Your [Brand] Login Code: 123456"
- **Contains**: 6-digit code + clickable magic link
- **Expires**: 15 minutes

### 2FA Code Email

Sent for two-factor authentication:
- **Subject**: "Your [Brand] Verification Code"
- **Contains**: 6-digit verification code
- **Expires**: 10 minutes

### Password Reset Email

Sent when user requests password reset:
- **Subject**: "Reset Your [Brand] Password"
- **Contains**: Password reset link
- **Expires**: 1 hour

### User Invitation Email

Sent when admin invites a user:
- **Subject**: "You've been invited to join [Company]"
- **Contains**: Invitation link with token

## Verification Checklist

- [ ] Brevo account created and verified
- [ ] API key generated and saved
- [ ] Sender email or domain verified in Brevo
- [ ] `SENDER_NAME` and `SENDER_EMAIL` set in `wrangler.toml`
- [ ] `BREVO_API_KEY` set as Cloudflare secret
- [ ] Test email sent successfully
- [ ] Webhooks configured (optional)

## Troubleshooting

### Issue: "API key invalid"

**Solution**:
- Make sure you copied the full API key
- Verify the API key is set correctly: `wrangler secret list`

### Issue: "Sender not verified"

**Solution**:
- Check your email for verification link from Brevo
- Or verify the domain with DNS records

### Issue: "Daily send limit reached"

**Solution**:
- Free tier has 300 emails/day
- Upgrade plan or wait 24 hours

### Issue: "Email not delivered"

**Solution**:
1. Check Brevo dashboard → Logs for error messages
2. Verify sender email/domain is verified
3. Check spam folder
4. Ensure recipient email is valid

### Issue: "Template rendering issues"

**Solution**:
- Check `worker/src/email-templates.js` for syntax errors
- Test locally with `wrangler dev`
- Check worker logs: `wrangler tail`

## Email Rate Limits

The template includes built-in email rate limiting:

| Limit Type | Rate | Window |
|-----------|------|--------|
| Per email address | 20 emails | 5 minutes |
| Per IP address | 1000 emails | 1 hour |

These are enforced in `worker/src/email.js` to prevent abuse.

## Brevo Dashboard Monitoring

Monitor your email performance in Brevo:

1. **Logs** → View sent emails and delivery status
2. **Statistics** → See open rates, click rates, bounces
3. **Contacts** → Manage email blocklists
4. **Webhooks** → Debug webhook events

## Next Steps

Continue to [05-SECRETS-MANAGEMENT.md](./05-SECRETS-MANAGEMENT.md) to configure all Cloudflare secrets.

