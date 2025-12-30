// Enhanced JWT Utilities for Multi-Tenant SaaS
// Includes company context, HIPAA compliance, and security features

import { SignJWT, jwtVerify } from 'jose';

export async function generateJWT(claims, env) {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const expiresIn = claims.isMobile ? '90d' : '24h';
  
  // Enhanced JWT payload with multi-tenant context
  const payload = {
    userId: claims.userId,
    companyId: claims.companyId,
    role: claims.role,
    phiAccessLevel: claims.phiAccessLevel,
    isMobile: claims.isMobile,
    issuedAt: Math.floor(Date.now() / 1000),
    // HIPAA compliance tracking
    dataClassification: claims.dataClassification || 'public',
    // Security features
    sessionId: crypto.randomUUID(),
    // Company context for data isolation
    companyContext: {
      id: claims.companyId,
      role: claims.role,
      permissions: claims.permissions || []
    }
  };
  
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setIssuer(env.SERVER_URL || 'https://api.your-new-domain.com')
    .setAudience(env.CLIENT_URL || 'https://dashboard.your-new-domain.com')
    .setJti(crypto.randomUUID()) // Unique token ID for session tracking
    .sign(secret);
}

export async function verifyJWT(token, env) {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      issuer: env.SERVER_URL || 'https://api.your-new-domain.com',
      audience: env.CLIENT_URL || 'https://dashboard.your-new-domain.com'
    });
    
    // Validate required claims for multi-tenant SaaS
    if (!payload.userId || !payload.companyId || !payload.role) {
      throw new Error('Invalid token: missing required claims');
    }
    
    // Validate HIPAA compliance claims
    if (!payload.phiAccessLevel || !['none', 'limited', 'full'].includes(payload.phiAccessLevel)) {
      throw new Error('Invalid token: invalid PHI access level');
    }
    
    // Validate data classification
    if (!payload.dataClassification || !['public', 'internal', 'confidential', 'restricted'].includes(payload.dataClassification)) {
      throw new Error('Invalid token: invalid data classification');
    }
    
    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    throw new Error('Invalid or expired token');
  }
}

// Enhanced JWT utilities for multi-tenant SaaS
export class JWTManager {
  constructor(env) {
    this.env = env;
  }

  async createToken(userClaims) {
    return await generateJWT(userClaims, this.env);
  }

  async verifyToken(token) {
    return await verifyJWT(token, this.env);
  }

  async refreshToken(oldToken) {
    try {
      const payload = await this.verifyToken(oldToken);
      
      // Create new token with same claims but new expiration
      const newClaims = {
        userId: payload.userId,
        companyId: payload.companyId,
        role: payload.role,
        phiAccessLevel: payload.phiAccessLevel,
        isMobile: payload.isMobile,
        dataClassification: payload.dataClassification,
        permissions: payload.companyContext?.permissions || []
      };
      
      return await this.createToken(newClaims);
    } catch (error) {
      throw new Error('Cannot refresh invalid token');
    }
  }

  // Extract company context from token
  extractCompanyContext(payload) {
    return {
      companyId: payload.companyId,
      role: payload.role,
      phiAccessLevel: payload.phiAccessLevel,
      dataClassification: payload.dataClassification,
      permissions: payload.companyContext?.permissions || []
    };
  }

  // Check if user can access PHI data
  canAccessPHI(payload) {
    return payload.phiAccessLevel !== 'none';
  }

  // Check if user can access data classification level
  canAccessDataClassification(payload, requiredLevel) {
    const accessLevels = {
      'public': ['public', 'internal', 'confidential', 'restricted'],
      'internal': ['internal', 'confidential', 'restricted'],
      'confidential': ['confidential', 'restricted'],
      'restricted': ['restricted']
    };
    
    const userLevels = accessLevels[payload.dataClassification] || [];
    return userLevels.includes(requiredLevel);
  }

  // Check if user has specific role
  hasRole(payload, requiredRole) {
    const roleHierarchy = {
      'master_admin': ['master_admin', 'admin', 'analyst', 'viewer', 'user'],
      'admin': ['admin', 'analyst', 'viewer', 'user'],
      'analyst': ['analyst', 'viewer', 'user'],
      'viewer': ['viewer', 'user'],
      'user': ['user']
    };
    
    const userRoles = roleHierarchy[payload.role] || [];
    return userRoles.includes(requiredRole);
  }

  // Check if user belongs to specific company
  // Master admins can access all companies
  belongsToCompany(payload, companyId) {
    if (payload.role === 'master_admin') {
      return true;
    }
    return payload.companyId === companyId;
  }

  // Validate token for multi-tenant operations
  validateForOperation(payload, operation, resourceType) {
    // Check if token is not expired
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }
    
    // Check company context
    if (!payload.companyId) {
      throw new Error('Invalid token: missing company context');
    }
    
    // Check role-based access
    const rolePermissions = {
      'master_admin': ['read', 'write', 'delete', 'manage_users', 'view_audit', 'manage_companies', 'view_all_companies', 'manage_all_users', 'system_settings'],
      'admin': ['read', 'write', 'delete', 'manage_users', 'view_audit'],
      'analyst': ['read', 'write', 'export_data'],
      'viewer': ['read'],
      'user': ['read_own_data']
    };
    
    const userPermissions = rolePermissions[payload.role] || [];
    if (!userPermissions.includes(operation)) {
      throw new Error(`Insufficient permissions for operation: ${operation}`);
    }
    
    // Check PHI access for sensitive operations
    if (resourceType === 'phi_data' && !this.canAccessPHI(payload)) {
      throw new Error('PHI access not authorized');
    }
    
    return true;
  }

  // Create token for specific multi-tenant context
  async createContextualToken(userClaims, context) {
    const enhancedClaims = {
      ...userClaims,
      // Add multi-tenant context
      context: {
        dataTypes: context.dataTypes || [],
        permissions: context.permissions || [],
        restrictions: context.restrictions || []
      },
      // HIPAA compliance metadata
      hipaaCompliant: true,
      auditRequired: true
    };
    
    return await this.createToken(enhancedClaims);
  }

  // Extract audit information from token
  extractAuditInfo(payload) {
    return {
      userId: payload.userId,
      companyId: payload.companyId,
      role: payload.role,
      phiAccessLevel: payload.phiAccessLevel,
      dataClassification: payload.dataClassification,
      sessionId: payload.sessionId,
      issuedAt: payload.issuedAt,
      isMobile: payload.isMobile
    };
  }
}
