'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Suite = require('../suite-core.js');

function aircraft(index, overrides = {}) {
  return {
    aircraftId: 'AC' + index, callsign: 'FALCON ' + index, aircraftType: 'fighter',
    initialQteDeg: index * 10, initialRangeNm: 20, initialHeadingDeg: 270,
    altitudeFt: 8000, verticalRateFpm: 1200, speedKt: 240, rateDegPerSecond: 3,
    ...overrides
  };
}

function fleet(overrides = {}) {
  return Suite.createState({
    exerciseFamily: 'surveillance', runwayOrientationDeg: 230, finalTrackDeg: 225,
    aircraft: [aircraft(1), aircraft(2, { altitudeFt: 5000 })], ...overrides
  });
}

test('fleet validates bounds, unique IDs and normalized callsigns', () => {
  assert.equal(fleet({ aircraft: Array.from({ length: 24 }, (_, i) => aircraft(i + 1)) }).aircraftList.length, 24);
  for (const aircraftList of [[], Array.from({ length: 25 }, (_, i) => aircraft(i + 1)),
    [aircraft(1), aircraft(2, { aircraftId: 'AC1' })],
    [aircraft(1), aircraft(2, { callsign: ' falcon  1 ' })]]) {
    assert.throws(() => fleet({ aircraft: aircraftList }));
  }
});

test('new QGH sessions allow two aircraft while radar sessions retain their fleet capacity and old QGH attempts remain readable', () => {
  const two = { exerciseFamily: 'qgh', aircraft: [aircraft(1), aircraft(2)] };
  assert.equal(Suite.validateNewExercise(two), two);
  assert.throws(() => Suite.validateNewExercise({ ...two, aircraft: [aircraft(1), aircraft(2), aircraft(3)] }), /QGH.*1 to 2/);
  for (const exerciseFamily of ['surveillance', 'sra']) {
    assert.doesNotThrow(() => Suite.validateNewExercise({ exerciseFamily, aircraft: Array.from({ length: 24 }, (_, i) => aircraft(i + 1)) }));
  }
  const historical = fleet({ exerciseFamily: 'qgh', aircraft: Array.from({ length: 24 }, (_, i) => aircraft(i + 1)) });
  assert.equal(Suite.setLifecycle(historical, 'paused').aircraftList.length, 24);
  assert.equal(Suite.MAX_QGH_AIRCRAFT, 2);
});

test('legacy input and selected aliases share canonical frozen aircraft and trail', () => {
  const legacy = Suite.createState({ ...aircraft(1), runwayOrientationDeg: 230, finalTrackDeg: 225 });
  assert.equal(legacy.aircraftList.length, 1);
  assert.equal(legacy.aircraft, legacy.aircraftList[0]);
  assert.equal(legacy.truthTrail, legacy.truthTrails.AC1);
  const initial = fleet();
  const selected = Suite.selectAircraft(initial, 'AC2');
  assert.equal(selected.selectedAircraftId, 'AC2');
  assert.equal(selected.aircraft, selected.aircraftList[1]);
  assert.equal(selected.truthTrail, selected.truthTrails.AC2);
  assert.equal(selected.aircraftList, initial.aircraftList);
  assert.equal(initial.selectedAircraftId, 'AC1');
  assert.ok(Object.isFrozen(selected.aircraft.position));
  assert.throws(() => Suite.selectAircraft(initial, 'missing'));
});

test('addressed commands affect only their target without changing selection', () => {
  const initial = fleet();
  const result = Suite.applyCommand(initial, { aircraftId: 'AC2', type: 'set-speed', speedKt: 310 });
  assert.equal(result.outcome.accepted, true);
  assert.equal(result.state.aircraftList[1].speedKt, 310);
  assert.equal(result.state.aircraft, initial.aircraft);
  assert.equal(result.state.selectedAircraftId, 'AC1');
  assert.equal(result.outcome.aircraftId, 'AC2');
  assert.equal(result.outcome.command.aircraftId, 'AC2');
  assert.match(result.outcome.readback.text, /FALCON 2/);
  assert.equal(result.state.truthTrails, initial.truthTrails);
  const selected = Suite.selectAircraft(result.state, 'AC2');
  const implicit = Suite.applyCommand(selected, { type: 'set-speed', speedKt: 320 });
  assert.equal(implicit.state.aircraft.speedKt, 320);
  assert.equal(implicit.state.aircraftList[0].speedKt, 240);
  const rejected = Suite.applyCommand(initial, { aircraftId: 'missing', type: 'set-speed', speedKt: 300 });
  assert.equal(rejected.outcome.accepted, false);
  assert.equal(rejected.state, initial);
});

test('validation and reports use addressed aircraft rather than selected aircraft', () => {
  const initial = fleet();
  const climb = Suite.applyCommand(initial, { aircraftId: 'AC2', type: 'set-altitude', direction: 'climb', altitudeFt: 6000 });
  assert.equal(climb.outcome.accepted, true);
  assert.equal(climb.state.aircraftList[1].vertical.targetAltitudeFt, 6000);
  assert.equal(climb.state.aircraft.vertical.mode, 'LEVEL');
  const report = Suite.applyCommand(initial, { aircraftId: 'AC2', type: 'report-position' });
  assert.ok(Math.abs(report.outcome.report.qteDeg - 20) < 1e-9);
});

test('readback completion and interruption retain source aircraft after selection changes', () => {
  const first = Suite.applyCommand(fleet(), { aircraftId: 'AC2', type: 'transmit' });
  const selected = Suite.selectAircraft(first.state, 'AC1');
  assert.equal(selected.activeReadback.aircraftId, 'AC2');
  const complete = Suite.finishReadback(selected, first.outcome.readback.id);
  assert.equal(complete.events.at(-1).aircraftId, 'AC2');
  const interrupted = Suite.applyCommand(selected, { type: 'transmit' }).state;
  assert.equal(interrupted.events.find(event => event.type === 'READBACK_INTERRUPTED').aircraftId, 'AC2');
});

test('all aircraft advance deterministically with independent trails and altitude events', () => {
  let initial = Suite.applyCommand(fleet(), { aircraftId: 'AC1', type: 'turn-to-heading', side: 'right', headingDeg: 310 }).state;
  initial = Suite.applyCommand(initial, { aircraftId: 'AC2', type: 'set-altitude', direction: 'climb', altitudeFt: 5010 }).state;
  const once = Suite.advance(initial, 10);
  let repeated = initial;
  for (let i = 0; i < 40; i += 1) repeated = Suite.advance(repeated, .25);
  assert.deepEqual(once, repeated);
  assert.equal(once.revision, initial.revision + 40);
  for (const plane of once.aircraftList) {
    assert.notDeepEqual(plane.position, initial.aircraftList.find(item => item.id === plane.id).position);
    assert.equal(once.truthTrails[plane.id].length, 41);
    assert.equal(once.truthTrails[plane.id][0], initial.truthTrails[plane.id][0]);
  }
  assert.equal(once.aircraft, once.aircraftList[0]);
  assert.equal(once.truthTrail, once.truthTrails.AC1);
  assert.equal(once.events.find(event => event.type === 'ALTITUDE_REACHED').aircraftId, 'AC2');
  assert.equal(initial.truthTrails.AC2.length, 1);
});

test('instructor snapshot contains the fleet while student whitelist excludes truth', () => {
  const state = fleet();
  assert.deepEqual(Suite.truthSnapshot(state).aircraftList, state.aircraftList);
  const student = Suite.studentEnvelope(state, { aircraftList: state.aircraftList, truthTrails: state.truthTrails });
  assert.equal(student.aircraftList, undefined);
  assert.equal(student.truthTrails, undefined);
  assert.deepEqual(student.observation, {});
});
