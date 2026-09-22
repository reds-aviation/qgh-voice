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
