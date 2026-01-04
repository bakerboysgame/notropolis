# Stage 1: Backend Implementation

## Objective

Create the `/api/game/heartbeat` endpoint that validates Turnstile + proof-of-presence and resets `ticks_since_action`.

## Dependencies

None (first stage)

## Complexity

Medium

## Files to Create

| File | Purpose |
|------|---------|
| `migrations/0045_create_heartbeat_tracking.sql` | Audit log table |
| `worker/src/routes/game/heartbeat.js` | Heartbeat handler |

## Files to Modify

| File | Changes |
|------|---------|
| `worker/index.js` | Add route case + import |
| `worker/src/middleware/authorization.js` | Add endpoint config |

## Implementation Details

### Migration

```sql
CREATE TABLE heartbeat_log (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  turnstile_success INTEGER NOT NULL,
  mouse_move_count INTEGER DEFAULT 0,
  touch_event_count INTEGER DEFAULT 0,
  scroll_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  time_on_page_ms INTEGER DEFAULT 0,
  nonce TEXT NOT NULL,
  ip_address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_heartbeat_company ON heartbeat_log(company_id);
CREATE INDEX idx_heartbeat_nonce ON heartbeat_log(nonce);
```

### heartbeat.js

```javascript
export async function handleHeartbeat(request, env, company) {
  const body = await request.json();
  const { turnstile_token, proof } = body;
  const ip = request.headers.get('CF-Connecting-IP');

  // 1. Validate Turnstile
  const turnstileResult = await validateTurnstile(turnstile_token, env, ip);

  // 2. Validate proof (min 3 interactions, min 5s)
  const proofResult = validateProof(proof);
  if (!proofResult.valid) {
    return { success: false, error: proofResult.reason };
  }

  // 3. Rate limit: 1 per 270s per company
  const rateKey = `heartbeat:${company.id}`;
  const lastHb = await env.RATE_LIMIT_KV.get(rateKey);
  if (lastHb && Date.now() - parseInt(lastHb) < 270000) {
    return { success: true, ticks_reset: false, reason: 'cooldown' };
  }

  // 4. Nonce replay check
  const nonceKey = `nonce:${proof.nonce}`;
  if (await env.RATE_LIMIT_KV.get(nonceKey)) {
    return { success: false, error: 'replay_detected' };
  }

  // 5. Reset ticks + log
  await env.DB.batch([
    env.DB.prepare(`UPDATE game_companies SET ticks_since_action = 0, last_action_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), company.id),
    env.DB.prepare(`INSERT INTO heartbeat_log (id, company_id, user_id, turnstile_success, mouse_move_count, touch_event_count, scroll_count, click_count, time_on_page_ms, nonce, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), company.id, company.user_id, turnstileResult.success ? 1 : 0, proof.mouseMovements, proof.touchEvents, proof.scrolls, proof.clicks, proof.timeOnPageMs, proof.nonce, ip)
  ]);

  // 6. Store rate limit + nonce
  await env.RATE_LIMIT_KV.put(rateKey, Date.now().toString(), { expirationTtl: 330 });
  await env.RATE_LIMIT_KV.put(nonceKey, '1', { expirationTtl: 600 });

  return { success: true, ticks_reset: true };
}

async function validateTurnstile(token, env, ip) {
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip
      })
    });
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function validateProof(proof) {
  const total = (proof.mouseMovements || 0) + (proof.touchEvents || 0) +
                (proof.scrolls || 0) + (proof.clicks || 0);
  if (total < 3) return { valid: false, reason: 'insufficient_activity' };
  if ((proof.timeOnPageMs || 0) < 5000) return { valid: false, reason: 'insufficient_time' };
  return { valid: true };
}
```

### index.js addition

```javascript
// Add import at top
import { handleHeartbeat } from './src/routes/game/heartbeat.js';

// Add case in switch (around line 485)
case path === '/api/game/heartbeat' && method === 'POST':
  return handleMarketAction(request, authService, env, corsHeaders, handleHeartbeat);
```

### authorization.js addition

```javascript
// Add to ENDPOINT_AUTHORIZATION array
{ pattern: '/api/game/heartbeat', roles: [], companyIsolation: false },
```

## Database Changes

New table: `heartbeat_log` (audit only, no FK constraints)

## Test Cases

| Test | Input | Expected |
|------|-------|----------|
| Valid heartbeat | Token + 5 interactions + 6s | `ticks_reset: true` |
| Insufficient activity | Token + 1 click + 6s | `error: insufficient_activity` |
| Too fast | Token + valid proof + <5s | `error: insufficient_time` |
| Rate limited | 2nd call within 4.5min | `ticks_reset: false, reason: cooldown` |
| Replay attack | Same nonce twice | `error: replay_detected` |

## Acceptance Checklist

- [ ] Migration applied successfully
- [ ] `POST /api/game/heartbeat` returns 200
- [ ] `ticks_since_action` resets to 0 in DB
- [ ] Rate limiting works (2nd call within 4.5min returns cooldown)
- [ ] Nonce stored in KV prevents replay

## Deployment

```bash
cd authentication-dashboard-system
npx wrangler d1 migrations apply notropolis-db --remote
npx wrangler deploy
```

Verify: `curl -X POST https://api.notropolis.net/api/game/heartbeat -H "Authorization: Bearer TOKEN" -d '{"company_id":"...", "turnstile_token":"...", "proof":{...}}'`

## Handoff Notes

Frontend needs:
- `VITE_TURNSTILE_SITE_KEY` environment variable
- Turnstile script loaded dynamically
- Proof collection hook before calling endpoint
