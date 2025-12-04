// Service Worker for Andiamo Events Scanner
// Updated cache version to prevent refresh loops and exclude OG images
const CACHE_NAME = 'andiamo-events-scanner-v4';
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
  // NEVER cache POST, PUT, DELETE, or PATCH requests
  const isNonGetRequest = event.request.method !== 'GET';
  
  if (isNonGetRequest) {
    // For non-GET requests, just fetch from network (no caching)
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful GET responses for static assets
        if (response.status === 200 && event.request.method === 'GET') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // Only cache GET requests
            if (event.request.method === 'GET') {
              cache.put(event.request, responseToCache);
            }
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try cache (only for GET requests)
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