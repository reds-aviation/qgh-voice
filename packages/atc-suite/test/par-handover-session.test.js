'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Session = require('../suite-session.js');

function crypto(seed = 1) {
  let next = seed;
  return { getRandomValues(array) { for (let index = 0; index < array.length; index += 1) array[index] = next++; return array; } };
}

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}

test('PAR handover metadata replaces the controller display family and clears stale radar observations', () => {
  const hub = Session.createFakeTransportHub();
  const sharedStorage = storage();
  const instructor = Session.createInstructorSession({
    now: () => 1000, crypto: crypto(2), pin: '430431', storage: sharedStorage,
    transportFactory: name => hub.createTransport(name),
    publicMetadata: { mode: 'surveillance', aircraftCount: 1, radarProfile: 'correlated-training',
      runwayOrientation: 230, finalTrack: 230, scanRpm: 12, revisitSeconds: 5 }
  });
  const events = [];
  const student = Session.createStudentSession({ now: () => 1000, crypto: crypto(50), pin: '430431', storage: sharedStorage,
    clientId: 'student_00000001', transportFactory: name => hub.createTransport(name), onEvent: event => events.push(event) });
  student.requestJoin(); instructor.admit(student.clientId); student.ready(); instructor.start(0);
  instructor.publishObservation({ mode: 'surveillance', scanAngleDeg: 30,
    plots: [{ trackId: 'T1', timestamp: 0, rangeNm: 9, azimuthDeg: 50, callsign: '101', altitudeFt: 5000 }] }, 0);
  assert.equal(student.snapshot().observation.mode, 'surveillance');

  const updated = instructor.updatePublicMetadata({ mode: 'par', aircraftCount: 1, approachCallsign: '101',
    runwayOrientation: 230, finalTrack: 230, glidepathDeg: 3, parRefreshHz: 1, historyCount: 3 }, 1);
  assert.equal(updated.mode, 'par');
  assert.equal(student.snapshot().publicMetadata.mode, 'par');
  assert.equal(student.snapshot().publicMetadata.approachCallsign, '101');
  assert.equal(student.snapshot().observation, null, 'old surveillance plot cannot render under PAR');
  assert.ok(events.some(event => event.kind === 'public-metadata'));

  instructor.publishObservation({ mode: 'par', timestamp: 2, rangeNm: 8.5, trackState: 'tracking',
    azimuth: { deviationDeg: .2, trend: 'stable' }, elevation: { deviationDeg: -.1, trend: 'closing' }, history: [] }, 2);
  assert.equal(student.snapshot().observation.mode, 'par');
  assert.equal(student.snapshot().observation.rangeNm, 8.5);
});

test('metadata handover is unavailable before the controller position is running', () => {
  const hub = Session.createFakeTransportHub();
  const instructor = Session.createInstructorSession({ now: () => 1000, crypto: crypto(4), pin: '430431',
    transportFactory: name => hub.createTransport(name), publicMetadata: { mode: 'surveillance' } });
  assert.equal(instructor.updatePublicMetadata({ mode: 'par' }, 0), false);
});
