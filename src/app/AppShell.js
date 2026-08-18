import React, { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useAppData, daysSince } from './useAppData';
import Dashboard from './Dashboard';
import Shortages from './Shortages';
import Groups from './Groups';
import Notices from './Notices';
import ULM from './ULM';
import Digest from './Digest';
import Admin from './Admin';
import './app.css';

const NAV = [
  { id: 'dashboard', label: 'Today',        icon: '▦' },
  { id: 'shortages', label: 'Shortages',    icon: '☰' },
  { id: 'groups',    label: 'Running low',  icon: '◨' },
  { id: 'notices',   label: 'Notices',      icon: '✉' },
  { id: 'ulm',       label: 'Unlicensed',   icon: '⊕' },
  { id: 'digest',    label: 'Daily brief',  icon: '⏱' },
];

export default function AppShell({ onHome }) {
  const { profile, pharmacy, isAdmin, hasPharmacy, signOut } = useAuth();
  const app = useAppData();
  const [view, setView] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusId, setFocusId] = useState(null);

  const nav = isAdmin
    ? [...NAV, { id: 'admin', label: 'Admin', icon: '⚙' }]
    : NAV;

  const go = (id, id2) => {
    setView(id);
    setFocusId(id2 || null);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  };

  if (!hasPharmacy && !isAdmin) {
    return (
      <div className="ia-noaccess">
        <div className="ia-noaccess-card">
          <img src={process.env.PUBLIC_URL + '/insova-logo.png'} alt="Insova" />
          <h1>Your account is not linked to a pharmacy yet</h1>
          <p>
            You are signed in as {profile?.email}, but no pharmacy has been assigned to this
            account, so there is nothing to show you. If you were expecting access, let us
            know and we will sort it.
          </p>
          <a className="ia-btn" href="mailto:contact@insova.ie">Email contact@insova.ie</a>
          <button className="ia-linkbtn" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  const stale = app.data ? daysSince(app.data.meta.as_of) : null;

  return (
    <div className={'ia' + (menuOpen ? ' ia-menu-open' : '')}>
      <aside className="ia-side">
        <div className="ia-side-top">
          <img
            className="ia-side-logo"
            src={process.env.PUBLIC_URL + '/insova-logo.png'}
            alt="Insova"
          />
          <div className="ia-side-org">
            <strong>{pharmacy?.name || 'Insova'}</strong>
            <span>{[pharmacy?.town, pharmacy?.county].filter(Boolean).join(', ')}</span>
          </div>
        </div>

        <nav className="ia-nav">
          {nav.map((n) => (
            <button
              key={n.id}
              className={'ia-nav-item' + (view === n.id ? ' on' : '')}
              onClick={() => go(n.id)}
            >
              <span className="ia-nav-icon" aria-hidden="true">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="ia-side-foot">
          <button className="ia-linkbtn" onClick={onHome}>insova.ie</button>
          <button className="ia-linkbtn" onClick={signOut}>Sign out</button>
          <p className="ia-side-fine">
            Information only. Insova never substitutes, orders or dispenses.
          </p>
        </div>
      </aside>

      <div className="ia-main">
        <header className="ia-top">
          <button
            className="ia-burger"
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            ☰
          </button>
          <div className="ia-top-title">
            {nav.find((n) => n.id === view)?.label}
          </div>
          <div className="ia-top-right">
            {app.data && (
              <span className={'ia-freshness' + (stale > 1 ? ' warn' : '')}>
                <span className="ia-dot" />
                Register collected {app.data.meta.as_of_label}
              </span>
            )}
            <span className="ia-who">{profile?.full_name || profile?.email}</span>
          </div>
        </header>

        <main className="ia-body">
          {app.error && (
            <div className="ia-alert error">
              <strong>Today's register could not be loaded.</strong>
              <span>
                {app.error}. Nothing below is current. This is a fault at our end, not an
                indication that nothing is short.
              </span>
            </div>
          )}

          {app.ready && stale > 1 && (
            <div className="ia-alert warn">
              <strong>This data is {stale} days old.</strong>
              <span>
                The last successful collection was {app.data.meta.as_of_label}. The register
                may have moved since. Check the HPRA directly for anything urgent.
              </span>
            </div>
          )}

          {app.loading && <div className="ia-loading">Loading the register…</div>}

          {app.ready && view === 'dashboard' && <Dashboard app={app} go={go} />}
          {app.ready && view === 'shortages' && <Shortages app={app} focusId={focusId} />}
          {app.ready && view === 'groups' && <Groups app={app} go={go} />}
          {app.ready && view === 'notices' && <Notices app={app} />}
          {view === 'ulm' && <ULM app={app} />}
          {app.ready && view === 'digest' && <Digest app={app} />}
          {view === 'admin' && isAdmin && <Admin app={app} />}
        </main>
      </div>

      {menuOpen && <div className="ia-scrim" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}