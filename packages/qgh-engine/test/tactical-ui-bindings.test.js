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
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const engineDirectory = path.join(__dirname, '..');
const htmlPath = path.join(engineDirectory, 'tactical.html');
const simulatorPath = path.join(engineDirectory, 'tactical-simulator.js');

test('Tactical QGH page contains all tactical controller bindings', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const simulator = fs.readFileSync(simulatorPath, 'utf8');
  const pageIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const lookedUpIds = [...simulator.matchAll(/\$\('([^']+)'\)/g)].map(match => match[1]);
  const missingIds = [...new Set(lookedUpIds.filter(id => !pageIds.has(id)))];

  assert.deepEqual(missingIds, []);
  assert.match(html, /tactical-core\.js/);
  assert.match(html, /tactical-workspace\.js/);
  assert.match(html, /tactical-simulator\.js/);
  assert.match(simulator, /TRANSMIT FOR D\/F/);
  assert.match(simulator, /ADVANCE FLIGHT/);
  assert.match(simulator, /QGHTacticalReview/);
  assert.match(html, /FORMATION FLIGHT/);
  assert.match(html, /tFormationLeader/);
  assert.match(html, /tStopFollowing/);
  assert.match(simulator, /formationRoleFor/);
  assert.match(simulator, /stopFollowingLeader/);
  assert.match(simulator, /VERTICAL SEPARATION/);
  assert.match(simulator, /railItems: new Map\(\)/);
  assert.match(simulator, /function buildRailItem/);
  assert.match(simulator, /state\.activeAircraftId = state\.exercise\.formation/);
  assert.match(html, /data-tactical-replay-speed="10"/);
  assert.match(html, /tZoomToggle/);
  assert.match(html, /tTerminateDialog/);
  assert.match(simulator, /replayPaused/);
  assert.match(simulator, /setReviewZoom/);
});
