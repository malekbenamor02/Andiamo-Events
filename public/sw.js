// Service Worker for Andiamo Events Scanner
// Updated cache version to prevent refresh loops and exclude OG images
// v5: Force refresh to fix localhost API issue
const CACHE_NAME = 'andiamo-events-scanner-v5';
const urlsToCache = [
  '/manifest.json',
  '/placeholder.svg'
];

// Install event
self.addEventListener('install', (event) => {
  // Don't skip waiting - let the old service worker finish naturally
  // This prevents automatic page refreshes
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      // Don't call skipWaiting() - this prevents automatic refresh
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // NEVER cache the HTML page, API requests, Supabase requests, or scripts
  // Always fetch from network to ensure latest version
  const isSupabaseStorage = url.hostname.includes('supabase.co') && url.pathname.includes('/storage/');
  
  if (url.pathname === '/' || 
      url.pathname === '/index.html' ||
      url.pathname.startsWith('/api/') || 
      url.hostname.includes('supabase.co') ||
      isSupabaseStorage ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.mjs') ||
      url.pathname.endsWith('.ts') ||
      url.pathname.endsWith('.tsx') ||
      url.pathname.endsWith('.css') ||
      event.request.destination === 'script' ||
      event.request.destination === 'style' ||
      event.request.destination === 'document') {
    // Always fetch from network for HTML, scripts, styles, and API calls
    // Don't catch errors - let them propagate naturally, but handle gracefully
    event.respondWith(
      fetch(event.request).catch(() => {
        // Underlying error (CORS, 401, network) already in console; avoid duplicate log
        return new Response('Network Error', { 
          status: 503, 
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      })
    );
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
      // Don't claim clients immediately - this prevents automatic refresh
      // Clients will be claimed naturally when they navigate
      // return self.clients.claim(); // Commented out to prevent auto-refresh
    })
  );
}); 