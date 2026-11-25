/* MINI ClassIsland SPA Service Worker */
const APP_VERSION = "__APP_VERSION__";
const APP_CACHE = `mci-app-${APP_VERSION}`;
const IMMUTABLE_CACHE = "mci-immutable-v1";
const FONT_CACHE = "mci-fonts-v1";

const FONT_EXT_RE = /\.(woff2?|ttf|otf|eot)(\?.*)?$/i;

function isNextHashedAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

function isFontAsset(url, request) {
  return (
    url.pathname.startsWith("/fonts/") ||
    FONT_EXT_RE.test(url.pathname) ||
    (request && request.destination === "font")
  );
}

function isBypassPath(url) {
  return (
    url.pathname === "/version.json" ||
    url.pathname === "/asset-manifest.json" ||
    url.pathname === "/worker.js" ||
    url.pathname.startsWith("/api/")
  );
}

async function cacheAssetUrl(assetPath) {
  const url = new URL(assetPath, self.location.origin);
  const targetCacheName = isFontAsset(url)
    ? FONT_CACHE
    : isNextHashedAsset(url)
      ? IMMUTABLE_CACHE
      : APP_CACHE;

  const cache = await caches.open(targetCacheName);
  const existing = await cache.match(url.href);
  if (existing) return;

  try {
    const resp = await fetch(url.href, {
      credentials: "same-origin",
      cache: isNextHashedAsset(url) || isFontAsset(url) ? "force-cache" : "no-cache",
    });
    if (resp && resp.ok) {
      await cache.put(url.href, resp);
    }
  } catch {
    // Ignore individual precache failures so install still succeeds
  }
}

let precacheInFlight = null;
let precachedVersion = null;

async function broadcastProgress(payload) {
  try {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ type: "PRECACHE_PROGRESS", ...payload });
    }
  } catch {
    // Ignore broadcast errors
  }
}

async function precacheAllAssets() {
  if (precachedVersion === APP_VERSION) {
    await broadcastProgress({ status: "done", completed: 1, total: 1, percent: 100 });
    return;
  }
  if (precacheInFlight) {
    return precacheInFlight;
  }

  precacheInFlight = (async () => {
    try {
      const resp = await fetch("/asset-manifest.json", { cache: "no-store" });
      if (!resp.ok) {
        await broadcastProgress({ status: "done", completed: 0, total: 0, percent: 100 });
        return;
      }
      const manifest = await resp.json();
      const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
      const total = assets.length;
      if (total === 0) {
        precachedVersion = APP_VERSION;
        await broadcastProgress({ status: "done", completed: 0, total: 0, percent: 100 });
        return;
      }

      let completed = 0;
      let lastPercent = -1;
      await broadcastProgress({ status: "updating", completed: 0, total, percent: 0 });

      const concurrency = 8;
      for (let i = 0; i < assets.length; i += concurrency) {
        const batch = assets.slice(i, i + concurrency);
        await Promise.all(
          batch.map(async (asset) => {
            await cacheAssetUrl(asset);
            completed += 1;
            const percent = Math.min(99, Math.round((completed / total) * 100));
            if (percent !== lastPercent) {
              lastPercent = percent;
              await broadcastProgress({ status: "updating", completed, total, percent });
            }
          })
        );
      }

      precachedVersion = APP_VERSION;
      await broadcastProgress({ status: "done", completed: total, total, percent: 100 });
    } catch {
      await broadcastProgress({ status: "done", completed: 0, total: 0, percent: 100 });
    } finally {
      precacheInFlight = null;
    }
  })();

  return precacheInFlight;
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (
              key.startsWith("mci-app-") &&
              key !== APP_CACHE
            ) {
              return caches.delete(key);
            }
            return Promise.resolve(false);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "GET_VERSION") {
    event.ports?.[0]?.postMessage({ version: APP_VERSION });
  } else if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (event.data && event.data.type === "START_PRECACHE") {
    event.waitUntil(precacheAllAssets());
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Fonts: always serve from permanent font cache once downloaded
  if (isFontAsset(url, request)) {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const resp = await fetch(request);
        if (resp && resp.ok) {
          cache.put(request, resp.clone());
        }
        return resp;
      })
    );
    return;
  }

  // Only handle same-origin requests for app and Next.js assets
  if (url.origin !== self.location.origin) return;
  if (isBypassPath(url)) return;

  // Next.js hash-tracked unique files: always serve from permanent immutable cache
  if (isNextHashedAsset(url)) {
    event.respondWith(
      caches.open(IMMUTABLE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const resp = await fetch(request);
        if (resp && resp.ok) {
          cache.put(request, resp.clone());
        }
        return resp;
      })
    );
    return;
  }

  // All other same-origin resources: cache-first when version has not changed
  event.respondWith(
    caches.open(APP_CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
      if (cached) return cached;

      if (request.mode === "navigate") {
        const cleanPath = url.pathname.endsWith("/")
          ? `${url.pathname}index.html`
          : `${url.pathname}.html`;
        const htmlCached =
          (await cache.match(new URL(cleanPath, self.location.origin).href)) ||
          (await cache.match(new URL("/index.html", self.location.origin).href)) ||
          (await cache.match(new URL("/", self.location.origin).href));
        if (htmlCached) return htmlCached;
      }

      const resp = await fetch(request);
      if (resp && resp.ok) {
        cache.put(request, resp.clone());
      }
      return resp;
    })
  );
});
