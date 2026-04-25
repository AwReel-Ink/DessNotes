const CACHE = 'dessnotes-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/history.js',
  './js/render.js',
  './js/layers.js',
  './js/tools.js',
  './js/io.js',
  './js/ui.js',
  './js/app.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(err=>console.warn('SW cache partiel:',err)))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  // Stratégie : cache-first, fallback réseau, puis re-cache
  e.respondWith(
    caches.match(req).then(cached => {
      if(cached) return cached;
      return fetch(req).then(res => {
        // Ne pas cacher les CDN externes (heic2any) si pas en ASSETS
        if(res.ok && req.url.startsWith(self.location.origin)){
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(()=> cached);
    })
  );
});
