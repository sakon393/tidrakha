// Bump VERSION whenever any file changes so phones pick up the new app.
const VERSION = 'tag-v44';
const FILES = [
  './',
  'index.html',
  'style.css',
  'catalog.js',
  'store.js',
  'stock.js',
  'camera.js',
  'app.js',
  'pdf.min.js',
  'pdf.worker.min.js',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the browser's own cache (GitHub Pages keeps files 10 minutes) so a new
  // version never stores old files.
  const fresh = FILES.map((file) => new Request(file, { cache: 'reload' }));
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(fresh)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request)));
});
