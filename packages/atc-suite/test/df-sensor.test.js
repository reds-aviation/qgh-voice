'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Sensors = require('../suite-sensors.js');

function aircraft(xNm, yNm, fields = {}) {
  return { id: 'A1', callsign: 'FALCON 11', position: { xNm, yNm }, altitudeFt: 6000, ...fields };
}

test('DF is live during aircraft transmission, freezes both references for two seconds, then blanks', () => {
  const sensor = Sensors.createDfSensor();
  const token = sensor.beginTransmission({ source: 'A1', transmissionId: 'reply-1' }, aircraft(10, 0), 0);
  const live = sensor.read(0.5, aircraft(0, 10));
  assert.equal(live.phase, 'live');
  assert.equal(live.qte, 180);
  assert.equal(live.qdm, 0);

  const held = sensor.endTransmission(aircraft(0, 10), 1, token);
  assert.equal(held.phase, 'held');
  assert.equal(held.qte, 180);
  assert.equal(held.qdm, 0);
  assert.equal(sensor.read(2.999, aircraft(-10, 0)).qte, 180, 'held sample is not recomputed from continuing motion');
  assert.deepEqual(sensor.studentObservation('qdm', 2.999), {
    status: 'held', transmissionState: 'held', bearingType: 'qdm', bearingDeg: 0, callsign: 'FALCON 11'
  });
  assert.equal(sensor.read(3).phase, 'idle');
});

test('DF exposes unavailable near overhead without inventing a bearing', () => {
  const sensor = Sensors.createDfSensor({ overheadZoneNm: 0.25 });
  const token = sensor.beginTransmission({ source: 'A1' }, aircraft(0.1, 0.1), 0);
  const live = sensor.read(0.5);
  assert.equal(live.phase, 'unavailable');
  assert.equal(live.signalPhase, 'live');
  assert.equal(live.reason, 'overhead');
  assert.equal(live.qdm, null);
  assert.equal(live.qte, null);
  const held = sensor.endTransmission(aircraft(0.1, 0.1), 1, token);
  assert.equal(held.phase, 'unavailable');
  assert.equal(held.signalPhase, 'held');
  assert.equal(sensor.read(2).reason, 'overhead');
});

test('a new DF transmission supersedes a held indication and stale releases are ignored', () => {
  const sensor = Sensors.createDfSensor();
  const first = sensor.beginTransmission({ source: 'A1', transmissionId: 'first' }, aircraft(10, 0), 0);
  sensor.endTransmission(aircraft(10, 0), 0.5, first);
  const second = sensor.beginTransmission({ source: 'A1', transmissionId: 'second' }, aircraft(0, -10), 1);
  sensor.endTransmission(aircraft(-10, 0), 1.25, first);
  const live = sensor.read(1.5, aircraft(0, -10));
  assert.equal(live.phase, 'live');
  assert.equal(live.transmissionId, 'second');
  assert.equal(live.qte, 0);
  sensor.endTransmission(aircraft(0, -10), 2, second);
  assert.equal(sensor.read(2.5).phase, 'held');
});

test('DF accepts a suite truth snapshot and uses QTE/QDM rather than hidden heading', () => {
  const snapshot = { timestamp: 4, aircraft: { id: 'A1', callsign: '430', position: { xNm: 10, yNm: 0 },
    headingDeg: 12, altitudeFt: 9000 } };
  const sample = Sensors.bearingFrom(snapshot, { source: 'A1' });
  assert.equal(sample.qte, 90);
  assert.equal(sample.qdm, 270);
  assert.equal(Object.prototype.hasOwnProperty.call(sample, 'headingDeg'), false);
});
