import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { domHarness } from './testing/dom-harness.mjs';
const source = name => readFileSync(new URL('./static/' + name, import.meta.url), 'utf8');
const uri = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const geometryURI = uri(source('chart-geometry.js'));
const geometry = await import(geometryURI);
const airspaceURI = uri(source('airspace-preparation.js').replace("'./chart-geometry.js'", JSON.stringify(geometryURI)));
const airspace = await import(airspaceURI);
const librarySource = source('scenario-library.js').replace("'./airspace-preparation.js'", JSON.stringify(airspaceURI)).replace("'./chart-geometry.js'", JSON.stringify(geometryURI));
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
    let parsed = airspace.parseBoundary(points.value, 'geographic', origin); assert.ok(Math.abs(parsed.points[0].xNm + 12) < 1e-5); assert.ok(Math.abs(parsed.points[0].yNm + 8) < 1e-5); assert.equal(parsed.points.length, 4);
    const selector = h.document.getElementById('boundary-vertex-select'); selector.value = '1'; selector.dispatchEvent(new h.Event('change')); h.document.getElementById('boundary-scope-delete').click();
    assert.equal(airspace.parseBoundary(points.value, 'geographic', origin).points.length, 3); assert.equal(commands.length, 0, 'editing never publishes until Save');
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
test('template Save as new, Duplicate, Rename, Load and quota/invalid-import paths keep exact starting setup', async () => {
    const h = domHarness('<html><body><section id="tab-build"></section></body></html>'); const exported = bundle();
    exported.scenario.areas = [{ id: 'p1', name: 'P example', kind: 'prohibited', points: square }]; exported.scenario.scopeDisplay.hiddenAreaIds = ['p1'];
    const state = { role: 'instructor', exerciseId: 'live', running: false, elapsed: 0, revision: 4 }; const commands = [];
    Object.assign(h.context, { validateBoundary: airspace.validateBoundary, project: geometry.project, confirm: () => true, host: { view: () => state, generation: () => 1, request: async () => structuredClone(exported), command: async (...args) => commands.push(args), changed() {}, message() {} } });
    vm.runInContext(source('scenario-library.js').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '') + ';globalThis.library=createScenarioLibrary(host);', h.context);
    const name = h.document.getElementById('template-name'), select = h.document.getElementById('template-select'), status = h.document.getElementById('scenario-library-status'), read = () => JSON.parse(h.context.localStorage.getItem('ats-simbox-exercise-templates-v1'));
    const click = async id => { h.document.getElementById(id).click(); await new Promise(resolve => setImmediate(resolve)); };
    name.value = 'Assessment'; await click('template-save-as'); assert.equal(read().length, 1); const originalID = select.value;
    await click('template-duplicate'); assert.equal(read().length, 2); assert.notEqual(select.value, originalID); assert.equal(read()[1].name, 'Assessment copy'); assert.deepEqual(read()[1].bundle.scenario.scopeDisplay.hiddenAreaIds, ['p1']);
    name.value = 'Renamed'; await click('template-rename'); const selectedID = select.value; assert.equal(read()[1].id, selectedID); assert.equal(read()[1].name, 'Renamed'); assert.equal(read()[1].bundle.scenario.aircraft[0].xNm, -10);
    await click('template-load'); assert.equal(commands.at(-1)[0], 'import'); assert.deepEqual(commands.at(-1)[1].scenario.scopeDisplay.hiddenAreaIds, ['p1']); assert.equal(commands.at(-1)[1].expectedRevision, 4);
    name.value = 'Assessment'; await click('template-save-as'); assert.match(status.textContent, /different name/); assert.equal(read().length, 2);
    const file = h.document.getElementById('template-import'); file.files = [{ size: 5, text: async () => '{bad' }]; file.dispatchEvent(new h.Event('change')); await new Promise(resolve => setImmediate(resolve)); assert.equal(read().length, 2); assert.doesNotMatch(status.textContent, /Imported/);
    const originalSet = h.context.localStorage.setItem; h.context.localStorage.setItem = () => { throw new Error('quota'); };
    name.value = 'Failed rename'; await click('template-rename'); assert.equal(read()[1].name, 'Renamed'); assert.doesNotMatch(status.textContent, /renamed/);
    name.value = 'Temporary copy'; await click('template-duplicate'); assert.match(status.textContent, /page only/); assert.doesNotMatch(status.textContent, /saved/); assert.equal(read().length, 2);
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

test('mouse drawing explains missing/unsaved ARP and running state beside the canvas and directs the instructor to the required field', async () => {
    const h = mouseDrawingHarness(false), arpForm = h.get('custom-arp-form');
    const status = h.get('boundary-drawing-status');
    assert.ok(status, 'Drawing readiness must be visible next to the preview');
    assert.equal(status.parentElement === h.preview.parentElement, true);
    assert.match(status.textContent, /Save.*ARP/i);
    assert.equal(h.preview.getAttribute('aria-disabled'), 'true');
    assert.equal(h.get('boundary-scope-edit').disabled, true);
    h.clickPoint(-10, -10); assert.equal(h.points.value, ''); assert.equal(h.commands.length, 0);
    h.get('boundary-go-arp').click(); assert.equal(h.document.activeElement === arpForm.elements.namedItem('latitude'), true);
    h.edit(arpForm.elements.namedItem('latitude'), 26); h.edit(arpForm.elements.namedItem('longitude'), 73);
    await h.submit('custom-arp-form');
    assert.equal(h.preview.getAttribute('aria-disabled'), 'false');
    assert.equal(h.get('boundary-scope-edit').disabled, false);
    h.clickPoint(-10, -10);
    const selectedDraft = h.points.value;
    const deleteControls = [h.get('boundary-vertex-delete'), h.get('boundary-scope-delete')];
    for (const control of deleteControls) assert.equal(control.disabled, false, 'A selected vertex can be deleted when drawing is ready');
    h.edit(arpForm.elements.namedItem('reference'), 'Unapplied chart reference');
    assert.match(status.textContent, /save|apply/i); assert.equal(h.preview.getAttribute('aria-disabled'), 'true');
    assert.equal(h.get('boundary-scope-edit').disabled, true);
    for (const control of deleteControls) assert.equal(control.disabled, true, 'Unsaved ARP changes block deleting the selected vertex');
    await h.submit('custom-arp-form');
    for (const control of deleteControls) assert.equal(control.disabled, false, 'Saving the same ARP enables selected-vertex deletion again');
    h.state.running = true; h.editor.render();
    assert.match(status.textContent, /pause/i); assert.equal(h.preview.getAttribute('aria-disabled'), 'true');
    for (const control of deleteControls) assert.equal(control.disabled, true, 'A running exercise blocks deleting the selected vertex');
    h.clickPoint(10, 10); assert.equal(h.points.value, selectedDraft);
    h.state.running = false; h.editor.render();
    assert.equal(h.preview.getAttribute('aria-disabled'), 'false'); assert.match(status.textContent, /click|draw/i);
    for (const control of deleteControls) assert.equal(control.disabled, false, 'Pausing enables selected-vertex deletion again');
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
