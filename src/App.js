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
  index.html. Hashes work everywhere with no server config, and /data.html
  keeps working untouched because it is a real file.

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

  if (loading) {
    return (
      <div className="ia-boot">
        <img src={process.env.PUBLIC_URL + '/insova-logo.png'} alt="Insova" />
        <span>Loading…</span>
      </div>
    );
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