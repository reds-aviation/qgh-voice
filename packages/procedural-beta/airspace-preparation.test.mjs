import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { domHarness } from './testing/dom-harness.mjs';
const source = name => readFileSync(new URL('./static/' + name, import.meta.url), 'utf8');
const uri = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const geometryURI = uri(source('chart-geometry.js'));
const geometry = await import(geometryURI);
const routeChartURI = uri(source('route-chart.js').replace("'./chart-geometry.js'", JSON.stringify(geometryURI)).replace("'./scope-navigation.js'", JSON.stringify(uri(source('scope-navigation.js')))));
const routeChart = await import(routeChartURI);
const airspaceURI = uri(source('airspace-preparation.js').replace("'./chart-geometry.js'", JSON.stringify(geometryURI)));
const airspace = await import(airspaceURI);
const librarySource = source('scenario-library.js').replace("'./airspace-preparation.js'", JSON.stringify(airspaceURI)).replace("'./chart-geometry.js'", JSON.stringify(geometryURI)).replace("'./route-chart.js'", JSON.stringify(routeChartURI));
const library = await import(uri(librarySource));
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
    assert.equal(h.document.getElementById('custom-airspace-discard').hidden, false, 'standalone custom editor retains its discard action');
    const form = h.document.getElementById('custom-boundary-form');
    form.elements.namedItem('name').value = 'Test LFA'; form.elements.namedItem('mode').value = 'local'; form.elements.namedItem('points').value = '-10,-10\n10,-10\n10,10\n-10,10';
    assert.equal(commands.length, 0);
    form.dispatchEvent(new h.Event('submit')); await new Promise(resolve => setImmediate(resolve));
    assert.equal(commands.length, 1); assert.equal(commands[0][0], 'area-upsert'); assert.equal(commands[0][1].geoPoints.length, 4); assert.equal(commands[0][2], undefined); assert.equal(commands[0][3], 'ex1');
});
test('published airspace defaults all features visible and unchecked routes/areas hide without replacing traffic or geometry', async () => {
    const h = domHarness(source('procedural.html'));
    const bases = JSON.parse(source('india-airspace.json')), enroute = JSON.parse(source('india-aip-enroute.json'));
    const base = bases[0], extra = enroute.aerodromes[base.id];
    const merge = await import(uri(source('aip-navigation.js').replace("'./chart-geometry.js'", JSON.stringify(geometryURI))));
    const scenario = { version: 1, exerciseId: 'chart-ex', revision: 2, environment: { map: {}, dfHoldSeconds: 10 }, routes: [], fixes: [], aircraft: [{ id: 'traffic-1', callsign: '101', xNm: -10, yNm: 5 }], elapsed: 120, calls: [{ text: 'Retain calls' }] };
    const state = { role: 'instructor', exerciseId: 'chart-ex', environment: scenario.environment, running: false, terminated: false };
    const commands = [];
    Object.assign(h.context, geometry, routeChart, merge, { parseARP() {}, alignmentBriefing: (s, a) => s + a, confirm: () => true, host: { view: () => state, generation: () => 1, command: async (...args) => commands.push(args), request: async () => ({ version: 1, scenario: JSON.parse(JSON.stringify(scenario)) }), changed() {}, message() {} }, fetch: async path => ({ ok: true, json: async () => path === 'india-airspace.json' ? bases : enroute }) });
    for (const name of ['airspace-preparation.js', 'scenario-library.js', 'airspace-library.js', 'airspace-preview.js', 'chart-workshop.js']) {
        const text = source(name), exports = [...text.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z_$][\w$]*)/g)].map(match => match[1]);
        vm.runInContext(`(() => { ${text.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '')}; Object.assign(globalThis,{${exports.join(',')}}); })()`, h.context);
    }
    vm.runInContext('globalThis.workshop=createChartWorkshop(host);', h.context);
    await new Promise(resolve => setImmediate(resolve));
    const selector = h.document.getElementById('aerodrome-select'); selector.value = base.id; selector.dispatchEvent(new h.Event('change'));
    const pick = h.document.getElementById('aerodrome-selection');
    const checkboxes = [...pick.querySelectorAll('input')]; assert.ok(checkboxes.length > 2); assert.ok(checkboxes.every(checkbox => checkbox.checked), 'Every available feature starts visible');
    for (const checkbox of checkboxes) checkbox.setAttribute('checked', ''); // linkedom models :checked from the attribute.
    const route = pick.querySelector('input[data-route-id]'), area = pick.querySelector('input[data-area-id]'); route.checked = false; area.checked = false;
    route.removeAttribute('checked'); area.removeAttribute('checked');
    h.document.getElementById('aerodrome-form').dispatchEvent(new h.Event('submit')); await new Promise(resolve => setImmediate(resolve));
    assert.equal(commands.length, 1); assert.equal(commands[0][0], 'airspace-replace');
    const imported = JSON.parse(JSON.stringify(commands[0][1]));
    assert.equal(imported.routes.length, extra.routes.length);
    const visibleRoute = imported.routes.find(record => record.id === route.dataset.routeId), visibleArea = imported.areas.find(record => record.id === area.dataset.areaId);
    assert.ok(visibleRoute && visibleArea);
    assert.deepEqual(imported.scopeDisplay.hiddenRouteIds, [route.dataset.routeId]);
    assert.deepEqual(imported.scopeDisplay.hiddenAreaIds, [area.dataset.areaId]);
    assert.equal(imported.routes.filter(record => !imported.scopeDisplay.hiddenRouteIds.includes(record.id)).length, extra.routes.length - 1);
    assert.deepEqual(JSON.parse(JSON.stringify(visibleArea.coordinateOrigin)), base.origin); assert.equal(visibleArea.geoPoints.length, visibleArea.points.length);
    assert.deepEqual(visibleRoute.fixIds.map(id => imported.fixes.find(fix => fix.id === id).name), extra.routes.find(record => record.id === route.dataset.routeId).fixNames);
    for (const key of ['aircraft', 'elapsed', 'calls', 'radio', 'strips']) assert.equal(Object.hasOwn(imported, key), false, 'Published airspace command cannot replace traffic or progress');
    assert.equal(imported.expectedRevision, 2);
});
test('scope and preview drag existing vertices through NM transforms; deletion and multiple P/LFA boundaries stay staged', async () => {
    const h = domHarness('<html><body><div id="scope-wrap"><canvas id="scope"></canvas></div><section id="tab-build"></section></body></html>');
    const scope = h.document.getElementById('scope'); scope.getBoundingClientRect = () => ({ left: 40, top: 20, width: 400, height: 300 });
    let captured = null; scope.setPointerCapture = id => { captured = id; }; scope.hasPointerCapture = id => id === captured; scope.releasePointerCapture = () => { captured = null; };
    const state = { role: 'instructor', exerciseId: 'drag-ex', running: false, environment: { chartOrigin: origin, rangeNm: 60, map: {} }, areas: [{ id: 'lfa1', name: 'LFA example', kind: 'local-flying', floorLabel: 'GND', ceilingLabel: 'FL100', points: square }] };
    const commands = []; let draws = 0;
    Object.assign(h.context, geometry, { host: { view: () => state, command: async (...args) => commands.push(args), changed() {}, message() {}, scope: { canvas: scope, screenToPoint: e => ({ x: (e.clientX - 40 - 100) / 5, y: (100 - (e.clientY - 20)) / 5 }), drawChanged: () => draws++, openScope() {} } } });
    vm.runInContext(source('airspace-preparation.js').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '') + ';globalThis.editor=createAirspacePreparation(host);editor.render();', h.context);
    h.document.querySelector('#custom-boundary-list button').click(); h.document.getElementById('boundary-scope-edit').click();
    h.context.editor.draw(scope.getContext('2d'), (x, y) => [100 + x * 5, 100 - y * 5]);
    const event = (x, y, id = 7) => ({ clientX: 40 + 100 + x * 5, clientY: 20 + 100 - y * 5, pointerId: id, button: 0, pointerType: 'mouse', preventDefault() {} });
    assert.equal(h.context.editor.onPointer(event(-10, -10)), true); assert.equal(captured, 7);
    assert.equal(h.context.editor.onPointerMove(event(-12, -8)), true); assert.equal(h.context.editor.onPointerUp(event(-12, -8)), true); assert.equal(captured, null);
    const form = h.document.getElementById('custom-boundary-form'), points = form.elements.namedItem('points');
    let parsed = airspace.parseBoundary(points.value, 'local', origin); assert.ok(Math.abs(parsed.points[0].xNm + 12) < 1e-5); assert.ok(Math.abs(parsed.points[0].yNm + 8) < 1e-5); assert.equal(parsed.points.length, 4);
    const selector = h.document.getElementById('boundary-vertex-select'); selector.value = '1'; selector.dispatchEvent(new h.Event('change')); h.document.getElementById('boundary-scope-delete').click();
    assert.equal(airspace.parseBoundary(points.value, 'local', origin).points.length, 3); assert.equal(commands.length, 0, 'editing never publishes until Save');
    h.context.editor.cancelSketch(); assert.equal(h.context.editor.isSketching(), false);
    const mode = form.elements.namedItem('mode'); mode.value = 'local'; mode.dispatchEvent(new h.Event('change'));
    const preview = h.document.getElementById('boundary-sketch-canvas'); preview.getBoundingClientRect = () => ({ left: 0, top: 0, width: 720, height: 380 });
    const factor = 380 * .44 / 60, emit = (type, x, y) => { const e = new h.Event(type, { bubbles: true, cancelable: true }); Object.assign(e, { clientX: 360 + x * factor, clientY: 190 - y * factor, pointerId: 8, button: 0, pointerType: 'touch' }); preview.dispatchEvent(e); };
    emit('pointerdown', -12, -8); emit('pointermove', -20, -8); emit('pointerup', -20, -8);
    parsed = airspace.parseBoundary(points.value, 'local', origin); assert.ok(Math.abs(parsed.points[0].xNm + 20) < .001); assert.ok(Math.abs(parsed.points[0].yNm + 8) < .001);
    form.dispatchEvent(new h.Event('submit')); await new Promise(resolve => setImmediate(resolve));
    assert.equal(commands[0][1].id, 'lfa1'); assert.equal(commands[0][1].kind, 'local-flying'); assert.equal(commands[0][1].geoPoints.length, 3);
    form.elements.namedItem('name').value = 'P example'; form.elements.namedItem('kind').value = 'prohibited'; mode.value = 'local'; points.value = '0,0\n8,0\n0,8'; form.dispatchEvent(new h.Event('submit')); await new Promise(resolve => setImmediate(resolve));
    assert.equal(commands[1][1].kind, 'prohibited'); assert.equal(commands[1][1].id, undefined, 'additional polygon gets a new identity'); assert.ok(draws > 3);
    form.elements.namedItem('name').value = 'Crossed'; points.value = '-10,-10\n10,10\n10,-10\n-10,10'; form.dispatchEvent(new h.Event('submit')); await new Promise(resolve => setImmediate(resolve)); assert.equal(commands.length, 2, 'self-crossed polygon is never submitted');
});
test('new templates cap at 20, preserve selections, and reject invalid imported geometry or references', () => {
    const setup = bundle(); setup.scenario.aircraft = Array.from({ length: 21 }, (_, i) => ({ ...setup.scenario.aircraft[0], id: `a${i}`, callsign: String(101 + i) }));
    assert.throws(() => library.prepareExerciseTemplate(setup, 'Too many'), /20 aircraft/);
    const legacy = library.prepareExerciseTemplate(setup, 'Existing legacy', '', '', { allowLegacy24: true }); assert.equal(legacy.bundle.scenario.aircraft.length, 21);
    assert.throws(() => library.parseExerciseTemplate(JSON.stringify(legacy)), /20 aircraft/); assert.equal(library.parseExerciseTemplate(JSON.stringify(legacy), { allowLegacy24: true }).bundle.scenario.aircraft.length, 21);
    const valid = bundle(); valid.scenario.areas = [{ id: 'p1', name: 'P example', kind: 'prohibited', points: square }]; valid.scenario.scopeDisplay.hiddenAreaIds = ['p1'];
    const saved = library.prepareExerciseTemplate(valid, 'Selected layers'); assert.deepEqual(saved.bundle.scenario.scopeDisplay.hiddenAreaIds, ['p1']);
    const crossed = structuredClone(valid); crossed.scenario.areas[0].points = [square[0], square[2], square[1], square[3]]; assert.throws(() => library.prepareExerciseTemplate(crossed, 'Invalid'), /cross/);
    const missing = structuredClone(valid); missing.scenario.scopeDisplay.hiddenRouteIds = ['missing']; assert.throws(() => library.prepareExerciseTemplate(missing, 'Invalid'), /selections/);
    const mismatch = structuredClone(valid); mismatch.scenario.areas[0].coordinateOrigin = origin; mismatch.scenario.areas[0].geoPoints = square.map(p => airspace.localToGeographic({ ...p, xNm: p.xNm + 1 }, origin)); assert.throws(() => library.prepareExerciseTemplate(mismatch, 'Invalid'), /match/);
});
test('simple exercise Save, Rename, Load and quota/invalid-import paths keep exact starting setup', async () => {
    const h = domHarness('<html><body><section id="tab-build"></section></body></html>'); const exported = bundle();
    exported.scenario.areas = [{ id: 'p1', name: 'P example', kind: 'prohibited', points: square }]; exported.scenario.scopeDisplay.hiddenAreaIds = ['p1'];
    const state = { role: 'instructor', exerciseId: 'live', running: false, elapsed: 0, revision: 4 }; const commands = [];
    Object.assign(h.context, routeChart, { validateBoundary: airspace.validateBoundary, project: geometry.project, confirm: () => true, host: { view: () => state, generation: () => 1, request: async () => structuredClone(exported), command: async (...args) => commands.push(args), changed() {}, message() {} } });
    vm.runInContext(source('scenario-library.js').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '') + ';globalThis.library=createScenarioLibrary(host);', h.context);
    const name = h.document.getElementById('template-name'), select = h.document.getElementById('template-select'), status = h.document.getElementById('scenario-library-status'), read = () => JSON.parse(h.context.localStorage.getItem('ats-simbox-exercise-templates-v1'));
    const click = async id => { h.document.getElementById(id).click(); await new Promise(resolve => setImmediate(resolve)); };
    assert.equal(h.document.getElementById('template-save-as'), null);
    assert.equal(h.document.getElementById('template-duplicate'), null);
    const manage = h.document.getElementById('template-manage');
    assert.equal(manage.contains(h.document.getElementById('template-import')), false);
    assert.equal(manage.contains(h.document.getElementById('template-download')), false);
    assert.equal(manage.querySelectorAll('button').length, 2, 'occasional management has only Rename and Remove');
    name.value = 'Assessment'; await click('template-save'); assert.equal(read().length, 1); const originalID = select.value;
    select.value = ''; name.value = 'Assessment copy'; await click('template-save'); assert.equal(read().length, 2); assert.notEqual(select.value, originalID); assert.equal(read()[1].name, 'Assessment copy'); assert.deepEqual(read()[1].bundle.scenario.scopeDisplay.hiddenAreaIds, ['p1']);
    name.value = 'Renamed'; await click('template-rename'); const selectedID = select.value; assert.equal(read()[1].id, selectedID); assert.equal(read()[1].name, 'Renamed'); assert.equal(read()[1].bundle.scenario.aircraft[0].xNm, -10);
    await click('template-load'); assert.equal(commands.at(-1)[0], 'import'); assert.deepEqual(commands.at(-1)[1].scenario.scopeDisplay.hiddenAreaIds, ['p1']); assert.equal(commands.at(-1)[1].expectedRevision, 4);
    select.value = ''; name.value = 'Assessment'; await click('template-save'); assert.match(status.textContent, /already used/); assert.equal(read().length, 2);
    const file = h.document.getElementById('template-import'); file.files = [{ size: 5, text: async () => '{bad' }]; file.dispatchEvent(new h.Event('change')); await new Promise(resolve => setImmediate(resolve)); assert.equal(read().length, 2); assert.doesNotMatch(status.textContent, /Imported/);
    const originalSet = h.context.localStorage.setItem; h.context.localStorage.setItem = () => { throw new Error('quota'); };
    select.value = selectedID; name.value = 'Failed rename'; await click('template-rename'); assert.equal(read()[1].name, 'Renamed'); assert.doesNotMatch(status.textContent, /renamed/);
    select.value = ''; name.value = 'Temporary copy'; await click('template-save'); assert.match(status.textContent, /page only/); assert.doesNotMatch(status.textContent, /saved/); assert.equal(read().length, 2);
    h.context.localStorage.setItem = originalSet;
});

function mouseDrawingHarness(withOrigin = true) {
    const h = domHarness('<html><body><div id="scope-wrap"><canvas id="scope"></canvas></div><section id="tab-build"></section></body></html>');
    const state = { role: 'instructor', exerciseId: 'mouse-drawing', running: false,
        environment: { ...(withOrigin ? { chartOrigin: origin } : {}), rangeNm: 60, map: {} }, areas: [] };
    const commands = [], scope = h.document.getElementById('scope');
    Object.assign(h.context, geometry, { host: { view: () => state, generation: () => 1,
        command: async (name, payload, _, exerciseId) => {
            const value = JSON.parse(JSON.stringify(payload)); commands.push({ name, payload: value, exerciseId });
            if (name === 'environment') Object.assign(state.environment, value);
            if (name === 'area-upsert') state.areas.push({ id: 'mouse-area', ...value });
        }, changed: () => h.context.editor.render(), message() {},
        scope: { canvas: scope, screenToPoint: () => ({ x: 0, y: 0 }), drawChanged() {}, openScope() {} },
    } });
    vm.runInContext(source('airspace-preparation.js').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '')
        + ';globalThis.editor=createAirspacePreparation(host);editor.render();', h.context);
    const get = id => h.document.getElementById(id), preview = get('boundary-sketch-canvas');
    preview.getBoundingClientRect = () => ({ left: 40, top: 20, width: 360, height: 190 });
    const form = get('custom-boundary-form'), points = form.elements.namedItem('points');
    form.elements.namedItem('mode').value = 'local'; form.elements.namedItem('mode').dispatchEvent(new h.Event('change'));
    const emit = (type, x, y) => {
        const event = new h.Event(type, { bubbles: true, cancelable: true }), factor = 380 * .44 / 60;
        Object.assign(event, { button: 0, isPrimary: true, pointerType: 'mouse', pointerId: 7,
            clientX: 40 + (360 + x * factor) / 2, clientY: 20 + (190 - y * factor) / 2 });
        preview.dispatchEvent(event); return event;
    };
    const clickPoint = (x, y) => { emit('pointerdown', x, y); emit('pointerup', x, y); };
    const sketchButton = label => [...get('boundary-sketch').querySelectorAll('button')].find(button => button.textContent === label);
    const edit = (input, value) => { input.value = String(value); input.dispatchEvent(new h.Event('input', { bubbles: true })); };
    const submit = async id => { get(id).dispatchEvent(new h.Event('submit', { cancelable: true })); await new Promise(resolve => setImmediate(resolve)); };
    return { ...h, state, commands, get, preview, form, points, emit, clickPoint, sketchButton, edit, submit, editor: h.context.editor };
}

test('mouse drawing starts by placing the ARP dot without coordinate entry, and still guards unapplied changes and running state', async () => {
    const h = mouseDrawingHarness(false), arpForm = h.get('custom-arp-form');
    const status = h.get('boundary-drawing-status');
    assert.ok(status, 'Drawing readiness must be visible next to the preview');
    assert.equal(status.parentElement === h.preview.parentElement, true);
    assert.match(status.textContent, /Place.*ARP/i);
    assert.equal(arpForm.querySelector('.airspace-preparation-grid').hidden, true);
    assert.equal(arpForm.elements.namedItem('latitude').required, false);
    assert.equal(h.preview.getAttribute('aria-disabled'), 'true');
    assert.equal(h.get('boundary-scope-edit').disabled, true);
    h.clickPoint(-10, -10); assert.equal(h.points.value, ''); assert.equal(h.commands.length, 0);
    h.get('drawn-arp-preview').click(); h.clickPoint(5, 6); await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.state.environment.drawnARP, true); assert.equal(h.state.environment.chartOrigin, null);
    assert.ok(Math.abs(h.state.environment.stationXNm - 5) < 1e-8); assert.ok(Math.abs(h.state.environment.stationYNm - 6) < 1e-8);
    assert.equal(h.preview.getAttribute('aria-disabled'), 'false');
    assert.equal(h.get('boundary-scope-edit').disabled, false);
    h.clickPoint(-10, -10);
    const selectedDraft = h.points.value;
    const deleteControls = [h.get('boundary-vertex-delete'), h.get('boundary-scope-delete')];
    for (const control of deleteControls) assert.equal(control.disabled, false, 'A selected vertex can be deleted when drawing is ready');
    h.edit(arpForm.elements.namedItem('aerodromeName'), 'Unapplied chart name');
    assert.match(status.textContent, /apply/i); assert.equal(h.preview.getAttribute('aria-disabled'), 'true');
    assert.equal(h.get('boundary-scope-edit').disabled, true);
    for (const control of deleteControls) assert.equal(control.disabled, true, 'Unsaved ARP changes block deleting the selected vertex');
    h.editor.setMethod('coordinates'); h.edit(arpForm.elements.namedItem('latitude'), 26); h.edit(arpForm.elements.namedItem('longitude'), 73);
    h.context.confirm = () => true; await h.submit('custom-arp-form');
    h.clickPoint(-10, -10);
    for (const control of deleteControls) assert.equal(control.disabled, false, 'Saving the same ARP enables selected-vertex deletion again');
    h.state.running = true; h.editor.render();
    assert.match(status.textContent, /pause/i); assert.equal(h.preview.getAttribute('aria-disabled'), 'true');
    for (const control of deleteControls) assert.equal(control.disabled, true, 'A running exercise blocks deleting the selected vertex');
    const pausedDraft = h.points.value; h.clickPoint(10, 10); assert.equal(h.points.value, pausedDraft);
    h.state.running = false; h.editor.render();
    assert.equal(h.preview.getAttribute('aria-disabled'), 'false'); assert.match(status.textContent, /click|draw/i);
    for (const control of deleteControls) assert.equal(control.disabled, false, 'Pausing enables selected-vertex deletion again');
});

test('saving geographic ARP after mouse placement puts the station at its projected origin and preserves saved geometry', async () => {
    const h = mouseDrawingHarness(false), arpForm = h.get('custom-arp-form');
    h.get('drawn-arp-preview').click(); h.clickPoint(7.5, -4.25);
    await new Promise(resolve => setImmediate(resolve));
    const aircraft = [{ id: 'a1', callsign: '101', xNm: 12, yNm: -6 }];
    const areas = [{ id: 'p1', name: 'Saved area', kind: 'prohibited', points: square }];
    const routes = [{ id: 'r1', fixIds: ['f1', 'f2'], coordinateOrigin: origin, geoPoints: [{ ...origin }, airspace.localToGeographic({ xNm: 10, yNm: 0 }, origin)] }];
    const fixes = [{ id: 'f1', name: 'A', xNm: 0, yNm: 0 }, { id: 'f2', name: 'B', xNm: 10, yNm: 0 }];
    Object.assign(h.state, { aircraft, areas, routes, fixes });
    h.editor.setMethod('coordinates'); h.edit(arpForm.elements.namedItem('latitude'), 26); h.edit(arpForm.elements.namedItem('longitude'), 73);
    h.context.confirm = () => true; await h.submit('custom-arp-form');
    const environment = h.state.environment, projectedARP = geometry.project(origin, environment.chartOrigin);
    assert.equal(environment.drawnARP, false); assert.deepEqual(environment.chartOrigin, origin);
    assert.equal(environment.stationName, 'ARP');
    assert.equal(environment.stationXNm, projectedARP.xNm, 'Station must coincide with the coordinate ARP at local zero');
    assert.equal(environment.stationYNm, projectedARP.yNm, 'Station must coincide with the coordinate ARP at local zero');
    for (const [key, value] of Object.entries({ aircraft, areas, routes, fixes })) assert.equal(h.state[key], value, `Saving ARP preserves ${key}`);
    assert.equal(h.commands.at(-1).name, 'environment');
    for (const key of ['aircraft', 'areas', 'routes', 'fixes']) assert.equal(Object.hasOwn(h.commands.at(-1).payload, key), false);
});

test('cancelling geographic ARP relocation preserves an existing mouse ARP even without an unsaved feature draft', async () => {
    const h = mouseDrawingHarness(false), arpForm = h.get('custom-arp-form');
    h.get('drawn-arp-preview').click(); h.clickPoint(7.5, -4.25);
    await new Promise(resolve => setImmediate(resolve));
    const before = JSON.parse(JSON.stringify(h.state.environment)), prompts = [];
    h.editor.setMethod('coordinates'); h.edit(arpForm.elements.namedItem('latitude'), 26); h.edit(arpForm.elements.namedItem('longitude'), 73);
    h.context.confirm = prompt => { prompts.push(prompt); return false; };
    await h.submit('custom-arp-form');
    assert.equal(prompts.length, 1, 'Changing a drawn ARP requires relocation confirmation');
    assert.match(prompts[0], /ARP.*traffic.*chart points.*local positions/i);
    assert.equal(h.commands.length, 1, 'Cancel must not update the environment');
    assert.deepEqual(h.state.environment, before);
});

test('a new empty mouse draft at scaled CSS size closes and saves named airspace with exact type, limits and coordinate metadata', async () => {
    const h = mouseDrawingHarness(), closeBoundary = h.sketchButton('Close boundary');
    assert.equal(h.points.value, ''); assert.equal(closeBoundary.disabled, true);
    h.clickPoint(-10, -10); assert.equal(closeBoundary.disabled, true);
    h.clickPoint(10, -10); h.clickPoint(0, 10);
    assert.equal(h.commands.length, 0, 'Drawing stays local until Save');
    assert.equal(closeBoundary.disabled, false); assert.match(h.get('boundary-drawing-status').textContent, /3/);
    const drawn = airspace.parseBoundary(h.points.value, 'local', origin);
    drawn.points.forEach((p, i) => {
        assert.ok(Math.abs(p.xNm - [-10, 10, 0][i]) < .0001);
        assert.ok(Math.abs(p.yNm - [-10, -10, 10][i]) < .0001);
    });
    closeBoundary.click(); assert.match(h.get('boundary-drawing-status').textContent, /save/i);
    h.form.elements.namedItem('name').value = 'Mouse restricted area'; h.form.elements.namedItem('kind').value = 'restricted';
    h.form.elements.namedItem('floorLabel').value = 'FL100'; h.form.elements.namedItem('ceilingLabel').value = 'FL200';
    await h.submit('custom-boundary-form');
    assert.equal(h.commands.length, 1); const saved = h.commands[0];
    assert.equal(saved.name, 'area-upsert'); assert.equal(saved.exerciseId, 'mouse-drawing');
    assert.equal(saved.payload.id, undefined); assert.equal(saved.payload.name, 'Mouse restricted area');
    assert.equal(saved.payload.kind, 'restricted'); assert.equal(saved.payload.floorLabel, 'FL100'); assert.equal(saved.payload.ceilingLabel, 'FL200');
    assert.equal(saved.payload.points.length, 3); assert.equal(saved.payload.geoPoints.length, 3);
    assert.deepEqual(saved.payload.coordinateOrigin, origin);
    saved.payload.geoPoints.forEach((p, i) => assert.ok(Math.hypot(geometry.project(p, origin).xNm - drawn.points[i].xNm,
        geometry.project(p, origin).yNm - drawn.points[i].yNm) < .0001));
    assert.equal(h.points.value, ''); assert.equal(h.form.elements.namedItem('name').value, '');
    assert.equal(h.editor.hasDraft(), false);
});

test('a fresh mouse chart places its ARP then saves area and bidirectional ATS route without geographic coordinates', async () => {
    const h = mouseDrawingHarness(false), originalTraffic = [{ id: 'a1', callsign: '101', xNm: -20, yNm: 10 }];
    h.state.aircraft = originalTraffic; h.get('drawn-arp-preview').click(); h.clickPoint(4, -7);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.commands.length, 1); assert.equal(h.commands[0].name, 'environment');
    assert.equal(h.commands[0].payload.drawnARP, true); assert.equal(h.commands[0].payload.chartOrigin, null);
    assert.equal(h.commands[0].payload.stationName, 'ARP'); assert.equal(h.state.aircraft, originalTraffic);
    for (const key of ['latitude', 'longitude']) assert.equal(h.get('custom-arp-form').elements.namedItem(key).value, '');
    h.clickPoint(-10, -10); h.clickPoint(10, -10); h.clickPoint(0, 10); h.sketchButton('Close boundary').click();
    h.form.elements.namedItem('name').value = 'Mouse danger area'; h.form.elements.namedItem('kind').value = 'danger';
    await h.submit('custom-boundary-form');
    const area = h.commands.at(-1).payload; assert.equal(h.commands.at(-1).name, 'area-upsert');
    assert.equal(area.kind, 'danger'); assert.deepEqual(area.points, [{ xNm: -10, yNm: -10 }, { xNm: 10, yNm: -10 }, { xNm: 0, yNm: 10 }]);
    for (const key of ['coordinateOrigin', 'geoPoints']) assert.equal(Object.hasOwn(area, key), false, 'Mouse chart must not invent geographic coordinates');
    const feature = h.get('airspace-feature-kind'); feature.value = 'route'; feature.dispatchEvent(new h.Event('change'));
    h.clickPoint(-20, 5); h.clickPoint(20, 5); h.sketchButton('Finish route').click();
    const routeForm = h.get('custom-route-form'); routeForm.elements.namedItem('name').value = 'TRAINING R1'; routeForm.elements.namedItem('chartDirection').value = 'both';
    routeForm.elements.namedItem('minAltitudeFt').value = '5000'; routeForm.elements.namedItem('maxAltitudeFt').value = '15000';
    await h.submit('custom-route-form');
    const route = h.commands.at(-1).payload; assert.equal(h.commands.at(-1).name, 'route-geometry-upsert');
    assert.equal(route.chartDirection, 'both'); assert.equal(route.minAltitudeFt, 5000); assert.equal(route.maxAltitudeFt, 15000);
    for (const key of ['coordinateOrigin', 'geoPoints']) assert.equal(Object.hasOwn(route, key), false);
    route.fixes.forEach((point, index) => { assert.ok(Math.abs(point.xNm - [-20, 20][index]) < 1e-8); assert.ok(Math.abs(point.yNm - 5) < 1e-8); });
    h.editor.render(); assert.equal(h.get('boundary-scope-edit').disabled, false, 'Placed ARP readiness survives rendering');
    assert.equal(h.state.aircraft, originalTraffic); assert.equal(h.editor.hasDraft(), false);
});

test('radar scope ARP placement uses the shared screen transform, and cancelling relocation retains drafts and published coordinates', async () => {
    const h = mouseDrawingHarness(false);
    h.context.host.scope.screenToPoint = event => [event.clientX, event.clientY];
    h.get('drawn-arp-scope').click(); assert.equal(h.editor.isSketching(), true);
    assert.equal(h.get('boundary-scope-tools').querySelector('strong').textContent, 'PLACE ARP');
    assert.equal(h.get('boundary-scope-close').hidden, true);
    h.editor.onPointer({ clientX: 14, clientY: -6, isPrimary: true, button: 0, pointerType: 'mouse', preventDefault() {} });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.state.environment.stationXNm, 14); assert.equal(h.state.environment.stationYNm, -6); assert.equal(h.editor.isSketching(), false);
    h.state.environment = { ...h.state.environment, drawnARP: false, chartOrigin: origin };
    h.editor.render(); h.clickPoint(-10, -10); const draft = h.points.value;
    h.context.confirm = () => false; h.get('drawn-arp-preview').click(); h.clickPoint(10, 8);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.commands.length, 1); assert.equal(h.points.value, draft); assert.equal(h.state.environment.chartOrigin, origin);
    h.editor.cancelSketch(); assert.equal(h.get('boundary-scope-tools').hidden, true);
});

test('pointer cancellation rolls back a new mouse point and an in-progress vertex drag without changing saved airspace', () => {
    const h = mouseDrawingHarness(); h.clickPoint(-10, -10);
    const initial = h.points.value;
    h.emit('pointerdown', 10, -10); h.emit('pointercancel', 10, -10);
    assert.equal(h.points.value, initial, 'Cancelled point must not remain in the boundary');
    h.clickPoint(10, -10); h.clickPoint(0, 10);
    const triangle = h.points.value;
    h.emit('pointerdown', -10, -10); h.emit('pointermove', -20, -8); h.emit('pointercancel', -20, -8);
    assert.equal(h.points.value, triangle, 'Cancelled vertex drag restores the coordinates before the gesture');
    assert.equal(h.commands.length, 0); assert.equal(h.state.areas.length, 0);
});

test('named manual route coordinates preserve WGS84 geometry and reject missing ARP, invalid points and duplicate names', () => {
    const text = 'ENTRY, 261500N, 0730300E\nEXIT, 261800N, 0731200E';
    const parsed = airspace.parseRoutePoints(text, 'geographic', origin);
    assert.deepEqual(parsed.fixes.map(point => point.name), ['ENTRY', 'EXIT']);
    assert.deepEqual(parsed.coordinateOrigin, origin); assert.equal(parsed.geoPoints.length, 2);
    parsed.fixes.forEach((fix, index) => assert.deepEqual({ xNm: fix.xNm, yNm: fix.yNm }, geometry.project(parsed.geoPoints[index], origin)));
    const local = airspace.parseRoutePoints('A, -10, 5\nB, 8, 12', 'local', origin);
    assert.deepEqual(local.fixes[0], { name: 'A', xNm: -10, yNm: 5 });
    assert.throws(() => airspace.parseRoutePoints(text, 'geographic', null), /ARP/);
    for (const invalid of ['A, 0, 0', 'A, 0, 0\nA, 1, 1', 'A,NaN,0\nB,1,1', 'A,0,0\nB,3000,0', 'A,0,0\nB,0,0', 'A,0\nB,1,1']) assert.throws(() => airspace.parseRoutePoints(invalid, 'local', origin));
});

test('drawing an open ATS route stages named points then submits one atomic command with direction and route limits', async () => {
    const h = mouseDrawingHarness(), feature = h.get('airspace-feature-kind');
    feature.value = 'route'; feature.dispatchEvent(new h.Event('change'));
    const form = h.get('custom-route-form'), read = name => form.elements.namedItem(name);
    assert.equal(read('chartDirection').getAttribute('aria-label'), 'Route direction');
    assert.equal(feature.getAttribute('aria-label'), 'Add or edit');
    h.editor.setMethod('draw');
    h.clickPoint(-10, -10); h.clickPoint(10, 5);
    assert.equal(h.commands.length, 0); assert.equal(h.sketchButton('Finish route').disabled, false);
    h.sketchButton('Finish route').click();
    assert.equal(h.document.activeElement, read('name'), 'Finish route brings the user to the name and direction fields');
    assert.match(form.textContent, /Unidirectional.*Bidirectional/s);
    assert.match(h.get('custom-airspace-status').textContent, /name.*Unidirectional.*Bidirectional.*Save route/i);
    assert.match(h.get('boundary-drawing-status').textContent, /finished|save route/i);
    assert.equal(h.get('route-drawing-point-names').querySelectorAll('input').length, 2);
    read('name').value = 'Training route'; read('chartDirection').value = 'both';
    read('minAltitudeFt').value = '5000'; read('maxAltitudeFt').value = '15000'; read('levelLimits').value = 'FL 100–FL 200 · chart reference';
    await h.submit('custom-route-form');
    assert.equal(h.commands.length, 1, 'No separate fix-upsert operations can leave partial geometry');
    const command = h.commands[0]; assert.equal(command.name, 'route-geometry-upsert');
    assert.equal(command.payload.chartDirection, 'both'); assert.equal(command.payload.minAltitudeFt, 5000); assert.equal(command.payload.maxAltitudeFt, 15000);
    assert.equal(command.payload.levelLimits, 'FL 100–FL 200 · chart reference'); assert.equal(command.payload.fixes.length, 2);
    assert.equal(command.payload.kind, 'ats'); assert.equal(command.payload.active, true);
    assert.ok(command.payload.fixes.every(fix => !fix.id), 'New drawing does not silently reuse existing names/identities');
    command.payload.fixes.forEach((fix, index) => assert.ok(Math.hypot(fix.xNm - [-10, 10][index], fix.yNm - [-10, 5][index]) < 1e-8));
    assert.deepEqual(command.payload.coordinateOrigin, origin); assert.equal(command.payload.geoPoints.length, 2);
    assert.equal(h.editor.hasDraft(), false);
});

test('manual route errors are visible without ARP or valid limits, and switching methods preserves staged geometry', async () => {
    const h = mouseDrawingHarness(false), feature = h.get('airspace-feature-kind');
    feature.value = 'route'; feature.dispatchEvent(new h.Event('change')); h.editor.setMethod('coordinates');
    const form = h.get('custom-route-form'), read = name => form.elements.namedItem(name);
    read('name').value = 'Manual route'; read('mode').value = 'local'; read('points').value = 'ENTRY, -10, 0\nEXIT, 20, 5';
    await h.submit('custom-route-form'); assert.equal(h.commands.length, 0); assert.match(h.get('custom-airspace-status').textContent, /ARP/);
    const arp = h.get('custom-arp-form'); h.edit(arp.elements.namedItem('latitude'), 26); h.edit(arp.elements.namedItem('longitude'), 73);
    h.context.confirm = () => true; await h.submit('custom-arp-form');
    read('name').value = 'Manual route'; read('points').value = 'ENTRY, -10, 0\nEXIT, 20, 5'; read('points').dispatchEvent(new h.Event('input'));
    const draft = read('points').value; h.editor.setMethod('draw'); h.editor.setMethod('coordinates'); assert.equal(read('points').value, draft);
    read('minAltitudeFt').value = '15000'; read('maxAltitudeFt').value = '5000'; await h.submit('custom-route-form');
    assert.equal(h.commands.filter(command => command.name === 'route-geometry-upsert').length, 0); assert.match(h.get('custom-airspace-status').textContent, /upper limit/);
    assert.equal(read('points').value, draft, 'An invalid save keeps the entered route for repair');
    read('maxAltitudeFt').value = '20000'; await h.submit('custom-route-form');
    assert.equal(h.commands.filter(command => command.name === 'route-geometry-upsert').length, 1);
    assert.deepEqual(h.commands.at(-1).payload.fixes.map(point => point.name), ['ENTRY', 'EXIT']);
});

test('editing a route keeps exact point identities, full-precision geometry, conditional window and closed state', async () => {
    const h = mouseDrawingHarness();
    h.state.fixes = [{ id: 'f-a', name: 'ENTRY', xNm: 12.123456789, yNm: 0.987654321 }, { id: 'f-b', name: 'EXIT', xNm: 22.111222333, yNm: 15.456789123 }];
    h.state.routes = [{ id: 'r1', name: 'Existing', kind: 'conditional', chartDirection: 'forward', active: false, fixIds: ['f-a', 'f-b'], availableFrom: 30, availableUntil: 300, minAltitudeFt: 5000, maxAltitudeFt: 20000, levelLimits: 'Chart label' }];
    h.editor.render(); const existing = h.get('custom-airspace-features');
    assert.equal(existing.hasAttribute('open'), false, 'Route records stay collapsed so the editor is not flooded'); assert.match(existing.querySelector('summary').textContent, /· 1$/);
    existing.open = true; h.get('custom-route-list').querySelector('button').click();
    const form = h.get('custom-route-form'); form.elements.namedItem('levelLimits').value = 'Updated label';
    await h.submit('custom-route-form');
    const payload = h.commands.at(-1).payload; assert.equal(payload.id, 'r1'); assert.equal(payload.kind, 'conditional'); assert.equal(payload.active, false);
    assert.equal(payload.availableFrom, 30); assert.equal(payload.availableUntil, 300);
    assert.deepEqual(payload.fixes, h.state.fixes, 'Untouched generated coordinate text must not nudge assigned navigation');
    assert.equal(payload.levelLimits, 'Updated label');
    h.get('custom-route-new').click(); assert.equal(form.dataset.editId, undefined); assert.equal(form.dataset.routeKind, undefined);
});

test('editing a geographically sourced route after mouse ARP placement retains its independent coordinate reference', async () => {
    const h = mouseDrawingHarness(false); h.state.environment.drawnARP = true;
    h.state.fixes = [{ id: 'f-a', name: 'ENTRY', xNm: -10, yNm: 5 }, { id: 'f-b', name: 'EXIT', xNm: 10, yNm: 15 }];
    h.state.routes = [{ id: 'sourced-r1', name: 'Sourced route', kind: 'ats', active: true, chartDirection: 'both', minAltitudeFt: 5000, maxAltitudeFt: 20000, fixIds: ['f-a', 'f-b'], coordinateOrigin: origin, geoPoints: h.state.fixes.map(point => airspace.localToGeographic(point, origin)) }];
    h.editor.render(); h.get('custom-route-list').querySelector('button').click();
    h.get('custom-route-form').elements.namedItem('levelLimits').value = 'Instructor annotation'; await h.submit('custom-route-form');
    const route = h.commands.at(-1).payload;
    assert.equal(h.commands.at(-1).name, 'route-geometry-upsert'); assert.equal(route.id, 'sourced-r1');
    assert.deepEqual(route.coordinateOrigin, origin); assert.equal(route.geoPoints.length, 2);
    route.geoPoints.forEach((point, index) => { const projected = geometry.project(point, origin); assert.ok(Math.hypot(projected.xNm - h.state.fixes[index].xNm, projected.yNm - h.state.fixes[index].yNm) < 1e-8); });
    assert.equal(h.state.environment.chartOrigin, undefined, 'Mouse dot must not become a geographic ARP');
});
