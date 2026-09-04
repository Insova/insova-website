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
*/

function route() {
  const h = (window.location.hash || '').replace(/^#\/?/, '').split('?')[0];
  if (h.startsWith('app')) return 'app';
  if (h.startsWith('login')) return 'login';
  return 'home';
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

function Router() {
  const { session, loading } = useAuth();
  const [where, setWhere] = useState(route());

  useEffect(() => {
    const onHash = () => setWhere(route());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((to) => {
    window.location.hash = to === 'home' ? '/' : '/' + to;
    setWhere(to);
    window.scrollTo(0, 0);
  }, []);

  // Send a signed-in user who lands on /login straight into the app, and
  // bounce anyone who asks for /app without a session back to sign in.
  useEffect(() => {
    if (loading) return;
    if (session && where === 'login') go('app');
    if (!session && where === 'app') go('login');
  }, [session, where, loading, go]);

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