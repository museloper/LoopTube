// LoopTube service worker — makes the app installable and lets the app
// shell open without a network. It only ever touches same-origin requests:
// YouTube (iframe, thumbnails, oEmbed) always goes straight to the network,
// both because playback can't work offline anyway and because caching
// YouTube responses would conflict with its terms (see CLAUDE.md).

const CACHE = "looptube-v1";
const MAX_STATIC_ENTRIES = 80;
// Scope ends with "/" — e.g. "https://museloper.github.io/LoopTube/".
const SCOPE = self.registration.scope;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(SCOPE)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Hashed build output never changes under the same URL: cache-first.
  if (url.pathname.includes("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) putInCache(request, res.clone(), true);
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else (pages, RSC payloads, icons, manifest): network-first
  // so a new deploy is picked up immediately and old HTML never points at
  // chunks that no longer exist. Offline, fall back to the cached copy, and
  // for page loads to the cached start page.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) putInCache(request, res.clone());
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        if (request.mode === "navigate") return (await caches.match(SCOPE)) ?? Response.error();
        return Response.error();
      }),
  );
});

async function putInCache(request, response, trim = false) {
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
  if (!trim) return;
  // Old deploys' chunks pile up under new hashes; drop the oldest ones.
  const keys = (await cache.keys()).filter((r) => r.url.includes("/_next/static/"));
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES))) {
    await cache.delete(old);
  }
}
