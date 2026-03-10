// FCM background handler: fetch config from API then initialize Firebase Messaging.
// Keep this file in public/ so it is served at origin; Firebase looks for /firebase-messaging-sw.js by default.

const CONFIG_URL = '/api/firebase-sw-config';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Never cache POST (or other non-GET) requests — Cache API only supports GET
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }
  // GET: pass through (no caching in this SW to avoid PUT errors)
  event.respondWith(fetch(event.request));
});

async function fetchConfig(retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(CONFIG_URL);
    if (res.ok) {
      const config = await res.json();
      if (config && config.projectId && config.apiKey) return config;
    }
    if (i < retries - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
  }
  return null;
}

async function init() {
  const config = await fetchConfig();
  if (!config) return;
  try {
    importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');
    firebase.initializeApp(config);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title = (payload.notification && payload.notification.title) || payload.data?.title || 'Notification';
      const body = (payload.notification && payload.notification.body) || payload.data?.body || '';
      const url = payload.data?.url || (payload.data?.path ? self.location.origin + payload.data.path : self.location.origin + '/');
      const icon = payload.notification?.icon || '/assets/faviconn.png';
      return self.registration.showNotification(title, {
        body,
        icon,
        data: { url },
        tag: payload.data?.tag || 'fcm',
        renotify: true
      });
    });
  } catch (e) {
    console.error('[firebase-messaging-sw] init error', e);
  }
}

init();

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.location.origin + '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url || client.url.startsWith(self.location.origin)) {
          client.focus();
          return client.navigate(url);
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
