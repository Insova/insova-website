import { useEffect } from 'react';
import { supabase } from '../supabaseClient';

const INTERVAL_MS = 2 * 60 * 1000;

/*
  Pings touch_last_seen so admins can see who has the app open. Only
  pings while the tab is visible, so a tab left open overnight does not
  report someone as active at 4am.
*/
export function usePresence() {
  useEffect(() => {
    if (!supabase) return;

    const ping = () => {
      if (document.visibilityState !== 'visible') return;
      supabase.rpc('touch_last_seen').catch(() => {});
    };

    ping();
    const interval = setInterval(ping, INTERVAL_MS);
    document.addEventListener('visibilitychange', ping);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', ping);
    };
  }, []);
}
