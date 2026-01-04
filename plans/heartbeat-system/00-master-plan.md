# Heartbeat System: Turnstile + Proof-of-Presence

## Feature Overview

Reset `ticks_since_action` when users actively view game pages, preventing AFK timeout while protecting against bots via Cloudflare Turnstile (invisible CAPTCHA) + client-side activity proof.

**Why:** Users lose passive income after 6 ticks (1 hour) of inactivity. This lets active viewers maintain income without manual actions, while bot protection prevents abuse.

## Success Criteria

- [ ] Heartbeat sent on page load (after 5s activity collection)
- [ ] Heartbeat sent every 5 minutes while tab is visible
- [ ] `ticks_since_action` resets to 0 on valid heartbeat
- [ ] Bots blocked by Turnstile challenge
- [ ] Replay attacks prevented by nonce validation
- [ ] Rate limited to 1 heartbeat per 4.5 min per company
- [ ] Works on mobile (touch events)

## Dependencies & Prerequisites

- Cloudflare Turnstile widget created (invisible mode)
- `TURNSTILE_SECRET_KEY` added to worker secrets
- `VITE_TURNSTILE_SITE_KEY` added to frontend env

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Turnstile API down | Fail-open: log error, allow heartbeat |
| Clock drift rejection | 60s tolerance window |
| Mobile battery drain | Pause when tab hidden |

## Stage Index

| Stage | Description |
|-------|-------------|
| [01-backend](01-backend.md) | Migration, heartbeat route, worker wiring |
| [02-frontend](02-frontend.md) | Proof hook, context, App.tsx integration |

## Out of Scope

- Turnstile widget creation (manual Cloudflare dashboard step)
- Analytics dashboard for heartbeat data
- Fraud detection ML on collected signals
