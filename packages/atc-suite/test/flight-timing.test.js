'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Suite = require('../suite-core.js');
const Flight = require('../../qgh-engine/simulator-core.js');
const Tactical = require('../../qgh-engine/tactical-core.js');

function near(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

function state(family = 'surveillance', heading = 0) {
  return Suite.createState({ exerciseFamily: family, runwayOrientationDeg: 0, finalTrackDeg: 0,
    aircraft: [{ callsign: '101', initialQteDeg: 90, initialRangeNm: 10, initialHeadingDeg: heading,
      speedKt: 240, altitudeFt: 10000, verticalRateFpm: 1200, rateDegPerSecond: 3 }] });
}

test('all instructor families cover 4 NM per simulated minute at 240 kt', () => {
  for (const family of ['qgh', 'surveillance', 'sra']) for (const heading of [0, 90, 180, 270]) {
    const initial = state(family, heading);
    const result = Suite.advance(initial, 60);
    near(Math.hypot(result.aircraft.position.xNm - initial.aircraft.position.xNm,
      result.aircraft.position.yNm - initial.aircraft.position.yNm), 4);
    near(result.simulationSeconds, 60);
  }
});

test('a final partial heading step turns at 3 deg/s then uses the remaining time straight', () => {
  for (const side of ['left', 'right']) {
    const target = side === 'left' ? 0 : 359;
    const initial = state('surveillance', side === 'left' ? .4 : 358.6);
    const turning = Suite.applyCommand(initial, { type: 'turn-to-heading', side, headingDeg: target }).state;
    const result = Suite.advance(turning, .25).aircraft;
    const turnSeconds = .4 / 3;
    const radius = 240 / 3600 / (3 * Math.PI / 180);
    const startAngle = initial.aircraft.headingDeg * Math.PI / 180;
    const endAngle = target * Math.PI / 180;
    const signedRadius = (side === 'left' ? -1 : 1) * radius;
    const straightDistance = 240 / 3600 * (.25 - turnSeconds);
    const expectedX = initial.aircraft.position.xNm + signedRadius * (Math.cos(startAngle) - Math.cos(endAngle))
      + straightDistance * Math.sin(endAngle);
    const expectedY = initial.aircraft.position.yNm + signedRadius * (Math.sin(startAngle) - Math.sin(endAngle))
      - straightDistance * Math.cos(endAngle);
    near(result.position.xNm, expectedX);
    near(result.position.yNm, expectedY);
    near(result.headingDeg, target);
    assert.equal(result.turn.mode, 'straight');
  }
});

test('Tactical heading completion preserves the selected turn radius inside a long step', () => {
  const exercise = Tactical.createExercise({ procedure: 'normal', runway: 0, outbound: 0, inbound: 180,
    randomizeInitial: false, aircraft: [
      { id: 'A', callsign: '101', type: 'fighter', speed: 240, rate: 3, distance: 10 },
      { id: 'B', callsign: '102', type: 'fighter', speed: 240, rate: 3, distance: 12 }
    ] });
  const aircraft = Tactical.getAircraft(exercise, 'A');
  aircraft.plane = { x: 0, y: 0, heading: 0 };
  aircraft.targetHeading = 1;
  aircraft.forcedTurnSide = 'right';
  aircraft.initialTurnSide = aircraft.manualTurnSide = null;
  Tactical.step(exercise, 1);
  const radius = Flight.turnRadiusNm(240, 3), angle = Math.PI / 180;
  near(aircraft.plane.x, radius * (1 - Math.cos(angle)) + 240 / 3600 * (2 / 3) * Math.sin(angle));
  near(aircraft.plane.y, -radius * Math.sin(angle) - 240 / 3600 * (2 / 3) * Math.cos(angle));
  near(aircraft.plane.heading, 1);
});
