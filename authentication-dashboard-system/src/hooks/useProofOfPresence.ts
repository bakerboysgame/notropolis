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
      // Debounce: only count if 100ms since last move
      if (Date.now() - lastMove.current > 100) {
        counters.current.mouse++;
        lastMove.current = Date.now();
      }
    };

    const onTouch = () => {
      // Debounce: only count if 100ms since last touch
      if (Date.now() - lastMove.current > 100) {
        counters.current.touch++;
        lastMove.current = Date.now();
      }
    };

    const onScroll = () => {
      counters.current.scroll++;
    };

    const onClick = () => {
      counters.current.click++;
    };

    // Add event listeners with passive flag for performance
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
