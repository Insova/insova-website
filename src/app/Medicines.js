import React, { useEffect, useMemo, useState } from 'react';
import { fmtDate } from './useAppData';
import { WatchLicenceStar } from './useWatchlist';

/*
  All Medicines.

  Every product the HPRA lists as authorised, and every product it lists
  as withdrawn. Roughly 30,000 rows.

  WHY THIS SCREEN EXISTS
  ----------------------
  A customer asks for something and it is not on the shortage register.
  That answers almost nothing on its own. The product might be fine, it
  might be authorised but never marketed, or its licence might have been
  withdrawn years ago. Without this, the pharmacist leaves Insova and
  searches two more lists on hpra.ie by hand.

  STARRING FROM HERE IS THE POINT
  -------------------------------
  Starring from the register only ever records problems already
  discovered. Starring here marks what the pharmacy actually dispenses,
  before anything is wrong, so the morning it appears on the register it
  is already on their list.

  Be careful with the promise. Nothing sends. A starred product surfaces
  in the app the next morning, and the copy below says exactly that
  rather than implying an email or an alert.

  LOADED ON DEMAND, NOT AT BOOT
  -----------------------------
  insova-medicines.json is fetched the first time this screen opens and
  then held for the session. It is deliberately not part of
  insova-app.json, which loads on every boot: nobody should pay for this
  file on the Today screen.

  Rows arrive as arrays with a shared string dictionary rather than as
  objects, so they are unpacked once here.

  WHAT WITHDRAWN MEANS
  --------------------
  It is a status on a LICENCE. Not a shortage, not "unavailable", and
  not a statement about anyone's stock. The same product name often
  appears twice, authorised under one licence and withdrawn under an
  older one, because presentations get retired while the current pack
  stays on. Both are shown. Picking one would be inventing an answer.
*/

const MIN_CHARS = 2;
const SHOW = 50;

export default function Medicines({ app, watch, go }) {
  const [db, setDb] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [mineOnly, setMineOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(process.env.PUBLIC_URL + '/insova-medicines.json', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`insova-medicines.json returned ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        if (!d || !Array.isArray(d.rows)) throw new Error('Unexpected data shape');
        setDb(unpack(d));
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || 'Could not load the medicines list');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Licences currently on the shortage register, so a row can say so
  // rather than making someone check a second screen.
  const shortByLicence = useMemo(() => {
    const m = new Map();
    (app?.data?.items || []).forEach((i) => {
      if (i.licence) m.set(i.licence.trim().toUpperCase(), i);
    });
    return m;
  }, [app]);

  // Watched products that have turned up on the register. This is the
  // whole reason for starring here, so it goes above the search box
  // rather than waiting to be found.
  const watchedShort = useMemo(() => {
    if (!watch?.licenceRows?.length) return [];
    return watch.licenceRows
      .map((r) => ({ row: r, item: shortByLicence.get(String(r.licence).trim().toUpperCase()) }))
      .filter((x) => x.item);
  }, [watch, shortByLicence]);

  const term = q.trim().toLowerCase();
  const searching = term.length >= MIN_CHARS;
  const ready = Boolean(db) && (searching || mineOnly);

  const hits = useMemo(() => {
    if (!db || !ready) return [];
    return db.items.filter((it) => {
      if (mineOnly && !watch.hasLicence(it.licence)) return false;
      if (status === 'authorised' && it.withdrawn) return false;
      if (status === 'withdrawn' && !it.withdrawn) return false;
      if (!searching) return true;
      return it.hay.includes(term);
    });
  }, [db, term, status, ready, searching, mineOnly, watch]);

  const watchedCount = watch?.licenceRows?.length || 0;

  return (
    <>
      <section className="ia-meds-intro">
        <h3>Every medicine on the HPRA lists</h3>
        <p>
          Search the full list of authorised products and the list of withdrawn
          products together. Use this when something is not on the shortage
          register and you need to know why, and star anything you dispense so
          it is already on your list if it goes short.
        </p>
      </section>

      {loading && <div className="ia-loading">Loading the medicines list…</div>}

      {error && (
        <div className="ia-alert error">
          <strong>The medicines list could not be loaded.</strong>
          <span>
            {error}. This is a fault at our end. The HPRA lists are still
            searchable on hpra.ie.
          </span>
        </div>
      )}

      {db && watchedShort.length > 0 && (
        <div className="ia-med-alert">
          <strong>
            {watchedShort.length} product{watchedShort.length === 1 ? '' : 's'} you
            starred {watchedShort.length === 1 ? 'is' : 'are'} now on the shortage register.
          </strong>
          {watchedShort.map(({ row, item }) => (
            <button key={row.id} className="ia-med-alert-row" onClick={() => go('shortages', item.id)}>
              <span>{row.product}</span>
              <span className="ia-med-alert-go">Open in Shortages →</span>
            </button>
          ))}
        </div>
      )}

      {db && (
        <>
          <div className="ia-filters">
            <input
              className="ia-search"
              type="search"
              placeholder="Product name, active substance, licence or company…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search all medicines"
            />
            <div className="ia-filter-row">
              {watch?.enabled && watchedCount > 0 && (
                <label className="ia-toggle">
                  <input
                    type="checkbox"
                    checked={mineOnly}
                    onChange={(e) => setMineOnly(e.target.checked)}
                  />
                  <span>Starred only ({watchedCount})</span>
                </label>
              )}
              <label className="ia-select">
                <span>Show</span>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="all">Authorised and withdrawn</option>
                  <option value="authorised">Authorised only</option>
                  <option value="withdrawn">Withdrawn only</option>
                </select>
              </label>
            </div>
            <div className="ia-filter-count">
              {!ready
                ? `${db.counts.total.toLocaleString()} products: ${db.counts.authorised.toLocaleString()} authorised, ${db.counts.withdrawn.toLocaleString()} withdrawn`
                : `${hits.length.toLocaleString()} matching`}
            </div>
          </div>

          {q.length > 0 && q.length < MIN_CHARS && !mineOnly && (
            <p className="ia-empty">Keep typing.</p>
          )}

          {ready && hits.length === 0 && (
            <p className="ia-empty">
              {mineOnly && !searching
                ? 'Nothing starred yet. Search for something you dispense and use the ☆ beside its name.'
                : 'Nothing on either HPRA list matches that. Brand names used in conversation are often not the name a product is licensed under, so try the active substance.'}
            </p>
          )}

          <div className="ia-meds-list">
            {hits.slice(0, SHOW).map((it) => (
              <Row
                key={it.key}
                it={it}
                watch={watch}
                short={shortByLicence.get(it.licence.toUpperCase())}
                go={go}
              />
            ))}
          </div>

          {hits.length > SHOW && (
            <p className="ia-more-note">
              Showing {SHOW} of {hits.length.toLocaleString()}. Narrow the search
              to see the rest.
            </p>
          )}

          <p className="ia-cite block">
            Source: HPRA list of authorised medicines for human use and HPRA list
            of withdrawn medicines, refreshed weekly. These lists were last
            collected {db.listsUpdated ? fmtDate(db.listsUpdated) : 'at an unknown date'}.
            The shortage register is collected daily and is a separate list.
          </p>
        </>
      )}
    </>
  );
}

function Row({ it, watch, short, go }) {
  const [open, setOpen] = useState(false);
  const starred = watch?.enabled && watch.hasLicence(it.licence);

  return (
    <article className={'ia-med' + (open ? ' open' : '')}>
      <div className="ia-med-head">
        <WatchLicenceStar med={it} watch={watch} />
        <button className="ia-med-hit" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="ia-med-main">
            <strong>{it.product || 'Name not stated'}</strong>
            <span className="ia-med-sub">
              {it.substances.join(', ') || 'Substance not stated'}
              {it.holder ? ` · ${it.holder}` : ''}
              {it.licence ? ` · ${it.licence}` : ''}
            </span>
          </span>
          <span className="ia-med-tags">
            {short && <span className="ia-tag red">in shortage</span>}
            {it.withdrawn
              ? <span className="ia-tag grey">withdrawn</span>
              : <span className="ia-tag green">authorised</span>}
            {!it.withdrawn && it.market === 'Not marketed' && (
              <span className="ia-tag amber">not marketed</span>
            )}
          </span>
          <span className="ia-chev" aria-hidden="true">{open ? '−' : '+'}</span>
        </button>
      </div>

      {open && (
        <div className="ia-med-body">
          <div className="ia-facts">
            <Fact k="Licence" v={it.licence || 'not stated'} />
            <Fact k="Licence holder" v={it.holder || 'not stated'} />
            <Fact k="Form" v={it.form || 'not stated'} />
            <Fact k="Supply" v={it.dispensing || 'not stated'} />
            <Fact k="Market status" v={it.market || 'not stated'} />
            <Fact k="ATC code" v={it.atc || 'not stated'} />
            <Fact k="First authorised" v={it.authorised || 'not stated'} />
            <Fact k="HPRA list" v={it.withdrawn ? 'Withdrawn' : 'Authorised'} />
          </div>

          {/* The one thing a pharmacist must not misread. */}
          <p className={'ia-med-note' + (it.withdrawn ? ' warn' : '')}>
            {it.withdrawn ? (
              <>
                <strong>Withdrawn means this licence no longer exists.</strong> It
                does not mean a shortage has been notified, and it says nothing
                about stock already in the supply chain. The same product is often
                still authorised under a different licence, so check the other
                results for this name.
              </>
            ) : short ? (
              <>
                <strong>This product is on the shortage register today.</strong>{' '}
                Open it in Shortages for the expected return date, the
                interchangeable group and any supply notice.
              </>
            ) : it.market === 'Not marketed' ? (
              <>
                <strong>Authorised, but the HPRA records it as not marketed.</strong>{' '}
                A licence exists and no shortage has been notified, but that is not
                the same as the product being available to order.
              </>
            ) : (
              <>
                <strong>No shortage has been notified for this product.</strong>{' '}
                That is not a statement that your wholesaler has it. It means the
                company has not told the HPRA of a supply problem.
              </>
            )}
          </p>

          {/* What starring actually does. Said plainly, because nothing
              sends and the word "notify" would promise an email. */}
          {watch?.enabled && it.licence && !short && (
            <p className="ia-med-watch">
              {starred ? (
                <>
                  <strong>On your list.</strong> If this licence appears on the
                  shortage register, it will be waiting on your Today screen the
                  next morning. Insova does not send anything, so you will see it
                  when you open the app.
                </>
              ) : (
                <>
                  Star this if you dispense it. Anything on your list that appears
                  on the register shows up on Today the next morning.
                </>
              )}
            </p>
          )}

          <div className="ia-card-links">
            {short && (
              <button className="ia-linkbtn inline" onClick={() => go('shortages', short.id)}>
                Open in Shortages →
              </button>
            )}
            <a
              href="https://www.hpra.ie/find-a-medicine/for-human-use/authorised-medicines"
              target="_blank"
              rel="noreferrer"
            >
              Find this product on the HPRA →
            </a>
          </div>
          <p className="ia-cite block">
            The HPRA's own lists do not carry the product id its pages are
            addressed by, so this opens their search rather than the exact
            product. Search the licence number above to go straight to it.
          </p>
        </div>
      )}
    </article>
  );
}

function Fact({ k, v }) {
  return (
    <div className="ia-fact">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

/*
  Rows arrive as arrays against a shared string dictionary. Unpack once,
  and build the lowercase haystack here rather than on every keystroke:
  30,000 rows is fast to filter and slow to re-lowercase.
*/
function unpack(d) {
  const f = d.fields.reduce((m, name, i) => { m[name] = i; return m; }, {});
  const D = d.dict;
  const items = d.rows.map((r, n) => {
    const product = r[f.product] || '';
    const licence = r[f.licence] || '';
    const holder = D.holders[r[f.holder]] || '';
    const substances = (r[f.substances] || []).map((i) => D.substances[i] || '');
    return {
      key: (licence || 'x') + ':' + n,
      product,
      licence,
      holder,
      substances,
      form: D.forms[r[f.form]] || '',
      dispensing: D.dispensing[r[f.dispensing]] || '',
      market: D.market[r[f.market]] || '',
      atc: r[f.atc] || '',
      authorised: r[f.authorised] || '',
      withdrawn: r[f.withdrawn] === 1,
      hay: [product, substances.join(' '), holder, licence, r[f.atc] || '']
        .join(' ')
        .toLowerCase(),
    };
  });
  return {
    items,
    counts: d.counts || { total: items.length, authorised: 0, withdrawn: 0 },
    listsUpdated: d.lists_updated || '',
  };
}