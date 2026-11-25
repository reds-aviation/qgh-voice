/* ATS SIM BOX · Copyright 2026 Balaram Reddy. Common Public Attribution License 1.0. */
'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {randomUUID} = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../suite-controller-voice.js'), 'utf8');

function fixture(extras = {}) {
  const document = new EventTarget();
  class Element extends EventTarget {
    children = [];
    ownerDocument = document;
    classList = {add() {}};
    append(element) { this.children.push(element); }
    setAttribute() {}
    focus() {}
    setPointerCapture() {}
    remove() {}
  }
  document.createElement = () => new Element();
  const container = new Element();
  const sent = [], timers = new Set(), target = new EventTarget();
  let captured = null, ended = null, failSend = false, started = false;
  const state = {enabled: true, running: true, mode: 'automatic', exerciseId: 'one', runKey: 'current'};
  const engine = { cancel() { ended({finalDrained: false}); }, async prepare() {}, stop() {},
    async start(callbacks) { captured = callbacks; started = true; callbacks.onStarted(); } };
  const scope = { ...extras, document, crypto: {randomUUID}, AbortController,
    addEventListener: target.addEventListener.bind(target), clearTimeout(timer) { timers.delete(timer); },
    setTimeout(fn, delay) { const timer = {fn, delay}; timers.add(timer); return timer; },
    QGHOfflineVoiceEngine: {supportsOfflineVoice: () => true, hasCachedArchive: async () => false,
      create(options) { ended = options.onEnded; return engine; } }
  };
  vm.runInNewContext(source, scope);
  const panel = scope.SuiteControllerVoice.mount(container, {context: () => state,
    send(call) { sent.push(call); return !failSend; }});
  const element = name => container.children.find(el => el.className === 'scv-' + name);
  function input(type, fields) {
    const event = new Event(type, {cancelable: true});
    Object.assign(event, fields); element('talk').dispatchEvent(event);
  }
  return {state, panel, container, element, engine, target, sent, timers,
    set failSend(value) { failSend = value; }, get started() { return started; },
    get callbacks() { return captured; },
    async prepare() {
      element('setup').dispatchEvent(new Event('click'));
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(element('talk').disabled, false);
    },
    down() { input('pointerdown', {pointerId: 1, isPrimary: true, button: 0}); },
    up() { input('pointerup', {pointerId: 1}); },
    key(type, key = ' ') { input(type, {key}); },
    end(drained = true) { return ended({finalDrained: drained}); } };
}

test('one addressed transaction is sent after release and final drain with all segments retained', async () => {
  const f = fixture();
  assert.equal(f.started, false);
  await f.prepare(); f.down();
  f.callbacks.onResult('one zero one turn right');
  assert.equal(f.sent.length, 0);
  f.up(); assert.equal(f.sent.length, 0);
  f.callbacks.onResult('heading two six zero');
  await f.end(); await f.end();
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].transcript, 'one zero one turn right heading two six zero');
  assert.equal(f.panel.acknowledge({requestId: 'foreign', text: 'Moved'}), false);
  assert.match(f.element('status').textContent, /Waiting/);
  f.panel.acknowledge({requestId: f.sent[0].requestId, message: 'Heading applied'});
  assert.equal(f.element('status').textContent, 'Heading applied');
  assert.equal(f.element('heard').textContent, 'Heard: one zero one turn right heading two six zero');
});

test('unrecognised segments, partial drain, room changes and loss of focus never submit a fragment', async () => {
  for (const failure of ['unknown', 'missing-drain', 'mode', 'runKey', 'exerciseId', 'focus', 'disabled', 'stopped']) {
    const f = fixture(); await f.prepare(); f.down(); f.callbacks.onResult('one zero one turn right two six zero');
    if (failure === 'unknown') f.callbacks.onUnrecognizedSegment();
    if (failure === 'focus') f.target.dispatchEvent(new Event('blur'));
    if (failure === 'mode') f.state.mode = 'human';
    if (failure === 'disabled') f.state.enabled = false;
    if (failure === 'stopped') f.state.running = false;
    if (failure === 'runKey' || failure === 'exerciseId') f.state[failure] = 'new';
    f.panel.refresh(); f.up(); await f.end(failure !== 'missing-drain');
    assert.equal(f.sent.length, 0, failure);
  }
});

test('keyboard PTT, expired acknowledgement, denied microphone and disconnected submissions are recoverable', async () => {
  const f = fixture(); await f.prepare();
  f.key('keydown'); f.callbacks.onError('not-allowed'); f.key('keyup'); await f.end();
  assert.match(f.element('status').textContent, /Allow microphone/);
  assert.equal(f.sent.length, 0);
  f.key('keydown'); f.callbacks.onResult('one zero one report heading'); f.key('keyup'); await f.end();
  const timeout = [...f.timers].find(timer => timer.delay === 10000); assert.ok(timeout); timeout.fn();
  assert.match(f.element('status').textContent, /No confirmation/);
  f.failSend = true; f.key('keydown', 'Enter'); f.callbacks.onResult('one zero one report heading'); f.key('keyup', 'Enter'); await f.end();
  assert.match(f.element('status').textContent, /could not be sent/);
  assert.equal(f.sent.length, 2);
});

test('early release, overlong call and duplicate callbacks cannot submit a call', async () => {
  const f = fixture(); await f.prepare();
  f.engine.start = () => Promise.resolve();
  f.down(); f.up(); await f.end();
  assert.equal(f.sent.length, 0);
  const g = fixture(); await g.prepare(); g.down(); g.callbacks.onResult('x'.repeat(241)); g.up(); await g.end();
  assert.equal(g.sent.length, 0);
});

test('standard reports and transcript-only rooms deliver without waiting for desktop inference', async () => {
  const voice = require('../../qgh-engine/voice-control.js');
  for (const [text, allowModelHint, expectedInferences] of [
    ['one zero one report heading', true, 0],
    ['one zero one what is your current range', true, 0],
    ['one zero one could you tell me your current heading', false, 0],
    ['one zero one could you tell me your current heading', true, 1]
  ]) {
    let inferences = 0;
    const f = fixture({ ATSControllerVoice: voice, atsRadioPilot: {
      async understand() { inferences++; return {intent:'heading-report'}; }
    }});
    Object.assign(f.state, {callsigns:['101'], allowModelHint});
    await f.prepare(); f.down(); f.callbacks.onResult(text); f.up(); await f.end();
    assert.equal(inferences, expectedInferences, text);
    assert.equal(f.sent.length, 1);
    assert.equal(f.sent[0].modelIntent, expectedInferences ? 'heading-report' : undefined);
  }
});
