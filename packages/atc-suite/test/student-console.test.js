'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

function fixture(mode) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { id, value: '40', hidden: false, width: 1000, height: 800,
      addEventListener() {}, getBoundingClientRect: () => ({ left: 20, top: 50, width: 1000, height: 800 }),
      setPointerCapture() {}, releasePointerCapture() {}, getContext: () => new Proxy({}, { get: () => () => {} }) });
    return nodes.get(id);
  };
  let source = readFileSync(join(__dirname, '../suite-student.js'), 'utf8');
  source = source.slice(0, source.indexOf("  byId('radarOverlayCentreline').checked")) +
    '\n globalThis.fixture={state, projectStudentPoint, inverseStudentPoint, studentScopePointerDown, studentScopePointerMove, studentScopePointerUp, chooseMode};})();';
  const classes = new Set();
  const context = { document: { getElementById: node, body: { classList: { toggle(name, value) { value ? classes.add(name) : classes.delete(name); } } } },
    ATCSuiteSession: {}, matchMedia: () => ({ matches: true }), performance: { now: () => 0 }, console };
  vm.runInNewContext(source, context);
  context.fixture.state.metadata = { mode, radarProfile: 'primary-only' };
  return { ...context.fixture, node, classes };
}

test('student manual estimate positions roundtrip at every scope range and preserve sensor observations', () => {
  for (const mode of ['qgh', 'surveillance', 'sra']) {
    const h = fixture(mode), observation = Object.freeze({ bearingDeg: 120, bearingType: 'qte', status: 'held' });
    h.state.observation = observation; h.state.scopePan = { x: 83, y: -61 };
    for (const range of [10, 20, 40, 60, 100]) {
      h.node('radarRange').value = String(range); h.node('studentScopeRange').value = String(range);
      const [x, y] = h.projectStudentPoint(4, -7);
      const point = h.inverseStudentPoint({ clientX: x + 20, clientY: y + 50 });
      assert.ok(Math.abs(point.xNm - 4) < 1e-9); assert.ok(Math.abs(point.yNm + 7) < 1e-9);
      assert.equal(h.state.observation, observation, 'manual estimates cannot alter the sensor observation');
    }
  }
});

test('QGH, SRA and vectoring student scopes remain available in portrait without instructor truth inputs', () => {
  for (const mode of ['qgh', 'surveillance', 'sra']) {
    const h = fixture(mode); h.chooseMode(mode);
    assert.equal(h.node('orientationGate').hidden, true); assert.equal(h.classes.has('narrow-radar'), false);
    assert.equal(h.node('studentEstimateScopePanel').hidden, mode !== 'qgh');
  }
  const html = readFileSync(join(__dirname, '../student.html'), 'utf8');
  assert.match(html, /id="student-estimate-panel"/); assert.match(html, /id="studentEstimateScope"/);
  assert.doesNotMatch(html, /id="(?:turnHeadingInput|quickTurnLeft|instructorScope|initialHeading)"/);
});

test('manual plotting consumes an estimate drag before ordinary student scope panning', () => {
  const h = fixture('qgh'), seen = [];
  h.state.plotting = { onPointerDown(e) { seen.push(e.pointerId); return true; }, onPointerMove() { return true; }, onPointerUp() { return true; } };
  h.studentScopePointerDown({ button: 0, pointerId: 7, clientX: 200, clientY: 300 });
  h.studentScopePointerMove({ pointerId: 7, clientX: 220, clientY: 350 });
  h.studentScopePointerUp({ pointerId: 7 });
  assert.deepEqual(seen, [7]); assert.equal(h.state.scopeDrag, null);
  assert.equal(h.state.scopePan.x, 0); assert.equal(h.state.scopePan.y, 0);
});
