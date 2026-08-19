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

  SCOPE: the list belongs to the PHARMACY, not to the person. Everyone
  signed in under the same pharmacy sees and edits the same list, which
  is what a dispensary wants: a locum should see what the regular
  pharmacist is waiting on. It also means two accounts in the same
  pharmacy will appear to share a list, because they do.

  Rows live in public.watchlist, scoped by pharmacy under row level
  security, with a unique constraint on (pharmacy_id, shortage_id) so a
  double click cannot create duplicates. Every query below also filters
  on pharmacy_id explicitly: row level security is the boundary, this is
  the second lock.
*/
export function useWatchlist() {
  const { pharmacy, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyIds, setBusyIds] = useState(() => new Set());

  const load = useCallback(async () => {
    if (!supabase || !pharmacy?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: e } = await supabase
      .from('watchlist')
      .select('*')
      .eq('pharmacy_id', pharmacy.id)
      .order('created_at', { ascending: false });
    if (e) setError(e.message);
    else {
      setRows(data || []);
      setError(null);
    }
    setLoading(false);
  }, [pharmacy]);

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
    mark(item.id, true);
    // optimistic, so the star responds immediately
    setRows((r) => [{ id: 'tmp-' + item.id, shortage_id: item.id, product: item.product,
                      note: note || null, pharmacy_id: pharmacy.id }, ...r]);
    const { error: e } = await supabase.from('watchlist').insert({
      pharmacy_id: pharmacy.id,
      shortage_id: item.id,
      product: item.product,
      note: note || null,
      created_by: user?.id || null,
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
    if (!pharmacy?.id) return;
    mark(shortageId, true);
    const before = rows;
    setRows((r) => r.filter((x) => x.shortage_id !== shortageId));
    const { error: e } = await supabase
      .from('watchlist')
      .delete()
      .eq('pharmacy_id', pharmacy.id)
      .eq('shortage_id', shortageId);
    mark(shortageId, false);
    if (e) setRows(before);
  }, [pharmacy, rows]);

  const toggle = useCallback((item) =>
    (ids.has(item.id) ? remove(item.id) : add(item)), [ids, add, remove]);

  const setNote = useCallback(async (shortageId, note) => {
    if (!pharmacy?.id) return;
    await supabase.from('watchlist').update({ note: note || null })
      .eq('pharmacy_id', pharmacy.id).eq('shortage_id', shortageId);
    load();
  }, [pharmacy, load]);

  return {
    rows, ids, loading, error, busyIds,
    add, remove, toggle, setNote, reload: load,
    has: (id) => ids.has(id),
    enabled: Boolean(pharmacy?.id),
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