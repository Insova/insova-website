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
  SPC links.

  We used to point at medicines.ie. That was wrong and it failed most of
  the time. medicines.ie is an industry portal that companies opt into,
  not the regulator, so a product can be perfectly well authorised in
  Ireland and simply not be listed there. Imdur is one of many.

  The HPRA holds the SPC for every product it has authorised, because it
  approved the document. So that is where the link goes now.

  We cannot link straight to the PDF. Those URLs look like

      assets.hpra.ie/products/Human/27476/Final_PA22655-001-001_0703....pdf

  and carry an internal product id and a document version timestamp,
  neither of which appears anywhere in the data the HPRA publishes to
  us. So this links to the product page, where the SPC button sits.

  It searches by LICENCE NUMBER, not product name. The HPRA search
  accepts "product name, active substance, licence number or licence
  holder", and a licence is exact. Product names differ between the
  shortage register and the authorised list often enough to matter, and
  that mismatch is exactly what broke the medicines.ie links.
*/
const HPRA_AUTHORISED =
  'https://www.hpra.ie/find-a-medicine/for-human-use/authorised-medicines';

export function hpraProductUrl(licence, product) {
  const term = (licence || product || '').trim();
  if (!term) return HPRA_AUTHORISED;
  // The HPRA site carries its search state in a base64 "data" parameter.
  // Deduced from a live URL: {"id":null,"skip":10,"take":10,"query":null,
  // "order":null,"filter":"All"}
  try {
    const payload = {
      id: null, skip: 0, take: 25, query: term, order: null, filter: 'All',
    };
    return HPRA_AUTHORISED + '?data=' + btoa(JSON.stringify(payload));
  } catch (e) {
    // btoa throws on non-Latin1 characters. Fall back to the plain page
    // rather than producing a broken link.
    return HPRA_AUTHORISED;
  }
}