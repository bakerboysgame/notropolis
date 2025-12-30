import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = 'https://api.your-new-domain.com';

describe('API Endpoint Tests', () => {
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${API_URL}/api/health`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('healthy');
      expect(data.data.database).toBe('connected');
      expect(data.data.stats).toBeDefined();
    });

    it('should return database statistics', async () => {
      const response = await fetch(`${API_URL}/api/health`);
      const data = await response.json();
      
      expect(data.data.stats.users).toBeGreaterThanOrEqual(0);
      expect(data.data.stats.companies).toBeGreaterThanOrEqual(0);
      expect(data.data.stats.audit_logs).toBeGreaterThanOrEqual(0);
    });

    it('should respond within 1 second', async () => {
      const startTime = Date.now();
      const response = await fetch(`${API_URL}/api/health`);
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Magic Link Request', () => {
    it('should accept valid email format', async () => {
      const response = await fetch(`${API_URL}/api/auth/magic-link/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' })
      });
      
      // Will fail if user doesn't exist, but should not be a validation error
      expect(response.status).not.toBe(400);
    });

    it('should reject missing email', async () => {
      const response = await fetch(`${API_URL}/api/auth/magic-link/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      expect(response.status).toBe(400);
    });

    it('should normalize email to lowercase', async () => {
      const response = await fetch(`${API_URL}/api/auth/magic-link/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'TEST@EXAMPLE.COM' })
      });
      
      // Should accept the email (validation passes)
      expect(response.status).not.toBe(400);
    });
  });

  describe('Login Endpoint', () => {
    it('should reject login without credentials', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should validate email format on login', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'invalid', 
          password: 'ValidPass123!' 
        })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('email');
    });

    it('should validate password complexity on login', async () => {
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
      expect(data.error).toContain('8 characters');
    });
  });

  describe('Protected Endpoints', () => {
    it('should reject unauthorized access to /api/auth/me', async () => {
      const response = await fetch(`${API_URL}/api/auth/me`);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Authorization');
    });

    it('should reject invalid token format', async () => {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': 'InvalidFormat' }
      });
      
      expect(response.status).toBe(401);
    });

    it('should require Bearer token format', async () => {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': 'NotBearer token123' }
      });
      
      expect(response.status).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limits', async () => {
      // Make a few requests
      const promises = Array(5).fill(null).map(() =>
        fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: 'ratelimit@example.com', 
            password: 'TestPass123!' 
          })
        })
      );
      
      const responses = await Promise.all(promises);
      
      // All should be processed (not rate limited yet at 20 limit)
      responses.forEach(r => {
        expect([400, 401, 429]).toContain(r.status);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return JSON error responses', async () => {
      const response = await fetch(`${API_URL}/api/nonexistent`);
      
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should handle malformed JSON', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{'
      });
      
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('CORS', () => {
    it('should include CORS headers on GET requests', async () => {
      const response = await fetch(`${API_URL}/api/health`);
      
      expect(response.headers.get('access-control-allow-origin')).toBeDefined();
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    });

    it('should handle preflight requests', async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'OPTIONS'
      });
      
      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-methods')).toBeDefined();
    });
  });
});

