'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const Suite = require('../suite-core.js');

const FORBIDDEN_KEYS = new Set([
  'x', 'y', 'xNm', 'yNm', 'position', 'heading', 'headingDeg', 'targetHeadingDeg',
  'turn', 'truthTrail', 'events', 'outcomes', 'activeReadback', 'controls', 'aircraft'
]);

function state(exerciseFamily, overrides = {}) {
  return Suite.createState({
    exerciseFamily,
    qghProcedure: overrides.qghProcedure || 'normal',
    callsign: '430',
    aircraftType: 'fighter',
    initialQteDeg: 75,
    initialRangeNm: 18,
    initialHeadingDeg: 240,
    altitudeFt: 9000,
    speedKt: 280,
    rateDegPerSecond: 3,
    runwayOrientationDeg: 230,
    finalTrackDeg: 225,
    surveillanceProfile: overrides.surveillanceProfile || 'primary'
  });
}

function walk(value, visit) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    visit(key, child);
    walk(child, visit);
  }
}

function assertNoTruthLeak(envelope) {
  walk(envelope, key => assert.equal(FORBIDDEN_KEYS.has(key), false, `student envelope leaked ${key}`));
  assert.doesNotMatch(JSON.stringify(envelope), /truthTrail|targetHeadingDeg/);
  assert.ok(Object.isFrozen(envelope));
}

test('QGH student envelope admits only clock, callsign and D/F observation fields', () => {
  const envelope = Suite.studentEnvelope(state('qgh'), {
    status: 'live',
    transmissionState: 'pilot',
    bearingType: 'qdm',
    bearingDeg: 255,
    rangeNm: 18,
    headingDeg: 240,
    nested: { xNm: 10 },
    path: [{ x: 1, y: 2 }]
  });
  assert.deepEqual(envelope.observation, {
    status: 'live', transmissionState: 'pilot', bearingType: 'qdm', bearingDeg: 255
  });
  assert.equal(envelope.publicScenario.callsign, '430');
  assert.equal(envelope.publicScenario.qghProcedure, 'normal');
  assertNoTruthLeak(envelope);
});

test('Primary Only surveillance removes identity and level even from nested plot data', () => {
  const envelope = Suite.studentEnvelope(state('surveillance'), {
    scanAngleDeg: 60,
    plot: { rangeNm: 12.3, azimuthDeg: 61, timestamp: 5, callsign: '430', altitudeFt: 9000, xNm: 4 },
    history: [
      { rangeNm: 13, azimuthDeg: 58, timestamp: 0, callsign: '430', altitudeFt: 9000, yNm: 3 }
    ],
    headingDeg: 240
  });
  assert.deepEqual(envelope.observation.plot, { rangeNm: 12.3, azimuthDeg: 61, timestamp: 5 });
  assert.deepEqual(envelope.observation.history, [{ rangeNm: 13, azimuthDeg: 58, timestamp: 0 }]);
  assert.equal(Object.hasOwn(envelope.publicScenario, 'callsign'), false);
  assertNoTruthLeak(envelope);
});

test('Correlated Training surveillance exposes labels only as declared training correlation', () => {
  const envelope = Suite.studentEnvelope(state('sra', { surveillanceProfile: 'correlated' }), {
    scanAngleDeg: 120,
    plot: { rangeNm: 9, azimuthDeg: 118, timestamp: 10, callsign: '430', altitudeFt: 9000, surveillance: { secondary: true, squawk: '4301' } },
    history: [],
    overlays: { runwayOrientationDeg: 230, centrelineDeg: 230, hiddenHeadingDeg: 240 }
  });
  assert.equal(envelope.publicScenario.displayProfile, 'correlated-training');
  assert.deepEqual(envelope.observation.plot, {
    rangeNm: 9, azimuthDeg: 118, timestamp: 10, callsign: '430', altitudeFt: 9000,
    surveillance: { secondary: true, squawk: '4301' }
  });
  assert.deepEqual(envelope.observation.overlays, { runwayOrientationDeg: 230, centrelineDeg: 230 });
  assertNoTruthLeak(envelope);
});

test('PAR projection accepts panel deviations but strips truth-shaped additions', () => {
  const envelope = Suite.studentEnvelope(state('par'), {
    timestamp: 4,
    rangeNm: 7.2,
    azimuth: { deviationDeg: -.8, trend: 'closing', xNm: 2 },
    elevation: { deviationDeg: .3, trend: 'stable', altitudeFt: 9000 },
    trackState: 'tracking',
    history: [{ timestamp: 3, rangeNm: 7.4, azimuthDeviationDeg: -1, elevationDeviationDeg: .4, headingDeg: 240 }],
    position: { xNm: 2, yNm: 7 }
  });
  assert.deepEqual(envelope.observation, {
    timestamp: 4,
    rangeNm: 7.2,
    azimuth: { deviationDeg: -.8, trend: 'closing' },
    elevation: { deviationDeg: .3, trend: 'stable' },
    trackState: 'tracking',
    history: [{ timestamp: 3, rangeNm: 7.4, azimuthDeviationDeg: -1, elevationDeviationDeg: .4 }]
  });
  assertNoTruthLeak(envelope);
});

test('U/S Compass public state and caption cannot reveal heading', () => {
  const initial = state('qgh', { qghProcedure: 'us' });
  const result = Suite.applyCommand(initial, { type: 'turn-now', side: 'right' });
  const envelope = Suite.studentEnvelope(result.state, {
    status: 'live', transmissionState: 'pilot', bearingType: 'qte', bearingDeg: 75
  }, { caption: result.outcome.readback.text });
  assert.equal(envelope.caption.includes('240'), false);
  assert.equal(JSON.stringify(envelope).includes('240'), false);
  assertNoTruthLeak(envelope);
});
