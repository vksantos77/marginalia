// Keeps the app usable offline. Our own files are network-first, so each publish reaches the installed app on its next open.
const CACHE = "marginalia-v1";
const NETWORK_WAIT_MS = 3000;

const APP_FILES = [
  "./",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
];
// The reader's libraries. A failure here must not stop the install: the reader then loads them when first needed.
const LIBRARIES = [
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
];
const CACHED_HOSTS = ["cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_FILES);
    await Promise.allSettled(LIBRARIES.map(url => cache.add(new Request(url, {mode: "cors", credentials: "omit"}))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const {request} = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) event.respondWith(fromNetworkFirst(request, event));
  else if (CACHED_HOSTS.includes(url.hostname)) event.respondWith(fromCacheFirst(request));
  // Everything else, such as the Open Library search, goes straight to the network.
});

async function fromNetworkFirst(request, event) {
  const cache = await caches.open(CACHE);
  // Every page of the app is the same file, so all navigations share one cache entry.
  const key = request.mode === "navigate" ? "./" : request;
  const network = fetch(request.url, {cache: "no-cache", credentials: "same-origin"}).then(response => {
    if (response.ok) return cache.put(key, response.clone()).then(() => response);
    return response;
  });
  // A slow connection answers from the cache, and the download finishes in the background for the next open.
  event.waitUntil(network.catch(() => {}));
  const cached = await cache.match(key);
  if (!cached) return network;
  const timeout = new Promise(resolve => setTimeout(() => resolve(cached), NETWORK_WAIT_MS));
  return Promise.race([network.catch(() => cached), timeout]);
}

async function fromCacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request.url);
  if (cached) return cached;
  const response = await fetch(request.url, {mode: "cors", credentials: "omit"});
  if (response.ok) await cache.put(request.url, response.clone());
  return response;
}
