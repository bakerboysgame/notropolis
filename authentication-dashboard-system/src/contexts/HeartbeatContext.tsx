import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useProofOfPresence } from '../hooks/useProofOfPresence';
import { useActiveCompany } from './CompanyContext';
import { api } from '../services/api';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const INITIAL_DELAY = 5000; // 5 seconds before first heartbeat

interface HeartbeatContextValue {
  lastHeartbeat: Date | null;
  isHeartbeatPending: boolean;
}

const HeartbeatContext = createContext<HeartbeatContextValue>({
  lastHeartbeat: null,
  isHeartbeatPending: false
});

// TypeScript declaration for Turnstile
declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        'error-callback': () => void;
        size: 'invisible' | 'compact' | 'normal';
      }) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export function HeartbeatProvider({ children }: { children: React.ReactNode }) {
  const { activeCompany } = useActiveCompany();
  const { getProof, reset, isActive } = useProofOfPresence();
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const [isHeartbeatPending, setIsHeartbeatPending] = useState(false);
  const intervalRef = useRef<number>();
  const initialTimeoutRef = useRef<number>();
  const turnstileLoaded = useRef(false);

  // Load Turnstile script dynamically
  useEffect(() => {
    if (turnstileLoaded.current || !TURNSTILE_SITE_KEY) return;
    if (document.getElementById('turnstile-script')) {
      turnstileLoaded.current = true;
      return;
    }

    const script = document.createElement('script');
    script.id = 'turnstile-script';
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => {
      turnstileLoaded.current = true;
    };
    document.head.appendChild(script);
  }, []);

  const getTurnstileToken = useCallback(async (): Promise<string> => {
    // If no site key configured, return empty (backend will skip validation)
    if (!TURNSTILE_SITE_KEY || !window.turnstile) {
      console.warn('Turnstile not configured or not loaded');
      return '';
    }

    return new Promise((resolve, reject) => {
      // Create a temporary container for the invisible widget
      const container = document.createElement('div');
      container.style.display = 'none';
      document.body.appendChild(container);

      try {
        const widgetId = window.turnstile!.render(container, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => {
            window.turnstile!.remove(widgetId);
            document.body.removeChild(container);
            resolve(token);
          },
          'error-callback': () => {
            window.turnstile!.remove(widgetId);
            document.body.removeChild(container);
            reject(new Error('Turnstile challenge failed'));
          },
          size: 'invisible'
        });
      } catch (e) {
        document.body.removeChild(container);
        reject(e);
      }
    });
  }, []);

  const sendHeartbeat = useCallback(async () => {
    if (!activeCompany || isHeartbeatPending) return;
    if (!isActive()) {
      console.log('Heartbeat skipped: no user activity detected');
      return;
    }

    setIsHeartbeatPending(true);
    try {
      // Get Turnstile token (may be empty if not configured)
      let turnstileToken = '';
      try {
        turnstileToken = await getTurnstileToken();
      } catch (e) {
        console.warn('Turnstile token failed, continuing without:', e);
      }

      const proof = getProof();

      await api.post('/api/game/heartbeat', {
        company_id: activeCompany.id,
        turnstile_token: turnstileToken,
        proof
      });

      setLastHeartbeat(new Date());
      reset();
      console.log('Heartbeat sent successfully for company:', activeCompany.name);
    } catch (e) {
      console.error('Heartbeat failed:', e);
    } finally {
      setIsHeartbeatPending(false);
    }
  }, [activeCompany, getProof, reset, isActive, isHeartbeatPending, getTurnstileToken]);

  // Initial heartbeat after delay
  useEffect(() => {
    if (!activeCompany) return;

    // Clear any existing timeout
    if (initialTimeoutRef.current) {
      clearTimeout(initialTimeoutRef.current);
    }

    initialTimeoutRef.current = window.setTimeout(() => {
      sendHeartbeat();
    }, INITIAL_DELAY);

    return () => {
      if (initialTimeoutRef.current) {
        clearTimeout(initialTimeoutRef.current);
      }
    };
  }, [activeCompany?.id]); // Only re-run when company changes

  // Periodic heartbeat with visibility handling
  useEffect(() => {
    if (!activeCompany) return;

    const startInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    };

    const stopInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopInterval();
        console.log('Tab hidden, heartbeat paused');
      } else {
        // Send immediate heartbeat when tab becomes visible
        sendHeartbeat();
        startInterval();
        console.log('Tab visible, heartbeat resumed');
      }
    };

    // Start interval
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
