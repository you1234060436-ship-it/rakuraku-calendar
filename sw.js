const CACHE_NAME = 'rakuraku-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/personal.html',
  '/privacy.html',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if(e.request.url.includes('supabase') || e.request.url.includes('/api/')) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if(res.ok){
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});

self.addEventListener('message', e => {
  if(e.data === 'skipWaiting') self.skipWaiting();
  if(e.data === 'clearCache'){
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
