/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

const cacheScope = new URL(self.registration.scope).pathname
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-|-$/g, '') || 'root';
const APP_VERSION = '__ATC_SUITE_VERSION__';
const CACHE_PREFIX = `reds-atc-suite-${cacheScope}-`;
const CACHE_NAME = `${CACHE_PREFIX}v${APP_VERSION}`;
const VOICE_PACK_URLS = [
  './voice-models/qgh-vosk-en-us-small-0.15.tar.gz',
  './vendor/vosk-browser-0.0.8.js',
].map(asset => new URL(asset, self.registration.scope).href);

// This explicit shell is the complete offline boundary. Session messages and
// review data are intentionally never written to Cache Storage.
const APP_SHELL = [
  './ats-simbox-logo.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './LICENSE.txt',
  './COPYRIGHT.txt',
  './MIT-legacy.txt',
  './THIRD_PARTY_NOTICES.txt',
  './license-footer.css',
  './meeting-room.js',
  './',
  './index.html',
  './instructor.html',
  './student.html',
  './training-guide.html',
  './suite-command-reference.js',
  './suite.css',
  './suite-entry.js',
  './suite-entry.css',
  './suite-core.js',
  './suite-display.js',
  './suite-instructor.js',
  './suite-review.js',
  './suite-sensors.js',
  './suite-session.js',
  './suite-cloud.js',
  './remote-service.js',
  './remote-config.js',
  './suite-student.js',
  './suite-controller-voice.js',
  './suite-controller-voice.css',
  './rt-intent-model.js',
  './voice-control.js',
  './offline-voice-engine.js',
  './student-plotting.js',
  './student-plotting.css',
  './workspace-shell.js',
  './workspace-shell.css',
  './setup-loading.js',
  './setup-loading.css',
  './suryakiran-formation.webp',
  './simulator-core.js',
  './scope-visuals.js',
  './published-boundaries.js',
  './published-airspace.js',
  './published-airspace.css',
  './india-airbase-lfa-catalogue.json',
  './india-airspace.json',
  './india-aip-enroute.json',
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
  ['./', './index.html', './instructor.html', './student.html', './training-guide.html']
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

  // The entry form opens these exact local desks. Reuse only their static HTML;
  // the PIN and all session state remain outside the shell cache.
  if (request.mode === 'navigate' && requestUrl.searchParams.get('connection') === 'local') {
    const params = requestUrl.searchParams;
    const hostPage = new URL('instructor.html', self.registration.scope);
    const studentPage = new URL('student.html', self.registration.scope);
    if (requestUrl.pathname === hostPage.pathname && params.size === 1) return new Request(hostPage);
    if (requestUrl.pathname === studentPage.pathname && params.size === 3
      && params.get('join') === '1' && /^\d{6}$/.test(params.get('pin') || '')) return new Request(studentPage);
  }

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
  if (event.data?.type === 'OFFLINE_SHELL_STATUS' && event.ports?.length) {
    const clientURL = event.source?.url;
    const suiteHome = new URL('../', self.registration.scope).href;
    if (!clientURL || !clientURL.startsWith(self.registration.scope)
      && clientURL !== suiteHome && clientURL !== new URL('index.html', suiteHome).href) return;
    const reply = event.ports[0];
    event.waitUntil((async () => {
      try {
        const cache = await openCache();
        const requests = APP_SHELL.map(asset => new Request(new URL(asset, self.registration.scope), { cache: 'reload' }));
        const contents = await Promise.all(requests.map(request => cache.match(request)));
        const missing = requests.filter((_, i) => !contents[i]);
        if (event.data.repair === true && missing.length) await cache.addAll(missing);
        reply.postMessage({ ready: !missing.length || event.data.repair === true });
      } catch {
        reply.postMessage({ ready: false });
      }
    })());
  }
  if (event.data?.type === 'SKIP_WAITING' && event.source?.url?.startsWith(self.registration.scope)) {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method === 'GET' && VOICE_PACK_URLS.includes(event.request.url)) {
    event.respondWith((async () => {
      const cache = await caches.open('qgh-offline-voice-pack-v1');
      const cached = await cache.match(event.request);
      if (cached) return cached;
      try {
        return await fetch(event.request);
      } catch {
        return new Response('', { status: 504, statusText: 'Offline voice pack unavailable' });
      }
    })());
    return;
  }
  const cacheKey = shellCacheKey(event.request);
  if (!cacheKey) return;

  // Revalidate installed-app identity without replacing the active exercise.
  if (cacheKey.url === new URL('./manifest.webmanifest', self.registration.scope).href) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: 'no-cache' });
        if (response.ok) return response;
      } catch { /* Use the installed manifest when offline. */ }
      return (await cachedShell(cacheKey)) || new Response('', { status: 504, statusText: 'Offline manifest unavailable' });
    })());
    return;
  }

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
