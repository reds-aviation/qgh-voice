const test = require('node:test');
const assert = require('node:assert/strict');

const Review = require('../suite-review.js');

test('normal heading instructions use three-digit deterministic readbacks', () => {
  assert.equal(
    Review.readbackFor({ type: 'turn-heading', direction: 'right', heading: 5 }, 'FALCON 11'),
    'FALCON 11, TURNING RIGHT HEADING 005'
  );
});

test('U/S compass commands acknowledge direction without inventing a heading', () => {
  assert.equal(Review.readbackFor({ type: 'turn-now', direction: 'left' }, 'RAVEN 430'), 'RAVEN 430, TURNING LEFT');
  assert.equal(Review.readbackFor({ type: 'stop-turn' }, 'RAVEN 430'), 'RAVEN 430, STOPPING TURN');
});

test('readback controller cancels an obsolete reply before starting the replacement', async () => {
  const actions = [];
  const controller = Review.createReadbackController({
    speak: async (text, signal) => {
      actions.push(`start:${text}`);
      await new Promise(resolve => {
        signal.addEventListener('abort', () => { actions.push(`abort:${text}`); resolve(); }, { once: true });
      });
    }
  });
  controller.play('FIRST');
  await Promise.resolve();
  controller.play('SECOND');
  await Promise.resolve();
  assert.deepEqual(actions.slice(0, 3), ['start:FIRST', 'abort:FIRST', 'start:SECOND']);
  controller.cancel();
});

test('review timeline is stable and ordered on authoritative simulation time', () => {
  const timeline = Review.buildTimeline({
    truth: [{ time: 2, x: 1 }, { time: 1, x: 0 }],
    observations: [{ time: 1.5, kind: 'radar' }],
    events: [{ time: 1.25, kind: 'command' }]
  });
  assert.deepEqual(timeline.map(item => item.time), [1, 1.25, 1.5, 2]);
  assert.deepEqual(timeline.map(item => item.layer), ['truth', 'events', 'observations', 'truth']);
});
