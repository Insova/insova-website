import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './App.css';

/* ------------------------------------------------------------------
   LIVE DATA
   Reads /insova-stats.json from public/ so figures can be refreshed
   without a rebuild. Values below are the fallback.
   ------------------------------------------------------------------ */
const FALLBACK_STATS = {
  as_of_label: '9 August 2026',
  notified: 371,
  current: 371,
  groups_last_product: 18,
  no_interchangeable_pct: 55,
  over_one_year: 91,
  past_return_date: 38,
  ic_groups: 507,
  days_archived: 1,
};

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

/* ------------------------------------------------------------------
   SOURCE BUTTON
   Every figure on the page can show where it came from.
   ------------------------------------------------------------------ */
function Info({ label, children, dark = false }) {
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
    if (!open) return;
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
      className="info-pop"
      role="tooltip"
      style={{
        left: pos.left + 'px',
        width: pos.width + 'px',
        top: pos.top !== null ? pos.top + 'px' : 'auto',
        bottom: pos.bottom !== null ? pos.bottom + 'px' : 'auto',
      }}
    >
      <span className="info-pop-label">Source</span>
      {children}
    </div>,
    document.body
  ) : null;

  return (
    <span className={'info' + (dark ? ' info-dark' : '')}>
      <button
        ref={btnRef}
        type="button"
        className="info-btn"
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

function CountUp({ target, suffix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCount(target);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1800;
          const startTime = performance.now();
          const step = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

/* ---------------------------- PROGRESS ---------------------------- */
const PROGRESS = [
  {
    date: 'August 2026',
    title: 'National analysis',
    body: 'First analysis of shortage patterns across the whole register, produced from data we collect ourselves.',
  },
  {
    date: 'August 2026',
    title: 'Daily data collection',
    body: 'Insova began collecting the national medicine shortage register every morning, building a continuous record of how shortages develop over time.',
  },
  {
    date: 'July 2026',
    title: 'Prototype reviewed',
    body: 'A working prototype of the pharmacist dashboard was built.',
  },
  {
    date: 'June 2026',
    title: 'Research and validation',
    body: 'We spoke with pharmacists and experts about how shortages are handled today, and confirmed the problem is daily, manual, and largely invisible until it arrives.',
  },
];

function App() {
  const stats = useLiveStats();

  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onScroll = () => {
      const y = window.scrollY;
      const g1 = document.querySelector('.hero-glow-1');
      const g2 = document.querySelector('.hero-glow-2');
      const g3 = document.querySelector('.hero-glow-3');
      if (g1) g1.style.transform = `translateY(${y * 0.15}px)`;
      if (g2) g2.style.transform = `translateY(${y * -0.1}px)`;
      if (g3) g3.style.transform = `translate(-50%, calc(-50% + ${y * 0.08}px))`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="app">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <div className="logo">
            <img src={process.env.PUBLIC_URL + '/insova-logo.png'} alt="Insova" className="logo-icon" width="100" height="100" />
          </div>
          <div className="nav-links">
            <a href="#product" className="nav-link">Our product</a>
            <a href="#live" className="nav-link">The data</a>
            <a href="#progress" className="nav-link">Progress</a>
            <a href="#contact" className="nav-cta">Get in Touch</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="hero">
        <div className="hero-glow hero-glow-1"></div>
        <div className="hero-glow hero-glow-2"></div>
        <div className="hero-glow hero-glow-3"></div>
        <div className="hero-grid-bg"></div>
        <div className="hero-container">
          <h1 className="hero-title">
            {['Predicting', 'medication', 'shortages'].map((word, i) => (
              <React.Fragment key={i}>
                <span className="hero-word" style={{ animationDelay: `${0.2 + i * 0.13}s` }}>{word}</span>{' '}
              </React.Fragment>
            ))}
            <span className="hero-title-accent hero-word" style={{ animationDelay: `${0.59 + 3 * 0.13}s` }}>
              before they happen.
            </span>
          </h1>
          <p className="hero-subtitle">
            We are building shortage prediction intelligence for Irish community pharmacies.
            Insova pairs AI-driven insight with pharmacist expertise to make managing
            medication shortages smarter and more efficient.
          </p>
          <div className="hero-actions">
            <a href="#product" className="btn btn-primary">Our product</a>
            <a href="#contact" className="btn btn-secondary">Partner With Us</a>
          </div>
        </div>
      </header>

      {/* Problem */}
      <section className="section section-problem" id="problem">
        <div className="container">
          <h2 className="section-title">Ireland's pharmacies have a problem.</h2>
          <p className="section-intro">
            Every pharmacy in Ireland is affected by medication shortages, and the only system
            in place is reactive. Pharmacists discover shortages when it is already too late.
          </p>
          <div className="stats-grid">
            <div className="stat-card reveal" style={{ '--reveal-delay': '0s' }}>
              <div className="stat-number">
                <CountUp target={42} suffix="%" />
                <Info label="pharmacists encountering over 61 shortages">
                  Irish Pharmacy Union Medicine Shortages Survey, 2025.
                </Info>
              </div>
              <div className="stat-desc">of pharmacists encountered over 61 shortages in the previous 4 months</div>
            </div>
            <div className="stat-card reveal" style={{ '--reveal-delay': '0.08s' }}>
              <div className="stat-number">
                <CountUp target={6} suffix="+ hrs" />
                <Info label="hours per week managing shortages">
                  Irish Pharmacy Union Medicine Shortages Survey, 2025.
                </Info>
              </div>
              <div className="stat-desc">per week spent by pharmacists manually managing shortages</div>
            </div>
            <div className="stat-card reveal" style={{ '--reveal-delay': '0.16s' }}>
              <div className="stat-number">
                <CountUp target={71} suffix="%" />
                <Info label="pharmacists reporting negative patient outcomes">
                  Irish Pharmacy Union Medicine Shortages Survey, 2025.
                </Info>
              </div>
              <div className="stat-desc">report negative patient outcomes directly from shortages</div>
            </div>
            <div className="stat-card reveal" style={{ '--reveal-delay': '0.24s' }}>
              <div className="stat-number">
                <CountUp target={73} suffix="%" />
                <Info label="pharmacists reporting burnout">
                  Irish Pharmacy Union Medicine Shortages Survey, 2025.
                </Info>
              </div>
              <div className="stat-desc">of community pharmacists indicated they experienced burnout in their role</div>
            </div>
            <div className="stat-card reveal" style={{ '--reveal-delay': '0.32s' }}>
              <div className="stat-number">
                <CountUp target={78} suffix="%" />
                <Info label="pharmacists expecting shortages to worsen">
                  Irish Pharmacy Union Medicine Shortages Survey, 2025.
                </Info>
              </div>
              <div className="stat-desc">expect the medicine shortage crisis to worsen over the coming year</div>
            </div>
            <div className="stat-card reveal" style={{ '--reveal-delay': '0.40s' }}>
              <div className="stat-number">
                <CountUp target={stats.past_return_date} />
                <Info label="shortages past their expected return date">
                  Insova analysis of the HPRA register, {stats.as_of_label}.
                </Info>
              </div>
              <div className="stat-desc">shortages today are already past the return date the register gives them</div>
            </div>
          </div>
          <div className="problem-quote reveal">
            <p>
              "Whilst medicine shortages may be a feature of modern health systems, we need to
              ensure that the impact of such shortages is minimised to the greatest extent possible."
            </p>
            <cite>Clare Fitzell, Secretary General, Irish Pharmacy Union, 2025</cite>
          </div>
        </div>
      </section>

      {/* OUR PRODUCT */}
      <section className="section section-product" id="product">
        <div className="container">
          <div className="section-label">Our Product</div>
          <h2 className="section-title">What we are building.</h2>
          <p className="section-intro">
            A web application for the dispensary. It runs in the browser with nothing to set up,
            and offers to install itself as an app whenever you want it standalone.
          </p>

          {/* Platform strip */}
          <div className="platform-strip reveal">
            <div className="platform-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
              <div>
                <h4>Runs in the browser</h4>
                <p>Open it on the dispensary computer. Nothing to install, no IT project, no new hardware.</p>
              </div>
            </div>
            <div className="platform-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12"/><polyline points="8 11 12 15 16 11"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
              </svg>
              <div>
                <h4>Install it if you want it</h4>
                <p>Insova offers to install itself as an app. Same tool, its own window.</p>
              </div>
            </div>
            <div className="platform-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              <div>
                <h4>Arrives each morning</h4>
                <p>A short brief by email, so nothing depends on remembering to open it.</p>
              </div>
            </div>
          </div>

          {/* What it does */}
          <div className="section-label">What it does</div>
          <div className="features-grid features-tight">
            <div className="feature-card reveal" style={{ '--reveal-delay': '0s' }}>
              <div className="feature-icon-wrap">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <h3>Early warning</h3>
              <p>
                We believe our model could be capable of predicitons one
                month before the actual shortage hits 
              </p>
            </div>
            <div className="feature-card reveal" style={{ '--reveal-delay': '0.06s' }}>
              <div className="feature-icon-wrap">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              </div>
              <h3>Cascade detection</h3>
              <p>
                When one medicine goes short, demand moves to its alternatives. Insova tracks
                whole interchangeable groups, so the second wave is visible early.
              </p>
            </div>
            <div className="feature-card reveal" style={{ '--reveal-delay': '0.12s' }}>
              <div className="feature-icon-wrap">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3>Alternatives from the regulator</h3>
              <p>
                Substitutes come only from the HPRA List of Interchangeable Medicines, cited by
                IC code, with how many products are left in the group.
              </p>
            </div>
            <div className="feature-card reveal" style={{ '--reveal-delay': '0.18s' }}>
              <div className="feature-icon-wrap">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h3>Pharmacy network</h3>
              <p>
                See which nearby pharmacies are holding what, instead of ringing around one by one.
              </p>
            </div>
            <div className="feature-card reveal" style={{ '--reveal-delay': '0.24s' }}>
              <div className="feature-icon-wrap">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>
                </svg>
              </div>
              <h3>Straight to the source</h3>
              <p>
                Where a manufacturer has issued a supply notice about a shortage, we link you
                to the document itself rather than summarising it.
              </p>
            </div>
            <div className="feature-card reveal" style={{ '--reveal-delay': '0.30s' }}>
              <div className="feature-icon-wrap">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <h3>Human in the loop</h3>
              <p>
                Insova never substitutes, orders or dispenses. It informs; the pharmacist decides.
              </p>
            </div>
          </div>

          <p className="live-note" style={{ marginTop: '36px', color: 'var(--slate-light)' }}>
            Insova is in development and is not yet available. Nothing here is clinical guidance.
          </p>
        </div>
      </section>

      {/* LIVE REGISTER */}
      <section className="section section-live" id="live">
        <div className="container">
          <div className="live-head">
            <div className="live-status">
              <span className="live-pulse" aria-hidden="true"></span>
              <span className="live-status-text">Live from the HPRA national register</span>
            </div>
            <div className="live-timestamp">Collected {stats.as_of_label}</div>
          </div>

          <p className="live-lead reveal">
            None of that works without history. Ireland's shortage register is overwritten every
            morning and nobody keeps/publishes yesterday's copy, so there is no record of how a shortage
            built before it arrived. A model cannot learn from something it never saw forming.
            So every morning we take a dated copy and keep it. This is today's.
          </p>

          <div className="live-readout">
            <div className="live-cell reveal" style={{ '--reveal-delay': '0s' }}>
              <div className="live-figure">
                {stats.current}
                <Info dark label="medicines notified as in shortage">
                  HPRA national medicine shortage register, collected {stats.as_of_label}.
                  This is the count of medicines currently listed as in shortage, and should
                  match the total shown on the HPRA website.
                </Info>
              </div>
              <div className="live-label">medicines notified as in shortage</div>
            </div>
            <div className="live-cell reveal" style={{ '--reveal-delay': '0.06s' }}>
              <div className="live-figure">
                {stats.no_interchangeable_pct}%
                <Info dark label="share with no substitutable alternative listed">
                  Insova analysis. The share of shortages with no matching group on the HPRA
                  List of Interchangeable Medicines, meaning no statutory route to substitute
                  without contacting the prescriber.
                </Info>
              </div>
              <div className="live-label">have no substitutable alternative listed</div>
            </div>
            <div className="live-cell reveal" style={{ '--reveal-delay': '0.12s' }}>
              <div className="live-figure">
                {stats.groups_last_product}
                <Info dark label="interchangeable groups down to one product">
                  Insova analysis. Groups on the HPRA List of Interchangeable Medicines where
                  every product except one is currently in shortage.
                </Info>
              </div>
              <div className="live-label">interchangeable groups are down to one product</div>
            </div>
            <div className="live-cell reveal" style={{ '--reveal-delay': '0.18s' }}>
              <div className="live-figure">
                {stats.past_return_date}
                <Info dark label="shortages past their expected return date">
                  Insova analysis. Register entries whose HPRA expected return date has already
                  passed while the shortage remains listed.
                </Info>
              </div>
              <div className="live-label">are past their expected return date</div>
            </div>
          </div>

          <p className="live-note">
            Figures are drawn from the HPRA medicine shortage register and the HPRA List of
            Interchangeable Medicines ({stats.ic_groups} groups), both published by the Health
            Products Regulatory Authority. The analysis is our own.
          </p>
          <a href="/data.html" className="btn btn-primary" style={{ marginTop: '22px', display: 'inline-block' }}>
            See today's reading in full
          </a>
        </div>
      </section>

      {/* PROGRESS */}
      <section className="section section-progress" id="progress">
        <div className="container">
          <div className="section-label">Progress</div>
          <h2 className="section-title">Where we are.</h2>
          <p className="section-intro">
            We are in the early stages of development. This is what has been built so far, in the
            order it happened.
          </p>
          <ol className="log-list">
            {PROGRESS.map((entry, i) => (
              <li className="log-item reveal" key={i} style={{ '--reveal-delay': `${i * 0.07}s` }}>
                <div className="log-rail" aria-hidden="true"><span className="log-dot"></span></div>
                <div className="log-body">
                  <div className="log-date">{entry.date}</div>
                  <h3 className="log-title">{entry.title}</h3>
                  <p className="log-text">{entry.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Policy Alignment */}
      <section className="section section-policy" id="policy">
        <div className="container">
          <div className="section-label">Policy Alignment</div>
          <h2 className="section-title">Built for where Ireland is going.</h2>
          <p className="section-intro">
            Insova is aligned with Ireland's national healthcare AI strategy and the legislative
            changes transforming how pharmacies manage medication supply.
          </p>
          <div className="policy-grid">
            <div className="policy-card reveal" style={{ '--reveal-delay': '0s' }}>
              <div className="policy-tag">HSE AI for Care 2026-2030</div>
              <h3>Supply Chain AI Optimisation</h3>
              <p>
                The HSE's AI Strategic Roadmap (ID 2.6) targets AI-powered supply chain and
                logistic optimisation for Horizon 2 (2028). Insova is building it now, so it is
                proven and ready when the HSE is.
              </p>
              <a href="https://about.hse.ie/publications/ai-for-care-2026-2030/" target="_blank" rel="noopener noreferrer" className="policy-link">
                Read the AI for Care Strategy &rarr;
              </a>
            </div>
            <div className="policy-card reveal" style={{ '--reveal-delay': '0.12s' }}>
              <div className="policy-tag">Community Pharmacy Agreement 2025</div>
              <h3>Digital Health Priority</h3>
              <p>
                &euro;75 million invested in community pharmacy, explicitly naming it a critical
                enabler for Ireland's digital health priorities, with AI highlighted for
                predictive analytics.
              </p>
            </div>
            <div className="policy-card reveal" style={{ '--reveal-delay': '0.24s' }}>
              <div className="policy-tag">Health (Miscellaneous Provisions) Act 2024</div>
              <h3>Serious Shortage Protocol</h3>
              <p>
                New legislation enabling pharmacists to substitute without reverting to the
                prescriber, creating a direct use case for Insova's alternatives engine.
              </p>
              <a href="https://www.oireachtas.ie/en/bills/bill/2024/5/" target="_blank" rel="noopener noreferrer" className="policy-link">
                View the Health Act &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* UCC Banner */}
      <div className="ucc-banner">
        <div className="ucc-banner-overlay"></div>
        <div className="ucc-banner-content">
          <p className="ucc-banner-text">Founded at University College Cork</p>
        </div>
      </div>

      {/* Team */}
      <section className="section section-team" id="team">
        <div className="container">
          <div className="section-label">Our Team</div>
          <h2 className="section-title">Pharmacy meets technology.</h2>
          <p className="section-intro">Insova is founded at University College Cork.</p>
          <div className="team-grid-two">
            <div className="team-card reveal" style={{ '--reveal-delay': '0s' }}>
              <div className="team-photo">
                <img src={process.env.PUBLIC_URL + '/isobel.jpeg'} alt="Isobel Hynes" />
              </div>
              <h3>Isobel Hynes</h3>
              <div className="team-role">Co-Founder &middot; Pharmacy</div>
              <p>Pharmacy student at University College Cork. Leads the clinical side of Insova.</p>
            </div>
            <div className="team-card reveal" style={{ '--reveal-delay': '0.12s' }}>
              <div className="team-photo">
                <img src={process.env.PUBLIC_URL + '/jack.png'} alt="Jack Kennedy" />
              </div>
              <h3>Jack Kennedy</h3>
              <div className="team-role">Co-Founder &middot; Technology</div>
              <p>Business Information Systems graduate of University College Cork. Leads the technical side of Insova.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="section section-contact" id="contact">
        <div className="container">
          <div className="section-label">Get in Touch</div>
          <h2 className="section-title">Interested in Insova?</h2>
          <p className="section-intro">
            Whether you are a pharmacist interested in early access, a potential partner, or a
            researcher working on medication shortages, we would like to hear from you.
          </p>
          <div className="contact-cards">
            <a href="mailto:contact@insova.ie" className="contact-card reveal" style={{ '--reveal-delay': '0s' }}>
              <svg className="contact-svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <div className="contact-type">Email Us</div>
              <div className="contact-value">contact@insova.ie</div>
            </a>
            <a href="https://www.linkedin.com/company/insovaie/" target="_blank" rel="noopener noreferrer" className="contact-card reveal" style={{ '--reveal-delay': '0.12s' }}>
              <svg className="contact-svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <div className="contact-type">LinkedIn</div>
              <div className="contact-value">Connect with us</div>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-brand">
            <img src={process.env.PUBLIC_URL + '/insova-logo.png'} alt="Insova" className="logo-icon" width="80" height="80" />
          </div>
          <div className="footer-text">
            Medication shortage intelligence for Irish pharmacies.
          </div>
          <div className="footer-bottom">
            <span>&copy; 2026 Insova. All rights reserved.</span>
            <span>Cork, Ireland</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;