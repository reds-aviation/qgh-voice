'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Sensors = require('../suite-sensors.js');
const Session = require('../suite-session.js');

function fleet(time = 0, count = 24) {
  return { simulationSeconds: time, aircraft: Array.from({ length: count }, (_, index) => {
    const bearing = Math.floor(index / 2) * 30 * Math.PI / 180;
    const range = 10 + index / 2;
    return { id: `private-${index}`, callsign: `RED ${index + 1}`,
      position: { xNm: Math.sin(bearing) * range, yNm: -Math.cos(bearing) * range },
      altitudeFt: 5000 + index * 100, headingDeg: 90 };
  }) };
}

function correlatedFleet(time = 0, count = 24) {
  const truth = fleet(time, count);
  truth.aircraft.forEach((aircraft, index) => {
    aircraft.surveillance = { secondary: true, modeS: true,
      squawk: (0o4300 + index).toString(8).padStart(4, '0'),
      modeSId: (0xA10000 + index).toString(16).toUpperCase().padStart(6, '0') };
  });
  return truth;
}

test('24 targets scan independently, including identical bearings, with bounded per-track histories', () => {
  const sensor = Sensors.createSurveillanceSensor({ rpm: 12, history: 5 });
  sensor.advance(30.01, fleet);
  const observation = sensor.studentObservation();
  assert.equal(observation.plots?.length, 24);
  assert.equal(new Set(observation.plots.map(plot => plot.trackId)).size, 24);
  assert.equal(observation.history.length, 120);
  for (const plot of observation.plots) {
    assert.match(plot.trackId, /^T\d+$/);
    assert.equal(observation.history.filter(item => item.trackId === plot.trackId).length, 5);
    assert.ok(observation.history.filter(item => item.trackId === plot.trackId).every(item => item.timestamp < plot.timestamp));
  }
  assert.equal(sensor.observations().length, 24 * 6);
  assert.ok(sensor.observations().every((sample, index, list) => !index || sample.timestamp >= list[index - 1].timestamp));
  assert.doesNotMatch(JSON.stringify(observation), /private-|RED |altitude|heading|position|xNm|yNm/);
  sensor.setHistory(3);
  assert.equal(sensor.studentObservation().history.length, 72);
  sensor.setHistory(0);
  assert.equal(sensor.studentObservation().history.length, 0);
});

test('fleet radar keeps correlations and independent loss at scan time', () => {
  const sensor = Sensors.createSurveillanceSensor({ rpm: 12, profile: 'correlated', history: 5 });
  sensor.advance(5.01, time => correlatedFleet(time, 3));
  const first = sensor.studentObservation();
  assert.equal(first.plots?.length, 3);
  assert.equal(first.plots.find(plot => plot.callsign === 'RED 2').altitudeFt, 5100);
  const lost = time => { const truth = correlatedFleet(time, 3); truth.aircraft[1].position.yNm = -300; return truth; };
  sensor.advance(9.9, lost);
  assert.equal(sensor.studentObservation().plots.length, 3, 'loss is revealed by the next scan');
  sensor.advance(10.01, lost);
  assert.equal(sensor.studentObservation().plots.length, 2);
  assert.ok(sensor.studentObservation().plots.every(plot => plot.callsign !== 'RED 2'));
  const missing = time => { const truth = correlatedFleet(time, 3); truth.aircraft = truth.aircraft.filter(item => item.id !== 'private-0'); return truth; };
  sensor.advance(15.01, missing);
  assert.ok(sensor.studentObservation().plots.every(plot => plot.callsign !== 'RED 1'));
});

test('accelerated fleet surveillance agrees with stepped scans', () => {
  const options = { rpm: 15, initialAzimuthDeg: 70, profile: 'correlated' };
  const accelerated = Sensors.createSurveillanceSensor(options);
  const stepped = Sensors.createSurveillanceSensor(options);
  const moving = time => { const truth = fleet(time); truth.aircraft.forEach(item => { item.position.xNm += time / 100; }); return truth; };
  accelerated.advance(60, moving);
  for (let time = 1; time <= 60; time++) stepped.advance(time, moving);
  assert.deepEqual(accelerated.observations(), stepped.observations());
  assert.deepEqual(accelerated.studentObservation(), stepped.studentObservation());
});

test('DF routes the transmitting source across selection changes and exposes only pilot or held identity', () => {
  const sensor = Sensors.createDfSensor();
  const truth = fleet(0, 3);
  const token = sensor.beginTransmission({ source: 'private-2' }, truth, 0);
  assert.equal(sensor.studentObservation('qte', 0).callsign, 'RED 3');
  const changedSelection = { ...truth, aircraft: [...truth.aircraft].reverse(), selectedAircraftId: 'private-0' };
  assert.equal(sensor.studentObservation('qte', 0.5, changedSelection).bearingDeg, 30);
  assert.equal(sensor.studentObservation('qte', 0.5).callsign, 'RED 3');
  sensor.endTransmission(changedSelection, 1, token);
  assert.equal(sensor.studentObservation('qte', 2).callsign, 'RED 3');
  assert.equal(sensor.studentObservation('qte', 3).callsign, undefined);
  assert.equal(Sensors.bearingFrom(truth.aircraft[0], { source: 'private-2' }), null);
  assert.equal(Sensors.bearingFrom({ aircraft: truth.aircraft[0] }, { source: 'private-2' }), null);
});

test('PAR retains chosen fleet source and refresh boundaries', () => {
  const par = Sensors.createParSensor({ source: 'private-1', refreshHz: 5, runwayHeadingDeg: 180 });
  const samples = par.advance(1, time => fleet(time, 3));
  assert.deepEqual(samples.map(item => item.timestamp), [0.2, 0.4, 0.6, 0.8, 1]);
  assert.equal(par.studentObservation().rangeNm, 10.5);
});

test('wire sanitizer preserves bounded fleet identity, strips primary labels and rejects oversized arrays', () => {
  const sensor = Sensors.createSurveillanceSensor({ profile: 'correlated', history: 5 });
  sensor.advance(30.01, correlatedFleet);
  const raw = { mode: 'surveillance', ...sensor.studentObservation() };
  const correlated = Session.sanitizeStudentObservation(raw, { radarProfile: 'correlated' });
  assert.equal(correlated.plots?.length, 24);
  assert.equal(correlated.history.length, 120);
  assert.equal(correlated.plots[0].callsign, 'RED 1');
  const primary = Session.sanitizeStudentObservation(raw, { radarProfile: 'primary' });
  assert.equal(primary.plots[0].trackId, correlated.plots[0].trackId);
  assert.doesNotMatch(JSON.stringify(primary), /callsign|altitude/);
  assert.throws(() => Session.sanitizeStudentObservation({ ...raw, plots: [...raw.plots, raw.plots[0]] }), /invalid-plots/);
  assert.throws(() => Session.sanitizeStudentObservation({ ...raw, history: [...raw.history, raw.history[0]] }), /invalid-history/);
  assert.throws(() => Session.sanitizeStudentObservation({ mode: 'par', history: Array(6).fill({}) }), /invalid-history/);
  assert.throws(() => Session.sanitizeStudentObservation({ ...raw, plots: [{ trackId: 'T'.repeat(33) }] }), /invalid-trackId/);
  assert.throws(() => Session.sanitizeStudentObservation({ ...raw, plots: [{ trackId: 'T1', position: { x: 1, y: 2 } }] }), /truth-shaped/);
  const df = Session.sanitizeStudentObservation({ mode: 'qgh', transmissionState: 'pilot', callsign: 'RED 3' });
  assert.equal(df.callsign, 'RED 3');
  assert.equal(Session.sanitizeStudentObservation({ mode: 'qgh', transmissionState: 'idle', callsign: 'RED 3' }).callsign, undefined);
});

test('public fleet metadata validates count, approach callsign and glidepath', () => {
  assert.deepEqual(Session.sanitizePublicMetadata({ mode: 'par', aircraftCount: 24, approachCallsign: 'RED 3', glidepathDeg: 3 }),
    { mode: 'par', aircraftCount: 24, approachCallsign: 'RED 3', glidepathDeg: 3 });
  for (const count of [0, 25, 1.5, '2']) assert.throws(() => Session.sanitizePublicMetadata({ aircraftCount: count }), /invalid-aircraftCount/);
  for (const value of [-1, 91, Infinity]) assert.throws(() => Session.sanitizePublicMetadata({ glidepathDeg: value }), /invalid-glidepathDeg/);
});

test('a full 24-aircraft sensor scan crosses the instructor/student session boundary without truth', () => {
  const hub = Session.createFakeTransportHub();
  const transportFactory = name => hub.createTransport(name);
  let random = 1;
  const crypto = { getRandomValues(array) { for (let index = 0; index < array.length; index++) array[index] = random++; return array; } };
  const now = () => 1000;
  const host = Session.createInstructorSession({ now, crypto, transportFactory, pin: '123456',
    publicMetadata: { mode: 'surveillance', radarProfile: 'primary', aircraftCount: 24 } });
  const student = Session.createStudentSession({ now, crypto, transportFactory, pin: host.pin,
    discovery: { sessionId: host.sessionId, channelName: host.channelName, expiresAt: 100000 } });
  student.requestJoin();
  assert.equal(host.admit(student.clientId), true);
  student.ready();
  assert.equal(host.start(), true);
  const sensor = Sensors.createSurveillanceSensor({ profile: 'correlated', history: 5 });
  sensor.advance(30.01, fleet);
  const sent = host.publishObservation(sensor.studentObservation(), 30.01);
  const received = student.snapshot();
  assert.deepEqual(received.observation, sent);
  assert.equal(received.publicMetadata.aircraftCount, 24);
  assert.equal(received.observation.plots.length, 24);
  assert.equal(received.observation.history.length, 120);
  assert.doesNotMatch(JSON.stringify(received.observation), /private-|RED |altitude|heading|position|xNm|yNm/);
  host.close();
  student.close();
});
