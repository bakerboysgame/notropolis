import { describe, it, expect } from 'vitest';

// Use undici for API tests (bypasses CORS)
// @ts-ignore
globalThis.fetch = (await import('undici')).fetch;

const API_URL = 'https://api.your-new-domain.com';

describe('Security Tests', () => {
  describe('Security Headers', () => {
    it('should include all required security headers', async () => {
      const response = await fetch(`${API_URL}/api/health`);
      
      // Check all security headers
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('x-xss-protection')).toBe('1; mode=block');
      expect(response.headers.get('strict-transport-security')).toContain('max-age=31536000');
      expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('content-security-policy')).toBeDefined();
      expect(response.headers.get('permissions-policy')).toBeDefined();
    });

    it('should include HSTS with preload', async () => {
      const response = await fetch(`${API_URL}/api/health`);
      const hsts = response.headers.get('strict-transport-security');
      
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).toContain('preload');
    });

    it('should have CSP that prevents script injection', async () => {
      const response = await fetch(`${API_URL}/api/health`);
      const csp = response.headers.get('content-security-policy');
      
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
    });
  });

  describe('CORS Configuration', () => {
    it('should handle OPTIONS preflight requests', async () => {
      const response = await fetch(`${API_URL}/api/health`, {
        method: 'OPTIONS',
      });
      
      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-methods')).toBeDefined();
      expect(response.headers.get('access-control-allow-headers')).toBeDefined();
    });

    it('should allow credentials', async () => {
      const response = await fetch(`${API_URL}/api/health`);
      
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid email format', async () => {
      const response = await fetch(`${API_URL}/api/auth/magic-link/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid-email' })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('email');
    });

    it('should reject weak password', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'test@example.com', 
          password: 'weak' 
        })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('8 characters');
    });

    it('should reject password without uppercase', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'test@example.com', 
          password: 'password123!' 
        })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('uppercase');
    });

    it('should reject password without lowercase', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'test@example.com', 
          password: 'PASSWORD123!' 
        })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('lowercase');
    });

    it('should reject password without number', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'test@example.com', 
          password: 'Password!' 
        })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('number');
    });

    it('should reject password without special character', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'test@example.com', 
          password: 'Password123' 
        })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('special character');
    });
  });

  describe('Authentication Security', () => {
    it('should reject invalid JWT tokens', async () => {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': 'Bearer invalid-token' }
      });
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should require authorization header', async () => {
      const response = await fetch(`${API_URL}/api/auth/me`);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Authorization');
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should handle SQL injection attempt in email', async () => {
      const response = await fetch(`${API_URL}/api/auth/magic-link/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: "'; DROP TABLE users; --" })
      });
      
      // Should not crash (status 500), should reject as invalid email
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize XSS attempt in email', async () => {
      const response = await fetch(`${API_URL}/api/auth/magic-link/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '<script>alert("xss")</script>@example.com' })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });
});

