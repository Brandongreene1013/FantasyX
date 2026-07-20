const CACHE_NAME = "fantasyx-os-v11";
const APP_SHELL = [
  "/",
  "/markets",
  "/markets/board",
  "/live",
  "/offline.html",
  "/manifest.json",
  "/icons/icon.svg",
  "/icons/maskable-icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/webpack-hmr")) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "content-type": "application/json" }
    })));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !response.redirected && isPublicNavigation(url.pathname)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/offline.html")))
    );
    return;
  }

  event.respondWith(networkWithCacheFallback(request));
});

function isPublicNavigation(pathname) {
  return pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/live" ||
    pathname === "/markets" ||
    pathname === "/markets/board" ||
    pathname.startsWith("/markets/") ||
    pathname.startsWith("/players/");
}

async function networkWithCacheFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "content-type": "application/json" }
    });
  }
}
