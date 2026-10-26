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

const root = join(__dirname, '..');
const html = () => readFileSync(join(root, 'instructor.html'), 'utf8');

test('instructor setup contains all manual scenario inputs and lifecycle controls', () => {
  const page = html();
  for (const id of ['exerciseFamily', 'procedureType', 'callsign', 'initialBearing', 'initialRange',
    'initialHeading', 'initialAltitude', 'initialSpeed', 'turnRate', 'runwayOrientation',
    'finalTrack', 'createSession', 'admitStudent', 'startExercise', 'pauseExercise',
    'terminateExercise', 'restartExercise', 'openStudentDisplay', 'moveStudentDisplay',
    'studentDisplayStatus']) assert.match(page, new RegExp(`id="${id}"`));
});

test('instructor offers optional controller entry and second-display placement', () => {
  const page = html();
  assert.match(page, /same PC and browser profile/);
  assert.match(page, /OPEN CONTROLLER ENTRY/);
  assert.doesNotMatch(page, /CREATE SESSION &amp; OPEN STUDENT DISPLAY/);
  assert.match(page, /MOVE TO SECOND DISPLAY/);
  assert.match(page, /aria-live="polite"/);
  assert.doesNotMatch(page, /Same-browser tabs only/);
});

test('instructor page labels equipment views as training representations', () => {
  assert.match(html(), /inspired training representation/i);
});

test('surveillance, SRA and PAR controls include position and approach actions', () => {
  const page = html();
  for (const id of ['radarApproachCommands', 'reportPosition', 'continueApproach',
    'reportRunwayVisual', 'missedApproach', 'climbTo', 'descendTo',
    'parTransferGate', 'parTransferGateStatus', 'transferToPar', 'extendedCentreline',
    'extendedCentrelineNm', 'centrelineTickNm', 'localLfaEnabled', 'localLfaRadius',
    'sraDescentProfile']) {
    assert.match(page, new RegExp(`id="${id}"`));
  }
  assert.match(page, /PAR TRANSFER GATE · NM/);
  assert.match(page, /TRANSFER SELECTED AIRCRAFT TO PAR/);
  assert.match(page, /LOCAL TRAINING LFA BOUNDARY/);
  assert.match(page, /SRA 3° DESCENT TRAINING GUIDE/);
});

test('instructor roster exposes a per-aircraft primary, Mode A and Mode S return selector', () => {
  const page = html();
  assert.match(page, /id="radarReturn"[^>]*data-radar-return-auto="true"/);
  assert.match(page, /<option value="primary">PRIMARY · \+<\/option>/);
  assert.match(page, /<option value="mode-a">MODE A · □<\/option>/);
  assert.match(page, /<option value="mode-s">MODE S · □<\/option>/);
});

test('Position report is a primary aircraft action outside the approach-only section', () => {
  const page = html();
  const actions = page.match(/class="command-grid command-grid--actions"([\s\S]*?)<\/div>/)?.[1];
  assert.match(actions, /id="reportPosition"/);
  assert.match(actions, /POSITION REPORT/);
  assert.equal((page.match(/id="reportPosition"/g) || []).length, 1, 'A single button retains the existing report handler');
  assert.ok(page.indexOf('id="reportPosition"') < page.indexOf('id="radarApproachCommands"'));
});

test('instructor keeps aircraft selection, lifecycle and command controls beside the truth scope', () => {
  const page = html();
  assert.match(page, /class="console-toolbar"[\s\S]*id="aircraftRosterTabs"[\s\S]*id="startExercise"[\s\S]*id="pauseExercise"[\s\S]*id="terminateExercise"/);
  assert.match(page, /class="console-center"[\s\S]*id="instructorScope"/);
  assert.match(page, /class="console-control-rail"[\s\S]*class="command-deck"[\s\S]*id="truthCallsign"/);
});

test('instructor live console exposes clearly labelled practical training time rates', () => {
  const page = html();
  assert.match(page, /id="trainingTimeRate"/);
  assert.match(page, /1× REAL/);
  assert.match(page, /5× TRAINING/);
  assert.match(page, /10× FAST/);
  assert.match(page, /id="trainingRateStatus"/);
});
