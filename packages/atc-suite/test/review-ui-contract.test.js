const test = require('node:test');
const assert = require('node:assert/strict');

const Review = require('../suite-review.js');

test('review layer selection never mutates the source record', () => {
  const source = {
    truth: [{ time: 1, x: 1 }],
    observations: [{ time: 1, bearing: 20 }],
    events: [{ time: 1, kind: 'command' }]
  };
  const before = JSON.stringify(source);
  const selected = Review.selectLayers(source, { truth: false, observations: true, events: true });
  assert.deepEqual(selected.truth, []);
  assert.equal(selected.observations.length, 1);
  assert.equal(JSON.stringify(source), before);
});
