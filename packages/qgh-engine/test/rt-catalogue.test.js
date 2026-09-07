'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Catalogue = require('../rt-catalogue.js');
const Voice = require('../voice-control.js');
const Radio = require('../radio-session.js');
const Procedure = require('../procedure-intent.js');
const Domain = require('../procedure-core.js');
const Media = require('../training-centre.js');
const options = { single: true, callsigns: ['Raven', 'Falcon', '430', '431'] };
function parse(phrase) {
  return Procedure.parse(phrase, options, Voice) || Radio.parseMessage(phrase, Voice, options) || Voice.parseCommand(phrase, options);
}
function contains(actual, expected, path = '') {
  for (const [key, value] of Object.entries(expected)) {
    if (value && typeof value === 'object') { assert.ok(actual?.[key] != null, path + key); contains(actual[key], value, path + key + '.'); }
    else assert.equal(actual?.[key], value, path + key);
  }
}
test('catalogue has unique IDs and complete learner-facing contracts', () => {
  assert.equal(new Set(Catalogue.entries.map(item => item.id)).size, Catalogue.entries.length);
  for (const entry of Catalogue.entries) for (const field of ['category', 'modes', 'canonicalPhrase', 'acceptedVariants', 'callsignRule', 'requiredState', 'parsedOutcome', 'simulatorEffect', 'pilotResponseClass', 'limitations', 'introducedVersion', 'dfBehavior', 'classification']) assert.ok(entry[field] != null, `${entry.id}: ${field}`);
});
for (const entry of Catalogue.entries) for (const phrase of [entry.canonicalPhrase, ...entry.acceptedVariants]) {
  test(`catalogue semantic contract: ${phrase}`, () => {
    const parsed = parse(phrase);
    assert.equal(parsed?.accepted, true, JSON.stringify(parsed));
    contains(parsed, entry.parsedOutcome);
  });
}
test('reports and preparation examples cannot become immediate manoeuvres', () => {
  contains(parse('report heading passing 065'), { intent: 'request-heading-passing', heading: 65 });
  contains(parse('stand by for left turn'), { intent: 'procedure-command', actions: [{ type: 'standby' }] });
  contains(parse('surface wind 230 degrees 10 knots'), { intent: 'procedure-command', actions: [{ type: 'weather' }] });
});
test('U/S catalogue never advertises heading clearances or heading reports', () => {
  const forbidden = new Set(['normal-turn-heading', 'continue-turn-heading', 'report-heading', 'request-heading-passing']);
  for (const entry of Catalogue.entries.filter(item => item.modes.includes('us'))) assert.ok(!forbidden.has(entry.parsedOutcome.intent), entry.id);
  const rate = Catalogue.entries.find(entry => entry.id === 'turn-rate');
  assert.match(rate.requiredState, /setup/i);
  assert.equal(rate.pilotResponseClass, 'NONE');
});
test('Tactical examples retain the addressed numerical callsign and expected intent', () => {
  const tactical = { ...options, single: false };
  const local = new Set(['set-bearing-mode', 'clock', 'advance-flight']);
  for (const entry of Catalogue.entries.filter(item => item.modes.includes('tactical') && !local.has(item.parsedOutcome.intent))) {
    const phrase = entry.canonicalPhrase.replace(/^Raven /, '');
    const addressed = `430 ${phrase}`;
    const parsed = Procedure.parse(addressed, tactical, Voice) || Radio.parseMessage(addressed, Voice, tactical) || Voice.parseCommand(addressed, tactical);
    assert.equal(parsed?.accepted, true, `${entry.id}: ${JSON.stringify(parsed)}`);
    assert.equal(parsed.aircraft, '430', entry.id);
    const expected = { ...entry.parsedOutcome, aircraft: '430' };
    if (expected.intent === 'set-field') expected.intent = 'set-aircraft-field';
    contains(parsed, expected, entry.id + '.');
  }
});
test('procedure catalogue response classes match applied runtime outcomes', () => {
  for (const entry of Catalogue.entries.filter(item => item.parsedOutcome.intent === 'procedure-command')) {
    const state = Domain.create({ aircraft: [{ id: 'single', callsign: '430', level: 10000 }] });
    if (entry.id === 'reaching-level') Domain.apply(state, parse('climb to 12000 feet'));
    const outcome = Domain.apply(state, parse(entry.canonicalPhrase), { geometry: { range: 10, heading: 230, inbound: 230, phase: 'inbound' } });
    assert.equal(outcome.authorization, 'AUTHORIZED', `${entry.id}: ${JSON.stringify(outcome)}`);
    assert.equal(outcome.response.kind, entry.pilotResponseClass, entry.id);
    if (entry.classification === 'REPORT ARMED') assert.equal(outcome.executionStatus, 'ARMED', entry.id);
    if (entry.classification.startsWith('RECEIVED')) assert.equal(outcome.executionStatus, 'RECEIVED', entry.id);
    if (entry.classification.startsWith('STANDBY')) assert.equal(outcome.executionStatus, 'DEFERRED', entry.id);
  }
});

const mediaRules = Media.policy('https://example.test/qgh-voice/training-centre.html', '5.0.0');
const clip = { id: 'basics', version: '5.0.0', bytes: 4, src: 'training-media/basics.mp4', captions: 'training-media/basics.vtt', transcript: 'training-media/basics.txt' };
function memoryCache(failPut = () => false) {
  const entries = new Map();
  return { entries, async match(key) { return entries.get(key)?.clone(); }, async put(key, value) { if (failPut(key)) throw new Error('quota'); entries.set(key, value.clone()); }, async delete(key) { return entries.delete(key); } };
}
function fixtureFetch(url) {
  const [body, type] = url.endsWith('.mp4') ? ['film', 'video/mp4'] : url.endsWith('.vtt') ? ['WEBVTT', 'text/vtt'] : ['Transcript', 'text/plain'];
  return Promise.resolve(new Response(body, { headers: { 'Content-Type': type, 'Content-Length': String(body.length) } }));
}
test('optional-video policy isolates site paths, versions and allowed resources', () => {
  const other = Media.policy('https://example.test/another-app/training-centre.html', '5.0.0');
  assert.notEqual(mediaRules.cacheName, other.cacheName);
  assert.equal(mediaRules.oldCache(mediaRules.prefix + '4.4.9-1'), true);
  assert.equal(mediaRules.oldCache(mediaRules.cacheName), false);
  assert.equal(mediaRules.oldCache(other.prefix + '4.4.9-1'), false);
  for (const path of ['https://evil.test/training-media/a.mp4', '../training-media/a.mp4', 'single.html', 'training-media/../single.html', 'training-media/%2e%2e/secret.mp4', 'training-media/a%2fb.mp4', 'training-media/a.mp4?copy=1', 'training-media/a.js', 'data:video/mp4;base64,AAAA']) assert.throws(() => mediaRules.url(path, 'src'), path);
  assert.equal(mediaRules.url(clip.src, 'src'), 'https://example.test/qgh-voice/training-media/basics.mp4');
  assert.throws(() => mediaRules.resources({ ...clip, bytes: Media.limits.src + 1 }));
  assert.throws(() => mediaRules.resources({ ...clip, version: '4.4.9-1' }));
});
test('only a complete verified media set is available offline', async () => {
  const cache = memoryCache();
  for (const file of mediaRules.resources(clip)) await cache.put(file.url, await fixtureFetch(file.url));
  assert.equal(await Media.cachedClip(cache, mediaRules, clip), null, 'files alone must not count as completed');
  await Media.saveClip(cache, mediaRules, clip, fixtureFetch);
  assert.equal((await Media.cachedClip(cache, mediaRules, clip)).size, 3);
  await cache.delete(mediaRules.url(clip.captions, 'captions'));
  assert.equal(await Media.cachedClip(cache, mediaRules, clip), null);
});
test('quota failure cannot leave a completed offline flag', async () => {
  const cache = memoryCache(key => key.endsWith('.vtt'));
  await assert.rejects(Media.saveClip(cache, mediaRules, clip, fixtureFetch), /quota/);
  assert.equal(await cache.match(mediaRules.marker(clip)), undefined);
  assert.equal(await Media.cachedClip(cache, mediaRules, clip), null);
  assert.equal(cache.entries.size, 0);
});
test('oversized, truncated, redirected and wrong-type resources cannot be cached', async () => {
  const resource = mediaRules.resources(clip)[0];
  await assert.rejects(Media.readBounded(new Response('too large', { headers: { 'Content-Type': 'video/mp4' } }), resource), /size/);
  await assert.rejects(Media.readBounded(new Response('bad', { headers: { 'Content-Type': 'video/mp4' } }), resource), /Incomplete/);
  await assert.rejects(Media.readBounded(new Response('film', { headers: { 'Content-Type': 'text/html' } }), resource), /format/);
  const redirected = new Response('film', { headers: { 'Content-Type': 'video/mp4' } });
  Object.defineProperty(redirected, 'redirected', { value: true });
  await assert.rejects(Media.readBounded(redirected, resource), /failed/);
  const cache = memoryCache();
  await assert.rejects(Media.saveClip(cache, mediaRules, clip, () => Promise.resolve(new Response('too large', { headers: { 'Content-Type': 'video/mp4' } }))), /size/);
  assert.equal(await Media.cachedClip(cache, mediaRules, clip), null);
});
test('declared oversized download is cancelled before consuming the body', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  const response = new Response(stream, { headers: { 'Content-Type': 'video/mp4', 'Content-Length': '999' } });
  await assert.rejects(Media.readBounded(response, mediaRules.resources(clip)[0]), /size/);
  assert.equal(cancelled, true);
});
test('decompressed caption limits do not confuse encoded content length with plain text length', async () => {
  const resource = mediaRules.resources(clip).find(file => file.kind === 'captions');
  const response = new Response('WEBVTT\n\n', { headers: { 'Content-Type': 'text/vtt', 'Content-Length': '4', 'Content-Encoding': 'gzip' } });
  assert.equal((await Media.readBounded(response, resource)).size, 8);
});
