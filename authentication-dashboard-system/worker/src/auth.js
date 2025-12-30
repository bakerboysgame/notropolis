// Enhanced Authentication Service for Multi-Tenant SaaS
// Includes company management, HIPAA compliance, and comprehensive audit logging

import { generateJWT, verifyJWT } from './jwt.js';
import * as OTPAuth from 'otpauth';

export class AuthService {
  constructor(db, env) {
    this.db = db;
    this.env = env;
  }

  // ==================== AUTHENTICATION METHODS ====================

  async login(email, password, twoFactorToken = null, request = null) {
    // Get user from database with company context
    const user = await this.db.getUserByEmail(email);
    if (!user) {
      // Log failed login attempt
      if (request) {
        await this.db.logAuditEvent(
          null, null, 'FAILED_LOGIN', 'USER', email,
          { email, reason: 'User not found' },
          this.getClientIP(request), this.getUserAgent(request)
        );
      }
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (!user.is_active) {
      if (request) {
        await this.db.logAuditEvent(
          user.id, user.company_id, 'FAILED_LOGIN', 'USER', user.id,
          { email, reason: 'Account deactivated' },
          this.getClientIP(request), this.getUserAgent(request)
        );
      }
      throw new Error('Account is deactivated');
    }

    // Check if user is archived
    if (user.deleted_at) {
      if (request) {
        await this.db.logAuditEvent(
          user.id, user.company_id, 'FAILED_LOGIN', 'USER', user.id,
          { email, reason: 'Account archived' },
          this.getClientIP(request), this.getUserAgent(request)
        );
      }
      throw new Error('Account has been archived and cannot login');
    }

    // Check if user has a password set (invitation-based users may not have one)
    if (!user.password || user.password === '' || user.password === null) {
      if (request) {
        await this.db.logAuditEvent(
          user.id, user.company_id, 'FAILED_LOGIN', 'USER', user.id,
          { email, reason: 'No password set' },
          this.getClientIP(request), this.getUserAgent(request)
        );
      }
      throw new Error('No password set. Please use Magic Link login or set a password in Settings.');
    }

    // Verify password
    const isValidPassword = await this.db.verifyPassword(password, user.password);
    if (!isValidPassword) {
      if (request) {
        await this.db.logAuditEvent(
          user.id, user.company_id, 'FAILED_LOGIN', 'USER', user.id,
          { email, reason: 'Invalid password' },
          this.getClientIP(request), this.getUserAgent(request)
        );
      }
      throw new Error('Invalid credentials');
    }

    // Check if user is soft-deleted and reactivate
    if (user.deleted_at) {
      await this.db.updateUser(user.id, { 
        deleted_at: null, 
        is_active: 1,
        updated_at: new Date().toISOString()
      });
    }

    // MANDATORY 2FA: All logins require email-based 2FA code
    // Password validation successful - now require 2FA code
    return {
      requiresTwoFactor: true,
      userId: user.id,
      email: user.email,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        companyId: user.company_id
      }
    };

    // NOTE: The actual login completion happens in verify2FACode()
    // This code below is unreachable but kept for reference
    // Generate JWT token with company context
    const isMobile = this.detectMobileClient(request);
    const token = await generateJWT({
      userId: user.id,
      companyId: user.company_id,
      role: user.role,
      phiAccessLevel: user.phi_access_level,
      isMobile
    }, this.env);
    
    // Update last login timestamp
    await this.db.updateUser(user.id, { 
      last_login: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Create session with device info
    const expiresAt = new Date(Date.now() + (isMobile ? 90 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString();
    const deviceInfo = this.parseDeviceInfo(request);
    await this.db.createSession(user.id, token, expiresAt, isMobile, deviceInfo);

    // Get company information
    const company = await this.db.getCompanyById(user.company_id);

    // Log successful login with HIPAA compliance
    if (request) {
      await this.db.logAuditEvent(
        user.id, user.company_id, 'LOGIN', 'USER', user.id,
        { 
          method: 'password',
          isMobile,
          phiAccessLevel: user.phi_access_level,
          dataClassification: user.data_classification
        },
        this.getClientIP(request), this.getUserAgent(request),
        null, // session_id will be set by createSession
        user.phi_access_level !== 'none' ? 1 : 0,
        user.data_classification
      );
    }

    return {
      token,
      user: this.sanitizeUser(user),
      company: this.sanitizeCompany(company)
    };
  }

  async verifyMagicLink(token, request = null) {
    // Verify magic link token
    const user = await this.db.verifyMagicLinkToken(token);
    if (!user) {
      if (request) {
        await this.db.logAuditEvent(
          null, null, 'FAILED_MAGIC_LINK', 'USER', 'unknown',
          { token, reason: 'Invalid or expired magic link' },
          this.getClientIP(request), this.getUserAgent(request)
        );
      }
      throw new Error('Invalid or expired magic link');
    }

    // Generate JWT token with company context
    const isMobile = this.detectMobileClient(request);
    const jwtToken = await generateJWT({
      userId: user.id,
      companyId: user.company_id,
      role: user.role,
      phiAccessLevel: user.phi_access_level,
      isMobile
    }, this.env);
    
    // Create session with device info
    const expiresAt = new Date(Date.now() + (isMobile ? 90 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString();
    const deviceInfo = this.parseDeviceInfo(request);
    await this.db.createSession(user.id, jwtToken, expiresAt, isMobile, deviceInfo);

    // Clear magic link token
    await this.db.clearMagicLinkToken(user.id);

    // Get company information
    const company = await this.db.getCompanyById(user.company_id);

    // Log successful magic link login with HIPAA compliance
    if (request) {
      await this.db.logAuditEvent(
        user.id, user.company_id, 'LOGIN', 'USER', user.id,
        { 
          method: 'magic_link',
          isMobile,
          phiAccessLevel: user.phi_access_level,
          dataClassification: user.data_classification
        },
        this.getClientIP(request), this.getUserAgent(request),
        null, // session_id will be set by createSession
        user.phi_access_level !== 'none' ? 1 : 0,
        user.data_classification
      );
    }

    return {
      token: jwtToken,
      user: this.sanitizeUser(user),
      company: this.sanitizeCompany(company)
    };
  }

  /**
   * Verify magic link 6-digit code
   * @param {string} email - User email
   * @param {string} code - 6-digit verification code
   * @param {Request} request - HTTP request for audit logging
   * @returns {Promise<{token: string, user: object, company: object}>}
   */
  async verifyMagicLinkCode(email, code, request = null) {
    // Verify code matches user and not expired
    const user = await this.db.verifyMagicLinkCode(email, code);
    
    if (!user) {
      // Audit log failed attempt
      if (request) {
        await this.db.logAuditEvent(
          null, null, 'FAILED_MAGIC_CODE', 'USER', email,
          { code: '******', reason: 'Invalid or expired code' },
          this.getClientIP(request), this.getUserAgent(request)
        );
      }
      throw new Error('Invalid or expired verification code');
    }

    // Generate JWT token (same as magic link)
    const isMobile = this.detectMobileClient(request);
    const jwtToken = await generateJWT({
      userId: user.id,
      companyId: user.company_id,
      role: user.role,
      phiAccessLevel: user.phi_access_level,
      isMobile
    }, this.env);
    
    // Create session with device info
    const expiresAt = new Date(Date.now() + (isMobile ? 90 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString();
    const deviceInfo = this.parseDeviceInfo(request);
    await this.db.createSession(user.id, jwtToken, expiresAt, isMobile, deviceInfo);

    // Update last login
    await this.db.updateUser(user.id, { 
      last_login: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Clear magic link token AND code
    await this.db.clearMagicLinkToken(user.id);

    // Get company information
    const company = await this.db.getCompanyById(user.company_id);

    // Audit log successful login via magic code
    if (request) {
      await this.db.logAuditEvent(
        user.id, user.company_id, 'LOGIN_MAGIC_CODE', 'USER', user.id,
        { 
          method: 'magic_code',
          isMobile,
          phiAccessLevel: user.phi_access_level,
          dataClassification: user.data_classification
        },
        this.getClientIP(request), this.getUserAgent(request),
        null,
        user.phi_access_level !== 'none' ? 1 : 0,
        user.data_classification
      );
    }

    return {
      token: jwtToken,
      user: this.sanitizeUser(user),
      company: this.sanitizeCompany(company)
    };
  }

  /**
   * Request 2FA code via email
   * @param {string} userId - User ID
   * @param {string} email - User email
   * @param {Request} request - HTTP request for audit logging
   * @returns {Promise<{message: string}>}
   */
  async request2FACode(userId, email, request = null) {
    // Get user to verify they exist and get company context
    const user = await this.db.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Send 2FA code via email service
    const emailService = new (require('./email.js').EmailService)(this.env);
    const { twoFactorCode, expiresAt } = await emailService.send2FACode(
      email,
      user.first_name,
      user.company_id,
      this.getClientIP(request)
    );

    // Store code in database
    await this.db.store2FACode(userId, twoFactorCode, expiresAt.toISOString());

    // Audit log
    if (request) {
      await this.db.logAuditEvent(
        userId, user.company_id, '2FA_CODE_REQUESTED', 'USER', userId,
        { method: 'email_2fa', codeExpires: expiresAt.toISOString() },
        this.getClientIP(request), this.getUserAgent(request)
      );
    }

    return { message: '2FA code sent to your email' };
  }

  /**
   * Verify 2FA code
   * @param {string} userId - User ID
   * @param {string} code - 6-digit verification code
   * @param {Request} request - HTTP request for audit logging
   * @returns {Promise<{token: string, user: object, company: object}>}
   */
  async verify2FACode(userId, code, request = null) {
    let user = null;
    let method = 'unknown';

    // First, check if user has TOTP enabled
    const totpData = await this.db.getTOTPSecret(userId);
    
    if (totpData && totpData.two_factor_enabled) {
      // User has TOTP enabled - try TOTP verification first
      const totpValid = await this.verifyTOTPCode(userId, code, request);
      if (totpValid) {
        user = await this.db.getUserById(userId);
        method = code.length === 8 ? '2fa_recovery_code' : '2fa_totp';
      }
    }
    
    // If TOTP verification failed or not enabled, try email code
    if (!user) {
      user = await this.db.verify2FACode(userId, code);
      if (user) {
        method = '2fa_email';
      }
    }
    
    if (!user) {
      // Audit log failed attempt
      if (request) {
        await this.db.logAuditEvent(
          userId, null, 'FAILED_2FA_CODE', 'USER', userId,
          { code: '******', reason: 'Invalid or expired code' },
          this.getClientIP(request), this.getUserAgent(request)
        );
      }
      throw new Error('Invalid or expired verification code');
    }

    // Generate JWT token
    const isMobile = this.detectMobileClient(request);
    const jwtToken = await generateJWT({
      userId: user.id,
      companyId: user.company_id,
      role: user.role,
      phiAccessLevel: user.phi_access_level,
      isMobile
    }, this.env);
    
    // Create session with device info
    const expiresAt = new Date(Date.now() + (isMobile ? 90 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString();
    const deviceInfo = this.parseDeviceInfo(request);
    await this.db.createSession(user.id, jwtToken, expiresAt, isMobile, deviceInfo);

    // Update last login
    await this.db.updateUser(user.id, { 
      last_login: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Clear 2FA email code (if used)
    if (method === '2fa_email') {
      await this.db.clear2FACode(user.id);
    }

    // Get company information
    const company = await this.db.getCompanyById(user.company_id);

    // Audit log successful login via 2FA
    if (request) {
      await this.db.logAuditEvent(
        user.id, user.company_id, 'LOGIN_2FA_CODE', 'USER', user.id,
        { 
          method,
          isMobile,
          phiAccessLevel: user.phi_access_level,
          dataClassification: user.data_classification
        },
        this.getClientIP(request), this.getUserAgent(request),
        null,
        user.phi_access_level !== 'none' ? 1 : 0,
        user.data_classification
      );
    }

    return {
      token: jwtToken,
      user: this.sanitizeUser(user),
      company: this.sanitizeCompany(company)
    };
  }

  async getUserFromToken(token) {
    // Verify JWT token
    const payload = await verifyJWT(token, this.env);
    
    // CRITICAL: Check if session exists in database
    // This ensures deleted/expired sessions are invalidated
    const session = await this.db.getSessionByToken(token);
    if (!session) {
      throw new Error('Session not found or expired');
    }
    
    // Get user from database with company context
    const user = await this.db.getUserById(payload.userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Get company information
    const company = await this.db.getCompanyById(user.company_id);

    // Check if user has a password set
    const hasPassword = !!(user.password && user.password !== '' && user.password !== null);

    return {
      user: this.sanitizeUser(user),
      company: this.sanitizeCompany(company),
      hasPassword // Add password status to response
    };
  }

  async logout(token) {
    // Get session info before deleting for audit
    const session = await this.db.getSessionByToken(token);
    
    // Delete session
    await this.db.deleteSession(token);
    
    // Log logout event
    if (session) {
      await this.db.logAuditEvent(
        session.user_id, session.company_id, 'LOGOUT', 'USER', session.user_id,
        { method: 'session_termination' },
        'system', 'system'
      );
    }
    
    return true;
  }

  // ==================== MAGIC LINK MANAGEMENT ====================

  async enableMagicLink(userId) {
    await this.db.updateUser(userId, { 
      magic_link_enabled: 1,
      updated_at: new Date().toISOString()
    });
    return true;
  }

  async disableMagicLink(userId) {
    await this.db.updateUser(userId, { 
      magic_link_enabled: 0,
      magic_link_token: null,
      magic_link_expires: null,
      updated_at: new Date().toISOString()
    });
    return true;
  }

  // ==================== COMPANY MANAGEMENT ====================

  async createCompany(companyData, adminUserId) {
    const company = await this.db.createCompany(companyData);
    
    // Update company with admin user
    await this.db.updateCompanyAdmin(company.meta.last_row_id, adminUserId);
    
    return company;
  }

  async getCompanyById(companyId) {
    return await this.db.getCompanyById(companyId);
  }

  async getCompanyUsers(companyId) {
    return await this.db.getCompanyUsers(companyId);
  }

  async updateCompanyAdmin(companyId, newAdminUserId) {
    return await this.db.updateCompanyAdmin(companyId, newAdminUserId);
  }

  // ==================== USER MANAGEMENT ====================

  async createUser(userData, createdByUserId) {
    const user = await this.db.createUser(userData);
    
    // Log user creation
    await this.db.logAuditEvent(
      createdByUserId, userData.companyId, 'CREATE_USER', 'USER', user.meta.last_row_id,
      { 
        email: userData.email,
        role: userData.role,
        phiAccessLevel: userData.phiAccessLevel || 'none'
      },
      'system', 'system'
    );
    
    return user;
  }

  async getUserByEmail(email) {
    return await this.db.getUserByEmail(email);
  }

  async updateUser(userId, updateData, updatedByUserId = null) {
    const user = await this.db.updateUser(userId, updateData);
    
    // Log user update
    if (updatedByUserId) {
      await this.db.logAuditEvent(
        updatedByUserId, user.company_id, 'UPDATE_USER', 'USER', userId,
        { updates: Object.keys(updateData) },
        'system', 'system'
      );
    }
    
    return user;
  }

  async softDeleteUser(userId, deletedByUserId) {
    const user = await this.db.getUserById(userId);
    const result = await this.db.softDeleteUser(userId);
    
    // Log user deletion
    await this.db.logAuditEvent(
      deletedByUserId, user.company_id, 'DELETE_USER', 'USER', userId,
      { email: user.email, reason: 'soft_delete' },
      'system', 'system'
    );
    
    return result;
  }

  // ==================== PERMISSION MANAGEMENT ====================

  async grantPermission(userId, companyId, permission, resource, grantedBy) {
    const result = await this.db.grantPermission(userId, companyId, permission, resource, grantedBy);
    
    // Log permission grant
    await this.db.logAuditEvent(
      grantedBy, companyId, 'GRANT_PERMISSION', 'PERMISSION', result.meta.last_row_id,
      { userId, permission, resource },
      'system', 'system'
    );
    
    return result;
  }

  async revokePermission(permissionId, revokedBy) {
    const permission = await this.db.getUserPermissions(permissionId);
    const result = await this.db.revokePermission(permissionId);
    
    // Log permission revocation
    await this.db.logAuditEvent(
      revokedBy, permission.company_id, 'REVOKE_PERMISSION', 'PERMISSION', permissionId,
      { userId: permission.user_id, permission: permission.permission },
      'system', 'system'
    );
    
    return result;
  }

  async getUserPermissions(userId) {
    return await this.db.getUserPermissions(userId);
  }

  // ==================== AUDIT LOGGING ====================

  async getAuditLogs(userId = null, companyId = null, limit = 100, offset = 0) {
    return await this.db.getAuditLogs(userId, companyId, limit, offset);
  }

  async logUserAction(userId, companyId, action, resourceType, resourceId, details, request) {
    return await this.db.logAuditEvent(
      userId, companyId, action, resourceType, resourceId, details,
      this.getClientIP(request), this.getUserAgent(request),
      null, // session_id
      details.phiAccessed || 0,
      details.dataClassification || 'public'
    );
  }

  // ==================== UTILITY METHODS ====================

  sanitizeUser(user) {
    const { password, two_factor_secret, two_factor_recovery_codes, ...sanitized } = user;
    return sanitized;
  }

  sanitizeCompany(company) {
    if (!company) return null;
    const { admin_user_id, ...sanitized } = company;
    return sanitized;
  }

  detectMobileClient(request) {
    if (!request) return false;
    const userAgent = request.headers.get('User-Agent') || '';
    const mobilePatterns = [
      /Mobile/i, /Android/i, /iPhone/i, /iPad/i, /iPod/i,
      /BlackBerry/i, /Windows Phone/i, /Opera Mini/i
    ];
    
    return mobilePatterns.some(pattern => pattern.test(userAgent));
  }

  getClientIP(request) {
    if (!request) return 'unknown';
    return request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Forwarded-For') || 
           'unknown';
  }

  getUserAgent(request) {
    if (!request) return 'unknown';
    return request.headers.get('User-Agent') || 'unknown';
  }

  parseDeviceInfo(request) {
    if (!request) return {};
    
    const userAgent = this.getUserAgent(request);
    const ipAddress = this.getClientIP(request);
    
    // Parse browser
    let browser = 'Unknown';
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Edg')) browser = 'Edge';
    else if (userAgent.includes('Opera')) browser = 'Opera';
    
    // Parse OS
    let os = 'Unknown';
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac OS X')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
    
    // Parse device name
    let deviceName = 'Unknown Device';
    if (userAgent.includes('iPhone')) deviceName = 'iPhone';
    else if (userAgent.includes('iPad')) deviceName = 'iPad';
    else if (userAgent.includes('Android')) deviceName = 'Android Device';
    else if (userAgent.includes('Windows')) deviceName = 'Windows PC';
    else if (userAgent.includes('Mac OS X')) deviceName = 'Mac';
    else if (userAgent.includes('Linux')) deviceName = 'Linux PC';
    
    return {
      userAgent,
      ipAddress,
      browser,
      os,
      deviceName
    };
  }

  // ==================== TOTP METHODS ====================

  /**
   * Setup TOTP for a user
   * Generates a secret, creates recovery codes, and returns QR code data
   * @param {string} userId - User ID
   * @param {Request} request - HTTP request for audit logging
   * @returns {Promise<{secret: string, qrCode: string, recoveryCodes: string[]}>}
   */
  async setupTOTP(userId, request = null) {
    const user = await this.db.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate a new TOTP secret
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: this.env.BRAND_NAME || 'Your Company',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret
    });

    // Generate recovery codes (10 codes, 8 characters each)
    const recoveryCodes = [];
    for (let i = 0; i < 10; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      recoveryCodes.push(code);
    }

    // Hash recovery codes before storing (store hashes, return plaintext to user)
    const hashedRecoveryCodes = await this.db.hashRecoveryCodes(recoveryCodes);

    // Store the secret and hashed recovery codes (not enabled yet)
    await this.db.storeTOTPSecret(userId, secret.base32, hashedRecoveryCodes);

    // Generate QR code URL
    const qrCodeUrl = totp.toString();

    // Audit log
    if (request) {
      await this.db.logAuditEvent(
        userId, user.company_id, 'TOTP_SETUP_INITIATED', 'USER', userId,
        { method: 'totp' },
        this.getClientIP(request), this.getUserAgent(request)
      );
    }

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      recoveryCodes
    };
  }

  /**
   * Verify TOTP setup
   * User must provide a valid code from their authenticator app to confirm setup
   * @param {string} userId - User ID
   * @param {string} code - 6-digit TOTP code
   * @param {Request} request - HTTP request for audit logging
   * @returns {Promise<boolean>}
   */
  async verifyTOTPSetup(userId, code, request = null) {
    const totpData = await this.db.getTOTPSecret(userId);
    if (!totpData || !totpData.two_factor_secret) {
      throw new Error('TOTP not set up');
    }

    // Verify the code
    const totp = new OTPAuth.TOTP({
      issuer: this.env.BRAND_NAME || 'Your Company',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(totpData.two_factor_secret)
    });

    const delta = totp.validate({ token: code, window: 1 });
    
    if (delta === null) {
      // Audit log failed verification
      if (request) {
        const user = await this.db.getUserById(userId);
        await this.db.logAuditEvent(
          userId, user.company_id, 'TOTP_SETUP_FAILED', 'USER', userId,
          { reason: 'Invalid code' },
          this.getClientIP(request), this.getUserAgent(request)
        );
      }
      return false;
    }

    // Enable TOTP
    await this.db.enableTOTP(userId);

    // Audit log successful setup
    if (request) {
      const user = await this.db.getUserById(userId);
      await this.db.logAuditEvent(
        userId, user.company_id, 'TOTP_ENABLED', 'USER', userId,
        { method: 'totp' },
        this.getClientIP(request), this.getUserAgent(request)
      );
    }

    return true;
  }

  /**
   * Verify TOTP code during login
   * @param {string} userId - User ID
   * @param {string} code - 6-digit TOTP code or recovery code
   * @param {Request} request - HTTP request for audit logging
   * @returns {Promise<boolean>}
   */
  async verifyTOTPCode(userId, code, request = null) {
    const totpData = await this.db.getTOTPSecret(userId);
    if (!totpData || !totpData.two_factor_secret || !totpData.two_factor_enabled) {
      return false;
    }

    // Check if it's a recovery code (8 characters, alphanumeric)
    if (code.length === 8 && /^[A-Z0-9]+$/i.test(code)) {
      const used = await this.db.useRecoveryCode(userId, code.toUpperCase());
      if (used) {
        // Audit log recovery code use
        if (request) {
          const user = await this.db.getUserById(userId);
          await this.db.logAuditEvent(
            userId, user.company_id, 'TOTP_RECOVERY_CODE_USED', 'USER', userId,
            { remainingCodes: totpData.two_factor_recovery_codes.length - 1 },
            this.getClientIP(request), this.getUserAgent(request)
          );
        }
        return true;
      }
    }

    // Verify TOTP code
    const totp = new OTPAuth.TOTP({
      issuer: this.env.BRAND_NAME || 'Your Company',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(totpData.two_factor_secret)
    });

    const delta = totp.validate({ token: code, window: 1 });
    
    return delta !== null;
  }

  /**
   * Disable TOTP for a user
   * @param {string} userId - User ID
   * @param {Request} request - HTTP request for audit logging
   * @returns {Promise<void>}
   */
  async disableTOTP(userId, request = null) {
    await this.db.disableTOTP(userId);

    // Audit log
    if (request) {
      const user = await this.db.getUserById(userId);
      await this.db.logAuditEvent(
        userId, user.company_id, 'TOTP_DISABLED', 'USER', userId,
        { method: 'totp' },
        this.getClientIP(request), this.getUserAgent(request)
      );
    }
  }

  // Legacy method for compatibility
  async verifyTwoFactorToken(token, secret) {
    // Use the new verifyTOTPCode method
    // This is kept for backward compatibility
    const totp = new OTPAuth.TOTP({
      issuer: this.env.BRAND_NAME || 'Your Company',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret)
    });

    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  }

  // ==================== HIPAA COMPLIANCE METHODS ====================

  async checkPHIAccess(userId, resourceType, resourceId) {
    const user = await this.db.getUserById(userId);
    
    // Check if user has PHI access level
    if (user.phi_access_level === 'none') {
      return false;
    }
    
    // Log PHI access attempt
    await this.db.logAuditEvent(
      userId, user.company_id, 'PHI_ACCESS_ATTEMPT', resourceType, resourceId,
      { phiAccessLevel: user.phi_access_level },
      'system', 'system',
      null, // session_id
      1, // phi_accessed = true
      user.data_classification
    );
    
    return true;
  }

  async enforceDataClassification(userId, dataClassification) {
    const user = await this.db.getUserById(userId);
    
    // Check if user can access this data classification level
    const accessLevels = {
      'public': ['public', 'internal', 'confidential', 'restricted'],
      'internal': ['internal', 'confidential', 'restricted'],
      'confidential': ['confidential', 'restricted'],
      'restricted': ['restricted']
    };
    
    const userLevels = accessLevels[user.data_classification] || [];
    return userLevels.includes(dataClassification);
  }
}
