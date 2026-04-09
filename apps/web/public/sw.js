const CACHE_NAME = 'crm-os-pos-v1';
const OFFLINE_QUEUE_KEY = 'crm-os-offline-queue';

// Assets to cache for offline POS
const POS_ASSETS = [
  '/pos',
  '/pos/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(POS_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Network-first for API calls; cache-first for POS UI assets
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request.clone())
        .then((response) => {
          return response;
        })
        .catch(() => {
          // Offline: queue POST requests for later sync
          if (request.method === 'POST') {
            return request.json().then((body) => {
              queueOfflineTransaction(body);
              return new Response(
                JSON.stringify({ queued: true, message: 'Transaction queued for sync' }),
                { status: 202, headers: { 'Content-Type': 'application/json' } },
              );
            });
          }
          return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }),
    );
  } else {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request)),
    );
  }
});

function queueOfflineTransaction(body) {
  // Store in IndexedDB via postMessage to main thread
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'QUEUE_OFFLINE_TX', payload: body });
    });
  });
}

// Listen for sync events to flush offline queue
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pos-transactions') {
    event.waitUntil(syncOfflineTransactions());
  }
});

async function syncOfflineTransactions() {
  // Notify clients to flush their IndexedDB queue
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' });
  });
}
