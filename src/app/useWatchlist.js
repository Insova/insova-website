import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth/AuthProvider';

/*
  The watchlist.

  Everything else in this application is national: the same register, the
  same groups, the same notices for every pharmacy in Ireland. This is
  the one part that belongs to a single pharmacy, and it is what turns a
  feed into a tool.

  It is also the container the wholesaler back-in-stock feature will drop
  into. "Tell me when this is available again" needs a list of products
  to check, and this is that list.

  SCOPE: the list is PRIVATE TO THE PERSON who made it. A colleague in
  the same pharmacy does not see it, and neither does an admin. It is a
  working note about what you are chasing, not a shared record, and it
  should not be readable by anyone who happens to have a login.

  Rows live in public.watchlist with a unique index on
  (created_by, shortage_id), so two people can each watch the same
  product but one person cannot watch it twice. Every query below also
  filters on created_by explicitly: row level security is the boundary,
  this is the second lock.
*/
export function useWatchlist() {
  const { pharmacy, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyIds, setBusyIds] = useState(() => new Set());

  const load = useCallback(async () => {
    if (!supabase || !pharmacy?.id || !user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: e } = await supabase
      .from('watchlist')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });
    if (e) setError(e.message);
    else {
      setRows(data || []);
      setError(null);
    }
    setLoading(false);
  }, [pharmacy, user]);

  useEffect(() => { load(); }, [load]);

  const ids = useMemo(() => new Set(rows.map((r) => r.shortage_id)), [rows]);

  const mark = (id, on) =>
    setBusyIds((s) => {
      const n = new Set(s);
      if (on) n.add(id); else n.delete(id);
      return n;
    });

  const add = useCallback(async (item, note) => {
    if (!pharmacy?.id) return 'Your account is not linked to a pharmacy.';
    if (!user?.id) return 'Not signed in.';
    mark(item.id, true);
    // optimistic, so the star responds immediately
    setRows((r) => [{ id: 'tmp-' + item.id, shortage_id: item.id, product: item.product,
                      note: note || null, pharmacy_id: pharmacy.id,
                      created_by: user.id }, ...r]);
    const { error: e } = await supabase.from('watchlist').insert({
      pharmacy_id: pharmacy.id,
      shortage_id: item.id,
      product: item.product,
      note: note || null,
      created_by: user.id,
    });
    mark(item.id, false);
    if (e) {
      setRows((r) => r.filter((x) => x.shortage_id !== item.id));
      return e.message;
    }
    load();
    return null;
  }, [pharmacy, user, load]);

  const remove = useCallback(async (shortageId) => {
    if (!user?.id) return;
    mark(shortageId, true);
    const before = rows;
    setRows((r) => r.filter((x) => x.shortage_id !== shortageId));
    const { error: e } = await supabase
      .from('watchlist')
      .delete()
      .eq('created_by', user.id)
      .eq('shortage_id', shortageId);
    mark(shortageId, false);
    if (e) setRows(before);
  }, [user, rows]);

  const toggle = useCallback((item) =>
    (ids.has(item.id) ? remove(item.id) : add(item)), [ids, add, remove]);

  const setNote = useCallback(async (shortageId, note) => {
    if (!user?.id) return;
    await supabase.from('watchlist').update({ note: note || null })
      .eq('created_by', user.id).eq('shortage_id', shortageId);
    load();
  }, [user, load]);

  return {
    rows, ids, loading, error, busyIds,
    add, remove, toggle, setNote, reload: load,
    has: (id) => ids.has(id),
    enabled: Boolean(pharmacy?.id && user?.id),
  };
}

/* Star toggle used on every shortage card. */
export function WatchStar({ item, watch, size = 'md' }) {
  if (!watch.enabled) return null;
  const on = watch.has(item.id);
  const busy = watch.busyIds.has(item.id);
  return (
    <button
      type="button"
      className={'ia-star' + (on ? ' on' : '') + (size === 'sm' ? ' sm' : '')}
      aria-pressed={on}
      aria-label={on ? `Stop watching ${item.product}` : `Watch ${item.product}`}
      title={on ? 'On your list. Click to remove.' : 'Add to your list'}
      disabled={busy}
      onClick={(e) => { e.stopPropagation(); watch.toggle(item); }}
    >
      {on ? '★' : '☆'}
    </button>
  );
}