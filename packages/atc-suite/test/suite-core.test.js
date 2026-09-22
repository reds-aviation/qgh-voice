'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const Flight = require('../../qgh-engine/simulator-core.js');
const Suite = require('../suite-core.js');

function scenario(overrides = {}) {
  return Suite.createState({
    exerciseFamily: 'qgh',
    qghProcedure: 'normal',
    callsign: 'FALCON 11',
    aircraftType: 'fighter',
    initialQteDeg: 90,
    initialRangeNm: 20,
    initialHeadingDeg: 270,
    altitudeFt: 8000,
    verticalRateFpm: 1000,
    speedKt: 240,
    rateDegPerSecond: 3,
    runwayOrientationDeg: 230,
    finalTrackDeg: 225,
    ...overrides
  });
}

function near(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
}

test('initial QTE and range establish position independently from heading', () => {
  const state = scenario();
  near(state.aircraft.position.xNm, 20);
  near(state.aircraft.position.yNm, 0);
  assert.equal(state.aircraft.headingDeg, 270);
  assert.equal(Suite.truthSnapshot(state).bearing.qteDeg, 90);
  assert.equal(Suite.truthSnapshot(state).bearing.rangeNm, 20);
  assert.equal(state.scenario.zeroMagneticVariation, true);
  assert.ok(Object.isFrozen(state));
  assert.ok(Object.isFrozen(state.aircraft.position));
});

test('a target-heading turn preserves established curved-turn radius and geometry', () => {
  const initial = scenario({ initialQteDeg: 0, initialRangeNm: 12, initialHeadingDeg: 0 });
  const command = Suite.applyCommand(initial, { type: 'turn-to-heading', side: 'right', headingDeg: 90 });
  assert.equal(command.outcome.accepted, true);
  assert.equal(command.state.aircraft.turn.mode, 'target');
  assert.equal(command.state.aircraft.turn.side, 'right');
  near(command.outcome.turnRadiusNm, Flight.turnRadiusNm(240, 3));

  const advanced = Suite.advance(command.state, 30);
  const expected = Flight.advanceArc(
    { x: initial.aircraft.position.xNm, y: initial.aircraft.position.yNm },
    0,
    240,
    3,
    30
  );
  near(advanced.aircraft.position.xNm, expected.x, 1e-8);
  near(advanced.aircraft.position.yNm, expected.y, 1e-8);
  near(advanced.aircraft.headingDeg, 90, 1e-8);
  assert.equal(advanced.aircraft.turn.mode, 'straight');
  assert.equal(advanced.truthTrail.length, 121);
});

test('a superseding turn changes direction immediately and cancels only the obsolete readback', () => {
  const first = Suite.applyCommand(
    scenario({ initialHeadingDeg: 0 }),
    { type: 'turn-to-heading', side: 'right', headingDeg: 180 }
  );
  const firstReadback = first.outcome.readback.id;
  const moving = Suite.advance(first.state, 2);
  const beforeSecondCommand = moving.aircraft.headingDeg;

  const second = Suite.applyCommand(
    moving,
    { type: 'turn-to-heading', side: 'left', headingDeg: 10 }
  );

  assert.equal(second.outcome.accepted, true);
  assert.equal(second.outcome.cancelledReadbackId, firstReadback);
  assert.equal(second.state.aircraft.turn.side, 'left');
  assert.equal(second.state.aircraft.headingDeg, beforeSecondCommand, 'a command must not teleport the aircraft');
  assert.equal(second.state.activeReadback.id, second.outcome.readback.id);
  assert.deepEqual(
    second.state.events.filter(event => event.type === 'COMMAND_ACCEPTED').map(event => event.command.side),
    ['right', 'left']
  );
  assert.ok(second.state.events.some(event => event.type === 'READBACK_INTERRUPTED' && event.readbackId === firstReadback));

  const reversed = Suite.advance(second.state, .25);
  assert.ok(reversed.aircraft.headingDeg < beforeSecondCommand);
});

test('U/S Compass timed turns reverse independently and never generate a heading readback', () => {
  const initial = scenario({ qghProcedure: 'us', initialHeadingDeg: 120 });
  const left = Suite.applyCommand(initial, { type: 'turn-now', side: 'left' });
  const turningLeft = Suite.advance(left.state, 1);
  near(turningLeft.aircraft.headingDeg, 117);

  const right = Suite.applyCommand(turningLeft, { type: 'turn-now', side: 'right' });
  assert.equal(right.outcome.accepted, true);
  assert.equal(right.state.aircraft.turn.side, 'right');
  assert.doesNotMatch(right.outcome.readback.text, /\b\d{3}\b/);
  const turningRight = Suite.advance(right.state, 1);
  near(turningRight.aircraft.headingDeg, 120);

  const stopped = Suite.applyCommand(turningRight, { type: 'stop-turn' });
  assert.equal(stopped.state.aircraft.turn.mode, 'straight');
  assert.doesNotMatch(stopped.outcome.readback.text, /\b\d{3}\b/);
});

test('one 60-second advance is identical to repeated quarter-second advances', () => {
  const turning = Suite.applyCommand(
    scenario({ initialHeadingDeg: 20 }),
    { type: 'turn-to-heading', side: 'right', headingDeg: 200 }
  ).state;
  const commanded = Suite.applyCommand(
    turning,
    { type: 'set-altitude', direction: 'climb', altitudeFt: 9000 }
  ).state;
  const once = Suite.advance(commanded, 60);
  let repeated = commanded;
  for (let index = 0; index < 240; index += 1) repeated = Suite.advance(repeated, .25);
  assert.deepEqual(once, repeated);
});

test('surveillance accepts heading-directed turns using the shared flight model', () => {
  const initial = scenario({ exerciseFamily: 'surveillance', initialHeadingDeg: 350 });
  const result = Suite.applyCommand(initial, {
    type: 'turn-to-heading', side: 'right', headingDeg: 80
  });
  assert.equal(result.outcome.accepted, true);
  assert.equal(result.state.aircraft.turn.side, 'right');
  const turning = Suite.advance(result.state, 5);
  const continued = Suite.applyCommand(turning, { type: 'continue-heading', headingDeg: 95 });
  assert.equal(continued.outcome.accepted, true);
  assert.equal(continued.state.aircraft.turn.side, 'right');
  const advanced = Suite.advance(continued.state, 30);
  near(advanced.aircraft.headingDeg, 95, 1e-8);
  assert.equal(advanced.aircraft.turn.mode, 'straight');
});

test('SRA descent uses the selected vertical rate and clamps exactly at target altitude', () => {
  const initial = scenario({ exerciseFamily: 'sra', altitudeFt: 9000, verticalRateFpm: 1200 });
  const result = Suite.applyCommand(initial, {
    type: 'set-altitude', direction: 'descend', altitudeFt: 8000
  });
  assert.equal(result.outcome.accepted, true);
  assert.equal(result.state.aircraft.vertical.mode, 'DESCENT');
  assert.equal(result.state.aircraft.vertical.targetAltitudeFt, 8000);
  assert.match(result.outcome.readback.text, /DESCENDING TO ALTITUDE 8000 FEET/);

  const descending = Suite.advance(result.state, 30);
  near(descending.aircraft.altitudeFt, 8400);
  assert.equal(descending.aircraft.vertical.mode, 'DESCENT');
  const level = Suite.advance(descending, 20);
  assert.equal(level.aircraft.altitudeFt, 8000);
  assert.equal(level.aircraft.vertical.mode, 'LEVEL');
});

test('PAR maintain command levels the aircraft without changing horizontal state', () => {
  const initial = scenario({ exerciseFamily: 'par', altitudeFt: 9000, verticalRateFpm: 1200 });
  const climbing = Suite.applyCommand(initial, {
    type: 'set-altitude', direction: 'climb', altitudeFt: 10000
  }).state;
  const airborne = Suite.advance(climbing, 15);
  near(airborne.aircraft.altitudeFt, 9300);
  const positionBeforeMaintain = airborne.aircraft.position;

  const maintained = Suite.applyCommand(airborne, {
    type: 'set-altitude', direction: 'maintain', altitudeFt: 9300
  });
  assert.equal(maintained.outcome.accepted, true);
  assert.equal(maintained.state.aircraft.vertical.mode, 'LEVEL');
  assert.equal(maintained.state.aircraft.vertical.targetAltitudeFt, 9300);
  assert.match(maintained.outcome.readback.text, /MAINTAINING ALTITUDE 9300 FEET/);
  assert.deepEqual(maintained.state.aircraft.position, positionBeforeMaintain);

  const later = Suite.advance(maintained.state, 10);
  assert.equal(later.aircraft.altitudeFt, 9300);
  assert.ok(later.aircraft.position.xNm !== positionBeforeMaintain.xNm
    || later.aircraft.position.yNm !== positionBeforeMaintain.yNm);
});

test('surveillance position report samples current QTE and range without changing flight state', () => {
  const initial = scenario({ exerciseFamily: 'surveillance', initialQteDeg: 75, initialRangeNm: 18 });
  const result = Suite.applyCommand(initial, { type: 'report-position' });
  assert.equal(result.outcome.accepted, true);
  assert.equal(result.outcome.executionStatus, 'RECEIVED');
  assert.deepEqual(result.outcome.mutations, []);
  near(result.outcome.report.qteDeg, 75);
  near(result.outcome.report.rangeNm, 18);
  assert.match(result.outcome.readback.text, /QTE 075 DEGREES, RANGE 18\.0 NAUTICAL MILES/);
  assert.deepEqual(result.state.aircraft, initial.aircraft);
});

test('continue approach is a non-mutating deterministic response in SRA and PAR only', () => {
  for (const exerciseFamily of ['sra', 'par']) {
    const initial = scenario({ exerciseFamily });
    const result = Suite.applyCommand(initial, { type: 'continue-approach' });
    assert.equal(result.outcome.accepted, true);
    assert.equal(result.outcome.executionStatus, 'RECEIVED');
    assert.deepEqual(result.outcome.mutations, []);
    assert.equal(result.outcome.report.status, 'continuing-approach');
    assert.match(result.outcome.readback.text, /CONTINUING APPROACH/);
    assert.deepEqual(result.state.aircraft, initial.aircraft);
  }
  const rejected = Suite.applyCommand(scenario({ exerciseFamily: 'surveillance' }), { type: 'continue-approach' });
  assert.equal(rejected.outcome.accepted, false);
});

test('runway visual report uses the documented simulator training gate without operational-minima claims', () => {
  const sighted = Suite.applyCommand(scenario({
    exerciseFamily: 'par',
    initialQteDeg: 45,
    initialRangeNm: 2.5,
    initialHeadingDeg: 225,
    finalTrackDeg: 225,
    altitudeFt: 2500
  }), { type: 'report-runway-visual' });
  assert.equal(sighted.outcome.report.runwayVisual, true);
  assert.equal(sighted.outcome.report.trainingGate.trainingOnly, true);
  assert.deepEqual(sighted.outcome.report.trainingGate.limits, {
    maximumRangeNm: 3,
    maximumAltitudeFt: 3000,
    maximumTrackErrorDeg: 30
  });
  assert.match(sighted.outcome.readback.text, /RUNWAY IN SIGHT/);
  assert.doesNotMatch(sighted.outcome.readback.text, /MINIMUM|CLEARED|APPROVED/);

  const rejectedFixtures = [
    { initialRangeNm: 3.1, altitudeFt: 2500, initialHeadingDeg: 225 },
    { initialRangeNm: 2.5, altitudeFt: 3100, initialHeadingDeg: 225 },
    { initialRangeNm: 2.5, altitudeFt: 2500, initialHeadingDeg: 256 }
  ];
  rejectedFixtures.forEach(fixture => {
    const result = Suite.applyCommand(scenario({
      exerciseFamily: 'sra',
      finalTrackDeg: 225,
      ...fixture
    }), { type: 'report-runway-visual' });
    assert.equal(result.outcome.report.runwayVisual, false);
    assert.match(result.outcome.readback.text, /NEGATIVE, RUNWAY NOT IN SIGHT/);
  });
});

test('invalid commands return a frozen rejection without mutating the source state', () => {
  const initial = scenario();
  const before = JSON.stringify(initial);
  const result = Suite.applyCommand(initial, { type: 'turn-now', side: 'right' });
  assert.equal(result.outcome.accepted, false);
  assert.equal(result.outcome.executionStatus, 'NOT_APPLIED');
  assert.equal(JSON.stringify(initial), before);
  assert.equal(result.state.aircraft.headingDeg, initial.aircraft.headingDeg);
  assert.ok(Object.isFrozen(result.outcome));
});
