# Stage 2: Frontend Implementation

## Objective

Create proof-of-presence collector and HeartbeatContext that sends heartbeats on load + every 5 minutes.

## Dependencies

[Requires: Stage 1 complete]

## Complexity

Medium

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useProofOfPresence.ts` | Collects activity signals |
| `src/contexts/HeartbeatContext.tsx` | Manages Turnstile + heartbeat timing |

## Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Wrap game routes with HeartbeatProvider |

## Implementation Details

### useProofOfPresence.ts

```typescript
import { useEffect, useRef, useCallback } from 'react';

interface ProofData {
  mouseMovements: number;
  touchEvents: number;
  scrolls: number;
  clicks: number;
  timeOnPageMs: number;
  nonce: string;
  clientTimestamp: string;
}

export function useProofOfPresence() {
  const startTime = useRef(Date.now());
  const counters = useRef({ mouse: 0, touch: 0, scroll: 0, click: 0 });
  const lastMove = useRef(0);

  useEffect(() => {
    const onMouseMove = () => {
      if (Date.now() - lastMove.current > 100) { // Debounce 100ms
        counters.current.mouse++;
        lastMove.current = Date.now();
      }
    };
    const onTouch = () => {
      if (Date.now() - lastMove.current > 100) {
        counters.current.touch++;
        lastMove.current = Date.now();
      }
    };
    const onScroll = () => { counters.current.scroll++; };
    const onClick = () => { counters.current.click++; };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('click', onClick, { passive: true });
    window.addEventListener('touchend', onClick, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('click', onClick);
      window.removeEventListener('touchend', onClick);
    };
  }, []);

  const getProof = useCallback((): ProofData => ({
    mouseMovements: counters.current.mouse,
    touchEvents: counters.current.touch,
    scrolls: counters.current.scroll,
    clicks: counters.current.click,
    timeOnPageMs: Date.now() - startTime.current,
    nonce: crypto.randomUUID(),
    clientTimestamp: new Date().toISOString()
  }), []);

  const reset = useCallback(() => {
    counters.current = { mouse: 0, touch: 0, scroll: 0, click: 0 };
    startTime.current = Date.now();
  }, []);

  const isActive = useCallback(() => {
    const c = counters.current;
    return (c.mouse + c.touch + c.scroll + c.click) >= 3;
  }, []);

  return { getProof, reset, isActive };
}
```

### HeartbeatContext.tsx

```typescript
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useProofOfPresence } from '../hooks/useProofOfPresence';
import { useActiveCompany } from './CompanyContext';
import api from '../services/api';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 min
const INITIAL_DELAY = 5000; // 5s before first heartbeat

interface HeartbeatContextValue {
  lastHeartbeat: Date | null;
  isHeartbeatPending: boolean;
}

const HeartbeatContext = createContext<HeartbeatContextValue>({ lastHeartbeat: null, isHeartbeatPending: false });

export function HeartbeatProvider({ children }: { children: React.ReactNode }) {
  const { activeCompany } = useActiveCompany();
  const { getProof, reset, isActive } = useProofOfPresence();
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const [isHeartbeatPending, setIsHeartbeatPending] = useState(false);
  const turnstileRef = useRef<any>(null);
  const intervalRef = useRef<number>();

  // Load Turnstile script
  useEffect(() => {
    if (document.getElementById('turnstile-script')) return;
    const script = document.createElement('script');
    script.id = 'turnstile-script';
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const sendHeartbeat = useCallback(async () => {
    if (!activeCompany || isHeartbeatPending) return;
    if (!isActive()) return; // Skip if no activity

    setIsHeartbeatPending(true);
    try {
      // Get Turnstile token
      const token = await new Promise<string>((resolve, reject) => {
        if (!window.turnstile) { reject('Turnstile not loaded'); return; }

        // Create invisible widget
        const widgetId = window.turnstile.render(document.createElement('div'), {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => { resolve(token); window.turnstile.remove(widgetId); },
          'error-callback': () => { reject('Turnstile error'); window.turnstile.remove(widgetId); },
          size: 'invisible'
        });
      });

      const proof = getProof();
      await api.post('/api/game/heartbeat', {
        company_id: activeCompany.id,
        turnstile_token: token,
        proof
      });

      setLastHeartbeat(new Date());
      reset();
    } catch (e) {
      console.error('Heartbeat failed:', e);
    } finally {
      setIsHeartbeatPending(false);
    }
  }, [activeCompany, getProof, reset, isActive, isHeartbeatPending]);

  // Initial heartbeat after delay
  useEffect(() => {
    if (!activeCompany) return;
    const timeout = setTimeout(sendHeartbeat, INITIAL_DELAY);
    return () => clearTimeout(timeout);
  }, [activeCompany?.id]);

  // Periodic heartbeat
  useEffect(() => {
    if (!activeCompany) return;

    const startInterval = () => {
      intervalRef.current = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    };

    const stopInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopInterval();
      } else {
        sendHeartbeat(); // Send immediately when tab becomes visible
        startInterval();
      }
    };

    startInterval();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [activeCompany?.id, sendHeartbeat]);

  return (
    <HeartbeatContext.Provider value={{ lastHeartbeat, isHeartbeatPending }}>
      {children}
    </HeartbeatContext.Provider>
  );
}

export const useHeartbeat = () => useContext(HeartbeatContext);

// TypeScript declaration for Turnstile
declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: any) => string;
      remove: (widgetId: string) => void;
    };
  }
}
```

### App.tsx modification

Wrap game routes (inside company context) with HeartbeatProvider:

```typescript
import { HeartbeatProvider } from './contexts/HeartbeatContext';

// Find where CompanyProvider wraps routes and add HeartbeatProvider inside it:
<CompanyProvider>
  <HeartbeatProvider>
    {/* Game routes: /companies/:id/*, /map/:mapId, /bank, /temple, etc. */}
  </HeartbeatProvider>
</CompanyProvider>
```

## Database Changes

None (backend only)

## Test Cases

| Test | Action | Expected |
|------|--------|----------|
| Initial heartbeat | Load game page, wait 5s, interact | Heartbeat sent after 5s |
| Periodic heartbeat | Stay on page 5+ minutes | Heartbeat every 5 min |
| Tab hidden | Switch tabs | Interval paused |
| Tab visible | Return to tab | Immediate heartbeat + resume interval |
| No activity | Load page, don't interact | No heartbeat sent (isActive=false) |
| Mobile touch | Tap/scroll on mobile | Touch events counted |

## Acceptance Checklist

- [ ] Proof hook collects mouse/touch/scroll/click events
- [ ] Heartbeat sent 5s after page load
- [ ] Heartbeat sent every 5 min while active
- [ ] Interval pauses when tab hidden
- [ ] Turnstile widget loads and generates token
- [ ] Works on mobile (touch events trigger activity)

## Deployment

```bash
cd authentication-dashboard-system
npm run build
# Deploy frontend to hosting
```

Verify: Open DevTools Network tab, load game page, verify heartbeat POST after 5s.

## Handoff Notes

System complete. Monitor `heartbeat_log` table for:
- Low `turnstile_success` rates (bot detection working)
- Suspicious patterns (same nonce, rapid requests)
