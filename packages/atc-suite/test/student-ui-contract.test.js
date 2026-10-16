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
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const page = readFileSync(join(__dirname, '..', 'student.html'), 'utf8');

test('student shell has join, ready, QGH, surveillance and PAR regions', () => {
  for (const id of ['joinPin', 'joinSession', 'studentReady', 'qghStudentView', 'radarStudentView',
    'parStudentView', 'orientationGate', 'studentCaption', 'studentClock', 'radarScopeControls',
    'radarLabelCallsign', 'radarLabelSquawk', 'radarLabelModeS', 'radarLabelLevel', 'radarLabelSpeed', 'radarLabelHeading',
    'radarLabelBearingRange', 'radarOverlayCentreline', 'radarOverlayDescent', 'radarInspection',
    'inspectGroundSpeed', 'inspectHeading', 'inspectBearingRange']) {
    assert.match(page, new RegExp(`id="${id}"`));
  }
});

test('student markup does not contain instructor truth or aircraft control fields', () => {
  for (const forbidden of ['initialHeading', 'initialBearing', 'truthTrail', 'turnHeadingInput', 'instructorScope']) {
    assert.doesNotMatch(page, new RegExp(`id="${forbidden}"`));
  }
});
