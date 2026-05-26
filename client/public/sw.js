/* AreYouOK Service Worker (offline shell + push) */

const CACHE_NAME = 'ayok-shell-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32x32.png',
  '/icons/favicon-16x16.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    if (['script', 'style', 'image', 'font'].includes(req.destination)) {
      event.respondWith(
        caches.match(req).then(
          (cached) =>
            cached ||
            fetch(req).then((res) => {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
              return res;
            })
        )
      );
      return;
    }
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'AreYouOK', body: event.data?.text?.() };
  }

  const title = data.title || 'AreYouOK';
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: data,
    tag: data.tag,
    requireInteraction: Boolean(data.requireInteraction),
    actions: data.actions || []
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  const notif = event.notification;
  const data = notif.data || {};
  const action = event.action;
  notif.close();

  event.waitUntil(
    (async () => {
      if (action && data.actionMap && data.actionMap[action]) {
        const item = data.actionMap[action];
        try {
          await fetch(item.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload || {}),
            credentials: 'include'
          });

          await self.registration.showNotification('AreYouOK', {
            body: '✅',
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
            tag: `ack-${data.tag || ''}`
          });
          return;
        } catch (e) {
          // fall through to opening the app
        }
      }

      const targetUrl = data.url || data?.data?.url || '/';
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of allClients) {
        if (c.url.includes(self.location.origin)) {
          c.focus();
          c.navigate(targetUrl);
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});
