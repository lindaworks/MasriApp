// =====================================================
// MasriApp – Service Worker (B5.9)
// Offline Cache für App-Dateien + letzter Lernstand
// =====================================================

const CACHE_NAME = "masriapp-cache-v1";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// -----------------------------------------------------
// Installation
// -----------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// -----------------------------------------------------
// Aktivierung
// -----------------------------------------------------

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// -----------------------------------------------------
// Fetch – Netzwerk mit Fallback Cache
// -----------------------------------------------------

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // ZIPs NICHT offline cachen → immer live vom Proxy holen
  if (req.url.includes("/text") || req.url.includes("/audio")) {
    return;
  }

  // Normale App-Dateien aus Cache laden
  event.respondWith(
    caches.match(req).then((cached) => {
      return (
        cached ||
        fetch(req).catch(() => {
          // Offline-Fallback: index.html
          if (req.mode === "navigate") {
            return caches.match("./index.html");
          }
        })
      );
    })
  );
});