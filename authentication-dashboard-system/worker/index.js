// Multi-Tenant SaaS Authentication API
// Cloudflare Worker with company-based authentication and HIPAA compliance

import { Database } from './src/database.js';
import { AuthService } from './src/auth.js';
import { EmailService } from './src/email-postmark.js';
import { SecurityService } from './src/security.js';
import { generateJWT } from './src/jwt.js';
import { checkAuthorization, ROLE_BUILTIN_PAGES, BASE_USER_PAGES, MASTER_ADMIN_ONLY_PAGES } from './src/middleware/authorization.js';
import { calculateProfit, calculateValue, markAffectedBuildingsDirty, calculateLandCost } from './src/adjacencyCalculator.js';
import { processTick } from './src/tick/processor.js';
import {
  sellToState,
  sellLandToState,
  listForSale,
  cancelListing,
  buyProperty,
  demolishBuilding,
  takeoverBuilding,
  buyLandFromOwner,
  getMarketListings
} from './src/routes/game/market.js';
import {
  performAttack,
  payFine,
  getAttackHistory,
  cleanupTrick,
  extinguishFire,
  repairBuilding
} from './src/routes/game/attacks.js';
import {
  purchaseSecurity,
  removeSecurity
} from './src/routes/game/security.js';
import { postActionCheck } from './src/routes/game/levels.js';
import {
  getHeroStatus,
  heroOut,
  joinLocation as heroJoinLocation,
  getAvailableLocations,
  getCelebrationStatus,
  leaveHeroMessage,
  getHeroMessages
} from './src/routes/game/hero.js';
import {
  getBankStatus,
  transferCash,
  getTransferHistory
} from './src/routes/game/bank.js';
import {
  handleGetModerationSettings,
  handleUpdateModerationSettings,
  handleTestModeration,
  handleTestAttackModeration,
  handleGetModerationLog,
  handleGetAttackMessages,
  handleApproveAttackMessage,
  handleRejectAttackMessage,
  moderateName
} from './src/routes/game/moderation.js';
import {
  getMessages,
  postMessage,
  getUnreadCount,
  getUnreadCountsForUser,
  markMessagesAsRead,
  donate,
  getDonationLeaderboard,
  playRoulette,
  highlightCompany
} from './src/routes/game/social.js';
import {
  getAvatarItems,
  updateAvatar,
  getAvatarImage,
} from './src/routes/game/avatar.js';
import {
  getAchievements,
  checkAchievements,
  getUserBadges,
} from './src/routes/game/achievements.js';
import { getMapStatistics, getCompanyStatistics, getCompanyProperties } from './src/routes/game/statistics.js';
import { getMapEvents, getMapCompanies } from './src/routes/game/events.js';
import { handleHeartbeat } from './src/routes/game/heartbeat.js';
import { handleAssetRoutes } from './src/routes/admin/assets.js';
import {
  startBlackjackGame,
  blackjackHit,
  blackjackStand,
  blackjackDouble,
  getBlackjackGame
} from './src/routes/game/blackjack.js';

// Helper to get active company from request (used by social endpoints)
// For GET requests, reads company_id from query params
// For POST requests, caller should pass parsedBody containing company_id
async function getActiveCompany(authService, env, request, parsedBody = null) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authentication required');
  }

  const token = authHeader.split(' ')[1];
  const { user } = await authService.getUserFromToken(token);

  // Get company_id from query params (GET) or parsed body (POST)
  let companyId;
  if (request.method === 'GET') {
    const url = new URL(request.url);
    companyId = url.searchParams.get('company_id');
  } else if (parsedBody) {
    companyId = parsedBody.company_id;
  }

  if (!companyId) {
    throw new Error('company_id is required');
  }

  const company = await env.DB.prepare(`
    SELECT * FROM game_companies WHERE id = ? AND user_id = ?
  `).bind(companyId, user.id).first();

  if (!company) {
    throw new Error('Company not found or access denied');
  }

  return company;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    // Enhanced CORS headers for SaaS dashboard
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
    const publicPaths = ['/api/health', '/api/webhooks', '/api/auth/login', '/api/auth/magic-link', '/api/assets/base-ground/active'];
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

    // Health check endpoint (master_admin only)
        case path === '/api/health':
          return handleHealthCheck(request, authService, db, corsHeaders);

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


        // ==================== ADMIN MAP BUILDER ENDPOINTS ====================
        case path === '/api/admin/maps' && method === 'GET':
          return handleGetMaps(request, authService, env, corsHeaders);

        case path === '/api/admin/maps' && method === 'POST':
          return handleCreateMap(request, authService, env, corsHeaders);

        case path.match(/^\/api\/admin\/maps\/[^/]+$/) && method === 'GET':
          return handleGetMap(request, authService, env, corsHeaders);

        case path.match(/^\/api\/admin\/maps\/[^/]+$/) && method === 'PUT':
          return handleUpdateMap(request, authService, env, corsHeaders);

        case path.match(/^\/api\/admin\/maps\/[^/]+$/) && method === 'DELETE':
          return handleDeleteMap(request, authService, env, corsHeaders);

        case path.match(/^\/api\/admin\/maps\/[^/]+\/tiles$/) && method === 'PUT':
          return handleUpdateTiles(request, authService, env, corsHeaders);

        // ==================== ADMIN ASSET PIPELINE ENDPOINTS ====================
        // PUBLIC: Reference library serve endpoint (no auth required for displaying images)
        case path.startsWith('/api/admin/assets/reference-library/serve/'): {
          // Extract R2 key from path: /api/admin/assets/reference-library/serve/{encoded-key}
          const servePrefix = '/api/admin/assets/reference-library/serve/';
          const encodedKey = path.slice(servePrefix.length);
          const r2Key = decodeURIComponent(encodedKey);

          const imageObject = await env.R2_PRIVATE.get(r2Key);

          if (!imageObject) {
            return new Response(JSON.stringify({ success: false, error: 'Image not found' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Return the image directly with appropriate headers
          const imageHeaders = new Headers(corsHeaders);
          imageHeaders.set('Content-Type', imageObject.httpMetadata?.contentType || 'image/png');
          imageHeaders.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

          return new Response(imageObject.body, { headers: imageHeaders });
        }

        // PUBLIC: Get active base ground URL (no auth required for game client)
        case path === '/api/assets/base-ground/active' && method === 'GET': {
          const result = await env.DB.prepare(`
            SELECT
              ac.asset_key,
              ac.active_sprite_id,
              ga.r2_url as sprite_url
            FROM asset_configurations ac
            LEFT JOIN generated_assets ga ON ac.active_sprite_id = ga.id
            WHERE ac.category = 'base_ground' AND ac.is_active = TRUE
            LIMIT 1
          `).first();

          return new Response(JSON.stringify({
            success: true,
            base_ground: result ? {
              asset_key: result.asset_key,
              sprite_url: result.sprite_url
            } : null
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
          });
        }

        // AUTH: Get all published building sprites (requires JWT)
        case path === '/api/assets/buildings/published' && method === 'GET': {
          if (!currentUser) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
              status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Default map scales per building type (must match BUILDING_SIZE_CLASSES in assets.js)
          const DEFAULT_MAP_SCALES = {
            claim_stake: 0.2,
            demolished: 0.4,
            market_stall: 0.4,
            hot_dog_stand: 0.4,
            campsite: 0.4,
            shop: 0.6,
            burger_bar: 0.6,
            motel: 0.6,
            high_street_store: 0.8,
            restaurant: 0.8,
            manor: 0.8,
            police_station: 0.8,
            casino: 1.0,
            temple: 1.0,
            bank: 1.0
          };

          const results = await env.DB.prepare(`
            SELECT
              bc.building_type_id as asset_key,
              ga.r2_url as sprite_url,
              ga.outline_url,
              bc.map_scale
            FROM building_configurations bc
            INNER JOIN generated_assets ga ON bc.active_sprite_id = ga.id
            WHERE bc.is_published = TRUE
              AND ga.r2_url IS NOT NULL
          `).all();

          // Convert to a map for easy lookup by the client
          // Apply default map_scale when database value is null
          const sprites = {};
          for (const row of results.results) {
            sprites[row.asset_key] = {
              url: row.sprite_url,
              outline_url: row.outline_url,
              map_scale: row.map_scale ?? DEFAULT_MAP_SCALES[row.asset_key] ?? 1.0
            };
          }

          return new Response(JSON.stringify({
            success: true,
            sprites
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' }
          });
        }

        // ==================== AUTHENTICATED ASSET ENDPOINTS ====================
        // These require a valid JWT token (for logged-in game users)

        // AUTH: Get all published NPC sprites
        case path === '/api/assets/npcs/published' && method === 'GET': {
          if (!currentUser) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
              status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          const results = await env.DB.prepare(`
            SELECT ac.asset_key, ga.r2_url as sprite_url, ac.config
            FROM asset_configurations ac
            INNER JOIN generated_assets ga ON ac.active_sprite_id = ga.id
            WHERE ac.category = 'npc' AND ac.is_published = TRUE AND ga.r2_url IS NOT NULL
          `).all();
          const sprites = {};
          for (const row of results.results) {
            sprites[row.asset_key] = {
              url: row.sprite_url,
              config: row.config ? JSON.parse(row.config) : null
            };
          }
          return new Response(JSON.stringify({ success: true, sprites }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' }
          });
        }

        // AUTH: Get all published terrain sprites
        case path === '/api/assets/terrain/published' && method === 'GET': {
          if (!currentUser) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
              status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          const results = await env.DB.prepare(`
            SELECT ac.asset_key, ga.r2_url as sprite_url, ac.config
            FROM asset_configurations ac
            INNER JOIN generated_assets ga ON ac.active_sprite_id = ga.id
            WHERE ac.category = 'terrain' AND ac.is_published = TRUE AND ga.r2_url IS NOT NULL
          `).all();
          const sprites = {};
          for (const row of results.results) {
            sprites[row.asset_key] = {
              url: row.sprite_url,
              config: row.config ? JSON.parse(row.config) : null
            };
          }
          return new Response(JSON.stringify({ success: true, sprites }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' }
          });
        }

        // AUTH: Get all published vehicle sprites
        case path === '/api/assets/vehicles/published' && method === 'GET': {
          if (!currentUser) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
              status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          const results = await env.DB.prepare(`
            SELECT ac.asset_key, ga.r2_url as sprite_url, ac.config
            FROM asset_configurations ac
            INNER JOIN generated_assets ga ON ac.active_sprite_id = ga.id
            WHERE ac.category = 'vehicle' AND ac.is_published = TRUE AND ga.r2_url IS NOT NULL
          `).all();
          const sprites = {};
          for (const row of results.results) {
            sprites[row.asset_key] = {
              url: row.sprite_url,
              config: row.config ? JSON.parse(row.config) : null
            };
          }
          return new Response(JSON.stringify({ success: true, sprites }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' }
          });
        }

        // AUTH: Get all published dirty trick sprites (visual effect overlays for buildings)
        case path === '/api/assets/dirty-tricks/published' && method === 'GET': {
          if (!currentUser) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
              status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          // Fetch dirty tricks from effects category
          const results = await env.DB.prepare(`
            SELECT ac.asset_key, ga.r2_url as sprite_url
            FROM asset_configurations ac
            INNER JOIN generated_assets ga ON ac.active_sprite_id = ga.id
            WHERE ac.category = 'effects'
              AND ac.is_published = TRUE
              AND ga.r2_url IS NOT NULL
          `).all();

          // Map each trick to { icon: null, overlay: sprite_url }
          const tricks = {};
          for (const row of results.results) {
            tricks[row.asset_key] = {
              icon: null,
              overlay: row.sprite_url
            };
          }
          return new Response(JSON.stringify({ success: true, tricks }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' }
          });
        }

        // AUTH: Get all published effect sprites (general visual effects)
        case path === '/api/assets/effects/published' && method === 'GET': {
          if (!currentUser) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
              status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          const results = await env.DB.prepare(`
            SELECT ac.asset_key, ga.r2_url as sprite_url, ac.config
            FROM asset_configurations ac
            INNER JOIN generated_assets ga ON ac.active_sprite_id = ga.id
            WHERE ac.category = 'effect' AND ac.is_published = TRUE AND ga.r2_url IS NOT NULL
          `).all();
          const sprites = {};
          for (const row of results.results) {
            sprites[row.asset_key] = {
              url: row.sprite_url,
              config: row.config ? JSON.parse(row.config) : null
            };
          }
          return new Response(JSON.stringify({ success: true, sprites }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' }
          });
        }

        case path.startsWith('/api/admin/assets'):
          // Get user from token for audit logging
          const assetAuthHeader = request.headers.get('Authorization');
          if (!assetAuthHeader || !assetAuthHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Authentication required' }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          const assetToken = assetAuthHeader.split(' ')[1];
          const { user: assetUser } = await authService.getUserFromToken(assetToken);
          if (!assetUser || assetUser.role !== 'master_admin') {
            return new Response(JSON.stringify({ error: 'Master admin access required' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          const assetResponse = await handleAssetRoutes(request, env, path, method, assetUser, ctx);
          // Add CORS headers to response
          const assetHeaders = new Headers(assetResponse.headers);
          Object.entries(corsHeaders).forEach(([key, value]) => assetHeaders.set(key, value));
          return new Response(assetResponse.body, {
            status: assetResponse.status,
            headers: assetHeaders
          });

        // ==================== GAME MODERATION ADMIN ENDPOINTS ====================
        case path === '/api/game/moderation/settings' && method === 'GET':
          return handleGetModerationSettings(request, authService, env, corsHeaders);

        case path === '/api/game/moderation/settings' && method === 'PUT':
          return handleUpdateModerationSettings(request, authService, env, corsHeaders);

        case path === '/api/game/moderation/test' && method === 'POST':
          return handleTestModeration(request, authService, env, corsHeaders);

        case path === '/api/game/moderation/test-attack' && method === 'POST':
          return handleTestAttackModeration(request, authService, env, corsHeaders);

        case path === '/api/game/moderation/log' && method === 'GET':
          return handleGetModerationLog(request, authService, env, corsHeaders);

        case path === '/api/game/moderation/attack-messages' && method === 'GET':
          return handleGetAttackMessages(request, authService, env, corsHeaders);

        case path === '/api/game/moderation/attack-messages/approve' && method === 'POST':
          return handleApproveAttackMessage(request, authService, env, corsHeaders);

        case path === '/api/game/moderation/attack-messages/reject' && method === 'POST':
          return handleRejectAttackMessage(request, authService, env, corsHeaders);

        // ==================== GAME COMPANY ENDPOINTS ====================
        case path.startsWith('/api/game/companies'):
          return handleGameCompanyRoutes(request, authService, env, corsHeaders);

        case path === '/api/game/maps' && method === 'GET':
          return handleGetGameMaps(request, authService, env, corsHeaders);

        case path.match(/^\/api\/game\/maps\/[^/]+\/tile\/\d+\/\d+$/) && method === 'GET':
          return handleGetTileDetail(request, authService, env, corsHeaders);

        case path.match(/^\/api\/game\/maps\/[^/]+$/) && method === 'GET':
          return handleGetGameMapById(request, authService, env, corsHeaders);

        // ==================== GAME LAND & BUILDING ENDPOINTS ====================
        case path === '/api/game/land/buy' && method === 'POST':
          return handleBuyLand(request, authService, env, corsHeaders);

        case path === '/api/game/buildings/build' && method === 'POST':
          return handleBuildBuilding(request, authService, env, corsHeaders);

        case path === '/api/game/buildings/types' && method === 'GET':
          return handleGetBuildingTypes(request, authService, env, corsHeaders);

        case path === '/api/game/buildings/preview-profit' && method === 'GET':
          return handlePreviewProfit(request, authService, env, corsHeaders);

        // ==================== GAME MARKET ENDPOINTS ====================
        case path === '/api/game/market/sell-to-state' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, sellToState);

        case path === '/api/game/market/sell-land-to-state' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, sellLandToState);

        case path === '/api/game/market/list-for-sale' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, listForSale);

        case path === '/api/game/market/cancel-listing' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, cancelListing);

        case path === '/api/game/market/buy-property' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, buyProperty);

        case path === '/api/game/market/demolish' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, demolishBuilding);

        case path === '/api/game/market/takeover' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, takeoverBuilding);

        case path === '/api/game/market/buy-land-from-owner' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, buyLandFromOwner);

        case path === '/api/game/market/listings' && method === 'GET':
          return handleMarketListings(request, env, corsHeaders);

        // ==================== GAME ATTACK ENDPOINTS ====================
        case path === '/api/game/attacks' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, performAttack);

        case path === '/api/game/attacks/pay-fine' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, payFine);

        case path === '/api/game/attacks/history' && method === 'GET':
          return handleAttackHistory(request, authService, env, corsHeaders);

        case path === '/api/game/buildings/cleanup' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, cleanupTrick);

        case path === '/api/game/buildings/extinguish' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, extinguishFire);

        case path === '/api/game/buildings/repair' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, repairBuilding);

        // ==================== GAME HEARTBEAT ENDPOINT ====================
        case path === '/api/game/heartbeat' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, handleHeartbeat);

        // ==================== GAME SECURITY ENDPOINTS ====================
        case path === '/api/game/security/purchase' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, purchaseSecurity);

        case path === '/api/game/security/remove' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, removeSecurity);

        // ==================== GAME HERO ENDPOINTS ====================
        case path === '/api/game/hero/status' && method === 'GET':
          return handleHeroGetAction(request, authService, env, corsHeaders, getHeroStatus);

        case path === '/api/game/hero/hero-out' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, heroOut);

        case path === '/api/game/hero/join-location' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, heroJoinLocation);

        case path === '/api/game/hero/available-locations' && method === 'GET':
          return handleHeroGetAction(request, authService, env, corsHeaders, getAvailableLocations);

        case path === '/api/game/hero/celebration-status' && method === 'GET':
          return handleCelebrationStatusAction(request, authService, env, corsHeaders, getCelebrationStatus);

        case path === '/api/game/hero/leave-message' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, leaveHeroMessage);

        case path === '/api/game/hero/messages' && method === 'GET':
          return handleHeroGetAction(request, authService, env, corsHeaders, getHeroMessages);

        // ==================== GAME BANK ENDPOINTS ====================
        case path === '/api/game/bank/status' && method === 'GET':
          return handleHeroGetAction(request, authService, env, corsHeaders, getBankStatus);

        case path === '/api/game/bank/transfer' && method === 'POST':
          return handleMarketAction(request, authService, env, corsHeaders, transferCash);

        case path === '/api/game/bank/history' && method === 'GET':
          return handleHeroGetAction(request, authService, env, corsHeaders, getTransferHistory);

        // ==================== SOCIAL ENDPOINTS ====================
        case path === '/api/game/messages' && method === 'GET': {
          const company = await getActiveCompany(authService, env, request);
          const url = new URL(request.url);
          const page = parseInt(url.searchParams.get('page') || '1');
          const messages = await getMessages(env, company.current_map_id, company.id, page);
          return new Response(JSON.stringify({ success: true, data: messages }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/messages' && method === 'POST': {
          const company = await getActiveCompany(authService, env, request, requestBody);
          const result = await postMessage(env, company, requestBody.content);
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/messages/unread' && method === 'GET': {
          const company = await getActiveCompany(authService, env, request);
          const result = await getUnreadCount(env, company);
          return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/messages/unread-all' && method === 'GET': {
          const authHeader = request.headers.get('Authorization');
          const token = authHeader.split(' ')[1];
          const { user } = await authService.getUserFromToken(token);
          const result = await getUnreadCountsForUser(env, user.id);
          return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/messages/read' && method === 'POST': {
          const company = await getActiveCompany(authService, env, request, requestBody);
          const result = await markMessagesAsRead(env, company);
          return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // ==================== STATISTICS ENDPOINTS ====================
        case path === '/api/game/statistics' && method === 'GET': {
          const company = await getActiveCompany(authService, env, request);
          if (!company.current_map_id) {
            throw new Error('Company must be in a location to view statistics');
          }
          const result = await getMapStatistics(env, company.current_map_id);
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/statistics/properties' && method === 'GET': {
          const company = await getActiveCompany(authService, env, request);
          if (!company.current_map_id) {
            throw new Error('Company must be in a location to view properties');
          }
          const result = await getCompanyProperties(env, company.id);
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // ==================== EVENTS ENDPOINTS ====================
        case path === '/api/game/events' && method === 'GET': {
          const company = await getActiveCompany(authService, env, request);
          if (!company.current_map_id) {
            throw new Error('Company must be in a location to view events');
          }
          const url = new URL(request.url);
          const byCompanyId = url.searchParams.get('by') || undefined;
          const toCompanyId = url.searchParams.get('to') || undefined;
          const limit = parseInt(url.searchParams.get('limit') || '25', 10);
          const offset = parseInt(url.searchParams.get('offset') || '0', 10);

          const result = await getMapEvents(env, company.current_map_id, company.id, {
            byCompanyId,
            toCompanyId,
            limit,
            offset
          });
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/events/companies' && method === 'GET': {
          const company = await getActiveCompany(authService, env, request);
          if (!company.current_map_id) {
            throw new Error('Company must be in a location');
          }
          const companies = await getMapCompanies(env, company.current_map_id);
          return new Response(JSON.stringify({ success: true, data: companies }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/temple/donate' && method === 'POST': {
          const company = await getActiveCompany(authService, env, request, requestBody);
          const result = await donate(env, company, requestBody.amount);
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/temple/leaderboard' && method === 'GET': {
          const leaderboard = await getDonationLeaderboard(env);
          return new Response(JSON.stringify({ success: true, data: leaderboard }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/casino/roulette' && method === 'POST': {
          const company = await getActiveCompany(authService, env, request, requestBody);
          const result = await playRoulette(env, company, requestBody.bet_amount, requestBody.bet_type, requestBody.bet_value);
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // ==================== HIGHLIGHT ENDPOINTS ====================
        case path === '/api/game/highlight' && method === 'POST': {
          const company = await getActiveCompany(authService, env, request, requestBody);
          const result = await highlightCompany(env, company, requestBody.target_company_id);
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // ==================== BLACKJACK ENDPOINTS ====================
        case path === '/api/game/casino/blackjack/start' && method === 'POST': {
          const company = await getActiveCompany(authService, env, request, requestBody);
          const result = await startBlackjackGame(env, company, requestBody.bet_amount);
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/casino/blackjack/hit' && method === 'POST': {
          const company = await getActiveCompany(authService, env, request, requestBody);
          const result = await blackjackHit(env, company, requestBody.game_id);
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/casino/blackjack/stand' && method === 'POST': {
          const company = await getActiveCompany(authService, env, request, requestBody);
          const result = await blackjackStand(env, company, requestBody.game_id);
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/casino/blackjack/double' && method === 'POST': {
          const company = await getActiveCompany(authService, env, request, requestBody);
          const result = await blackjackDouble(env, company, requestBody.game_id);
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/casino/blackjack/game' && method === 'GET': {
          const company = await getActiveCompany(authService, env, request);
          const url = new URL(request.url);
          const gameId = url.searchParams.get('game_id');
          const result = await getBlackjackGame(env, company, gameId);
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // ==================== AVATAR ENDPOINTS ====================
        case path === '/api/game/avatar/items' && method === 'GET': {
          const authHeader = request.headers.get('Authorization');
          const token = authHeader.split(' ')[1];
          const { user } = await authService.getUserFromToken(token);
          const url = new URL(request.url);
          const companyId = url.searchParams.get('company_id');
          if (!companyId) throw new Error('company_id is required');

          const result = await getAvatarItems(env, user.id, companyId);
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/avatar/update' && method === 'POST': {
          const authHeader = request.headers.get('Authorization');
          const token = authHeader.split(' ')[1];
          const { user } = await authService.getUserFromToken(token);
          const { company_id, category, item_id } = await request.json();
          if (!company_id) throw new Error('company_id is required');

          // Verify company belongs to user
          const company = await env.DB.prepare(
            'SELECT id FROM game_companies WHERE id = ? AND user_id = ?'
          ).bind(company_id, user.id).first();
          if (!company) throw new Error('Company not found');

          const result = await updateAvatar(env, user.id, company_id, category, item_id);
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/avatar/image' && method === 'GET': {
          const url = new URL(request.url);
          const companyId = url.searchParams.get('company_id');
          if (!companyId) throw new Error('company_id is required');

          const result = await getAvatarImage(env, companyId);
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // ==================== ACHIEVEMENT ENDPOINTS ====================
        case path === '/api/game/achievements' && method === 'GET': {
          const authHeader = request.headers.get('Authorization');
          const token = authHeader.split(' ')[1];
          const { user } = await authService.getUserFromToken(token);

          const result = await getAchievements(env, user.id);
          return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/achievements/check' && method === 'POST': {
          const authHeader = request.headers.get('Authorization');
          const token = authHeader.split(' ')[1];
          const { user } = await authService.getUserFromToken(token);

          const result = await checkAchievements(env, user.id);
          return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/achievements/badges' && method === 'GET': {
          const authHeader = request.headers.get('Authorization');
          const token = authHeader.split(' ')[1];
          const { user } = await authService.getUserFromToken(token);

          const result = await getUserBadges(env, user.id);
          return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

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
  },

  /**
   * Scheduled handler for cron triggers
   * Runs every 10 minutes to process game tick
   */
  async scheduled(event, env, ctx) {
    console.log('Cron trigger fired:', event.cron);

    try {
      const result = await processTick(env);
      console.log('Tick processing completed:', result);
    } catch (err) {
      console.error('Tick processing failed:', err);
      // Don't throw - let the cron continue scheduling
    }
  }
};

// ==================== AUTHENTICATION HANDLERS ====================

async function handleLogin(request, authService, emailService, env, securityService, clientIP) {
  const { email, password, twoFactorToken } = await request.json();

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
    'Access-Control-Allow-Origin': authService.env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
    'Access-Control-Allow-Origin': authService.env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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

    // Get current session to identify which one is active
    const currentSession = await db.getSessionByToken(token);
    const currentSessionId = currentSession?.session_id;

    // Transform sessions to match frontend expectations
    const transformedSessions = sessions.map(session => ({
      id: session.id,
      device_info: session.device_name || `${session.browser || 'Unknown'} on ${session.os || 'Unknown'}`,
      ip_address: session.ip_address || 'Unknown',
      last_active_at: session.created_at,
      created_at: session.created_at,
      is_current: session.id === currentSessionId
    }));

    return new Response(JSON.stringify({
      success: true,
      sessions: transformedSessions
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
    'Access-Control-Allow-Origin': authService.env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
    'Access-Control-Allow-Origin': authService.env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
    'Access-Control-Allow-Origin': authService.env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
        
        // Authorization: Master admin only
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
    'Access-Control-Allow-Origin': authService.env.CORS_ORIGIN || 'https://bossmode.notropolis.net',
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
  // Other audit endpoints require master_admin access only
  const isPostLogEndpoint = path === '/api/audit/log' && method === 'POST';

  if (!isPostLogEndpoint && user.role !== 'master_admin') {
    return new Response(JSON.stringify({
      success: false,
      error: 'Master admin access required'
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

// ==================== HEALTH CHECK (MASTER ADMIN ONLY) ====================

async function handleHealthCheck(request, authService, db, corsHeaders) {
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

    if (user.role !== 'master_admin') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Master admin access required'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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

    // Add base pages that ALL authenticated users can access
    BASE_USER_PAGES.forEach(page => accessiblePages.add(page));

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

      // Remove master-admin-only pages for all other users (prevents database misconfig from granting access)
      MASTER_ADMIN_ONLY_PAGES.forEach(page => accessiblePages.delete(page));
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

// ==================== ADMIN MAP BUILDER HANDLERS ====================

/**
 * GET /api/admin/maps
 * Returns all maps for the admin
 */
async function handleGetMaps(request, authService, env, corsHeaders) {
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

    // Only master_admin can access
    if (user.role !== 'master_admin') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = await env.DB.prepare(`
      SELECT id, name, country, location_type, width, height,
             hero_net_worth, hero_cash, hero_land_percentage,
             police_strike_day, is_active, created_at
      FROM maps
      ORDER BY created_at DESC
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: result.results || []
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
 * POST /api/admin/maps
 * Creates a new map with auto-generated tiles
 */
async function handleCreateMap(request, authService, env, corsHeaders) {
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

    if (user.role !== 'master_admin') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const {
      name,
      country,
      location_type,
      width,
      height,
      hero_net_worth,
      hero_cash,
      hero_land_percentage,
      police_strike_day
    } = body;

    // Validate required fields
    if (!name || !country || !location_type || !width || !height) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: name, country, location_type, width, height'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate dimensions
    if (width < 1 || width > 100 || height < 1 || height > 100) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Width and height must be between 1 and 100'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate location_type
    if (!['town', 'city', 'capital'].includes(location_type)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'location_type must be one of: town, city, capital'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate map ID
    const mapId = crypto.randomUUID();

    // Create the map
    await env.DB.prepare(`
      INSERT INTO maps (id, name, country, location_type, width, height,
                        hero_net_worth, hero_cash, hero_land_percentage,
                        police_strike_day, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `).bind(
      mapId,
      name,
      country,
      location_type,
      width,
      height,
      hero_net_worth || 5500000,
      hero_cash || 4000000,
      hero_land_percentage || 6.0,
      police_strike_day ?? 3
    ).run();

    // Generate all tiles with free_land as default terrain
    const tileInserts = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        tileInserts.push({
          id: crypto.randomUUID(),
          map_id: mapId,
          x,
          y,
          terrain_type: 'free_land'
        });
      }
    }

    // OPTIMAL: Use batch() with chunked multi-value INSERT
    // D1 limit: 100 bind parameters per query → max 20 rows per INSERT (20 × 5 = 100)
    // batch() sends all statements in a single network call
    // Benchmark: 10,000 tiles in ~100-200ms vs 3000ms with sequential calls
    const CHUNK_SIZE = 20; // 20 rows × 5 params = 100 (at D1's limit)
    const statements = [];
    for (let i = 0; i < tileInserts.length; i += CHUNK_SIZE) {
      const chunk = tileInserts.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ');
      const values = chunk.flatMap(t => [t.id, t.map_id, t.x, t.y, t.terrain_type]);
      statements.push(
        env.DB.prepare(`INSERT INTO tiles (id, map_id, x, y, terrain_type) VALUES ${placeholders}`).bind(...values)
      );
    }
    // Single batch() call - all statements execute in one network round trip
    await env.DB.batch(statements);

    // Fetch the created map
    const createdMap = await env.DB.prepare(`
      SELECT * FROM maps WHERE id = ?
    `).bind(mapId).first();

    return new Response(JSON.stringify({
      success: true,
      data: {
        map: createdMap,
        tiles_created: width * height
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
 * GET /api/admin/maps/:id
 * Returns a specific map with all its tiles
 */
async function handleGetMap(request, authService, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname;
  const mapId = path.split('/')[4]; // /api/admin/maps/:id

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

    if (user.role !== 'master_admin') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get map
    const map = await env.DB.prepare(`
      SELECT * FROM maps WHERE id = ?
    `).bind(mapId).first();

    if (!map) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Map not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get tiles
    const tilesResult = await env.DB.prepare(`
      SELECT id, x, y, terrain_type, special_building, owner_company_id, purchased_at
      FROM tiles
      WHERE map_id = ?
      ORDER BY y, x
    `).bind(mapId).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        map,
        tiles: tilesResult.results || []
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
 * PUT /api/admin/maps/:id
 * Updates map metadata
 */
async function handleUpdateMap(request, authService, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname;
  const mapId = path.split('/')[4];

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

    if (user.role !== 'master_admin') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check map exists
    const existingMap = await env.DB.prepare(`
      SELECT * FROM maps WHERE id = ?
    `).bind(mapId).first();

    if (!existingMap) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Map not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const {
      name,
      country,
      location_type,
      hero_net_worth,
      hero_cash,
      hero_land_percentage,
      police_strike_day,
      is_active
    } = body;

    // Validate location_type if provided
    if (location_type && !['town', 'city', 'capital'].includes(location_type)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'location_type must be one of: town, city, capital'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (country !== undefined) { updates.push('country = ?'); values.push(country); }
    if (location_type !== undefined) { updates.push('location_type = ?'); values.push(location_type); }
    if (hero_net_worth !== undefined) { updates.push('hero_net_worth = ?'); values.push(hero_net_worth); }
    if (hero_cash !== undefined) { updates.push('hero_cash = ?'); values.push(hero_cash); }
    if (hero_land_percentage !== undefined) { updates.push('hero_land_percentage = ?'); values.push(hero_land_percentage); }
    if (police_strike_day !== undefined) { updates.push('police_strike_day = ?'); values.push(police_strike_day); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0); }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No fields to update'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    values.push(mapId);

    await env.DB.prepare(`
      UPDATE maps SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();

    // Fetch updated map
    const updatedMap = await env.DB.prepare(`
      SELECT * FROM maps WHERE id = ?
    `).bind(mapId).first();

    return new Response(JSON.stringify({
      success: true,
      data: updatedMap
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
 * DELETE /api/admin/maps/:id
 * Deletes a map (only if no players)
 */
async function handleDeleteMap(request, authService, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname;
  const mapId = path.split('/')[4];

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

    if (user.role !== 'master_admin') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check map exists
    const existingMap = await env.DB.prepare(`
      SELECT * FROM maps WHERE id = ?
    `).bind(mapId).first();

    if (!existingMap) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Map not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if any companies are on this map
    const companiesOnMap = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM game_companies WHERE current_map_id = ?
    `).bind(mapId).first();

    if (companiesOnMap && companiesOnMap.count > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot delete map with active players. Remove all players first.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Delete tiles first (foreign key)
    await env.DB.prepare(`
      DELETE FROM tiles WHERE map_id = ?
    `).bind(mapId).run();

    // Delete the map
    await env.DB.prepare(`
      DELETE FROM maps WHERE id = ?
    `).bind(mapId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Map deleted successfully'
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
 * PUT /api/admin/maps/:id/tiles
 * Bulk update tiles (for painting terrain and placing buildings)
 */
async function handleUpdateTiles(request, authService, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname;
  const mapId = path.split('/')[4]; // /api/admin/maps/:id/tiles

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

    if (user.role !== 'master_admin') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check map exists
    const existingMap = await env.DB.prepare(`
      SELECT * FROM maps WHERE id = ?
    `).bind(mapId).first();

    if (!existingMap) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Map not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { tiles } = body;

    if (!Array.isArray(tiles) || tiles.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'tiles must be a non-empty array'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const validTerrainTypes = ['free_land', 'water', 'road', 'dirt_track', 'trees'];
    const validSpecialBuildings = ['temple', 'bank', 'police_station', 'casino', null];

    // Check for special building constraints (max 1 of each type per map)
    const specialBuildingsToAdd = tiles
      .filter(t => t.special_building && validSpecialBuildings.includes(t.special_building))
      .map(t => t.special_building);

    if (specialBuildingsToAdd.length > 0) {
      // Get current special buildings on map
      const existingSpecial = await env.DB.prepare(`
        SELECT x, y, special_building FROM tiles
        WHERE map_id = ? AND special_building IS NOT NULL
      `).bind(mapId).all();

      // Check each special building type
      for (const building of specialBuildingsToAdd) {
        const existingOfType = (existingSpecial.results || []).find(t => t.special_building === building);
        const addingTile = tiles.find(t => t.special_building === building);

        if (existingOfType) {
          // Check if we're moving the building (updating same position is ok)
          const isUpdatingSame = addingTile &&
            existingOfType.x === addingTile.x &&
            existingOfType.y === addingTile.y;

          if (!isUpdatingSame) {
            // Remove old building when placing new one of same type
            await env.DB.prepare(`
              UPDATE tiles SET special_building = NULL
              WHERE map_id = ? AND special_building = ?
            `).bind(mapId, building).run();
          }
        }
      }
    }

    // Update each tile
    let updatedCount = 0;
    for (const tile of tiles) {
      const { x, y, terrain_type, special_building } = tile;

      // Validate coordinates
      if (x < 0 || x >= existingMap.width || y < 0 || y >= existingMap.height) {
        continue; // Skip invalid coordinates
      }

      // Validate terrain_type
      if (terrain_type && !validTerrainTypes.includes(terrain_type)) {
        continue; // Skip invalid terrain types
      }

      // Validate special_building
      if (special_building !== undefined && !validSpecialBuildings.includes(special_building)) {
        continue; // Skip invalid special buildings
      }

      // Build update
      const updates = [];
      const values = [];

      if (terrain_type) {
        updates.push('terrain_type = ?');
        values.push(terrain_type);
      }

      if (special_building !== undefined) {
        updates.push('special_building = ?');
        values.push(special_building);
      }

      if (updates.length > 0) {
        values.push(mapId, x, y);
        await env.DB.prepare(`
          UPDATE tiles SET ${updates.join(', ')} WHERE map_id = ? AND x = ? AND y = ?
        `).bind(...values).run();
        updatedCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        updated_count: updatedCount
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

// ==================== GAME COMPANY HANDLERS ====================

/**
 * GET /api/game/maps
 * Returns all active maps for players to join (public endpoint for authenticated users)
 */
async function handleGetGameMaps(request, authService, env, corsHeaders) {
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
    await authService.getUserFromToken(token);

    // Get all active maps for players
    const result = await env.DB.prepare(`
      SELECT id, name, country, location_type, width, height,
             hero_net_worth, hero_cash, hero_land_percentage,
             police_strike_day, created_at
      FROM maps
      WHERE is_active = 1
      ORDER BY country, location_type, name
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: result.results || []
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
 * GET /api/game/maps/:id
 * Get map with all tiles, buildings, and ownership stats
 */
async function handleGetGameMapById(request, authService, env, corsHeaders) {
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

    // Get first company for the user (active company is tracked client-side)
    const activeCompanyResult = await env.DB.prepare(`
      SELECT id FROM game_companies
      WHERE user_id = ?
      LIMIT 1
    `).bind(user.id).first();

    if (!activeCompanyResult) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No active company'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const activeCompanyId = activeCompanyResult.id;

    // Extract map ID from path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const mapId = pathParts[4];

    // 1. Get map
    const map = await env.DB.prepare(`
      SELECT * FROM maps WHERE id = ? AND is_active = 1
    `).bind(mapId).first();

    if (!map) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Map not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Get all tiles for this map
    const tilesResult = await env.DB.prepare(`
      SELECT * FROM tiles WHERE map_id = ? ORDER BY y, x
    `).bind(mapId).all();

    const tiles = tilesResult.results || [];

    // 3. Get all buildings on this map (join with tiles to filter by map)
    const buildingsResult = await env.DB.prepare(`
      SELECT b.*, bt.name, bt.base_profit, bt.cost
      FROM building_instances b
      JOIN tiles t ON b.tile_id = t.id
      LEFT JOIN building_types bt ON b.building_type_id = bt.id
      WHERE t.map_id = ?
    `).bind(mapId).all();

    const buildings = buildingsResult.results || [];

    // 4. Get ownership stats for active company
    const playerTileCount = tiles.filter(
      t => t.owner_company_id === activeCompanyId
    ).length;

    const totalFreeLand = tiles.filter(
      t => !t.owner_company_id && t.terrain_type === 'free_land'
    ).length;

    return new Response(JSON.stringify({
      success: true,
      data: {
        map,
        tiles,
        buildings,
        playerTileCount,
        totalFreeLand
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
 * GET /api/game/maps/:id/tile/:x/:y
 * Get single tile details with building, owner, and security info
 */
async function handleGetTileDetail(request, authService, env, corsHeaders) {
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
    await authService.getUserFromToken(token);

    // Extract map ID, x, and y from path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const mapId = pathParts[4];
    const x = parseInt(pathParts[6]);
    const y = parseInt(pathParts[7]);

    // 1. Get tile
    const tile = await env.DB.prepare(`
      SELECT * FROM tiles WHERE map_id = ? AND x = ? AND y = ?
    `).bind(mapId, x, y).first();

    if (!tile) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Tile not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Get building on this tile (if any)
    let building = null;
    const buildingResult = await env.DB.prepare(`
      SELECT b.*, bt.name, bt.base_profit, bt.cost, bt.level_required
      FROM building_instances b
      JOIN building_types bt ON b.building_type_id = bt.id
      WHERE b.tile_id = ?
    `).bind(tile.id).first();

    if (buildingResult) {
      building = buildingResult;
    }

    // 3. Get owner company name (anonymous)
    let owner = null;
    if (tile.owner_company_id) {
      const company = await env.DB.prepare(`
        SELECT name FROM game_companies WHERE id = ?
      `).bind(tile.owner_company_id).first();

      if (company) {
        owner = { name: company.name }; // NEVER expose user_id
      }
    }

    // 4. Get security (if building exists)
    let security = null;
    if (building) {
      security = await env.DB.prepare(`
        SELECT * FROM building_security WHERE building_id = ?
      `).bind(building.id).first();
    }

    // 5. Get approved attack messages (if building exists)
    let attackMessages = [];
    if (building) {
      const messagesResult = await env.DB.prepare(`
        SELECT a.id, a.message, a.trick_type, a.created_at,
               gc.name as attacker_company_name, gc.boss_name as attacker_boss_name
        FROM attacks a
        JOIN game_companies gc ON a.attacker_company_id = gc.id
        WHERE a.target_building_id = ? AND a.message_status = 'approved'
        ORDER BY a.created_at DESC
        LIMIT 5
      `).bind(building.id).all();
      attackMessages = messagesResult.results || [];
    }

    return new Response(JSON.stringify({
      success: true,
      data: { tile, building, owner, security, attackMessages }
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
 * Game Company Routes Handler
 * Handles all /api/game/companies/* endpoints
 */
async function handleGameCompanyRoutes(request, authService, env, corsHeaders) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

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

    switch (true) {
      // GET /api/game/companies - List user's companies
      case path === '/api/game/companies' && method === 'GET': {
        const result = await env.DB.prepare(`
          SELECT * FROM game_companies WHERE user_id = ? ORDER BY created_at DESC
        `).bind(user.id).all();

        return new Response(JSON.stringify({
          success: true,
          data: {
            companies: result.results || [],
            max_companies: 3
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // POST /api/game/companies - Create new company
      case path === '/api/game/companies' && method === 'POST': {
        const body = await request.json();
        const { name, boss_name } = body;

        // Validate company name
        if (!name || typeof name !== 'string') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Company name is required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (name.trim().length === 0 || name.length > 30) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Company name must be between 1 and 30 characters'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Validate boss name
        if (!boss_name || typeof boss_name !== 'string') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Boss name is required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (boss_name.trim().length === 0 || boss_name.length > 30) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Boss name must be between 1 and 30 characters'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Moderate company name
        const companyNameModeration = await moderateName(env, 'company name', name.trim());
        if (!companyNameModeration.allowed) {
          return new Response(JSON.stringify({
            success: false,
            error: companyNameModeration.reason || 'Company name contains inappropriate content'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Moderate boss name
        const bossNameModeration = await moderateName(env, 'boss name', boss_name.trim());
        if (!bossNameModeration.allowed) {
          return new Response(JSON.stringify({
            success: false,
            error: bossNameModeration.reason || 'Boss name contains inappropriate content'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check company limit (max 3 per user)
        const countResult = await env.DB.prepare(`
          SELECT COUNT(*) as count FROM game_companies WHERE user_id = ?
        `).bind(user.id).first();

        if (countResult && countResult.count >= 3) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Maximum 3 companies allowed'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Create the company
        const companyId = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO game_companies (
            id, user_id, name, boss_name, cash, offshore, level, total_actions,
            is_in_prison, prison_fine, ticks_since_action, land_ownership_streak, land_percentage
          ) VALUES (?, ?, ?, ?, 50000, 0, 1, 0, 0, 0, 0, 0, 0)
        `).bind(companyId, user.id, name.trim(), boss_name.trim()).run();

        // Fetch the created company
        const company = await env.DB.prepare(`
          SELECT * FROM game_companies WHERE id = ?
        `).bind(companyId).first();

        return new Response(JSON.stringify({
          success: true,
          data: { company }
        }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // GET /api/game/companies/:id/stats - Get company statistics
      case path.match(/^\/api\/game\/companies\/[^/]+\/stats$/) && method === 'GET': {
        const companyId = path.split('/')[4];

        // Verify user owns this company
        const company = await env.DB.prepare(`
          SELECT id FROM game_companies WHERE id = ? AND user_id = ?
        `).bind(companyId, user.id).first();

        if (!company) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Company not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const result = await getCompanyStatistics(env, companyId);
        return new Response(JSON.stringify({ success: true, data: result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // GET /api/game/companies/:id - Get single company
      case path.match(/^\/api\/game\/companies\/[^/]+$/) && method === 'GET': {
        const companyId = path.split('/')[4];

        const company = await env.DB.prepare(`
          SELECT * FROM game_companies WHERE id = ? AND user_id = ?
        `).bind(companyId, user.id).first();

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
          data: { company }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // PUT /api/game/companies/:id - Update company (name/boss_name - master_admin only)
      case path.match(/^\/api\/game\/companies\/[^/]+$/) && method === 'PUT': {
        const companyId = path.split('/')[4];

        // Only master_admin can update company name or boss_name
        if (user.role !== 'master_admin') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Company name and boss name cannot be changed after creation'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Find the company (master_admin can update any company)
        const existingCompany = await env.DB.prepare(`
          SELECT * FROM game_companies WHERE id = ?
        `).bind(companyId).first();

        if (!existingCompany) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Company not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const body = await request.json();
        const { name, boss_name } = body;

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (name !== undefined) {
          if (typeof name !== 'string' || name.trim().length === 0 || name.length > 30) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Company name must be between 1 and 30 characters'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          updates.push('name = ?');
          values.push(name.trim());
        }

        if (boss_name !== undefined) {
          if (typeof boss_name !== 'string' || boss_name.trim().length === 0 || boss_name.length > 30) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Boss name must be between 1 and 30 characters'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          updates.push('boss_name = ?');
          values.push(boss_name.trim());
        }

        if (updates.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'No valid fields to update'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        values.push(companyId);
        await env.DB.prepare(`
          UPDATE game_companies SET ${updates.join(', ')} WHERE id = ?
        `).bind(...values).run();

        const updatedCompany = await env.DB.prepare(`
          SELECT * FROM game_companies WHERE id = ?
        `).bind(companyId).first();

        return new Response(JSON.stringify({
          success: true,
          data: { company: updatedCompany }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // DELETE /api/game/companies/:id - Delete company
      case path.match(/^\/api\/game\/companies\/[^/]+$/) && method === 'DELETE': {
        const companyId = path.split('/')[4];

        // Verify ownership
        const existingCompany = await env.DB.prepare(`
          SELECT * FROM game_companies WHERE id = ? AND user_id = ?
        `).bind(companyId, user.id).first();

        if (!existingCompany) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Company not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Delete the company
        await env.DB.prepare(`
          DELETE FROM game_companies WHERE id = ?
        `).bind(companyId).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Company deleted successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // POST /api/game/companies/:id/join-location - Join a map
      case path.match(/^\/api\/game\/companies\/[^/]+\/join-location$/) && method === 'POST': {
        const companyId = path.split('/')[4];

        // Verify ownership
        const existingCompany = await env.DB.prepare(`
          SELECT * FROM game_companies WHERE id = ? AND user_id = ?
        `).bind(companyId, user.id).first();

        if (!existingCompany) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Company not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const body = await request.json();
        const { map_id } = body;

        if (!map_id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'map_id is required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Verify map exists and is active
        const map = await env.DB.prepare(`
          SELECT * FROM maps WHERE id = ? AND is_active = 1
        `).bind(map_id).first();

        if (!map) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Map not found or not active'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check hero unlock requirements for cities and capitals
        if (map.location_type === 'city') {
          const townHero = await env.DB.prepare(`
            SELECT id FROM game_transactions
            WHERE company_id = ? AND action_type = 'hero_out'
            AND details LIKE '%"unlocks":"city"%'
            LIMIT 1
          `).bind(companyId).first();

          if (!townHero) {
            return new Response(JSON.stringify({
              success: false,
              error: 'You must hero out of a Town before joining a City'
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } else if (map.location_type === 'capital') {
          const cityHero = await env.DB.prepare(`
            SELECT id FROM game_transactions
            WHERE company_id = ? AND action_type = 'hero_out'
            AND details LIKE '%"unlocks":"capital"%'
            LIMIT 1
          `).bind(companyId).first();

          if (!cityHero) {
            return new Response(JSON.stringify({
              success: false,
              error: 'You must hero out of a City before joining the Capital'
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        // Determine starting cash based on location type
        const startingCash = {
          town: 50000,
          city: 1000000,
          capital: 5000000
        };
        const cash = startingCash[map.location_type] || 50000;

        // Update company with map info and starting cash
        await env.DB.prepare(`
          UPDATE game_companies
          SET current_map_id = ?, location_type = ?, cash = ?, ticks_since_action = 0
          WHERE id = ?
        `).bind(map_id, map.location_type, cash, companyId).run();

        // Create location_joined transaction so joinedLocationAt shows correctly
        await env.DB.prepare(`
          INSERT INTO game_transactions (id, company_id, map_id, action_type, amount, details)
          VALUES (?, ?, ?, 'location_joined', ?, ?)
        `).bind(
          crypto.randomUUID(),
          companyId,
          map_id,
          cash,
          JSON.stringify({
            map_name: map.name,
            location_type: map.location_type,
            starting_cash: cash
          })
        ).run();

        // Initialize company_statistics row with zeroes so stats display immediately
        await env.DB.prepare(`
          INSERT INTO company_statistics (
            id, company_id, map_id,
            building_count, collapsed_count,
            base_profit, gross_profit, tax_rate, tax_amount, security_cost, net_profit,
            total_building_value, damaged_building_value,
            total_damage_percent, average_damage_percent, buildings_on_fire,
            ticks_since_action, is_earning,
            last_tick_at
          ) VALUES (?, ?, ?, 0, 0, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, CURRENT_TIMESTAMP)
          ON CONFLICT (company_id, map_id) DO UPDATE SET
            building_count = 0,
            collapsed_count = 0,
            base_profit = 0,
            gross_profit = 0,
            tax_amount = 0,
            security_cost = 0,
            net_profit = 0,
            total_building_value = 0,
            damaged_building_value = 0,
            total_damage_percent = 0,
            average_damage_percent = 0,
            buildings_on_fire = 0,
            ticks_since_action = 0,
            is_earning = 1,
            last_tick_at = CURRENT_TIMESTAMP
        `).bind(
          crypto.randomUUID(),
          companyId,
          map_id,
          map.location_type === 'capital' ? 0.20 : map.location_type === 'city' ? 0.15 : 0.10
        ).run();

        const updatedCompany = await env.DB.prepare(`
          SELECT * FROM game_companies WHERE id = ?
        `).bind(companyId).first();

        return new Response(JSON.stringify({
          success: true,
          data: {
            company: updatedCompany,
            map: {
              id: map.id,
              name: map.name,
              country: map.country,
              location_type: map.location_type
            }
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // POST /api/game/companies/:id/leave-location - Leave map
      case path.match(/^\/api\/game\/companies\/[^/]+\/leave-location$/) && method === 'POST': {
        const companyId = path.split('/')[4];

        // Verify ownership
        const existingCompany = await env.DB.prepare(`
          SELECT * FROM game_companies WHERE id = ? AND user_id = ?
        `).bind(companyId, user.id).first();

        if (!existingCompany) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Company not found'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!existingCompany.current_map_id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Company is not currently in any location'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Forfeit all cash and buildings when leaving a location
        const mapId = existingCompany.current_map_id;

        // Get all tiles owned by this company on this map
        const ownedTiles = await env.DB.prepare(`
          SELECT id FROM tiles WHERE owner_company_id = ? AND map_id = ?
        `).bind(companyId, mapId).all();

        const tileIds = (ownedTiles.results || []).map(t => t.id);

        if (tileIds.length > 0) {
          // Delete building security for buildings on owned tiles
          await env.DB.prepare(`
            DELETE FROM building_security
            WHERE building_id IN (
              SELECT id FROM building_instances WHERE tile_id IN (${tileIds.map(() => '?').join(',')})
            )
          `).bind(...tileIds).run();

          // Delete all buildings on owned tiles
          await env.DB.prepare(`
            DELETE FROM building_instances WHERE tile_id IN (${tileIds.map(() => '?').join(',')})
          `).bind(...tileIds).run();

          // Release ownership of all tiles
          await env.DB.prepare(`
            UPDATE tiles SET owner_company_id = NULL, purchased_at = NULL
            WHERE owner_company_id = ? AND map_id = ?
          `).bind(companyId, mapId).run();
        }

        // Reset company: remove from map and forfeit all cash
        await env.DB.prepare(`
          UPDATE game_companies
          SET current_map_id = NULL, location_type = NULL, cash = 0
          WHERE id = ?
        `).bind(companyId).run();

        const updatedCompany = await env.DB.prepare(`
          SELECT * FROM game_companies WHERE id = ?
        `).bind(companyId).first();

        return new Response(JSON.stringify({
          success: true,
          data: { company: updatedCompany }
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
 * POST /api/game/land/buy
 * Purchase unowned land tile
 */
async function handleBuyLand(request, authService, env, corsHeaders) {
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
    const body = await request.json();
    const { company_id, tile_x, tile_y } = body;

    // Get company and verify ownership
    const company = await env.DB.prepare(`
      SELECT * FROM game_companies WHERE id = ? AND user_id = ?
    `).bind(company_id, user.id).first();

    if (!company) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Company not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check prison status
    if (company.is_in_prison) {
      return new Response(JSON.stringify({
        success: false,
        error: `You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!company.current_map_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Company must be on a map to purchase land'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get map
    const map = await env.DB.prepare(`
      SELECT * FROM maps WHERE id = ?
    `).bind(company.current_map_id).first();

    if (!map) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Map not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get tile
    const tile = await env.DB.prepare(`
      SELECT * FROM tiles WHERE map_id = ? AND x = ? AND y = ?
    `).bind(company.current_map_id, tile_x, tile_y).first();

    if (!tile) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Tile not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validations
    if (tile.owner_company_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Tile already owned'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (tile.terrain_type === 'water' || tile.terrain_type === 'road') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot purchase this terrain type'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (tile.special_building) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot purchase special buildings'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check free land slot limit (max 10 unbuilt tiles per company)
    const unbuiltCount = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM tiles t
      LEFT JOIN building_instances bi ON t.id = bi.tile_id
      WHERE t.owner_company_id = ? AND t.map_id = ? AND bi.id IS NULL
    `).bind(company.id, company.current_map_id).first();

    if (unbuiltCount?.count >= 10) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You can only own up to 10 unbuilt land slots at a time. Build on your existing land first.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate cost
    let cost;
    try {
      cost = calculateLandCost(tile, map);
    } catch (err) {
      return new Response(JSON.stringify({
        success: false,
        error: err.message
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (company.cash < cost) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Insufficient funds'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Transaction
    await env.DB.batch([
      // Deduct cash and reset tick counter
      env.DB.prepare(`
        UPDATE game_companies
        SET cash = cash - ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0
        WHERE id = ?
      `).bind(cost, new Date().toISOString(), company.id),

      // Transfer ownership
      env.DB.prepare(`
        UPDATE tiles SET owner_company_id = ?, purchased_at = ? WHERE id = ?
      `).bind(company.id, new Date().toISOString(), tile.id),

      // Log transaction
      env.DB.prepare(`
        INSERT INTO game_transactions (id, company_id, map_id, action_type, target_tile_id, amount)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), company.id, map.id, 'buy_land', tile.id, cost),
    ]);

    // Check for level-up
    const levelUp = await postActionCheck(env, company.id, company.level, map.id);

    return new Response(JSON.stringify({
      success: true,
      data: {
        cost,
        remaining_cash: company.cash - cost,
        tile: {
          ...tile,
          owner_company_id: company.id,
          purchased_at: new Date().toISOString()
        },
        levelUp
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
 * POST /api/game/buildings/build
 * Construct a building on owned tile
 */
async function handleBuildBuilding(request, authService, env, corsHeaders) {
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
    const body = await request.json();
    const { company_id, tile_id, building_type_id, variant } = body;

    // Get company and verify ownership
    const company = await env.DB.prepare(`
      SELECT * FROM game_companies WHERE id = ? AND user_id = ?
    `).bind(company_id, user.id).first();

    if (!company) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Company not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check prison status
    if (company.is_in_prison) {
      return new Response(JSON.stringify({
        success: false,
        error: `You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get tile and verify ownership
    const tile = await env.DB.prepare(`
      SELECT * FROM tiles WHERE id = ?
    `).bind(tile_id).first();

    if (!tile) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Tile not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (tile.owner_company_id !== company.id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You do not own this tile'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check for existing building
    const existingBuilding = await env.DB.prepare(`
      SELECT * FROM building_instances WHERE tile_id = ? AND is_collapsed = 0
    `).bind(tile_id).first();

    if (existingBuilding) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Tile already has a building'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get building type
    const buildingType = await env.DB.prepare(`
      SELECT * FROM building_types WHERE id = ?
    `).bind(building_type_id).first();

    if (!buildingType) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid building type'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate variant for building types that require one
    const allowedVariants = buildingType.variants ? JSON.parse(buildingType.variants) : null;
    if (allowedVariants && allowedVariants.length > 0) {
      if (!variant) {
        return new Response(JSON.stringify({
          success: false,
          error: 'This building type requires a specialty selection'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (!allowedVariants.includes(variant)) {
        return new Response(JSON.stringify({
          success: false,
          error: `Invalid specialty. Choose from: ${allowedVariants.join(', ')}`
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Check level requirement
    if (company.level < buildingType.level_required) {
      return new Response(JSON.stringify({
        success: false,
        error: `Requires level ${buildingType.level_required}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check license limit
    if (buildingType.requires_license && buildingType.max_per_map) {
      const count = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM building_instances bi
        JOIN tiles t ON bi.tile_id = t.id
        WHERE t.map_id = ? AND bi.building_type_id = ? AND bi.is_collapsed = 0
      `).bind(tile.map_id, building_type_id).first();

      if (count.count >= buildingType.max_per_map) {
        return new Response(JSON.stringify({
          success: false,
          error: `License limit reached for this building type (max ${buildingType.max_per_map})`
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Check funds
    if (company.cash < buildingType.cost) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Insufficient funds'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all tiles and buildings for profit calculation
    const allTiles = await env.DB.prepare(`
      SELECT * FROM tiles WHERE map_id = ?
    `).bind(tile.map_id).all();

    const allBuildings = await env.DB.prepare(`
      SELECT bi.* FROM building_instances bi
      JOIN tiles t ON bi.tile_id = t.id
      WHERE t.map_id = ? AND bi.is_collapsed = 0
    `).bind(tile.map_id).all();

    const map = await env.DB.prepare(`
      SELECT * FROM maps WHERE id = ?
    `).bind(tile.map_id).first();

    // Calculate profit and value
    const profitResult = calculateProfit(
      tile,
      buildingType,
      allTiles.results,
      allBuildings.results,
      map
    );
    const valueResult = calculateValue(
      tile,
      buildingType,
      allTiles.results,
      allBuildings.results
    );

    // Create building
    const buildingId = crypto.randomUUID();

    await env.DB.batch([
      // Deduct cash and reset tick counter
      env.DB.prepare(`
        UPDATE game_companies
        SET cash = cash - ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0
        WHERE id = ?
      `).bind(buildingType.cost, new Date().toISOString(), company.id),

      // Create building
      env.DB.prepare(`
        INSERT INTO building_instances
        (id, tile_id, building_type_id, company_id, variant, calculated_profit, profit_modifiers, calculated_value, value_modifiers, damage_percent, is_collapsed, needs_profit_recalc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
      `).bind(
        buildingId,
        tile_id,
        building_type_id,
        company.id,
        variant || null,
        profitResult.finalProfit,
        JSON.stringify(profitResult.breakdown),
        valueResult.finalValue,
        JSON.stringify(valueResult.breakdown)
      ),

      // Log transaction
      env.DB.prepare(`
        INSERT INTO game_transactions (id, company_id, map_id, action_type, target_tile_id, target_building_id, amount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), company.id, tile.map_id, 'build', tile_id, buildingId, buildingType.cost),
    ]);

    // Mark adjacent buildings as needing profit recalculation
    const affectedCount = await markAffectedBuildingsDirty(env, tile.x, tile.y, tile.map_id);

    // Check for level-up
    const levelUp = await postActionCheck(env, company.id, company.level, tile.map_id);

    return new Response(JSON.stringify({
      success: true,
      data: {
        building_id: buildingId,
        profit: profitResult.finalProfit,
        breakdown: profitResult.breakdown,
        value: valueResult.finalValue,
        value_breakdown: valueResult.breakdown,
        affected_buildings: affectedCount,
        remaining_cash: company.cash - buildingType.cost,
        levelUp
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
 * GET /api/game/buildings/types
 * Get all available building types
 */
async function handleGetBuildingTypes(request, authService, env, corsHeaders) {
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
    await authService.getUserFromToken(token);

    const url = new URL(request.url);
    const mapId = url.searchParams.get('map_id');

    // Exclude visual-only building types (demolished rubble, claim stakes)
    const result = await env.DB.prepare(`
      SELECT * FROM building_types
      WHERE id NOT IN ('demolished', 'claim_stake')
      ORDER BY level_required ASC, cost ASC
    `).all();

    let buildingTypes = result.results || [];

    // If map_id provided, add license availability for licensed building types
    if (mapId) {
      const licensedTypes = buildingTypes.filter(bt => bt.requires_license && bt.max_per_map);

      if (licensedTypes.length > 0) {
        // Get current counts for all licensed building types on this map
        const licenseCounts = await env.DB.prepare(`
          SELECT bi.building_type_id, COUNT(*) as count
          FROM building_instances bi
          JOIN tiles t ON bi.tile_id = t.id
          WHERE t.map_id = ? AND bi.is_collapsed = 0
          AND bi.building_type_id IN (${licensedTypes.map(() => '?').join(',')})
          GROUP BY bi.building_type_id
        `).bind(mapId, ...licensedTypes.map(bt => bt.id)).all();

        const countMap = {};
        for (const row of (licenseCounts.results || [])) {
          countMap[row.building_type_id] = row.count;
        }

        // Add license availability to each building type
        buildingTypes = buildingTypes.map(bt => {
          if (bt.requires_license && bt.max_per_map) {
            const currentCount = countMap[bt.id] || 0;
            return {
              ...bt,
              licenses_used: currentCount,
              licenses_remaining: bt.max_per_map - currentCount
            };
          }
          return bt;
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        building_types: buildingTypes
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
 * GET /api/game/buildings/preview-profit
 * Preview profit for a hypothetical building
 */
async function handlePreviewProfit(request, authService, env, corsHeaders) {
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
    await authService.getUserFromToken(token);

    const url = new URL(request.url);
    const tile_id = url.searchParams.get('tile_id');
    const building_type_id = url.searchParams.get('building_type_id');

    if (!tile_id || !building_type_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameters: tile_id and building_type_id'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get tile
    const tile = await env.DB.prepare(`
      SELECT * FROM tiles WHERE id = ?
    `).bind(tile_id).first();

    if (!tile) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Tile not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get building type
    const buildingType = await env.DB.prepare(`
      SELECT * FROM building_types WHERE id = ?
    `).bind(building_type_id).first();

    if (!buildingType) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Building type not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get all tiles and buildings for profit calculation
    const allTiles = await env.DB.prepare(`
      SELECT * FROM tiles WHERE map_id = ?
    `).bind(tile.map_id).all();

    const allBuildings = await env.DB.prepare(`
      SELECT bi.* FROM building_instances bi
      JOIN tiles t ON bi.tile_id = t.id
      WHERE t.map_id = ? AND bi.is_collapsed = 0
    `).bind(tile.map_id).all();

    const map = await env.DB.prepare(`
      SELECT * FROM maps WHERE id = ?
    `).bind(tile.map_id).first();

    // Calculate profit
    const profitResult = calculateProfit(
      tile,
      buildingType,
      allTiles.results,
      allBuildings.results,
      map
    );

    return new Response(JSON.stringify({
      success: true,
      data: {
        base_profit: buildingType.base_profit,
        final_profit: profitResult.finalProfit,
        total_modifier: profitResult.modifiers.total,
        breakdown: profitResult.breakdown
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

// ==================== GAME MARKET HANDLERS ====================

/**
 * Generic handler for market actions requiring authentication and company ownership
 */
async function handleMarketAction(request, authService, env, corsHeaders, actionFn) {
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
    const clonedRequest = request.clone();
    const body = await clonedRequest.json();
    const { company_id } = body;

    // Get company and verify ownership
    const company = await env.DB.prepare(`
      SELECT * FROM game_companies WHERE id = ? AND user_id = ?
    `).bind(company_id || user.id, user.id).first();

    if (!company) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Company not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Call the market action function
    const result = await actionFn(request, env, company);

    return new Response(JSON.stringify(result), {
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

/**
 * Handler for getting market listings (no auth required for viewing)
 */
async function handleMarketListings(request, env, corsHeaders) {
  try {
    const result = await getMarketListings(request, env);

    return new Response(JSON.stringify(result), {
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

/**
 * Handler for getting attack history (requires authentication)
 */
async function handleAttackHistory(request, authService, env, corsHeaders) {
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

    // Get active company for this user
    const company = await env.DB.prepare(`
      SELECT * FROM game_companies WHERE user_id = ? LIMIT 1
    `).bind(user.id).first();

    if (!company) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No game company found for this user'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = await getAttackHistory(request, env, company);

    return new Response(JSON.stringify(result), {
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

/**
 * Handler for hero GET requests (company_id from query params)
 */
async function handleHeroGetAction(request, authService, env, corsHeaders, actionFn) {
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

    // Get company_id from query params for GET requests
    const url = new URL(request.url);
    const companyId = url.searchParams.get('company_id');

    // Get company and verify ownership
    let company;
    if (companyId) {
      // If company_id provided, look up by id and verify ownership
      company = await env.DB.prepare(`
        SELECT * FROM game_companies WHERE id = ? AND user_id = ?
      `).bind(companyId, user.id).first();
    } else {
      // If no company_id, get the user's company (first one found)
      company = await env.DB.prepare(`
        SELECT * FROM game_companies WHERE user_id = ? LIMIT 1
      `).bind(user.id).first();
    }

    if (!company) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Company not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Call the action function
    const result = await actionFn(request, env, company);

    return new Response(JSON.stringify(result), {
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

/**
 * Handler for celebration status - prioritizes companies with pending celebration
 */
async function handleCelebrationStatusAction(request, authService, env, corsHeaders, actionFn) {
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

    // Get company_id from query params for GET requests
    const url = new URL(request.url);
    const companyId = url.searchParams.get('company_id');

    // Get company - prioritize ones with pending celebration
    let company;
    if (companyId) {
      company = await env.DB.prepare(`
        SELECT * FROM game_companies WHERE id = ? AND user_id = ?
      `).bind(companyId, user.id).first();
    } else {
      // First try to find a company with pending celebration
      company = await env.DB.prepare(`
        SELECT * FROM game_companies WHERE user_id = ? AND hero_celebration_pending = 1 LIMIT 1
      `).bind(user.id).first();

      // If no pending celebration, fall back to any company
      if (!company) {
        company = await env.DB.prepare(`
          SELECT * FROM game_companies WHERE user_id = ? LIMIT 1
        `).bind(user.id).first();
      }
    }

    if (!company) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Company not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Call the action function
    const result = await actionFn(request, env, company);

    return new Response(JSON.stringify(result), {
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

