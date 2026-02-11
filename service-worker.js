const CACHE_NAME = "syamsullail-cache-v1";
const ASSETS_TO_CACHE = [
  '/',
  'index.html',
  'informasi.html',
  'quran.html',
  'index.html',
  'css/style.css',
  'css/main.css',
  'css/quran.css',
  'css/informasi.css',
  'asset/icons/icon-192x192.png',
  'assets/icons/icon-512x512.png',
  'assets/icons/icon-92x92.png',
  'js/main.js'
  'js/quran.js'
  'js/main.js'
  'app.js',
  'service-worker.js',
  'manifest.json'

];

// Install Service Worker
self.addEventListener("install", (event) => {
  console.log("Service Worker: Installed");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Service Worker
self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activated");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("Service Worker: Clearing old cache");
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch Event: Menangani permintaan jaringan
self.addEventListener("fetch", (event) => {
  console.log("Service Worker: Fetching", event.request.url);
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Jika ada di cache, kembalikan respons dari cache
      if (response) {
        return response;
      }

      // Jika tidak ada di cache, lakukan permintaan jaringan
      return fetch(event.request)
        .then((response) => {
          // Jika respons valid, simpan ke cache
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Jika offline, tampilkan halaman fallback
          return caches.match("offline.html"); // Pastikan Anda memiliki file offline.html
        });
    })
  );
});