'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Sensors = require('../suite-sensors.js');

const stationary = () => ({ id: 'A1', callsign: '430', position: { xNm: 0, yNm: -15 }, altitudeFt: 6000 });

test('review keeps truth, observations and events on one authoritative time base', () => {
  const timeline = Sensors.createReviewTimeline();
  timeline.recordTruth({ timestamp: 0, xNm: 0, yNm: -15, headingDeg: 180 });
  timeline.recordEvent({ timestamp: 1, kind: 'command', text: 'TURN RIGHT 220' });
  timeline.recordObservation('surveillance', { timestamp: 5, bearingDeg: 0, rangeNm: 15 });
  timeline.recordTruth({ timestamp: 5, xNm: 0, yNm: -14.5, headingDeg: 185 });
  const result = timeline.snapshot();
  assert.equal(result.durationSeconds, 5);
  assert.equal(result.observations[0].sensor, 'surveillance');
  assert.equal(result.observations[0].timestamp, result.truth[1].timestamp);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.observations));
});

test('review observation times are identical for accelerated and short sensor stepping', () => {
  function run(accelerated) {
    const sensor = Sensors.createSurveillanceSensor({ rpm: 12 });
    if (accelerated) sensor.advance(60, stationary);
    else for (let second = 1; second <= 60; second += 1) sensor.advance(second, stationary);
    const timeline = Sensors.createReviewTimeline();
    for (const observation of sensor.observations()) timeline.recordObservation('surveillance', observation);
    return timeline.snapshot().observations;
  }
  assert.deepEqual(run(true), run(false));
});

test('review rejects backwards timestamps rather than silently reordering evidence', () => {
  const timeline = Sensors.createReviewTimeline();
  timeline.recordObservation('par', { timestamp: 2, trackState: 'tracked' });
  assert.throws(() => timeline.recordObservation('par', { timestamp: 1, trackState: 'tracked' }), /monotonic/i);
  timeline.recordEvent({ timestamp: 5, kind: 'reply' });
  assert.throws(() => timeline.recordEvent({ timestamp: 4, kind: 'command' }), /monotonic/i);
});
