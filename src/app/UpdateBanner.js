import React, { useEffect, useState } from 'react';

/*
  "A new version of Insova is available."

  WHY THIS EXISTS
  The service worker caches nothing, so a reload always gets the newest
  build. The problem is that an installed app is rarely reloaded: it sits
  open on a dispensary PC for days, still running the code it started
  with. People had to force quit to get an update.

  HOW IT WORKS
  Every Create React App build writes /asset-manifest.json, which names
  the current main bundle (main.<hash>.js). We compare that with the
  bundle this page actually loaded. Different hash = a newer build has
  been deployed. Then a banner offers "Update now", which reloads.

  It checks when the app starts, every 10 minutes, and whenever the
  window comes back into focus (the usual moment: someone returns to
  the PC in the morning).

  It does nothing under `npm start`, where there is no hashed bundle.
  Nothing is cached and no data is touched.
*/

const CHECK_EVERY_MS = 10 * 60 * 1000;

function loadedBundle() {
  const s = [...document.querySelectorAll('script[src]')]
    .map((el) => el.getAttribute('src'))
    .find((src) => /\/static\/js\/main\.[0-9a-f]+\.js$/.test(src || ''));
  return s ? s.replace(/^https?:\/\/[^/]+/, '') : null;
}

export default function UpdateBanner() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const mine = loadedBundle();
    if (!mine) return undefined; // development build

    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState === 'hidden') return;
      try {
        const r = await fetch('/asset-manifest.json?t=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) return;
        const m = await r.json();
        const latest = m && m.files && m.files['main.js'];
        if (latest && latest !== mine) setAvailable(true);
      } catch (e) {
        /* offline or mid-deploy: try again next time */
      }
    };

    check();
    const t = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    return () => {
      stopped = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, []);

  if (!available) return null;

  return (
    <div className="ia-update" role="status">
      <span className="ia-update-dot" aria-hidden="true" />
      <span className="ia-update-text">
        <strong>A new version of Insova is available.</strong>
        <span> Update now to get the latest changes. It takes a second.</span>
      </span>
      <button type="button" className="ia-update-btn" onClick={() => window.location.reload()}>
        Update now
      </button>
      <button type="button" className="ia-update-later" onClick={() => setAvailable(false)}>
        Later
      </button>
    </div>
  );
}