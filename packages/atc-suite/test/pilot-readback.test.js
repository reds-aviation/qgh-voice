/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

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
