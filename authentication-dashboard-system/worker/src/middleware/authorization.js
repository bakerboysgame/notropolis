// Centralized Authorization Middleware for Your App
// Handles role-based endpoint access, company isolation (multi-tenancy), and page-level access control

const ENDPOINT_AUTHORIZATION = [
  // ==================== PUBLIC ENDPOINTS ====================
  // (None - all endpoints require authentication)

  // ==================== AUTH ENDPOINTS ====================
  { pattern: '/api/auth/*', roles: null, companyIsolation: false },

  // ==================== PUBLIC ASSET ENDPOINTS ====================
  // Reference library images need to be publicly accessible for img src tags
  { pattern: '/api/admin/assets/reference-library/serve/*', roles: null, companyIsolation: false },

  // ==================== MASTER ADMIN ONLY ====================
  { pattern: '/api/health', roles: ['master_admin'], companyIsolation: false },
  { pattern: '/api/admin/*', roles: ['master_admin'], companyIsolation: false },
  { pattern: '/api/companies/create-with-admin', roles: ['master_admin'], companyIsolation: false },
  { pattern: '/api/companies/stats', roles: ['master_admin'], companyIsolation: false },
  { pattern: '/api/companies', methods: ['GET'], roles: ['master_admin'], companyIsolation: false },
  { pattern: '/api/companies/*/available-pages', roles: ['master_admin'], companyIsolation: false },
  { pattern: '/api/users', methods: ['GET'], roles: ['master_admin'], companyIsolation: false },

  // ==================== ADMIN + MASTER ADMIN ====================
  { pattern: '/api/company/roles', roles: ['admin', 'master_admin'], companyIsolation: true },
  { pattern: '/api/company/roles/*', roles: ['admin', 'master_admin'], companyIsolation: true },
  { pattern: '/api/users/*/permissions', roles: ['admin', 'master_admin'], companyIsolation: true },
  { pattern: '/api/users/*/permissions/*', roles: ['admin', 'master_admin'], companyIsolation: true },
  { pattern: '/api/users/invite', methods: ['POST'], roles: ['admin', 'master_admin'], companyIsolation: true },
  { pattern: '/api/users/*/resend-invitation', methods: ['POST'], roles: ['admin', 'master_admin'], companyIsolation: true },
  { pattern: '/api/users/*/archive', roles: ['admin', 'master_admin'], companyIsolation: true },
  { pattern: '/api/users/*/restore', roles: ['admin', 'master_admin'], companyIsolation: true },
  { pattern: '/api/users/*', methods: ['PATCH', 'DELETE'], roles: ['admin', 'master_admin'], companyIsolation: true },
  { pattern: '/api/companies/*/users', roles: ['admin', 'master_admin'], companyIsolation: true, companyIdParam: 2 },
  { pattern: '/api/audit/*', roles: ['admin', 'master_admin'], companyIsolation: true },
  { pattern: '/api/audit', roles: ['admin', 'master_admin'], companyIsolation: true },

  // ==================== USER ENDPOINTS ====================
  { pattern: '/api/user/permissions', roles: [], companyIsolation: true },
  { pattern: '/api/user/*', roles: [], companyIsolation: true },
  { pattern: '/api/company/available-pages', roles: [], companyIsolation: true },

  // ==================== PERMISSIONS ENDPOINTS ====================
  { pattern: '/api/permissions/*', roles: [], companyIsolation: true },
  { pattern: '/api/permissions', roles: [], companyIsolation: true },

  // ==================== ANALYTICS ENDPOINTS ====================
  { pattern: '/api/analytics/*', roles: [], companyIsolation: true, pageKey: 'analytics' },

  // ==================== PAGE-PROTECTED ENDPOINTS ====================
  { pattern: '/api/dashboard/*', roles: [], companyIsolation: true, pageKey: 'dashboard' },
  { pattern: '/api/reports/*', roles: [], companyIsolation: true, pageKey: 'reports' },

  // ==================== GAME COMPANY ENDPOINTS (all authenticated users) ====================
  { pattern: '/api/game/companies', roles: [], companyIsolation: false },
  { pattern: '/api/game/companies/*', roles: [], companyIsolation: false },
  { pattern: '/api/game/maps', roles: [], companyIsolation: false },
  { pattern: '/api/game/maps/*', roles: [], companyIsolation: false },

  // ==================== GAME LAND & BUILDING ENDPOINTS ====================
  { pattern: '/api/game/land/*', roles: [], companyIsolation: false },
  { pattern: '/api/game/buildings/*', roles: [], companyIsolation: false },

  // ==================== GAME MARKET ENDPOINTS ====================
  { pattern: '/api/game/market/*', roles: [], companyIsolation: false },

  // ==================== GAME PVP ENDPOINTS ====================
  // Cross-company interactions - business logic handles validation (costs, prison, level requirements)
  { pattern: '/api/game/attacks', roles: [], companyIsolation: false },
  { pattern: '/api/game/attacks/*', roles: [], companyIsolation: false },

  // ==================== GAME MODERATION ADMIN ENDPOINTS ====================
  { pattern: '/api/game/moderation/*', roles: ['master_admin'], companyIsolation: false },
];

// Match a URL path against a pattern
// Supports exact matches, wildcard suffix, and wildcard segments
function matchPattern(path, pattern) {
  // Exact match
  if (path === pattern) return true;

  // Wildcard at end: /api/auth/* matches /api/auth and /api/auth/anything
  if (pattern.endsWith('/*')) {
    const base = pattern.slice(0, -2);
    return path === base || path.startsWith(base + '/');
  }

  // Wildcard in middle: /api/users/*/archive
  if (pattern.includes('/*')) {
    const parts = pattern.split('/');
    const pathParts = path.split('/');

    if (pathParts.length < parts.length) return false;

    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '*') continue;
      if (parts[i] !== pathParts[i]) return false;
    }

    // If pattern doesn't end with /*, require exact length match
    if (!pattern.endsWith('/*') && pathParts.length !== parts.length) return false;

    return true;
  }

  return false;
}

// Find the authorization configuration for a given path and method
function findAuthConfig(path, method) {
  for (const config of ENDPOINT_AUTHORIZATION) {
    if (matchPattern(path, config.pattern)) {
      // If config specifies methods, check if current method is allowed
      if (config.methods && !config.methods.includes(method)) continue;
      return config;
    }
  }

  // Default: require authentication and company isolation
  return { pattern: 'default', roles: [], companyIsolation: true };
}

// Built-in pages that are always available to specific roles (cannot be restricted)
const ROLE_BUILTIN_PAGES = {
  master_admin: ['dashboard', 'analytics', 'reports', 'settings', 'user_management', 'audit_logs', 'company_users', 'admin_maps', 'admin_moderation'],
  admin: ['company_users', 'audit_logs']
};

// Check if a user's role can access a specific page
// RESTRICTIVE MODEL: Empty tables = no access (must explicitly grant)
async function checkPageAccess(user, pageKey, env) {
  // Master admin has access to everything (built-in, cannot be restricted)
  if (user.role === 'master_admin') return true;

  // Check if this is a built-in page for the user's role
  const builtinPages = ROLE_BUILTIN_PAGES[user.role] || [];
  if (builtinPages.includes(pageKey)) return true;

  // Check if page is enabled for the company
  const companyPages = await env.DB.prepare(`
    SELECT page_key, is_enabled FROM company_available_pages WHERE client_company_id = ?
  `).bind(user.company_id).all();

  // RESTRICTIVE: If no company pages configured, deny access (except built-in pages above)
  if (!companyPages.results || companyPages.results.length === 0) {
    return false;
  }

  // Check if this specific page is enabled for the company
  const pageConfig = companyPages.results.find(p => p.page_key === pageKey);
  if (!pageConfig || pageConfig.is_enabled !== 1) {
    return false;
  }

  // Admin has access to all company-enabled pages
  if (user.role === 'admin') return true;

  // For other roles, check role-specific page access
  const rolePageAccess = await env.DB.prepare(`
    SELECT page_key FROM role_page_access WHERE client_company_id = ? AND role_name = ?
  `).bind(user.company_id, user.role).all();

  // RESTRICTIVE: If no role page access configured, deny access
  if (!rolePageAccess.results || rolePageAccess.results.length === 0) {
    return false;
  }

  // Check if page is in the allowed list for this role
  return rolePageAccess.results.some(p => p.page_key === pageKey);
}

// Main authorization function - checks role access, company isolation, and page-level permissions
async function checkAuthorization(user, path, method, body, env) {
  const config = findAuthConfig(path, method);

  // Public endpoints (roles: null) - no authentication required
  if (config.roles === null) {
    return { authorized: true };
  }

  // All other endpoints require authentication
  if (!user) {
    return { authorized: false, error: 'Authentication required', statusCode: 401 };
  }

  // Role check
  if (config.roles.length > 0 && !config.roles.includes(user.role)) {
    // Master admin can access anything
    if (user.role !== 'master_admin') {
      return {
        authorized: false,
        error: `Access denied. Required role: ${config.roles.join(' or ')}`,
        statusCode: 403
      };
    }
  }

  // Company isolation check
  if (config.companyIsolation && user.role !== 'master_admin') {
    const targetCompanyId = extractCompanyIdFromRequest(path, body, config);
    if (targetCompanyId && targetCompanyId !== user.company_id) {
      return {
        authorized: false,
        error: "Access denied. You can only access your own company's data.",
        statusCode: 403
      };
    }
  }

  // Page access check
  if (config.pageKey) {
    const hasPageAccess = await checkPageAccess(user, config.pageKey, env);
    if (!hasPageAccess) {
      return {
        authorized: false,
        error: "Access denied. You don't have permission to access this feature.",
        statusCode: 403
      };
    }
  }

  return { authorized: true };
}

// Extract company ID from the request path or body
function extractCompanyIdFromRequest(path, body, config) {
  // Check for company ID in path (e.g., /api/companies/:id/users)
  if (config.companyIdParam !== undefined) {
    const pathParts = path.split('/').filter(p => p);
    if (pathParts.length > config.companyIdParam) {
      return pathParts[config.companyIdParam];
    }
  }

  // Check for company ID in body
  if (body) {
    if (body.company_id) return body.company_id;
    if (body.companyId) return body.companyId;
  }

  return null;
}

export {
  checkAuthorization,
  checkPageAccess,
  ENDPOINT_AUTHORIZATION,
  ROLE_BUILTIN_PAGES,
  findAuthConfig,
  matchPattern,
  extractCompanyIdFromRequest
};
