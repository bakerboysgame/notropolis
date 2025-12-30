// Multi-Tenant SaaS Authentication API
// Cloudflare Worker with company-based authentication and HIPAA compliance

import { Database } from './src/database.js';
import { AuthService } from './src/auth.js';
import { EmailService } from './src/email.js';
import { SecurityService } from './src/security.js';
import { BrevoAnalytics } from './src/analytics.js';
import { generateJWT, verifyJWT } from './src/jwt.js';
import { handleBrevoWebhook } from './webhook_handler.js';
import {
  handleEmailDashboard,
  handleCompanyEmailAnalytics,
  handleEmailEvents,
  handleBrevoActivityLogs,
  handleSyncBrevoLogs
} from './analytics_handlers.js';
import { checkAuthorization, checkPageAccess, ROLE_BUILTIN_PAGES } from './src/middleware/authorization.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    // Enhanced CORS headers for SaaS dashboard
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    };


    // Handle preflight requests
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Initialize services
    const db = new Database(env);
    globalThis.db = db; // Make db available globally for EmailService
    const authService = new AuthService(db, env);
    const emailService = new EmailService(env, db);
    const securityService = new SecurityService(env);
    const analyticsService = new BrevoAnalytics(env, env.DB, db); // Pass both D1 binding and Database instance

    // Get client IP for rate limiting
    const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';

    // ==================== AUTHORIZATION MIDDLEWARE ====================
    // Get user from token if Authorization header is present
    let currentUser = null;
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const { user } = await authService.getUserFromToken(token);
        currentUser = user;
      } catch (err) {
        // Token invalid or expired - user remains null
        // This is fine for public endpoints
      }
    }

    // Parse request body for authorization check (only for methods that have body)
    let requestBody = null;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const clonedRequest = request.clone();
        requestBody = await clonedRequest.json();
      } catch (err) {
        // Body parsing failed or not JSON - continue without body
      }
    }

    // Check authorization
    const authResult = await checkAuthorization(currentUser, path, method, requestBody, env);
    if (!authResult.authorized) {
      return new Response(JSON.stringify({
        success: false,
        error: authResult.error
      }), {
        status: authResult.statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== GLOBAL API RATE LIMITING ====================
    // Apply rate limiting to all authenticated API requests
    // Public endpoints (health, webhooks) and auth endpoints have their own specific rate limits
    const publicPaths = ['/api/health', '/api/webhooks', '/api/auth/login', '/api/auth/magic-link'];
    const isPublicPath = publicPaths.some(p => path.startsWith(p));

    if (!isPublicPath && currentUser) {
      // Authenticated users: 100 requests/minute
      try {
        await securityService.checkAPIRateLimit(clientIP);
      } catch (rateLimitError) {
        const retryAfter = 60; // Retry after 60 seconds
        return new Response(JSON.stringify({
          success: false,
          error: rateLimitError.message
        }), {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(Date.now() + retryAfter * 1000).toISOString()
          }
        });
      }
    } else if (!isPublicPath && !currentUser && path.startsWith('/api/')) {
      // Unauthenticated API requests: 20 requests/minute (stricter)
      try {
        // Use a stricter rate limit for unauthenticated requests
        const key = `ratelimit:unauth:${clientIP}`;
        const data = await env.RATE_LIMIT_KV.get(key, 'json');
        const now = Date.now();
        const limit = 20;
        const window = 60 * 1000; // 1 minute

        if (data) {
          const validRequests = data.requests.filter(ts => now - ts < window);
          if (validRequests.length >= limit) {
            const retryAfter = Math.ceil((validRequests[0] + window - now) / 1000);
            return new Response(JSON.stringify({
              success: false,
              error: 'Rate limit exceeded. Please slow down your requests.'
            }), {
              status: 429,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Retry-After': retryAfter.toString(),
                'X-RateLimit-Limit': '20',
                'X-RateLimit-Remaining': '0'
              }
            });
          }
          validRequests.push(now);
          await env.RATE_LIMIT_KV.put(key, JSON.stringify({ requests: validRequests }), { expirationTtl: 60 });
        } else {
          await env.RATE_LIMIT_KV.put(key, JSON.stringify({ requests: [now] }), { expirationTtl: 60 });
        }
      } catch (kvError) {
        // Fail open for KV errors - don't block requests if rate limiting fails
        console.error('Rate limit KV error:', kvError);
      }
    }

    try {
      // Enhanced route handling with company-based authentication
      switch (true) {
        // Authentication endpoints
        case path === '/api/auth/login':
          return handleLogin(request, authService, emailService, env, securityService, clientIP);
        case path === '/api/auth/logout':
          return handleLogout(request, authService);
         case path === '/api/auth/me':
           return handleGetProfile(request, authService);
         case path === '/api/auth/sessions':
           return handleGetSessions(request, authService, db);
         case path === '/api/auth/sessions/all' && method === 'DELETE':
           return handleDeleteAllSessions(request, authService, db);
         case path.startsWith('/api/auth/sessions/') && method === 'DELETE':
           return handleDeleteSession(request, authService, db);
         case path === '/api/auth/magic-link/request':
          return handleMagicLinkRequest(request, authService, emailService, env, securityService, clientIP);
        case path === '/api/auth/magic-link/verify':
          return handleMagicLinkVerify(request, authService, env);
        case path === '/api/auth/magic-link/verify-code':
          return handleMagicLinkCodeVerify(request, authService, env, securityService, clientIP);
        case path === '/api/auth/magic-link':
          return handleMagicLinkRedirect(request, authService, env);
        case path === '/api/auth/magic-link/enable':
          return handleEnableMagicLink(request, authService);
        case path === '/api/auth/magic-link/disable':
          return handleDisableMagicLink(request, authService);
        case path === '/api/auth/password-reset/request':
          return handlePasswordResetRequest(request, authService, emailService, securityService, clientIP);
        case path === '/api/auth/set-password':
          return handleSetPassword(request, authService, db, env);
        case path === '/api/auth/verification/request':
          return handleVerificationRequest(request, authService, emailService, clientIP);
        case path === '/api/auth/verify-email':
          return handleVerifyEmail(request, authService, db, env);
        case path === '/api/auth/accept-invitation':
          return handleAcceptInvitation(request, authService, db, env);
        case path === '/api/auth/2fa/request':
          return handle2FARequest(request, authService, env, securityService, clientIP);
        case path === '/api/auth/2fa/verify':
          return handle2FAVerify(request, authService, env, securityService, clientIP);
        
        // TOTP endpoints
        case path === '/api/auth/totp/setup':
          return handleTOTPSetup(request, authService, env);
        case path === '/api/auth/totp/verify-setup':
          return handleTOTPVerifySetup(request, authService, env);
        case path === '/api/auth/totp/disable':
          return handleTOTPDisable(request, authService, env);
        case path === '/api/auth/totp/status':
          return handleTOTPStatus(request, authService, env);
        
        // Company management endpoints
        case path.startsWith('/api/companies'):
          return handleCompanyRoutes(request, authService, db);
        
        // User management endpoints (company-scoped)
        case path.startsWith('/api/users'):
          return handleUserRoutes(request, authService, db, emailService);
        
        // Permission management endpoints
        case path.startsWith('/api/permissions'):
          return handlePermissionRoutes(request, authService, db);
        
        // Audit log endpoints (company admin only)
        case path.startsWith('/api/audit'):
          return handleAuditRoutes(request, authService, db);

    // Health check endpoint
        case path === '/api/health':
          return handleHealthCheck(request, db);
        
        // Test email endpoint
        case path === '/api/test/email':
          return handleTestEmail(request, emailService);
        
        // Template validation endpoint
        case path === '/api/test/templates':
          return handleTemplateValidation(request, emailService);
        
        // Analytics endpoints (require authentication)
        case path === '/api/analytics/email/dashboard':
          return handleEmailDashboard(request, analyticsService, authService);
        case path === '/api/analytics/email/company':
          return handleCompanyEmailAnalytics(request, analyticsService, authService);
        case path === '/api/analytics/email/events':
          return handleEmailEvents(request, analyticsService, authService);
        case path === '/api/analytics/email/logs':
          return handleBrevoActivityLogs(request, analyticsService, authService);
        case path === '/api/analytics/email/sync':
          return handleSyncBrevoLogs(request, analyticsService, authService);
        case path === '/api/webhooks/email':
          return handleBrevoWebhook(request, analyticsService, authService);

        // ==================== USER PERMISSIONS ENDPOINTS ====================
        case path === '/api/user/permissions' && method === 'GET':
          return handleUserPermissions(request, authService, env, corsHeaders);

        case path === '/api/company/available-pages' && method === 'GET':
          return handleCompanyAvailablePages(request, authService, env, corsHeaders);

        // ==================== ROLE PAGE ACCESS ENDPOINTS ====================
        case path.match(/^\/api\/company\/roles\/[^/]+\/pages$/) && method === 'GET':
          return handleGetRolePages(request, authService, env, corsHeaders);

        case path.match(/^\/api\/company\/roles\/[^/]+\/pages$/) && method === 'PUT':
          return handleSetRolePages(request, authService, env, corsHeaders);

        // ==================== CUSTOM ROLES CRUD ENDPOINTS ====================
        case path === '/api/company/roles' && method === 'GET':
          return handleGetAllRoles(request, authService, env, corsHeaders);

        case path === '/api/company/roles' && method === 'POST':
          return handleCreateCustomRole(request, authService, env, corsHeaders);

        case path.match(/^\/api\/company\/roles\/[^/]+$/) && method === 'PATCH':
          return handleUpdateCustomRole(request, authService, env, corsHeaders);

        case path.match(/^\/api\/company\/roles\/[^/]+$/) && method === 'DELETE':
          return handleDeleteCustomRole(request, authService, env, corsHeaders);

        // ==================== USER PERMISSION OVERRIDES ENDPOINTS ====================
        case path.match(/^\/api\/users\/[^/]+\/permissions$/) && method === 'GET':
          return handleGetUserPermissions(request, authService, env, corsHeaders);

        case path.match(/^\/api\/users\/[^/]+\/permissions$/) && method === 'POST':
          return handleGrantUserPermission(request, authService, env, corsHeaders);

        case path.match(/^\/api\/users\/[^/]+\/permissions\/[^/]+$/) && method === 'DELETE':
          return handleRevokeUserPermission(request, authService, env, corsHeaders);

        // Session cleanup endpoint
        case path === '/api/cleanup/sessions':
          return handleSessionCleanup(request, authService);
        
        default:
          return new Response(JSON.stringify({ 
            error: 'Not Found',
            success: false 
          }), { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ 
        error: error.message,
        success: false 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// ==================== SESSION CLEANUP HANDLER ====================

async function handleSessionCleanup(request, authService) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };

  try {
    await authService.cleanupExpiredSessions();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Expired sessions cleaned up successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ==================== AUTHENTICATION HANDLERS ====================

async function handleLogin(request, authService, emailService, env, securityService, clientIP) {
  const { email, password, twoFactorToken } = await request.json();

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };

  try {
    // Check rate limit before processing login
    await securityService.checkLoginRateLimit(clientIP);

    const result = await authService.login(email, password, twoFactorToken, request);
    
    if (result.requiresMagicLink) {
      // Send magic link with company context
      await emailService.sendMagicLink(email, result.user.first_name, result.user.company_id);
      return new Response(JSON.stringify({
        success: true,
        data: {
          requiresMagicLink: true,
          message: 'Please check your email for a magic link to complete login'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (result.requiresTwoFactor) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          requiresTwoFactor: true,
          userId: result.userId,
          email: result.email,
          user: result.user
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Normal login success with company context
    return new Response(JSON.stringify({
      success: true,
      data: {
        token: result.token,
        user: result.user,
        company: result.company
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Return 429 for rate limit errors
    const status = error.message.includes('Too many login attempts') ? 429 : 401;
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleMagicLinkRequest(request, authService, emailService, env, securityService, clientIP) {
  const { email } = await request.json();

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };

  try {
    // Check rate limit before processing magic link request
    await securityService.checkLoginRateLimit(clientIP);

    // Get user to verify company context
    const user = await authService.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    await emailService.sendMagicLink(email, user.first_name, user.company_id);

    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Magic link sent to your email'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Return 429 for rate limit errors
    const status = error.message.includes('Too many login attempts') ? 429 : 400;
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleMagicLinkVerify(request, authService, env) {
  const { token } = await request.json();
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
  
  try {
    const result = await authService.verifyMagicLink(token, request);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        token: result.token,
        user: result.user,
        company: result.company
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleMagicLinkCodeVerify(request, authService, env, securityService, clientIP) {
  const { email, code } = await request.json();

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };

  try {
    // Check rate limit before processing magic link code verification
    await securityService.checkLoginRateLimit(clientIP);

    const result = await authService.verifyMagicLinkCode(email, code, request);

    return new Response(JSON.stringify({
      success: true,
      data: {
        token: result.token,
        user: result.user,
        company: result.company
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Return 429 for rate limit errors
    const status = error.message.includes('Too many login attempts') ? 429 : 400;
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handle2FARequest(request, authService, env, securityService, clientIP) {
  const { userId, email } = await request.json();

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };

  try {
    // Check rate limit before processing 2FA request
    await securityService.checkLoginRateLimit(clientIP);

    const result = await authService.request2FACode(userId, email, request);

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Return 429 for rate limit errors
    const status = error.message.includes('Too many login attempts') ? 429 : 400;
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handle2FAVerify(request, authService, env, securityService, clientIP) {
  const { userId, code } = await request.json();

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };

  try {
    // Check rate limit before processing 2FA verification
    await securityService.checkLoginRateLimit(clientIP);

    const result = await authService.verify2FACode(userId, code, request);

    return new Response(JSON.stringify({
      success: true,
      data: {
        token: result.token,
        user: result.user,
        company: result.company
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Return 429 for rate limit errors
    const status = error.message.includes('Too many login attempts') ? 429 : 400;
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ==================== INVITATION HANDLER ====================

async function handleAcceptInvitation(request, authService, db, env) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
  
  const url = new URL(request.url);
  const method = request.method;
  
  // Handle GET request (verify invitation token)
  if (method === 'GET') {
    const token = url.searchParams.get('token');
    
    if (!token) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invitation token is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    try {
      // Verify invitation token
      const user = await db.verifyInvitationToken(token);
      
      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid or expired invitation token'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Get company information
      const company = await db.getCompanyById(user.company_id);
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          companyName: company?.name || 'Unknown',
          role: user.role
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
  
  // Handle POST request (complete invitation - magic link style, no password required)
  if (method === 'POST') {
    try {
      const body = await request.json();
      const { token } = body;
      
      if (!token) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Token is required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Verify invitation token
      const user = await db.verifyInvitationToken(token);
      
      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid or expired invitation token'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Complete invitation (activate user, mark as verified, clear token - no password required)
      await db.completeInvitation(user.id);
      
      // Get updated user and company data
      const updatedUser = await db.getUserById(user.id);
      const company = await db.getCompanyById(user.company_id);
      
      // Generate JWT token for auto-login (same as magic link)
      const isMobile = authService.detectMobileClient(request);
      const jwtToken = await generateJWT({
        userId: updatedUser.id,
        companyId: updatedUser.company_id,
        role: updatedUser.role,
        phiAccessLevel: updatedUser.phi_access_level,
        isMobile
      }, env);
      
      // Create session with device info
      const expiresAt = new Date(Date.now() + (isMobile ? 90 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString();
      const deviceInfo = authService.parseDeviceInfo(request);
      await db.createSession(updatedUser.id, jwtToken, expiresAt, isMobile, deviceInfo);
      
      // Update last login timestamp
      await db.updateUser(updatedUser.id, { 
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      // Log audit event
      await db.logAuditEvent(
        user.id,
        user.company_id,
        'INVITATION_ACCEPTED',
        'USER',
        user.id,
        { 
          email: user.email, 
          autoLogin: true,
          method: 'invitation_link',
          isMobile,
          phiAccessLevel: updatedUser.phi_access_level,
          dataClassification: updatedUser.data_classification
        },
        request.headers.get('CF-Connecting-IP') || 'unknown',
        request.headers.get('User-Agent') || 'unknown',
        null, // session_id will be set by createSession
        updatedUser.phi_access_level !== 'none' ? 1 : 0,
        updatedUser.data_classification
      );
      
      return new Response(JSON.stringify({
        success: true,
        token: jwtToken,
        user: authService.sanitizeUser(updatedUser),
        company: authService.sanitizeCompany(company),
        message: 'Invitation accepted successfully. You are now logged in.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
  
  // Method not allowed
  return new Response(JSON.stringify({
    success: false,
    error: 'Method not allowed'
  }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// ==================== TOTP HANDLERS ====================

async function handleTOTPSetup(request, authService, env) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
  
  // Verify authentication
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Authorization required'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const { user } = await authService.getUserFromToken(token);
    const result = await authService.setupTOTP(user.id, request);
    
    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleTOTPVerifySetup(request, authService, env) {
  const { code } = await request.json();
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
  
  // Verify authentication
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Authorization required'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const { user } = await authService.getUserFromToken(token);
    const success = await authService.verifyTOTPSetup(user.id, code, request);
    
    if (!success) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid verification code'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: { message: 'TOTP enabled successfully' }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleTOTPDisable(request, authService, env) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
  
  // Verify authentication
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Authorization required'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const { user } = await authService.getUserFromToken(token);
    await authService.disableTOTP(user.id, request);
    
    return new Response(JSON.stringify({
      success: true,
      data: { message: 'TOTP disabled successfully' }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleTOTPStatus(request, authService, env) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
  
  // Verify authentication
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Authorization required'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const { user } = await authService.getUserFromToken(token);
    const totpData = await authService.db.getTOTPSecret(user.id);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        enabled: totpData?.two_factor_enabled === 1,
        recoveryCodesRemaining: totpData?.two_factor_recovery_codes?.length || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleMagicLinkRedirect(request, authService, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  
  if (!token) {
    return Response.redirect(`${env.CLIENT_URL}/login?error=invalid-token`);
  }
  
  try {
    const result = await authService.verifyMagicLink(token, request);
    
    // Redirect to dashboard with JWT token
    return Response.redirect(`${env.CLIENT_URL}/dashboard?token=${result.token}`);
  } catch (error) {
    return Response.redirect(`${env.CLIENT_URL}/login?error=invalid-magic-link`);
  }
}

async function handleGetProfile(request, authService) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': authService.env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
  
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Authorization required'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const result = await authService.getUserFromToken(token);
    
    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleGetSessions(request, authService, db) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': authService.env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
  
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Authorization required'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const { user } = await authService.getUserFromToken(token);
    const sessions = await db.getUserSessions(user.id);
    
    return new Response(JSON.stringify({
      success: true,
      data: sessions
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleDeleteSession(request, authService, db) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': authService.env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
  
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Authorization required'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const token = authHeader.split(' ')[1];
  const url = new URL(request.url);
  const sessionId = url.pathname.split('/').pop();
  
  try {
    const { user } = await authService.getUserFromToken(token);
    
    // Get the session to verify ownership
    const sessions = await db.getUserSessions(user.id);
    const sessionToDelete = sessions.find(s => s.id === sessionId);
    
    if (!sessionToDelete) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Session not found or does not belong to you'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Delete the session from database
    await db.deleteSessionById(sessionId);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Session ended successfully'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleDeleteAllSessions(request, authService, db) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': authService.env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
  
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Authorization required'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const { user } = await authService.getUserFromToken(token);
    
    // Delete all sessions for this user
    await db.deleteAllUserSessions(user.id);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'All sessions ended successfully'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleLogout(request, authService) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Authorization required'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    await authService.logout(token);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Logged out successfully'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleEnableMagicLink(request, authService) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Authorization required'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const { user } = await authService.getUserFromToken(token);
    await authService.enableMagicLink(user.id);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Magic link enabled'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleDisableMagicLink(request, authService) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Authorization required'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const { user } = await authService.getUserFromToken(token);
    await authService.disableMagicLink(user.id);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Magic link disabled'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleSetPassword(request, authService, db, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };

  // Handle OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  // Handle POST request
  if (request.method === 'POST') {
    try {
      // Verify authentication
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.split(' ')[1];
      const { user } = await authService.getUserFromToken(token);

      const body = await request.json();
      const { currentPassword, newPassword } = body;

      if (!newPassword) {
        return new Response(JSON.stringify({
          success: false,
          error: 'New password is required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Validate password strength
      if (newPassword.length < 8) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Password must be at least 8 characters long'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get full user data
      const fullUser = await db.getUserById(user.id);

      // If user has an existing password, verify current password
      if (fullUser.password && fullUser.password !== '' && fullUser.password !== null) {
        if (!currentPassword) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Current password is required to change password'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const isValidPassword = await db.verifyPassword(currentPassword, fullUser.password);
        if (!isValidPassword) {
          // Log failed attempt
          await db.logAuditEvent(
            user.id,
            user.company_id,
            'PASSWORD_CHANGE_FAILED',
            'USER',
            user.id,
            { reason: 'Invalid current password' },
            request.headers.get('CF-Connecting-IP') || 'unknown',
            request.headers.get('User-Agent') || 'unknown'
          );

          return new Response(JSON.stringify({
            success: false,
            error: 'Current password is incorrect'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Hash and update password
      const hashedPassword = await db.hashPassword(newPassword);
      await db.updateUser(user.id, {
        password: hashedPassword,
        updated_at: new Date().toISOString()
      });

      // Log successful password set/change
      await db.logAuditEvent(
        user.id,
        user.company_id,
        fullUser.password ? 'PASSWORD_CHANGED' : 'PASSWORD_SET',
        'USER',
        user.id,
        { method: 'settings' },
        request.headers.get('CF-Connecting-IP') || 'unknown',
        request.headers.get('User-Agent') || 'unknown'
      );

      return new Response(JSON.stringify({
        success: true,
        message: fullUser.password ? 'Password changed successfully' : 'Password set successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Method not allowed
  return new Response(JSON.stringify({
    success: false,
    error: 'Method not allowed'
  }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handlePasswordResetRequest(request, authService, emailService, securityService, clientIP) {
  const { email } = await request.json();

  try {
    // Check rate limit before processing password reset request
    await securityService.checkLoginRateLimit(clientIP);

    // Get user to verify they exist
    const user = await authService.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    // Send password reset email with actual client IP
    await emailService.sendPasswordResetEmail(email, user.first_name, user.company_id, clientIP);

    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Password reset email sent'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Return 429 for rate limit errors
    const status = error.message.includes('Too many login attempts') ? 429 : 400;
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleVerificationRequest(request, authService, emailService, clientIP) {
  const { email } = await request.json();

  try {
    // Get user to verify they exist
    const user = await authService.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    // Send verification email with actual client IP
    await emailService.sendVerificationEmail(email, user.first_name, user.company_id, clientIP);

    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Verification email sent'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleVerifyEmail(request, authService, db, env) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };

  try {
    const { token } = await request.json();

    if (!token) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Verification token is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify the token and mark user as verified
    const user = await db.verifyEmailToken(token);

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or expired verification token'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Log audit event
    await db.logAuditEvent(
      user.id,
      user.company_id,
      'EMAIL_VERIFIED',
      'USER',
      user.id,
      { email: user.email },
      request.headers.get('CF-Connecting-IP') || 'unknown',
      request.headers.get('User-Agent') || 'unknown'
    );

    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Email verified successfully',
        email: user.email
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ==================== COMPANY ROUTES ====================

async function handleCompanyRoutes(request, authService, db) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': authService.env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  
  // Extract company ID from path
  const pathParts = path.split('/');
  const companyId = pathParts[3]; // /api/companies/{id}
  
  // Verify authentication
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Authorization required'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const token = authHeader.split(' ')[1];
  const { user } = await authService.getUserFromToken(token);
  
  try {
    switch (true) {
      case path.match(/^\/api\/companies\/[^/]+\/transfer-admin$/) && method === 'POST':
        // Transfer admin rights to another user in the same company
        const transferCompanyId = path.split('/')[3];
        
        // Get request body
        const transferBody = await request.json();
        const { newAdminUserId } = transferBody;
        
        if (!newAdminUserId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'newAdminUserId is required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Authorization: Must be current admin of the company OR master_admin
        const transferCompany = await db.getCompanyById(transferCompanyId);
        if (!transferCompany) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Company not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const isCurrentAdmin = transferCompany.admin_user_id === user.id;
        const isMasterAdmin = user.role === 'master_admin';
        
        if (!isCurrentAdmin && !isMasterAdmin) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Only the current company admin or master admin can transfer admin rights'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        try {
          // Transfer admin rights
          const updatedCompany = await db.transferAdminRights(
            transferCompanyId,
            transferCompany.admin_user_id,
            newAdminUserId
          );
          
          // Get both users for audit log
          const oldAdmin = await db.getUserById(transferCompany.admin_user_id);
          const newAdmin = await db.getUserById(newAdminUserId);
          
          // Log audit event
          await db.logAuditEvent(
            user.id,
            transferCompanyId,
            'ADMIN_RIGHTS_TRANSFERRED',
            'COMPANY',
            transferCompanyId,
            {
              oldAdminId: transferCompany.admin_user_id,
              oldAdminEmail: oldAdmin?.email,
              newAdminId: newAdminUserId,
              newAdminEmail: newAdmin?.email,
              transferredBy: user.email
            },
            request.headers.get('CF-Connecting-IP') || 'unknown',
            request.headers.get('User-Agent') || 'unknown'
          );
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Admin rights transferred successfully',
            data: {
              company: updatedCompany,
              oldAdmin: {
                id: oldAdmin?.id,
                email: oldAdmin?.email,
                name: `${oldAdmin?.first_name} ${oldAdmin?.last_name}`
              },
              newAdmin: {
                id: newAdmin?.id,
                email: newAdmin?.email,
                name: `${newAdmin?.first_name} ${newAdmin?.last_name}`
              }
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

      case path === '/api/companies/stats' && method === 'GET':
        // Get companies with statistics (master_admin only)
        if (user.role !== 'master_admin') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Master admin access required'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const companiesWithStats = await db.getCompaniesWithStats();
        return new Response(JSON.stringify({
          success: true,
          data: companiesWithStats
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case path === '/api/companies' && method === 'GET':
        // List companies (master_admin can see all, admin can see their own)
        if (user.role === 'master_admin') {
          // Master admin can see all companies
          const allCompanies = await db.getCompanies();
          return new Response(JSON.stringify({
            success: true,
            data: allCompanies
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else if (user.role === 'admin') {
          // Regular admin can only see their company
          const userCompany = await db.getCompanyById(user.company_id);
          return new Response(JSON.stringify({
            success: true,
            data: userCompany ? [userCompany] : []
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: 'Admin access required'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      
      case path.match(/^\/api\/companies\/[^/]+\/archive$/) && method === 'POST':
        // Archive company and all users except admin
        const archiveCompanyId = path.split('/')[3];
        
        const archiveCompany = await db.getCompanyById(archiveCompanyId);
        if (!archiveCompany) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Company not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Authorization: Must be company admin OR master_admin
        const isArchiveCompanyAdmin = archiveCompany.admin_user_id === user.id;
        const isArchiveMasterAdmin = user.role === 'master_admin';
        
        if (!isArchiveCompanyAdmin && !isArchiveMasterAdmin) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Only company admin or master admin can archive the company'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        try {
          const archiveResult = await db.archiveCompany(archiveCompanyId, false);
          
          // Log audit event
          await db.logAuditEvent(
            user.id,
            archiveCompanyId,
            'COMPANY_ARCHIVED',
            'COMPANY',
            archiveCompanyId,
            {
              companyName: archiveResult.companyName,
              archivedUsersCount: archiveResult.archivedUsersCount,
              adminArchived: false
            },
            request.headers.get('CF-Connecting-IP') || 'unknown',
            request.headers.get('User-Agent') || 'unknown'
          );
          
        return new Response(JSON.stringify({
          success: true,
            message: `Company archived successfully. ${archiveResult.archivedUsersCount} user(s) archived.`,
            data: archiveResult
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

      case path.match(/^\/api\/companies\/[^/]+\/restore$/) && method === 'POST':
        // Restore archived company and its users
        const restoreCompanyId = path.split('/')[3];
        
        // Get company (even if archived)
        const restoreCompanyData = await db.db.prepare(`
          SELECT * FROM companies WHERE id = ?
        `).bind(restoreCompanyId).first();
        
        if (!restoreCompanyData) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Company not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Authorization: Company admin OR master admin
        const isRestoreCompanyAdmin = restoreCompanyData.admin_user_id === user.id;
        const isRestoreMasterAdmin = user.role === 'master_admin';
        
        if (!isRestoreCompanyAdmin && !isRestoreMasterAdmin) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Only company admin or master admin can restore the company'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        try {
          const restoreResult = await db.restoreCompany(restoreCompanyId);
          
          // Log audit event
          await db.logAuditEvent(
            user.id,
            restoreCompanyId,
            'COMPANY_RESTORED',
            'COMPANY',
            restoreCompanyId,
            {
              companyName: restoreResult.companyName,
              restoredUsersCount: restoreResult.restoredUsersCount
            },
            request.headers.get('CF-Connecting-IP') || 'unknown',
            request.headers.get('User-Agent') || 'unknown'
          );
          
          return new Response(JSON.stringify({
            success: true,
            message: `Company restored successfully. ${restoreResult.restoredUsersCount} user(s) restored.`,
            data: restoreResult
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

      case path.match(/^\/api\/companies\/[^/]+$/) && path !== '/api/companies' && method === 'PATCH':
        // Update company information
        const updateCompanyId = path.split('/')[3];
        
        const updateCompany = await db.getCompanyById(updateCompanyId);
        if (!updateCompany) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Company not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Authorization: Must be company admin OR master_admin
        const isUpdateCompanyAdmin = updateCompany.admin_user_id === user.id;
        const isUpdateMasterAdmin = user.role === 'master_admin';
        
        if (!isUpdateCompanyAdmin && !isUpdateMasterAdmin) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Only company admin or master admin can update the company'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        try {
          const updateCompanyBody = await request.json();
          await db.updateCompany(updateCompanyId, updateCompanyBody);
          
          // Log audit event
          await db.logAuditEvent(
            user.id,
            updateCompanyId,
            'COMPANY_UPDATED',
            'COMPANY',
            updateCompanyId,
            {
              companyName: updateCompany.name,
              changes: Object.keys(updateCompanyBody)
            },
            request.headers.get('CF-Connecting-IP') || 'unknown',
            request.headers.get('User-Agent') || 'unknown'
          );
          
          // Get updated company
          const updatedCompanyData = await db.getCompanyById(updateCompanyId);
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Company updated successfully',
            data: updatedCompanyData
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

      case path.match(/^\/api\/companies\/[^/]+\/master-delete$/) && method === 'DELETE':
        // MASTER DELETE: Permanently delete company and ALL associated data
        // WARNING: Only for master_admin - bypasses all safeguards
        const masterDeleteCompanyId = path.split('/')[3];
        
        // Authorization: ONLY master_admin
        if (user.role !== 'master_admin') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Master delete is only available to master admins'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        try {
          // Get company details before deletion
          const companyToDelete = await db.getCompanyById(masterDeleteCompanyId);
          if (!companyToDelete) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Company not found'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Perform master delete (deletes EVERYTHING)
          const deleteResult = await db.masterDeleteCompany(masterDeleteCompanyId);
          
          // Log audit event to SYSTEM company
          await db.logAuditEvent(
            user.id,
            'SYSTEM',
            'COMPANY_MASTER_DELETED',
            'COMPANY',
            'SYSTEM',
            {
              deletedCompanyId: masterDeleteCompanyId,
              deletedCompanyName: companyToDelete.name,
              deletedUsers: deleteResult.deletedUsers,
              performedBy: user.email,
              warning: 'All data permanently deleted - no preservation'
            },
            request.headers.get('CF-Connecting-IP') || 'unknown',
            request.headers.get('User-Agent') || 'unknown',
            null,
            0,
            'internal',
            masterDeleteCompanyId // Store deleted company ID in related_company_id
          );
          
          return new Response(JSON.stringify({
            success: true,
            message: `Company "${companyToDelete.name}" and all associated data permanently deleted`,
            deletedUsers: deleteResult.deletedUsers
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

      case path.match(/^\/api\/companies\/[^/]+$/) && path !== '/api/companies' && method === 'DELETE':
        // Permanently delete company
        const deleteCompanyId = path.split('/')[3];
        
        // Authorization: Must be company admin OR master_admin
        const deleteCompany = await db.getCompanyById(deleteCompanyId);
        if (!deleteCompany) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Company not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const isDeleteCompanyAdmin = deleteCompany.admin_user_id === user.id;
        const isDeleteMasterAdmin = user.role === 'master_admin';
        
        if (!isDeleteCompanyAdmin && !isDeleteMasterAdmin) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Only company admin or master admin can delete the company'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Check if company can be deleted
        const deleteCheck = await db.canCompanyBeDeleted(deleteCompanyId);
        if (!deleteCheck.canDelete) {
          return new Response(JSON.stringify({
            success: false,
            error: deleteCheck.reason,
            details: {
              userCount: deleteCheck.userCount,
              companyName: deleteCheck.companyName
            }
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        try {
          // STEP 1: Delete admin user FIRST (if exists)
          let adminDeleted = false;
          if (deleteCheck.adminUserId) {
            const adminUser = await db.getUserById(deleteCheck.adminUserId);
            if (adminUser) {
              // Log admin deletion
              await db.logAuditEvent(
                user.id,
                'SYSTEM',
                'USER_PERMANENTLY_DELETED',
                'USER',
                deleteCheck.adminUserId,
                {
                  deletedEmail: adminUser.email,
                  deletedFirstName: adminUser.first_name,
                  deletedLastName: adminUser.last_name,
                  deletedRole: adminUser.role,
                  deletedBy: user.email,
                  deletedByRole: user.role,
                  deletedByCompanyId: user.company_id,
                  originalCompanyId: deleteCompanyId,
                  originalCompanyName: deleteCompany.name,
                  warning: 'DELETED_AS_PART_OF_COMPANY_DELETION',
                  wasCompanyAdmin: true
                },
                request.headers.get('CF-Connecting-IP') || 'unknown',
                request.headers.get('User-Agent') || 'unknown',
                null, 0, null,
                deleteCompanyId,  // related_company_id
                deleteCheck.adminUserId  // related_user_id
              );
              
              // Delete admin user
              await db.hardDeleteUser(deleteCheck.adminUserId);
              adminDeleted = true;
            }
          }
          
          // STEP 2: Log company deletion audit event
          await db.logAuditEvent(
            user.id,
            null, // null for system-level events (FK constraint requires valid company_id or NULL)
            'COMPANY_PERMANENTLY_DELETED',
            'COMPANY',
            deleteCompanyId,
            {
              companyName: deleteCompany.name,
              companyDomain: deleteCompany.domain,
              deletedBy: user.email,
              deletedByCompanyId: user.company_id,
              deletedByCompanyName: user.company_name || 'Unknown',
              warning: 'PERMANENT_DELETION',
              adminUserDeleted: adminDeleted,
              adminUserId: deleteCheck.adminUserId || null
            },
            request.headers.get('CF-Connecting-IP') || 'unknown',
            request.headers.get('User-Agent') || 'unknown',
            null, // sessionId
            0, // phiAccessed
            null, // dataClassification
            deleteCompanyId // related_company_id - preserves deleted company reference
          );
          
          // STEP 3: Delete company (admin already deleted)
          await db.deleteCompany(deleteCompanyId);
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Company permanently deleted',
            adminUserDeleted: adminDeleted
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

      case path.match(/^\/api\/companies\/[^/]+\/audit-logs$/) && method === 'GET':
        // Get company audit logs with filtering
        const auditCompanyId = path.split('/')[3];
        
        const auditCompany = await db.getCompanyById(auditCompanyId);
        if (!auditCompany) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Company not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Authorization: Company admin OR master admin
        const isAuditCompanyAdmin = auditCompany.admin_user_id === user.id;
        const isAuditMasterAdmin = user.role === 'master_admin';
        
        if (!isAuditCompanyAdmin && !isAuditMasterAdmin) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Only company admin or master admin can view audit logs'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        try {
          const url = new URL(request.url);
          const options = {
            limit: parseInt(url.searchParams.get('limit') || '100'),
            offset: parseInt(url.searchParams.get('offset') || '0'),
            actionType: url.searchParams.get('actionType') || null,
            entityType: url.searchParams.get('entityType') || null,
            userId: url.searchParams.get('userId') || null,
            startDate: url.searchParams.get('startDate') || null,
            endDate: url.searchParams.get('endDate') || null
          };
          
          const auditLogs = await db.getCompanyAuditLogs(auditCompanyId, options);
          
          return new Response(JSON.stringify({
            success: true,
            data: auditLogs
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

      case path.match(/^\/api\/companies\/[^/]+\/activity$/) && method === 'GET':
        // Get company activity metrics with drill-down
        const activityCompanyId = path.split('/')[3];
        
        const activityCompany = await db.getCompanyById(activityCompanyId);
        if (!activityCompany) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Company not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Authorization: Company admin OR master admin
        const isActivityCompanyAdmin = activityCompany.admin_user_id === user.id;
        const isActivityMasterAdmin = user.role === 'master_admin';
        
        if (!isActivityCompanyAdmin && !isActivityMasterAdmin) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Only company admin or master admin can view activity metrics'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        try {
          const url = new URL(request.url);
          const options = {
            period: url.searchParams.get('period') || 'all', // all, today, week, month, year
            breakdown: url.searchParams.get('breakdown') === 'true',
            userId: url.searchParams.get('userId') || null
          };
          
          const activity = await db.getCompanyActivity(activityCompanyId, options);
          
          return new Response(JSON.stringify({
            success: true,
            data: activity
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

      case path === '/api/companies/create-with-admin' && method === 'POST':
        // Create company with admin invitation (master_admin only)
        if (user.role !== 'master_admin') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Master admin access required'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        try {
          const body = await request.json();
          const { companyName, adminName, adminEmail } = body;
          
          // Validate input
          if (!companyName || !adminName || !adminEmail) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Missing required fields: companyName, adminName, adminEmail'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Check if user with this email already exists
          const existingUser = await db.getUserByEmail(adminEmail);
          if (existingUser) {
            return new Response(JSON.stringify({
              success: false,
              error: 'A user with this email already exists'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Create company
          const companyResult = await db.createCompany({
            name: companyName,
            domain: null,
            adminUserId: null,
            dataRetentionDays: 2555,
            hipaaCompliant: 1
          });
          
          // createCompany now returns { id: 'uuid' } with RETURNING clause
          const companyId = companyResult.id;
          console.log('Company created with ID:', companyId);
          
          if (!companyId) {
            throw new Error('Failed to create company - no ID returned');
          }
          
          // Generate invitation token (expires in 72 hours)
          const invitationToken = crypto.randomUUID();
          const invitationExpires = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours
          
          // Create admin user with invitation
          const nameParts = adminName.trim().split(' ');
          const firstName = nameParts[0] || adminName;
          const lastName = nameParts.slice(1).join(' ') || '';
          const username = adminEmail.split('@')[0];
          
          console.log('Creating user with:', {
            email: adminEmail,
            username,
            firstName,
            lastName,
            companyId,
            invitationToken,
            invitationExpires: invitationExpires.toISOString()
          });
          
          const userResult = await db.createUserWithInvitation({
            email: adminEmail,
            username,
            firstName,
            lastName,
            companyId,
            role: 'admin',
            invitationToken,
            invitationExpires: invitationExpires.toISOString()
          });
          
          // createUserWithInvitation now returns { id: 'uuid' } with RETURNING clause
          const userId = userResult.id;
          console.log('User created with ID:', userId);
          
          if (!userId) {
            throw new Error('Failed to create user - no ID returned');
          }
          
          // Update company with admin user ID
          console.log('About to call updateCompanyAdmin with:', { companyId, userId });
          await db.updateCompanyAdmin(companyId, userId);
          
          // Send invitation email using template 187
          const emailService = new (require('./src/email.js').EmailService)(authService.env, db);
          await emailService.sendAdminInvitationEmail(
            adminEmail,
            firstName,
            companyName,
            invitationToken,
            companyId
          );
          
          // Log audit event
          await db.logAuditEvent(
            user.id,
            companyId,
            'CREATE_COMPANY_WITH_ADMIN',
            'COMPANY',
            companyId,
            { companyName, adminEmail, invitationExpires: invitationExpires.toISOString() },
            request.headers.get('CF-Connecting-IP') || 'unknown',
            request.headers.get('User-Agent') || 'unknown'
          );
          
        return new Response(JSON.stringify({
          success: true,
            message: 'Company created and invitation sent successfully',
            data: {
              companyId,
              companyName,
              adminEmail,
              invitationExpires: invitationExpires.toISOString()
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Create company with admin error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Failed to create company'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      
      case path === `/api/companies/${companyId}` && method === 'GET':
        // Get company details
        const company = await db.getCompanyById(companyId);
        if (!company) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Company not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({
          success: true,
          data: company
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      
      case path === `/api/companies/${companyId}/users` && method === 'GET':
        // Get company users (master_admin can access any company, company admin can access their own)
        const userIsMasterAdmin = user.role === 'master_admin';
        const isCompanyAdmin = user.role === 'admin' && user.company_id === companyId;

        if (!userIsMasterAdmin && !isCompanyAdmin) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Admin access required'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const companyUsers = await db.getCompanyUsers(companyId);
        return new Response(JSON.stringify({
          success: true,
          data: companyUsers
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      // ==================== COMPANY AVAILABLE PAGES ====================
      case path.match(/^\/api\/companies\/[^/]+\/available-pages$/) && method === 'GET':
        // Get company's available pages (master_admin only)
        const getAvailPagesCompanyId = path.split('/')[3];

        if (user.role !== 'master_admin') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Master admin access required'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const availPagesResult = await authService.env.DB.prepare(`
          SELECT page_key, is_enabled, created_at, updated_at
          FROM company_available_pages
          WHERE client_company_id = ?
          ORDER BY page_key
        `).bind(getAvailPagesCompanyId).all();

        return new Response(JSON.stringify({
          success: true,
          data: {
            company_id: getAvailPagesCompanyId,
            pages: availPagesResult.results || []
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case path.match(/^\/api\/companies\/[^/]+\/available-pages$/) && method === 'PUT':
        // Set company's available pages (master_admin only)
        // Request body: { pages: ['dashboard', 'analytics', 'reports'] }
        const setAvailPagesCompanyId = path.split('/')[3];

        if (user.role !== 'master_admin') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Master admin access required'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const availPagesBody = await request.json();
        const pagesToEnable = availPagesBody.pages || [];

        if (!Array.isArray(pagesToEnable)) {
          return new Response(JSON.stringify({
            success: false,
            error: 'pages must be an array'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Valid page keys
        const VALID_PAGE_KEYS = ['dashboard', 'analytics', 'reports', 'settings'];
        const invalidPages = pagesToEnable.filter(p => !VALID_PAGE_KEYS.includes(p));
        if (invalidPages.length > 0) {
          return new Response(JSON.stringify({
            success: false,
            error: `Invalid page keys: ${invalidPages.join(', ')}. Valid keys: ${VALID_PAGE_KEYS.join(', ')}`
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Delete existing page settings for this company
        await authService.env.DB.prepare(`
          DELETE FROM company_available_pages WHERE client_company_id = ?
        `).bind(setAvailPagesCompanyId).run();

        // Insert new page settings
        for (const pageKey of pagesToEnable) {
          await authService.env.DB.prepare(`
            INSERT INTO company_available_pages (client_company_id, page_key, is_enabled, created_by)
            VALUES (?, ?, 1, ?)
          `).bind(setAvailPagesCompanyId, pageKey, user.id).run();
        }

        // Log the action
        await authService.env.DB.prepare(`
          INSERT INTO audit_logs (user_id, company_id, action, resource_type, resource_id, details, ip_address)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          user.id,
          setAvailPagesCompanyId,
          'update_company_available_pages',
          'company',
          setAvailPagesCompanyId,
          JSON.stringify({ pages: pagesToEnable }),
          request.headers.get('CF-Connecting-IP') || 'unknown'
        ).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Company available pages updated',
          data: {
            company_id: setAvailPagesCompanyId,
            pages: pagesToEnable
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Not Found'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
      } catch (error) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: error.message 
        }), {
          status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

// ==================== USER ROUTES ====================

async function handleUserRoutes(request, authService, db, emailService) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': authService.env.CORS_ORIGIN || 'https://dashboard.your-domain.com',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  
  // Verify authentication
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Authorization required'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const token = authHeader.split(' ')[1];
  const { user } = await authService.getUserFromToken(token);
  
  try {
    switch (true) {
      case path === '/api/users' && method === 'GET':
        // List users - master_admin can see all, regular users see their company only
        let usersData;
        if (user.role === 'master_admin') {
          usersData = await db.getAllUsers();
        } else {
          usersData = await db.getCompanyUsers(user.company_id);
        }
        
        return new Response(JSON.stringify({
          success: true,
          data: usersData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case path === '/api/users/invite' && method === 'POST':
        // Check permissions - master_admin or admin only
        if (user.role !== 'master_admin' && user.role !== 'admin') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Admin access required'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          const inviteBody = await request.json();
          const { companyId, userName, userEmail, role: requestedRole } = inviteBody;

          // Validate required fields
          if (!userName || !userEmail) {
            return new Response(JSON.stringify({
              success: false,
              error: 'User name and email are required'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Determine target company
          let targetCompanyId = companyId;
          if (user.role === 'admin') {
            // Regular admins can only invite to their own company
            targetCompanyId = user.company_id;
          } else if (!targetCompanyId) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Company ID is required'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Check if email already exists
          const existingUser = await db.getUserByEmail(userEmail);
          if (existingUser) {
            return new Response(JSON.stringify({
              success: false,
              error: 'A user with this email already exists'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Get company details
          const targetCompany = await db.getCompanyById(targetCompanyId);
          if (!targetCompany) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Company not found'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Generate invitation details
          const invitationToken = crypto.randomUUID();
          const invitationExpires = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72 hours

          // Parse name into first and last
          const nameParts = userName.trim().split(' ');
          const firstName = nameParts[0] || userName;
          const lastName = nameParts.slice(1).join(' ') || '';

          // Generate username from email
          const inviteUsername = userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

          // Create user with invitation
          const newUser = await db.createUserWithInvitation({
            email: userEmail,
            username: inviteUsername,
            firstName,
            lastName,
            companyId: targetCompanyId,
            role: requestedRole || 'user', // Use requested role or default to 'user'
            invitationToken,
            invitationExpires
          });

          // Send invitation email
          await emailService.sendUserInvitationEmail(
            userEmail,
            firstName,
            targetCompany.name,
            `${user.first_name} ${user.last_name}`,
            invitationToken
          );

          // Log audit event
          await db.logAuditEvent(
            user.id,
            user.company_id,
            'USER_INVITED',
            'user',
            newUser.id,
            {
              targetEmail: userEmail,
              targetCompany: targetCompany.name,
              inviterRole: user.role
            },
            request.headers.get('CF-Connecting-IP') || 'unknown',
            request.headers.get('User-Agent') || 'unknown'
          );

          return new Response(JSON.stringify({
            success: true,
            data: {
              userId: newUser.id,
              userName: userName,
              userEmail: userEmail,
              companyName: targetCompany.name,
              invitationExpires: invitationExpires
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        } catch (inviteError) {
          console.error('User invitation error:', inviteError);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to invite user: ' + inviteError.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

      case path.startsWith('/api/users/') && path.endsWith('/resend-invitation') && method === 'POST':
        // Resend invitation to unverified user - Admin access required
        const resendUserId = path.split('/')[3];

        // Check permissions - master_admin or admin only
        if (user.role !== 'master_admin' && user.role !== 'admin') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Admin access required'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          // Get the user
          const resendTargetUser = await db.getUserById(resendUserId);

          if (!resendTargetUser) {
            return new Response(JSON.stringify({
              success: false,
              error: 'User not found'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Check if user is unverified (pending invitation)
          if (resendTargetUser.verified) {
            return new Response(JSON.stringify({
              success: false,
              error: 'User has already accepted their invitation'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Check permissions - admins can only resend to users in their company
          if (user.role === 'admin' && resendTargetUser.company_id !== user.company_id) {
            return new Response(JSON.stringify({
              success: false,
              error: 'You can only resend invitations to users in your company'
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Get company details
          const resendCompany = await db.getCompanyById(resendTargetUser.company_id);
          if (!resendCompany) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Company not found'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Generate new invitation token and expiration
          const newInvitationToken = crypto.randomUUID();
          const newInvitationExpires = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72 hours

          // Update the user's invitation token
          await db.updateMagicLinkToken(resendUserId, newInvitationToken, newInvitationExpires, null);

          // Send new invitation email
          await emailService.sendUserInvitationEmail(
            resendTargetUser.email,
            resendTargetUser.first_name,
            resendCompany.name,
            `${user.first_name} ${user.last_name}`,
            newInvitationToken
          );

          // Log audit event
          await db.logAuditEvent(
            user.id,
            user.company_id,
            'INVITATION_RESENT',
            'user',
            resendUserId,
            {
              targetEmail: resendTargetUser.email,
              targetCompany: resendCompany.name,
              inviterRole: user.role
            },
            request.headers.get('CF-Connecting-IP') || 'unknown',
            request.headers.get('User-Agent') || 'unknown'
          );

          return new Response(JSON.stringify({
            success: true,
            data: {
              userId: resendUserId,
              userEmail: resendTargetUser.email,
              userName: `${resendTargetUser.first_name} ${resendTargetUser.last_name}`.trim(),
              companyName: resendCompany.name,
              invitationExpires: newInvitationExpires
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        } catch (resendError) {
          console.error('Resend invitation error:', resendError);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to resend invitation: ' + resendError.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

      case path.startsWith('/api/users/') && path.endsWith('/archive') && method === 'POST':
        // Archive (soft delete) user - Admin access required
        const archiveUserId = path.split('/')[3];
        const archiveTargetUser = await db.getUserById(archiveUserId);
        
        if (!archiveTargetUser) {
          return new Response(JSON.stringify({
            success: false,
            error: 'User not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Authorization: master_admin can archive anyone, admin can archive users in their company
        if (user.role !== 'master_admin' && archiveTargetUser.company_id !== user.company_id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized to archive this user'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Prevent self-archiving
        if (archiveUserId === user.id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Cannot archive your own account'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Check if user can be safely archived (admin protection)
        const archiveCheck = await db.canUserBeArchived(archiveUserId);
        if (!archiveCheck.canArchive) {
          return new Response(JSON.stringify({
            success: false,
            error: archiveCheck.reason,
            details: {
              companyName: archiveCheck.companyName,
              activeUsersCount: archiveCheck.activeUsersCount
            }
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        await db.softDeleteUser(archiveUserId);
        
        // Log audit event
        await db.logAuditEvent(
          user.id,
          user.company_id,
          'USER_ARCHIVED',
          'USER',
          archiveUserId,
          { 
            archivedEmail: archiveTargetUser.email,
            isLastUser: archiveCheck.isLastUser || false,
            companyName: archiveCheck.companyName
          },
          request.headers.get('CF-Connecting-IP') || 'unknown',
          request.headers.get('User-Agent') || 'unknown'
        );
        
        return new Response(JSON.stringify({
          success: true,
          message: 'User archived successfully',
          warning: archiveCheck.isLastUser ? 'This was the last active user in the company' : null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case path.startsWith('/api/users/') && path.endsWith('/restore') && method === 'POST':
        // Restore archived user - Admin access required
        const restoreUserId = path.split('/')[3];
        
        // Get user even if deleted
        const restoreTargetUser = await db.db.prepare(`
          SELECT * FROM users WHERE id = ?
        `).bind(restoreUserId).first();
        
        if (!restoreTargetUser) {
          return new Response(JSON.stringify({
            success: false,
            error: 'User not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Authorization
        if (user.role !== 'master_admin' && restoreTargetUser.company_id !== user.company_id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized to restore this user'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        await db.restoreUser(restoreUserId);
        
        // Log audit event
        await db.logAuditEvent(
          user.id,
          user.company_id,
          'USER_RESTORED',
          'USER',
          restoreUserId,
          { restoredEmail: restoreTargetUser.email },
          request.headers.get('CF-Connecting-IP') || 'unknown',
          request.headers.get('User-Agent') || 'unknown'
        );
        
        return new Response(JSON.stringify({
          success: true,
          message: 'User restored successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case path.startsWith('/api/users/') && method === 'PATCH':
        // Update user - Admin access required
        const updateUserId = path.split('/')[3];
        const updateTargetUser = await db.getUserById(updateUserId);
        
        if (!updateTargetUser) {
          return new Response(JSON.stringify({
            success: false,
            error: 'User not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Authorization
        if (user.role !== 'master_admin' && updateTargetUser.company_id !== user.company_id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized to update this user'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const updateData = await request.json();
        
        // Validate and sanitize update data
        // Only include fields that are explicitly provided
        const allowedFields = {
          first_name: updateData.firstName,
          last_name: updateData.lastName,
          email: updateData.email,
          role: updateData.role,
          // Only include is_active if explicitly provided (to prevent accidental deactivation)
          is_active: updateData.isActive !== undefined ? (updateData.isActive ? 1 : 0) : undefined,
          phi_access_level: updateData.phiAccessLevel,
          data_classification: updateData.dataClassification
        };

        // Remove undefined values
        const cleanUpdateData = {};
        Object.keys(allowedFields).forEach(key => {
          if (allowedFields[key] !== undefined) {
            cleanUpdateData[key] = allowedFields[key];
          }
        });
        
        // Role restrictions: regular admin cannot set master_admin role
        if (cleanUpdateData.role === 'master_admin' && user.role !== 'master_admin') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Only master admins can assign master_admin role'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Capture old values before update for audit logging
        const oldValues = {};
        const newValues = {};
        Object.keys(cleanUpdateData).forEach(key => {
          // Map DB field names to the target user's current values
          const fieldMapping = {
            first_name: 'first_name',
            last_name: 'last_name',
            email: 'email',
            role: 'role',
            is_active: 'is_active',
            phi_access_level: 'phi_access_level',
            data_classification: 'data_classification'
          };
          const dbField = fieldMapping[key] || key;
          oldValues[key] = updateTargetUser[dbField];
          newValues[key] = cleanUpdateData[key];
        });

        await db.updateUser(updateUserId, cleanUpdateData);

        // Log audit event with before/after values
        await db.logAuditEvent(
          user.id,
          user.company_id,
          'USER_UPDATED',
          'USER',
          updateUserId,
          {
            updated_user_email: updateTargetUser.email,
            updated_user_name: `${updateTargetUser.first_name || ''} ${updateTargetUser.last_name || ''}`.trim() || updateTargetUser.email,
            changed_fields: Object.keys(cleanUpdateData),
            old_values: oldValues,
            new_values: newValues
          },
          request.headers.get('CF-Connecting-IP') || 'unknown',
          request.headers.get('User-Agent') || 'unknown'
        );
        
        return new Response(JSON.stringify({
          success: true,
          message: 'User updated successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case path.startsWith('/api/users/') && method === 'DELETE':
        // Hard delete user - MASTER ADMIN ONLY (WARNING: Permanent deletion)
        const deleteUserId = path.split('/')[3];
        
        if (user.role !== 'master_admin') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Only master admins can permanently delete users. Use archive instead.'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const deleteTargetUser = await db.getUserById(deleteUserId);
        
        if (!deleteTargetUser) {
          return new Response(JSON.stringify({
            success: false,
            error: 'User not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Prevent self-deletion
        if (deleteUserId === user.id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Cannot delete your own account'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // CRITICAL: Block deletion if user is a company admin
        // Admin users must be deleted as part of company deletion, not independently
        const adminOfCompany = await db.getCompanyById(deleteTargetUser.company_id);
        if (adminOfCompany && adminOfCompany.admin_user_id === deleteUserId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Cannot delete company admin user independently',
            message: `This user is the admin of "${adminOfCompany.name}". To remove this admin, you must delete the company instead.`,
            companyId: adminOfCompany.id,
            companyName: adminOfCompany.name,
            recommendation: 'Go to Company Management → Delete Company. The admin user will be automatically deleted when the company is deleted.',
            userEmail: deleteTargetUser.email
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Check if user can be safely deleted (other validations)
        const deleteCheck = await db.canUserBeArchived(deleteUserId);
        if (!deleteCheck.canArchive) {
          return new Response(JSON.stringify({
            success: false,
            error: deleteCheck.reason,
            details: {
              companyName: deleteCheck.companyName,
              activeUsersCount: deleteCheck.activeUsersCount
            }
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // User is not a company admin, safe to delete
        const isCompanyAdmin = false; // Already checked above
        
        // Log audit event FIRST (with related_user_id for deleted user)
        await db.logAuditEvent(
          user.id,
          null,  // null for system-level events (FK constraint requires valid company_id or NULL)
          'USER_PERMANENTLY_DELETED',
          'USER',
          deleteUserId,
          { 
            deletedEmail: deleteTargetUser.email,
            deletedFirstName: deleteTargetUser.first_name,
            deletedLastName: deleteTargetUser.last_name,
            deletedRole: deleteTargetUser.role,
            deletedBy: user.email,
            deletedByRole: user.role,
            deletedByCompanyId: user.company_id,
            originalCompanyId: deleteTargetUser.company_id,
            originalCompanyName: deleteCheck.companyName,
            warning: 'PERMANENT_DELETION',
            isLastUser: deleteCheck.isLastUser || false,
            wasCompanyAdmin: isCompanyAdmin,
            companyLeftWithoutAdmin: isCompanyAdmin ? 'Company admin_user_id set to NULL' : false
          },
          request.headers.get('CF-Connecting-IP') || 'unknown',
          request.headers.get('User-Agent') || 'unknown',
          null,  // sessionId
          0,     // phiAccessed
          null,  // dataClassification
          deleteTargetUser.company_id,  // related_company_id - user's original company
          deleteUserId  // related_user_id - preserves deleted user reference
        );
        
        // Delete user AFTER logging
        await db.hardDeleteUser(deleteUserId);
        
        const warnings = [];
        if (deleteCheck.isLastUser) {
          warnings.push('This was the last active user in the company');
        }
        if (isCompanyAdmin) {
          warnings.push(`Company "${deleteCheck.companyName}" is now without an admin. Consider deleting the company or transferring admin rights first.`);
        }
        
        return new Response(JSON.stringify({
          success: true,
          message: 'User permanently deleted',
          warnings: warnings.length > 0 ? warnings : null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      
      case path.startsWith('/api/users/') && method === 'GET':
        // Get specific user (company-scoped)
        const userId = path.split('/')[3];
        const targetUser = await db.getUserById(userId);
        
        if (!targetUser) {
          return new Response(JSON.stringify({
            success: false,
            error: 'User not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Authorization: master_admin can see anyone, admin can see users in their company
        if (user.role !== 'master_admin' && targetUser.company_id !== user.company_id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({
          success: true,
          data: targetUser
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      
      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Not Found'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ==================== PERMISSION ROUTES ====================

async function handlePermissionRoutes(request, authService, db) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // Verify authentication
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Authorization required'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const token = authHeader.split(' ')[1];
  const { user } = await authService.getUserFromToken(token);
  
  try {
    switch (true) {
      case path.startsWith('/api/permissions/') && method === 'GET':
        // Get user permissions
        const userId = path.split('/')[3];
        
        // Verify user is in same company
        const targetUser = await db.getUserById(userId);
        if (!targetUser || targetUser.company_id !== user.company_id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'User not found'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const permissions = await db.getUserPermissions(userId);
      return new Response(JSON.stringify({ 
        success: true, 
          data: permissions
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      
      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Not Found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
    }
    } catch (error) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
      headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
// ==================== AUDIT ROUTES ====================

async function handleAuditRoutes(request, authService, db) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
  };

  // Verify authentication
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Authorization required'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.split(' ')[1];
  const result = await authService.getUserFromToken(token);
  const user = result?.user;

  // Check if user was found
  if (!user) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid or expired token'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // POST /api/audit/log is allowed for all authenticated users (for frontend logging)
  // Other audit endpoints require admin access
  const isPostLogEndpoint = path === '/api/audit/log' && method === 'POST';

  if (!isPostLogEndpoint && user.role !== 'admin' && user.role !== 'master_admin') {
    return new Response(JSON.stringify({
      success: false,
      error: 'Admin access required'
    }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    switch (true) {
      case path === '/api/audit/logs' && method === 'GET': {
        // Get enriched audit logs with role-based filtering
        const limit = parseInt(url.searchParams.get('limit')) || 100;
        const offset = parseInt(url.searchParams.get('offset')) || 0;

        // Build filters from query params
        const userIdsParam = url.searchParams.get('userIds');
        const actionsParam = url.searchParams.get('actions');
        const companyIdsParam = url.searchParams.get('companyIds');

        const filters = {
          action: url.searchParams.get('action'),
          actions: actionsParam ? actionsParam.split(',').filter(a => a.trim()) : null,
          severity: url.searchParams.get('severityLevel'),
          userIds: userIdsParam ? userIdsParam.split(',').filter(id => id.trim()) : null,
          startDate: url.searchParams.get('startDate'),
          endDate: url.searchParams.get('endDate'),
          limit,
          offset
        };

        // Apply role-based access control
        if (user.role === 'master_admin') {
          // Master admin can see all logs and filter by multiple companies
          filters.companyId = url.searchParams.get('companyId') || null;
          filters.companyIds = companyIdsParam ? companyIdsParam.split(',').filter(id => id.trim()) : null;
        } else {
          // Admin can only see logs from their company
          filters.companyId = user.company_id;
        }

        const logsResult = await db.getAuditLogsDisplay(filters);

        return new Response(JSON.stringify({
          success: true,
          data: {
            data: logsResult.logs,
            pagination: {
              total: logsResult.total,
              limit: logsResult.limit,
              offset: logsResult.offset,
              hasMore: logsResult.hasMore
            }
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case path === '/api/audit/statistics' && method === 'GET': {
        // Get audit log statistics
        const statsFilters = {
          startDate: url.searchParams.get('startDate'),
          endDate: url.searchParams.get('endDate')
        };

        // Apply role-based access
        if (user.role === 'master_admin') {
          statsFilters.companyId = url.searchParams.get('companyId') || null;
        } else {
          statsFilters.companyId = user.company_id;
        }

        const stats = await db.getAuditLogStatistics(statsFilters);

        return new Response(JSON.stringify({
          success: true,
          data: stats
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case path === '/api/audit/filter-options' && method === 'GET': {
        // Get available filter options
        const filterCompanyId = user.role === 'master_admin' ? null : user.company_id;
        const filterOptions = await db.getAuditLogFilterOptions(filterCompanyId);

        return new Response(JSON.stringify({
          success: true,
          data: filterOptions
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case path === '/api/audit/log' && method === 'POST': {
        // Create audit log entry (for frontend logging)
        const body = await request.json();
        const { action, resourceType, resourceId, details } = body;

        // Get request context
        const ipAddress = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for');
        const userAgent = request.headers.get('user-agent');

        // Log the audit event
        await db.logAuditEvent(
          user.id,
          user.company_id,
          action,
          resourceType || 'FRONTEND',
          resourceId || null,
          details || {},
          ipAddress,
          userAgent,
          token
        );

        return new Response(JSON.stringify({
          success: true,
          data: { message: 'Audit log created' }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case path.startsWith('/api/audit/user/') && method === 'GET': {
        // Get user audit trail
        const userId = path.split('/')[4];

        // Verify access rights
        if (user.role === 'user' && user.id !== userId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Access denied'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Verify user is in same company (for admin)
        if (user.role === 'admin') {
          const targetUser = await db.getUserById(userId);
          if (!targetUser || targetUser.company_id !== user.company_id) {
            return new Response(JSON.stringify({
              success: false,
              error: 'User not found'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        const userFilters = {
          userId: userId,
          companyId: user.role === 'admin' ? user.company_id : null,
          limit: 100,
          offset: 0
        };

        const userAuditLogs = await db.getAuditLogsDisplay(userFilters);

        return new Response(JSON.stringify({
          success: true,
          data: {
            data: userAuditLogs.logs,
            pagination: {
              total: userAuditLogs.total,
              limit: userAuditLogs.limit,
              offset: userAuditLogs.offset,
              hasMore: userAuditLogs.hasMore
            }
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Not Found'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      console.error('Audit route error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ==================== TEST EMAIL ====================

async function handleTestEmail(request, emailService) {
  try {
    // Test Brevo connection
    await emailService.testEmailConnection();
    
    // Get email statistics
    const stats = await emailService.getEmailStatistics();
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Email service connection successful',
        brevo: {
          connected: true,
          statistics: stats
        },
        timestamp: new Date().toISOString()
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      data: {
        brevo: {
          connected: false,
          error: error.message
        },
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
async function handleTemplateValidation(request, emailService) {
  try {
    const validation = await emailService.validateAllTemplates();
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Template validation completed',
        validation,
        timestamp: new Date().toISOString()
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      data: {
        validation: {
          completed: false,
          error: error.message
        },
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ==================== HEALTH CHECK ====================

async function handleHealthCheck(request, db) {
  try {
    const isConnected = await db.testConnection();
    const stats = await db.getDatabaseStats();

    return new Response(JSON.stringify({
      success: true,
      data: {
        status: 'healthy',
        database: isConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        stats
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      data: {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ==================== USER PERMISSIONS HANDLERS ====================

/**
 * GET /api/user/permissions
 * Returns the accessible pages for the current authenticated user
 */
async function handleUserPermissions(request, authService, env, corsHeaders) {
  // Get token from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Unauthorized'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { user } = await authService.getUserFromToken(token);

    // RESTRICTIVE MODEL: Empty tables = no access (must explicitly grant)
    // Built-in pages are always available for specific roles
    let accessiblePages = new Set();

    // Add built-in pages for the user's role
    const builtinPages = ROLE_BUILTIN_PAGES[user.role] || [];
    builtinPages.forEach(page => accessiblePages.add(page));

    if (user.role === 'master_admin') {
      // Master admin has all pages via built-in - no further checks needed
    } else {
      // Get pages explicitly enabled for the company
      const companyPagesResult = await env.DB.prepare(`
        SELECT page_key FROM company_available_pages
        WHERE client_company_id = ? AND is_enabled = 1
      `).bind(user.company_id).all();

      if (companyPagesResult.results?.length > 0) {
        if (user.role === 'admin') {
          // Admin gets all company-enabled pages
          companyPagesResult.results.forEach(p => accessiblePages.add(p.page_key));
        } else {
          // For other roles, check role-specific page access
          const rolePagesResult = await env.DB.prepare(`
            SELECT page_key FROM role_page_access
            WHERE client_company_id = ? AND role_name = ?
          `).bind(user.company_id, user.role).all();

          if (rolePagesResult.results?.length > 0) {
            // Only add pages that are both company-enabled AND role-granted
            const companyPages = new Set(companyPagesResult.results.map(p => p.page_key));
            rolePagesResult.results.forEach(p => {
              if (companyPages.has(p.page_key)) {
                accessiblePages.add(p.page_key);
              }
            });
          }
          // RESTRICTIVE: If no role pages configured, user only gets built-in pages
        }
      }
      // RESTRICTIVE: If no company pages configured, user only gets built-in pages
    }

    return new Response(JSON.stringify({
      success: true,
      accessible_pages: Array.from(accessiblePages)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/company/available-pages
 * Returns the pages enabled for the user's company
 */
async function handleCompanyAvailablePages(request, authService, env, corsHeaders) {
  // Get token from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Unauthorized'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { user } = await authService.getUserFromToken(token);

    // Get all company available pages settings
    const companyPagesResult = await env.DB.prepare(`
      SELECT page_key, is_enabled, created_at, updated_at
      FROM company_available_pages
      WHERE client_company_id = ?
      ORDER BY page_key
    `).bind(user.company_id).all();

    // Define default pages (enabled by default if no explicit settings)
    const DEFAULT_PAGES = ['dashboard', 'analytics', 'reports', 'settings'];

    let availablePages = [];

    if (companyPagesResult.results?.length > 0) {
      // Map explicit settings
      availablePages = companyPagesResult.results.map(p => ({
        page_key: p.page_key,
        is_enabled: p.is_enabled === 1,
        created_at: p.created_at,
        updated_at: p.updated_at
      }));
    } else {
      // Return defaults if no explicit settings
      availablePages = DEFAULT_PAGES.map(page => ({
        page_key: page,
        is_enabled: true,
        created_at: null,
        updated_at: null
      }));
    }

    return new Response(JSON.stringify({
      success: true,
      company_id: user.company_id,
      available_pages: availablePages,
      enabled_pages: availablePages.filter(p => p.is_enabled).map(p => p.page_key)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ==================== ROLE PAGE ACCESS HANDLERS ====================

/**
 * GET /api/company/roles/:roleName/pages
 * Returns the pages accessible by a specific role within the admin's company
 * Only accessible by admin and master_admin
 */
async function handleGetRolePages(request, authService, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Extract role name from path: /api/company/roles/{roleName}/pages
  const pathParts = path.split('/');
  const roleName = decodeURIComponent(pathParts[4]);

  // Get token from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Unauthorized'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { user } = await authService.getUserFromToken(token);

    // Only admin and master_admin can view role page access
    if (!['admin', 'master_admin'].includes(user.role)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate role name - built-in configurable roles or custom roles (not master_admin or admin)
    const BUILTIN_CONFIGURABLE_ROLES = ['user', 'analyst', 'viewer'];
    const NON_CONFIGURABLE_ROLES = ['master_admin', 'admin'];

    if (NON_CONFIGURABLE_ROLES.includes(roleName)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Cannot configure page access for ${roleName}. Admin and Master Admin have full access.`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if it's a valid role (built-in configurable OR custom role for this company)
    let isValidRole = BUILTIN_CONFIGURABLE_ROLES.includes(roleName);

    if (!isValidRole) {
      const customRoleResult = await env.DB.prepare(`
        SELECT id FROM custom_roles
        WHERE client_company_id = ? AND role_name = ? AND is_active = 1
      `).bind(user.company_id, roleName).first();

      isValidRole = !!customRoleResult;
    }

    if (!isValidRole) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid role: ${roleName}. Must be a built-in role (user, analyst, viewer) or a custom role for your company.`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get pages assigned to this role for the user's company
    const rolePages = await env.DB.prepare(`
      SELECT page_key, created_at
      FROM role_page_access
      WHERE client_company_id = ? AND role_name = ?
      ORDER BY page_key
    `).bind(user.company_id, roleName).all();

    // Get company's available pages for context
    const companyPages = await env.DB.prepare(`
      SELECT page_key, is_enabled
      FROM company_available_pages
      WHERE client_company_id = ? AND is_enabled = 1
      ORDER BY page_key
    `).bind(user.company_id).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        role_name: roleName,
        company_id: user.company_id,
        assigned_pages: rolePages.results?.map(p => p.page_key) || [],
        company_available_pages: companyPages.results?.map(p => p.page_key) || []
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PUT /api/company/roles/:roleName/pages
 * Sets the pages accessible by a specific role within the admin's company
 * Only accessible by admin and master_admin
 * Request body: { pages: ['dashboard', 'analytics', 'reports'] }
 */
async function handleSetRolePages(request, authService, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Extract role name from path: /api/company/roles/{roleName}/pages
  const pathParts = path.split('/');
  const roleName = decodeURIComponent(pathParts[4]);

  // Get token from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Unauthorized'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { user } = await authService.getUserFromToken(token);

    // Only admin and master_admin can modify role page access
    if (!['admin', 'master_admin'].includes(user.role)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate role name - built-in configurable roles or custom roles (not master_admin or admin)
    const BUILTIN_CONFIGURABLE_ROLES = ['user', 'analyst', 'viewer'];
    const NON_CONFIGURABLE_ROLES = ['master_admin', 'admin'];

    if (NON_CONFIGURABLE_ROLES.includes(roleName)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Cannot configure page access for ${roleName}. Admin and Master Admin have full access.`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if it's a valid role (built-in configurable OR custom role for this company)
    let isValidRole = BUILTIN_CONFIGURABLE_ROLES.includes(roleName);

    if (!isValidRole) {
      const customRoleResult = await env.DB.prepare(`
        SELECT id FROM custom_roles
        WHERE client_company_id = ? AND role_name = ? AND is_active = 1
      `).bind(user.company_id, roleName).first();

      isValidRole = !!customRoleResult;
    }

    if (!isValidRole) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid role: ${roleName}. Must be a built-in role (user, analyst, viewer) or a custom role for your company.`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const body = await request.json();
    const pagesToAssign = body.pages || [];

    if (!Array.isArray(pagesToAssign)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'pages must be an array'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get company's available pages
    const companyPagesResult = await env.DB.prepare(`
      SELECT page_key FROM company_available_pages
      WHERE client_company_id = ? AND is_enabled = 1
    `).bind(user.company_id).all();

    const companyAvailablePages = companyPagesResult.results?.map(p => p.page_key) || [];

    // Validate that all requested pages are available to the company
    const invalidPages = pagesToAssign.filter(p => !companyAvailablePages.includes(p));
    if (invalidPages.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid pages: ${invalidPages.join(', ')}. Available pages for your company: ${companyAvailablePages.join(', ')}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get old pages for audit log
    const oldPagesResult = await env.DB.prepare(`
      SELECT page_key FROM role_page_access
      WHERE client_company_id = ? AND role_name = ?
    `).bind(user.company_id, roleName).all();
    const oldPages = oldPagesResult.results?.map(p => p.page_key) || [];

    // Delete existing role page access for this company/role
    await env.DB.prepare(`
      DELETE FROM role_page_access
      WHERE client_company_id = ? AND role_name = ?
    `).bind(user.company_id, roleName).run();

    // Insert new role page access entries
    for (const pageKey of pagesToAssign) {
      await env.DB.prepare(`
        INSERT INTO role_page_access (client_company_id, role_name, page_key, created_by)
        VALUES (?, ?, ?, ?)
      `).bind(user.company_id, roleName, pageKey, user.id).run();
    }

    // Log audit event
    const db = authService.db;
    await db.logAuditEvent(
      user.id,
      user.company_id,
      'ROLE_PAGE_ACCESS_UPDATED',
      'ROLE',
      roleName,
      {
        role_name: roleName,
        old_pages: oldPages,
        new_pages: pagesToAssign,
        updated_by: user.email
      },
      request.headers.get('CF-Connecting-IP') || 'unknown',
      request.headers.get('User-Agent') || 'unknown'
    );

    return new Response(JSON.stringify({
      success: true,
      message: `Page access updated for role: ${roleName}`,
      data: {
        role_name: roleName,
        assigned_pages: pagesToAssign,
        company_available_pages: companyAvailablePages
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ==================== CUSTOM ROLES CRUD HANDLERS ====================

// Built-in roles that cannot be modified or deleted
const BUILTIN_ROLES = ['master_admin', 'admin', 'user', 'analyst', 'viewer'];

/**
 * GET /api/company/roles
 * Returns all roles (built-in + custom) for the admin's company
 * Only accessible by admin and master_admin
 * Query params:
 *   - company_id: (master_admin only) fetch roles for a specific company
 */
async function handleGetAllRoles(request, authService, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Unauthorized'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { user } = await authService.getUserFromToken(token);

    // Only admin and master_admin can view roles
    if (!['admin', 'master_admin'].includes(user.role)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determine which company to fetch roles for
    const url = new URL(request.url);
    const requestedCompanyId = url.searchParams.get('company_id');

    // Only master_admin can fetch roles for other companies
    let targetCompanyId = user.company_id;
    if (requestedCompanyId && user.role === 'master_admin') {
      targetCompanyId = requestedCompanyId;
    }

    // Get custom roles for the company
    const customRolesResult = await env.DB.prepare(`
      SELECT id, role_name, display_name, description, base_permissions, created_by, created_at, updated_at
      FROM custom_roles
      WHERE client_company_id = ? AND is_active = 1
      ORDER BY display_name ASC
    `).bind(targetCompanyId).all();

    // Get user counts per role for this company
    const userCountsResult = await env.DB.prepare(`
      SELECT role, COUNT(*) as count
      FROM users
      WHERE company_id = ? AND is_active = 1 AND deleted_at IS NULL
      GROUP BY role
    `).bind(targetCompanyId).all();

    const userCounts = {};
    if (userCountsResult.results) {
      userCountsResult.results.forEach(r => {
        userCounts[r.role] = r.count;
      });
    }

    // Get page access for all roles in this company
    const pageAccessResult = await env.DB.prepare(`
      SELECT role_name, page_key
      FROM role_page_access
      WHERE client_company_id = ?
      ORDER BY role_name, page_key
    `).bind(targetCompanyId).all();

    // Group pages by role
    const rolePages = {};
    if (pageAccessResult.results) {
      pageAccessResult.results.forEach(r => {
        if (!rolePages[r.role_name]) {
          rolePages[r.role_name] = [];
        }
        rolePages[r.role_name].push(r.page_key);
      });
    }

    // Format built-in roles
    const builtinRoles = BUILTIN_ROLES.map(roleName => ({
      role_name: roleName,
      display_name: roleName.charAt(0).toUpperCase() + roleName.slice(1).replace('_', ' '),
      description: getBuiltinRoleDescription(roleName),
      is_builtin: true,
      user_count: userCounts[roleName] || 0,
      assigned_pages: rolePages[roleName] || [],
      page_count: (rolePages[roleName] || []).length
    }));

    // Format custom roles
    const customRoles = (customRolesResult.results || []).map(r => ({
      id: r.id,
      role_name: r.role_name,
      display_name: r.display_name || r.role_name,
      description: r.description,
      base_permissions: JSON.parse(r.base_permissions || '["read"]'),
      is_builtin: false,
      created_by: r.created_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
      user_count: userCounts[r.role_name] || 0,
      assigned_pages: rolePages[r.role_name] || [],
      page_count: (rolePages[r.role_name] || []).length
    }));

    return new Response(JSON.stringify({
      success: true,
      data: {
        builtin_roles: builtinRoles,
        custom_roles: customRoles,
        all_roles: [...builtinRoles, ...customRoles]
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

function getBuiltinRoleDescription(roleName) {
  const descriptions = {
    master_admin: 'Full system access across all companies. Can manage companies and users.',
    admin: 'Company administrator. Can manage company users and settings.',
    user: 'Standard user with access to assigned pages.',
    analyst: 'Can view and analyze data across assigned pages.',
    viewer: 'Read-only access to assigned pages.'
  };
  return descriptions[roleName] || '';
}

/**
 * POST /api/company/roles
 * Creates a new custom role for the admin's company
 * Only accessible by admin and master_admin
 */
async function handleCreateCustomRole(request, authService, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Unauthorized'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { user } = await authService.getUserFromToken(token);

    // Only admin and master_admin can create roles
    if (!['admin', 'master_admin'].includes(user.role)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { role_name, display_name, description, base_permissions } = body;

    // Validate role_name
    if (!role_name || typeof role_name !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'role_name is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalize role_name (lowercase, underscores for spaces)
    const normalizedRoleName = role_name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    if (normalizedRoleName.length < 2 || normalizedRoleName.length > 50) {
      return new Response(JSON.stringify({
        success: false,
        error: 'role_name must be between 2 and 50 characters'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if role_name conflicts with built-in roles
    if (BUILTIN_ROLES.includes(normalizedRoleName)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Cannot use reserved role name: ${normalizedRoleName}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if role_name already exists for this company
    const existingRole = await env.DB.prepare(`
      SELECT id FROM custom_roles WHERE client_company_id = ? AND role_name = ? AND is_active = 1
    `).bind(user.company_id, normalizedRoleName).first();

    if (existingRole) {
      return new Response(JSON.stringify({
        success: false,
        error: `Role "${normalizedRoleName}" already exists`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate base_permissions
    const permissions = Array.isArray(base_permissions) ? base_permissions : ['read'];
    const validPermissions = ['read', 'write', 'delete', 'manage'];
    const invalidPerms = permissions.filter(p => !validPermissions.includes(p));
    if (invalidPerms.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid permissions: ${invalidPerms.join(', ')}. Valid: ${validPermissions.join(', ')}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create the custom role
    const result = await env.DB.prepare(`
      INSERT INTO custom_roles (client_company_id, role_name, display_name, description, base_permissions, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id, role_name, display_name, description, base_permissions, created_at
    `).bind(
      user.company_id,
      normalizedRoleName,
      display_name || normalizedRoleName,
      description || '',
      JSON.stringify(permissions),
      user.id
    ).first();

    // Log audit event
    const db = authService.db;
    await db.logAuditEvent(
      user.id,
      user.company_id,
      'CUSTOM_ROLE_CREATED',
      'ROLE',
      normalizedRoleName,
      {
        role_name: normalizedRoleName,
        display_name: display_name || normalizedRoleName,
        base_permissions: permissions,
        created_by: user.email
      },
      request.headers.get('CF-Connecting-IP') || 'unknown',
      request.headers.get('User-Agent') || 'unknown'
    );

    return new Response(JSON.stringify({
      success: true,
      message: `Custom role "${display_name || normalizedRoleName}" created successfully`,
      data: {
        id: result.id,
        role_name: result.role_name,
        display_name: result.display_name,
        description: result.description,
        base_permissions: JSON.parse(result.base_permissions),
        created_at: result.created_at
      }
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PATCH /api/company/roles/:roleName
 * Updates a custom role
 * Only accessible by admin and master_admin
 */
async function handleUpdateCustomRole(request, authService, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname;
  const pathParts = path.split('/');
  const roleName = decodeURIComponent(pathParts[4]);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Unauthorized'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { user } = await authService.getUserFromToken(token);

    // Only admin and master_admin can update roles
    if (!['admin', 'master_admin'].includes(user.role)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Cannot update built-in roles
    if (BUILTIN_ROLES.includes(roleName)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot modify built-in roles'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if role exists
    const existingRole = await env.DB.prepare(`
      SELECT * FROM custom_roles WHERE client_company_id = ? AND role_name = ? AND is_active = 1
    `).bind(user.company_id, roleName).first();

    if (!existingRole) {
      return new Response(JSON.stringify({
        success: false,
        error: `Role "${roleName}" not found`
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { display_name, description, base_permissions } = body;

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (display_name !== undefined) {
      updates.push('display_name = ?');
      params.push(display_name);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (base_permissions !== undefined) {
      const validPermissions = ['read', 'write', 'delete', 'manage'];
      const invalidPerms = base_permissions.filter(p => !validPermissions.includes(p));
      if (invalidPerms.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          error: `Invalid permissions: ${invalidPerms.join(', ')}`
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      updates.push('base_permissions = ?');
      params.push(JSON.stringify(base_permissions));
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No fields to update'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Add WHERE clause params
    params.push(user.company_id, roleName);

    await env.DB.prepare(`
      UPDATE custom_roles SET ${updates.join(', ')} WHERE client_company_id = ? AND role_name = ?
    `).bind(...params).run();

    // Fetch updated role
    const updatedRole = await env.DB.prepare(`
      SELECT * FROM custom_roles WHERE client_company_id = ? AND role_name = ?
    `).bind(user.company_id, roleName).first();

    // Log audit event
    const db = authService.db;
    await db.logAuditEvent(
      user.id,
      user.company_id,
      'CUSTOM_ROLE_UPDATED',
      'ROLE',
      roleName,
      {
        role_name: roleName,
        changes: body,
        updated_by: user.email
      },
      request.headers.get('CF-Connecting-IP') || 'unknown',
      request.headers.get('User-Agent') || 'unknown'
    );

    return new Response(JSON.stringify({
      success: true,
      message: `Role "${roleName}" updated successfully`,
      data: {
        id: updatedRole.id,
        role_name: updatedRole.role_name,
        display_name: updatedRole.display_name,
        description: updatedRole.description,
        base_permissions: JSON.parse(updatedRole.base_permissions || '["read"]'),
        updated_at: updatedRole.updated_at
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * DELETE /api/company/roles/:roleName
 * Deletes a custom role (only if no users assigned)
 * Only accessible by admin and master_admin
 */
async function handleDeleteCustomRole(request, authService, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname;
  const pathParts = path.split('/');
  const roleName = decodeURIComponent(pathParts[4]);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Unauthorized'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { user } = await authService.getUserFromToken(token);

    // Only admin and master_admin can delete roles
    if (!['admin', 'master_admin'].includes(user.role)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Cannot delete built-in roles
    if (BUILTIN_ROLES.includes(roleName)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot delete built-in roles'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if role exists
    const existingRole = await env.DB.prepare(`
      SELECT * FROM custom_roles WHERE client_company_id = ? AND role_name = ? AND is_active = 1
    `).bind(user.company_id, roleName).first();

    if (!existingRole) {
      return new Response(JSON.stringify({
        success: false,
        error: `Role "${roleName}" not found`
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if any users are assigned to this role
    const usersWithRole = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM users WHERE company_id = ? AND role = ? AND is_active = 1 AND deleted_at IS NULL
    `).bind(user.company_id, roleName).first();

    if (usersWithRole && usersWithRole.count > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `Cannot delete role "${roleName}": ${usersWithRole.count} user(s) still assigned to this role`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Soft delete the role
    await env.DB.prepare(`
      UPDATE custom_roles SET is_active = 0 WHERE client_company_id = ? AND role_name = ?
    `).bind(user.company_id, roleName).run();

    // Also delete role page access entries
    await env.DB.prepare(`
      DELETE FROM role_page_access WHERE client_company_id = ? AND role_name = ?
    `).bind(user.company_id, roleName).run();

    // Log audit event
    const db = authService.db;
    await db.logAuditEvent(
      user.id,
      user.company_id,
      'CUSTOM_ROLE_DELETED',
      'ROLE',
      roleName,
      {
        role_name: roleName,
        display_name: existingRole.display_name,
        deleted_by: user.email
      },
      request.headers.get('CF-Connecting-IP') || 'unknown',
      request.headers.get('User-Agent') || 'unknown'
    );

    return new Response(JSON.stringify({
      success: true,
      message: `Role "${roleName}" deleted successfully`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ==================== USER PERMISSION OVERRIDES HANDLERS ====================

/**
 * GET /api/users/:userId/permissions
 * Returns all permissions for a specific user
 * Only accessible by admin and master_admin
 */
async function handleGetUserPermissions(request, authService, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname;
  const pathParts = path.split('/');
  const targetUserId = decodeURIComponent(pathParts[3]);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Unauthorized'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { user } = await authService.getUserFromToken(token);

    // Only admin and master_admin can view user permissions
    if (!['admin', 'master_admin'].includes(user.role)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify target user exists and belongs to same company (unless master_admin)
    const targetUser = await env.DB.prepare(`
      SELECT id, email, company_id, role FROM users WHERE id = ?
    `).bind(targetUserId).first();

    if (!targetUser) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Non-master_admin can only view permissions for users in their company
    if (user.role !== 'master_admin' && targetUser.company_id !== user.company_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Access denied: user not in your company'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's permissions
    const permissionsResult = await env.DB.prepare(`
      SELECT up.*, u.email as grantor_email
      FROM user_permissions up
      LEFT JOIN users u ON up.granted_by = u.id
      WHERE up.user_id = ? AND up.is_active = 1
      ORDER BY up.granted_at DESC
    `).bind(targetUserId).all();

    const permissions = (permissionsResult.results || []).map(p => ({
      id: p.id,
      permission: p.permission,
      resource: p.resource,
      granted_by: p.granted_by,
      grantor_email: p.grantor_email,
      granted_at: p.granted_at,
      expires_at: p.expires_at,
      is_expired: p.expires_at && new Date(p.expires_at) < new Date()
    }));

    return new Response(JSON.stringify({
      success: true,
      data: {
        user_id: targetUserId,
        user_email: targetUser.email,
        user_role: targetUser.role,
        permissions: permissions,
        active_permissions: permissions.filter(p => !p.is_expired)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/users/:userId/permissions
 * Grants a new permission to a user
 * Only accessible by admin and master_admin
 */
async function handleGrantUserPermission(request, authService, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname;
  const pathParts = path.split('/');
  const targetUserId = decodeURIComponent(pathParts[3]);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Unauthorized'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { user } = await authService.getUserFromToken(token);

    // Only admin and master_admin can grant permissions
    if (!['admin', 'master_admin'].includes(user.role)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify target user exists and belongs to same company (unless master_admin)
    const targetUser = await env.DB.prepare(`
      SELECT id, email, company_id, role FROM users WHERE id = ?
    `).bind(targetUserId).first();

    if (!targetUser) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Non-master_admin can only grant permissions to users in their company
    if (user.role !== 'master_admin' && targetUser.company_id !== user.company_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Access denied: user not in your company'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { permission, resource, expires_at } = body;

    // Validate permission
    if (!permission || typeof permission !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'permission is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Valid permission types (can be extended)
    const VALID_PERMISSIONS = [
      'page_access',      // Access to specific page
      'view_data',        // View specific data
      'export_data',      // Export data
      'manage_users',     // Manage users
      'view_audit_logs',  // View audit logs
      'custom'            // Custom permission
    ];

    const normalizedPermission = permission.toLowerCase().replace(/\s+/g, '_');

    // Check if user already has this permission
    const existingPermission = await env.DB.prepare(`
      SELECT id FROM user_permissions
      WHERE user_id = ? AND permission = ? AND (resource = ? OR (resource IS NULL AND ? IS NULL)) AND is_active = 1
    `).bind(targetUserId, normalizedPermission, resource || null, resource || null).first();

    if (existingPermission) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User already has this permission'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate expires_at if provided
    let expiresAtDate = null;
    if (expires_at) {
      expiresAtDate = new Date(expires_at);
      if (isNaN(expiresAtDate.getTime())) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid expires_at date format'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (expiresAtDate < new Date()) {
        return new Response(JSON.stringify({
          success: false,
          error: 'expires_at must be in the future'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Grant the permission
    const result = await env.DB.prepare(`
      INSERT INTO user_permissions (user_id, company_id, permission, resource, granted_by, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id, permission, resource, granted_at, expires_at
    `).bind(
      targetUserId,
      targetUser.company_id,
      normalizedPermission,
      resource || null,
      user.id,
      expiresAtDate ? expiresAtDate.toISOString() : null
    ).first();

    // Log audit event
    const db = authService.db;
    await db.logAuditEvent(
      user.id,
      user.company_id,
      'USER_PERMISSION_GRANTED',
      'USER_PERMISSION',
      result.id,
      {
        target_user_id: targetUserId,
        target_user_email: targetUser.email,
        permission: normalizedPermission,
        resource: resource,
        expires_at: expiresAtDate ? expiresAtDate.toISOString() : null,
        granted_by: user.email
      },
      request.headers.get('CF-Connecting-IP') || 'unknown',
      request.headers.get('User-Agent') || 'unknown'
    );

    return new Response(JSON.stringify({
      success: true,
      message: `Permission "${normalizedPermission}" granted to ${targetUser.email}`,
      data: {
        id: result.id,
        user_id: targetUserId,
        permission: result.permission,
        resource: result.resource,
        granted_at: result.granted_at,
        expires_at: result.expires_at
      }
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * DELETE /api/users/:userId/permissions/:permissionId
 * Revokes a specific permission from a user
 * Only accessible by admin and master_admin
 */
async function handleRevokeUserPermission(request, authService, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname;
  const pathParts = path.split('/');
  const targetUserId = decodeURIComponent(pathParts[3]);
  const permissionId = decodeURIComponent(pathParts[5]);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Unauthorized'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { user } = await authService.getUserFromToken(token);

    // Only admin and master_admin can revoke permissions
    if (!['admin', 'master_admin'].includes(user.role)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify target user exists
    const targetUser = await env.DB.prepare(`
      SELECT id, email, company_id FROM users WHERE id = ?
    `).bind(targetUserId).first();

    if (!targetUser) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Non-master_admin can only revoke permissions for users in their company
    if (user.role !== 'master_admin' && targetUser.company_id !== user.company_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Access denied: user not in your company'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify permission exists and belongs to target user
    const permission = await env.DB.prepare(`
      SELECT * FROM user_permissions WHERE id = ? AND user_id = ? AND is_active = 1
    `).bind(permissionId, targetUserId).first();

    if (!permission) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Permission not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Soft delete the permission
    await env.DB.prepare(`
      UPDATE user_permissions SET is_active = 0 WHERE id = ?
    `).bind(permissionId).run();

    // Log audit event
    const db = authService.db;
    await db.logAuditEvent(
      user.id,
      user.company_id,
      'USER_PERMISSION_REVOKED',
      'USER_PERMISSION',
      permissionId,
      {
        target_user_id: targetUserId,
        target_user_email: targetUser.email,
        permission: permission.permission,
        resource: permission.resource,
        revoked_by: user.email
      },
      request.headers.get('CF-Connecting-IP') || 'unknown',
      request.headers.get('User-Agent') || 'unknown'
    );

    return new Response(JSON.stringify({
      success: true,
      message: `Permission "${permission.permission}" revoked from ${targetUser.email}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}