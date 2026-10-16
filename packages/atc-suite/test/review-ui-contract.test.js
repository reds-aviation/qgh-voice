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
