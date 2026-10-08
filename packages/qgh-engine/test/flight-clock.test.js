'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFlightClock } = require('../simulator-core.js');

test('bounded clock accumulates actual time while preserving quarter-second flight samples', () => {
  const clock = createFlightClock(); clock.reset(0);
  assert.deepEqual(clock.consume(600), { steps: 2, suspended: false });
  assert.deepEqual(clock.consume(650), { steps: 0, suspended: false });
  assert.deepEqual(clock.consume(750), { steps: 1, suspended: false });
  assert.deepEqual(clock.consume(2750), { steps: 8, suspended: false });
  assert.deepEqual(clock.consume(4751), { steps: 0, suspended: true });
  clock.reset(10000);
  assert.deepEqual(clock.consume(10250), { steps: 1, suspended: false });
});

test('flight clock rejects invalid dimensions and timestamps', () => {
  assert.throws(() => createFlightClock(0), /positive step/);
  assert.throws(() => createFlightClock(.25, .1), /bounded processing gap/);
  assert.throws(() => createFlightClock().consume(NaN), /finite/);
});
