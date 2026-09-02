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

        // Deduplicate by interchangeable group: two short products of the
        // same substance often sit in the same group, and counting that
        // group twice would overstate the pressure.
        const groups = new Map();
        products.forEach((p) => {
          if (p.group) groups.set(p.group.code, p.group);
        });
        const g = [...groups.values()];
        const total = g.reduce((a, x) => a + x.total, 0);
        const short = g.reduce((a, x) => a + x.short, 0);
        const left = g.reduce((a, x) => a + x.left, 0);

        return {
          substance,
          products,
          count: products.length,
          groupsLeft: g.length ? left : null,
          // Share of this substance's interchangeable products that are
          // short. A full bar means nothing in those groups is available.
          // Substances with no group listing get null and no bar rather
          // than a bar that means nothing.
          shortShare: total ? short / total : null,
          groupTotal: total || null,
          groupShort: short || null,
          worstRisk: Math.max(...products.map((p) => p.risk)),
        };
      })
      .sort((a, b) => {
        const as = a.shortShare === null ? -1 : a.shortShare;
        const bs = b.shortShare === null ? -1 : b.shortShare;
        return bs - as || b.count - a.count;
      });

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

/*
  Links to the official product documents.

  We used to point at medicines.ie. That was wrong and it failed most of
  the time: medicines.ie is an industry portal that companies opt into,
  not the regulator, so a product can be perfectly well authorised in
  Ireland and simply not be listed. Imdur is one of many.

  Then we tried deep-linking the HPRA search with a base64 parameter
  copied from a different page on their site. It filled the search box
  and then hung on a spinner, because the rest of the payload was wrong.

  The actual answer was in the register data all along. Every shortage
  record carries productID, which is the HPRA's own internal key, and
  their product pages are addressed by it directly:

      /find-a-medicine/for-human-use/authorised-medicines/details/27476

  That page holds the Summary of Product Characteristics, the package
  leaflet and the public assessment report. It is also one of only five
  paths the HPRA explicitly allows in its robots.txt, so it is the
  destination they intend people to reach.

  No name matching, no search, no scraping, and it is exact to the
  licence rather than to a product name that might not match.
*/
const HPRA_AUTHORISED =
  'https://www.hpra.ie/find-a-medicine/for-human-use/authorised-medicines';

export function hpraProductUrl(hpraId) {
  // Older exports predate hpra_id. Send those to the search page rather
  // than to a details URL that would 404.
  if (!hpraId) return HPRA_AUTHORISED;
  return `${HPRA_AUTHORISED}/details/${encodeURIComponent(hpraId)}`;
}