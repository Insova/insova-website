import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Marketing.css';

/*
  insova.ie, the public homepage.

  Everything here is namespaced .mk- and styled from Marketing.css, so it
  cannot collide with App.css, which the app, the sign-in page and the
  loading screens still use.

  WHAT IS REAL ON THIS PAGE
  -------------------------
  * The four figures in the navy band come from /insova-stats.json, which
    the pipeline rebuilds every morning. Every one has a source button.
  * The dashboard demo and the moving cards use REAL entries from the
    HPRA register as collected on 19 and 20 September 2026: real
    products, real dates, real changes. They are labelled as examples
    with that date, so they stay honest as they age. Nothing in them is
    invented, because a pharmacist who spots one made-up return date on
    the homepage will wonder what else is made up.

  WHAT IS NOT BUILT, AND SAYS SO
  ------------------------------
  * The daily brief email does not send yet. Everywhere it appears it is
    marked "Coming soon". Remove those labels the day it sends.
  * Wholesaler availability and earlier warning are shown under "In
    development", below what works today, never as the headline.
*/

/* ------------------------------------------------------------------
   COMPANY PARTICULARS
   Section 151 of the Companies Act 2014: a company's website must show,
   somewhere prominent or easily accessible, its name and legal form,
   where it is registered and its number, and its registered office.
   Taken from the CRO certificate of incorporation, 28 September 2026.

   FILL IN THE REGISTERED OFFICE. It is the address on the CRO record
   (form A1), which is not printed on the certificate. Until it is
   filled in, the footer shows the name and number only, which does NOT
   yet meet the requirement.
   ------------------------------------------------------------------ */
const COMPANY = {
  name: 'Insova Limited',
  form: 'a private company limited by shares',
  number: '826812',
  office: '', // e.g. '29 Blackhorse Avenue, Dublin 7, Ireland'
};

/* ------------------------------------------------------------------
   LIVE DATA
   ------------------------------------------------------------------ */
const FALLBACK_STATS = {
  as_of: '2026-09-29',
  as_of_label: '29 September 2026',
  notified: 372,
  current: 372,
  past_return_date: 35,
  not_yet_impacting: 27,
  groups_last_product: 21,
  ic_groups: 518,
  days_archived: 58,
};

const FIRST_ARCHIVED = '2026-08-03';

function useLiveStats() {
  const [stats, setStats] = useState(FALLBACK_STATS);
  useEffect(() => {
    let cancelled = false;
    fetch(process.env.PUBLIC_URL + '/insova-stats.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && d.notified) setStats({ ...FALLBACK_STATS, ...d });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return stats;
}

/* True once the element has scrolled into view. Used for the archive
   grid and the progress line, which animate once and stay put. */
function useInView(threshold = 0.25) {
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

/* ------------------------------------------------------------------
   SOURCE BUTTON
   Every figure on the page can show where it came from. Rendered into
   document.body, so its styles in Marketing.css are not scoped to .mk.
   ------------------------------------------------------------------ */
function Info({ label, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const measure = () => {
    const b = btnRef.current && btnRef.current.getBoundingClientRect();
    if (!b) return null;
    const width = Math.min(300, window.innerWidth - 24);
    let left = b.left + b.width / 2 - width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    const spaceBelow = window.innerHeight - b.bottom;
    const above = spaceBelow < 200 && b.top > 220;
    return {
      left,
      width,
      top: above ? null : b.bottom + 10,
      bottom: above ? window.innerHeight - b.top + 10 : null,
    };
  };

  const toggle = () => {
    if (open) { setOpen(false); return; }
    setPos(measure());
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => {
      const inBtn = btnRef.current && btnRef.current.contains(e.target);
      const inPop = popRef.current && popRef.current.contains(e.target);
      if (!inBtn && !inPop) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const reposition = () => setPos(measure());
    document.addEventListener('mousedown', outside);
    document.addEventListener('touchstart', outside);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', reposition, { passive: true });
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('touchstart', outside);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', reposition);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  const popup = open && pos ? createPortal(
    <div
      ref={popRef}
      className="mk-info-pop"
      role="tooltip"
      style={{
        left: pos.left + 'px',
        width: pos.width + 'px',
        top: pos.top !== null ? pos.top + 'px' : 'auto',
        bottom: pos.bottom !== null ? pos.bottom + 'px' : 'auto',
      }}
    >
      <span className="mk-info-pop-label">Source</span>
      {children}
    </div>,
    document.body
  ) : null;

  return (
    <span className="mk-info">
      <button
        ref={btnRef}
        type="button"
        className="mk-info-btn"
        aria-label={'Where this figure comes from: ' + label}
        aria-expanded={open}
        onClick={toggle}
      >
        i
      </button>
      {popup}
    </span>
  );
}

function CountUp({ target }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches
        || !('IntersectionObserver' in window)) {
      setCount(target);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duration = 1500;
        const startTime = performance.now();
        const step = (now) => {
          const p = Math.min((now - startTime) / duration, 1);
          setCount(Math.round((1 - Math.pow(1 - p, 3)) * target));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  // If the live figure arrives after the count has run, show the new one.
  useEffect(() => { if (started.current) setCount(target); }, [target]);

  return <span ref={ref}>{count}</span>;
}

/* ------------------------------------------------------------------
   EXAMPLE DATA
   Real entries from the HPRA register as collected on 19 and 20
   September 2026. Do not add anything here that did not happen.
   ------------------------------------------------------------------ */
const EXAMPLE_DATE = '19 September 2026';

const CHANGES = {
  appeared: {
    count: 19,
    rows: [
      ['Calvepen 666 mg Tablets', 'Manufacturing delay'],
      ['Parox 10 mg Film-Coated Tablets', 'Manufacturing delay'],
      ['Vatan 40 mg Film-coated Tablets', 'Manufacturing delay'],
      ['Gabin 100 mg capsules, hard', 'Manufacturing delay'],
    ],
  },
  left: {
    count: 8,
    rows: [
      ['Olanzapine Teva 10 mg Orodispersible tablet', ''],
      ['Letrozole Teva 2.5 mg film-coated tablets', ''],
      ['Silcarfil 20 mg film-coated tablets', ''],
      ['Tevaquel 25 mg Film-coated Tablets', ''],
    ],
  },
  moved: {
    count: 9,
    rows: [
      ['Ondansetron 8 mg film-coated tablets', 'no date \u2192 20 Nov'],
      ['Pregabalin Sandoz 150 mg hard capsules', '30 Sep \u2192 2 Oct'],
      ['Diclac 1% w/w Gel', '5 Oct \u2192 21 Oct'],
      ['Amlodipine Teva 10 mg Tablets', '13 Nov \u2192 4 Dec'],
    ],
  },
};

const FEED = [
  ['a', 'Calvepen 666 mg Tablets', 'appeared, manufacturing delay'],
  ['b', 'Olanzapine Teva 10 mg Orodispersible', 'left the register'],
  ['c', 'Pregabalin Sandoz 150 mg', 'return 30 Sep \u2192 2 Oct'],
  ['a', 'Parox 10 mg Film-Coated Tablets', 'appeared, manufacturing delay'],
  ['b', 'Letrozole Teva 2.5 mg', 'left the register'],
  ['c', 'Ondansetron 8 mg', 'return date set to 20 Nov'],
  ['a', 'Gabin 100 mg capsules', 'appeared, manufacturing delay'],
  ['b', 'Silcarfil 20 mg', 'left the register'],
  ['c', 'Diclac 1% w/w Gel', 'return 5 Oct \u2192 21 Oct'],
  ['a', 'Vatan 40 mg Film-coated Tablets', 'appeared, manufacturing delay'],
  ['b', 'Tevaquel 25 mg', 'left the register'],
  ['c', 'Amlodipine Teva 10 mg', 'return 13 Nov \u2192 4 Dec'],
];
const FEED_LABEL = { a: 'Appeared', b: 'Left', c: 'Date moved' };

const MEDS = [
  ['Co-Amoxiclav TEVA 500 mg / 100 mg Powder for Solution for Injection / Infusion', 'PA0749/011/001', 'Teva Pharma B.V.', 'short'],
  ['Daktarin 20 mg / g Oral Gel', 'PA23490/028/003', 'JNTL Consumer Health I (Ireland) Limited', 'short'],
  ['Osmohale, inhalation powder, hard capsule', 'PA22655/001/001', 'Pharmaxis Europe Limited', 'short'],
  ['XEOMIN 200 units powder for solution for injection', 'PA1907/001/003', 'Merz Pharmaceuticals GmbH', 'auth'],
  ['Visipaque 320 mg I / ml Solution for Injection', 'PA0735/009/013', 'GE Healthcare AS', 'auth'],
  ['Keppra', 'EU/1/00/146/030', 'UCB Pharma S.A.', 'wd'],
  ['Panretin', 'EU/1/00/149/001', 'Amdipharm Limited', 'wd'],
  ['Competact', 'EU/1/06/354/10-12', 'Takeda Pharma A/S', 'wd'],
];
const MED_TAG = { short: 'in shortage', auth: 'authorised', wd: 'withdrawn' };

const SHORTAGES = [
  ['Tendrotil SR 2 mg Prolonged-Release Capsules, Hard', 'Tolterodine tartrate \u00b7 Accord Healthcare Ireland Ltd.', 72, [['amber', '1 left in group']]],
  ['Trusitev SR 2 mg Prolonged-release Capsules, hard', 'Tolterodine tartrate \u00b7 Teva Pharma B.V.', 70, [['amber', '1 left in group']]],
  ['Grepid 75 mg film-coated tablets', 'Clopidogrel besilate \u00b7 Pharmathen S.A.', 65, [['amber', 'date revised'], ['grey', 'not on IC list'], ['red', 'past return date']]],
  ['Osmohale, inhalation powder, hard capsule', 'Mannitol \u00b7 Pharmaxis Europe Limited', 64, [['grey', 'not on IC list'], ['green', 'notice']]],
];

/* ------------------------------------------------------------------
   ICONS
   ------------------------------------------------------------------ */
const I = {
  today: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  list: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  shortages: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  meds: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  low: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16" /></>,
  notices: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  ulm: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  brief: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  browser: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  install: <><path d="M12 3v12" /><path d="M8 11l4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6l-10 7L2 6" /></>,
  q1: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /><path d="M11 8v3l2 1" /></>,
  q2: <><path d="M7 7h11l-3-3" /><path d="M17 17H6l3 3" /></>,
  q3: <><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  q4: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
};

const LinkedInIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

function Icon({ name, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {I[name]}
    </svg>
  );
}

/* ------------------------------------------------------------------
   APPLICATION DEMO
   ------------------------------------------------------------------ */
const TABS = [
  ['today', 'Today'],
  ['list', 'Your list'],
  ['shortages', 'Shortages'],
  ['meds', 'All medicines'],
  ['low', 'Running low'],
  ['notices', 'Notices'],
  ['ulm', 'Unlicensed medicines'],
  ['brief', 'Daily brief'],
];

function Demo() {
  const [tab, setTab] = useState('today');
  // Bumped each time Your list opens, so the return-date history
  // replays its animation rather than showing only the first time.
  const [openCount, setOpenCount] = useState(0);

  const pick = (id) => {
    setTab(id);
    if (id === 'list') setOpenCount((n) => n + 1);
  };

  const title = TABS.find((t) => t[0] === tab)[1];

  return (
    <div className="mk-demo mk-reveal">
      <div className="mk-demo-side" role="tablist" aria-label="Insova screens">
        <div className="mk-demo-brand">
          <img src={process.env.PUBLIC_URL + '/insova-logo.png'} alt="" />
        </div>
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={'mk-demo-tab' + (tab === id ? ' on' : '')}
            onClick={() => pick(id)}
          >
            <Icon name={id} />
            {label}
          </button>
        ))}
      </div>

      <div className="mk-demo-main">
        <div className="mk-demo-top">
          <b>{title}</b>
          <span><span className="mk-pulse" />Register collected {EXAMPLE_DATE}</span>
        </div>

        <div className="mk-demo-body" key={tab}>
          {tab === 'today' && <PanelToday />}
          {tab === 'list' && <PanelList replay={openCount} />}
          {tab === 'shortages' && <PanelShortages />}
          {tab === 'meds' && <PanelMeds />}
          {tab === 'low' && <PanelLow />}
          {tab === 'notices' && <PanelNotices />}
          {tab === 'ulm' && <PanelUlm />}
          {tab === 'brief' && <PanelBrief />}
        </div>

        <div className="mk-demo-note">
          Example screens. Products, dates and changes are real, from the HPRA register as
          collected on {EXAMPLE_DATE}.
        </div>
      </div>
    </div>
  );
}

function PanelToday() {
  const cols = [
    ['a', 'Appeared', CHANGES.appeared],
    ['b', 'Left the register', CHANGES.left],
    ['c', 'Return date moved', CHANGES.moved],
  ];
  return (
    <>
      <div className="mk-chg-cols">
        {cols.map(([k, name, c]) => (
          <div key={k}>
            <h5 className={'mk-chg-h ' + k}>{name} <em>{c.count}</em></h5>
            {c.rows.map(([p, d]) => (
              <div className="mk-chg" key={p}>
                <strong>{p}</strong>
                {d && <small>{d}</small>}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mk-panel-foot">
        <b>"Left the register" is not the same as "back in stock."</b> It means the HPRA no
        longer lists it. The only way to know your wholesaler has it is to check.
      </p>
    </>
  );
}

function PanelList({ replay }) {
  return (
    <>
      <div className="mk-mine">
        <div className="mk-mine-row">
          <span className="mk-tag amber">date moved</span>
          <span>
            <strong>Amlodipine Teva 10 mg Tablets</strong>
            <small>Expected return, as our archive recorded it:</small>
            <ol className="mk-tl" key={replay}>
              <li><b>30 October 2026</b><span>the date given in early September</span></li>
              <li><b>13 November 2026</b><span>pushed back two weeks</span></li>
              <li><b>4 December 2026</b><span>pushed back again, three weeks</span></li>
            </ol>
          </span>
        </div>
        <div className="mk-mine-row">
          <span className="mk-tag green">off the register</span>
          <span><strong>Letrozole Teva 2.5 mg film-coated tablets</strong><small>Left 18 Sept 2026. Worth ringing your wholesaler.</small></span>
        </div>
        <div className="mk-mine-row">
          <span className="mk-tag red">newly short</span>
          <span><strong>Calvepen 666 mg Tablets</strong><small>Manufacturing delay</small></span>
        </div>
        <div className="mk-mine-row">
          <span className="mk-tag green">off the register</span>
          <span><strong>Lercanidipine Clonmel 10 mg film-coated tablets</strong><small>Left 17 Sept 2026. Worth ringing your wholesaler.</small></span>
        </div>
      </div>
      <p className="mk-panel-foot">
        Star the products you dispense, from the shortage list or from every licensed medicine.
        Whatever changes on them comes first each morning.
      </p>
    </>
  );
}

function PanelShortages() {
  return (
    <>
      <div className="mk-cards">
        {SHORTAGES.map(([p, sub, risk, tags]) => (
          <div className="mk-scard" key={p}>
            <span className="mk-star" aria-hidden="true">{'\u2606'}</span>
            <span className="mk-risk">{risk}</span>
            <span className="mk-scard-main"><strong>{p}</strong><small>{sub}</small></span>
            <span className="mk-scard-tags">
              {tags.map(([c, t]) => <span className={'mk-tag ' + c} key={t}>{t}</span>)}
            </span>
          </div>
        ))}

        <div className="mk-scard open">
          <div className="mk-scard-head">
            <span className="mk-star" aria-hidden="true">{'\u2606'}</span>
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
              <div><span>Running</span><b>3 years 1 month</b></div>
              <div><span>Expected return</span><b>none given</b></div>
              <div><span>Reason</span><b>Quality issue</b></div>
              <div><span>Licence</span><b>PA23490/028/003</b></div>
              <div><span>Markets affected</span><b>Global</b></div>
            </div>
            <div className="mk-verdict rx">
              <strong>This medicine does not appear on the HPRA List of Interchangeable Medicines.</strong>
              An appropriate alternative medicine exists, but it requires the prescriber's decision
              before substitution.
            </div>
            <p className="mk-riskline">
              <b>Supply risk 68.</b> How hard this shortage is to work around. The app shows
              every reason behind the score.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function PanelMeds() {
  return (
    <>
      <div className="mk-search" aria-hidden="true">
        <Icon name="meds" size={18} />
        <span>Product name, active substance, licence or company</span>
      </div>
      <p className="mk-search-hint">Around 30,000 authorised and withdrawn medicines in Ireland. Eight shown here.</p>
      {MEDS.map(([p, lic, holder, st]) => (
        <div className="mk-med" key={lic}>
          <span><strong>{p}</strong><small>{lic} · {holder}</small></span>
          <span className={'mk-tag ' + (st === 'short' ? 'red' : st === 'auth' ? 'green' : 'grey')}>{MED_TAG[st]}</span>
        </div>
      ))}
    </>
  );
}

function PanelLow() {
  return (
    <>
      <p className="mk-panel-lead">
        When a medicine goes short, demand moves to the others in its interchangeable group.
        These are the groups closest to having nothing left.
      </p>
      {[
        ['Tendrotil SR 2 mg Prolonged-Release Capsules, Hard', 'Accord Healthcare Ireland Ltd.'],
        ['Trusitev SR 2 mg Prolonged-release Capsules, hard', 'Teva Pharma B.V.'],
      ].map(([p, holder]) => (
        <div className="mk-low" key={p}>
          <span><strong>{p}</strong><small>Tolterodine tartrate · {holder}</small></span>
          <span className="mk-bar" aria-hidden="true"><i /><i /><i className="ok" /></span>
          <span className="mk-tag amber">1 left in group</span>
        </div>
      ))}
      <p className="mk-panel-foot">
        Every other product in the group is shown too, marked not short, also short, or not
        marketed. A licence that isn't on the market doesn't count as an alternative.
      </p>
    </>
  );
}

function PanelNotices() {
  return (
    <>
      <p className="mk-panel-lead">
        Letters manufacturers have issued about a shortage. We link to them where the HPRA
        publishes them, and never summarise or reword them.
      </p>
      {[
        ['DHCP Letter (1)', 'Osmohale, inhalation powder, hard capsule'],
        ['HCP Letter', 'Atomoxetine Accord 25 mg Hard Capsules'],
      ].map(([t, p]) => (
        <div className="mk-notice" key={t}>
          <span><strong>{t}</strong><small>{p}</small></span>
          <span className="mk-notice-go">Open on hpra.ie {'\u2192'}</span>
        </div>
      ))}
    </>
  );
}

function PanelUlm() {
  return (
    <>
      <p className="mk-panel-lead">
        When nothing licensed is available, a shared record of the unlicensed medicines your
        pharmacy has sourced, so the next pharmacist facing the same shortage has something to
        go on.
      </p>
      <div className="mk-form" aria-hidden="true">
        <div><span>Medicine sourced</span><i /></div>
        <div><span>Sourced from</span><i /></div>
        <div className="wide"><span>Notes for the next pharmacist</span><i className="tall" /></div>
      </div>
      <p className="mk-panel-foot">Not a patient record. No patient details go in here.</p>
    </>
  );
}

function PanelBrief() {
  return (
    <>
      <span className="mk-soon">Coming soon</span>
      <div className="mk-email">
        <div className="mk-email-head">
          <div><span>From</span>Insova</div>
          <div><span>Subject</span>Your Insova morning: 3 of your products moved</div>
        </div>
        <div className="mk-email-body">
          <p>Good morning. Here's what changed on the HPRA register, starting with your list.</p>
          <b>On your list</b>
          <ul>
            <li>Amlodipine Teva 10 mg: return date pushed back, 13 Nov to 4 Dec</li>
            <li>Letrozole Teva 2.5 mg: left the register</li>
            <li>Calvepen 666 mg: newly short, manufacturing delay</li>
          </ul>
          <b>Across Ireland</b>
          <ul>
            <li>19 products appeared on the register</li>
            <li>8 left it</li>
            <li>9 had their expected return date changed</li>
          </ul>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------
   ARCHIVE GRID
   One square per morning collected. Says "none missed" only when the
   count of snapshots matches the number of days since collection began.
   ------------------------------------------------------------------ */
function DaysGrid({ archived, asOf }) {
  const [ref, seen] = useInView(0.3);
  const from = new Date(FIRST_ARCHIVED + 'T00:00:00');
  const to = new Date((asOf || FIRST_ARCHIVED) + 'T00:00:00');
  const calendar = Math.max(1, Math.round((to - from) / 86400000) + 1);
  const n = Math.max(1, archived || 1);
  const complete = n >= calendar;

  return (
    <div>
      <div ref={ref} className={'mk-days' + (seen ? ' on' : '')} aria-hidden="true">
        {Array.from({ length: n }).map((_, i) => (
          <i key={i} style={{ transitionDelay: `${i * 18}ms` }} />
        ))}
      </div>
      <p className="mk-days-cap">
        {complete
          ? `${n} mornings of the register, collected and kept.`
          : `${n} mornings of the register, collected and kept.`}
      </p>
    </div>
  );
}

/* ---------------------------- PROGRESS ---------------------------- */
const PROGRESS = [
  ['September 2026', 'Early access', 'First community pharmacists given access, with their feedback shaping what gets built next.'],
  ['August 2026', 'Daily collection', 'Started keeping a copy of the shortage register every morning, on 3 August.'],
  ['July 2026', 'Prototype reviewed', 'A working prototype of the pharmacist dashboard, reviewed with pharmacists.'],
  ['April to June 2026', 'Research and validation', 'We spoke with pharmacists and experts about how shortages are handled today, and confirmed the problem is daily, manual, and largely invisible until it arrives.'],
];

function Progress() {
  const [ref, seen] = useInView(0.2);
  return (
    <div ref={ref} className={'mk-tlwrap' + (seen ? ' on' : '')}>
      <span className="mk-tlfill" aria-hidden="true" />
      <ol className="mk-progress">
        {PROGRESS.map(([when, t, body]) => (
          <li key={when} className="mk-reveal">
            <span className="mk-when">{when}</span>
            <h3>{t}</h3>
            <p>{body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ================================================================== */

function Marketing({ onLogin }) {
  const stats = useLiveStats();

  // Fade sections up as they scroll into view.
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
  }, []);

  const feedRows = [...FEED, ...FEED];
  const tickRows = [...FEED, ...FEED];

  return (
    <div className="mk">
      {/* ---------------- nav ---------------- */}
      <nav className="mk-nav">
        <div className="mk-wrap mk-nav-in">
          <a href="#top" className="mk-logo" aria-label="Insova home">
            <img src={process.env.PUBLIC_URL + '/insova-logo.png'} alt="Insova" />
          </a>
          <div className="mk-nav-links">
            <a href="#demo">The application</a>
            <a href="#questions">What it does</a>
            <a href="#founding">Early access</a>
            <a href="#progress">Progress</a>
            <a href="#contact">Contact</a>
            <button type="button" className="mk-btn mk-btn-outline" onClick={onLogin}>
              Pharmacy sign in
            </button>
          </div>
        </div>
      </nav>

      {/* ---------------- hero ---------------- */}
      <header className="mk-hero" id="top">
        <div className="mk-wrap mk-hero-grid">
          <div>
            <span className="mk-pill"><span className="mk-pulse" />The HPRA shortage register, collected every morning</span>
            <ol className="mk-hero-q">
              <li>Is it short?</li>
              <li>Can I get it?</li>
              <li>What else can I give?</li>
            </ol>
            <p className="mk-hero-sub">
              The same questions come up at the counter every time a medicine is short. Insova
              answers them in one place, so community pharmacists spend less time chasing
              shortages and more time with patients.
            </p>
            <div className="mk-hero-cta">
              <a className="mk-btn mk-btn-solid" href="#founding">Become a founding pharmacy</a>
              <a className="mk-btn mk-btn-line" href="#demo">See the application</a>
            </div>
          </div>

          <div className="mk-stage" aria-hidden="true">
            <div className="mk-card mk-card-main">
              <div className="mk-c-head"><b>What changed</b><span>since Fri 18 Sep <em className="mk-ex">Example</em></span></div>
              <div className="mk-mini-cols">
                {[['a', 'Appeared', CHANGES.appeared], ['b', 'Left', CHANGES.left], ['c', 'Date moved', CHANGES.moved]].map(([k, name, c], ci) => (
                  <div key={k}>
                    <h6 className={k}>{name}</h6>
                    {c.rows.slice(0, 3).map(([p, d], ri) => (
                      <div className="mk-mini-row" key={p} style={{ animationDelay: `${0.9 + ci * 0.3 + ri * 0.1}s` }}>
                        {p}{d && <small>{d}</small>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="mk-card mk-card-feed">
              <div className="mk-c-head"><b>This morning</b><span><em className="mk-ex">Example</em></span></div>
              <div className="mk-feed">
                <div className="mk-feed-track">
                  {feedRows.map(([k, p, d], i) => (
                    <div className="mk-feed-item" key={i}>
                      <span className={'mk-dot ' + k} />
                      <span><b>{p}</b><br /><small>{d}</small></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mk-card mk-card-hist">
              <div className="mk-c-head"><b>Amlodipine Teva 10 mg</b><span>expected return</span></div>
              <div className="mk-hist-line">
                <span className="mk-hist-date">30 Oct</span><span className="mk-hist-arrow">{'\u2192'}</span>
                <span className="mk-hist-date">13 Nov</span><span className="mk-hist-arrow">{'\u2192'}</span>
                <span className="mk-hist-date now">4 Dec</span>
              </div>
              <p className="mk-hist-note">Pushed back twice in September. The register only shows the last date.</p>
            </div>
          </div>
        </div>
      </header>

      {/* ---------------- ticker ---------------- */}
      <div className="mk-ticker" aria-hidden="true">
        <div className="mk-ticker-track">
          {tickRows.map(([k, p], i) => (
            <span key={i}><i className={k}>{FEED_LABEL[k]}</i><b>{p}</b></span>
          ))}
        </div>
      </div>

      {/* ---------------- the application ---------------- */}
      <section className="mk-section" id="demo">
        <div className="mk-wrap">
          <div className="mk-reveal">
            <p className="mk-kicker">The application</p>
            <h2 className="mk-h2">What our application looks like.</h2>
            <p className="mk-lead">
              A pharmacist's view of Insova, shown with real entries from the HPRA register.
            </p>
          </div>

          <Demo />

          <div className="mk-platform mk-reveal">
            <div>
              <Icon name="browser" size={22} />
              <span>
                <b>Runs in the browser</b>
                Open it on the dispensary computer. Nothing to install, no IT project, no new hardware.
              </span>
            </div>
            <div>
              <Icon name="install" size={22} />
              <span>
                <b>Install it if you want it</b>
                Insova can be installed as a Windows app. Same tool, its own window, on the taskbar.
              </span>
            </div>
            <div>
              <Icon name="mail" size={22} />
              <span>
                <b>Arrives each morning </b>
                A short brief by email, so nothing depends on remembering to open it.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- what it does ---------------- */}
      <section className="mk-section mk-soft" id="questions">
        <div className="mk-wrap">
          <div className="mk-reveal">
            <p className="mk-kicker">What it does</p>
            <h2 className="mk-h2">What's working now, and what we're building.</h2>
            <p className="mk-lead">Some of this is in pharmacies today. Some of it is where we're heading. Each one is marked.</p>
          </div>

          <div className="mk-qs">
            <div className="mk-q mk-reveal">
              <div className="mk-qhead">
                <span className="mk-qicon"><Icon name="q1" size={20} /></span>
                <span className="mk-status now">Available now</span>
              </div>
              <h3>Is it short?</h3>
              <p>The HPRA shortage register, collected every morning and made easy to search.</p>
              <ul>
                <li>What appeared, left, or had its return date moved overnight</li>
                <li>Every change to a return date, and when it happened</li>
                <li>Search every authorised and withdrawn medicine in Ireland</li>
                <li>Star what you dispense, so it comes first if it goes short</li>
              </ul>
            </div>
            <div className="mk-q mk-reveal">
              <div className="mk-qhead">
                <span className="mk-qicon"><Icon name="q2" size={20} /></span>
                <span className="mk-status now">Available now</span>
              </div>
              <h3>What else can I give?</h3>
              <p>Alternatives taken only from the HPRA List of Interchangeable Medicines.</p>
              <ul>
                <li>The interchangeable group, cited by IC code</li>
                <li>Which products in it are short, and which aren't on the market</li>
                <li>Groups down to one or two products</li>
              </ul>
            </div>
            <div className="mk-q dev mk-reveal">
              <div className="mk-qhead">
                <span className="mk-qicon"><Icon name="q3" size={20} /></span>
                <span className="mk-status dev">In development</span>
              </div>
              <h3>Can I get it?</h3>
              <p>
                The register says a shortage has been notified. It doesn't say whether your
                wholesaler has stock today. That's the question we most want to answer, and it
                depends on working with wholesalers.
              </p>
            </div>
            <div className="mk-q dev mk-reveal">
              <div className="mk-qhead">
                <span className="mk-qicon"><Icon name="q4" size={20} /></span>
                <span className="mk-status dev">In development</span>
              </div>
              <h3>Will it go short?</h3>
              <p>
                Earlier warning, before a shortage reaches the counter. We're not there yet. It
                needs a long, unbroken record of how shortages behave, which is why we collect the
                register every single morning.
              </p>
            </div>
          </div>

          <p className="mk-principle mk-reveal">
            Insova is information only. It never substitutes, orders or dispenses, and it doesn't
            hold patient records. The pharmacist makes the decision.
          </p>
        </div>
      </section>

      {/* ---------------- the archive ---------------- */}
      <section className="mk-section">
        <div className="mk-wrap mk-idea">
          <div className="mk-reveal">
            <p className="mk-kicker">Why we keep every day</p>
            <h2 className="mk-h2">The register shows today. We keep the history.</h2>
            <p>
              The HPRA register gives each shortage one expected return date. If that date has
              already been pushed back twice, there's nothing on the register to say so.
            </p>
            <p>
              Insova is building a collection of the register. That's what lets it
              show how a return date has moved, and it's the foundation for earlier warning later
              on. A missed morning can't be recovered, so we don't miss any.
            </p>
          </div>
          <div className="mk-reveal">
            <DaysGrid archived={stats.days_archived} asOf={stats.as_of} />
          </div>
        </div>
      </section>

      {/* ---------------- this morning's figures ---------------- */}
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
            ({stats.ic_groups} groups), as collected on {stats.as_of_label}. The analysis is our own.
          </p>
        </div>
      </section>

      {/* ---------------- policy ---------------- */}
      <section className="mk-section" id="policy">
        <div className="mk-wrap">
          <div className="mk-reveal">
            <p className="mk-kicker">Policy</p>
            <h2 className="mk-h2">Built for where Ireland is going.</h2>
            <p className="mk-lead">Three developments in Irish health policy that shape what we're building.</p>
          </div>
          <div className="mk-policy">
            <div className="mk-pcard mk-reveal">
              <span className="mk-ptag">HSE AI for Care 2026–2030</span>
              <h3>A national plan for AI in health</h3>
              <p>
                Ireland's first national strategy for AI in health and social care sets out how AI
                will be used across the health service over five years. Earlier warning of
                shortages depends on a long daily record like the one Insova is keeping now.
              </p>
              <a href="https://about.hse.ie/publications/ai-for-care-2026-2030/" target="_blank" rel="noopener noreferrer">
                Read the AI for Care strategy {'\u2192'}
              </a>
            </div>
            <div className="mk-pcard mk-reveal">
              <span className="mk-ptag">Community Pharmacy Agreement 2025</span>
              <h3>Investment in community pharmacy</h3>
              <p>
                {'\u20ac'}75 million for community pharmacy, with digital systems and structured,
                shared information among its priorities.
              </p>
            </div>
            <div className="mk-pcard mk-reveal">
              <span className="mk-ptag">Health (Miscellaneous Provisions) Act 2024</span>
              <h3>Serious shortage protocols</h3>
              <p>
                The Act makes way for serious shortage protocols, which would let pharmacists
                substitute during a serious shortage without going back to the prescriber. When
                they're introduced, pharmacists will need to see which shortages have one. We want
                Insova to show that.
              </p>
              <a href="https://www.oireachtas.ie/en/bills/bill/2024/5/" target="_blank" rel="noopener noreferrer">
                View the Act {'\u2192'}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- founding ---------------- */}
      <section className="mk-section mk-soft" id="founding">
        <div className="mk-wrap mk-founding">
          <div className="mk-reveal">
            <p className="mk-kicker">Early access</p>
            <h2 className="mk-h2">We're looking for founding pharmacies.</h2>
            <p className="mk-lead" style={{ marginBottom: 26 }}>
              Insova is being built with the pharmacists who use it. Founding pharmacies get it
              first and decide what we build next, including things we haven't thought of yet.
            </p>
            <ul className="mk-perks">
              <li><b>Shape what gets built</b><span>A short call each month. What would save you time goes on the list.</span></li>
              <li><b>A direct line to us</b><span>If something's wrong or missing, you talk to the people building it.</span></li>
              <li><b>Nothing to set up</b><span>Runs on the dispensary computer, in the browser or as a Windows app.</span></li>
            </ul>
          </div>
          <div className="mk-ask mk-reveal">
            <h3>Interested?</h3>
            <p>Tell us which pharmacy you're in and we'll get you set up. It takes a few minutes.</p>
            <a className="mk-btn mk-btn-solid" href="mailto:contact@insova.ie?subject=Founding%20pharmacy">
              Email contact@insova.ie
            </a>
          </div>
        </div>
      </section>

      {/* ---------------- progress ---------------- */}
      <section className="mk-section" id="progress">
        <div className="mk-wrap">
          <div className="mk-reveal">
            <p className="mk-kicker">Progress</p>
            <h2 className="mk-h2">Where we are.</h2>
            <p className="mk-lead">We're early. This is what's been done so far, most recent first.</p>
          </div>
          <Progress />
        </div>
      </section>

      <div className="mk-ucc"><p>Founded at University College Cork</p></div>

      {/* ---------------- team ---------------- */}
      <section className="mk-section mk-soft" id="team">
        <div className="mk-wrap">
          <div className="mk-reveal">
            <p className="mk-kicker">Who we are</p>
            <h2 className="mk-h2">Pharmacy meets technology.</h2>
            <p className="mk-lead">Two co-founders from University College Cork.</p>
          </div>
          <div className="mk-team">
            <div className="mk-person mk-reveal">
              <img className="mk-face" src={process.env.PUBLIC_URL + '/isobel.jpeg'} alt="Isobel Hynes" />
              <h3>Isobel Hynes</h3>
              <p className="mk-role">Co-founder, pharmacy</p>
              <p>Pharmacy student at University College Cork.</p>
            </div>
            <div className="mk-person mk-reveal">
              <img className="mk-face" src={process.env.PUBLIC_URL + '/jack.png'} alt="Jack Kennedy" />
              <h3>Jack Kennedy</h3>
              <p className="mk-role">Co-founder, technology</p>
              <p>Business Information Systems graduate of University College Cork.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- contact ---------------- */}
      <section className="mk-section" id="contact">
        <div className="mk-wrap">
          <div className="mk-reveal">
            <p className="mk-kicker">Contact</p>
            <h2 className="mk-h2">Get in touch.</h2>
            <p className="mk-lead">
              Pharmacists, wholesalers, researchers, or anyone working on medicine shortages in
              Ireland, we'd like to hear from you.
            </p>
          </div>
          <div className="mk-contact mk-reveal">
            <a href="mailto:contact@insova.ie">
              <Icon name="mail" size={26} />
              <span><b>Email</b><span>contact@insova.ie</span></span>
            </a>
            <a href="https://www.linkedin.com/company/insovaie/" target="_blank" rel="noopener noreferrer">
              <LinkedInIcon />
              <span><b>LinkedIn</b><span>Connect with us</span></span>
            </a>
          </div>
        </div>
      </section>

      {/* ---------------- footer ---------------- */}
      <footer className="mk-footer">
        <div className="mk-wrap">
          <div className="mk-foot-top">
            <img className="mk-foot-logo" src={process.env.PUBLIC_URL + '/insova-logo.png'} alt="Insova" />
            <div className="mk-foot-links">
              <a href="/privacy.html">Privacy</a>
              <a href="mailto:contact@insova.ie">contact@insova.ie</a>
            </div>
          </div>
          {/* Required by the CC BY 4.0 licence granted by the HPRA on
              9 September 2026. Their wording, verbatim. The last line is
              the licence's No Endorsement condition. */}
          <div className="mk-legal">
            <p className="mk-company">
              {COMPANY.name}, {COMPANY.form}. Registered in Ireland, company number {COMPANY.number}.
              {COMPANY.office && ` Registered office: ${COMPANY.office}.`}
            </p>
            <p>Information only. Insova never substitutes, orders or dispenses, and is not a patient record system.</p>
            <p>
              Information provided courtesy of the Health Products Regulatory Authority (HPRA)
              under a Creative Commons Attribution 4.0 International{' '}
              <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="license noopener noreferrer">CC BY 4.0</a> licence.
            </p>
            <p>Insova is not connected with, sponsored by, or endorsed by the HPRA.</p>
          </div>
          <div className="mk-foot-bottom">
            <span>{'\u00a9'} 2026 {COMPANY.name}. All rights reserved.</span>
            <span>Cork, Ireland</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Marketing;