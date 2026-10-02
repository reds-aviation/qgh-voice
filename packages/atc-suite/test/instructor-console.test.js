'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const Core = require('../suite-core.js');
const Sensors = require('../suite-sensors.js');
const Session = require('../suite-session.js');

function store() { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }; }

function harness(mode = 'qgh') {
  let now = 0, nextTimer = 0;
  const nodes = new Map(), timers = new Map(), captions = [];
  const ctx = new Proxy({ strokes: [], stroke() { this.strokes.push(this.strokeStyle); }, measureText: text => ({ width: text.length * 8 }) }, { get: (target, key) => target[key] || (() => {}) });
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { id, value: id === 'trainingTimeRate' ? '1' : id === 'scopeRange' ? '40' : id === 'truthTrailCount' ? '8' : '0',
      children: [], textContent: '', hidden: false, open: true, disabled: false, dataset: {},
      classList: { add() {}, remove() {}, toggle() {} }, getContext: () => ctx, width: 900, height: 700,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 700 }),
      addEventListener() {}, setAttribute() {}, closest() { return null; }, replaceChildren(...items) { this.children = items; },
      append(...items) { this.children.push(...items); }, prepend(item) { this.children.unshift(item); }, scrollIntoView() {},
      setPointerCapture() {}, releasePointerCapture() {} });
    return nodes.get(id);
  };
  const document = { body: { classList: { add() {}, remove() {} } }, getElementById: node, querySelectorAll: () => [], createElement: () => node(`created-${nodes.size}`) };
  let code = readFileSync(join(__dirname, '../suite-instructor.js'), 'utf8');
  code = code.slice(0, code.indexOf("  family.addEventListener('change'")) +
    '\n globalThis.fixture = {state, drawTruth, scopeClick, scopeDoubleClick, scopeRightClick, scopePointerDown, scopePointerMove, scopePointerEnd, quickTurn, checkpoint, restoreAttempt, retryScenario, collapseSetupControls, startExercise, enterWorkspace};})();';
  const context = { document, structuredClone, sessionStorage: store(), localStorage: store(),
    ATCSuiteCore: Core, ATCSuiteSensors: Sensors, ATCSuiteSession: Session, ATCSuiteCommandReference: require('../suite-command-reference.js'),
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); }, performance: { now: () => now }, Date, console };
  vm.runInNewContext(code, context);
  const state = context.fixture.state;
  state.simulation = Core.setLifecycle(Core.createState({ exerciseFamily: mode, runwayOrientationDeg: 230, finalTrackDeg: 230,
    aircraft: [{ aircraftId: 'AC1', callsign: '101', initialQteDeg: 30, initialRangeNm: 20, initialHeadingDeg: 210, altitudeFt: 10000, speedKt: 240, rateDegPerSecond: 3 },
      { aircraftId: 'AC2', callsign: '102', initialQteDeg: 80, initialRangeNm: 24, initialHeadingDeg: 150, altitudeFt: 11000, speedKt: 260, rateDegPerSecond: 3 }] }), 'running');
  state.sensor = mode === 'qgh' ? Sensors.createDfSensor() : Sensors.createSurveillanceSensor({ rpm: 15 });
  state.review = Sensors.createReviewTimeline();
  state.session = { publishObservation() {}, publishCaption(text) { captions.push(text); }, close() {}, pin: '123456' };
  context.fixture.drawTruth(node('instructorScope'), state.simulation, null);
  function event(id = 'AC2', overrides = {}) {
    const aircraft = state.simulation.aircraftList.find(item => item.id === id), transform = state.scopeTransform;
    return { pointerId: 1, button: 0, clientX: transform.cx + aircraft.position.xNm * transform.scale,
      clientY: transform.cy + aircraft.position.yNm * transform.scale, preventDefault() { this.prevented = true; }, ...overrides };
  }
  return { ...context.fixture, context, ctx, node, captions, timers, event, tick(ms) { now += ms; }, flush() { const jobs = [...timers.values()]; timers.clear(); jobs.forEach(fn => fn()); } };
}

test('reduced motion hides the decorative radar sweep while retaining aircraft and SRA references', () => {
  const h = harness('sra'), simulation = h.state.simulation;
  assert.ok(h.ctx.strokes.includes('rgba(90,210,164,.5)'));
  h.ctx.strokes.length = 0;
  h.context.matchMedia = query => ({ matches: query === '(prefers-reduced-motion: reduce)' });
  h.drawTruth(h.node('instructorScope'), simulation, null);
  assert.equal(h.ctx.strokes.includes('rgba(90,210,164,.5)'), false);
  assert.ok(h.ctx.strokes.includes('#d8c780'), 'SRA distance references remain available');
  assert.equal(h.state.simulation, simulation);
});

test('scope single click transmits from the hit aircraft and double click turns only that aircraft', () => {
  const h = harness();
  h.scopeClick(h.event()); h.flush();
  assert.equal(h.state.simulation.selectedAircraftId, 'AC2');
  assert.match(h.captions.at(-1), /102/);
  assert.equal(h.state.transmission.aircraftId, 'AC2');
  const event = h.event(); h.scopeClick(event); h.scopeDoubleClick(event);
  assert.equal(h.state.simulation.aircraftList[1].turn.side, 'left');
  assert.equal(h.state.simulation.aircraftList[0].turn.mode, 'straight');
  assert.equal(event.prevented, true);
  assert.equal(h.timers.size, 0, 'double click cancels pending single-click transmit');
});

test('double right click turns and middle click stops without browser autoscroll', () => {
  for (const mode of ['qgh', 'surveillance', 'sra']) {
    const h = harness(mode);
    h.scopeRightClick(h.event()); assert.equal(h.state.simulation.aircraftList[1].turn.mode, 'straight');
    h.tick(100); h.scopeRightClick(h.event()); assert.equal(h.state.simulation.aircraftList[1].turn.side, 'right');
    const heading = h.state.simulation.aircraftList[1].headingDeg, event = h.event('AC2', { button: 1 });
    h.scopePointerDown(event);
    assert.equal(event.prevented, true);
    assert.equal(h.state.simulation.aircraftList[1].turn.mode, 'straight');
    assert.equal(h.state.simulation.aircraftList[1].headingDeg, heading);
    assert.equal(h.state.simulation.aircraftList[0].turn.mode, 'straight');
  }
});

test('dragging background pans the scope and never controls an aircraft', () => {
  const h = harness();
  const original = h.state.simulation;
  h.scopePointerDown(h.event('AC1', { clientX: 2, clientY: 2 }));
  h.scopePointerMove(h.event('AC1', { clientX: 52, clientY: 32 }));
  h.scopePointerEnd(h.event());
  assert.equal(h.state.scopePan.x, 50); assert.equal(h.state.scopePan.y, 30);
  assert.equal(h.state.simulation, original); assert.equal(h.captions.length, 0);
});

test('Start declutters every optional instructor panel and retry retains the initial form', () => {
  const h = harness();
  for (const id of ['consoleNavigation', 'sessionDrawer', 'clockSettings', 'scopeSettings', 'aircraftControlDrawer', 'eventDrawer']) h.node(id).open = true;
  h.collapseSetupControls();
  for (const id of ['consoleNavigation', 'sessionDrawer', 'clockSettings', 'scopeSettings', 'aircraftControlDrawer', 'eventDrawer']) assert.equal(h.node(id).open, false);
  h.node('callsign').value = '764'; h.node('initialHeading').value = '123';
  h.retryScenario();
  assert.equal(h.node('callsign').value, '764'); assert.equal(h.node('initialHeading').value, '123');
  assert.equal(h.state.simulation, null); assert.equal(h.node('setupPanel').hidden, false);
});

test('Start moves the view from setup into the active scope through the common workspace adapter', () => {
  const h = harness(), entered = [];
  h.state.simulation = Core.setLifecycle(h.state.simulation, 'ready'); h.state.session.start = () => true;
  h.context.ATCSuiteWorkspace = { enter(element, options) { entered.push({ id: element.id, block: options.block }); } };
  assert.equal(h.startExercise(), true);
  assert.deepEqual(entered, [{ id: 'activeWorkspace', block: 'start' }]);
  assert.equal(h.node('scopeSettings').open, false);
  assert.equal(h.state.simulation.lifecycle, 'running');
});

test('host recovery preserves room and authorized seat, restores paused and forbids resume until reconnect', () => {
  const storage = store(), hub = Session.createFakeTransportHub(), transportFactory = name => hub.createTransport(name);
  const host = Session.createInstructorSession({ storage, transportFactory, pin: '654321', publicMetadata: { mode: 'qgh' } });
  const student = Session.createStudentSession({ storage, transportFactory, pin: host.pin });
  student.requestJoin(); host.admit(student.clientId); student.ready(); host.start(); host.pause(12);
  const saved = host.recoverySnapshot(); host.detach();
  assert.equal(student.snapshot().state, 'paused', 'detaching the host cannot terminate a student attempt');
  const restored = Session.createInstructorSession({ ...saved, recovery: saved, storage, transportFactory, publicMetadata: { mode: 'qgh' } });
  assert.equal(restored.pin, host.pin); assert.equal(restored.sessionId, host.sessionId);
  assert.equal(restored.snapshot().state, 'paused'); assert.equal(restored.resume(12), false);
  student.rejoin(); assert.equal(restored.resume(12), true); assert.equal(student.snapshot().state, 'running');
  const discovery = JSON.parse(storage.getItem('reds.atc-suite.discovery.654321'));
  assert.equal(discovery.seatToken, undefined); assert.equal(discovery.admitted, undefined);
  restored.terminate(); assert.equal(student.snapshot().state, 'terminated');
});

test('only 15 RPM and QGH/SRA/vectoring are offered in instructor setup', () => {
  const html = readFileSync(join(__dirname, '../instructor.html'), 'utf8');
  const select = html.match(/id="exerciseFamily"[\s\S]*?<\/select>/)[0];
  assert.doesNotMatch(select, /value="par"/);
  const radar = html.match(/id="scanPreset"[\s\S]*?<\/select>/)[0];
  assert.match(radar, /value="15"/); assert.doesNotMatch(radar, /value="(?:10|12)"/);
});
