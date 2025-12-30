// Enhanced Security Service for Multi-Tenant SaaS
// HIPAA-compliant security utilities with Cloudflare KV-based rate limiting

export class SecurityService {
  constructor(env) {
    this.env = env;
    this.kv = env.RATE_LIMIT_KV;
    
    // Rate limit configuration
    this.rateLimits = {
      login: {
        limit: parseInt(env.RATE_LIMIT_LOGIN || '20'),
        window: parseInt(env.RATE_LIMIT_LOGIN_WINDOW || '900') // 15 minutes
      },
      api: {
        limit: parseInt(env.RATE_LIMIT_API || '100'),
        window: parseInt(env.RATE_LIMIT_API_WINDOW || '60') // 1 minute
      },
      email: {
        limit: 5,
        window: 900 // 15 minutes (matches existing email service)
      }
    };
    
    this.sessionIdleTimeout = parseInt(env.SESSION_IDLE_TIMEOUT || '1800000'); // 30 minutes
  }

  // ==================== RATE LIMITING ====================

  /**
   * Check login rate limit (20 attempts per 15 minutes per IP)
   * Uses Cloudflare KV for persistence across worker instances
   */
  async checkLoginRateLimit(ip, userId = null) {
    const key = `ratelimit:login:${ip}`;
    
    try {
      const data = await this.kv.get(key, 'json');
      const now = Date.now();
      
      if (data) {
        // Filter out old attempts outside the window
        const validAttempts = data.attempts.filter(
          timestamp => now - timestamp < this.rateLimits.login.window * 1000
        );
        
        if (validAttempts.length >= this.rateLimits.login.limit) {
          const resetTime = new Date(validAttempts[0] + this.rateLimits.login.window * 1000);
          throw new Error(`Too many login attempts. Please try again after ${resetTime.toLocaleTimeString()}`);
        }
        
        // Add current attempt
        validAttempts.push(now);
        await this.kv.put(key, JSON.stringify({ 
          attempts: validAttempts,
          userId 
        }), { 
          expirationTtl: this.rateLimits.login.window 
        });
        
        return {
          allowed: true,
          remaining: this.rateLimits.login.limit - validAttempts.length,
          resetTime
        };
      } else {
        // First attempt
        await this.kv.put(key, JSON.stringify({ 
          attempts: [now],
          userId 
        }), { 
          expirationTtl: this.rateLimits.login.window 
        });
        
        return {
          allowed: true,
          remaining: this.rateLimits.login.limit - 1,
          resetTime: new Date(now + this.rateLimits.login.window * 1000)
        };
      }
    } catch (error) {
      // If error is our rate limit error, rethrow it
      if (error.message.includes('Too many login attempts')) {
        throw error;
      }
      // For KV errors, log and allow (fail open for availability)
      console.error('Rate limit KV error:', error);
      return { allowed: true, remaining: 0, resetTime: null };
    }
  }

  /**
   * Check API rate limit (100 requests per minute per IP)
   * Protects all API endpoints from abuse
   */
  async checkAPIRateLimit(ip) {
    const key = `ratelimit:api:${ip}`;
    
    try {
      const data = await this.kv.get(key, 'json');
      const now = Date.now();
      
      if (data) {
        const validRequests = data.requests.filter(
          timestamp => now - timestamp < this.rateLimits.api.window * 1000
        );
        
        if (validRequests.length >= this.rateLimits.api.limit) {
          throw new Error('API rate limit exceeded. Please slow down your requests.');
        }
        
        validRequests.push(now);
        await this.kv.put(key, JSON.stringify({ 
          requests: validRequests 
        }), { 
          expirationTtl: this.rateLimits.api.window 
        });
        
        return {
          allowed: true,
          remaining: this.rateLimits.api.limit - validRequests.length
        };
      } else {
        await this.kv.put(key, JSON.stringify({ 
          requests: [now] 
        }), { 
          expirationTtl: this.rateLimits.api.window 
        });
        
        return {
          allowed: true,
          remaining: this.rateLimits.api.limit - 1
        };
      }
    } catch (error) {
      if (error.message.includes('API rate limit exceeded')) {
        throw error;
      }
      console.error('Rate limit KV error:', error);
      return { allowed: true, remaining: 0 };
    }
  }

  /**
   * Clear rate limit for specific key (useful after successful login)
   */
  async clearRateLimit(type, identifier) {
    const key = `ratelimit:${type}:${identifier}`;
    try {
      await this.kv.delete(key);
    } catch (error) {
      console.error('Clear rate limit error:', error);
    }
  }

  /**
   * Get rate limit status for monitoring
   */
  async getRateLimitStatus(type, identifier) {
    const key = `ratelimit:${type}:${identifier}`;
    
    try {
      const data = await this.kv.get(key, 'json');
      const now = Date.now();
      
      if (!data) {
        return {
          count: 0,
          remaining: this.rateLimits[type]?.limit || 0,
          resetTime: null
        };
      }
      
      const items = data.attempts || data.requests || [];
      const window = this.rateLimits[type]?.window || 60;
      const validItems = items.filter(timestamp => now - timestamp < window * 1000);
      
      return {
        count: validItems.length,
        remaining: Math.max(0, (this.rateLimits[type]?.limit || 0) - validItems.length),
        resetTime: validItems.length > 0 ? new Date(validItems[0] + window * 1000) : null
      };
    } catch (error) {
      console.error('Get rate limit status error:', error);
      return { count: 0, remaining: 0, resetTime: null };
    }
  }

  // ==================== INPUT VALIDATION ====================

  /**
   * Validate email address format
   * Email will also be used as username per requirements
   */
  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      throw new Error('Email is required');
    }
    
    const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email address format');
    }
    
    // Additional checks
    if (email.length > 254) {
      throw new Error('Email address is too long');
    }
    
    return email.toLowerCase().trim();
  }

  /**
   * Validate password strength
   * Requirements: 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special character
   */
  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Password is required');
    }
    
    // Length check
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    if (password.length > 128) {
      throw new Error('Password is too long (maximum 128 characters)');
    }
    
    // Uppercase check
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    
    // Lowercase check
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    
    // Number check
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    
    // Special character check
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      throw new Error('Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':"\\|,.<>/?)');
    }
    
    // Check for common passwords
    const commonPasswords = [
      'password', 'password1', 'password123', '12345678', 'qwerty123',
      'admin123', 'letmein', 'welcome123', 'monkey123'
    ];
    if (commonPasswords.includes(password.toLowerCase())) {
      throw new Error('Password is too common. Please choose a stronger password');
    }
    
    return password; // Return as-is, don't modify
  }

  /**
   * Validate magic link token format (UUID)
   */
  validateMagicLinkToken(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid magic link token');
    }
    
    // Check UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      throw new Error('Invalid magic link token format');
    }
    
    return token.toLowerCase();
  }

  /**
   * Validate and sanitize general text input
   */
  sanitizeInput(input, maxLength = 1000) {
    if (typeof input !== 'string') {
      return input;
    }
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, maxLength);
  }

  /**
   * Validate company name
   */
  validateCompanyName(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Company name is required');
    }
    
    const trimmed = name.trim();
    
    if (trimmed.length < 2) {
      throw new Error('Company name must be at least 2 characters');
    }
    
    if (trimmed.length > 100) {
      throw new Error('Company name is too long (maximum 100 characters)');
    }
    
    return trimmed;
  }

  // ==================== SECURITY HEADERS ====================

  /**
   * Add comprehensive security headers to response
   * Includes CSP, XSS protection, frame options, etc.
   */
  addSecurityHeaders(response, corsOrigin = null) {
    const headers = new Headers(response.headers);
    
    // Content Security
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    
    // Transport Security
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    // Referrer Policy
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy - Security compliant
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Needed for React
      "style-src 'self' 'unsafe-inline'", // Needed for styled components
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.notropolis.net https://api.brevo.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');
    headers.set('Content-Security-Policy', csp);
    
    // Permissions Policy (Feature Policy)
    headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
    
    // CORS headers if origin provided
    if (corsOrigin) {
      const allowedOrigins = [
        'https://bossmode.notropolis.net',
        'https://notropolis.net',
        'http://localhost:5173', // Vite dev server
        'http://localhost:3000'  // Alternative dev port
      ];

      if (allowedOrigins.includes(corsOrigin)) {
        headers.set('Access-Control-Allow-Origin', corsOrigin);
      } else {
        headers.set('Access-Control-Allow-Origin', 'https://bossmode.notropolis.net');
      }
      
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      headers.set('Access-Control-Allow-Credentials', 'true');
      headers.set('Access-Control-Max-Age', '86400');
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Check if session should be refreshed based on activity
   * Desktop sessions: auto-refresh after 1 hour of activity
   * Idle timeout: 30 minutes of inactivity
   */
  shouldRefreshSession(session, lastActivity) {
    if (!session || !lastActivity) {
      return { shouldRefresh: false, shouldExpire: false };
    }
    
    const now = Date.now();
    const lastActivityTime = new Date(lastActivity).getTime();
    const sessionCreatedTime = new Date(session.created_at).getTime();
    
    // Check idle timeout (30 minutes)
    const idleTime = now - lastActivityTime;
    if (idleTime > this.sessionIdleTimeout) {
      return { 
        shouldRefresh: false, 
        shouldExpire: true,
        reason: 'Session idle timeout (30 minutes)' 
      };
    }
    
    // For mobile sessions, don't auto-refresh (90-day sessions)
    if (session.is_mobile) {
      return { 
        shouldRefresh: false, 
        shouldExpire: false,
        reason: 'Mobile session (long-lived)' 
      };
    }
    
    // For desktop sessions, refresh if more than 1 hour old and user is active
    const sessionAge = now - sessionCreatedTime;
    const oneHour = 60 * 60 * 1000;
    
    if (sessionAge > oneHour && idleTime < 5 * 60 * 1000) { // Active in last 5 minutes
      return { 
        shouldRefresh: true, 
        shouldExpire: false,
        reason: 'Desktop session needs refresh (active user, session > 1 hour)' 
      };
    }
    
    return { shouldRefresh: false, shouldExpire: false };
  }

  /**
   * Update last activity timestamp in KV
   */
  async updateLastActivity(userId, sessionId) {
    const key = `activity:${userId}:${sessionId}`;
    try {
      await this.kv.put(key, Date.now().toString(), { 
        expirationTtl: 7200 // 2 hours
      });
    } catch (error) {
      console.error('Update activity error:', error);
    }
  }

  /**
   * Get last activity timestamp from KV
   */
  async getLastActivity(userId, sessionId) {
    const key = `activity:${userId}:${sessionId}`;
    try {
      const timestamp = await this.kv.get(key);
      return timestamp ? parseInt(timestamp) : null;
    } catch (error) {
      console.error('Get activity error:', error);
      return null;
    }
  }

  // ==================== SECURITY MONITORING ====================

  /**
   * Log suspicious activity for HIPAA compliance
   */
  async logSuspiciousActivity(type, details, request) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    
    console.warn('SECURITY ALERT:', {
      type,
      details,
      ip,
      userAgent,
      timestamp: new Date().toISOString()
    });
    
    // Store in KV for review
    const key = `security:alert:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    try {
      await this.kv.put(key, JSON.stringify({
        type,
        details,
        ip,
        userAgent,
        timestamp: new Date().toISOString()
      }), {
        expirationTtl: 86400 * 30 // Keep for 30 days
      });
    } catch (error) {
      console.error('Log suspicious activity error:', error);
    }
  }

  /**
   * Check if IP address should be blocked
   */
  async checkIPBlacklist(ip) {
    try {
      const blocked = await this.kv.get(`blocked:ip:${ip}`);
      return blocked === 'true';
    } catch (error) {
      console.error('Check IP blacklist error:', error);
      return false;
    }
  }

  /**
   * Block an IP address temporarily
   */
  async blockIP(ip, reason, durationSeconds = 3600) {
    try {
      await this.kv.put(`blocked:ip:${ip}`, 'true', {
        expirationTtl: durationSeconds,
        metadata: { reason, blockedAt: new Date().toISOString() }
      });
      
      await this.logSuspiciousActivity('IP_BLOCKED', { ip, reason }, { 
        headers: new Headers({ 'CF-Connecting-IP': ip }) 
      });
    } catch (error) {
      console.error('Block IP error:', error);
    }
  }
}
