// Brevo Webhook Handler for Multi-Tenant SaaS
// Real-time email event processing with domain filtering

// ==================== BREVO WEBHOOK HANDLER ====================

export async function handleBrevoWebhook(request, analyticsService, authService) {
  try {
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Parse webhook payload
    const webhookData = await request.json();
    
    // Verify webhook signature for security (temporarily disabled for testing)
    const signature = request.headers.get('X-Brevo-Signature');
    if (signature && !verifyBrevoWebhookSignature(webhookData, signature, analyticsService.env)) {
      console.error('Invalid Brevo webhook signature');
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Log webhook receipt for debugging
    console.log('Webhook received:', {
      event: webhookData.event,
      email: webhookData.email,
      hasSignature: !!signature
    });

    // Extract webhook data (Brevo format)
    const { 
      event, 
      email, 
      date, 
      ts, 
      ts_event, 
      ts_epoch,
      message_id,
      subject,
      template_id,
      contact_id,
      tags,
      user_agent,
      device_used,
      link,
      sending_ip,
      X_Mailin_custom,
      mirror_link
    } = webhookData;
    
    // TAG FILTERING: Only process events with your company tag
    if (!isOurDomainEmail(webhookData)) {
      console.log(`Ignoring webhook event - no company tag found`);
      return new Response('OK - Tag filtered', { status: 200 });
    }

    // Find which company this email belongs to
    const user = await analyticsService.database.getUserByEmail(email);
    if (!user) {
      console.log(`No user found for email: ${email}`);
      return new Response('OK - User not found', { status: 200 });
    }

    // Map Brevo event to our event type
    const eventType = mapBrevoEventToEventType(event);
    if (!eventType) {
      console.log(`Unmapped Brevo event: ${event}`);
      return new Response('OK - Event not mapped', { status: 200 });
    }

    // Store event in D1 immediately
    try {
      console.log('Attempting to store event:', {
        companyId: user.company_id,
        email: email,
        eventType: eventType,
        user: user
      });
      
      await analyticsService.trackEmailEvent(
        user.company_id, 
        email, 
        eventType, 
        {
          timestamp: ts_event || ts_epoch || new Date().toISOString(),
          brevoEvent: event,
          messageId: message_id,
          subject: subject,
          templateId: template_id,
          contactId: contact_id,
          tags: tags || [],
          userAgent: user_agent || 'unknown',
          deviceUsed: device_used || 'unknown',
          link: link || null,
          sendingIp: sending_ip || 'unknown',
          customHeader: X_Mailin_custom || null,
          mirrorLink: mirror_link || null,
          source: 'brevo_webhook',
          date: date,
          ts: ts,
          tsEpoch: ts_epoch
        }
      );
      
      console.log('Event stored successfully');
    } catch (error) {
      console.error('Error storing email event:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        companyId: user.company_id,
        email: email,
        eventType: eventType
      });
      throw error;
    }

    console.log(`Processed webhook event: ${event} for ${email} in company ${user.company_id}`);

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Brevo webhook error:', error);
    return new Response('Error processing webhook', { status: 500 });
  }
}

// ==================== WEBHOOK HELPER FUNCTIONS ====================

function verifyBrevoWebhookSignature(payload, signature, env) {
  try {
    if (!signature || !env.BREVO_WEBHOOK_SECRET) {
      console.warn('Missing webhook signature or secret');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', env.BREVO_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return signature === expectedSignature;
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return false;
  }
}

function isOurDomainEmail(webhookData) {
  // Check if the email has your company tag (configure this tag in Brevo)
  const tags = webhookData.tags || [];
  const companyTag = process.env.BRAND_NAME?.toLowerCase().replace(/\s+/g, '-') || 'your-company';
  const hasCompanyTag = tags.includes(companyTag);
  
  console.log(`Checking tags: ${JSON.stringify(tags)} - Has company tag (${companyTag}): ${hasCompanyTag}`);
  return hasCompanyTag;
}

function mapBrevoEventToEventType(brevoEvent) {
  // Map Brevo transactional webhook events to our internal event types
  const eventMapping = {
    // Email events from Brevo documentation
    'request': 'sent',                    // Email sent
    'click': 'clicked',                   // Link clicked
    'deferred': 'deferred',              // Email deferred
    'delivered': 'delivered',             // Email delivered
    'soft_bounce': 'soft_bounced',        // Soft bounce
    'spam': 'spam',                       // Marked as spam
    'first_open': 'first_opened',         // First time opened
    'open': 'opened',                     // Email opened
    'hard_bounce': 'hard_bounced',        // Hard bounce
    'invalid_email': 'invalid_email',     // Invalid email address
    'blocked': 'blocked',                 // Email blocked
    'error': 'error',                     // Email error
    'unsub': 'unsubscribed',             // Unsubscribed
    'proxy_open': 'proxy_opened',         // Proxy open
    'unique_proxy_open': 'unique_proxy_opened' // Unique proxy open
  };
  
  return eventMapping[brevoEvent] || null;
}
