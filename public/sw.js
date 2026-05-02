self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Skip interception for Firebase Storage/Firestore to avoid Service Worker fetch issues with CORS/Auth headers
  if (e.request.url.includes('firebasestorage.googleapis.com') || 
      e.request.url.includes('firestore.googleapis.com') ||
      e.request.url.includes('identitytoolkit.googleapis.com') ||
      e.request.url.includes('cloudfunctions.net') ||
      e.request.url.includes('googleapis.com')) {
    return;
  }
  
  // Basic pass-through for PWA installability requirements
  e.respondWith(fetch(e.request));
});
