const CACHE_NAME = 'a3-pilot-maquette-v4.6';
const APP_SHELL = [
  './', './index.html', './styles.css', './css/onboarding.css', './css/rbac.css', './app.js', './onboarding.js', './rbac.js', './manifest.webmanifest', './assets/icon.svg',
  './chunks/app-01.part', './chunks/app-02.part', './chunks/app-03.part', './chunks/app-04.part', './chunks/app-05.part', './chunks/app-06.part', './chunks/app-07.part', './css/p01.css', './css/p02.css', './css/p03.css', './css/p04.css', './css/p05.css', './css/p06.css', './css/p07.css', './css/p08.css', './css/p09.css'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
