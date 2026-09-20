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

  TWO KINDS OF ROW
  ----------------
  kind 'shortage'  keyed on shortage_id. Starred from the register.
  kind 'licence'   keyed on the HPRA licence number. Starred from All
                   medicines, for a product that is NOT short today.

  The second kind is the useful half. Starring from the register only
  ever records problems already discovered; starring a licence means a
  pharmacist marks what they dispense and hears about it the morning it
  appears, rather than finding out from a failed order.

  `rows` and `ids` below deliberately contain ONLY shortage rows, exactly
  as before, so every screen already reading them is unaffected. Licence
  rows are exposed separately as `licenceRows` and `licences`.

  Rows live in public.watchlist with a unique index on
  (created_by, kind, coalesce(shortage_id, licence)), so two people can
  each watch the same product but one person cannot watch it twice.
  Every query below also filters on created_by explicitly: row level
  security is the boundary, this is the second lock.
*/

const norm = (l) => String(l || '').trim().toUpperCase();

export function useWatchlist() {
  const { pharmacy, user } = useAuth();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyIds, setBusyIds] = useState(() => new Set());

  const load = useCallback(async () => {
    if (!supabase || !pharmacy?.id || !user?.id) {
      setAll([]);
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
      setAll(data || []);
      setError(null);
    }
    setLoading(false);
  }, [pharmacy, user]);

  useEffect(() => { load(); }, [load]);

  // Rows written before the migration have no kind. Treat anything with
  // a shortage_id as a shortage row rather than dropping it.
  const rows = useMemo(
    () => all.filter((r) => r.kind !== 'licence' && r.shortage_id),
    [all]
  );
  const licenceRows = useMemo(
    () => all.filter((r) => r.kind === 'licence' && r.licence),
    [all]
  );

  const ids = useMemo(() => new Set(rows.map((r) => r.shortage_id)), [rows]);
  const licences = useMemo(
    () => new Set(licenceRows.map((r) => norm(r.licence))),
    [licenceRows]
  );

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
    setAll((r) => [{ id: 'tmp-' + item.id, kind: 'shortage', shortage_id: item.id,
                     licence: null, product: item.product, note: note || null,
                     pharmacy_id: pharmacy.id, created_by: user.id }, ...r]);
    const { error: e } = await supabase.from('watchlist').insert({
      pharmacy_id: pharmacy.id,
      kind: 'shortage',
      shortage_id: item.id,
      product: item.product,
      note: note || null,
      created_by: user.id,
    });
    mark(item.id, false);
    if (e) {
      setAll((r) => r.filter((x) => x.shortage_id !== item.id));
      return e.message;
    }
    load();
    return null;
  }, [pharmacy, user, load]);

  const remove = useCallback(async (shortageId) => {
    if (!user?.id) return;
    mark(shortageId, true);
    const before = all;
    setAll((r) => r.filter((x) => x.shortage_id !== shortageId));
    const { error: e } = await supabase
      .from('watchlist')
      .delete()
      .eq('created_by', user.id)
      .eq('shortage_id', shortageId);
    mark(shortageId, false);
    if (e) setAll(before);
  }, [user, all]);

  const toggle = useCallback((item) =>
    (ids.has(item.id) ? remove(item.id) : add(item)), [ids, add, remove]);

  /* ---- licence rows: a product that is not short today ---- */

  const addLicence = useCallback(async (med) => {
    const lic = norm(med.licence);
    if (!lic) return 'This product has no licence number to watch.';
    if (!pharmacy?.id) return 'Your account is not linked to a pharmacy.';
    if (!user?.id) return 'Not signed in.';
    mark(lic, true);
    setAll((r) => [{ id: 'tmp-' + lic, kind: 'licence', shortage_id: null,
                     licence: med.licence, product: med.product,
                     pharmacy_id: pharmacy.id, created_by: user.id }, ...r]);
    const { error: e } = await supabase.from('watchlist').insert({
      pharmacy_id: pharmacy.id,
      kind: 'licence',
      licence: med.licence,
      product: med.product || med.licence,
      created_by: user.id,
    });
    mark(lic, false);
    if (e) {
      setAll((r) => r.filter((x) => norm(x.licence) !== lic));
      return e.message;
    }
    load();
    return null;
  }, [pharmacy, user, load]);

  const removeLicence = useCallback(async (licence) => {
    const lic = norm(licence);
    if (!user?.id || !lic) return;
    mark(lic, true);
    const before = all;
    setAll((r) => r.filter((x) => norm(x.licence) !== lic));
    // Match on the stored value rather than the normalised one: the
    // column holds the HPRA's own formatting.
    const row = before.find((x) => norm(x.licence) === lic);
    const { error: e } = await supabase
      .from('watchlist')
      .delete()
      .eq('created_by', user.id)
      .eq('kind', 'licence')
      .eq('licence', row ? row.licence : licence);
    mark(lic, false);
    if (e) setAll(before);
  }, [user, all]);

  const toggleLicence = useCallback((med) =>
    (licences.has(norm(med.licence))
      ? removeLicence(med.licence)
      : addLicence(med)), [licences, addLicence, removeLicence]);

  const setNote = useCallback(async (shortageId, note) => {
    if (!user?.id) return;
    await supabase.from('watchlist').update({ note: note || null })
      .eq('created_by', user.id).eq('shortage_id', shortageId);
    load();
  }, [user, load]);

  return {
    // unchanged for every screen that already uses these
    rows, ids, loading, error, busyIds,
    add, remove, toggle, setNote, reload: load,
    has: (id) => ids.has(id),
    enabled: Boolean(pharmacy?.id && user?.id),
    // new: products watched by licence, short or not
    licenceRows, licences,
    addLicence, removeLicence, toggleLicence,
    hasLicence: (l) => licences.has(norm(l)),
    allRows: all,
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

/*
  Star toggle for All medicines, where the product usually is not short.

  Separate from WatchStar because it keys on the licence, and because the
  promise is different: this one says "tell me if this goes short", which
  only means anything once the product actually appears on the register.
*/
export function WatchLicenceStar({ med, watch, size = 'md' }) {
  if (!watch.enabled || !med.licence) return null;
  const on = watch.hasLicence(med.licence);
  const busy = watch.busyIds.has(String(med.licence).trim().toUpperCase());
  return (
    <button
      type="button"
      className={'ia-star' + (on ? ' on' : '') + (size === 'sm' ? ' sm' : '')}
      aria-pressed={on}
      aria-label={on ? `Stop watching ${med.product}` : `Watch ${med.product}`}
      title={on
        ? 'On your list. Click to remove.'
        : 'Add to your list, so it appears on Today if it goes short'}
      disabled={busy}
      onClick={(e) => { e.stopPropagation(); watch.toggleLicence(med); }}
    >
      {on ? '★' : '☆'}
    </button>
  );
}