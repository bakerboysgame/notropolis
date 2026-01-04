/**
 * Heartbeat API Route
 * Validates Turnstile + proof-of-presence and resets ticks_since_action
 */

/**
 * POST /api/game/heartbeat
 * Reset ticks_since_action for active users with bot protection
 */
export async function handleHeartbeat(request, env, company) {
  const body = await request.json();
  const { turnstile_token, proof } = body;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // 1. Validate Turnstile token
  const turnstileResult = await validateTurnstile(turnstile_token, env, ip);

  // 2. Validate proof-of-presence (min 3 interactions, min 5s on page)
  const proofResult = validateProof(proof);
  if (!proofResult.valid) {
    return { success: false, error: proofResult.reason };
  }

  // 3. Rate limit: 1 heartbeat per 270s (4.5 min) per company
  const rateKey = `heartbeat:${company.id}`;
  const lastHeartbeat = await env.RATE_LIMIT_KV.get(rateKey);
  if (lastHeartbeat && Date.now() - parseInt(lastHeartbeat) < 270000) {
    return { success: true, ticks_reset: false, reason: 'cooldown' };
  }

  // 4. Check for replay attack (same nonce used before)
  const nonceKey = `nonce:${proof.nonce}`;
  if (await env.RATE_LIMIT_KV.get(nonceKey)) {
    return { success: false, error: 'replay_detected' };
  }

  // 5. Reset ticks_since_action and log heartbeat
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE game_companies SET ticks_since_action = 0, last_action_at = ? WHERE id = ?'
    ).bind(now, company.id),

    env.DB.prepare(`
      INSERT INTO heartbeat_log
        (id, company_id, user_id, turnstile_success, mouse_move_count, touch_event_count, scroll_count, click_count, time_on_page_ms, nonce, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      company.id,
      company.user_id,
      turnstileResult.success ? 1 : 0,
      proof.mouseMovements || 0,
      proof.touchEvents || 0,
      proof.scrolls || 0,
      proof.clicks || 0,
      proof.timeOnPageMs || 0,
      proof.nonce,
      ip
    )
  ]);

  // 6. Store rate limit and nonce to prevent replay
  await env.RATE_LIMIT_KV.put(rateKey, Date.now().toString(), { expirationTtl: 330 });
  await env.RATE_LIMIT_KV.put(nonceKey, '1', { expirationTtl: 600 });

  return { success: true, ticks_reset: true };
}

/**
 * Validate Turnstile token with Cloudflare API
 */
async function validateTurnstile(token, env, ip) {
  // If no token provided or no secret configured, fail open (log but allow)
  if (!token || !env.TURNSTILE_SECRET_KEY) {
    console.warn('Turnstile validation skipped: missing token or secret');
    return { success: false, error: 'missing_token_or_secret' };
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip
      })
    });

    const result = await response.json();
    return {
      success: result.success,
      action: result.action,
      error_codes: result['error-codes']
    };
  } catch (e) {
    console.error('Turnstile validation error:', e);
    // Fail open - allow heartbeat if Turnstile is down
    return { success: false, error: e.message };
  }
}

/**
 * Validate proof-of-presence data
 */
function validateProof(proof) {
  if (!proof) {
    return { valid: false, reason: 'missing_proof' };
  }

  // Calculate total interactions
  const totalInteractions =
    (proof.mouseMovements || 0) +
    (proof.touchEvents || 0) +
    (proof.scrolls || 0) +
    (proof.clicks || 0);

  // Minimum 3 interactions required
  if (totalInteractions < 3) {
    return { valid: false, reason: 'insufficient_activity' };
  }

  // Minimum 5 seconds on page
  if ((proof.timeOnPageMs || 0) < 5000) {
    return { valid: false, reason: 'insufficient_time' };
  }

  // Check nonce exists
  if (!proof.nonce) {
    return { valid: false, reason: 'missing_nonce' };
  }

  return { valid: true };
}
