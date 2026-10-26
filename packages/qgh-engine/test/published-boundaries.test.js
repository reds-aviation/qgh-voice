/* ATS SIM BOX — Copyright (c) 2026 Balaram Reddy. CPAL-1.0; see LICENSE. */
const test = require('node:test');
const assert = require('node:assert/strict');
const Boundaries = require('../published-boundaries.js');
// Deliberately synthetic coordinates: test fixtures are never a published map.
function fixture(kind = 'IB') {
  return { id: 'synthetic-test', name: 'Synthetic test boundary', kind, label: kind,
    geometry: { type: 'MultiLineString', coordinates: [[[-10, 20], [10, 20]]] },
    source: { authority: 'Synthetic test authority', title: 'Test fixture only', section: 'Test 1', url: 'https://example.test/fixture', crs: 'EPSG:4326', coordinateOrder: 'longitude-latitude', effectiveDate: '2026-01-01' },
    verification: { status: 'verified', verifiedBy: 'Unit test', verifiedAt: '2026-01-02', approvalReference: 'Synthetic fixture — not real boundary data' } };
}
function context() {
  return { paths: [], texts: [], path: [], save() {}, restore() {}, beginPath() { this.path = []; }, moveTo(x, y) { this.path.push([x, y]); }, lineTo(x, y) { this.path.push([x, y]); }, setLineDash(value) { this.dash = value; },
    stroke() { this.paths.push({ colour: this.strokeStyle, width: this.lineWidth, points: this.path, dash: this.dash }); }, measureText(text) { return { width: text.length * 7 }; }, fillRect() {}, strokeRect() {}, fillText(text, x, y) { this.texts.push({ text, x, y }); } };
}
test('boundary validation preserves exact line geometry and requires dated provenance', () => {
  const input = fixture('LoC'), before = JSON.stringify(input), result = Boundaries.normalizeBoundaries([input]);
  assert.equal(result[0].kind, 'LoC'); assert.equal(result[0].label, 'LoC'); assert.deepEqual(result[0].geometry, input.geometry);
  assert.equal(JSON.stringify(input), before); assert.notEqual(result[0].geometry.coordinates, input.geometry.coordinates);
  for (const mutate of [f => f.label = 'IB', f => f.kind = 'international-boundary', f => f.source.crs = 'unknown', f => delete f.source.effectiveDate,
    f => f.source.effectiveDate = '2026-02-30', f => f.verification.status = 'unverified', f => delete f.verification.approvalReference,
    f => f.source.coordinateOrder = 'latitude-longitude', f => f.geometry.coordinates[0][0] = [10, 86], f => f.geometry.type = 'Polygon']) {
    const value = fixture('LoC'); mutate(value); assert.throws(() => Boundaries.normalizeBoundaries([value]));
  }
});
test('boundary limits reject oversized geometry without simplification or partial import', () => {
  const value = fixture(); value.geometry.coordinates[0] = Array.from({ length: 1025 }, (_, i) => [i / 100, 20]);
  assert.throws(() => Boundaries.normalizeBoundaries([value]), /1,024/);
  assert.throws(() => Boundaries.normalizeBoundaries([fixture(), fixture()]), /unique/);
});
test('missing or future boundary sources remain unavailable without fabricated fallback', () => {
  assert.equal(Boundaries.availability([]).status, 'unavailable');
  const future = fixture(); future.source.effectiveDate = '2099-01-01';
  const result = Boundaries.availability([future], { asOf: '2026-10-25' });
  assert.equal(result.features.length, 0); assert.match(result.issues.join(' '), /future/);
  const c = context(); Boundaries.drawBoundaries(c, { features: [], project: (x, y) => [x, y], viewport: { x: 0, y: 0, width: 100, height: 100 } });
  assert.equal(c.paths.length, 0);
});
test('boundary line is clipped to viewport with contrasting halo and repeated exact kind labels', () => {
  const value = fixture('LoC'), before = JSON.stringify(value), c = context();
  const result = Boundaries.drawBoundaries(c, { features: [value], project: (x, y) => [x * 100 + 400, y * 10], viewport: { x: 0, y: 0, width: 800, height: 400 }, asOf: '2026-10-25' });
  assert.deepEqual(result.segments[0].points, [[0, 200], [800, 200]]);
  assert.deepEqual(c.paths.map(p => p.colour), ['#07131d', '#f4f8fc', '#ff334f']);
  assert.ok(result.labels.length >= 4); assert.ok(c.texts.every(t => t.text === 'LoC')); assert.equal(JSON.stringify(value), before);
  const hidden = context(); Boundaries.drawBoundaries(hidden, { features: [value], project: (x, y) => [x, y], viewport: { x: 0, y: 0, width: 800, height: 400 }, visibleIds: [] });
  assert.equal(hidden.paths.length, 0);
});
test('boundary labels avoid scope controls and bad projection cannot break the scope', () => {
  const c = context(), obstacle = { x: 10, y: 170, width: 300, height: 80 };
  const result = Boundaries.drawBoundaries(c, { features: [fixture()], project: (x, y) => [x * 100 + 400, y * 10], viewport: { x: 0, y: 0, width: 800, height: 400 }, obstacles: [obstacle] });
  assert.ok(result.labels.every(b => b.x >= obstacle.x + obstacle.width || b.x + b.width <= obstacle.x));
  assert.doesNotThrow(() => Boundaries.drawBoundaries(c, { features: [fixture()], project() { throw new Error('No origin'); }, viewport: { x: 0, y: 0, width: 800, height: 400 } }));
});
test('geographic projection uses east and north about the published origin', () => {
  const origin = { latitude: 30, longitude: 75 };
  assert.deepEqual(Boundaries.projectGeographic(75, 30, origin), { xNm: 0, yNm: 0 });
  assert.ok(Boundaries.projectGeographic(75.1, 30, origin).xNm > 0);
  assert.ok(Boundaries.projectGeographic(75, 30.1, origin).yNm > 0);
  assert.throws(() => Boundaries.projectGeographic(75, 30, null), /origin/);
});
