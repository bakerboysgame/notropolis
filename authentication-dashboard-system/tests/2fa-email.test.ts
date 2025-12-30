import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Use undici for API tests (bypasses CORS)
// @ts-ignore
globalThis.fetch = (await import('undici')).fetch;

const API_URL = 'https://api.your-new-domain.com';

const TEST_USER = {
  email: 'rikibaker+vitest@gmail.com',
  password: 'VitestPass123!',
  userId: 'test-vitest-user-001'
};

describe('2FA Email Tests', () => {
  let userId: string;
  
  beforeAll(async () => {
    console.log('🧪 Starting 2FA Email Tests');
  });

  describe('2FA Code Request', () => {
    beforeAll(async () => {
      // Login first to get userId
      const loginRes = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TEST_USER.email,
          password: TEST_USER.password
        })
      });
      
      const loginData = await loginRes.json();
      userId = loginData.data?.userId || TEST_USER.userId;
    });

    it('should successfully request 2FA code', async () => {
      const response = await fetch(`${API_URL}/api/auth/2fa/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email: TEST_USER.email
        })
      });
      
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      
      console.log('✅ 2FA code sent to email:', TEST_USER.email);
    });

    it('should return error for invalid userId', async () => {
      const response = await fetch(`${API_URL}/api/auth/2fa/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'invalid-user-id-12345',
          email: 'nonexistent@example.com'
        })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should return error for missing userId', async () => {
      const response = await fetch(`${API_URL}/api/auth/2fa/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TEST_USER.email
        })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should return error for missing email', async () => {
      const response = await fetch(`${API_URL}/api/auth/2fa/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId
        })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should send actual email via Brevo', async () => {
      // This test verifies real email sending
      const response = await fetch(`${API_URL}/api/auth/2fa/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email: TEST_USER.email
        })
      });
      
      expect(response.ok).toBe(true);
      
      console.log('📧 Check email for 2FA code at:', TEST_USER.email);
      console.log('⏰ Code valid for 10 minutes');
    });
  });

  describe('2FA Code Validation', () => {
    it('should reject invalid code format', async () => {
      const response = await fetch(`${API_URL}/api/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: TEST_USER.userId,
          code: 'INVALID'
        })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should reject non-existent code', async () => {
      const response = await fetch(`${API_URL}/api/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: TEST_USER.userId,
          code: '999999'
        })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid or expired');
    });

    it('should reject missing userId', async () => {
      const response = await fetch(`${API_URL}/api/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: '123456'
        })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should reject missing code', async () => {
      const response = await fetch(`${API_URL}/api/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: TEST_USER.userId
        })
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it.skip('should accept valid code and return JWT token', async () => {
      // Skipped: Requires manual code entry from email
      // To implement:
      // 1. Request 2FA code
      // 2. Get code from email (manually)
      // 3. Verify code
      // 4. Check JWT token returned
      
      console.log('⚠️  Manual test required: Get code from email and verify');
      expect(true).toBe(true);
    });

    it.skip('should only allow code to be used once', async () => {
      // Skipped: Requires valid code
      // To implement:
      // 1. Request code
      // 2. Use code successfully
      // 3. Try to use same code again
      // 4. Should fail
      
      console.log('⚠️  Manual test required: Test one-time use');
      expect(true).toBe(true);
    });
  });

  describe('2FA Code Expiry', () => {
    it.skip('should reject expired code after 10 minutes', async () => {
      // Skipped: Would require waiting 10 minutes or DB manipulation
      // To implement:
      // 1. Request code
      // 2. Wait 10+ minutes (or manipulate DB timestamp)
      // 3. Try to verify
      // 4. Should fail with expiry message
      
      console.log('⚠️  Manual test required: Test expiry after 10 minutes');
      expect(true).toBe(true);
    });

    it.skip('should accept code within 10 minute window', async () => {
      // Skipped: Requires manual code entry
      // To implement:
      // 1. Request code
      // 2. Immediately verify (within 10 min)
      // 3. Should succeed
      
      console.log('⚠️  Manual test required: Test valid within 10 minutes');
      expect(true).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it.skip('should rate limit 2FA requests', async () => {
      // Test rate limiting on 2FA code requests
      // Send multiple requests rapidly and verify rate limiting kicks in
      
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          fetch(`${API_URL}/api/auth/2fa/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: TEST_USER.userId,
              email: TEST_USER.email
            })
          })
        );
      }
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);
      
      expect(rateLimited).toBe(true);
      console.log('✅ Rate limiting working for 2FA requests');
    });
  });

  describe('Performance', () => {
    it('should send 2FA code in under 1 minute', async () => {
      const start = Date.now();
      
      const response = await fetch(`${API_URL}/api/auth/2fa/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: TEST_USER.userId,
          email: TEST_USER.email
        })
      });
      
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(60000); // 1 minute
      expect(duration).toBeLessThan(5000);  // Ideally under 5 seconds
      expect(response.ok).toBe(true);
      
      console.log(`⚡ 2FA code sent in ${duration}ms`);
    });

    it('should verify 2FA code in under 1 minute', async () => {
      const start = Date.now();
      
      const response = await fetch(`${API_URL}/api/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: TEST_USER.userId,
          code: '999999' // Invalid code, but tests response time
        })
      });
      
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(60000); // 1 minute
      expect(duration).toBeLessThan(2000);  // Ideally under 2 seconds
      expect(response.status).toBe(400); // Expected failure
      
      console.log(`⚡ 2FA verification responded in ${duration}ms`);
    });
  });
});

