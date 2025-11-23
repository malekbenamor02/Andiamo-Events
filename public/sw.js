// Service Worker for Andiamo Events Scanner
// Updated cache version to force refresh
const CACHE_NAME = 'andiamo-events-scanner-v2';
const urlsToCache = [
  '/manifest.json',
  '/placeholder.svg'
];

// Install event
self.addEventListener('install', (event) => {
  // Don't skip waiting immediately to prevent refresh loops
  // Let the old service worker finish before activating new one
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Only skip waiting after cache is ready
        return self.skipWaiting();
      })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // NEVER cache the HTML page, API requests, Supabase requests, or scripts
  // Always fetch from network to ensure latest version
  if (url.pathname === '/' || 
      url.pathname === '/index.html' ||
      url.pathname.startsWith('/api/') || 
      url.hostname.includes('supabase') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.mjs') ||
      url.pathname.endsWith('.ts') ||
      url.pathname.endsWith('.tsx') ||
      url.pathname.endsWith('.css') ||
      event.request.destination === 'script' ||
      event.request.destination === 'style' ||
      event.request.destination === 'document') {
    // Always fetch from network for HTML, scripts, styles, and API calls
    event.respondWith(fetch(event.request));
    return;
  }
  
  // For static assets (images, etc.), try network first, then cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for static assets
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request);
      })
  );
});

// Activate event - clear all old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
}); 