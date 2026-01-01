// Email Template Builder Functions for Notropolis
// Uses inline HTML instead of Brevo template IDs

/**
 * Build Magic Link email (replaces template 181)
 * @param {Object} params
 * @param {string} params.brandName - Brand name (e.g., "Your App")
 * @param {string} params.firstName - User's first name
 * @param {string} params.magicCode - 6-digit code for mobile app
 * @param {string} params.magicLink - Full login URL
 * @returns {Object} { subject, htmlContent }
 */
export function buildMagicLinkEmail({ brandName, firstName, magicCode, magicLink }) {
  return {
    subject: `Your Magic Link to sign in to ${brandName}`,
    htmlContent: `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; font-size: 16px; color: #333; line-height: 1.5;">
    <p>Hi ${firstName},</p><br>

    <p>Here's your magic link to sign in to your ${brandName} account.</p><br>

    <p>It's quick, secure, and will expire in 15 minutes for your safety.</p><br>

    <p>If you are logging in via the mobile app, please use this code: <b>${magicCode}</b></p>
    <br>

    <a href="${magicLink}" target="_blank" style="background-color:#0194F9; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block; margin-top:16px; margin-bottom:16px;">
      Sign in to your account
    </a><br><br>

    <p>If the button doesn't work, just copy and paste this link into your browser:</p><br>

    <p><a href="${magicLink}" target="_blank">${magicLink}</a></p><br>

    <p>If you didn't request this link, feel free to ignore this email.</p><br>

    <p>Cheers,</p><br>

    <p>The ${brandName} Team</p>
  </body>
</html>`
  };
}

/**
 * Build Password Reset email (replaces template 182)
 * @param {Object} params
 * @param {string} params.brandName - Brand name (e.g., "Your App")
 * @param {string} params.firstName - User's first name
 * @param {string} params.resetPasswordLink - Password reset URL
 * @returns {Object} { subject, htmlContent }
 */
export function buildPasswordResetEmail({ brandName, firstName, resetPasswordLink }) {
  return {
    subject: `Reset your password for ${brandName}`,
    htmlContent: `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; font-size: 16px; color: #333; line-height: 1.5;">
    <p>Hi ${firstName},</p><br>

    <p>We received a request to reset the password for your ${brandName} account.</p><br>

    <p>Click the button below to choose a new password.</p><br>

    <p>This link will expire in 1 hour for your security.</p><br>

    <a href="${resetPasswordLink}" target="_blank" style="background-color:#0194F9; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block; margin-top:16px; margin-bottom:16px;">
      Reset Your Password
    </a><br><br>

    <p>If the button doesn't work, just copy and paste this link into your browser:</p><br>

    <p><a href="${resetPasswordLink}" target="_blank">${resetPasswordLink}</a></p><br>

    <p>If you didn't request a password reset, you can safely ignore this email.</p><br>

    <p>All the best,</p><br>

    <p>The ${brandName} Team</p>
  </body>
</html>`
  };
}

/**
 * Build Email Verification email (replaces template 183)
 * @param {Object} params
 * @param {string} params.brandName - Brand name (e.g., "Your App")
 * @param {string} params.firstName - User's first name
 * @param {string} params.verificationLink - Email verification URL
 * @returns {Object} { subject, htmlContent }
 */
export function buildVerificationEmail({ brandName, firstName, verificationLink }) {
  return {
    subject: `Almost there ${firstName}! Verify your email for ${brandName}`,
    htmlContent: `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; font-size: 16px; color: #333; line-height: 1.5;">
    <p>Hi ${firstName},</p><br>

    <p>You're just one step away from unlocking everything ${brandName} has to offer.</p><br>

    <p>Click the button below to verify your email address and get started:</p><br>

    <a href="${verificationLink}" target="_blank" style="background-color:#0194F9; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block; margin-top:16px; margin-bottom:16px;">
      Verify My Email
    </a><br><br>

    <p>If the button doesn't work, just copy and paste this link into your browser:</p><br>

    <p><a href="${verificationLink}" target="_blank">${verificationLink}</a></p><br>

    <p>If you didn't sign up for ${brandName}, feel free to ignore this message.</p><br>

    <p>See you inside,</p><br>

    <p>The ${brandName} Team</p>
  </body>
</html>`
  };
}

/**
 * Build 2FA Code email (replaces template 185)
 * @param {Object} params
 * @param {string} params.brandName - Brand name (e.g., "Your App")
 * @param {string} params.firstName - User's first name
 * @param {string} params.magicCode - 6-digit verification code
 * @returns {Object} { subject, htmlContent }
 */
export function build2FACodeEmail({ brandName, firstName, magicCode }) {
  return {
    subject: `Your Verification Code to sign in to ${brandName}`,
    htmlContent: `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; font-size: 16px; color: #333; line-height: 1.5;">
    <p>Hi ${firstName},</p><br>

    <p>Your verification code to sign in to your ${brandName} account.</p><br>

    <p>It's quick, secure, and will expire in 15 minutes for your safety.</p><br>

    <b>${magicCode}</b><br><br>

    <p>If you didn't request this link, feel free to ignore this email.</p><br>

    <p>Cheers,</p><br>

    <p>The ${brandName} Team</p>
  </body>
</html>`
  };
}

/**
 * Build Admin Invitation email (replaces template 187)
 * @param {Object} params
 * @param {string} params.brandName - Brand name (e.g., "Your App")
 * @param {string} params.firstName - Invited user's first name
 * @param {string} params.companyName - Company name
 * @param {string} params.invitationLink - Invitation acceptance URL
 * @param {string} [params.supportEmail] - Support email address (optional)
 * @returns {Object} { subject, htmlContent }
 */
export function buildInvitationEmail({ brandName, firstName, companyName, invitationLink, supportEmail = 'support@notropolis.net' }) {
  return {
    subject: `You've been invited to ${brandName} as a ${companyName} Admin`,
    htmlContent: `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; font-size: 16px; color: #333; line-height: 1.5;">
    <p>Hi ${firstName},</p><br>

    <p>You've been invited to join <b>${brandName}</b> as an <b>Admin</b> for <b>${companyName}</b>.</p><br>

    <p>Click below to accept your invitation and set up your account.</p><br>

    <a href="${invitationLink}" target="_blank" style="background-color:#0194F9; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block; margin-top:16px; margin-bottom:16px;">
      Accept Invitation
    </a><br><br>

    <p>If the button doesn't work, copy and paste this link into your browser:</p><br>

    <p><a href="${invitationLink}" target="_blank">${invitationLink}</a></p><br>

    <p>This link expires in 72 hours. Contact ${brandName} at ${supportEmail} for a new link after this time.</p><br>

    <p>If you weren't expecting this invitation, you can safely ignore this email.</p><br>

    <p>Cheers,</p><br>

    <p>The ${brandName} Team</p>
  </body>
</html>`
  };
}

/**
 * Build Company Welcome email (custom template for new company admins)
 * @param {Object} params
 * @param {string} params.brandName - Brand name (e.g., "Your App")
 * @param {string} params.firstName - User's first name
 * @param {string} params.companyName - Company name
 * @param {string} params.welcomeLink - Welcome/onboarding URL
 * @returns {Object} { subject, htmlContent }
 */
export function buildCompanyWelcomeEmail({ brandName, firstName, companyName, welcomeLink }) {
  return {
    subject: `Welcome to ${brandName}, ${firstName}!`,
    htmlContent: `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; font-size: 16px; color: #333; line-height: 1.5;">
    <p>Hi ${firstName},</p><br>

    <p>Welcome to <b>${brandName}</b>! Your company <b>${companyName}</b> is all set up and ready to go.</p><br>

    <p>Click the button below to get started:</p><br>

    <a href="${welcomeLink}" target="_blank" style="background-color:#0194F9; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block; margin-top:16px; margin-bottom:16px;">
      Get Started
    </a><br><br>

    <p>If the button doesn't work, just copy and paste this link into your browser:</p><br>

    <p><a href="${welcomeLink}" target="_blank">${welcomeLink}</a></p><br>

    <p>We're excited to have you on board!</p><br>

    <p>Cheers,</p><br>

    <p>The ${brandName} Team</p>
  </body>
</html>`
  };
}

/**
 * Build User Invitation email (for inviting regular users to a company)
 * @param {Object} params
 * @param {string} params.brandName - Brand name (e.g., "Your App")
 * @param {string} params.firstName - Invited user's first name
 * @param {string} params.companyName - Company name
 * @param {string} params.inviterName - Name of person who sent the invitation
 * @param {string} params.invitationLink - Invitation acceptance URL
 * @returns {Object} { subject, htmlContent }
 */
export function buildUserInvitationEmail({ brandName, firstName, companyName, inviterName, invitationLink }) {
  return {
    subject: `${inviterName} invited you to join ${companyName} on ${brandName}`,
    htmlContent: `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; font-size: 16px; color: #333; line-height: 1.5;">
    <p>Hi ${firstName},</p><br>

    <p><b>${inviterName}</b> has invited you to join <b>${companyName}</b> on <b>${brandName}</b>.</p><br>

    <p>Click below to accept your invitation and set up your account.</p><br>

    <a href="${invitationLink}" target="_blank" style="background-color:#0194F9; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block; margin-top:16px; margin-bottom:16px;">
      Accept Invitation
    </a><br><br>

    <p>If the button doesn't work, copy and paste this link into your browser:</p><br>

    <p><a href="${invitationLink}" target="_blank">${invitationLink}</a></p><br>

    <p>This link expires in 72 hours.</p><br>

    <p>If you weren't expecting this invitation, you can safely ignore this email.</p><br>

    <p>Cheers,</p><br>

    <p>The ${brandName} Team</p>
  </body>
</html>`
  };
}

/**
 * Build PHI Access Notification email (for HIPAA compliance)
 * @param {Object} params
 * @param {string} params.brandName - Brand name (e.g., "Your App")
 * @param {string} params.firstName - User's first name
 * @param {string} params.companyName - Company name
 * @param {string} params.accessLevel - PHI access level granted
 * @param {string} params.notificationLink - Link to view notification details
 * @returns {Object} { subject, htmlContent }
 */
export function buildPHIAccessNotificationEmail({ brandName, firstName, companyName, accessLevel, notificationLink }) {
  return {
    subject: `PHI Access Level Updated - ${brandName}`,
    htmlContent: `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; font-size: 16px; color: #333; line-height: 1.5;">
    <p>Hi ${firstName},</p><br>

    <p>Your PHI (Protected Health Information) access level at <b>${companyName}</b> has been updated.</p><br>

    <p><b>New Access Level:</b> ${accessLevel.toUpperCase()}</p><br>

    <p>This change affects your ability to view and manage patient health information within ${brandName}.</p><br>

    <a href="${notificationLink}" target="_blank" style="background-color:#0194F9; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block; margin-top:16px; margin-bottom:16px;">
      View Details
    </a><br><br>

    <p>If you did not expect this change, please contact your administrator immediately.</p><br>

    <p>Cheers,</p><br>

    <p>The ${brandName} Team</p>
  </body>
</html>`
  };
}
