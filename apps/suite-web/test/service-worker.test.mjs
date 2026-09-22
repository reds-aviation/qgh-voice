import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const repositoryRoot = resolve(import.meta.dirname, '..', '..', '..');
const staticRoot = resolve(repositoryRoot, 'apps', 'suite-web', 'static');
const workerTemplate = readFileSync(resolve(staticRoot, 'service-worker.js'), 'utf8');
const registrationSource = readFileSync(resolve(staticRoot, 'pwa-register.js'), 'utf8');
const scope = 'https://training.example/atc-suite/';

function createWorkerHarness({ cachedResponse = null, cacheNames = [], networkFails = false } = {}) {
  const handlers = new Map();
  const calls = { addAll: [], deleted: [], match: [], skipWaiting: 0 };
  const cache = {
    addAll: async paths => { calls.addAll.push([...paths]); },
    match: async request => {
      calls.match.push(request.url);
      return cachedResponse?.clone() || null;
    },
  };
  const self = {
    location: new URL(`${scope}service-worker.js`),
    registration: { scope },
    clients: { claim: async () => {} },
    addEventListener: (type, handler) => handlers.set(type, handler),
    skipWaiting: () => { calls.skipWaiting += 1; },
  };

  runInNewContext(workerTemplate.replaceAll('__ATC_SUITE_VERSION__', '0.1.0'), {
    URL,
    Request,
    Response,
    Set,
    Promise,
    caches: {
      open: async () => cache,
      keys: async () => cacheNames,
      delete: async name => {
        calls.deleted.push(name);
        return true;
      },
    },
    fetch: async () => {
      if (networkFails) throw new TypeError('offline');
      return new Response('network');
    },
    self,
  }, { filename: 'service-worker.js' });

  return { calls, handlers };
}

test('install precaches the complete local two-tab shell', async () => {
  const harness = createWorkerHarness();
  let installation;
  harness.handlers.get('install')({ waitUntil: value => { installation = value; } });
  await installation;

  assert.equal(harness.calls.addAll.length, 1);
  const shell = harness.calls.addAll[0];
  const expectedShell = [
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
  assert.deepEqual(shell, expectedShell);
  assert.equal(harness.calls.skipWaiting, 0, 'install never replaces an active session automatically');
});

test('offline navigation and versioned assets use only the approved shell cache', async () => {
  const cached = new Response('offline shell');
  const harness = createWorkerHarness({ cachedResponse: cached, networkFails: true });

  let navigation;
  harness.handlers.get('fetch')({
    request: new Request(`${scope}instructor.html`, { headers: { accept: 'text/html' } }),
    respondWith: value => { navigation = value; },
  });
  assert.equal(await (await navigation).text(), 'offline shell');

  let asset;
  harness.handlers.get('fetch')({
    request: new Request(`${scope}suite-session.js?v=0.1.0`),
    respondWith: value => { asset = value; },
  });
  assert.equal(await (await asset).text(), 'offline shell');
  assert.deepEqual(harness.calls.match, [
    `${scope}instructor.html`,
    `${scope}suite-session.js`,
  ]);

  let privateResponse;
  harness.handlers.get('fetch')({
    request: new Request(`${scope}private-session.json`),
    respondWith: value => { privateResponse = value; },
  });
  assert.equal(privateResponse, undefined, 'non-shell session data is never intercepted or cached');
});

test('query-tainted, wrong-version, cross-origin and non-GET requests bypass the worker', () => {
  const harness = createWorkerHarness();
  const requests = [
    new Request(`${scope}instructor.html?session=123456`),
    new Request(`${scope}suite-session.js?v=0.0.9`),
    new Request('https://other.example/atc-suite/suite.css?v=0.1.0'),
    new Request(`${scope}student.html`, { method: 'POST' }),
  ];
  for (const request of requests) {
    let response;
    harness.handlers.get('fetch')({ request, respondWith: value => { response = value; } });
    assert.equal(response, undefined, `${request.method} ${request.url} is not intercepted`);
  }
  assert.deepEqual(harness.calls.match, []);
});

test('activation removes only earlier ATC suite generations', async () => {
  const harness = createWorkerHarness({
    cacheNames: [
      'reds-atc-suite-atc-suite-v0.0.9',
      'reds-atc-suite-atc-suite-v0.1.0',
      'qgh-simulator-atc-suite-v5.0.4',
      'another-app-v1',
    ],
  });
  let activation;
  harness.handlers.get('activate')({ waitUntil: value => { activation = value; } });
  await activation;
  assert.deepEqual(harness.calls.deleted, ['reds-atc-suite-atc-suite-v0.0.9']);
});

test('waiting updates remain paused while a local session is active', async () => {
  const serviceWorkerListeners = new Map();
  const windowListeners = new Map();
  let activeSession = true;
  let clickUpdate;
  let postCount = 0;
  let reloadCount = 0;
  const copy = { textContent: '' };
  const button = { addEventListener: (_type, listener) => { clickUpdate = listener; } };
  const notice = {
    className: '',
    setAttribute: () => {},
    set innerHTML(_value) {},
    querySelector: selector => selector === 'button' ? button : copy,
  };
  const waiting = { postMessage: () => { postCount += 1; } };
  const registration = {
    waiting,
    installing: null,
    addEventListener: () => {},
    update: async () => {},
  };
  const document = {
    body: { append: () => {} },
    visibilityState: 'visible',
    createElement: () => notice,
    addEventListener: () => {},
    querySelector: selector => selector.includes('#activeWorkspace') && activeSession ? {} : null,
  };
  const window = {
    addEventListener: (type, listener) => windowListeners.set(type, listener),
    location: { reload: () => { reloadCount += 1; } },
  };
  const navigator = {
    serviceWorker: {
      controller: {},
      ready: Promise.resolve(registration),
      register: async () => registration,
      addEventListener: (type, listener) => serviceWorkerListeners.set(type, listener),
    },
  };

  runInNewContext(registrationSource, {
    document,
    location: { protocol: 'https:' },
    navigator,
    window,
  }, { filename: 'pwa-register.js' });

  await windowListeners.get('load')();
  assert.equal(typeof clickUpdate, 'function');
  clickUpdate();
  assert.equal(postCount, 0, 'active instructor or student sessions are not interrupted');
  assert.match(copy.textContent, /active local session/i);

  activeSession = false;
  clickUpdate();
  assert.equal(postCount, 1);
  serviceWorkerListeners.get('controllerchange')();
  assert.equal(reloadCount, 1, 'reload occurs only after the user accepts a safe update');
});

test('skip-waiting messages are accepted only from this suite scope', () => {
  const harness = createWorkerHarness();
  const message = harness.handlers.get('message');
  message({ data: { type: 'SKIP_WAITING' }, source: { url: 'https://training.example/other/' } });
  assert.equal(harness.calls.skipWaiting, 0);
  message({ data: { type: 'SKIP_WAITING' }, source: { url: `${scope}instructor.html` } });
  assert.equal(harness.calls.skipWaiting, 1);
});

test('suite cache and manifest identities cannot collide with the QGH PWA', () => {
  const manifest = JSON.parse(readFileSync(resolve(staticRoot, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'Reds ATC Training Suite');
  assert.equal(manifest.short_name, 'Reds ATC');
  assert.equal(manifest.id, './reds-atc-training-suite');
  assert.match(workerTemplate, /reds-atc-suite-/);
  assert.doesNotMatch(workerTemplate, /qgh-simulator-/);
});
