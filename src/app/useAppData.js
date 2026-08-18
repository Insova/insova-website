import { useEffect, useMemo, useState } from 'react';

/*
  Loads /insova-app.json, the per-product export the pipeline publishes
  each morning alongside insova-stats.json.

  If it is missing the app still renders: every screen checks `ready`
  and shows a clear message rather than silently displaying nothing.
  That matters because a pharmacist looking at an empty screen has no
  way to tell the difference between "nothing is short" and "the
  collector broke".
*/
export function useAppData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(process.env.PUBLIC_URL + '/insova-app.json', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`insova-app.json returned ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        if (!d || !Array.isArray(d.items)) throw new Error('Unexpected data shape');
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || 'Could not load the register');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const derived = useMemo(() => {
    if (!data) return null;

    const items = data.items;
    const byId = new Map(items.map((i) => [i.id, i]));

    // Substances where more than one product is short. This is what a
    // cascade looks like in the data: pressure concentrating on one
    // molecule as its alternatives fail.
    const pressure = Object.entries(data.by_substance || {})
      .map(([substance, ids]) => {
        const products = ids.map((id) => byId.get(id)).filter(Boolean);
        const groups = new Map();
        products.forEach((p) => {
          if (p.group) groups.set(p.group.code, p.group);
        });
        const left = [...groups.values()].reduce((a, g) => a + g.left, 0);
        return {
          substance,
          products,
          count: products.length,
          groupsLeft: groups.size ? left : null,
          worstRisk: Math.max(...products.map((p) => p.risk)),
        };
      })
      .sort((a, b) => b.worstRisk - a.worstRisk || b.count - a.count);

    const staleDays = daysSince(data.meta.as_of);

    return { items, byId, pressure, staleDays };
  }, [data]);

  return {
    data,
    ...(derived || {}),
    loading,
    error,
    ready: Boolean(data && !loading && !error),
  };
}

export function daysSince(isoDay) {
  if (!isoDay) return null;
  const then = new Date(isoDay + 'T00:00:00');
  const now = new Date();
  return Math.floor((now - then) / 86400000);
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

export function durationText(days) {
  if (days === null || days === undefined) return '';
  if (days < 31) return `${days} days`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  const y = Math.floor(days / 365);
  const m = Math.round((days % 365) / 30);
  return m ? `${y}y ${m}m` : `${y} year${y > 1 ? 's' : ''}`;
}

/* medicines.ie does not expose a stable per-product SPC URL we can
   construct, so we send the pharmacist to a search rather than a link
   that might 404. The HPRA product page is given as the fallback,
   because that is the authoritative source for the licence. */
export function spcSearchUrl(product) {
  return 'https://www.medicines.ie/search?q=' + encodeURIComponent(product || '');
}

export function hpraSearchUrl(term) {
  return 'https://www.hpra.ie/find-a-medicine/for-human-use/medicine-shortages?q=' +
    encodeURIComponent(term || '');
}