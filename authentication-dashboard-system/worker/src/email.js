// Enhanced Email Service for Multi-Tenant SaaS
// Brevo integration with inline HTML templates and company-specific branding

import {
  buildMagicLinkEmail,
  buildPasswordResetEmail,
  buildVerificationEmail,
  build2FACodeEmail,
  buildInvitationEmail,
  buildCompanyWelcomeEmail,
  buildUserInvitationEmail,
  buildPHIAccessNotificationEmail
} from './email-templates.js';

// Email sender configuration
// These will be overridden by environment variables if set
const DEFAULT_SENDER = {
  name: 'Notropolis',
  email: 'no-reply@notropolis.net'
};

export class EmailService {
  constructor(env, db = null) {
    this.env = env;
    this.db = db; // Optional: for checking user status before sending emails
    // Rate limiting storage (in production, use Redis or D1)
    this.rateLimitMap = new Map();
  }

  // Get sender configuration from environment or use defaults
  getSender() {
    return {
      name: this.env.SENDER_NAME || DEFAULT_SENDER.name,
      email: this.env.SENDER_EMAIL || DEFAULT_SENDER.email
    };
  }

  // Check if user can receive emails (not archived)
  async canUserReceiveEmail(email) {
    if (!this.db) {
      // If no DB connection provided, allow (backward compatibility)
      return { canReceive: true };
    }

    try {
      const user = await this.db.getUserByEmail(email);
      if (!user) {
        return { canReceive: false, reason: 'User not found' };
      }

      if (user.deleted_at) {
        return { canReceive: false, reason: 'User account is archived' };
      }

      if (!user.is_active) {
        return { canReceive: false, reason: 'User account is inactive' };
      }

      return { canReceive: true };
    } catch (error) {
      console.error('Error checking user email eligibility:', error);
      // On error, be conservative and don't send
      return { canReceive: false, reason: 'Error checking user status' };
    }
  }

  // ==================== MAGIC LINK EMAIL ====================

  async sendMagicLink(email, firstName, companyId, ipAddress = 'unknown') {
    try {
      // Check if user can receive emails (not archived)
      const emailCheck = await this.canUserReceiveEmail(email);
      if (!emailCheck.canReceive) {
        console.log(`Email blocked for ${email}: ${emailCheck.reason}`);
        throw new Error(`Cannot send email: ${emailCheck.reason}`);
      }

      // Check rate limits
      await this.checkEmailRateLimit(email, ipAddress);
      
      // Generate magic link token
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      
      // Generate magic code for display (6 digits)
      const magicCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Get company information for branding
      const company = await this.getCompanyById(companyId);
      const brandName = this.env.BRAND_NAME || 'Your Company';
      
      // Store magic link token and code in database
      await this.updateMagicLinkToken(email, token, expiresAt.toISOString(), magicCode);
      
      // Create magic link URL (use SERVER_URL for API endpoint)
      const magicLinkUrl = `${this.env.SERVER_URL}/api/auth/magic-link?token=${token}`;

      // Build email using inline HTML template
      const template = buildMagicLinkEmail({
        brandName,
        firstName: firstName || 'User',
        magicCode,
        magicLink: magicLinkUrl
      });

      const emailData = {
        sender: this.getSender(),
        to: [{ email, name: firstName || 'User' }],
        subject: template.subject,
        htmlContent: template.htmlContent
      };
      
      // Send email via Brevo API
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.env.BREVO_API_KEY
        },
        body: JSON.stringify(emailData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Brevo API error:', errorData);
        throw new Error(`Failed to send magic link email: ${errorData.message || 'Unknown error'}`);
      }
      
      // Log email sent event
      await this.logEmailEvent('MAGIC_LINK_SENT', email, {
        companyId,
        templateType: 'magic_link',
        magicCode,
        expiresAt: expiresAt.toISOString()
      });

      // Track email event in D1 for analytics
      await this.trackEmailEvent(companyId, email, 'sent', {
        templateType: 'magic_link',
        ipAddress,
        userAgent: 'unknown'
      });
      
      return { token, magicCode, expiresAt };
    } catch (error) {
      await this.handleEmailError(error, email, 'MAGIC_LINK_SEND', companyId);
    }
  }

  // ==================== 2FA CODE EMAIL ====================

  async send2FACode(email, firstName, companyId, ipAddress = 'unknown') {
    try {
      // Check if user can receive emails (not archived)
      const emailCheck = await this.canUserReceiveEmail(email);
      if (!emailCheck.canReceive) {
        console.log(`Email blocked for ${email}: ${emailCheck.reason}`);
        throw new Error(`Cannot send email: ${emailCheck.reason}`);
      }

      // Check rate limits
      await this.checkEmailRateLimit(email, ipAddress);
      
      // Generate 2FA code (6 digits)
      const twoFactorCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Get company information for branding
      const company = await this.getCompanyById(companyId);
      const brandName = this.env.BRAND_NAME || 'Your Company';
      
      // Build email using inline HTML template
      const template = build2FACodeEmail({
        brandName,
        firstName: firstName || 'User',
        magicCode: twoFactorCode
      });

      const emailData = {
        sender: this.getSender(),
        to: [{ email, name: firstName || 'User' }],
        subject: template.subject,
        htmlContent: template.htmlContent
      };
      
      // Send email via Brevo API
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.env.BREVO_API_KEY
        },
        body: JSON.stringify(emailData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Brevo API error:', errorData);
        throw new Error(`Failed to send 2FA code email: ${errorData.message || 'Unknown error'}`);
      }
      
      // Log email sent event
      await this.logEmailEvent('2FA_CODE_SENT', email, {
        companyId,
        templateType: '2fa_code',
        twoFactorCode: '******', // Don't log actual code
        expiresAt: expiresAt.toISOString()
      });

      // Track email event in D1 for analytics
      await this.trackEmailEvent(companyId, email, 'sent', {
        templateType: '2fa_code',
        ipAddress,
        userAgent: 'unknown'
      });
      
      return { twoFactorCode, expiresAt };
    } catch (error) {
      await this.handleEmailError(error, email, '2FA_CODE_SEND', companyId);
    }
  }

  // ==================== EMAIL VERIFICATION ====================

  async sendVerificationEmail(email, firstName, companyId, ipAddress = 'unknown') {
    try {
      // Check if user can receive emails (not archived)
      const emailCheck = await this.canUserReceiveEmail(email);
      if (!emailCheck.canReceive) {
        console.log(`Email blocked for ${email}: ${emailCheck.reason}`);
        throw new Error(`Cannot send email: ${emailCheck.reason}`);
      }

      // Check rate limits
      await this.checkEmailRateLimit(email, ipAddress);
      
      // Generate verification token
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Get company information
      const company = await this.getCompanyById(companyId);
      const brandName = this.env.BRAND_NAME || 'Your Company';
      
      // Create verification URL
      const verificationUrl = `${this.env.CLIENT_URL}/verify-email?token=${token}`;

      // Build email using inline HTML template
      const template = buildVerificationEmail({
        brandName,
        firstName: firstName || 'User',
        verificationLink: verificationUrl
      });

      const emailData = {
        sender: this.getSender(),
        to: [{ email, name: firstName || 'User' }],
        subject: template.subject,
        htmlContent: template.htmlContent
      };
      
      // Send email via Brevo API
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.env.BREVO_API_KEY
        },
        body: JSON.stringify(emailData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to send verification email: ${errorData.message || 'Unknown error'}`);
      }
      
      // Log email sent event
      await this.logEmailEvent('VERIFICATION_EMAIL_SENT', email, {
        companyId,
        templateType: 'verification',
        expiresAt: expiresAt.toISOString()
      });

      // Track email event in D1 for analytics
      await this.trackEmailEvent(companyId, email, 'sent', {
        templateType: 'verification',
        ipAddress,
        userAgent: 'unknown'
      });
      
      return { token, expiresAt };
    } catch (error) {
      await this.handleEmailError(error, email, 'VERIFICATION_EMAIL_SEND', companyId);
    }
  }

  // ==================== PASSWORD RESET EMAIL ====================

  async sendPasswordResetEmail(email, firstName, companyId, ipAddress = 'unknown') {
    try {
      // Check if user can receive emails (not archived)
      const emailCheck = await this.canUserReceiveEmail(email);
      if (!emailCheck.canReceive) {
        console.log(`Email blocked for ${email}: ${emailCheck.reason}`);
        throw new Error(`Cannot send email: ${emailCheck.reason}`);
      }

      // Check rate limits
      await this.checkEmailRateLimit(email, ipAddress);
      
      // Generate reset token
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      // Get company information
      const company = await this.getCompanyById(companyId);
      const brandName = this.env.BRAND_NAME || 'Your Company';
      
      // Create reset URL
      const resetUrl = `${this.env.CLIENT_URL}/reset-password?token=${token}`;

      // Build email using inline HTML template
      const template = buildPasswordResetEmail({
        brandName,
        firstName: firstName || 'User',
        resetPasswordLink: resetUrl
      });

      const emailData = {
        sender: this.getSender(),
        to: [{ email, name: firstName || 'User' }],
        subject: template.subject,
        htmlContent: template.htmlContent
      };
      
      // Send email via Brevo API
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.env.BREVO_API_KEY
        },
        body: JSON.stringify(emailData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to send password reset email: ${errorData.message || 'Unknown error'}`);
      }
      
      // Log email sent event
      await this.logEmailEvent('PASSWORD_RESET_EMAIL_SENT', email, {
        companyId,
        templateType: 'password_reset',
        expiresAt: expiresAt.toISOString()
      });

      // Track email event in D1 for analytics
      await this.trackEmailEvent(companyId, email, 'sent', {
        templateType: 'password_reset',
        ipAddress,
        userAgent: 'unknown'
      });
      
      return { token, expiresAt };
    } catch (error) {
      await this.handleEmailError(error, email, 'PASSWORD_RESET_EMAIL_SEND', companyId);
    }
  }

  // ==================== COMPANY NOTIFICATION EMAILS ====================

  async sendCompanyWelcomeEmail(email, firstName, companyName, adminName) {
    try {
      const welcomeUrl = `${this.env.CLIENT_URL}/welcome?company=${encodeURIComponent(companyName)}`;
      const brandName = this.env.BRAND_NAME || 'Your App';

      // Build email using inline HTML template
      const template = buildCompanyWelcomeEmail({
        brandName,
        firstName: firstName || 'User',
        companyName,
        welcomeLink: welcomeUrl
      });

      const emailData = {
        sender: this.getSender(),
        to: [{ email, name: firstName }],
        subject: template.subject,
        htmlContent: template.htmlContent
      };

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.env.BREVO_API_KEY
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        throw new Error('Failed to send welcome email');
      }

      return true;
    } catch (error) {
      console.error('Welcome email error:', error);
      throw error;
    }
  }

  async sendUserInvitationEmail(email, firstName, companyName, inviterName, invitationToken = null) {
    try {
      // Use token if provided (more secure), otherwise fall back to email
      const invitationUrl = invitationToken
        ? `${this.env.CLIENT_URL}/accept-invitation?token=${invitationToken}`
        : `${this.env.CLIENT_URL}/accept-invitation?email=${encodeURIComponent(email)}`;
      const brandName = this.env.BRAND_NAME || 'Your App';

      // Build email using inline HTML template
      const template = buildUserInvitationEmail({
        brandName,
        firstName: firstName || 'User',
        companyName,
        inviterName: inviterName || 'A team member',
        invitationLink: invitationUrl
      });

      const emailData = {
        sender: this.getSender(),
        to: [{ email, name: firstName }],
        subject: template.subject,
        htmlContent: template.htmlContent
      };

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.env.BREVO_API_KEY
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        throw new Error('Failed to send invitation email');
      }

      return true;
    } catch (error) {
      console.error('Invitation email error:', error);
      throw error;
    }
  }

  // Send admin invitation (72-hour expiry)
  async sendAdminInvitationEmail(email, firstName, companyName, invitationToken, companyId = null) {
    try {
      // Create invitation link with token that expires in 72 hours
      const invitationLink = `${this.env.CLIENT_URL}/accept-invitation?token=${invitationToken}`;
      const brandName = this.env.BRAND_NAME || 'Your App';

      // Build email using inline HTML template
      const template = buildInvitationEmail({
        brandName,
        firstName: firstName || 'Admin',
        companyName,
        invitationLink
      });

      const emailData = {
        sender: this.getSender(),
        to: [{ email, name: firstName || 'Admin' }],
        subject: template.subject,
        htmlContent: template.htmlContent
      };

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.env.BREVO_API_KEY
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Brevo API error:', errorData);
        throw new Error(`Failed to send admin invitation email: ${errorData.message || 'Unknown error'}`);
      }

      // Log email sent event
      await this.logEmailEvent('ADMIN_INVITATION_SENT', email, {
        companyId,
        companyName,
        templateType: 'admin_invitation',
        invitationToken
      });

      return { success: true, invitationLink };
    } catch (error) {
      console.error('Admin invitation email error:', error);
      throw error;
    }
  }

  // ==================== HIPAA COMPLIANCE EMAILS ====================

  async sendPHIAccessNotification(email, firstName, companyName, accessLevel) {
    try {
      const notificationUrl = `${this.env.CLIENT_URL}/phi-access-notification`;
      const brandName = this.env.BRAND_NAME || 'Your App';

      // Build email using inline HTML template
      const template = buildPHIAccessNotificationEmail({
        brandName,
        firstName: firstName || 'User',
        companyName,
        accessLevel,
        notificationLink: notificationUrl
      });

      const emailData = {
        sender: this.getSender(),
        to: [{ email, name: firstName }],
        subject: template.subject,
        htmlContent: template.htmlContent
      };

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.env.BREVO_API_KEY
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        throw new Error('Failed to send PHI access notification');
      }

      return true;
    } catch (error) {
      console.error('PHI notification email error:', error);
      throw error;
    }
  }

  // ==================== ERROR HANDLING ====================

  async handleEmailError(error, email, action, companyId = null) {
    console.error(`Email error for ${action}:`, error);
    
    // Enhanced error categorization for multi-tenant SaaS
    const errorTypes = {
      'RATE_LIMIT_EXCEEDED': 'Rate limit exceeded. Please try again later.',
      'INVALID_EMAIL': 'Invalid email address provided.',
      'TEMPLATE_NOT_FOUND': 'Email template not found. Please contact support.',
      'API_KEY_INVALID': 'Email service configuration error. Please contact support.',
      'NETWORK_ERROR': 'Network error. Please try again later.',
      'UNKNOWN_ERROR': 'Failed to send email. Please try again later.'
    };
    
    let errorType = 'UNKNOWN_ERROR';
    let userMessage = errorTypes.UNKNOWN_ERROR;
    
    if (error.message.includes('rate limit')) {
      errorType = 'RATE_LIMIT_EXCEEDED';
      userMessage = errorTypes.RATE_LIMIT_EXCEEDED;
    } else if (error.message.includes('Invalid email')) {
      errorType = 'INVALID_EMAIL';
      userMessage = errorTypes.INVALID_EMAIL;
    } else if (error.message.includes('template')) {
      errorType = 'TEMPLATE_NOT_FOUND';
      userMessage = errorTypes.TEMPLATE_NOT_FOUND;
    } else if (error.message.includes('API key')) {
      errorType = 'API_KEY_INVALID';
      userMessage = errorTypes.API_KEY_INVALID;
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      errorType = 'NETWORK_ERROR';
      userMessage = errorTypes.NETWORK_ERROR;
    }
    
    // Log to audit system with HIPAA compliance
    if (typeof globalThis.db !== 'undefined') {
      await globalThis.db.logAuditEvent(
        null, // userId - system error
        companyId,
        'EMAIL_ERROR',
        'EMAIL',
        email,
        {
          action,
          errorType,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        },
        'system',
        'email-service',
        null, // session_id
        0, // phi_accessed = false for system errors
        'system'
      );
    }
    
    // Return user-friendly error
    throw new Error(userMessage);
  }

  // ==================== UTILITY METHODS ====================

  async testEmailConnection() {
    try {
      const response = await fetch('https://api.brevo.com/v3/account', {
        headers: {
          'api-key': this.env.BREVO_API_KEY
        }
      });
      
      if (response.ok) {
        const accountInfo = await response.json();
        console.log('Brevo connection successful:', accountInfo);
        return true;
      } else {
        throw new Error('Failed to connect to Brevo API');
      }
    } catch (error) {
      console.error('Brevo connection test failed:', error);
      throw error;
    }
  }

  async getEmailStatistics() {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/statistics', {
        headers: {
          'api-key': this.env.BREVO_API_KEY
        }
      });
      
      if (response.ok) {
        return await response.json();
      } else {
        throw new Error('Failed to get email statistics');
      }
    } catch (error) {
      console.error('Email statistics error:', error);
      throw error;
    }
  }

  // ==================== DATABASE INTEGRATION ====================

  async updateMagicLinkToken(email, token, expiresAt, code = null) {
    // This would integrate with your Database class
    // For now, we'll assume it's available globally
    if (typeof globalThis.db !== 'undefined') {
      const user = await globalThis.db.getUserByEmail(email);
      if (user) {
        await globalThis.db.updateMagicLinkToken(user.id, token, expiresAt, code);
      }
    }
  }

  async getCompanyById(companyId) {
    // This would integrate with your Database class
    if (typeof globalThis.db !== 'undefined') {
      return await globalThis.db.getCompanyById(companyId);
    }
    return null;
  }

  async logEmailEvent(eventType, email, details) {
    // Skip audit logging for now - D1 foreign key constraints don't handle null userId well
    // In the future, we can create a system user account to use for these events
    console.log(`Email event logged: ${eventType} for ${email}`, details);
  }

  // ==================== RATE LIMITING ====================

  async checkEmailRateLimit(email, ipAddress = 'unknown') {
    const now = Date.now();
    const emailKey = `email:${email}`;
    const ipKey = `ip:${ipAddress}`;
    
    // Rate limits for multi-tenant SaaS system
    const limits = {
      email: { max: 20, window: 5 * 60 * 1000 }, // 20 emails per 5 minutes per email
      ip: { max: 1000, window: 60 * 60 * 1000 },   // 1000 emails per hour per IP (server environment)
      global: { max: 5000, window: 60 * 60 * 1000 } // 5000 emails per hour globally
    };
    
    // Check email rate limit
    if (!this.rateLimitMap.has(emailKey)) {
      this.rateLimitMap.set(emailKey, []);
    }
    
    const emailRequests = this.rateLimitMap.get(emailKey);
    const validEmailRequests = emailRequests.filter(time => now - time < limits.email.window);
    
    if (validEmailRequests.length >= limits.email.max) {
      throw new Error('Email rate limit exceeded. Please try again later.');
    }
    
    // Check IP rate limit
    if (!this.rateLimitMap.has(ipKey)) {
      this.rateLimitMap.set(ipKey, []);
    }
    
    const ipRequests = this.rateLimitMap.get(ipKey);
    const validIpRequests = ipRequests.filter(time => now - time < limits.ip.window);
    
    if (validIpRequests.length >= limits.ip.max) {
      throw new Error('IP rate limit exceeded. Please try again later.');
    }
    
    // Update rate limit counters
    validEmailRequests.push(now);
    validIpRequests.push(now);
    this.rateLimitMap.set(emailKey, validEmailRequests);
    this.rateLimitMap.set(ipKey, validIpRequests);
    
    return true;
  }

  async getRateLimitStatus(email, ipAddress = 'unknown') {
    const now = Date.now();
    const emailKey = `email:${email}`;
    const ipKey = `ip:${ipAddress}`;
    
    const emailRequests = this.rateLimitMap.get(emailKey) || [];
    const ipRequests = this.rateLimitMap.get(ipKey) || [];
    
    const validEmailRequests = emailRequests.filter(time => now - time < 5 * 60 * 1000);
    const validIpRequests = ipRequests.filter(time => now - time < 60 * 60 * 1000);
    
    return {
      email: {
        used: validEmailRequests.length,
        limit: 20,
        remaining: Math.max(0, 20 - validEmailRequests.length),
        resetTime: validEmailRequests.length > 0 ? 
          new Date(validEmailRequests[0] + 5 * 60 * 1000).toISOString() : null
      },
      ip: {
        used: validIpRequests.length,
        limit: 1000,
        remaining: Math.max(0, 1000 - validIpRequests.length),
        resetTime: validIpRequests.length > 0 ? 
          new Date(validIpRequests[0] + 60 * 60 * 1000).toISOString() : null
      }
    };
  }

  // ==================== EMAIL TEMPLATE MANAGEMENT ====================

  async getTemplateInfo(templateId) {
    try {
      const response = await fetch(`https://api.brevo.com/v3/smtp/templates/${templateId}`, {
        headers: {
          'api-key': this.env.BREVO_API_KEY
        }
      });
      
      if (response.ok) {
        return await response.json();
      } else {
        throw new Error('Failed to get template info');
      }
    } catch (error) {
      console.error('Template info error:', error);
      throw error;
    }
  }

  async validateTemplatePlaceholders(templateId) {
    try {
      const template = await this.getTemplateInfo(templateId);
      
      // Define required placeholders for each template type
      const templateRequirements = {
        181: ['BRANDNAME', 'FIRSTNAME', 'MAGICCODE', 'MAGICLINK'], // Magic Link
        182: ['BRANDNAME', 'RESETPASSWORDLINK'], // Password Reset
        183: ['BRANDNAME', 'FIRSTNAME', 'VERIFICATIONLINK'] // Email Verification
      };
      
      const requiredPlaceholders = templateRequirements[templateId] || [];
      const templateContent = template.htmlContent || template.textContent || '';
      
      const missingPlaceholders = requiredPlaceholders.filter(
        placeholder => !templateContent.includes(`{{ params.${placeholder} }}`)
      );
      
      const extraPlaceholders = [];
      const allPlaceholders = templateContent.match(/\{\{ params\.(\w+) \}\}/g) || [];
      allPlaceholders.forEach(placeholder => {
        const cleanPlaceholder = placeholder.replace(/\{\{ params\.(\w+) \}\}/, '$1');
        if (!requiredPlaceholders.includes(cleanPlaceholder)) {
          extraPlaceholders.push(cleanPlaceholder);
        }
      });
      
      if (missingPlaceholders.length > 0) {
        console.warn(`Template ${templateId} missing required placeholders:`, missingPlaceholders);
      }
      
      if (extraPlaceholders.length > 0) {
        console.info(`Template ${templateId} has extra placeholders:`, extraPlaceholders);
      }
      
      return {
        templateId,
        templateName: template.name,
        hasAllPlaceholders: missingPlaceholders.length === 0,
        missingPlaceholders,
        extraPlaceholders,
        requiredPlaceholders,
        validationStatus: missingPlaceholders.length === 0 ? 'VALID' : 'INVALID',
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      console.error('Template validation error:', error);
      throw error;
    }
  }

  async validateAllTemplates() {
    const templates = [
      { id: 181, name: 'Magic Link' },
      { id: 182, name: 'Password Reset' },
      { id: 183, name: 'Email Verification' }
    ];
    
    const results = [];
    
    for (const template of templates) {
      try {
        const validation = await this.validateTemplatePlaceholders(template.id);
        results.push({
          ...validation,
          templateName: template.name
        });
      } catch (error) {
        results.push({
          templateId: template.id,
          templateName: template.name,
          validationStatus: 'ERROR',
          error: error.message,
          lastChecked: new Date().toISOString()
        });
      }
    }
    
    return {
      totalTemplates: templates.length,
      validTemplates: results.filter(r => r.validationStatus === 'VALID').length,
      invalidTemplates: results.filter(r => r.validationStatus === 'INVALID').length,
      errorTemplates: results.filter(r => r.validationStatus === 'ERROR').length,
      templates: results,
      lastChecked: new Date().toISOString()
    };
  }

  // ==================== EMAIL EVENT TRACKING ====================

  async trackEmailEvent(companyId, userEmail, eventType, eventData = {}) {
    try {
      // Use env.DB for raw D1 queries
      if (!this.env.DB) {
        console.log('No DB binding available for email event tracking');
        return;
      }

      await this.env.DB.prepare(`
        INSERT INTO email_events (
          company_id, user_email, event_type, event_data, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        companyId,
        userEmail,
        eventType,
        JSON.stringify(eventData),
        new Date().toISOString()
      ).run();

      // Log audit event if db instance available
      if (this.db && this.db.logAuditEvent) {
        await this.db.logAuditEvent(
          null, companyId, 'EMAIL_EVENT_TRACKED', 'EMAIL', userEmail,
          { eventType, eventData },
          eventData.ipAddress || 'unknown',
          eventData.userAgent || 'unknown'
        );
      }
    } catch (error) {
      console.error('Failed to track email event:', error);
      // Don't throw error to avoid breaking email sending
    }
  }
}
