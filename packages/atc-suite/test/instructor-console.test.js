'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const Core = require('../suite-core.js');
const Sensors = require('../suite-sensors.js');
const Session = require('../suite-session.js');
const Display = require('../suite-display.js');

function store() { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }; }

function harness(mode = 'qgh', sessionAdapter = Session, displayAdapter = Display) {
  let now = 0, nextTimer = 0, shellOptions;
  const nodes = new Map(), timers = new Map(), captions = [];
  const ctx = new Proxy({ strokes: [], stroke() { this.strokes.push(this.strokeStyle); }, measureText: text => ({ width: text.length * 8 }) }, { get: (target, key) => target[key] || (() => {}) });
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { id, value: id === 'trainingTimeRate' ? '1' : id === 'scopeRange' ? '40' : id === 'truthTrailCount' ? '8' : '0',
      children: [], textContent: '', hidden: false, open: true, disabled: false, dataset: {},
      classList: { add() {}, remove() {}, toggle() {} }, getContext: () => ctx, width: 900, height: 700,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 700 }),
      listeners: new Map(), addEventListener(type, callback) { const list = this.listeners.get(type) || []; list.push(callback); this.listeners.set(type, list); },
      emit(type, event) { for (const callback of this.listeners.get(type) || []) callback(event); },
      setAttribute() {}, closest() { return null; }, replaceChildren(...items) { this.children = items; },
      append(...items) { this.children.push(...items); }, prepend(item) { this.children.unshift(item); }, scrollIntoView() {},
      setPointerCapture() {}, releasePointerCapture() {} });
    return nodes.get(id);
  };
  const document = { body: { classList: { add() {}, remove() {} } }, getElementById: node, querySelectorAll: () => [], createElement: () => node(`created-${nodes.size}`) };
  let code = readFileSync(join(__dirname, '../suite-instructor.js'), 'utf8');
  code = code.slice(0, code.indexOf("  family.addEventListener('change'")) +
    '\n globalThis.fixture = {state, updateAll, openStudentDisplay, drawTruth, scopeClick, scopeDoubleClick, scopeRightClick, scopePointerDown, scopePointerMove, scopePointerEnd, quickTurn, checkpoint, restoreAttempt, retryScenario, logout, collapseSetupControls, startExercise, pauseExercise, advanceWallElapsed, enterWorkspace, createSession, onSessionEvent, setScenarioInput(input) {scenarioInput = () => input;}};})();';
  const context = { document, structuredClone, sessionStorage: store(), localStorage: store(),
    ATCSuiteCore: Core, ATCSuiteSensors: Sensors, ATCSuiteSession: sessionAdapter, ATCSuiteDisplay: displayAdapter, ATCSuiteCommandReference: require('../suite-command-reference.js'),
    ATCSuiteWorkspace: {bindShell(options) {shellOptions = options;}},
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
  return { ...context.fixture, context, ctx, node, captions, timers, event, get shellOptions(){return shellOptions;},tick(ms) { now += ms; }, flush() { const jobs = [...timers.values()]; timers.clear(); jobs.forEach(fn => fn()); } };
}

test('creating a local session keeps the instructor desk without opening a controller window',async()=>{
  const hub=Session.createFakeTransportHub(),calls=[],h=harness('qgh',{...Session,
    createInstructorSession:options=>Session.createInstructorSession({...options,publicMetadata:JSON.parse(JSON.stringify(options.publicMetadata))}),
    createLocalSessionTransport:({channelName})=>hub.createTransport(channelName)},
    {...Display,openStudentWindow:options=>{calls.push(options);return {ok:true,window:{closed:false,focus(){}}};}});
  h.setScenarioInput({exerciseFamily:'qgh',qghProcedure:'normal',callsign:'101',approachAircraft:'AC1',runwayOrientationDeg:230,finalTrackDeg:230,
    aircraft:[{aircraftId:'AC1',callsign:'101',initialQteDeg:30,initialRangeNm:20,initialHeadingDeg:210,altitudeFt:10000,speedKt:240,rateDegPerSecond:3}]});
  h.node('exerciseConnection').value='local';
  h.node('scenarioForm').reportValidity=()=>true;h.node('scenarioForm').querySelector=()=>null;
  await h.createSession({preventDefault(){}});
  assert.ok(h.state.session,h.node('setupPreview').textContent);
  assert.equal(h.node('setupPreview').textContent,'');
  assert.equal(calls.length,0);
  assert.equal(h.node('activeWorkspace').hidden,false);
  assert.equal(h.node('exerciseState').textContent,'WAITING');
  assert.match(h.node('exerciseState').title,/share the PIN.*wait for Ready/);
  assert.match(h.node('studentDisplayStatus').textContent,/shared entry page/);
});

test('explicit controller open uses the paired portal and updates new-session PIN without autojoin',()=>{
  const calls=[],child={closed:false,focus(){calls.push('focus');}};
  const h=harness('qgh',Session,{...Display,openStudentWindow:options=>{calls.push(options.url);return {ok:true,reason:'opened',window:child};}});
  h.state.session={pin:'123456',sessionId:'first'};
  h.openStudentDisplay();
  assert.equal(calls[0],'index.html?connection=local&pin=123456#controllerposition');
  h.openStudentDisplay();assert.equal(calls[1],'focus','same-session exercise is only focused');
  h.state.session={pin:'654321',sessionId:'second'};h.state.cloudTransport={};
  h.openStudentDisplay();
  assert.equal(calls[2],'index.html?connection=online&pin=654321#controllerposition');
  assert.ok(calls.filter(v=>typeof v==='string').every(v=>!v.includes('join=1')));
});

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

test('scope pointer focus keeps the exercise header in place while selection and panning remain available', () => {
  const h = harness(), canvas = h.node('instructorScope'), focusCalls = [];
  let scrollY = 0;
  canvas.focus = options => {
    focusCalls.push(options);
    if (!options?.preventScroll) scrollY = 38;
  };
  const hit = h.event();
  h.scopePointerDown(hit);
  // Model the browser's default focus after the pointer handler. The handler
  // cancels that scroll action and takes keyboard focus explicitly instead.
  if (!hit.prevented) canvas.focus();
  h.scopeClick(hit); h.flush();
  assert.equal(scrollY, 0);
  assert.equal(focusCalls.length, 1);
  assert.equal(focusCalls[0].preventScroll, true);
  assert.equal(h.state.simulation.selectedAircraftId, 'AC2');
  assert.match(h.captions.at(-1), /102/);
  const blank = h.event('AC1', {clientX:1, clientY:1});
  h.scopePointerDown(blank);
  assert.equal(blank.prevented, true);
  assert.equal(h.state.scopeDrag?.pointerId, blank.pointerId);
  h.scopePointerMove({...blank,clientX:20,clientY:20});
  assert.equal(h.state.scopeDrag.moved, true);
  h.scopePointerEnd(blank);
  assert.equal(h.state.scopeDrag, null);
  assert.equal(scrollY, 0);
});

test('running and restored paused attempts show one lifecycle action instead of a stale Start button', () => {
  const h = harness();
  h.updateAll(); assert.equal(h.node('startExercise').hidden, true);
  h.state.simulation = Core.setLifecycle(h.state.simulation, 'paused');
  h.node('startExercise').disabled = false;
  h.updateAll();
  assert.equal(h.node('startExercise').hidden, true);
  assert.equal(h.node('pauseExercise').disabled, false);
  assert.equal(h.node('pauseExercise').textContent, 'RESUME');
  assert.equal(h.startExercise(), false, 'Start cannot resume a paused attempt');
  h.state.simulation = Core.setLifecycle(h.state.simulation, 'ready');
  h.updateAll(); assert.equal(h.node('startExercise').hidden, false);
  assert.equal(h.node('pauseExercise').disabled, true);
  assert.equal(h.node('pauseExercise').textContent, 'PAUSE');
});

test('double right click turns and middle click stops without browser autoscroll', () => {
  for (const mode of ['qgh', 'surveillance', 'sra']) {
    const h = harness(mode);
    h.scopeRightClick(h.event()); assert.equal(h.state.simulation.aircraftList[1].turn.mode, 'straight');
    h.tick(100); h.scopeRightClick(h.event()); assert.equal(h.state.simulation.aircraftList[1].turn.side, 'right');
    const heading = h.state.simulation.aircraftList[1].headingDeg, event = h.event('AC2', { button: 1 });
    h.node('instructorScope').emit('pointerdown', event);
    assert.equal(h.state.simulation.aircraftList[1].turn.side, 'right', 'Stop fires after a completed click');
    h.node('instructorScope').emit('pointerup', event);
    assert.equal(event.prevented, true);
    assert.equal(h.state.simulation.aircraftList[1].turn.mode, 'straight');
    assert.equal(h.state.simulation.aircraftList[1].headingDeg, heading);
    assert.equal(h.state.simulation.aircraftList[0].turn.mode, 'straight');
  }
});

test('middle click on scope background stops the selected aircraft with one readback and no delayed D/F', () => {
  const h = harness(); h.quickTurn('right');
  h.scopeClick(h.event('AC2')); h.quickTurn('left');
  const heading = h.state.simulation.aircraftList[1].headingDeg, captions = h.captions.length;
  const background = h.event('AC2', { button: 1, clientX: 2, clientY: 2 });
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'auxclick']) h.node('instructorScope').emit(type, background);
  h.flush();
  assert.equal(background.prevented, true);
  assert.equal(h.state.simulation.selectedAircraftId, 'AC2');
  assert.equal(h.state.simulation.aircraftList[1].turn.mode, 'straight');
  assert.equal(h.state.simulation.aircraftList[1].headingDeg, heading);
  assert.equal(h.state.simulation.aircraftList[0].turn.side, 'right');
  assert.equal(h.captions.length, captions + 1, 'Exactly the Stop command readback is transmitted');
  assert.equal(h.state.simulation.simulationSeconds, 0);
});

test('middle Stop respects paused, ended and no-selected-aircraft scope states', () => {
  const paused = harness(); paused.quickTurn('right'); paused.state.simulation = Core.setLifecycle(paused.state.simulation, 'paused');
  const background = paused.event('AC1', { button: 1, clientX: 2, clientY: 2 });
  paused.node('instructorScope').emit('pointerdown', background); paused.node('instructorScope').emit('pointerup', background);
  assert.equal(paused.state.simulation.aircraftList[0].turn.mode, 'straight');
  for (const invalid of ['ready', 'review', 'no-selection']) {
    const h = harness(); h.quickTurn('right');
    if (invalid === 'no-selection') h.state.simulation = { ...h.state.simulation, selectedAircraftId: '' };
    else h.state.simulation = Core.setLifecycle(h.state.simulation, invalid);
    const before = h.state.simulation, event = h.event('AC1', { button: 1, clientX: 2, clientY: 2 });
    h.node('instructorScope').emit('pointerdown', event); h.node('instructorScope').emit('pointerup', event);
    assert.equal(h.state.simulation, before, invalid);
  }
});

test('middle hit testing and background pan use CSS geometry on a high-density canvas', () => {
  const h = harness(); h.scopeRightClick(h.event('AC2')); h.tick(100); h.scopeRightClick(h.event('AC2'));
  const canvas = h.node('instructorScope'); canvas.width = 1800; canvas.height = 1400;
  h.state.scopeTransform = { ...h.state.scopeTransform, width: 900, height: 700, pixelRatio: 2 };
  const event = h.event('AC2', { button: 1 });
  canvas.emit('pointerdown', event); canvas.emit('pointerup', event);
  assert.equal(h.state.simulation.selectedAircraftId, 'AC2'); assert.equal(h.state.simulation.aircraftList[1].turn.mode, 'straight');
  canvas.width = 1800; canvas.height = 1400;
  h.state.scopeTransform = { ...h.state.scopeTransform, width: 900, height: 700, pixelRatio: 2 };
  h.scopePointerDown(h.event('AC1', { clientX: 2, clientY: 2 }));
  h.scopePointerMove(h.event('AC1', { clientX: 52, clientY: 32 })); h.scopePointerEnd(h.event());
  assert.equal(h.state.scopePan.x, 50); assert.equal(h.state.scopePan.y, 30);
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

test('a fresh online SRA room after terminated QGH clears prior admission and readiness in both session displays', async () => {
  const hub = Session.createFakeTransportHub();
  // The harness runs the page in a separate VM realm. The real session codec
  // correctly rejects foreign prototypes, so cross that test boundary as JSON.
  const h = harness('qgh', {...Session, createInstructorSession: options => {
    const session = Session.createInstructorSession({...options, publicMetadata:JSON.parse(JSON.stringify(options.publicMetadata))});
    return {...session, publishObservation: (observation, time) => session.publishObservation(JSON.parse(JSON.stringify(observation)), time)};
  }});
  h.onSessionEvent({kind:'student-ready', audioMode:'audio'});
  h.onSessionEvent({kind:'terminated'});
  h.state.pendingClient = 'previous-student';
  h.node('pauseExercise').textContent = 'RESUME'; h.state.accumulator = .2;
  h.node('admitStudent').hidden = false; h.node('rejectStudent').hidden = false;
  h.retryScenario();
  const input = {exerciseFamily:'sra', qghProcedure:'normal', callsign:'201', approachAircraft:'AC1',
    runwayOrientationDeg:150, finalTrackDeg:150, surveillanceProfile:'primary', parRefreshHz:1,
    aircraft:[{aircraftId:'AC1',callsign:'201',aircraftType:'fighter',initialQteDeg:330,initialRangeNm:20,
      initialHeadingDeg:150,altitudeFt:10000,speedKt:240,rateDegPerSecond:3,verticalRateFpm:1000}]};
  h.setScenarioInput(input);
  h.node('exerciseFamily').value = 'sra'; h.node('exerciseConnection').value = 'online';
  h.node('scenarioForm').reportValidity = () => true; h.node('scenarioForm').querySelector = () => null;
  const transport = {...hub.createTransport('new-room'), connected:true, start(){}};
  h.context.ATCSuiteCloud = {prepareHost:async () => ({pin:'654321',sessionId:'new-sra-room',transport})};
  await h.createSession({preventDefault(){}});
  assert.equal(h.state.session?.snapshot().state, 'waiting', h.node('setupPreview').textContent);
  assert.equal(h.state.session.snapshot().admittedClientId, null);
  assert.equal(h.state.simulation.scenario.exerciseFamily, 'sra');
  assert.equal(h.node('studentStatus').textContent, 'WAITING TO JOIN');
  assert.equal(h.node('compactConnection').textContent, 'WAITING TO JOIN');
  assert.match(h.node('studentDetail').textContent, /request admission/);
  assert.doesNotMatch(h.node('studentDetail').textContent, /can now start/);
  assert.equal(h.node('startExercise').disabled, true);
  assert.equal(h.node('admitStudent').hidden, true); assert.equal(h.node('rejectStudent').hidden, true);
  assert.equal(h.state.pendingClient, null); assert.equal(h.state.radioAudio, false);
  assert.equal(h.node('pauseExercise').textContent, 'PAUSE'); assert.equal(h.state.accumulator, 0);
  const student = Session.createStudentSession({pin:'654321', clientId:'new-student', transport:hub.createTransport('new-room'),
    discovery:{pin:'654321',sessionId:'new-sra-room',channelName:'new-room',expiresAt:Date.now()+60000}});
  student.requestJoin(); assert.equal(h.state.session.admit(student.clientId), true); student.ready();
  const Meeting = require('../../procedural-beta/static/meeting-room.js');
  let audioConfirmed = false;
  h.context.ATCSuiteMeeting = {startupReadiness: options => Meeting.startupReadiness({...options,voiceReady:audioConfirmed})};
  assert.equal(h.startExercise(), false, 'An online fresh room still needs a shared Meet link');
  h.state.meetingUrl = 'https://meet.google.com/abc-defg-hij'; h.state.session.setMeetingLink(h.state.meetingUrl);
  assert.equal(h.startExercise(), false, 'Ready does not substitute for mutual audio confirmation');
  audioConfirmed = true;
  assert.equal(h.startExercise(), true); assert.equal(student.snapshot().state, 'running');
  assert.equal(h.node('pauseExercise').textContent, 'PAUSE');
  h.advanceWallElapsed(1); const elapsed = h.state.simulation.simulationSeconds;
  assert.equal(elapsed, 1);
  // Lifecycle remains authoritative even if a stale presentation/runtime flag
  // survives a preceding session; pressing Pause must still stop this attempt.
  h.state.running = false;
  assert.equal(h.pauseExercise(), true); assert.equal(h.state.simulation.lifecycle, 'paused');
  assert.equal(student.snapshot().state, 'paused'); assert.equal(h.node('pauseExercise').textContent, 'RESUME');
  assert.equal(h.advanceWallElapsed(2), 0); assert.equal(h.state.simulation.simulationSeconds, elapsed);
  assert.equal(h.pauseExercise(), true); assert.equal(h.state.simulation.lifecycle, 'running');
  assert.equal(student.snapshot().state, 'running'); assert.equal(h.node('pauseExercise').textContent, 'PAUSE');
  h.advanceWallElapsed(1); assert.equal(h.state.simulation.simulationSeconds, elapsed+1);
  h.state.session.close();
  student.close();
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

function deferredRecoveryHarness() {
  const hub = Session.createFakeTransportHub();
  const h = harness('qgh', { ...Session,
    createInstructorSession: options => Session.createInstructorSession({ ...options, publicMetadata: JSON.parse(JSON.stringify(options.publicMetadata)) }),
    createLocalSessionTransport: ({channelName}) => hub.createTransport(channelName)
  });
  const previous = Session.createInstructorSession({ pin:'654321', sessionId:'saved-old-room', transport:hub.createTransport('saved-old-room'), publicMetadata:{mode:'qgh'} });
  h.context.sessionStorage.setItem('atc-suite.instructor-attempt.v1', JSON.stringify({ version:1, simulation:h.state.simulation,
    protocol:previous.recoverySnapshot(), cloud:{room:'saved-old-room'}, review:h.state.review.snapshot(), trainingTimeRate:1 }));
  h.context.ATCSuiteMeeting = { normalizeMeetUrl:value => value };
  let resolveRecovery, closed = 0;
  h.context.ATCSuiteCloud = { prepareHost:() => new Promise(resolve => { resolveRecovery = resolve; }) };
  const pending = h.restoreAttempt();
  assert.equal(typeof resolveRecovery, 'function', 'fixture reaches pending online recovery');
  const transport = hub.createTransport('saved-old-room');
  const finish = () => resolveRecovery({ pin:'654321', sessionId:'saved-old-room', transport:{ ...transport, connected:true, start(){}, close(){closed++;transport.close();} } });
  return { h, pending, finish, get closed(){return closed;}, cleanup(){h.state.session?.close();previous.close();} };
}

test('slow saved online recovery cannot overwrite a newly created local exercise or PIN', async () => {
  const fixture = deferredRecoveryHarness(), {h} = fixture;
  try {
    h.node('exerciseConnection').value = 'local'; h.node('exerciseFamily').value = 'surveillance';
    h.node('scenarioForm').reportValidity = () => true; h.node('scenarioForm').querySelector = () => null;
    h.setScenarioInput({ exerciseFamily:'surveillance', qghProcedure:'normal', callsign:'201', approachAircraft:'AC1', runwayOrientationDeg:230, finalTrackDeg:230,
      surveillanceProfile:'primary', aircraft:[{aircraftId:'AC1',callsign:'201',initialQteDeg:30,initialRangeNm:20,initialHeadingDeg:210,altitudeFt:10000,speedKt:240,rateDegPerSecond:3}] });
    await h.createSession({preventDefault(){}});
    const session = h.state.session, simulation = h.state.simulation, pin = h.node('sessionPin').textContent;
    fixture.finish(); await fixture.pending;
    assert.equal(h.state.session, session); assert.equal(h.state.simulation, simulation);
    assert.equal(h.node('sessionPin').textContent, pin); assert.equal(h.state.simulation.scenario.exerciseFamily, 'surveillance');
    assert.equal(fixture.closed, 1, 'obsolete recovered transport is closed');
    assert.doesNotMatch(h.node('commandStatus').textContent, /ATTEMPT RESTORED/);
  } finally { fixture.cleanup(); }
});

test('retry cancels pending online recovery and leaves editable setup without resurrecting the old attempt', async () => {
  const fixture = deferredRecoveryHarness(), {h} = fixture;
  try {
    h.retryScenario(); fixture.finish(); await fixture.pending;
    assert.equal(h.state.session, null); assert.equal(h.state.simulation, null); assert.equal(h.state.cloudTransport, null);
    assert.equal(h.node('setupPanel').hidden, false); assert.equal(h.node('activeWorkspace').hidden, true);
    assert.equal(fixture.closed, 1, 'cancelled recovery transport is closed');
    assert.doesNotMatch(h.node('commandStatus').textContent, /ATTEMPT RESTORED/);
  } finally { fixture.cleanup(); }
});

test('instructor Logout terminates the admitted session, stops local work and removes recovery without deleting saved exercises',async()=>{
 const h=harness(),hub=Session.createFakeTransportHub(),storage=store(),transportFactory=channelName=>hub.createTransport(channelName);
 const host=Session.createInstructorSession({pin:'654321',storage,transportFactory,publicMetadata:{mode:'qgh'}});
 const student=Session.createStudentSession({pin:host.pin,storage,transportFactory});student.requestJoin();host.admit(student.clientId);student.ready();host.start();
 h.state.session=host;h.state.running=true;h.state.reviewPlaying=true;
 const closed=[],cancelled=[];h.context.clearInterval=id=>cancelled.push(id);h.context.cancelAnimationFrame=id=>cancelled.push(id);
 h.state.heartbeatTimer=21;h.state.runtimeTimer=22;h.state.animationFrame=23;
 h.state.clickTimer=h.context.setTimeout(()=>assert.fail('pending scope click survived logout'));
 h.state.cloudTransport={async sync(){assert.equal(student.snapshot().reason,'instructor-logout');closed.push('sync');},close(){closed.push('close');}};
 h.context.sessionStorage.setItem('atc-suite.instructor-attempt.v1','progress');h.context.sessionStorage.setItem('atc-suite-host-auth','identity');h.context.sessionStorage.setItem('atc-suite.saved-exercises.v1','saved-library');
 assert.equal(h.shellOptions.onLogout,h.logout);await h.shellOptions.onLogout();
 assert.equal(student.snapshot().state,'terminated');assert.equal(student.snapshot().reason,'instructor-logout');assert.deepEqual(closed,['sync','close']);
 assert.deepEqual(cancelled,[21,22,23]);assert.equal(h.state.running,false);assert.equal(h.state.reviewPlaying,false);assert.equal(h.state.session,null);assert.equal(h.state.simulation,null);h.flush();h.checkpoint();
 assert.equal(h.context.sessionStorage.getItem('atc-suite.instructor-attempt.v1'),null);assert.equal(h.context.sessionStorage.getItem('atc-suite-host-auth'),null);assert.equal(h.context.sessionStorage.getItem('atc-suite.saved-exercises.v1'),'saved-library');student.close();
});

test('instructor Logout invalidates pending saved-room recovery before returning Home',async()=>{
 const fixture=deferredRecoveryHarness(),{h}=fixture;
 try{await h.shellOptions.onLogout();fixture.finish();await fixture.pending;
 assert.equal(h.state.session,null);assert.equal(h.state.simulation,null);assert.equal(h.state.cloudTransport,null);assert.equal(fixture.closed,1);assert.equal(h.context.sessionStorage.getItem('atc-suite.instructor-attempt.v1'),null);
 }finally{fixture.cleanup();}
});
