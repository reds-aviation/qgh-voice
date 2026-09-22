const cacheScope = new URL(self.registration.scope).pathname
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-|-$/g, '') || 'root';
const APP_VERSION = '__ATC_SUITE_VERSION__';
const CACHE_PREFIX = `reds-atc-suite-${cacheScope}-`;
const CACHE_NAME = `${CACHE_PREFIX}v${APP_VERSION}`;

// This explicit shell is the complete offline boundary. Session messages and
// review data are intentionally never written to Cache Storage.
const APP_SHELL = [
  './',
  './index.html',
  './instructor.html',
  './student.html',
  './suite.css',
  './suite-core.js',
  './suite-instructor.js',
  './suite-review.js',
  './suite-sensors.js',
  './suite-session.js',
  './suite-student.js',
  './simulator-core.js',
  './procedure-core.js',
  './fonts/ibm-plex-mono-500.ttf',
  './fonts/ibm-plex-sans-400.ttf',
  './fonts/ibm-plex-sans-600.ttf',
  './fonts/OFL-1.1.txt',
  './manifest.webmanifest',
  './app-version.json',
  './pwa-register.js',
  './pwa.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
];
const APP_SHELL_PATHS = new Set(
  APP_SHELL.map(asset => new URL(asset, self.registration.scope).pathname)
);
const PAGE_SHELL_PATHS = new Set(
  ['./', './index.html', './instructor.html', './student.html']
    .map(page => new URL(page, self.registration.scope).pathname)
);
let cachePromise;

function openCache() {
  cachePromise ??= caches.open(CACHE_NAME);
  return cachePromise;
}

function shellCacheKey(request) {
  if (request.method !== 'GET') return null;
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin || !APP_SHELL_PATHS.has(requestUrl.pathname)) return null;

  if (requestUrl.search) {
    const isCurrentVersionedAsset = !PAGE_SHELL_PATHS.has(requestUrl.pathname)
      && requestUrl.search === `?v=${APP_VERSION}`;
    if (!isCurrentVersionedAsset) return null;
  }

  return new Request(new URL(requestUrl.pathname, self.location.origin).href);
}

async function cachedShell(cacheKey) {
  return (await openCache()).match(cacheKey);
}

self.addEventListener('install', event => {
  event.waitUntil(openCache().then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map(name => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING' && event.source?.url?.startsWith(self.registration.scope)) {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const cacheKey = shellCacheKey(event.request);
  if (!cacheKey) return;

  const requestPath = new URL(event.request.url).pathname;
  if (PAGE_SHELL_PATHS.has(requestPath)) {
    event.respondWith((async () => {
      try {
        return await fetch(event.request);
      } catch {
        return (await cachedShell(cacheKey))
          || new Response('', { status: 504, statusText: 'Offline' });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cachedResponse = await cachedShell(cacheKey);
    if (cachedResponse) return cachedResponse;
    try {
      return await fetch(event.request);
    } catch {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
