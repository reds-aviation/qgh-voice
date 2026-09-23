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

test('instructor offers a dedicated same-browser student window and second-display placement', () => {
  const page = html();
  assert.match(page, /Same browser · dedicated student window/);
  assert.match(page, /OPEN \/ FOCUS/);
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

test('instructor keeps aircraft selection and the control rail adjacent to the truth scope', () => {
  const page = html();
  assert.match(page, /class="console-toolbar"[\s\S]*id="aircraftRosterTabs"/);
  assert.match(page, /class="console-center"[\s\S]*id="instructorScope"/);
  assert.match(page, /class="console-control-rail"[\s\S]*id="truthCallsign"[\s\S]*class="command-deck"/);
});

test('instructor live console exposes clearly labelled practical training time rates', () => {
  const page = html();
  assert.match(page, /id="trainingTimeRate"/);
  assert.match(page, /1× REAL/);
  assert.match(page, /5× TRAINING/);
  assert.match(page, /10× FAST/);
  assert.match(page, /id="trainingRateStatus"/);
});
