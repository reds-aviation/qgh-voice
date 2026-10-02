import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { domHarness } from './testing/dom-harness.mjs';
const source = name => readFileSync(new URL('./static/' + name, import.meta.url), 'utf8');
const uri = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const geometryURI = uri(source('chart-geometry.js'));
const geometry = await import(geometryURI);
const airspace = await import(uri(source('airspace-preparation.js').replace("'./chart-geometry.js'", JSON.stringify(geometryURI))));
const library = await import(uri(source('scenario-library.js')));
const origin = { latitude: 26, longitude: 73 };
const square = [{ xNm: -10, yNm: -10 }, { xNm: 10, yNm: -10 }, { xNm: 10, yNm: 10 }, { xNm: -10, yNm: 10 }];

test('coordinate polygons preserve original WGS84 and projected geometry, including repeated closing point', () => {
    const points = square.map(p => airspace.localToGeographic(p, origin));
    const parsed = airspace.parseBoundary([...points, points[0]].map(p => `${p.latitude},${p.longitude}`).join('\n'), 'geographic', origin);
    assert.equal(parsed.points.length, 4); assert.equal(parsed.geoPoints.length, 4); assert.deepEqual(parsed.coordinateOrigin, origin);
    parsed.points.forEach((p, i) => assert.ok(Math.hypot(p.xNm - square[i].xNm, p.yNm - square[i].yNm) < 1e-7));
    const local = airspace.parseBoundary(square.map(p => `${p.xNm},${p.yNm}`).join('\n'), 'local', origin);
    local.geoPoints.forEach((p, i) => assert.ok(Math.hypot(geometry.project(p, origin).xNm - square[i].xNm, geometry.project(p, origin).yNm - square[i].yNm) < 1e-7));
});
test('invalid geographic, crossing, repeated and empty polygons fail before changing the exercise', () => {
    for (const points of [[], square.slice(0, 2), [...square.slice(0, 3), square[0], square[3]], [{ xNm: 0, yNm: 0 }, { xNm: 1, yNm: 1 }, { xNm: 2, yNm: 2 }], [square[0], square[2], square[1], square[3]], [{ xNm: 3000, yNm: 0 }, square[1], square[2]]]) assert.throws(() => airspace.validateBoundary(points));
    assert.throws(() => airspace.parseBoundary('26,73\n27,73\n27,74', 'geographic', null), /ARP/);
    assert.throws(() => airspace.parseBoundary('91,73\n27,73\n27,74', 'geographic', origin));
    assert.throws(() => airspace.parseBoundary('0,0,2\n1,0\n1,1', 'local', origin));
});
test('published aerodrome picker includes exactly selected routes, fixes and areas, or ARP only', () => {
    const item = { id: 'base', areas: [{ name: 'LFA', kind: 'local-flying' }] };
    const published = { routes: [{ id: 'r1', fixNames: ['A', 'B'] }, { id: 'r2', fixNames: ['B', 'C'] }], fixes: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], areas: [{ id: 'p1', name: 'P area' }] };
    const empty = airspace.selectPublishedCatalogue(item, published, [], []);
    assert.deepEqual(empty.routes, []); assert.deepEqual(empty.fixes, []); assert.deepEqual(empty.areas, []);
    const selected = airspace.selectPublishedCatalogue(item, published, ['r1'], ['base-1']);
    assert.deepEqual(selected.routes.map(r => r.id), ['r1']); assert.deepEqual(selected.fixes.map(f => f.name), ['A', 'B']); assert.deepEqual(selected.areas.map(a => a.name), ['LFA']);
    assert.throws(() => airspace.selectPublishedCatalogue(item, published, ['r3'], []));
    assert.throws(() => airspace.selectPublishedCatalogue(item, { ...published, fixes: [{ name: 'A' }] }, ['r1'], []));
});
const bundle = () => ({ version: 1, scenario: { version: 1, exerciseId: 'live', revision: 4, elapsed: 0, running: false, terminated: false, mode: 'area', title: 'Initial', environment: { chartOrigin: origin, map: { imageId: '' }, qnhHpa: 1013, pin: '123456' }, aircraft: [{ id: 'a1', callsign: '101', xNm: -10, yNm: 0, headingDeg: 90, speedKt: 240, altitudeFt: 10000 }], fixes: [], routes: [], areas: [], criteria: [], calls: [{ text: 'Old call' }], events: [{ text: 'Old event' }], token: 'must-not-export', room: { pin: '123456' }, scopeDisplay: { hiddenAreaIds: [], hiddenRouteIds: [] } }, token: 'top-level-secret' });
test('saved exercise contains reproducible starting geometry without session credentials or progress', () => {
    const template = library.prepareExerciseTemplate(bundle(), 'Assessment A', 'saved-1', '2026-10-03');
    assert.equal(template.name, 'Assessment A'); assert.equal(template.bundle.scenario.title, 'Assessment A');
    assert.equal(template.bundle.scenario.elapsed, 0); assert.equal(template.bundle.scenario.running, false);
    assert.equal(template.bundle.scenario.exerciseId, 'saved-template'); assert.deepEqual(template.bundle.scenario.events, []); assert.deepEqual(template.bundle.scenario.calls, []);
    assert.equal(template.bundle.scenario.aircraft[0].xNm, -10); assert.equal(template.bundle.scenario.environment.qnhHpa, 1013);
    assert.ok(!JSON.stringify(template).includes('must-not-export')); assert.ok(!JSON.stringify(template).includes('123456')); assert.ok(!JSON.stringify(template).includes('top-level-secret'));
    const roundTrip = library.parseExerciseTemplate(JSON.stringify(template)); assert.equal(roundTrip.id, 'saved-1'); assert.equal(roundTrip.bundle.scenario.aircraft[0].headingDeg, 90);
});
test('template rejects progressed traffic, duplicate callsigns, oversized inputs and missing overlay files', () => {
    const progressed = bundle(); progressed.scenario.elapsed = 12; assert.throws(() => library.prepareExerciseTemplate(progressed, 'Invalid'), /before Run/);
    const duplicate = bundle(); duplicate.scenario.aircraft.push({ ...duplicate.scenario.aircraft[0], id: 'a2' }); assert.throws(() => library.prepareExerciseTemplate(duplicate, 'Invalid'), /unique/);
    const missing = bundle(); missing.scenario.environment.map.imageId = 'a'.repeat(64); assert.throws(() => library.prepareExerciseTemplate(missing, 'Invalid'), /no image/);
    assert.throws(() => library.parseExerciseTemplate(' '.repeat(20 * 1024 * 1024 + 1)), /20 MB/);
    assert.throws(() => library.prepareExerciseTemplate(bundle(), ''));
});
test('custom editor shares validated polygon geometry and keeps sketch changes staged', async () => {
    const h = domHarness('<html><head></head><body><section id="tab-build"></section></body></html>');
    const state = { role: 'instructor', exerciseId: 'ex1', running: false, environment: { chartOrigin: origin, rangeNm: 60, aerodromeName: 'Test', chartReference: 'Test chart', effectiveInfo: '2026-10-03', map: {} }, areas: [] };
    const commands = []; Object.assign(h.context, geometry, { host: { view: () => state, generation: () => 1, command: async (...args) => commands.push(args), changed() {}, message() {} } });
    vm.runInContext(source('airspace-preparation.js').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '') + ';globalThis.editor=createAirspacePreparation(host); editor.render();', h.context);
    const form = h.document.getElementById('custom-boundary-form');
    form.elements.namedItem('name').value = 'Test LFA'; form.elements.namedItem('mode').value = 'local'; form.elements.namedItem('points').value = '-10,-10\n10,-10\n10,10\n-10,10';
    assert.equal(commands.length, 0);
    form.dispatchEvent(new h.Event('submit')); await new Promise(resolve => setImmediate(resolve));
    assert.equal(commands.length, 1); assert.equal(commands[0][0], 'area-upsert'); assert.equal(commands[0][1].geoPoints.length, 4); assert.equal(commands[0][2], undefined); assert.equal(commands[0][3], 'ex1');
});
test('aerodrome form imports only explicitly checked records and their source geometry', async () => {
    const h = domHarness(source('procedural.html'));
    const bases = JSON.parse(source('india-airspace.json')), enroute = JSON.parse(source('india-aip-enroute.json'));
    const base = bases[0], extra = enroute.aerodromes[base.id];
    const merge = await import(uri(source('aip-navigation.js').replace("'./chart-geometry.js'", JSON.stringify(geometryURI))));
    const scenario = { version: 1, exerciseId: 'chart-ex', revision: 2, environment: { map: {}, dfHoldSeconds: 10 }, routes: [], fixes: [], aircraft: [] };
    const state = { role: 'instructor', exerciseId: 'chart-ex', environment: scenario.environment, running: false, terminated: false };
    const commands = [];
    Object.assign(h.context, geometry, merge, { parseARP() {}, alignmentBriefing: (s, a) => s + a, confirm: () => true, host: { view: () => state, generation: () => 1, command: async (...args) => commands.push(args), request: async () => ({ version: 1, scenario: JSON.parse(JSON.stringify(scenario)) }), changed() {}, message() {} }, fetch: async path => ({ ok: true, json: async () => path === 'india-airspace.json' ? bases : enroute }) });
    for (const name of ['airspace-preparation.js', 'scenario-library.js', 'airspace-preview.js', 'chart-workshop.js']) vm.runInContext(source(name).replace(/^import .*;\r?\n/gm, '').replace(/export /g, ''), h.context);
    vm.runInContext('globalThis.workshop=createChartWorkshop(host);', h.context);
    await new Promise(resolve => setImmediate(resolve));
    const selector = h.document.getElementById('aerodrome-select'); selector.value = base.id; selector.dispatchEvent(new h.Event('change'));
    const pick = h.document.getElementById('aerodrome-selection');
    assert.equal(pick.querySelectorAll('input:checked').length, 0);
    const route = pick.querySelector('input[data-route-id]'), area = pick.querySelector('input[data-area-id]'); route.checked = true; area.checked = true;
    route.setAttribute('checked', ''); area.setAttribute('checked', ''); // linkedom models :checked from the attribute.
    h.document.getElementById('aerodrome-form').dispatchEvent(new h.Event('submit')); await new Promise(resolve => setImmediate(resolve));
    assert.equal(commands.length, 1); assert.equal(commands[0][0], 'import');
    const imported = commands[0][1].scenario;
    assert.equal(imported.routes.length, 1); assert.equal(imported.routes[0].id, route.dataset.routeId); assert.equal(imported.areas.length, 1); assert.equal(imported.areas[0].id, area.dataset.areaId);
    assert.deepEqual(JSON.parse(JSON.stringify(imported.areas[0].coordinateOrigin)), base.origin); assert.equal(imported.areas[0].geoPoints.length, imported.areas[0].points.length);
    assert.deepEqual(imported.fixes.map(f => f.name).sort(), [...new Set(extra.routes.find(r => r.id === route.dataset.routeId).fixNames)].sort());
});
