import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/*
  Loads /insova-app.json, the per-product export the pipeline publishes
  each morning alongside insova-stats.json.

  If it is missing the app still renders: every screen checks `ready`
  and shows a clear message rather than silently displaying nothing.
  That matters because a pharmacist looking at an empty screen has no
  way to tell the difference between "nothing is short" and "the
  collector broke".

  KEEPING IT CURRENT WHILE IT STAYS OPEN
  --------------------------------------
  This used to load once, when the app started. That was fine in a
  browser tab, which gets closed at the end of the day. Installed as an
  app and pinned to a dispensary taskbar, Insova can sit open overnight
  or all week, and the next morning it would still be showing yesterday's
  register with the green "collected" dot beside it.

  So it now checks again:
    * whenever the window comes back into view or focus, which is the
      moment someone looks at it, at most once every few minutes;
    * every half hour while it is open, so a screen left up on a second
      monitor also moves.

  A check that finds nothing new changes nothing on screen: expanded
  cards stay expanded and the scroll position stays put. A check that
  fails keeps the data already showing rather than blanking it. The
  freshness label and the stale-data warning are what tell the
  pharmacist how old it is, and they are recomputed on every check.
*/

const CHECK_EVERY_MS = 30 * 60 * 1000;  // while open
const MIN_GAP_MS = 5 * 60 * 1000;       // between focus-triggered checks

export function useAppData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  // Bumped on every successful check, found something new or not, so
  // anything computed from "now" (days since collection) is refreshed.
  const [checkedAt, setCheckedAt] = useState(null);

  const lastCheck = useRef(0);
  const current = useRef(null);
  const inFlight = useRef(false);

  const load = useCallback(async (first) => {
    if (inFlight.current) return;
    inFlight.current = true;
    lastCheck.current = Date.now();
    try {
      const r = await fetch(process.env.PUBLIC_URL + '/insova-app.json', { cache: 'no-store' });
      if (!r.ok) throw new Error(`insova-app.json returned ${r.status}`);
      const d = await r.json();
      if (!d || !Array.isArray(d.items)) throw new Error('Unexpected data shape');

      // Only replace what is on screen if the pipeline has actually
      // published something new. Swapping in an identical copy would
      // re-render every screen and close whatever the pharmacist had open.
      const was = current.current?.meta;
      const is = d.meta;
      const changed = !was
        || was.generated_at !== is?.generated_at
        || was.as_of !== is?.as_of;
      if (changed) {
        current.current = d;
        setData(d);
      }
      setError(null);
      setCheckedAt(Date.now());
    } catch (e) {
      // On the first load there is nothing to show, so say so. On a
      // later check, keep the good data already on screen: a dropped
      // connection for one refresh is not a reason to empty the app.
      if (first || !current.current) {
        setError(e.message || 'Could not load the register');
      }
    } finally {
      inFlight.current = false;
      if (first) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);

    const maybe = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastCheck.current < MIN_GAP_MS) return;
      load(false);
    };

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load(false);
    }, CHECK_EVERY_MS);

    document.addEventListener('visibilitychange', maybe);
    window.addEventListener('focus', maybe);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', maybe);
      window.removeEventListener('focus', maybe);
    };
  }, [load]);

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

    return { items, byId, pressure };
  }, [data]);

  // Outside the memo on purpose: it depends on today's date, not just on
  // the data. Computed on every render, and setCheckedAt above forces a
  // render on every check, so it can never go stale while the app is open.
  const staleDays = data ? daysSince(data.meta.as_of) : null;

  return {
    data,
    ...(derived || {}),
    staleDays,
    checkedAt,
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