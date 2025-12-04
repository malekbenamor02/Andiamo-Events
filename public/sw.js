// Service Worker for Andiamo Events Scanner
// Updated cache version to prevent refresh loops and exclude OG images
// v5: Fixed POST request caching issue
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
  // IMPORTANT: Also skip ALL non-GET requests (POST, PUT, DELETE, PATCH)
  const isNonGetRequest = event.request.method !== 'GET';
  const isSupabaseStorage = url.hostname.includes('supabase.co') && url.pathname.includes('/storage/');
  
  if (isNonGetRequest ||
      url.pathname === '/' || 
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
    // Always fetch from network for HTML, scripts, styles, API calls, and non-GET requests
    // Don't catch errors - let them propagate naturally, but handle gracefully
    event.respondWith(
      fetch(event.request).catch(err => {
        // Log error but don't block - return a proper error response
        console.warn('Service worker fetch error (non-critical):', err);
        // Return a proper HTTP error response (503 Service Unavailable)
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
  // This code only runs for GET requests to static assets (already filtered above)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful GET responses for static assets
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

// Activate event - clear all old caches and take control
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
      // Take control of all clients to ensure new service worker is active
      return self.clients.claim();
    })
  );
}); 