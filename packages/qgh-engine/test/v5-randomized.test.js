'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../simulator-core.js');
const Tactical = require('../tactical-core.js');
const Procedure = require('../procedure-core.js');
const Intent = require('../procedure-intent.js');

const STEP = .25;
const clone = value => JSON.parse(JSON.stringify(value));
const angleError = (a, b) => Math.abs(Core.normalize(a - b + 180) - 180);
function near(actual, expected, label, tolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, received ${actual}`);
}
function random(seed) {
  let value = seed >>> 0;
  return () => ((value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function configuration(seed) {
  const rng = random(seed);
  return { rng, speed: 80 + Math.floor(rng() * 341), rate: .5 + Math.floor(rng() * 8) * .5,
    heading: Math.floor(rng() * 360), bearing: Math.floor(rng() * 360), distance: 10 + rng() * 20,
    verticalRate: 600 + Math.floor(rng() * 25) * 100, level: 14000 + Math.floor(rng() * 4) * 1000 };
}
function domain(fleet, cfg) {
  return Procedure.create({ environment: { runway: '23', aerodromeElevationFt: 500 },
    aircraft: fleet.map((a, i) => ({ id: a.id, callsign: a.callsign, level: cfg.level + i * 1000, verticalRateFpm: cfg.verticalRate })) });
}

// Single uses the actual production command handlers and physicsStep. Only page
// rendering and timers are stubbed; initial state is a deterministic exercise fixture.
function singleHarness(procedure, seed) {
  const cfg = configuration(seed), nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', dataset: {}, setAttribute() {},
      classList: { add() {}, remove() {}, contains: () => true } });
    return nodes.get(id);
  };
  const vertical = domain([{ id: 'single', callsign: '430' }], cfg), reports = [];
  const context = { console, document: { getElementById: node }, QGHCore: Core,
    QGHRadioSession: { createReceiver: () => ({}) },
    QGHProcedureWorkspace: { advance: seconds => reports.push(...Procedure.step(vertical, seconds)) },
    setTimeout() {}, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {} };
  context.window = context; vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '..', 'simulator.js'), 'utf8');
  const boundary = source.lastIndexOf('  bindEvents();');
  assert.ok(boundary > 0);
  vm.runInContext(source.slice(0, boundary) + `
    renderDF = () => {}; updateUsTurnControls = () => {}; updateNormalContinueControl = () => {};
    window.fixture = { state, physicsStep, issueHeading, startTurn, stopTurn };
  })();`, context);
  const state = context.fixture.state;
  state.procedure = procedure;
  state.cfg = { callsign: '430', runway: 230, inbound: 225, outbound: 65, speed: cfg.speed, rate: cfg.rate, distance: cfg.distance, type: 'fighter' };
  state.plane = { x: Math.sin(Core.radians(cfg.bearing)) * cfg.distance, y: -Math.cos(Core.radians(cfg.bearing)) * cfg.distance, heading: cfg.heading };
  state.targetHeading = cfg.heading;
  state.path = [{ ...state.plane }];
  return { cfg, vertical, reports, ids: ['single'], aircraft: () => ({ plane: state.plane, cfg: state.cfg }),
    normal: (id, side, heading) => { node('headingInput').value = String(heading); context.fixture.issueHeading(side); },
    timed: (id, side) => context.fixture.startTurn(side), stop: () => context.fixture.stopTurn(),
    step: seconds => context.fixture.physicsStep(seconds),
    snapshot: () => ({ plane: clone(state.plane), phase: state.phase, path: clone(state.path), vertical: clone(vertical), reports: clone(reports) }) };
}

function tacticalHarness(procedure, seed) {
  const cfg = configuration(seed), count = 2 + seed % 3;
  const fleet = Array.from({ length: count }, (_, i) => ({ id: String.fromCharCode(65 + i), callsign: String(430 + i), type: 'fighter',
    speed: cfg.speed, rate: cfg.rate, distance: cfg.distance + i, level: cfg.level + i * 1000 }));
  const exercise = Tactical.createExercise({ procedure, runway: 230, inbound: 225, outbound: 65, aircraft: fleet, random: cfg.rng, randomizeInitial: true });
  const vertical = domain(fleet, cfg), reports = [];
  return { cfg, vertical, reports, ids: fleet.map(a => a.id), aircraft: id => Tactical.getAircraft(exercise, id),
    normal: (id, side, heading) => Tactical.issueHeading(exercise, id, side, heading),
    timed: (id, side) => Tactical.startTurn(exercise, id, side), stop: id => Tactical.stopTurn(exercise, id),
    step: seconds => { Tactical.step(exercise, seconds); reports.push(...Procedure.step(vertical, seconds)); },
    snapshot: () => ({ exercise: clone(exercise), vertical: clone(vertical), reports: clone(reports) }) };
}

function apply(h, id, action) {
  const result = Procedure.apply(h.vertical, { aircraft: id, actions: [action] });
  assert.equal(result.authorization, 'AUTHORIZED', result.response.text);
  return result;
}
function stepFor(h, seconds) {
  const count = Math.round(seconds / STEP);
  for (let i = 0; i < count; i++) h.step(STEP);
}
function checkArc(start, end, cfg, signedRate, seconds) {
  const radius = cfg.speed / 3600 / (cfg.rate * Math.PI / 180);
  const sign = Math.sign(signedRate), theta = Core.radians(start.heading);
  const centre = { x: start.x + sign * radius * Math.cos(theta), y: start.y + sign * radius * Math.sin(theta) };
  near(Math.hypot(end.x - centre.x, end.y - centre.y), radius, 'turn stays on the speed/rate circle');
  near(angleError(end.heading, Core.normalize(start.heading + signedRate * seconds)), 0, 'selected angular rate');
  assert.ok(Math.hypot(end.x - start.x, end.y - start.y) > 0, 'turn has translation, not a point rotation');
}
function runScenario(kind, procedure, seed) {
  const h = kind === 'Single' ? singleHarness(procedure, seed) : tacticalHarness(procedure, seed);
  const id = h.ids[0], initial = clone(h.aircraft(id).plane), side = seed % 2 ? 'left' : 'right', sign = side === 'left' ? -1 : 1;
  const beforeWeather = h.ids.map(source => clone(h.aircraft(source).plane));
  const weather = apply(h, id, { type: 'weather', values: { windDirectionDeg: 230, windSpeedKt: 12, temperatureC: -5, visibilityM: 6000 } });
  assert.equal(weather.executionStatus, 'RECEIVED');
  assert.deepEqual(h.ids.map(source => clone(h.aircraft(source).plane)), beforeWeather, 'weather receipt does not move or vector aircraft');
  const target = Core.normalize(initial.heading + sign * (60 + seed % 220));
  if (procedure === 'normal') h.normal(id, side, target); else h.timed(id, side);
  const startAltitude = h.vertical.aircraft[id].actualAltitudeMslFt;
  const levelTarget = startAltitude - 1000;
  apply(h, id, { type: 'vertical', direction: 'DESCENT', target: { datum: 'QNH', value: levelTarget }, reportReaching: true });
  apply(h, id, { type: 'arm-level', kind: 'passing', target: { datum: 'QNH', value: startAltitude - 500 } });
  stepFor(h, 5);
  checkArc(initial, h.aircraft(id).plane, h.cfg, sign * h.cfg.rate, 5);
  near(h.vertical.aircraft[id].actualAltitudeMslFt, startAltitude - h.cfg.verticalRate * 5 / 60, 'selected vertical rate');
  if (procedure === 'us') {
    const atReverse = clone(h.aircraft(id).plane);
    h.timed(id, side === 'left' ? 'right' : 'left');
    assert.deepEqual(clone(h.aircraft(id).plane), atReverse, 'reversal causes no position or heading teleport');
    stepFor(h, 5);
    checkArc(atReverse, h.aircraft(id).plane, h.cfg, -sign * h.cfg.rate, 5);
    h.stop(id);
    const atStop = clone(h.aircraft(id).plane);
    stepFor(h, 5);
    near(angleError(h.aircraft(id).plane.heading, atStop.heading), 0, 'stopped turn retains heading');
    near(Math.hypot(h.aircraft(id).plane.x - atStop.x, h.aircraft(id).plane.y - atStop.y), h.cfg.speed * 5 / 3600, 'stopped turn continues translating');
  } else {
    const turnSeconds = (60 + seed % 220) / h.cfg.rate;
    stepFor(h, Math.ceil((turnSeconds - 5 + 3) / STEP) * STEP);
    near(angleError(h.aircraft(id).plane.heading, target), 0, 'Normal command reaches its assigned heading');
    const settled = clone(h.aircraft(id).plane);
    stepFor(h, 5);
    near(Math.hypot(h.aircraft(id).plane.x - settled.x, h.aircraft(id).plane.y - settled.y), h.cfg.speed * 5 / 3600, 'Normal continues on cleared heading');
  }
  stepFor(h, 120);
  near(h.vertical.aircraft[id].actualAltitudeMslFt, levelTarget, 'vertical target clamps exactly');
  assert.equal(h.vertical.aircraft[id].verticalMode, 'LEVEL');
  const passing = h.reports.filter(r => r.source === id && r.text.startsWith('PASSING'));
  const reaching = h.reports.filter(r => r.source === id && r.text.startsWith('REACHING'));
  assert.equal(passing.length, 1, 'one passing report per obligation');
  assert.equal(reaching.length, 1, 'one reaching report per obligation');
  near(passing[0].timestamp, 500 / h.cfg.verticalRate * 60, 'passing sample simulation time');
  near(reaching[0].timestamp, 1000 / h.cfg.verticalRate * 60, 'reaching sample simulation time');
  assert.ok(Object.isFrozen(passing[0]));
  apply(h, id, { type: 'stop-vertical' });
  const geometry = { phase: 'final', heading: 225, inbound: 225, range: .5 };
  h.vertical.aircraft[id].visualOverride = 'NOT_VISUAL';
  const noVisual = Procedure.apply(h.vertical, { aircraft: id, actions: [{ type: 'report-visual', kind: 'runway' }] }, { geometry });
  assert.match(noVisual.response.text, /NOT IN SIGHT/);
  assert.equal(h.vertical.aircraft[id].runwayVisual, false);
  for (const source of h.ids) {
    const plane = h.aircraft(source).plane;
    assert.ok([plane.x, plane.y, plane.heading].every(Number.isFinite));
  }
  return h.snapshot();
}

for (const kind of ['Single', 'Tactical']) for (const procedure of ['normal', 'us']) {
  for (let index = 0; index < 20; index++) {
    const seed = 387030 + index * 7919;
    test(`v5 ${kind} ${procedure}: deterministic integrated exercise seed ${seed}`, () => {
      assert.deepEqual(runScenario(kind, procedure, seed), runScenario(kind, procedure, seed), 'same seeded inputs give identical flight, vertical state and reports');
    });
  }
}

for (const procedure of ['normal', 'us']) for (let index = 0; index < 20; index++) {
  const seed = 5038703 + index * 7919;
  test(`v5 ${procedure}: formation vertical offsets and large-step reporting seed ${seed}`, () => {
    const cfg = configuration(seed), count = 2 + seed % 3;
    const fleet = Array.from({ length: count }, (_, i) => ({ id: String.fromCharCode(65 + i), callsign: String(430 + i),
      type: 'fighter', speed: cfg.speed, rate: cfg.rate, distance: cfg.distance, level: cfg.level + i * 1000 }));
    const flight = Tactical.createExercise({ procedure, runway: 230, outbound: 65, inbound: 225, aircraft: fleet,
      formation: { enabled: true, leaderId: 'A', memberIds: fleet.map(a => a.id) }, random: cfg.rng, randomizeInitial: false });
    const state = domain(fleet, cfg), ids = fleet.slice(1).map(a => a.id), following = Object.fromEntries(ids.map(id => [id, 'A']));
    const plan = Intent.parse('430 descend to altitude 12000 feet report reaching', { callsigns: fleet });
    assert.equal(plan.accepted, true);
    const result = Procedure.apply(state, plan, { attachedIds: ids });
    assert.equal(result.authorization, 'AUTHORIZED');
    assert.equal(result.targetAircraftId, 'A');
    assert.equal(state.aircraft.A.clearedAltitudeMslFt, 12000);
    assert.equal(result.detach, false);
    const steps = Math.ceil((cfg.level - 12000) / cfg.verticalRate) + 2;
    const reports = [];
    for (let minute = 0; minute < steps; minute++) {
      for (let n = 0; n < 240; n++) Tactical.step(flight, STEP);
      reports.push(...Procedure.step(state, 60, following));
      for (let i = 1; i < fleet.length; i++) near(state.aircraft[fleet[i].id].actualAltitudeMslFt - state.aircraft.A.actualAltitudeMslFt, i * 1000, 'formation vertical offset');
    }
    near(state.aircraft.A.actualAltitudeMslFt, 12000, 'leader reaches clearance');
    assert.equal(reports.length, 1, 'only the explicitly armed leader reports');
    near(reports[0].timestamp, (cfg.level - 12000) / cfg.verticalRate * 60, 'large-step reaching time');
    assert.deepEqual(flight.formation.detachedIds, []);
    const before = clone(state.aircraft);
    const conflict = Procedure.apply(state, { aircraft: 'B', actions: [{ type: 'vertical', direction: 'DESCENT', target: { datum: 'QNH', value: 12000 } }] }, { follower: true });
    assert.equal(conflict.authorization, 'REJECTED');
    assert.equal(conflict.requiresSeparationConfirmation, true);
    assert.deepEqual(state.aircraft, before, 'separation rejection is atomic');
  });
}
