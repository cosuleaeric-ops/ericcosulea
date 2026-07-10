const CACHE = "elite-deux-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  // Pagina: network-first cu fallback la cache (funcționează offline).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            putInCache(request, response.clone());
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error()))
    );
    return;
  }

  // Assets: stale-while-revalidate — servește instant din cache, actualizează în fundal.
  const cacheable = url.pathname.startsWith("/elite-deux/") || url.pathname.startsWith("/_next/static/");
  if (!cacheable) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            putInCache(request, response.clone());
          }
          return response;
        })
        .catch(() => cached || Response.error());
      return cached || network;
    })
  );
});

function putInCache(request, response) {
  caches.open(CACHE).then((cache) => cache.put(request, response));
}
