/* LifeVerse service worker — local-first offline shell.
 *
 * Strategy:
 *  - Navigations / HTML documents: NETWORK-FIRST. A redeploy ships new chunk
 *    hashes; serving a cached old shell would point at chunks that 404 →
 *    white screen / reload loop. Network-first means you always boot fresh,
 *    falling back to cache only when truly offline.
 *  - Hashed static assets: stale-while-revalidate (instant + self-updating).
 *  - Cross-origin (the AI proxy): never touched — network only.
 */
const CACHE = "lifeverse-v2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // drop every previous cache so an old shell can't survive an upgrade
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // proxy/CDN → network only

  const isDocument = req.mode === "navigate" || req.destination === "document";

  if (isDocument) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
