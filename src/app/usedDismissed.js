import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

/*
  Dismissing a change on Your list.

  A "date moved" or "newly short" alert on a watched product used to sit
  in the badge all day with no way to clear it. Dismiss hides that one
  change: the strip on Your list, the row on Today's Your list panel and
  its count in the sidebar badge, all at once.

  WHAT IS DISMISSED IS THE CHANGE, NOT THE PRODUCT. It stays on the list.
  A change is identified by product, kind and detail ("2026-09-02 to no
  date"), so if the date moves AGAIN that is a different change and it
  comes back.

  STORED IN THIS BROWSER, per signed-in user. Two people in one pharmacy
  on two PCs each dismiss their own. If that becomes annoying, this is the
  one file to change: swap localStorage for a Supabase table and nothing
  else needs to know.

  Every read and write is wrapped, because storage can be blocked; in that
  case Dismiss still works until the page is reloaded.
*/

const EVENT = 'insova-dismissed';
const MAX_KEPT = 400; // old keys are trimmed so this never grows without limit

export const changeKey = (ch) => [ch.id, ch.kind, ch.detail || ''].join('|');

function storageKey(userId) {
  return 'insova.dismissed.' + (userId || 'anon');
}

function read(userId) {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (e) {
    return new Set();
  }
}

export function useDismissed() {
  const { user } = useAuth();
  const uid = user?.id;
  const [set, setSet] = useState(() => read(uid));

  // Keep every screen in step: Today, Your list and the badge all use this.
  useEffect(() => {
    setSet(read(uid));
    const sync = () => setSet(read(uid));
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [uid]);

  const dismiss = useCallback((ch) => {
    const next = new Set(read(uid));
    next.add(changeKey(ch));
    const list = [...next].slice(-MAX_KEPT);
    try { window.localStorage.setItem(storageKey(uid), JSON.stringify(list)); } catch (e) { /* blocked */ }
    setSet(new Set(list));
    window.dispatchEvent(new Event(EVENT));
  }, [uid]);

  const isDismissed = useCallback((ch) => set.has(changeKey(ch)), [set]);

  return { dismiss, isDismissed };
}
