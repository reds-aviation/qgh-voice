'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Sensors = require('../suite-sensors.js');
const Session = require('../suite-session.js');

const stationary = () => ({ id: 'A1', callsign: '430', position: { xNm: 0, yNm: -20 }, altitudeFt: 7000,
  headingDeg: 225, speedKt: 240, surveillance: { secondary: true, modeS: true, squawk: '4301', modeSId: 'A1B2C3' } });

test('a northbound correlated track rounds 359.6 degrees to 000 and remains publishable', () => {
  const sensor = Sensors.createSurveillanceSensor({ rpm:15, profile:'correlated' });
  const angle = 359.6 * Math.PI / 180;
  sensor.advance(12.1, seconds => ({ ...stationary(), position:{ xNm: Math.sin(angle)*seconds*240/3600, yNm:-20-Math.cos(angle)*seconds*240/3600 } }));
  const picture = sensor.studentObservation();
  assert.equal(picture.plot.headingDeg, 0);
  assert.doesNotThrow(() => Session.sanitizeStudentObservation(picture,{mode:'surveillance',radarProfile:'correlated-training'}));
});

test('10, 12 and 15 RPM presets emit only beam-crossing plots at nominal revisits', () => {
  for (const [rpm, revisit] of [[10, 6], [12, 5], [15, 4]]) {
    const sensor = Sensors.createSurveillanceSensor({ rpm, initialAzimuthDeg: 0, history: 5 });
    const observations = sensor.advance(revisit * 3 + 0.01, stationary);
    assert.deepEqual(observations.map(item => Number(item.timestamp.toFixed(6))), [revisit, revisit * 2, revisit * 3], rpm + ' RPM');
    assert.ok(observations.every(item => item.revisitSeconds === revisit));
    assert.ok(observations.every(item => item.detected));
  }
});

test('one-minute acceleration emits the same radar observations as short stepping', () => {
  const accelerated = Sensors.createSurveillanceSensor({ rpm: 12, initialAzimuthDeg: 90 });
  const stepped = Sensors.createSurveillanceSensor({ rpm: 12, initialAzimuthDeg: 90 });
  accelerated.advance(60, stationary);
  for (let second = 1; second <= 60; second += 1) stepped.advance(second, stationary);
  assert.deepEqual(accelerated.observations(), stepped.observations());
  assert.equal(accelerated.observations().length, 12);
});

test('history Off, 3 and 5 contains prior sensor plots only', () => {
  const sensor = Sensors.createSurveillanceSensor({ rpm: 15, initialAzimuthDeg: 0, history: 0 });
  sensor.advance(24.01, stationary);
  assert.equal(sensor.getDisplay().history.length, 0);
  sensor.setHistory(3);
  assert.equal(sensor.getDisplay().history.length, 3);
  sensor.setHistory(5);
  const display = sensor.getDisplay();
  assert.equal(display.history.length, 5);
  assert.ok(display.history.every(item => item.sensor === 'surveillance'));
  assert.ok(display.history.every(item => !Object.prototype.hasOwnProperty.call(item, 'x')));
  assert.ok(display.history.every(item => !Object.prototype.hasOwnProperty.call(item, 'headingDeg')));
});

test('Primary Only does not expose data while Correlated Training emits sampled cooperative values', () => {
  const primary = Sensors.createSurveillanceSensor({ rpm: 15, profile: 'primary' });
  const correlated = Sensors.createSurveillanceSensor({ rpm: 15, profile: 'correlated' });
  primary.advance(4.01, stationary);
  correlated.advance(4.01, stationary);
  const raw = primary.observations()[0];
  assert.equal(Object.prototype.hasOwnProperty.call(raw, 'callsign'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(raw, 'levelFt'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(raw, 'headingDeg'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(raw, 'groundSpeedKt'), false);
  assert.equal(correlated.observations()[0].callsign, '430');
  assert.equal(correlated.observations()[0].levelFt, 7000);
  assert.equal(correlated.observations()[0].headingDeg, undefined, 'the first sample has no track-derived heading');
  assert.equal(correlated.observations()[0].groundSpeedKt, undefined, 'the first sample has no track-derived ground speed');
  assert.deepEqual(correlated.observations()[0].surveillance, { secondary: true, modeS: true, squawk: '4301', modeSId: 'A1B2C3' });
  assert.deepEqual(Object.keys(correlated.studentObservation().plot).sort(),
    ['altitudeFt', 'azimuthDeg', 'callsign', 'rangeNm', 'surveillance', 'timestamp']);

  const moving = Sensors.createSurveillanceSensor({ rpm: 15, profile: 'correlated', initialAzimuthDeg: 0 });
  moving.advance(8.1, seconds => ({ id: 'A1', callsign: '430', altitudeFt: 7000,
    position: { xNm: seconds * 240 / 3600, yNm: -20 }, surveillance: { secondary: true, squawk: '4301' } }));
  const tracked = moving.studentObservation().plot;
  assert.equal(tracked.headingDeg, 90, 'heading is derived from two sampled locations');
  assert.equal(tracked.groundSpeedKt, 240, 'ground speed is derived from sampled displacement and time');
});

test('mixed primary, Mode A and Mode S returns gate sampled data per aircraft', () => {
  const sensor = Sensors.createSurveillanceSensor({ rpm: 15, profile: 'correlated', initialAzimuthDeg: 0, history: 3 });
  const at = seconds => ({ aircraft: [
    { id: 'P', callsign: 'PRIMARY', altitudeFt: 6000, position: { xNm: seconds * 240 / 3600, yNm: -20 } },
    { id: 'A', callsign: 'MODE A', altitudeFt: 7000, position: { xNm: seconds * 240 / 3600, yNm: -20 }, surveillance: { secondary: true, squawk: '4301' } },
    { id: 'S', callsign: 'MODE S', altitudeFt: 8000, position: { xNm: seconds * 240 / 3600, yNm: -20 }, surveillance: { secondary: true, modeS: true, squawk: '4302', modeSId: 'A10002' } }
  ] });
  sensor.advance(8.1, at);
  const observation = sensor.studentObservation();
  const primary = observation.plots.find(plot => plot.trackId === 'T1');
  const modeA = observation.plots.find(plot => plot.surveillance?.squawk === '4301');
  const modeS = observation.plots.find(plot => plot.surveillance?.squawk === '4302');

  assert.deepEqual(Object.keys(primary).sort(), ['azimuthDeg', 'rangeNm', 'timestamp', 'trackId']);
  assert.equal(primary.callsign, undefined);
  assert.equal(primary.altitudeFt, undefined);
  assert.equal(primary.headingDeg, undefined);
  assert.equal(primary.groundSpeedKt, undefined);
  assert.equal(primary.surveillance, undefined);
  assert.equal(modeA.callsign, 'MODE A');
  assert.equal(modeA.altitudeFt, 7000);
  assert.equal(modeA.headingDeg, 90);
  assert.equal(modeA.groundSpeedKt, 240);
  assert.deepEqual(modeA.surveillance, { secondary: true, squawk: '4301' });
  assert.equal(modeS.callsign, 'MODE S');
  assert.equal(modeS.altitudeFt, 8000);
  assert.equal(modeS.headingDeg, 90);
  assert.equal(modeS.groundSpeedKt, 240);
  assert.deepEqual(modeS.surveillance, { secondary: true, modeS: true, squawk: '4302', modeSId: 'A10002' });
  assert.ok(observation.history.filter(plot => plot.trackId === 'T1').every(plot => plot.callsign === undefined && plot.surveillance === undefined));
});

test('SRA references are fixed scenario metadata rather than continuous truth', () => {
  const references = Sensors.createSraReferences({ runwayHeadingDeg: 225, rangeMarksNm: [2, 4, 6],
    approachCorridorWidthNm: 1.5, terminationRangeNm: 0.75 });
  assert.equal(references.runwayHeadingDeg, 225);
  assert.equal(references.extendedCentrelineDeg, 45);
  assert.deepEqual(references.rangeMarksNm, [2, 4, 6]);
  assert.equal(references.fidelity, 'training-representation');
  assert.equal(references.runwayOrientationDeg, 225);
  assert.equal(references.centrelineDeg, 45);
  assert.equal(Object.prototype.hasOwnProperty.call(references, 'aircraft'), false);
});
