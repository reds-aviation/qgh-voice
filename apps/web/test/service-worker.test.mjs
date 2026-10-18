/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const repositoryRoot = resolve(import.meta.dirname, '..', '..', '..');
const workerTemplate = readFileSync(resolve(repositoryRoot, 'apps', 'web', 'static', 'service-worker.js'), 'utf8');
const scope = 'https://qgh.example/simulator/';

function createWorkerHarness({ cachedResponse = null, cacheNames = [], version = '4.0.2', networkFails = false, networkStatus = 200 } = {}) {
  const handlers = new Map();
  const cacheCalls = { deleted: [], match: [], put: 0, fetchOptions: [] };
  let networkCalls = 0;
  const cache = {
    addAll: async () => {},
    match: async request => {
      cacheCalls.match.push(request.url);
      return cachedResponse;
    },
    put: async () => { cacheCalls.put += 1; },
  };
  const self = {
    location: new URL(`${scope}service-worker.js`),
    registration: { scope },
    clients: { claim: async () => {} },
    addEventListener: (type, handler) => handlers.set(type, handler),
    skipWaiting: () => {},
  };

  runInNewContext(workerTemplate.replaceAll('__QGH_VERSION__', version), {
    URL,
    Request,
    Response,
    Set,
    Promise,
    caches: {
      open: async () => cache,
      keys: async () => cacheNames,
      delete: async name => {
        cacheCalls.deleted.push(name);
        return true;
      },
    },
    fetch: async (_request, options) => {
      networkCalls += 1;
      cacheCalls.fetchOptions.push(options);
      if (networkFails) throw new TypeError('offline');
      return new Response('network', {status: networkStatus});
    },
    self,
  }, { filename: 'service-worker.js' });

  return {
    cacheCalls,
    activateHandler: handlers.get('activate'),
    fetchHandler: handlers.get('fetch'),
    networkCalls: () => networkCalls,
  };
}

test('service worker ignores unapproved same-origin requests', () => {
  const harness = createWorkerHarness();
  for (const url of [
    `${scope}private-export.csv?exercise=1`,
    `${scope}single.html?exercise=1`,
    `${scope}simulator.js?token=example`,
    `${scope}simulator.js?v=4.0.2&token=example`,
    `${scope}simulator.js?v=4.0.3`,
    `${scope}simulator.js?v=4.0.3&release=4.0.3`,
    `${scope}simulator.js?v=4.0.2&release=4.0.3`,
    `${scope}simulator.js?v=4.0.2&release=4.0.2&token=example`,
  ]) {
    let responsePromise;
    harness.fetchHandler({
      request: new Request(url),
      respondWith: value => { responsePromise = value; },
    });
    assert.equal(responsePromise, undefined, `${url} is not intercepted`);
  }

  assert.deepEqual(harness.cacheCalls.match, [], 'unapproved content is not read from the shell cache');
  assert.equal(harness.cacheCalls.put, 0, 'unapproved content is never written to Cache Storage');
  assert.equal(harness.networkCalls(), 0, 'the worker does not proxy unapproved content');
});

test('service worker serves a versioned approved shell asset from the named cache', async () => {
  const harness = createWorkerHarness({ cachedResponse: new Response('cached shell') });
  let responsePromise;
  harness.fetchHandler({
    request: new Request(`${scope}simulator.js?v=4.0.2`),
    respondWith: value => { responsePromise = value; },
  });

  const response = await responsePromise;
  assert.equal(await response.text(), 'cached shell');
  assert.deepEqual(harness.cacheCalls.match, [`${scope}simulator.js`], 'query variants use the canonical approved shell key');
  assert.equal(harness.cacheCalls.put, 0, 'runtime responses are never written to Cache Storage');
  assert.equal(harness.networkCalls(), 0, 'an approved cached asset remains available offline');
});

test('installed-app manifest revalidates online without overwriting the offline shell', async () => {
  const harness = createWorkerHarness({ cachedResponse: new Response('old manifest') });
  let reply;
  harness.fetchHandler({request: new Request(`${scope}manifest.webmanifest`), respondWith: value => {reply = value;}});
  assert.equal(await (await reply).text(), 'network');
  assert.equal(harness.networkCalls(), 1);
  assert.equal(harness.cacheCalls.fetchOptions[0].cache, 'no-cache');
  assert.deepEqual(harness.cacheCalls.match, []);
  assert.equal(harness.cacheCalls.put, 0);
});

test('installed-app manifest keeps its offline fallback on connection and HTTP errors', async () => {
  for (const failure of [{networkFails: true}, {networkStatus: 503}]) {
    const harness = createWorkerHarness({...failure, cachedResponse: new Response('offline manifest')});
    let reply;
    harness.fetchHandler({request: new Request(`${scope}manifest.webmanifest`), respondWith: value => {reply = value;}});
    assert.equal(await (await reply).text(), 'offline manifest');
    assert.deepEqual(harness.cacheCalls.match, [`${scope}manifest.webmanifest`]);
    assert.equal(harness.cacheCalls.put, 0);
  }
});

test('service worker serves release-qualified current assets offline', async () => {
  const harness = createWorkerHarness({ cachedResponse: new Response('current release') });
  let responsePromise;
  harness.fetchHandler({
    request: new Request(`${scope}headphone-consent.js?v=4.0.2&release=4.0.2`),
    respondWith: value => { responsePromise = value; },
  });
  assert.equal(await (await responsePromise).text(), 'current release');
  assert.deepEqual(harness.cacheCalls.match, [`${scope}headphone-consent.js`]);
  assert.equal(harness.networkCalls(), 0);
});

test('shared scope graphics remain available in the approved offline shell', async () => {
  const harness = createWorkerHarness({cachedResponse:new Response('scope graphics')});
  let response;
  harness.fetchHandler({request:new Request(`${scope}scope-visuals.js?v=4.0.2&release=4.0.2`),respondWith:value=>{response=value;}});
  assert.equal(await (await response).text(),'scope graphics');
  assert.deepEqual(harness.cacheCalls.match,[`${scope}scope-visuals.js`]);
  assert.equal(harness.networkCalls(),0);
});

test('service worker clears only its scoped cache generation and the known legacy cache', async () => {
  const harness = createWorkerHarness({
    cacheNames: [
      'qgh-simulator-v4.0.1',
      'qgh-simulator-other-v4.0.1',
      'qgh-simulator-simulator-v4.0.1',
      'qgh-simulator-simulator-v4.0.2',
    ],
  });
  let activation;
  harness.activateHandler({ waitUntil: value => { activation = value; } });
  await activation;

  assert.deepEqual(
    harness.cacheCalls.deleted.sort(),
    ['qgh-simulator-simulator-v4.0.1', 'qgh-simulator-v4.0.1'],
    'unrelated same-origin cache names are retained'
  );
});

test('v4.4.9.1 to v5 upgrade removes only prior shell and serves current headphone controls offline', async () => {
  const source = readFileSync(resolve(repositoryRoot, 'packages/qgh-engine/headphone-consent.js'), 'utf8');
  assert.match(source, /100/); assert.match(source, /130/); assert.match(source, /170/);
  assert.doesNotMatch(source, /300 WPM|450 WPM/);
  const harness = createWorkerHarness({version:'5.0.0',cachedResponse:new Response(source),cacheNames:[
    'qgh-simulator-simulator-v4.4.9-1','qgh-simulator-simulator-v5.0.0','qgh-training-videos:other:4.4.9-1','qgh-pilot-voices-v1'
  ]});
  let activation;
  harness.activateHandler({waitUntil:value=>{activation=value;}}); await activation;
  assert.deepEqual(harness.cacheCalls.deleted,['qgh-simulator-simulator-v4.4.9-1']);
  let reply;
  harness.fetchHandler({request:new Request(`${scope}headphone-consent.js?v=5.0.0&release=5.0.0`),respondWith:value=>{reply=value;}});
  assert.equal(await (await reply).text(),source);
  assert.equal(harness.networkCalls(),0);
  let oldResponse;
  harness.fetchHandler({request:new Request(`${scope}headphone-consent.js?v=4.4.9-1&release=4.4.9-1`),respondWith:value=>{oldResponse=value;}});
  assert.equal(oldResponse,undefined,'old release request is never answered with an incompatible new script');
});

test('contextual guide links use cacheable hash routes offline', async () => {
  const workspace = readFileSync(resolve(repositoryRoot,'packages/qgh-engine/procedure-workspace.js'),'utf8');
  assert.doesNotMatch(workspace,/training-centre\.html\?/);
  const harness = createWorkerHarness({version:'5.0.0',cachedResponse:new Response('offline guide')});
  let reply;
  harness.fetchHandler({request:new Request(`${scope}training-centre.html#level`),respondWith:value=>{reply=value;}});
  assert.equal(await (await reply).text(),'offline guide');
  assert.equal(harness.networkCalls(),0);
});
