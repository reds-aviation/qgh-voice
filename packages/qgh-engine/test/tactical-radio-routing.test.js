'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../simulator-core.js');
const Tactical = require('../tactical-core.js');

// Run the production adapter against the real flight core. Rendering/timers are
// replaced; aircraft identity, routing, validation, dynamics and command logs are real.
function harness(procedure = 'normal', formation = false) {
  const nodes = new Map();
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', dataset: {}, classList: { contains: value => id === 'tConsole' && value === 'active' } });
    return nodes.get(id);
  };
  const context = {
    document: { getElementById: element }, QGHCore: Core, QGHTacticalCore: Tactical,
    QGHRadioSession: { createReceiver: () => ({}) },
    QGHRadioWorkspace: { manualCommand() { throw new Error('Radio adapter must not enqueue a manual acknowledgement'); } },
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {}, console
  };
  context.window = context;
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '..', 'tactical-simulator.js'), 'utf8');
  const bootstrap = source.lastIndexOf('  bindEvents();');
  assert.ok(bootstrap > 0);
  vm.runInContext(source.slice(0, bootstrap) + `
    renderRail = () => {}; renderSelectedAircraft = () => {}; startFlightLoop = () => {};
    chooseBearingMode = mode => { state.bearingMode = mode; };
    window.testState = state;
  })();`, context);
  const state = context.testState;
  state.procedure = procedure;
  state.exercise = Tactical.createExercise({ procedure, runway: 230, inbound: 225, outbound: 65,
    aircraft: ['A', 'B', 'C'].map((id, i) => ({ id, callsign: String(430 + i), type: 'fighter', speed: 240, rate: 3, distance: 15, level: 6000 + i * 1000 })),
    randomizeInitial: false, random: () => .37,
    formation: { enabled: formation, leaderId: 'A', memberIds: ['A', 'B', 'C'] }
  });
  state.activeAircraftId = 'A';
  return { state, nodes, run: command => context.QGHRadioAdapter.executeRadioCommand(command),
    aircraft: id => Tactical.getAircraft(state.exercise, id) };
}

test('addressed normal heading and continued heading preserve manual selection and its controls', () => {
  const h = harness();
  const selected = JSON.stringify(h.aircraft('A'));
  h.nodes.set('tHeadingInput', { value: '111' });
  assert.equal(h.run({ intent: 'normal-turn-heading', aircraft: 'B', side: 'right', heading: 230 }).ok, true);
  assert.equal(h.aircraft('B').targetHeading, 230);
  assert.equal(h.aircraft('B').forcedTurnSide, 'right');
  const continuation = h.run({ intent: 'continue-turn-heading', aircraft: 'B', heading: 60 });
  assert.equal(continuation.ok, true);
  assert.match(continuation.message, /431, TURNING RIGHT 060/);
  assert.equal(h.aircraft('B').forcedTurnSide, 'right');
  assert.equal(h.state.activeAircraftId, 'A');
  assert.equal(h.nodes.get('tHeadingInput').value, '111');
  assert.equal(JSON.stringify(h.aircraft('A')), selected);
});

test('U/S radio turns reverse immediately and stop without disclosing heading in logs or outcomes', () => {
  const h = harness('us');
  for (const side of ['left', 'right']) {
    assert.equal(h.run({ intent: 'us-turn', aircraft: 'B', side }).ok, true);
    assert.equal(h.aircraft('B').manualTurnSide, side);
  }
  const heading = h.aircraft('B').plane.heading;
  const stop = h.run({ intent: 'us-turn-stop', aircraft: 'B' });
  assert.equal(stop.ok, true);
  assert.equal(h.aircraft('B').manualTurnSide, null);
  assert.equal(h.aircraft('B').targetHeading, heading);
  assert.doesNotMatch(stop.message, /\d{3}(?!,)/); // Numeric callsign is allowed separately below.
  assert.doesNotMatch(h.state.commands.find(c => c.type === 'STOP TURN NOW').detail, /\d|heading/i);
  assert.equal(h.state.activeAircraftId, 'A');
});

test('heading/range responses sample the addressed aircraft and U/S refuses heading disclosure', () => {
  const h = harness();
  h.aircraft('A').plane.heading = 111;
  h.aircraft('B').plane.heading = 325;
  assert.equal(h.run({ intent: 'report-heading', aircraft: 'B' }).message, '431, HEADING 325');
  assert.match(h.run({ intent: 'request-distance', aircraft: 'B' }).message, /^431, RANGE \d+\.\d NM$/);
  assert.equal(h.state.activeAircraftId, 'A');
  const us = harness('us');
  const before = JSON.stringify(us.state.exercise);
  assert.equal(us.run({ intent: 'report-heading', aircraft: 'B' }).ok, false);
  assert.equal(JSON.stringify(us.state.exercise), before);
});

test('formation follower heading detaches only its addressee; explicit break works in U/S without hidden heading', () => {
  const h = harness('normal', true);
  assert.equal(h.run({ intent: 'normal-turn-heading', aircraft: 'B', side: 'left', heading: 10 }).ok, true);
  assert.deepEqual([...h.state.exercise.formation.detachedIds], ['B']);
  assert.equal(Tactical.formationRoleFor(h.state.exercise, 'C'), 'FORMATION');
  const us = harness('us', true);
  assert.equal(us.run({ intent: 'stop-following-leader', aircraft: 'B' }).ok, true);
  assert.equal(us.state.activeAircraftId, 'A');
  assert.doesNotMatch(us.state.commands.find(c => c.type === 'STOP FOLLOWING LEADER').detail, /\d{3}°|heading/);
});

test('addressed speed respects formation restriction and changes only the intended aircraft', () => {
  const h = harness();
  h.state.pendingSpeedChange = { id: 'B', speed: 200 };
  assert.equal(h.run({ intent: 'set-aircraft-field', aircraft: 'B', field: 'speed', value: 180 }).ok, true);
  assert.equal(h.state.pendingSpeedChange, null);
  assert.equal(h.aircraft('B').cfg.speed, 180);
  assert.equal(h.aircraft('A').cfg.speed, 240);
  const formation = harness('normal', true);
  assert.equal(formation.run({ intent: 'set-aircraft-field', aircraft: 'B', field: 'speed', value: 180 }).ok, false);
  assert.equal(formation.aircraft('B').cfg.speed, 240);
});

test('orbit, continue and resume use the addressed aircraft without selecting it', () => {
  const h = harness('us');
  assert.equal(h.run({ intent: 'start-orbit', aircraft: 'B', side: 'left' }).ok, true);
  Tactical.step(h.state.exercise, 1);
  assert.equal(h.run({ intent: 'resume-normal', aircraft: 'B' }).ok, true);
  assert.equal(h.aircraft('B').orbit.exitRequested, true);
  assert.equal(h.run({ intent: 'continue-orbit', aircraft: 'B' }).ok, true);
  assert.equal(h.aircraft('B').orbit.exitRequested, false);
  assert.equal(h.state.activeAircraftId, 'A');
});

test('invalid aircraft, procedure, heading and direction leave all aircraft unchanged', () => {
  const h = harness();
  const before = JSON.stringify(h.state.exercise);
  for (const command of [
    { intent: 'normal-turn-heading', side: 'right', heading: 230 },
    { intent: 'normal-turn-heading', aircraft: 'UNKNOWN', side: 'right', heading: 230 },
    { intent: 'normal-turn-heading', aircraft: 'B', side: 'bad', heading: 230 },
    { intent: 'normal-turn-heading', aircraft: 'B', side: 'right', heading: NaN },
    { intent: 'us-turn', aircraft: 'B', side: 'right' },
    { intent: 'set-aircraft-field', aircraft: 'B', field: 'speed', value: 0 }
  ]) assert.equal(h.run(command).ok, false);
  assert.equal(JSON.stringify(h.state.exercise), before);
  assert.equal(h.state.activeAircraftId, 'A');
  assert.equal(h.run({ intent: 'clock', action: 'start' }), null);
});

test('transmit for D/F accepts numeric aircraft identity without changing manual selection', () => {
  const h = harness();
  const result = h.run({ intent: 'transmit-df', aircraft: 'B', mode: 'qte' });
  assert.equal(result.ok, true);
  assert.equal(result.message, '431, TRANSMITTING FOR D/F');
  assert.equal(h.state.bearingMode, 'qte');
  assert.equal(h.state.activeAircraftId, 'A');
  assert.equal(h.state.commands.at(-1).aircraftId, 'B');
});
