import { useEffect, useRef } from 'react';

/**
 * Calls `onFocus` whenever the page comes back to the front: its tab becomes
 * visible again, or its window gets the focus. Both can happen for one
 * return, so `onFocus` may be called twice in a row.
 */
export function useOnFocus(onFocus: () => void) {
  // Always the latest one drawn, so it sees the page as it stands now.
  const latest = useRef(onFocus);
  latest.current = onFocus;

  useEffect(() => {
    const focused = () => latest.current();
    const shown = () => {
      if (document.visibilityState === 'visible') focused();
    };
    document.addEventListener('visibilitychange', shown);
    window.addEventListener('focus', focused);
    return () => {
      document.removeEventListener('visibilitychange', shown);
      window.removeEventListener('focus', focused);
    };
  }, []);
}
