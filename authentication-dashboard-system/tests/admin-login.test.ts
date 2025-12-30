import { describe, it, expect } from 'vitest';

const API_URL = 'https://api.your-new-domain.com';

describe('Admin Login Test', () => {
  it('should successfully login with correct credentials', async () => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: 'rikibaker+admin@gmail.com', 
        password: 'AdminPass123!' 
      })
    });
    
    const data = await response.json();
    
    console.log('Login Response:', data);
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.token).toBeDefined();
    expect(data.data.user).toBeDefined();
    expect(data.data.user.email).toBe('rikibaker+admin@gmail.com');
    expect(data.data.user.first_name).toBe('Riki');
    expect(data.data.user.last_name).toBe('Baker');
    expect(data.data.company).toBeDefined();
  });

  it('should be able to access protected endpoint with token', async () => {
    // First, login
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: 'rikibaker+admin@gmail.com', 
        password: 'AdminPass123!' 
      })
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.data.token;
    
    // Then, access protected endpoint
    const meResponse = await fetch(`${API_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const meData = await meResponse.json();
    
    console.log('/api/auth/me Response:', meData);
    
    expect(meResponse.status).toBe(200);
    expect(meData.success).toBe(true);
    expect(meData.data.email).toBe('rikibaker+admin@gmail.com');
  });

  it('should fail login with incorrect password', async () => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: 'rikibaker+admin@gmail.com', 
        password: 'WrongPass123!' 
      })
    });
    
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it('should request magic link for admin account', async () => {
    const response = await fetch(`${API_URL}/api/auth/magic-link/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rikibaker+admin@gmail.com' })
    });
    
    const data = await response.json();
    
    console.log('Magic Link Request Response:', data);
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.message).toContain('sent');
  });
});

