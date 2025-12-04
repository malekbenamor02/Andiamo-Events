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
  const request = event.request;
  
  // CRITICAL: Completely bypass service worker for API requests and non-GET requests
  // This prevents any interference with authentication flows
  const isApiRequest = url.pathname.startsWith('/api/');
  const isNonGetRequest = request.method !== 'GET';
  const isSupabaseRequest = url.hostname.includes('supabase.co');
  
  // For API requests or non-GET requests, don't intercept at all - let browser handle natively
  if (isApiRequest || isNonGetRequest) {
    // Don't call event.respondWith() - this allows the request to bypass service worker completely
    return;
  }
  
  // For other requests that should bypass service worker
  const isSupabaseStorage = isSupabaseRequest && url.pathname.includes('/storage/');
  const shouldBypass = url.pathname === '/' || 
      url.pathname === '/index.html' ||
      isSupabaseRequest ||
      isSupabaseStorage ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.mjs') ||
      url.pathname.endsWith('.ts') ||
      url.pathname.endsWith('.tsx') ||
      url.pathname.endsWith('.css') ||
      request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'document';
  
  if (shouldBypass) {
    // Fetch from network without caching
    event.respondWith(
      fetch(request).catch(err => {
        console.warn('Service worker fetch error (non-critical):', err);
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