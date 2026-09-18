import React, { useCallback, useEffect, useState } from 'react';
import './App.css';
import Marketing from './Marketing';
import Login from './auth/Login';
import AppShell from './app/AppShell';
import { AuthProvider, useAuth } from './auth/AuthProvider';

/*
  Routing.

  Deliberately hash based rather than react-router. The site is served as
  a static build behind Railway, so a path like /app would 404 on a hard
  refresh unless the server is configured to rewrite everything to
  index.html. Hashes work everywhere with no server config, and
  /data.html keeps working untouched because it is a real file.

    #/          marketing site
    #/login     sign in
    #/app       pharmacy application
    #/verify    after an email confirmation link

  EMAIL CONFIRMATION
  ------------------
  Supabase's confirmation link goes to Supabase first, which verifies the
  token and then redirects the browser back here. How it hands the result
  over depends on the flow:

    implicit   #access_token=...&refresh_token=...&type=signup
    PKCE       ?code=...
    failure    #error=access_denied&error_description=...

  All three land on whatever redirect target Supabase was given, and none
  of them look like "#/verify". So the route is detected from the payload
  rather than from a path we control: anything carrying one of those
  shapes is a confirmation landing, wherever it landed.

  supabase-js reads the fragment itself and establishes the session, so
  this screen mostly waits for AuthProvider to see it. What matters is
  that the person is told what happened instead of being dropped on a
  blank page, which is what pharmacists were hitting.
*/

function hasAuthPayload() {
  const h = window.location.hash || '';
  const s = window.location.search || '';
  return (
    h.includes('access_token=') ||
    h.includes('error_description=') ||
    h.includes('error=') ||
    h.includes('type=signup') ||
    h.includes('type=recovery') ||
    h.includes('type=invite') ||
    s.includes('code=') ||
    s.includes('error_description=')
  );
}

function route() {
  if (hasAuthPayload()) return 'verify';
  const h = (window.location.hash || '').replace(/^#\/?/, '').split('?')[0];
  if (h.startsWith('verify')) return 'verify';
  if (h.startsWith('app')) return 'app';
  if (h.startsWith('login')) return 'login';
  return 'home';
}

/* Whatever Supabase said went wrong, in its own words. */
function authProblem() {
  const from = (raw) => new URLSearchParams(raw.replace(/^[#?]/, ''));
  const h = from(window.location.hash || '');
  const s = from(window.location.search || '');
  const desc = h.get('error_description') || s.get('error_description');
  const code = h.get('error') || s.get('error');
  if (!desc && !code) return null;
  return (desc || code || '').replace(/\+/g, ' ');
}

/*
  The waiting screen.

  Two things were wrong with the old one. The logo sat on the same navy
  as the background, so the wordmark disappeared and only the green
  shapes showed. And it appeared on the public marketing site, where
  there is no session to check and a visitor should never be made to
  wait for anything.

  Now it only renders on the app and login routes, and it sits on a
  light background so the logo can be shown in its own colours. The bar
  moves, because a still screen reads as broken.
*/
function Booting() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    // If this is still on screen after a few seconds, something is
    // wrong and the person deserves to be told rather than left
    // watching an animation.
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="ia-boot">
      <div className="ia-boot-inner">
        <img
          className="ia-boot-logo"
          src={process.env.PUBLIC_URL + '/insova-logo.png'}
          alt="Insova"
        />
        <div className="ia-boot-bar" role="progressbar" aria-label="Signing you in">
          <span />
        </div>
        <p className="ia-boot-text">
          {slow ? 'Still working on it.' : 'Signing you in'}
        </p>
        {slow && (
          <p className="ia-boot-slow">
            This is taking longer than it should. If it does not clear,
            reload the page or email contact@insova.ie.
          </p>
        )}
      </div>
    </div>
  );
}

/*
  Where a confirmation link lands.

  Four outcomes, and each one gets said out loud:

    confirmed and signed in   straight into the app
    confirmed, not signed in  sign in normally (some mail clients open
                              the link in a browser that is not theirs)
    link dead                 expired, or already used
    still waiting             a few seconds, then treat as not signed in

  The old behaviour was none of these: the payload did not match any
  route, so people landed on nothing at all.
*/
function Verified({ go }) {
  const { session, loading } = useAuth();
  const problem = authProblem();
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 5000);
    return () => clearTimeout(t);
  }, []);

  // Clear the token out of the address bar once it has been read. It is
  // spent, it is ugly, and it should not sit in browser history.
  useEffect(() => {
    if (session && !problem) {
      window.history.replaceState(null, '', window.location.pathname + '#/verify');
    }
  }, [session, problem]);

  if (!problem && !session && loading && !waited) {
    return <Booting />;
  }

  const ok = Boolean(session) && !problem;

  return (
    <div className="ia-boot">
      <div className="ia-boot-inner wide">
        <img
          className="ia-boot-logo"
          src={process.env.PUBLIC_URL + '/insova-logo.png'}
          alt="Insova"
        />

        {ok && (
          <>
            <h1 className="ia-verify-h">Your email is confirmed</h1>
            <p className="ia-verify-p">
              You are signed in. If your account has not been linked to a
              pharmacy yet, the app will tell you and we will sort it.
            </p>
            <button className="ia-verify-btn" onClick={() => go('app')}>
              Open Insova
            </button>
          </>
        )}

        {!ok && problem && (
          <>
            <h1 className="ia-verify-h">That link did not work</h1>
            <p className="ia-verify-p">
              Confirmation links expire, and they can only be used once. If you
              have already confirmed, just sign in.
            </p>
            <p className="ia-verify-detail">{problem}</p>
            <button className="ia-verify-btn" onClick={() => go('login')}>
              Go to sign in
            </button>
            <p className="ia-verify-help">
              Still stuck? Email <a href="mailto:contact@insova.ie">contact@insova.ie</a>{' '}
              and we will confirm the account by hand.
            </p>
          </>
        )}

        {!ok && !problem && (
          <>
            <h1 className="ia-verify-h">Your email is confirmed</h1>
            <p className="ia-verify-p">
              You are not signed in on this browser, which happens when the link
              opens somewhere other than where you signed up. Sign in with the
              email and password you chose.
            </p>
            <button className="ia-verify-btn" onClick={() => go('login')}>
              Go to sign in
            </button>
            <p className="ia-verify-help">
              Something not right? Email{' '}
              <a href="mailto:contact@insova.ie">contact@insova.ie</a>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Router() {
  const { session, loading } = useAuth();
  const [where, setWhere] = useState(route());

  useEffect(() => {
    const onHash = () => setWhere(route());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((to) => {
    // Drop any leftover auth payload from the query string as well as
    // the hash, or route() would keep resolving to 'verify'.
    if (window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    window.location.hash = to === 'home' ? '/' : '/' + to;
    setWhere(to);
    window.scrollTo(0, 0);
  }, []);

  // Send a signed-in user who lands on /login straight into the app, and
  // bounce anyone who asks for /app without a session back to sign in.
  // The verify route is exempt: it is a message, and it decides for
  // itself where the person goes next.
  useEffect(() => {
    if (loading || where === 'verify') return;
    if (session && where === 'login') go('app');
    if (!session && where === 'app') go('login');
  }, [session, where, loading, go]);

  if (where === 'verify') {
    return <Verified go={go} />;
  }

  // Only the routes that actually need a session wait for one. The
  // marketing site is public and renders immediately.
  if (loading && where !== 'home') {
    return <Booting />;
  }

  if (where === 'login') {
    return <Login onDone={() => go('app')} onHome={() => go('home')} />;
  }

  if (where === 'app' && session) {
    return <AppShell onHome={() => go('home')} />;
  }

  return <Marketing onLogin={() => go(session ? 'app' : 'login')} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}