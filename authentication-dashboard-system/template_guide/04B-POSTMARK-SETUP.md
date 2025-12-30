# 04B - Postmark Email Service Setup

## Overview

This template supports **Postmark** as an alternative to Brevo for transactional emails. Postmark offers:

- **Excellent deliverability** - Industry-leading inbox placement
- **Built-in tracking** - Opens, clicks, bounces tracked automatically
- **Webhook events** - Real-time delivery and engagement notifications
- **Simple API** - Clean REST API with clear error messages
- **Full control** - Email templates are in your code, version-controlled

**Free Tier**: 100 emails/month (development servers)
**Paid**: Starts at $15/month for 10,000 emails

## When to Choose Postmark

Choose Postmark if you need:
- Better email deliverability
- Built-in open/click tracking
- Webhook events for email analytics
- Inbound email processing (for ticketing systems, etc.)

Choose Brevo if you need:
- Higher free tier (300 emails/day)
- Marketing email features
- Lower cost at scale

## Email Types Included

Same templates work for both Brevo and Postmark:

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

## Step 1: Create Postmark Account

1. Go to [https://postmarkapp.com/](https://postmarkapp.com/)
2. Click **Start Free Trial** or **Sign Up**
3. Complete registration
4. Verify your email address

## Step 2: Create a Server

1. Log into Postmark dashboard
2. Click **Servers** in the top navigation
3. Click **Create Server**
4. Name it (e.g., `Your App Production`)
5. Select **Live** for production (or **Test** for development)
6. Click **Create Server**

## Step 3: Get Server API Token

1. Click on your new server
2. Go to **API Tokens** tab
3. Copy the **Server API Token**
4. Store it securely in a password manager

**Important**: This is your `POSTMARK_SERVER_TOKEN`

## Step 4: Verify Sender Domain (Recommended)

For production, verify your sending domain:

1. Go to **Sender Signatures** in Postmark
2. Click **Add Domain or Address**
3. Choose **Add Domain** (recommended for production)
4. Enter your domain: `your-domain.com`
5. Add the DNS records shown:

**DNS Records to Add:**

```
# DKIM Record (TXT)
Type: TXT
Name: [prefix]._domainkey
Value: [provided by Postmark]

# Return-Path (CNAME) - for bounce handling
Type: CNAME
Name: pm-bounces
Value: pm.mtasv.net
```

6. Click **Verify** after adding DNS records

### Alternative: Single Email Verification (Quick Start)

For development or quick testing:

1. Go to **Sender Signatures**
2. Click **Add Domain or Address**
3. Choose **Add Sender Signature**
4. Enter your email (e.g., `app@your-domain.com`)
5. Verify via confirmation email

## Step 5: Switch to Postmark Email Service

Replace the email service import in your worker:

**Option A: Rename the file**

```bash
cd worker/src

# Backup existing Brevo email service
mv email.js email-brevo.js

# Use Postmark email service
mv email-postmark.js email.js
```

**Option B: Update the import**

Edit `worker/src/index.js` (or wherever EmailService is imported):

```javascript
// Change this:
import { EmailService } from './email.js';

// To this:
import { EmailService } from './email-postmark.js';
```

## Step 6: Configure Sender in Worker

Update the sender configuration in `/worker/wrangler.toml`:

```toml
[vars]
# ... other vars ...
SENDER_NAME = "Your App"
SENDER_EMAIL = "app@your-domain.com"
```

The Postmark email service reads these from environment variables:

```javascript
// In worker/src/email-postmark.js
getSenderAddress() {
  const name = this.env.SENDER_NAME || 'Your App';
  const email = this.env.SENDER_EMAIL || 'app@your-domain.com';
  return `${name} <${email}>`;
}
```

## Step 7: Set Postmark Server Token as Secret

```bash
cd worker
wrangler secret put POSTMARK_SERVER_TOKEN
# When prompted, paste your Postmark Server API Token
```

## Step 8: Test Email Configuration

Test your Postmark API token with a simple curl command:

```bash
curl -X POST "https://api.postmarkapp.com/email" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "X-Postmark-Server-Token: YOUR_POSTMARK_SERVER_TOKEN" \
  -d '{
    "From": "Your App <app@your-domain.com>",
    "To": "your-test-email@example.com",
    "Subject": "Test Email",
    "TextBody": "This is a test email from Postmark"
  }'
```

**Expected Response:**
```json
{
  "To": "your-test-email@example.com",
  "SubmittedAt": "2024-01-15T10:30:00.0000000-05:00",
  "MessageID": "b7bc2f4a-e38e-4336-af7d-e6c392c2f817",
  "ErrorCode": 0,
  "Message": "OK"
}
```

## Step 9: Configure Webhooks (Optional but Recommended)

Postmark webhooks track email events (opens, clicks, bounces) for analytics:

1. Go to your server in Postmark
2. Click **Webhooks** tab
3. Click **Add webhook**
4. Enter URL: `https://api.your-domain.com/api/webhooks/postmark/events`
5. Select event types:
   - Delivery
   - Bounce
   - Spam Complaint
   - Open
   - Click
6. Click **Save webhook**

**Webhook Handler Example:**

```javascript
// In worker/src/index.js
router.post('/api/webhooks/postmark/events', async (request, env) => {
  try {
    const event = await request.json();

    // Extract metadata from the event
    const metadata = event.Metadata || {};
    const emailType = metadata.email_type;
    const companyId = metadata.company_id;

    // Store event in database
    await env.DB.prepare(`
      INSERT INTO email_events (company_id, user_email, event_type, event_data, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      companyId,
      event.Recipient,
      event.RecordType,
      JSON.stringify(event),
      new Date().toISOString()
    ).run();

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Error', { status: 500 });
  }
});
```

## Postmark Features

### Open & Click Tracking

Postmark automatically tracks opens and clicks when enabled:

```javascript
const postmarkPayload = {
  // ... other fields
  TrackOpens: true,
  TrackLinks: 'HtmlAndText',  // or 'HtmlOnly', 'TextOnly', 'None'
};
```

### Metadata

Attach custom data to emails for webhook correlation:

```javascript
Metadata: {
  email_type: 'magic_link',
  company_id: 'company-123',
  user_email: 'user@example.com'
}
```

This metadata is returned in all webhook events, making it easy to correlate events with your application data.

### Message Streams

Postmark supports separate streams for transactional and broadcast emails:

```javascript
MessageStream: 'outbound',     // Default transactional stream
MessageStream: 'broadcast',    // For marketing/bulk emails (requires setup)
```

## Customizing Email Templates

Same as Brevo - all templates are in `/worker/src/email-templates.js`. The template functions return `{ subject, htmlContent }` which works with both providers.

## Email Rate Limits

The template includes built-in email rate limiting:

| Limit Type | Rate | Window |
|-----------|------|--------|
| Per email address | 20 emails | 5 minutes |
| Per IP address | 1000 emails | 1 hour |

## Postmark Dashboard Monitoring

Monitor your email performance in Postmark:

1. **Activity** - View sent emails and delivery status
2. **Stats** - See delivery rates, opens, clicks, bounces
3. **Bounce Processing** - Automatic bounce handling
4. **Suppressions** - Manage suppressed addresses

## Verification Checklist

- [ ] Postmark account created
- [ ] Server created (Live for production)
- [ ] Server API Token generated and saved
- [ ] Sender domain or email verified
- [ ] Email service switched to `email-postmark.js`
- [ ] `SENDER_NAME` and `SENDER_EMAIL` set in `wrangler.toml`
- [ ] `POSTMARK_SERVER_TOKEN` set as Cloudflare secret
- [ ] Test email sent successfully
- [ ] Webhooks configured (optional)

## Troubleshooting

### Issue: "Invalid Server Token"

**Solution**:
- Make sure you copied the full Server API Token (not Account Token)
- Verify the token is set correctly: `wrangler secret list`
- Ensure you're using the correct server's token

### Issue: "Sender not verified"

**Solution**:
- Check Postmark dashboard for pending verifications
- Verify DNS records are correctly added
- Wait for DNS propagation (can take up to 48 hours)

### Issue: "Email rejected"

**Solution**:
1. Check Postmark Activity for the specific error
2. Common reasons:
   - Inactive recipient (previously bounced)
   - Sender signature not verified
   - Content flagged as spam

### Issue: "Email not delivered"

**Solution**:
1. Check Postmark Activity → Outbound for status
2. Look for bounce or complaint events
3. Check recipient's spam folder
4. Verify sender domain has proper DNS records

### Issue: "Webhook not receiving events"

**Solution**:
1. Check webhook URL is publicly accessible
2. Verify webhook is enabled in Postmark
3. Check worker logs: `wrangler tail`
4. Ensure the endpoint returns 200 OK

## Migrating from Brevo to Postmark

1. **Create Postmark account and server** (Steps 1-3)
2. **Verify sender domain** (Step 4)
3. **Set up the secret**: `wrangler secret put POSTMARK_SERVER_TOKEN`
4. **Switch the email service** (Step 5)
5. **Deploy**: `wrangler deploy`
6. **Configure webhooks** (Step 9)
7. **Remove old Brevo secret**: `wrangler secret delete BREVO_API_KEY` (optional)

## Next Steps

Continue to [05-SECRETS-MANAGEMENT.md](./05-SECRETS-MANAGEMENT.md) to configure all Cloudflare secrets.
