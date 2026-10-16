/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

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
