'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const Session = require('../suite-session.js');

function deterministicCrypto(seed = 1) {
  let next = seed;
  return { getRandomValues(array) { for (let i = 0; i < array.length; i += 1) array[i] = next++; return array; } };
}

function studentMessage(overrides = {}) {
  return {
    protocol: Session.PROTOCOL_VERSION,
    type: Session.TYPES.JOIN_REQUEST,
    sessionId: '0123456789abcdef0123456789abcdef',
    senderRole: 'student', senderId: 'student_00000001', revision: 1,
    simulationTime: 0, sentAt: 1000,
    payload: { clientId: 'student_00000001', pin: '431230', seat: 'controller' },
    ...overrides
  };
}

function instructorHarness() {
  const hub = Session.createFakeTransportHub();
  const events = [];
  const instructor = Session.createInstructorSession({ now: () => 1000, pin: '431230',
    sessionId: '0123456789abcdef0123456789abcdef', senderId: 'host_000000000001',
    crypto: deterministicCrypto(4), transportFactory: name => hub.createTransport(name),
    publicMetadata: { mode: 'surveillance', radarProfile: 'primary', scanRpm: 12, revisitSeconds: 5 },
    onEvent: event => events.push(event) });
  return { instructor, events, hub };
}

test('six-digit PINs use the supplied cryptographic random source', () => {
  let calls = 0;
  const crypto = { getRandomValues(array) { calls += 1; array[0] = 777777; return array; } };
  assert.match(Session.generatePin(crypto), /^\d{6}$/);
  assert.equal(calls, 1);
  assert.throws(() => Session.generatePin({}), /cryptographically secure/);
});

test('localStorage discovery contains routing metadata only and expires after fifteen minutes', () => {
  const values = new Map();
  const storage = { setItem: (key, value) => values.set(key, value), getItem: key => values.get(key) || null,
    removeItem: key => values.delete(key) };
  assert.equal(Session.writeDiscovery(storage, { pin: '431230', sessionId: '0123456789abcdef0123456789abcdef',
    channelName: 'reds-atc-suite-test', createdAt: 1000, expiresAt: 1000 + Session.PIN_TTL_MS,
    truth: { x: 1 }, heading: 230 }), true);
  const [key, raw] = [...values.entries()][0];
  assert.match(key, /431230$/);
  assert.doesNotMatch(raw, /truth|heading|431230/);
  assert.ok(Session.readDiscovery(storage, '431230', 1001));
  assert.equal(Session.readDiscovery(storage, '431230', 1000 + Session.PIN_TTL_MS), null);
});

test('wrong-session, stale, oversized, unknown and student-mutation messages are rejected', () => {
  const h = instructorHarness();
  assert.equal(h.instructor.receive(studentMessage({ sessionId: 'ffffffffffffffffffffffffffffffff' })).reason, 'wrong-session');
  assert.equal(h.instructor.receive(studentMessage()).ok, true);
  assert.equal(h.instructor.receive(studentMessage()).reason, 'stale-revision');

  const oversized = studentMessage({ revision: 2, payload: { clientId: 'student_00000001', pin: '431230',
    seat: 'controller', padding: 'a'.repeat(Session.MAX_MESSAGE_BYTES) } });
  assert.equal(h.instructor.receive(oversized).reason, 'oversized');
  assert.equal(h.instructor.receive(studentMessage({ revision: 2, type: 'invented-command' })).reason, 'unknown-type');
  assert.equal(h.instructor.receive(studentMessage({ revision: 2, type: Session.TYPES.OBSERVATION,
    payload: { clientId: 'student_00000001' } })).reason, 'student-mutation');
  assert.equal(h.instructor.receive(studentMessage({ revision: 2, truth: { x: 1 } })).reason, 'invalid-envelope-fields');
});

test('student messages cannot carry truth fields or aircraft-control mutations', () => {
  const h = instructorHarness();
  for (const payload of [
    { clientId: 'student_00000001', pin: '431230', seat: 'controller', x: 4 },
    { clientId: 'student_00000001', pin: '431230', seat: 'controller', nested: { heading: 230 } },
    { clientId: 'student_00000001', pin: '431230', seat: 'controller', controlState: { turn: 'right' } }
  ]) {
    assert.equal(h.instructor.receive(studentMessage({ payload })).reason, 'truth-shaped-payload');
  }
  assert.equal(h.instructor.snapshot().admittedClientId, null);
  assert.ok(h.events.every(event => event.kind !== 'student-admitted'));
});

test('student receiver rejects truth-shaped or extra-field instructor payloads', () => {
  const base = {
    protocol: Session.PROTOCOL_VERSION,
    type: Session.TYPES.OBSERVATION,
    sessionId: '0123456789abcdef0123456789abcdef',
    senderRole: 'instructor', senderId: 'host_000000000001', revision: 1,
    simulationTime: 0, sentAt: 1000, targetClientId: 'student_00000001',
    payload: { observation: { mode: 'qgh', status: 'live', bearingType: 'qdm', bearingDeg: 140, x: 2 } }
  };
  assert.equal(Session.validateInstructorMessage(base, { sessionId: base.sessionId }).reason, 'truth-shaped-payload');
  const extra = { ...base, payload: { observation: { mode: 'qgh', status: 'idle' }, aircraftMutation: 'turn-right' } };
  assert.equal(Session.validateInstructorMessage(extra, { sessionId: base.sessionId }).reason, 'invalid-instructor-payload');
});

test('student observation sanitizer rejects raw truth and emits only mode allowlists', () => {
  assert.throws(() => Session.sanitizeStudentObservation({ mode: 'qgh', status: 'live', bearingDeg: 148,
    heading: 30, x: 4, y: 5 }), /truth-shaped/);
  const qgh = Session.sanitizeStudentObservation({ mode: 'qgh', status: 'live', transmissionState: 'pilot',
    bearingType: 'qdm', bearingDeg: 148, benignInternalNote: 'dropped' });
  assert.deepEqual(Object.keys(qgh).sort(), ['bearingDeg', 'bearingType', 'mode', 'status', 'transmissionState'].sort());
  assert.equal(qgh.benignInternalNote, undefined);

  const primary = Session.sanitizeStudentObservation({ mode: 'surveillance', scanAngleDeg: 220,
    plot: { azimuthDeg: 220, rangeNm: 18, callsign: 'FALCON 11', altitudeFt: 5000, headingDeg: 220, groundSpeedKt: 250, timestamp: 10 },
    history: [{ azimuthDeg: 218, rangeNm: 19, timestamp: 5 }] }, { radarProfile: 'primary' });
  assert.equal(primary.plot.callsign, undefined, 'Primary-only plots do not imply identity');
  assert.equal(primary.plot.altitudeFt, undefined, 'Primary-only plots do not imply altitude');
  assert.equal(primary.plot.headingDeg, undefined, 'Primary-only plots do not imply heading');
  assert.equal(primary.plot.groundSpeedKt, undefined, 'Primary-only plots do not imply speed');
  assert.equal(primary.history.length, 1);
  const correlated = Session.sanitizeStudentObservation({ mode: 'surveillance', scanAngleDeg: 220,
    plot: { azimuthDeg: 220, rangeNm: 18, callsign: 'FALCON 11', altitudeFt: 5000, headingDeg: 220, groundSpeedKt: 250, timestamp: 10,
      surveillance: { secondary: true, squawk: '4301' } } },
  { radarProfile: 'correlated-training' });
  assert.equal(correlated.plot.callsign, 'FALCON 11');
  assert.equal(correlated.plot.altitudeFt, 5000);
  assert.equal(correlated.plot.headingDeg, 220);
  assert.equal(correlated.plot.groundSpeedKt, 250);
  const mixedPrimary = Session.sanitizeStudentObservation({ mode: 'surveillance', scanAngleDeg: 220,
    plot: { azimuthDeg: 220, rangeNm: 18, callsign: 'MUST STAY PRIMARY', altitudeFt: 5000, headingDeg: 220, groundSpeedKt: 250, timestamp: 10 } },
  { radarProfile: 'correlated-training' });
  assert.deepEqual(mixedPrimary.plot, { azimuthDeg: 220, rangeNm: 18, timestamp: 10 });
  assert.throws(() => Session.sanitizeStudentObservation({ mode: 'surveillance',
    plot: { azimuthDeg: 220, rangeNm: 18, headingDeg: 361, surveillance: { secondary: true, squawk: '4301' } } }, { radarProfile: 'correlated-training' }), /invalid-headingDeg/);
});

test('session sanitizer preserves the exact U1/U2 QGH, SRA and PAR projection shapes', () => {
  const wrappedQgh = Session.sanitizeStudentObservation({ mode: 'qgh', publicScenario: { qghProcedure: 'normal' },
    observation: { status: 'held', transmissionState: 'held', bearingType: 'qte', bearingDeg: 328 } });
  assert.deepEqual(wrappedQgh, { mode: 'qgh', status: 'held', transmissionState: 'held', bearingType: 'qte', bearingDeg: 328 });
  const sra = Session.sanitizeStudentObservation({ mode: 'sra', scanAngleDeg: 50,
    plot: { rangeNm: 9, azimuthDeg: 48, timestamp: 5, callsign: '430', altitudeFt: 5000, surveillance: { secondary: true, squawk: '4301' } },
    overlays: { runwayOrientationDeg: 230, centrelineDeg: 230, touchdownRangeNm: 1, terminationRangeNm: 12 } },
  { radarProfile: 'correlated-training' });
  assert.deepEqual(sra.overlays, { runwayOrientationDeg: 230, centrelineDeg: 230, touchdownRangeNm: 1, terminationRangeNm: 12 });
  assert.equal(sra.plot.callsign, '430');
  const par = Session.sanitizeStudentObservation({ mode: 'par', timestamp: 4, rangeNm: 7.2,
    azimuth: { deviationDeg: -.8, trend: 'closing' }, elevation: { deviationDeg: .3, trend: 'stable' },
    trackState: 'tracking', history: [{ timestamp: 3, rangeNm: 7.4, azimuthDeviationDeg: -1, elevationDeviationDeg: .4 }] });
  assert.deepEqual(par.azimuth, { deviationDeg: -.8, trend: 'closing' });
  assert.equal(par.history[0].elevationDeviationDeg, .4);
});

test('unsafe public metadata is rejected rather than hidden with CSS or silently serialized', () => {
  assert.throws(() => Session.sanitizePublicMetadata({ mode: 'sra', initialHeading: 230 }), /truth-shaped/);
  const safe = Session.sanitizePublicMetadata({ mode: 'sra', runwayOrientation: 230, finalTrack: 230,
    radarProfile: 'correlated-training', scanRpm: 15, revisitSeconds: 4, unknown: 'omitted' });
  assert.equal(safe.unknown, undefined);
  assert.deepEqual(Object.keys(safe).sort(),
    ['mode', 'runwayOrientation', 'finalTrack', 'radarProfile', 'scanRpm', 'revisitSeconds'].sort());
  assert.throws(() => Session.sanitizePublicMetadata({ mode: 'surveillance', scanRpm: 11 }), /invalid-scanRpm/);
  assert.throws(() => Session.sanitizePublicMetadata({ mode: 'par', parRefreshHz: 3 }), /invalid-parRefreshHz/);
  assert.equal(Session.sanitizePublicMetadata({ mode: 'surveillance', radarProfile: 'correlated' }).radarProfile,
    'correlated-training');
});

test('future student time and repeated revisions cannot influence the authoritative session', () => {
  const h = instructorHarness();
  const future = studentMessage({ simulationTime: 60 });
  assert.equal(h.instructor.receive(future).reason, 'future-student-time');
  assert.equal(h.instructor.snapshot().simulationTime, 0);
  assert.equal(h.instructor.receive(studentMessage()).ok, true);
  assert.equal(h.instructor.receive(studentMessage()).reason, 'stale-revision');
  assert.equal(h.instructor.snapshot().simulationTime, 0);
});
