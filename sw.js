/* GrocerX service worker
   - HTML/CSS/JS: network-first (hamesha latest), offline ho to cache se
   - Images/fonts: cache-first (fast)
   - Supabase / dusre domains: bilkul touch nahi (auth + orders hamesha live) */
const VERSION = 'grocerx-v16';
const STATIC = VERSION + '-static';
const IMAGES = VERSION + '-img';

const CORE = [
  './',
  './index.html',
  './grocerx.css',
  './grocerx.js',
  './app.js',
  './manifest.json',
  './images/icon-192.png',
  './images/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC).then(c =>
      // ek file missing ho to bhi baaki cache ho jayein
      Promise.all(CORE.map(u => c.add(u).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

function networkFirst(req, cacheName, fallbackUrl) {
  return fetch(req)
    .then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(cacheName).then(c => c.put(req, copy));
      }
      return res;
    })
    .catch(() =>
      caches.match(req, { ignoreSearch: true }).then(r => r || (fallbackUrl ? caches.match(fallbackUrl) : Response.error()))
    );
}

function cacheFirst(req, cacheName) {
  return caches.match(req).then(hit => {
    if (hit) return hit;
    return fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(cacheName).then(c => c.put(req, copy));
      }
      return res;
    });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, CDN, Google — direct network

  // Page open (navigation)
  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req, STATIC, './index.html'));
    return;
  }
  // Images / fonts
  if (/\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf)$/i.test(url.pathname)) {
    e.respondWith(cacheFirst(req, IMAGES).catch(() => Response.error()));
    return;
  }
  // CSS / JS / JSON
  e.respondWith(networkFirst(req, STATIC));
});
