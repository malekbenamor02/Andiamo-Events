// Service Worker for Andiamo Events Scanner
const CACHE_NAME = 'andiamo-events-scanner-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/placeholder.svg'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Don't cache API requests, Supabase requests, or module scripts
  if (url.pathname.startsWith('/api/') || 
      url.hostname.includes('supabase') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.mjs') ||
      url.pathname.endsWith('.ts') ||
      url.pathname.endsWith('.tsx') ||
      event.request.destination === 'script') {
    // Always fetch from network for scripts and API calls
    event.respondWith(fetch(event.request));
    return;
  }
  
  // For other requests, try cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// Activate event
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
    })
  );
}); 