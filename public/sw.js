const CACHE_NAME = "stgblog-v6";
const STATIC_ASSETS = ["./", "./index.html", "./icon-192.png", "./icon-512.png", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
      // Enable navigation preload if available
      self.registration.navigationPreload?.enable?.(),
    ])
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Network-first for navigation requests (SPA), cache-first for assets
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./index.html"))
    );
  } else {
    event.respondWith(
      fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request))
    );
  }
});

// ===== Push Notifications =====
self.addEventListener("push", (event) => {
  let data = { title: "STGBLOG", body: "你有新消息", url: "./" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {}
  const options = {
    body: data.body,
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: data.tag || "stgblog-notification",
    data: { url: data.url },
    vibrate: [200, 100, 200],
    renotify: !!data.tag,
    actions: data.actions || [],
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open new window
      self.clients.openWindow(url);
    })
  );
});

// ===== Badge Update (periodic) =====
// The app will post messages to the SW to update the badge
self.addEventListener("message", (event) => {
  if (event.data?.type === "BADGE_UPDATE") {
    const count = event.data.count || 0;
    try {
      if (count > 0) {
        navigator.setAppBadge?.(count);
      } else {
        navigator.clearAppBadge?.();
      }
    } catch {}
  }
});
