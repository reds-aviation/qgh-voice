'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Sensors = require('../suite-sensors.js');

function finalApproach(timestamp) {
  const rangeNm = 10 - timestamp * 0.05;
  const expectedFt = Math.tan(3 * Math.PI / 180) * rangeNm * 6076.12;
  return { id: 'A1', callsign: 'FALCON 11', position: { xNm: 0.4 - timestamp * 0.02, yNm: -rangeNm },
    altitudeFt: expectedFt + 100 - timestamp * 2 };
}

test('PAR samples lateral and elevation data only at configured 1 Hz and 5 Hz boundaries', () => {
  const oneHz = Sensors.createParSensor({ refreshHz: 1, runwayHeadingDeg: 180, history: 5 });
  assert.equal(oneHz.advance(0.99, finalApproach).length, 0);
  assert.deepEqual(oneHz.advance(3.01, finalApproach).map(item => item.timestamp), [1, 2, 3]);
  const sample = oneHz.observations()[0];
  assert.equal(sample.trackState, 'tracked');
  assert.ok(Number.isFinite(sample.lateralDeviationNm));
  assert.ok(Number.isFinite(sample.verticalDeviationFt));
  assert.ok(Number.isFinite(sample.azimuthDeviationDeg));
  assert.ok(Number.isFinite(sample.glidepathDeviationDeg));
  const publicSample = oneHz.studentObservation();
  assert.equal(publicSample.trackState, 'tracking');
  assert.ok(Number.isFinite(publicSample.azimuth.deviationDeg));
  assert.ok(Number.isFinite(publicSample.elevation.deviationDeg));

  const fiveHz = Sensors.createParSensor({ refreshHz: 5, runwayHeadingDeg: 180 });
  assert.deepEqual(fiveHz.advance(1.01, finalApproach).map(item => item.timestamp), [0.2, 0.4, 0.6, 0.8, 1]);
});

test('one-call PAR acceleration matches repeated short advances', () => {
  const accelerated = Sensors.createParSensor({ refreshHz: 5, runwayHeadingDeg: 180, history: 5 });
  const stepped = Sensors.createParSensor({ refreshHz: 5, runwayHeadingDeg: 180, history: 5 });
  accelerated.advance(12, finalApproach);
  for (let second = 1; second <= 12; second += 1) stepped.advance(second, finalApproach);
  assert.deepEqual(accelerated.observations(), stepped.observations());
  assert.equal(accelerated.observations().length, 60);
});

test('PAR history settings retain prior measured plots and expose trend without truth coordinates', () => {
  const sensor = Sensors.createParSensor({ refreshHz: 1, runwayHeadingDeg: 180, history: 0 });
  sensor.advance(7, finalApproach);
  assert.equal(sensor.getDisplay().history.length, 0);
  sensor.setHistory(3);
  assert.equal(sensor.getDisplay().history.length, 3);
  sensor.setHistory(5);
  const display = sensor.getDisplay();
  assert.equal(display.history.length, 5);
  assert.ok(['closing', 'steady', 'diverging'].includes(display.current.lateralTrend));
  assert.equal(Object.prototype.hasOwnProperty.call(display.current, 'xNm'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(display.current, 'headingDeg'), false);
});

test('PAR reports track loss outside the training coverage or after touchdown', () => {
  const sensor = Sensors.createParSensor({ refreshHz: 1, runwayHeadingDeg: 180, maxRangeNm: 20 });
  sensor.advance(1, () => ({ position: { xNm: 0, yNm: -25 }, altitudeFt: 5000 }));
  assert.equal(sensor.getDisplay().trackState, 'lost');
  assert.equal(sensor.observations()[0].reason, 'outside-coverage');

  const past = Sensors.createParSensor({ refreshHz: 1, runwayHeadingDeg: 180, maxRangeNm: 20 });
  past.advance(1, () => ({ position: { xNm: 0, yNm: 1 }, altitudeFt: 100 }));
  assert.equal(past.observations()[0].reason, 'past-touchdown');
});
