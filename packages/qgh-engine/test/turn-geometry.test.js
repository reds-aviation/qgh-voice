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

const assert = require('node:assert/strict');
const test = require('node:test');
const { advanceArc, turnRadiusNm } = require('../simulator-core.js');

test('turn radius scales with speed at a fixed rate of turn', () => {
  assert.ok(Math.abs(turnRadiusNm(120, 3) - 0.63662) < 0.0001);
  assert.ok(Math.abs(turnRadiusNm(240, 3) - 1.27324) < 0.0001);
});

test('turn radius halves when the selected rate of turn doubles', () => {
  assert.ok(Math.abs(turnRadiusNm(240, 6) - 0.63662) < 0.0001);
});

test('a right quarter-turn follows a circular arc instead of a point corner', () => {
  const result = advanceArc({ x: 0, y: 0 }, 0, 120, 3, 30);
  const radius = turnRadiusNm(120, 3);

  assert.ok(Math.abs(result.x - radius) < 0.0001);
  assert.ok(Math.abs(result.y + radius) < 0.0001);
  assert.equal(Math.round(result.heading), 90);
});

test('straight flight still uses the expected distance and heading', () => {
  const result = advanceArc({ x: 0, y: 0 }, 0, 180, 0, 20);

  assert.ok(Math.abs(result.x) < 0.000001);
  assert.ok(Math.abs(result.y + 1) < 0.000001);
  assert.equal(result.heading, 0);
});

test('arc integration rejects invalid coordinates and headings', () => {
  assert.throws(() => advanceArc({ x: Number.NaN, y: 0 }, 0, 120, 3, 1), /finite numbers/);
  assert.throws(() => advanceArc({ x: 0, y: 0 }, Number.NaN, 120, 3, 1), /finite numbers/);
});
