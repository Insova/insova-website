import React, { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useAppData, daysSince } from './useAppData';
import { useWatchlist } from './useWatchlist';
import Dashboard from './Dashboard';
import Watchlist from './Watchlist';
import Shortages from './Shortages';
import Groups from './Groups';
import Notices from './Notices';
import ULM from './ULM';
import Medicines from './Medicines';
import Digest from './Digest';
import Roadmap from './Roadmap';
import Feedback from './Feedback';
import Admin from './Admin';
import Tour from './Tour';
import './app.css';

/*
  Navigation is split into two groups.

  Ten items in one undivided column read as a long list you have to scan.
  Six of them are the register: what is short, what changed, what is
  left. The other three are about Insova itself rather than about
  medicines, and a pharmacist reaches for them far less often. Grouping
  them says which is which without hiding anything.

  The legal text used to live in the sidebar footer. Between the
  information-only line and the CC BY attribution it ran to about two
  paragraphs, which pushed the nav into its own small scrolling window
  and produced a stubby scrollbar on any normal laptop. It now sits
  under the main content, where it is still on every screen and still
  satisfies the licence, but is not competing with navigation for
  vertical space.

  ALL MEDICINES sits last in the first group, beside Unlicensed
  medicines. Both are reference lookups about a named product rather
  than views of what is currently short, so they belong together and
  below the register screens someone opens every morning.

  THE TOUR. Feedback was that the app is confusing. The Tour button in
  the top bar walks through every screen (see Tour.js). First-time users
  are offered it once. The elements it points at carry data-tour
  attributes: the menu items, the freshness label and the main area. If
  you rename or move one of those, keep its data-tour attribute.

  ASK AI IS WITHDRAWN, NOT DELETED.
  src/app/AskAI.js and the nl-search Edge Function are both still in
  place and still deployed. What was removed is the nav entry, the
  import and the render line, so there is no route to the screen and no
  way for anyone to reach it.

  To put it back: re-add the import, the { id: 'askai', label: 'Ask AI',
  icon: '✧' } entry to NAV_MAIN after 'shortages', and the render line
  in the main block. Nothing else changed.

  Note the function is still live and still billable, so if it is going
  to be off for a while, either revoke the Anthropic key or set the
  workspace spend cap to zero. Nothing in the app calls it now, but
  the endpoint is public and takes a signed-in JWT.
*/
const NAV_MAIN = [
  { id: 'dashboard', label: 'Today',                icon: '▦' },
  { id: 'watchlist', label: 'Your list',            icon: '★' },
  { id: 'shortages', label: 'Shortages',            icon: '☰' },
  { id: 'medicines', label: 'All medicines',        icon: '◎' },
  { id: 'groups',    label: 'Running low',          icon: '◧' },
  { id: 'notices',   label: 'Notices',              icon: '✉' },
  
];

const NAV_MORE = [
  { id: 'digest',   label: 'Daily brief',   icon: '◷' },
  { id: 'roadmap',  label: "What's next",   icon: '◇' },
  { id: 'feedback', label: 'Give feedback', icon: '✎' },
];

// Remembers, in this browser only, that the tour has been offered, so
// the prompt appears once and not every visit. Wrapped in try/catch
// because storage can be blocked, in which case the prompt just shows.
const TOUR_KEY = 'insova.tour.seen';
function tourSeen() {
  try { return window.localStorage.getItem(TOUR_KEY) === '1'; } catch (e) { return false; }
}
function markTourSeen() {
  try { window.localStorage.setItem(TOUR_KEY, '1'); } catch (e) { /* nothing to do */ }
}

export default function AppShell({ onHome }) {
  const {
    profile, pharmacy, isAdmin, hasPharmacy, signOut,
    profileStatus, refreshProfile, authError,
  } = useAuth();
  const app = useAppData();
  const watch = useWatchlist();
  const [view, setView] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusId, setFocusId] = useState(null);
  const [preset, setPreset] = useState(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourPrompt, setTourPrompt] = useState(() => !tourSeen());

  const navMore = isAdmin
    ? [...NAV_MORE, { id: 'admin', label: 'Admin', icon: '⚙' }]
    : NAV_MORE;
  const allNav = [...NAV_MAIN, ...navMore];

  // go('shortages', someId) opens that product.
  // go('shortages', null, 'not_started') opens the list already filtered,
  // so a "see all 20" link lands on the 20 rather than on everything.
  const go = (id, id2, filterPreset) => {
    setView(id);
    setFocusId(id2 || null);
    setPreset(filterPreset || null);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  };

  const startTour = () => {
    setTourPrompt(false);
    markTourSeen();
    setTourOpen(true);
  };

  const endTour = () => {
    setTourOpen(false);
    markTourSeen();
    go('dashboard');
  };

  /*
    Nothing below decides "no pharmacy" until the profile has actually
    loaded. Signing in used to show the not-linked screen in the moment
    between the session arriving and the profile arriving; a refresh
    cleared it, and the installed app has no refresh.

      idle / loading  still fetching: say so, and wait
      error           could not load: offer to try again
      ready           now, and only now, is "no pharmacy" true
  */
  if (profileStatus === 'idle' || profileStatus === 'loading') {
    return (
      <div className="ia-boot">
        <div className="ia-boot-inner">
          <img className="ia-boot-logo" src={process.env.PUBLIC_URL + '/insova-logo.png'} alt="Insova" />
          <div className="ia-boot-bar" role="progressbar" aria-label="Loading your account"><span /></div>
          <p className="ia-boot-text">Loading your account</p>
        </div>
      </div>
    );
  }

  if (profileStatus === 'error') {
    return (
      <div className="ia-noaccess">
        <div className="ia-noaccess-card">
          <img src={process.env.PUBLIC_URL + '/insova-logo.png'} alt="Insova" />
          <h1>We couldn't load your account</h1>
          <p>
            You are signed in, but your account details didn't load. This is usually a brief
            connection problem rather than anything wrong with your account.
          </p>
          {authError && <p className="ia-noaccess-detail">{authError}</p>}
          <div className="ia-noaccess-actions">
            <button type="button" className="ia-btn" onClick={refreshProfile}>Try again</button>
            <button type="button" className="ia-linkbtn" onClick={() => window.location.reload()}>
              Reload Insova
            </button>
            <button type="button" className="ia-linkbtn" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }

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
          {/* The installed app has no refresh, so offer one here. If the
              account has just been linked, this picks it up. */}
          <div className="ia-noaccess-actions">
            <button type="button" className="ia-btn" onClick={refreshProfile}>Check again</button>
            <a className="ia-linkbtn" href="mailto:contact@insova.ie">Email contact@insova.ie</a>
            <button type="button" className="ia-linkbtn" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  const stale = app.data ? daysSince(app.data.meta.as_of) : null;

  // how many watched products have something new on them today
  const watchAlerts = app.ready
    ? (app.data.changes || []).filter((c) => watch.ids.has(c.id)).length
      + (app.data.recently_left || []).filter((r) => watch.ids.has(r.id)).length
    : 0;

  const NavItem = (n) => (
    <button
      key={n.id}
      data-tour={'nav-' + n.id}
      className={'ia-nav-item' + (view === n.id ? ' on' : '')}
      onClick={() => go(n.id)}
    >
      <span className="ia-nav-icon" aria-hidden="true">{n.icon}</span>
      <span className="ia-nav-label">{n.label}</span>
      {n.id === 'watchlist' && watch.rows.length > 0 && (
        <span className={'ia-nav-badge' + (watchAlerts ? ' alert' : '')}>
          {watchAlerts || watch.rows.length}
        </span>
      )}
    </button>
  );

  return (
    <div className={'ia' + (menuOpen ? ' ia-menu-open' : '')}>
      <aside className="ia-side">
        <div className="ia-side-top">
          <div className="ia-side-brand">
            <img
              className="ia-side-logo"
              src={process.env.PUBLIC_URL + '/insova-logo-mark.png'}
              alt="Insova"
            />
          </div>

          {pharmacy && (
            <div className="ia-side-org">
              <span className="k">Signed in for</span>
              <strong>{pharmacy.name}</strong>
              {[pharmacy.town, pharmacy.county].filter(Boolean).length > 0 && (
                <span>{[pharmacy.town, pharmacy.county].filter(Boolean).join(', ')}</span>
              )}
            </div>
          )}
        </div>

        <nav className="ia-nav">
          <div className="ia-nav-group">
            {NAV_MAIN.map(NavItem)}
          </div>

          <div className="ia-nav-group secondary">
            <span className="ia-nav-heading">Insova</span>
            {navMore.map(NavItem)}
          </div>
        </nav>

        <div className="ia-side-foot">
          <button className="ia-linkbtn" onClick={onHome}>insova.ie</button>
          <a className="ia-linkbtn" href="/privacy.html" target="_blank" rel="noreferrer">
            Privacy
          </a>
          <button className="ia-linkbtn" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <div className="ia-main">
        <header className="ia-top">
          <button className="ia-burger" aria-label="Menu" onClick={() => setMenuOpen((v) => !v)}>
            ☰
          </button>
          <div className="ia-top-title">{allNav.find((n) => n.id === view)?.label}</div>
          <div className="ia-top-right">
            {app.data && (
              <span data-tour="freshness" className={'ia-freshness' + (stale > 1 ? ' warn' : '')}>
                <span className="ia-dot" />
                Register collected {app.data.meta.as_of_label}
              </span>
            )}
            <button
              type="button"
              className="ia-tour-btn"
              onClick={startTour}
              title="A two-minute walk through every screen"
            >
              <span className="ia-tour-btn-q" aria-hidden="true">?</span>
              Tutorial
            </button>
            <span className="ia-who">{profile?.full_name || profile?.email}</span>
          </div>
        </header>

        <main className="ia-body" data-tour="body">
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

          {watch.error && (
            <div className="ia-alert warn">
              <strong>Your list could not be loaded.</strong>
              <span>{watch.error}</span>
            </div>
          )}

          {app.loading && <div className="ia-loading">Loading the register…</div>}

          {app.ready && view === 'dashboard' && <Dashboard app={app} watch={watch} go={go} />}
          {app.ready && view === 'watchlist' && <Watchlist app={app} watch={watch} go={go} />}
          {app.ready && view === 'shortages' && (
            <Shortages app={app} watch={watch} focusId={focusId} preset={preset} />
          )}
          {app.ready && view === 'groups' && <Groups app={app} go={go} />}
          {app.ready && view === 'notices' && <Notices app={app} />}
          {view === 'ulm' && <ULM app={app} />}
          {/* Gated on app.ready because rows cross-reference today's
              register to say whether a product is currently short.
              Without it, everything would silently read as not short. */}
          {app.ready && view === 'medicines' && <Medicines app={app} watch={watch} go={go} />}
          {app.ready && view === 'digest' && <Digest app={app} watch={watch} />}
          {view === 'roadmap' && <Roadmap app={app} />}
          {view === 'feedback' && <Feedback app={app} />}
          {view === 'admin' && isAdmin && <Admin app={app} />}
        </main>

        {/* Moved out of the sidebar. Still on every screen, still
            satisfies the CC BY 4.0 attribution the HPRA requires, but no
            longer squeezing the navigation into a scrolling box. */}
        <footer className="ia-foot">
          <p>
            Information only. Insova never substitutes, orders or dispenses.
            Not a patient record system.
          </p>
          <p>
            Information provided courtesy of the Health Products Regulatory Authority
            (HPRA) under a Creative Commons Attribution 4.0 International{' '}
            <a href="http://creativecommons.org/licenses/by/4.0/"
               target="_blank" rel="license noreferrer">CC BY 4.0</a> licence.
            Insova is not connected with, sponsored by, or endorsed by the HPRA.
          </p>
        </footer>
      </div>

      {menuOpen && <div className="ia-scrim" onClick={() => setMenuOpen(false)} />}

      {/* Offered once, the first time someone opens the app in this browser. */}
      {tourPrompt && !tourOpen && app.ready && (
        <div className="ia-tour-prompt" role="dialog" aria-label="Take the tour">
          <strong>New to Insova?</strong>
          <p>A two-minute tour shows what each screen is for.</p>
          <div className="ia-tour-prompt-actions">
            <button type="button" className="ia-tour-next" onClick={startTour}>Show me around</button>
            <button
              type="button"
              className="ia-tour-skip"
              onClick={() => { setTourPrompt(false); markTourSeen(); }}
            >
              Not now
            </button>
          </div>
        </div>
      )}

      <Tour open={tourOpen} onClose={endTour} go={go} />
    </div>
  );
}