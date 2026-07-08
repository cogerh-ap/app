const CACHE_NAME = 'cogerh-pwa-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './icon.svg',
  './cogerh_logo.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Cache external assets dynamically if they are successful
        if (response.status === 200 && (event.request.url.startsWith('http') || event.request.url.includes('googleapis') || event.request.url.includes('gstatic') || event.request.url.includes('cloudflare'))) {
          // DO NOT cache live spreadsheet queries so they are always fresh!
          if (event.request.url.includes('spreadsheets/d/') || event.request.url.includes('gviz/tq')) {
            return response;
          }
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Fallback for document fetch or other issues when offline
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Offline mode. Conexão indisponível.');
      });
    })
  );
});
