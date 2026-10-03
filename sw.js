// NovaQuiz v4.1.0 - Service Worker (Network-First for Fresh Updates & Offline PWA)
const CACHE_NAME = "novaquiz-cache-v4.1.0";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./jszip.min.js",
  "./pdf.min.js",
  "./pdf.worker.min.js",
  "./sample-data.js",
  "./de_thi_co_anh_va_khong_abcd.docx"
];

// Install: Cache critical assets and skip waiting immediately
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("[NovaQuiz SW] Một số tài nguyên ngoại tuyến không nạp được:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: Delete all old caches and claim all clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[NovaQuiz SW] Xóa bộ nhớ cache cũ:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network-First strategy (always get latest updates from server, fallback to cache if offline)
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        // When offline, fall back to cache (ignore search parameters like ?v=4.1.0)
        return caches.match(event.request, { ignoreSearch: true });
      })
  );
});
