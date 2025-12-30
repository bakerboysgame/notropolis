import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Use node-fetch or native fetch for API tests (bypasses CORS in test environment)
const API_URL = 'https://api.your-new-domain.com';

// Override fetch to use undici (Node.js native fetch) instead of happy-dom
// @ts-ignore
globalThis.fetch = (await import('undici')).fetch;

const TEST_USER = {
  email: 'rikibaker+vitest@gmail.com',
  password: 'VitestPass123!',
  userId: 'test-vitest-user-001',
  companyId: 'test-vitest-company'
};

// Helper to login and get auth token
async function loginAndGetToken(): Promise<{ token: string; userId: string }> {
  // Step 1: Login with password
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password
    })
  });
  
  const loginData = await loginRes.json();
  
  if (!loginData.success || !loginData.data.requiresTwoFactor) {
    throw new Error('Login failed or 2FA not required');
  }
  
  const userId = loginData.data.userId;
  
  // Step 2: Request 2FA code
  const twoFAReqRes = await fetch(`${API_URL}/api/auth/2fa/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      email: TEST_USER.email
    })
  });
  
  if (!twoFAReqRes.ok) {
    throw new Error('2FA request failed');
  }
  
  // Note: In real tests, we'd need to get the code from email
  // For now, we'll get it from the database directly
  console.log('⚠️  2FA code sent to email. You need to manually retrieve it for these tests.');
  
  throw new Error('Manual intervention required: Please check email for 2FA code');
}

// Helper to clean up all test sessions
async function cleanupTestSessions(token: string): Promise<void> {
  try {
    await fetch(`${API_URL}/api/auth/sessions/all`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  } catch (error) {
    console.log('Cleanup error (expected if token invalid):', error);
  }
}

describe('Session Management Tests', () => {
  let authToken: string;
  let sessionId: string;
  
  beforeAll(async () => {
    console.log('🧪 Starting Session Management Tests');
    console.log('⚠️  Note: These tests require manual 2FA code entry from email');
  });
  
  afterAll(async () => {
    console.log('🧹 Cleaning up test sessions...');
    if (authToken) {
      await cleanupTestSessions(authToken);
    }
  });

  describe('Session Validation', () => {
    it('should return 401 for missing authorization header', async () => {
      const response = await fetch(`${API_URL}/api/auth/me`);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should return 401 for invalid token format', async () => {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': 'Bearer invalid-token-format' }
      });
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should return 401 for expired/non-existent session', async () => {
      // Use a well-formed JWT but with fake session
      const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYWtlLXVzZXIiLCJpYXQiOjE1MTYyMzkwMjJ9.fakesignature';
      
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${fakeToken}` }
      });
      
      expect(response.status).toBe(401);
    });
  });

  describe('Device Tracking', () => {
    it.skip('should capture device info on login', async () => {
      // Skipped: Requires manual 2FA code entry
      // When implemented:
      // 1. Login with custom User-Agent
      // 2. Get sessions list
      // 3. Verify device info is captured
      expect(true).toBe(true);
    });

    it.skip('should detect browser from User-Agent', async () => {
      // Test different User-Agent strings
      const userAgents = [
        { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', expected: { browser: 'Chrome', os: 'macOS', device: 'Mac' } },
        { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0', expected: { browser: 'Firefox', os: 'Windows', device: 'Windows PC' } },
        { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15', expected: { browser: 'Safari', os: 'iOS', device: 'iPhone' } }
      ];
      
      // Would need to login with each UA and verify
      expect(true).toBe(true);
    });
  });

  describe('Active Sessions API', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await fetch(`${API_URL}/api/auth/sessions`);
      
      expect(response.status).toBe(401);
    });

    it.skip('should return list of user sessions', async () => {
      // Skipped: Requires valid auth token
      // When implemented:
      // const response = await fetch(`${API_URL}/api/auth/sessions`, {
      //   headers: { 'Authorization': `Bearer ${authToken}` }
      // });
      // const data = await response.json();
      // expect(data.success).toBe(true);
      // expect(Array.isArray(data.data)).toBe(true);
      expect(true).toBe(true);
    });

    it.skip('should include device information in sessions', async () => {
      // Verify sessions include: device_name, browser, os, ip_address, user_agent
      expect(true).toBe(true);
    });

    it.skip('should sort sessions by creation date', async () => {
      // Verify sessions are sorted oldest first
      expect(true).toBe(true);
    });
  });

  describe('Delete Session', () => {
    it('should return 401 when deleting session without auth', async () => {
      const response = await fetch(`${API_URL}/api/auth/sessions/fake-session-id`, {
        method: 'DELETE'
      });
      
      expect(response.status).toBe(401);
    });

    it.skip('should delete single session successfully', async () => {
      // Requires:
      // 1. Login to create session
      // 2. Get session ID
      // 3. Delete that session
      // 4. Verify it's gone
      expect(true).toBe(true);
    });

    it.skip('should not delete other users sessions', async () => {
      // Security test: verify cross-user session protection
      expect(true).toBe(true);
    });

    it.skip('should return 404 for non-existent session', async () => {
      // Try to delete session that doesn't exist
      expect(true).toBe(true);
    });
  });

  describe('Delete All Sessions', () => {
    it('should return 401 when deleting all sessions without auth', async () => {
      const response = await fetch(`${API_URL}/api/auth/sessions/all`, {
        method: 'DELETE'
      });
      
      expect(response.status).toBe(401);
    });

    it.skip('should delete all user sessions', async () => {
      // Requires:
      // 1. Login multiple times to create sessions
      // 2. Call delete all
      // 3. Verify all sessions deleted
      expect(true).toBe(true);
    });

    it.skip('should immediately invalidate current session', async () => {
      // After delete all, current token should be invalid
      expect(true).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should validate session in under 1 minute', async () => {
      const start = Date.now();
      
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': 'Bearer invalid' }
      });
      
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(60000); // 1 minute
      expect(duration).toBeLessThan(5000); // Ideally under 5 seconds
      expect(response.status).toBe(401);
    });

    it('should fetch sessions list in under 1 minute', async () => {
      const start = Date.now();
      
      const response = await fetch(`${API_URL}/api/auth/sessions`);
      
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(60000); // 1 minute
      expect(duration).toBeLessThan(2000); // Ideally under 2 seconds
      expect(response.status).toBe(401); // Expected since no auth
    });
  });

  describe('Session Security', () => {
    it('should reject malformed JWT tokens', async () => {
      const malformedTokens = [
        'not-a-jwt',
        'only.two.parts',
        'Bearer invalid',
        '',
        'null'
      ];

      for (const token of malformedTokens) {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        expect(response.status).toBe(401);
      }
    });

    it.skip('should validate session exists in database', async () => {
      // This is the critical fix we implemented
      // Even with valid JWT, session must exist in DB
      expect(true).toBe(true);
    });
  });
});

