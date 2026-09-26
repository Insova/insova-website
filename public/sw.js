/*
  Insova service worker.

  Exists so the site can be installed as an app, from the browser or
  through the Microsoft Store. It is deliberately almost empty.

  IT CACHES NO DATA. Not insova-app.json, not insova-medicines.json,
  not the pages. Most PWA templates cache aggressively so the app works
  offline, and for a shortage tool that would be dangerous: an installed
  app on a dispensary PC could open with yesterday's register and show it
  as though it were today's. A pharmacist has no way to tell.

  So every request goes to the network, exactly as it would in a normal
  browser tab. The only thing held locally is offline.html, which is
  shown when a page is requested and there is no connection. It says
  plainly that the data cannot be loaded, rather than showing something
  stale.

  If you ever add caching here, it must never touch the JSON files.
*/

const CACHE = 'insova-offline-v1';
const OFFLINE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add(new Request(OFFLINE, { cache: 'reload' })))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Remove any cache from an earlier version of this file.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only page loads are handled. Everything else, including every data
  // file and every call to Supabase, is left completely alone and goes
  // to the network as normal.
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE))
  );
});