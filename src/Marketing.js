import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Marketing.css';
import DemoBooking from './booking/DemoBooking';

/*
  insova.ie, the public homepage. Rewritten November 2026.

  WHO IT IS FOR
  Community pharmacists and the people who run pharmacies, first.
  Pharmacy groups and supply-chain partners second. It sells the product
  as it is today, with confidence, and says plainly what is coming next.
  No "founding pharmacy" language: Insova is a product, not a request.

  WHAT IS REAL ON THIS PAGE
  * Almost everything moving on this page is THIS MORNING'S register,
    from /insova-showcase.json (website_showcase.py, rebuilt every
    morning). Real product names, real changes, real dates.
  * If that file cannot be loaded, the page falls back to real entries
    from the register as collected on 19 September 2026, and says so.
    Nothing on this page is invented. A pharmacist who spots one made-up
    return date will wonder what else is made up.
  * The figures in the navy band come from /insova-stats.json. Every one
    has a source button.

  NO HASH LINKS FOR SCROLLING. The app's routes live in the hash
  (#/app, #/login, #/demo, #/sandbox). An in-page link to "#demo" once
  opened Demo mode instead of scrolling. Every "go to section" control
  here is a button that scrolls, and never touches the address bar.

  KEEP public/index.html IN STEP. It carries a plain-text copy of the
  hero for search engines. Different claims there would be cloaking.

  Everything is namespaced .mk- (Marketing.css), so nothing here can
  reach into the app.
*/

/* ------------------------------------------------------------------
   COMPANY PARTICULARS (Companies Act 2014, s.151)
   ------------------------------------------------------------------ */
const COMPANY = {
  name: 'Insova Limited',
  form: 'a private company limited by shares',
  number: '826812',
  office: '29 Belleville, Blackhorse Avenue, Dublin 7, D07 X767, Ireland',
};

const DEMO_MAIL =
  'mailto:contact@insova.ie?subject=Insova%20demo' +
  '&body=Pharmacy%20name%3A%0D%0ATown%3A%0D%0ABest%20number%20and%20time%20to%20call%3A%0D%0A';

/* ------------------------------------------------------------------
   FALLBACK: real entries from the HPRA register, 19 September 2026.
   Shown only if this morning's showcase file cannot be loaded.
   Do not add anything here that did not happen.
   ------------------------------------------------------------------ */
const FALLBACK_SHOWCASE = {
  live: false,
  as_of_label: '19 September 2026',
  compare_label: 'Friday 18 September 2026',
  first_archived: '2026-08-03',
  // Only the counts we recorded for that morning. Anything else falls
  // back to /insova-stats.json, which carries its own date.
  counts: { appeared: 19, left: 8, moved: 9 },
  changes: {
    appeared: [
      { product: 'Calvepen 666 mg Tablets', detail: 'Manufacturing delay' },
      { product: 'Parox 10 mg Film-Coated Tablets', detail: 'Manufacturing delay' },
      { product: 'Vatan 40 mg Film-coated Tablets', detail: 'Manufacturing delay' },
      { product: 'Gabin 100 mg capsules, hard', detail: 'Manufacturing delay' },
    ],
    left: [
      { product: 'Olanzapine Teva 10 mg Orodispersible tablet' },
      { product: 'Letrozole Teva 2.5 mg film-coated tablets' },
      { product: 'Silcarfil 20 mg film-coated tablets' },
      { product: 'Tevaquel 25 mg Film-coated Tablets' },
    ],
    moved: [
      { product: 'Ondansetron 8 mg film-coated tablets', from: null, to: '2026-11-20' },
      { product: 'Pregabalin Sandoz 150 mg hard capsules', from: '2026-09-30', to: '2026-10-02' },
      { product: 'Diclac 1% w/w Gel', from: '2026-10-05', to: '2026-10-21' },
      { product: 'Amlodipine Teva 10 mg Tablets', from: '2026-11-13', to: '2026-12-04' },
    ],
  },
  slipping: [
    { product: 'Amlodipine Teva 10 mg Tablets', pushed_out: 2, dates: ['2026-10-30', '2026-11-13', '2026-12-04'] },
  ],
  last_one: [],
  starting: [],
  // Reasons only where we recorded them for that morning.
  wall: [
    { product: 'Calvepen 666 mg Tablets', reason: 'Manufacturing delay' },
    { product: 'Parox 10 mg Film-Coated Tablets', reason: 'Manufacturing delay' },
    { product: 'Vatan 40 mg Film-coated Tablets', reason: 'Manufacturing delay' },
    { product: 'Gabin 100 mg capsules, hard', reason: 'Manufacturing delay' },
    { product: 'Daktarin 20 mg / g Oral Gel', reason: 'Quality issue' },
    { product: 'Diclac 1% w/w Gel', reason: '' },
    { product: 'Amlodipine Teva 10 mg Tablets', reason: '' },
    { product: 'Grepid 75 mg film-coated tablets', reason: '' },
    { product: 'Osmohale, inhalation powder, hard capsule', reason: '' },
    { product: 'Pregabalin Sandoz 150 mg hard capsules', reason: '' },
    { product: 'Ondansetron 8 mg film-coated tablets', reason: '' },
    { product: 'Tendrotil SR 2 mg Prolonged-Release Capsules', reason: '' },
  ],
};

const FALLBACK_STATS = {
  as_of_label: '29 September 2026',
  notified: 372,
  current: 372,
  past_return_date: 35,
  not_yet_impacting: 27,
  groups_last_product: 21,
  ic_groups: 518,
  days_archived: 58,
};

/* ------------------------------------------------------------------
   DATA
   ------------------------------------------------------------------ */
function useJson(path, fallback, isValid) {
  const [data, setData] = useState(fallback);
  useEffect(() => {
    let cancelled = false;
    fetch(process.env.PUBLIC_URL + path, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && isValid(d)) setData({ ...fallback, ...d, live: true });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return data;
}

const useShowcase = () =>
  useJson('/insova-showcase.json', FALLBACK_SHOWCASE, (d) => d.schema && d.counts && d.changes);
const useStats = () =>
  useJson('/insova-stats.json', FALLBACK_STATS, (d) => d.notified);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function d8(iso) {
  if (!iso) return 'no date';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}
function dLong(iso) {
  if (!iso) return 'no date';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/* Fade sections up once, as they scroll into view. */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.mk-reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('mk-in'));
      return undefined;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('mk-in'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  });
}

function useInView(threshold = 0.3) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return undefined;
    if (!('IntersectionObserver' in window)) { setSeen(true); return undefined; }
    const o = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); o.disconnect(); }
    }, { threshold });
    o.observe(el);
    return () => o.disconnect();
  }, [seen, threshold]);
  return [ref, seen];
}

function CountUp({ target }) {
  const [ref, seen] = useInView(0.4);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!seen) return undefined;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setN(target); return undefined; }
    let raf;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 1100);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seen, target]);
  return <span ref={ref}>{n}</span>;
}

const scrollTo = (id) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/* ------------------------------------------------------------------
   SOURCE BUTTON. Rendered into document.body.
   ------------------------------------------------------------------ */
function Info({ label, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const b = btnRef.current.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 24);
    const left = Math.max(12, Math.min(b.left + b.width / 2 - width / 2, window.innerWidth - width - 12));
    const above = window.innerHeight - b.bottom < 200 && b.top > 220;
    setPos({ left, width, top: above ? null : b.bottom + 10, bottom: above ? window.innerHeight - b.top + 10 : null });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => {
      if (!btnRef.current?.contains(e.target) && !popRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <span className="mk-info">
      <button ref={btnRef} type="button" className="mk-info-btn" aria-label={`Source: ${label}`}
        aria-expanded={open} onClick={toggle}>i</button>
      {open && pos && createPortal(
        <div ref={popRef} className="mk-info-pop" role="dialog"
          style={{ left: pos.left, width: pos.width, top: pos.top ?? 'auto', bottom: pos.bottom ?? 'auto' }}>
          <span className="mk-info-pop-label">Source</span>
          {children}
        </div>,
        document.body
      )}
    </span>
  );
}

/* ------------------------------------------------------------------
   ICONS
   ------------------------------------------------------------------ */
const I = {
  today: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  list: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  shortages: <path d="M4 6h16M4 12h16M4 18h16" />,
  meds: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  low: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16" /></>,
  notices: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6l-10 7L2 6" /></>,
  shield: <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />,
  doc: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h7" /></>,
  swap: <><path d="M7 7h11l-3-3" /><path d="M17 17H6l3 3" /></>,
  screen: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  store: <><path d="M4 9l1-5h14l1 5" /><path d="M4 9v11h16V9" /><path d="M4 9a3 3 0 0 0 5 0 3 3 0 0 0 6 0 3 3 0 0 0 5 0" /></>,
  chain: <><rect x="3" y="10" width="6" height="10" rx="1" /><rect x="15" y="10" width="6" height="10" rx="1" /><path d="M9 14h6M6 10V6h12v4" /></>,
  truck: <><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  browser: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  install: <><path d="M12 3v12" /><path d="M8 11l4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
};

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {I[name]}
    </svg>
  );
}

const LinkedInIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

/* ------------------------------------------------------------------
   HERO STAGE: this morning, live
   ------------------------------------------------------------------ */
function feedFrom(sc) {
  const a = sc.changes.appeared.map((c) => ['a', c.product, c.detail ? `appeared · ${c.detail.toLowerCase()}` : 'appeared']);
  const b = sc.changes.left.map((c) => ['b', c.product, 'left the register']);
  const m = sc.changes.moved.map((c) => ['c', c.product, `return ${d8(c.from)} → ${d8(c.to)}`]);
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length, m.length); i += 1) {
    if (a[i]) out.push(a[i]);
    if (m[i]) out.push(m[i]);
    if (b[i]) out.push(b[i]);
  }
  return out.length ? out : [['c', 'The register did not change overnight', 'quiet morning']];
}

function Stage({ sc }) {
  const cols = [
    ['a', 'Appeared', sc.counts.appeared, sc.changes.appeared.map((c) => [c.product, c.detail])],
    ['b', 'Left', sc.counts.left, sc.changes.left.map((c) => [c.product, ''])],
    ['c', 'Date moved', sc.counts.moved, sc.changes.moved.map((c) => [c.product, `${d8(c.from)} → ${d8(c.to)}`])],
  ];
  const feed = feedFrom(sc);
  const slip = sc.slipping && sc.slipping[0];

  return (
    <div className="mk-stage" aria-hidden="true">
      <div className="mk-card mk-card-main">
        <div className="mk-c-head">
          <b>What changed overnight</b>
          <span>{sc.live ? 'this morning' : `example · ${sc.as_of_label}`}</span>
        </div>
        <div className="mk-mini-cols">
          {cols.map(([k, name, n, rows], ci) => (
            <div key={k}>
              <h6 className={'mk-mini-h ' + k}>{name}<em>{n}</em></h6>
              {rows.slice(0, 3).map(([p, d], ri) => (
                <div className="mk-mini-row" key={p + ri} style={{ animationDelay: `${0.6 + ci * 0.25 + ri * 0.12}s` }}>
                  <b>{p}</b>{d && <small>{d}</small>}
                </div>
              ))}
              {rows.length === 0 && <div className="mk-mini-row none"><small>None</small></div>}
            </div>
          ))}
        </div>
      </div>

      <div className="mk-card mk-card-feed">
        <div className="mk-c-head"><b>Live from the register</b><span className="mk-live-dot">live</span></div>
        <div className="mk-feed">
          <div className="mk-feed-track" style={{ animationDuration: `${Math.max(18, feed.length * 2.6)}s` }}>
            {[...feed, ...feed].map(([k, p, d], i) => (
              <div className="mk-feed-item" key={i}>
                <span className={'mk-dot ' + k} />
                <span><b>{p}</b><small>{d}</small></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {slip && slip.dates && slip.dates.length > 1 && (
        <div className="mk-card mk-card-hist">
          <div className="mk-c-head"><b>{slip.product}</b><span>expected return</span></div>
          <div className="mk-hist-line">
            {slip.dates.map((dt, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="mk-hist-arrow" style={{ animationDelay: `${1.4 + i * 0.5}s` }}>{'→'}</span>}
                <span className={'mk-hist-date' + (i === slip.dates.length - 1 ? ' now' : '')}
                  style={{ animationDelay: `${1.2 + i * 0.5}s` }}>{d8(dt)}</span>
              </React.Fragment>
            ))}
          </div>
          <p className="mk-hist-note">Pushed back {slip.pushed_out} times.</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   WALL: medicines on the register this morning
   ------------------------------------------------------------------ */
function Wall({ sc }) {
  const wall = sc.wall && sc.wall.length ? sc.wall : FALLBACK_SHOWCASE.wall;
  const rows = [[], [], []];
  wall.forEach((w, i) => rows[i % 3].push(w));
  return (
    <div className="mk-wall" aria-label="Medicines on the shortage register">
      {rows.map((row, r) => (
        <div className={'mk-wall-row' + (r === 1 ? ' rev' : '')} key={r}>
          <div className="mk-wall-track" style={{ animationDuration: `${60 + r * 12}s` }}>
            {[...row, ...row].map((w, i) => (
              <span className="mk-pill-med" key={i} aria-hidden={i >= row.length}>
                <b>{w.product}</b>
                {(w.not_started || w.reason || w.expected_return) && (
                  <small>
                    {w.not_started ? 'starts soon' : w.reason}
                    {w.expected_return ? `${w.not_started || w.reason ? ' · ' : ''}expected ${d8(w.expected_return)}` : ''}
                  </small>
                )}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------
   INSIDE INSOVA: a look at the product, filled from this morning
   ------------------------------------------------------------------ */
const TABS = [
  ['today', 'Today'],
  ['list', 'Your list'],
  ['shortages', 'Shortages'],
  ['low', 'Running low'],
  ['notices', 'Notices'],
  ['meds', 'All medicines'],
];

function Tour({ sc }) {
  const [tab, setTab] = useState('today');
  const [auto, setAuto] = useState(true);
  const [ref, seen] = useInView(0.35);

  // Steps through the screens on its own until someone clicks a tab.
  useEffect(() => {
    if (!auto || !seen) return undefined;
    const t = setInterval(() => {
      setTab((cur) => TABS[(TABS.findIndex((x) => x[0] === cur) + 1) % TABS.length][0]);
    }, 6500);
    return () => clearInterval(t);
  }, [auto, seen]);

  const pick = (id) => { setAuto(false); setTab(id); };
  const title = TABS.find((t) => t[0] === tab)[1];

  return (
    <div className="mk-tour mk-reveal" ref={ref}>
      <div className="mk-tour-side" role="tablist" aria-label="Insova screens">
        <div className="mk-tour-brand">
          <img src={process.env.PUBLIC_URL + '/insova-logo.png'} alt="Insova" />
        </div>
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            className={'mk-tour-tab' + (tab === id ? ' on' : '')} onClick={() => pick(id)}>
            <Icon name={id} size={16} />{label}
            {auto && tab === id && <i className="mk-tour-timer" />}
          </button>
        ))}
      </div>
      <div className="mk-tour-main">
        <div className="mk-tour-top">
          <b>{title}<em className="mk-ex">Example</em></b>
          <span><span className="mk-pulse" />Register collected {sc.as_of_label}</span>
        </div>
        <div className="mk-tour-body" key={tab}>
          {tab === 'today' && <PanelToday sc={sc} />}
          {tab === 'list' && <PanelList sc={sc} />}
          {tab === 'shortages' && <PanelShortages />}
          {tab === 'low' && <PanelLow sc={sc} />}
          {tab === 'notices' && <PanelNotices />}
          {tab === 'meds' && <PanelMeds />}
        </div>
      </div>
    </div>
  );
}

function PanelToday({ sc }) {
  const cols = [
    ['a', 'Appeared', sc.counts.appeared, sc.changes.appeared.map((c) => [c.product, c.detail])],
    ['b', 'Left the register', sc.counts.left, sc.changes.left.map((c) => [c.product, ''])],
    ['c', 'Return date moved', sc.counts.moved, sc.changes.moved.map((c) => [c.product, `${d8(c.from)} → ${d8(c.to)}`])],
  ];
  return (
    <>
      <div className="mk-chg-cols">
        {cols.map(([k, name, n, rows]) => (
          <div key={k}>
            <h5 className={'mk-chg-h ' + k}>{name} <em>{n}</em></h5>
            {rows.slice(0, 4).map(([p, d], i) => (
              <div className="mk-chg" key={p + i}><strong>{p}</strong>{d && <small>{d}</small>}</div>
            ))}
            {rows.length === 0 && <p className="mk-chg-none">None this morning</p>}
          </div>
        ))}
      </div>
      <p className="mk-panel-foot">
        Since our previous collection{sc.compare_label ? ` on ${sc.compare_label}` : ''}. Your own
        products come first, then the national picture.
      </p>
    </>
  );
}

function PanelList({ sc }) {
  const slip = sc.slipping && sc.slipping[0];
  const app = sc.changes.appeared[0];
  const left = sc.changes.left[0];
  return (
    <>
      <div className="mk-mine">
        {slip && slip.dates && slip.dates.length > 1 && (
          <div className="mk-mine-row">
            <span className="mk-tag amber">date moved</span>
            <span>
              <strong>{slip.product}</strong>
              <small>Expected return, as our archive recorded it:</small>
              <ol className="mk-tl">
                {slip.dates.map((dt, i) => (
                  <li key={i}><b>{dLong(dt)}</b><span>{i === 0 ? 'first date we recorded' : 'pushed back'}</span></li>
                ))}
              </ol>
            </span>
          </div>
        )}
        {app && (
          <div className="mk-mine-row">
            <span className="mk-tag red">newly short</span>
            <span><strong>{app.product}</strong><small>{app.detail || 'Reason not stated'}</small></span>
          </div>
        )}
        {left && (
          <div className="mk-mine-row">
            <span className="mk-tag green">off the register</span>
            <span><strong>{left.product}</strong><small>The HPRA no longer lists it as short. Worth ringing your wholesaler.</small></span>
          </div>
        )}
      </div>
      <p className="mk-panel-foot">
        Star the products you dispense. Whatever happens to them is the first thing you see.
        Add a supply note, dismiss what you have dealt with.
      </p>
    </>
  );
}

function PanelShortages() {
  return (
    <div className="mk-scard open">
      <div className="mk-scard-head">
        <span className="mk-star" aria-hidden="true">{'☆'}</span>
        <span className="mk-risk">68</span>
        <span className="mk-scard-main">
          <strong>Daktarin 20 mg / g Oral Gel</strong>
          <small>Miconazole · JNTL Consumer Health I (Ireland) Limited</small>
        </span>
        <span className="mk-scard-tags"><span className="mk-tag grey">not on IC list</span></span>
      </div>
      <div className="mk-scard-body">
        <div className="mk-facts">
          <div><span>Shortage date</span><b>31 Aug 2023</b></div>
          <div><span>Running</span><b>over 3 years</b></div>
          <div><span>Expected return</span><b>none given</b></div>
          <div><span>Reason</span><b>Quality issue</b></div>
          <div><span>Licence</span><b>PA23490/028/003</b></div>
          <div><span>Markets affected</span><b>Global</b></div>
        </div>
        <div className="mk-verdict">
          <strong>Not on the HPRA List of Interchangeable Medicines.</strong> An appropriate
          alternative exists, but it needs the prescriber's decision before substitution.
        </div>
        <p className="mk-riskline">
          <b>Supply risk 68.</b> How hard this shortage is to work around, with every reason behind
          the score shown. Example from the register of 19 September 2026.
        </p>
      </div>
    </div>
  );
}

function PanelLow({ sc }) {
  const groups = (sc.last_one || []).slice(0, 4);
  return (
    <>
      <p className="mk-panel-lead">
        When one product goes short, demand lands on the rest of its interchangeable group. These
        groups are down to their last available product{sc.live ? ' this morning' : ''}.
      </p>
      {groups.length === 0 && <p className="mk-chg-none">Example not available today.</p>}
      {groups.map((g) => (
        <div className="mk-low" key={g.desc}>
          <span><strong>{g.desc}</strong><small>{g.short} of {g.total} short{g.not_marketed ? ` · ${g.not_marketed} not marketed` : ''} · 1 left</small></span>
          <span className="mk-bar" aria-hidden="true">
            {Array.from({ length: Math.min(g.total, 10) }).map((_, i) => (
              <i key={i} className={i < g.short ? 'short' : i < g.short + g.not_marketed ? 'off' : 'ok'} />
            ))}
          </span>
        </div>
      ))}
      <p className="mk-panel-foot">
        A licence that is not on the market does not count as an alternative. Every product in
        the group is listed, with its status.
      </p>
    </>
  );
}

function PanelNotices() {
  return (
    <>
      <p className="mk-panel-lead">
        Manufacturer letters can run to pages. Insova sums each one up in three lines, every point
        backed by a quote from the letter and checked by our team, with the original one click
        away.
      </p>
      <div className="mk-ns">
        <div className="mk-ns-head"><b>Supply notice</b><span>Read the full notice {'↗'}</span></div>
        <div className="mk-ns-cols">
          <div><h6 className="aff">What's affected</h6><i /><i className="s" /></div>
          <div><h6 className="chg">What's changed</h6><i /><i /><i className="s" /></div>
          <div><h6 className="act">What to do</h6><i /><i className="s" /></div>
        </div>
      </div>
      <p className="mk-panel-foot">Every notice the HPRA links to a shortage, in one list.</p>
    </>
  );
}

const MEDS = [
  ['Co-Amoxiclav TEVA 500 mg / 100 mg Powder for Solution for Injection', 'PA0749/011/001', 'red', 'in shortage'],
  ['XEOMIN 200 units powder for solution for injection', 'PA1907/001/003', 'green', 'authorised'],
  ['Visipaque 320 mg I / ml Solution for Injection', 'PA0735/009/013', 'green', 'authorised'],
  ['Keppra', 'EU/1/00/146/030', 'grey', 'withdrawn'],
];

function PanelMeds() {
  return (
    <>
      <div className="mk-search" aria-hidden="true">
        <Icon name="meds" size={18} /><span>Product, active substance, licence or company</span>
      </div>
      <p className="mk-search-hint">Every authorised and withdrawn medicine in Ireland, about 30,000 of them.</p>
      {MEDS.map(([p, lic, tone, tag]) => (
        <div className="mk-med" key={lic}>
          <span><strong>{p}</strong><small>{lic}</small></span>
          <span className={'mk-tag ' + tone}>{tag}</span>
        </div>
      ))}
      <p className="mk-panel-foot">Star one that is not short, and Insova flags it the morning it goes short.</p>
    </>
  );
}

/* ------------------------------------------------------------------
   ONLY INSOVA: things the register on its own cannot show
   ------------------------------------------------------------------ */
function Slipping({ sc }) {
  const [ref, seen] = useInView(0.4);
  const list = (sc.slipping && sc.slipping.length ? sc.slipping : FALLBACK_SHOWCASE.slipping)
    .filter((s) => s.dates && s.dates.length > 1).slice(0, 3);
  return (
    <div className={'mk-slip' + (seen ? ' go' : '')} ref={ref}>
      {list.map((s, r) => (
        <div className="mk-slip-row" key={s.product}>
          <b>{s.product}</b>
          <div className="mk-slip-line">
            {s.dates.map((dt, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="mk-slip-arrow" style={{ transitionDelay: `${r * 0.3 + i * 0.35}s` }} />}
                <span className={'mk-slip-date' + (i === s.dates.length - 1 ? ' now' : '')}
                  style={{ transitionDelay: `${r * 0.3 + i * 0.35}s` }}>{d8(dt)}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LastOne({ sc }) {
  // Only mount the animated bar once there is a group to show, so its
  // scroll trigger attaches to a real element.
  const g = sc.last_one && sc.last_one[0];
  return g ? <LastOneBar g={g} /> : null;
}

function LastOneBar({ g }) {
  const [ref, seen] = useInView(0.4);
  const n = Math.min(g.total, 10);
  return (
    <div className={'mk-lastone' + (seen ? ' go' : '')} ref={ref}>
      <b>{g.desc}</b>
      <div className="mk-lastone-bar">
        {Array.from({ length: n }).map((_, i) => (
          <i key={i} className={i < g.short ? 'short' : i < g.short + g.not_marketed ? 'off' : 'ok'}
            style={{ transitionDelay: `${i * 0.12}s` }} />
        ))}
      </div>
      <small>{g.short} of {g.total} short{g.not_marketed ? ` · ${g.not_marketed} not marketed` : ''} · <strong>1 left</strong></small>
    </div>
  );
}

function Starting({ sc }) {
  const list = (sc.starting || []).slice(0, 4);
  if (!list.length) {
    return <p className="mk-start-none">Announced shortages appear here before their start date.</p>;
  }
  return (
    <ul className="mk-start">
      {list.map((s) => (
        <li key={s.product}><span className="mk-start-date">{d8(s.start)}</span><b>{s.product}</b></li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------
   ARCHIVE GRID: one square per morning collected, from insova-stats.json
   ------------------------------------------------------------------ */
function DaysGrid({ archived }) {
  const [ref, seen] = useInView(0.3);
  const n = Math.max(1, archived || 1);
  return (
    <div>
      <div ref={ref} className={'mk-days' + (seen ? ' on' : '')} aria-hidden="true">
        {Array.from({ length: n }).map((_, i) => (
          <i key={i} style={{ transitionDelay: `${i * 14}ms` }} />
        ))}
      </div>
      <p className="mk-days-cap">{n} mornings of the register, collected and kept.</p>
    </div>
  );
}

/* ------------------------------------------------------------------
   PAGE
   ------------------------------------------------------------------ */
function Marketing({ onLogin }) {
  const sc = useShowcase();
  const stats = useStats();
  const [booking, setBooking] = useState(false);
  const book = (e) => { if (e) e.preventDefault(); setBooking(true); };
  useReveal();

  const tick = feedFrom(sc);
  const current = sc.counts.current || stats.current;

  return (
    <div className="mk">
      {/* ---------------- nav ---------------- */}
      <nav className="mk-nav">
        <div className="mk-wrap mk-nav-in">
          <button type="button" className="mk-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Insova, back to top">
            <img src={process.env.PUBLIC_URL + '/insova-logo.png'} alt="Insova" />
          </button>
          <div className="mk-nav-links">
            <button type="button" onClick={() => scrollTo('product')}>Product</button>
            <button type="button" onClick={() => scrollTo('why')}>Why Insova</button>
            <button type="button" onClick={() => scrollTo('who')}>Who it's for</button>
            <button type="button" onClick={() => scrollTo('about')}>About</button>
          </div>
          <div className="mk-nav-cta">
            <button type="button" className="mk-btn mk-btn-ghost" onClick={onLogin}>Sign in</button>
            <button type="button" className="mk-btn mk-btn-solid" onClick={book}>Book a demo</button>
          </div>
        </div>
      </nav>

      {/* ---------------- hero ---------------- */}
      <header className="mk-hero">
        <div className="mk-hero-glow" aria-hidden="true" />
        <div className="mk-wrap mk-hero-grid">
          <div className="mk-hero-copy">
            <span className="mk-pill">
              <span className="mk-pulse" />
              {current} medicines short in Ireland{sc.live ? ' this morning' : ''}
            </span>
            {/* The page's one H1. public/index.html carries the same three
                lines for search engines: keep the two identical. */}
            <h1 className="mk-hero-h">
              <span>Know what's short.</span>{' '}
              <span>Know what's changed.</span>{' '}
              <span>Know if you can get it.</span>{' '}
              <span>Know what else to give.</span>
            </h1>
            <p className="mk-hero-sub">
              Insova reads Ireland's medicine shortage register every morning and turns it into one
              clear screen for your pharmacy: what went short overnight, which return dates keep
              slipping, what is left in each group, and the alternatives the HPRA lists as
              interchangeable. Wholesaler stock is next.
            </p>
            <div className="mk-hero-cta">
              <button type="button" className="mk-btn mk-btn-solid mk-btn-lg" onClick={book}>Book a demo</button>
              <button type="button" className="mk-btn mk-btn-line mk-btn-lg" onClick={() => scrollTo('product')}>
                See how it works
              </button>
            </div>
            <p className="mk-hero-fine">
              Ready before you open, every morning. In the browser or as a Windows app, with nothing
              to install on the dispensary system.
            </p>
          </div>
          <Stage sc={sc} />
        </div>
      </header>

      {/* ---------------- ticker ---------------- */}
      <div className="mk-ticker" aria-hidden="true">
        <div className="mk-ticker-track" style={{ animationDuration: `${Math.max(30, tick.length * 4)}s` }}>
          {[...tick, ...tick].map(([k, p, d], i) => (
            <span className="mk-tick" key={i}><span className={'mk-dot ' + k} /><b>{p}</b> {d}</span>
          ))}
        </div>
      </div>

      {/* ---------------- recognise ---------------- */}
      <section className="mk-section mk-recog">
        <div className="mk-wrap mk-reveal">
          <h2 className="mk-h2 mk-recog-h"><span className="mk-pulse" />Currently short</h2>
        </div>
        <Wall sc={sc} />
      </section>

      {/* ---------------- product ---------------- */}
      <section className="mk-section mk-soft" id="product">
        <div className="mk-wrap">
          <div className="mk-reveal mk-center">
            <p className="mk-kicker">The product</p>
            <h2 className="mk-h2">Every shortage, made workable.</h2>
            <p className="mk-lead">
              One place for what used to take a morning of phone calls and HPRA searches. Below is
              an example of the Insova application, filled with {sc.live ? "this morning's" : 'real'} register
              so you can see how it works.
            </p>
          </div>
          <Tour sc={sc} />
          <div className="mk-platform mk-reveal">
            <div>
              <Icon name="browser" size={22} />
              <span><b>Runs in the browser</b>Open it on the dispensary computer. Nothing to install, no IT project, no new hardware.</span>
            </div>
            <div>
              <Icon name="install" size={22} />
              <span><b>Install it if you want it</b>Insova can be installed as a Windows app. Same tool, its own window, on the taskbar.</span>
            </div>
            <div>
              <Icon name="sun" size={22} />
              <span><b>Ready each morning</b>Collected and updated before you open, every day. A short morning email is on the way.</span>
            </div>
          </div>
          <div className="mk-features">
            {[
              ['today', 'What changed, first', 'Every morning: what appeared, what left, and whose return date moved since yesterday.'],
              ['list', 'Your products on top', 'Star what you dispense. News on your products is the first thing you see.'],
              ['swap', 'Alternatives you can trust', 'Only what the HPRA List of Interchangeable Medicines lists, cited by IC code.'],
              ['low', 'Groups running out', 'See when a group is down to its last product before demand lands on it.'],
              ['notices', 'Notices in three lines', 'Long manufacturer letters summed up, quoted, checked, and linked to the original.'],
              ['meds', 'Every medicine in Ireland', 'Search all authorised and withdrawn medicines, with market status.'],
            ].map(([ic, h, p]) => (
              <div className="mk-feature mk-reveal" key={h}>
                <span className="mk-feature-ic"><Icon name={ic} size={20} /></span>
                <h3>{h}</h3>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- why ---------------- */}
      <section className="mk-section" id="why">
        <div className="mk-wrap">
          <div className="mk-reveal">
            <p className="mk-kicker">Why Insova</p>
            <h2 className="mk-h2">What the register can't tell you.</h2>
            <p className="mk-lead">
              The HPRA register shows today and nothing else. Insova has kept a copy every morning
              since {dLong(sc.first_archived || '2026-08-03')}, so it can show what the register on
              its own never will.
            </p>
          </div>

          <div className="mk-why">
            <div className="mk-why-card mk-reveal">
              <h3>Return dates that keep slipping</h3>
              <p>
                The register overwrites the old date. We keep it, so you can see which "back next
                week" has said that three times before.
              </p>
              <Slipping sc={sc} />
            </div>
            <div className="mk-why-card mk-reveal">
              <h3>Groups down to one product</h3>
              <p>
                {sc.counts.groups_last_product || stats.groups_last_product} interchangeable groups
                are down to their last available product{sc.live ? ' this morning' : ''}. When it goes, there is
                nothing left to substitute at the counter.
              </p>
              <LastOne sc={sc} />
            </div>
            <div className="mk-why-card mk-reveal">
              <h3>Shortages before they start</h3>
              <p>
                {sc.counts.not_started || stats.not_yet_impacting} shortages are announced but haven't
                started yet. Time to order ahead.
              </p>
              <Starting sc={sc} />
            </div>
          </div>

          <div className="mk-idea">
            <div className="mk-reveal">
              <p className="mk-kicker">Where this is heading</p>
              <h3 className="mk-h3">Today it shows what's short. Next, whether you can get it.</h3>
              <p>
                The register gives each shortage one expected return date, and overwrites it. Insova
                keeps a copy every morning, which is what lets it show how a date has moved. A missed
                morning can't be recovered, so we don't miss any.
              </p>
              <p>
                That archive is what earlier warning will be built on. Alongside it, we're working with
                the supply chain to put wholesaler stock beside every shortage, so the pharmacist
                sees not just what's short, but whether they can get it.
              </p>
            </div>
            <div className="mk-reveal">
              <DaysGrid archived={stats.days_archived} />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- live band ---------------- */}
      <section className="mk-section mk-live">
        <div className="mk-wrap">
          <p className="mk-kicker">From this morning's register</p>
          <h2 className="mk-h2">Updated <span>every day.</span></h2>
          <div className="mk-figs mk-reveal">
            <div className="mk-fig">
              <b>
                <CountUp target={stats.current} />
                <Info label="products on the shortage register">
                  HPRA national medicine shortage register, collected {stats.as_of_label}. Should
                  match the total shown on the HPRA website.
                </Info>
              </b>
              <span>products on the HPRA shortage register</span>
            </div>
            <div className="mk-fig">
              <b>
                <CountUp target={stats.past_return_date} />
                <Info label="shortages past their expected return date">
                  Insova analysis. Register entries whose expected return date has already passed
                  while the shortage is still listed.
                </Info>
              </b>
              <span>past the return date the register gave them</span>
            </div>
            <div className="mk-fig">
              <b>
                <CountUp target={stats.groups_last_product} />
                <Info label="interchangeable groups down to one product">
                  Insova analysis. Groups on the HPRA List of Interchangeable Medicines where only
                  one product is both off the shortage register and recorded by the HPRA as
                  marketed.
                </Info>
              </b>
              <span>interchangeable groups down to one product</span>
            </div>
            <div className="mk-fig">
              <b>
                <CountUp target={stats.not_yet_impacting} />
                <Info label="announced shortages still to start">
                  Insova analysis. Register entries whose shortage date is still in the future,
                  notified before supply is affected.
                </Info>
              </b>
              <span>announced, with the shortage still to start</span>
            </div>
          </div>
          <p className="mk-live-note">
            From the HPRA medicine shortage register and the HPRA List of Interchangeable Medicines
            {stats.ic_groups ? ` (${stats.ic_groups} groups)` : ''}, as collected on {stats.as_of_label}.
            The analysis is our own.
          </p>
        </div>
      </section>

      {/* ---------------- who ---------------- */}
      <section className="mk-section" id="who">
        <div className="mk-wrap">
          <div className="mk-reveal mk-center">
            <p className="mk-kicker">Who it's for</p>
            <h2 className="mk-h2">Built for community pharmacy.</h2>
          </div>
          <div className="mk-who">
            <div className="mk-who-card mk-reveal">
              <span className="mk-feature-ic"><Icon name="store" size={22} /></span>
              <h3>Independent pharmacies</h3>
              <p>
                Start the day knowing what changed on the products you dispense, without searching
                the HPRA site one product at a time.
              </p>
              <button type="button" className="mk-who-go" onClick={book}>Book a demo <Icon name="arrow" size={16} /></button>
            </div>
            <div className="mk-who-card mk-reveal">
              <span className="mk-feature-ic"><Icon name="chain" size={22} /></span>
              <h3>Pharmacy groups</h3>
              <p>
                Each branch is set up as its own pharmacy with its own accounts, all working from the
                same daily register, so every counter has the same information.
              </p>
              <button type="button" className="mk-who-go" onClick={book}>Book a call <Icon name="arrow" size={16} /></button>
            </div>
            <div className="mk-who-card mk-reveal">
              <span className="mk-feature-ic"><Icon name="truck" size={22} /></span>
              <h3>Wholesalers and partners</h3>
              <p>
                The register says what is short, not what a pharmacy can get. We're working with the
                supply chain to put stock availability beside every shortage.
              </p>
              <a className="mk-who-go" href="mailto:contact@insova.ie?subject=Partnership">Partner with us <Icon name="arrow" size={16} /></a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- trust ---------------- */}
      <section className="mk-section mk-soft">
        <div className="mk-wrap mk-trust">
          <div className="mk-reveal">
            <p className="mk-kicker">Built on official data</p>
            <h2 className="mk-h2">Safe by design.</h2>
            <p className="mk-lead">
              Insova is an information tool for pharmacists. Every figure can be checked against
              the source it came from.
            </p>
          </div>
          <ul className="mk-trust-list mk-reveal">
            <li><Icon name="doc" size={20} /><span><b>Official sources only.</b> The HPRA shortage register, the List of Interchangeable Medicines and the authorised and withdrawn medicine lists, re-used under licence.</span></li>
            <li><Icon name="swap" size={20} /><span><b>Alternatives from the HPRA list, never invented.</b> Every one cited by its IC code. Where the HPRA lists none, Insova says so.</span></li>
            <li><Icon name="shield" size={20} /><span><b>No patient data.</b> Insova never substitutes, orders or dispenses, and holds no patient records.</span></li>
            <li><Icon name="screen" size={20} /><span><b>Nothing to install on the dispensary system.</b> Runs in the browser, or install it as a Windows app. Accounts are stored in the EU.</span></li>
          </ul>
        </div>
      </section>

      {/* ---------------- next ---------------- */}
      <section className="mk-section">
        <div className="mk-wrap">
          <div className="mk-reveal">
            <p className="mk-kicker">Coming next</p>
            <h2 className="mk-h2">Where Insova is going.</h2>
          </div>
          <div className="mk-next">
            <div className="mk-next-item mk-reveal"><span>01</span><b>Wholesaler stock</b><p>Whether you can actually get it, beside every shortage.</p></div>
            <div className="mk-next-item mk-reveal"><span>02</span><b>The morning email</b><p>What changed on your products, in your inbox before you open.</p></div>
            <div className="mk-next-item mk-reveal"><span>03</span><b>Earlier warning</b><p>Spotting which medicines are likely to go short, built on the archive we keep every day.</p></div>
          </div>
        </div>
      </section>

      {/* ---------------- policy ---------------- */}
      <section className="mk-section mk-soft">
        <div className="mk-wrap">
          <div className="mk-reveal">
            <p className="mk-kicker">Policy</p>
            <h2 className="mk-h2">Built for where Irish healthcare is going.</h2>
          </div>
          <div className="mk-policy">
            <div className="mk-pcard mk-reveal">
              <span className="mk-ptag">HSE AI for Care 2026–2030</span>
              <h3>A national plan for AI in health</h3>
              <p>
                Ireland's first national strategy for AI in health and social care, including
                supply chain optimisation. Earlier warning of shortages depends on a long daily
                record like the one Insova keeps.
              </p>
              <a href="https://about.hse.ie/publications/ai-for-care-2026-2030/" target="_blank" rel="noopener noreferrer">
                Read the strategy {'→'}
              </a>
            </div>
            <div className="mk-pcard mk-reveal">
              <span className="mk-ptag">Community Pharmacy Agreement 2025</span>
              <h3>Investment in community pharmacy</h3>
              <p>
                {'€'}75 million for community pharmacy, with digital systems and structured,
                shared information among its priorities.
              </p>
            </div>
            <div className="mk-pcard mk-reveal">
              <span className="mk-ptag">Health (Miscellaneous Provisions) Act 2024</span>
              <h3>Serious shortage protocols</h3>
              <p>
                Protocols that would let pharmacists substitute during a serious shortage without
                going back to the prescriber. When they arrive, pharmacists will need to see which
                shortages have one.
              </p>
              <a href="https://www.oireachtas.ie/en/bills/bill/2024/5/" target="_blank" rel="noopener noreferrer">
                View the Act {'→'}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- about ---------------- */}
      <section className="mk-section" id="about">
        <div className="mk-wrap mk-about">
          <div className="mk-reveal">
            <p className="mk-kicker">About</p>
            <h2 className="mk-h2">Pharmacy meets technology.</h2>
            <p className="mk-lead">
              Insova was founded in Cork by a pharmacy student and a technologist, and is built
              with the pharmacists who use it.
            </p>
          </div>
          <div className="mk-team">
            <div className="mk-person mk-reveal">
              <img className="mk-face" src={process.env.PUBLIC_URL + '/isobel.jpeg'} alt="Isobel Hynes" />
              <div><h3>Isobel Hynes</h3><p className="mk-role">Co-founder, pharmacy</p><p>Pharmacy, University College Cork.</p></div>
            </div>
            <div className="mk-person mk-reveal">
              <img className="mk-face" src={process.env.PUBLIC_URL + '/jack.png'} alt="Jack Kennedy" />
              <div><h3>Jack Kennedy</h3><p className="mk-role">Co-founder, technology</p><p>Business Information Systems, University College Cork.</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- final cta ---------------- */}
      <section className="mk-cta">
        <div className="mk-wrap mk-cta-in mk-reveal">
          <div>
            <h2>See it with your own pharmacy's medicines.</h2>
            <p>Pick a time that suits you. A 20-minute call, and we'll show you Insova on the products you dispense.</p>
          </div>
          <div className="mk-cta-btns">
            <button type="button" className="mk-btn mk-btn-lime mk-btn-lg" onClick={book}>Book a demo</button>
            <div className="mk-cta-links">
              <a href="mailto:contact@insova.ie"><Icon name="mail" size={18} /> contact@insova.ie</a>
              <a href="https://www.linkedin.com/company/insovaie/" target="_blank" rel="noopener noreferrer"><LinkedInIcon /> LinkedIn</a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- footer ---------------- */}
      <footer className="mk-footer">
        <div className="mk-wrap">
          <div className="mk-foot-top">
            <img className="mk-foot-logo" src={process.env.PUBLIC_URL + '/insova-logo.png'} alt="Insova" />
            <div className="mk-foot-links">
              <button type="button" onClick={onLogin}>Sign in</button>
              <button type="button" onClick={book}>Book a demo</button>
              <a href="/privacy.html">Privacy</a>
              <a href="mailto:contact@insova.ie">contact@insova.ie</a>
            </div>
          </div>
          {/* Required by the CC BY 4.0 licence granted by the HPRA on
              9 September 2026. Their wording. The last line is the
              licence's No Endorsement condition. */}
          <div className="mk-legal">
            <p>
              {COMPANY.name}, {COMPANY.form}. Registered in Ireland, company number {COMPANY.number}.
              Registered office: {COMPANY.office}.
            </p>
            <p>Information only. Insova never substitutes, orders or dispenses, and is not a patient record system.</p>
            <p>
              Information provided courtesy of the Health Products Regulatory Authority (HPRA) under a
              Creative Commons Attribution 4.0 International{' '}
              <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="license noopener noreferrer">CC BY 4.0</a> licence.
              Insova is not connected with, sponsored by, or endorsed by the HPRA.
            </p>
            {!sc.live && (
              <p>Register examples on this page are from {FALLBACK_SHOWCASE.as_of_label}; this morning's could not be loaded.</p>
            )}
          </div>
          <div className="mk-foot-bottom">
            <span>{'©'} 2026 {COMPANY.name}</span>
            <span>Dublin and Cork, Ireland</span>
          </div>
        </div>
      </footer>

      {booking && <DemoBooking onClose={() => setBooking(false)} fallbackMail={DEMO_MAIL} />}
    </div>
  );
}

export default Marketing;