// Minimal service worker — exists mainly so Chrome/Android considers the
// site installable. Does not attempt full offline support (API/data calls
// always go to the network).
//
// The HTML shell is intentionally NEVER cache-first: it references
// content-hashed JS/CSS filenames that change on every deploy, and old
// hashed files are deleted from the server once a new build replaces them.
// A stale cached index.html pointing at a since-deleted chunk is exactly
// what causes "Failed to load module script ... MIME type text/html"
// errors — the request for the missing old file falls through Netlify's
// SPA rewrite and gets index.html back instead of JS. Navigations always
// go to the network first; only non-navigation same-origin GETs (already
// content-hashed, so a cached copy can never go stale under a new name)
// use cache-first.
const CACHE_NAME = 'recipehub-shell-v2';
const SHELL_URLS = ['/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
