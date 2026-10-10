import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { domHarness } from './testing/dom-harness.mjs';

const source = name => readFileSync(new URL('./static/' + name, import.meta.url), 'utf8');
const uri = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const geometryURI = uri(source('chart-geometry.js'));
const geometry = await import(geometryURI);
const scopeURI = uri(source('scope-navigation.js'));
const chartURI = uri(source('route-chart.js').replace("'./chart-geometry.js'", JSON.stringify(geometryURI)).replace("'./scope-navigation.js'", JSON.stringify(scopeURI)));
const chart = await import(chartURI);
const boundaryURI = uri(source('airspace-preparation.js').replace("'./chart-geometry.js'", JSON.stringify(geometryURI)));
const exerciseURI = uri(source('scenario-library.js').replace("'./airspace-preparation.js'", JSON.stringify(boundaryURI)).replace("'./chart-geometry.js'", JSON.stringify(geometryURI)).replace("'./route-chart.js'", JSON.stringify(chartURI)));
const exercise = await import(exerciseURI);
const library = await import(uri(source('airspace-library.js').replace("'./scenario-library.js'", JSON.stringify(exerciseURI))
    .replace("'./chart-geometry.js'", JSON.stringify(geometryURI)).replace("'./route-chart.js'", JSON.stringify(chartURI))));
const copy = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setImmediate(resolve));
const storageKey = 'ats-simbox-airspaces-v1';
const exerciseStorageKey = 'ats-simbox-exercise-templates-v1';

function scenario() {
    return {
        version: 1, exerciseId: 'live-airspace-test', revision: 4, role: 'instructor', elapsed: 321,
        running: false, terminated: false, mode: 'approach', title: 'Current traffic',
        environment: { chartOrigin: { latitude: 26, longitude: 73 }, drawnARP: false, rangeNm: 60, stationName: 'NAV0', stationType: 'df',
            stationXNm: 2, stationYNm: -3, stationFrequency: '', aerodromeName: 'Reusable training sector',
            chartReference: 'Instructor chart', effectiveInfo: 'Training geometry', briefing: 'Chart briefing',
            magneticVariationDeg: 1, magneticVariationKnown: true, runwayHeadingDeg: 270, runwayLengthNm: 1.5,
            aerodromeElevationFt: 400, thresholdCrossingHeightFt: 50,
            map: { imageId: '', widthNm: 60, originXPct: 50, originYPct: 50, rotationDeg: 0, opacity: .5 },
            qnhHpa: 998, windDirectionDeg: 20, windSpeedKt: 15, transitionAltitudeFt: 5000, transitionLevel: 60,
            dfHoldSeconds: 10, separationNm: 5, separationFt: 1000, separationMinutes: 10, token: 'PRIVATE' },
        fixes: [{ id: 'west', name: 'WEST', xNm: -10, yNm: 0 }, { id: 'east', name: 'EAST', xNm: 10, yNm: 0 }],
        routes: [{ id: 'route-one', name: 'TRAINING1', kind: 'ats', fixIds: ['west', 'east'], active: true,
            availableFrom: 0, availableUntil: 0, minAltitudeFt: 0, maxAltitudeFt: 60000, chartDirection: 'both',
            levelLimits: 'FL 100 / FL 200', publishedLimitsHeading: 'Upper / lower',
            publishedSegments: [{ from: 'WEST', to: 'EAST', sourceSequence: 1, levelLimits: 'FL 200 FL 100',
                oddLevels: '↑', evenLevels: '↓', source: 'Dated chart', reference: 'Instructor page', effectiveInfo: 'Training only' }] }],
        areas: [{ id: 'danger-one', name: 'Training danger area', kind: 'danger', active: true,
            floorLabel: 'GND', ceilingLabel: 'FL100', points: [{ xNm: 1, yNm: 1 }, { xNm: 4, yNm: 1 }, { xNm: 4, yNm: 4 }] }],
        scopeDisplay: { hiddenRouteIds: [], hiddenAreaIds: [], routesHidden: false, areasHidden: false },
        aircraft: [{ id: 'ac1', callsign: 'VIPER1', xNm: 14, yNm: 5, headingDeg: 90, speedKt: 315, altitudeFt: 9000,
            targetAltitudeFt: 13000, routeId: 'route-one', routeIndex: 1, pendingClearances: [{ fixId: 'east' }] }],
        strips: { ac1: { notes: 'Keep student work' } }, calls: [{ text: 'Keep this call' }], reports: [{ text: 'Keep report' }],
        events: [{ kind: 'pilot-report' }], criteria: [{ id: 'criterion' }], radio: { phase: 'talking' }, pin: '123456', token: 'PRIVATE',
    };
}
const exported = state => ({ version: 1, scenario: copy(state) });
const prepared = (state = scenario(), name = 'Stored airspace') => copy(library.prepareAirspaceTemplate(exported(state), name));

function harness({ stored = [], state = scenario() } = {}) {
    const h = domHarness('<html><head></head><body><div id="airspace-container"></div></body></html>');
    let generation = 1, draft = false, allow = true, changed = 0, exportHandler = async () => exported(state), commandHandler;
    const commands = [], requests = [], prompts = [], messages = [], downloads = [];
    h.context.localStorage.setItem(storageKey, JSON.stringify(stored));
    h.context.localStorage.setItem(exerciseStorageKey, JSON.stringify([{ name: 'Existing full exercise' }]));
    Object.assign(h.context, geometry, chart, exercise, {
        confirm: prompt => { prompts.push(prompt); return allow; }, atob, btoa,
        URL: { createObjectURL(blob) { downloads.push(blob); return 'blob:airspace'; }, revokeObjectURL() {} },
        host: {
            container: h.document.getElementById('airspace-container'), view: () => state, generation: () => generation,
            hasDraft: () => draft, request: async (path, body) => { requests.push({ path, body });
                if (path === '/api/procedural/export') return exportHandler();
                if (path === '/api/procedural/map') return { imageId: 'a'.repeat(64) };
                throw new Error('Unexpected request'); },
            command: async (type, payload, _, exerciseId) => { commands.push({ type, payload: copy(payload), exerciseId });
                if (commandHandler) await commandHandler(type, payload);
                else { Object.assign(state.environment, copy(payload.environment)); state.fixes = copy(payload.fixes); state.routes = copy(payload.routes); state.areas = copy(payload.areas); state.scopeDisplay = copy(payload.scopeDisplay); state.revision++; } },
            changed: () => changed++, message: (...args) => messages.push(args),
        },
    });
    vm.runInContext('(function(){\n' + source('airspace-library.js').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '')
        + '\nglobalThis.airspaceLibrary=createAirspaceLibrary(host);airspaceLibrary.render();})();', h.context);
    const get = id => h.document.getElementById(id);
    const click = async id => { get(id).click(); await flush(); };
    const name = value => { get('airspace-name').value = value; get('airspace-name').dispatchEvent(new h.Event('input')); };
    return { ...h, get, click, name, state, commands, requests, prompts, messages, downloads,
        read: () => JSON.parse(h.context.localStorage.getItem(storageKey)),
        status: () => get('airspace-library-status').textContent,
        generation: value => { generation = value; }, draft: value => { draft = value; }, allow: value => { allow = value; },
        exportHandler: fn => { exportHandler = fn; }, commandHandler: fn => { commandHandler = fn; }, changed: () => changed,
        importFile: async text => { get('airspace-import').files = [{ size: Buffer.byteLength(text), text: async () => text }]; get('airspace-import').dispatchEvent(new h.Event('change')); await flush(); },
    };
}

test('portable airspace strips all traffic, records, identity and exercise environment while preserving sourced chart metadata', () => {
    const state = scenario();
    state.routes[0].aircraft = copy(state.aircraft); state.areas[0].token = 'PRIVATE'; state.environment.chartOrigin.token = 'PRIVATE';
    state.scopeDisplay.aircraft = copy(state.aircraft); state.environment.map.pin = '123456';
    const asset = prepared(state), text = JSON.stringify(asset);
    assert.equal(asset.format, 'ats-simbox-airspace'); assert.equal(asset.version, 1);
    assert.deepEqual(Object.keys(asset.environment).sort(), library.AIRSPACE_ENVIRONMENT_KEYS.filter(key => key in state.environment).sort());
    for (const field of ['aircraft', 'exerciseId', 'elapsed', 'strips', 'calls', 'reports', 'events', 'criteria', 'radio', 'pin', 'token', 'qnhHpa', 'windSpeedKt', 'transitionLevel', 'dfHoldSeconds']) assert.doesNotMatch(text, new RegExp('"' + field + '"'));
    assert.equal(asset.routes[0].publishedSegments[0].oddLevels, '↑');
    assert.equal(asset.routes[0].publishedSegments[0].evenLevels, '↓');
    assert.equal(asset.areas[0].kind, 'danger');
    assert.deepEqual(copy(library.parseAirspaceTemplate(JSON.stringify(asset))), asset);
});

test('airspace parser rejects full exercises, invalid polygons, missing references, malformed origins and oversized files', () => {
    assert.throws(() => library.parseAirspaceTemplate(JSON.stringify(exported(scenario()))), /airspace file/);
    const source = scenario(); source.areas[0].points.push({ xNm: 1, yNm: 1 });
    assert.throws(() => prepared(source), /closing vertex/);
    const missing = scenario(); missing.routes[0].fixIds[1] = 'missing'; assert.throws(() => prepared(missing), /references/);
    const origin = scenario(); origin.environment.chartOrigin.latitude = 90; assert.throws(() => prepared(origin), /ARP/);
    assert.throws(() => library.parseAirspaceTemplate(' '.repeat(20 * 1024 * 1024 + 1)), /20 MB/);
    const wrong = scenario(); wrong.routes[0].publishedSegments[0].to = 'WRONG'; assert.throws(() => prepared(wrong), /leg order/);
});

test('saved route WGS84 geometry must agree with its fix coordinates', () => {
    const state = scenario(), route = state.routes[0], origin = state.environment.chartOrigin;
    route.coordinateOrigin = copy(origin); route.geoPoints = [geometry.destination(origin, 270, 10), geometry.destination(origin, 90, 10)];
    assert.equal(prepared(state).routes[0].geoPoints.length, 2);
    route.geoPoints[1] = geometry.destination(origin, 90, 11);
    assert.throws(() => prepared(state), /does not match/);
});

test('mouse-drawn ARP saves and reloads local position without retaining a published origin', async () => {
    const state = scenario(), origin = copy(state.environment.chartOrigin);
    state.routes[0].coordinateOrigin = origin;
    state.routes[0].geoPoints = [geometry.destination(origin, 270, 10), geometry.destination(origin, 90, 10)];
    delete state.environment.chartOrigin;
    Object.assign(state.environment, { drawnARP: true, stationName: 'ARP', stationXNm: 7.5, stationYNm: -4.25 });
    const stored = prepared(state);
    assert.equal(stored.environment.drawnARP, true);
    assert.equal(stored.environment.chartOrigin, null, 'engine exports omit nil origins; the saved chart must explicitly clear an unrelated origin');
    assert.equal(stored.environment.stationXNm, 7.5); assert.equal(stored.environment.stationYNm, -4.25);
    assert.deepEqual(stored.routes[0].coordinateOrigin, origin, 'existing sourced geometry retains its original projection');
    const h = harness({ stored: [stored] }), original = copy(h.state);
    h.get('airspace-select').value = stored.id; await h.click('airspace-load');
    assert.equal(h.state.environment.chartOrigin, null); assert.equal(h.state.environment.drawnARP, true);
    assert.equal(h.state.environment.stationXNm, 7.5); assert.equal(h.state.environment.stationYNm, -4.25);
    assert.deepEqual(h.state.aircraft, original.aircraft);
    assert.deepEqual(copy(library.parseAirspaceTemplate(JSON.stringify(stored))), stored);
});

test('older airspace files clear a current local ARP marker and malformed marker combinations are rejected', async () => {
    const old = scenario(); delete old.environment.drawnARP;
    const stored = prepared(old), h = harness({ stored: [stored] });
    h.state.environment.drawnARP = true; h.state.environment.chartOrigin = null;
    assert.equal(stored.environment.drawnARP, false);
    h.get('airspace-select').value = stored.id; await h.click('airspace-load');
    assert.equal(h.state.environment.drawnARP, false); assert.deepEqual(h.state.environment.chartOrigin, old.environment.chartOrigin);
    for (const marker of ['true', 1, null]) {
        const invalid = scenario(); invalid.environment.drawnARP = marker;
        assert.throws(() => prepared(invalid), /mouse-drawn ARP/);
    }
    const contradictory = scenario(); contradictory.environment.drawnARP = true;
    assert.throws(() => prepared(contradictory), /local NM/);
});

test('portable map must be present and match chart image identity', () => {
    const state = scenario(); state.environment.map.imageId = 'a'.repeat(64);
    assert.throws(() => prepared(state), /no image file/);
    const bundle = exported(state); bundle.mapAsset = { id: 'b'.repeat(64), mime: 'image/png', data: 'aGVsbG8=' };
    assert.throws(() => library.prepareAirspaceTemplate(bundle, 'Image chart'), /map is invalid/);
    bundle.mapAsset.id = 'a'.repeat(64);
    assert.equal(library.prepareAirspaceTemplate(bundle, 'Image chart').mapAsset.data, 'aGVsbG8=');
});

test('Save airspace works paused after elapsed time and preserves full-exercise library and traffic records', async () => {
    const h = harness(), original = copy(h.state); h.name('Progressed chart');
    await h.click('airspace-save');
    assert.equal(h.read().length, 1); assert.match(h.status(), /saved on this browser/);
    assert.deepEqual(h.state, original); assert.equal(h.commands.length, 0);
    assert.deepEqual(JSON.parse(h.context.localStorage.getItem(exerciseStorageKey)), [{ name: 'Existing full exercise' }]);
    assert.doesNotMatch(JSON.stringify(h.read()), /VIPER1|Keep this call|123456/);
});

test('Save blocks chart drafts and running state before export; unapplied traffic is outside its host draft contract', async () => {
    const h = harness(); h.name('Draft chart'); h.draft(true);
    await h.click('airspace-save'); assert.equal(h.requests.length, 0); assert.match(h.status(), /unsaved chart/);
    h.draft(false); h.state.running = true;
    await h.click('airspace-save'); assert.equal(h.requests.length, 0); assert.match(h.status(), /Pause/);
    h.state.running = false; await h.click('airspace-save'); assert.equal(h.read().length, 1);
});

test('failed quota write leaves the persisted list and selection unchanged and exposes an explicitly unsaved backup', async () => {
    const original = prepared(), h = harness({ stored: [original] });
    h.get('airspace-select').value = original.id; h.name('Replacement');
    h.context.localStorage.setItem = () => { throw new Error('Quota exceeded'); };
    await h.click('airspace-save');
    assert.deepEqual(h.read(), [original]); assert.equal(h.get('airspace-select').value, original.id);
    assert.match(h.status(), /not saved/); assert.match(h.status(), /saved list is unchanged/);
    assert.equal(h.get('airspace-backup').hidden, false);
    await h.click('airspace-backup');
    assert.equal(h.downloads.length, 1); const backup = JSON.parse(await h.downloads[0].text());
    assert.equal(backup.name, 'Replacement'); assert.equal(backup.id, original.id);
});

test('a changed exercise, revision or role cannot finish a stale airspace save', async () => {
    for (const change of [h => h.generation(2), h => h.state.revision++, h => h.state.role = 'student']) {
        const h = harness(); let resolve; h.name('Delayed chart');
        h.exportHandler(() => new Promise(done => { resolve = done; }));
        await h.click('airspace-save'); assert.equal(h.get('airspace-save').disabled, true);
        const stale = exported(h.state); change(h); resolve(stale); await flush();
        assert.equal(h.read().length, 0); assert.equal(h.commands.length, 0); assert.match(h.status(), /changed/);
    }
});

test('replacement confirmation cancels cleanly and rejects a newer revision', async () => {
    const original = prepared(), h = harness({ stored: [original] });
    h.get('airspace-select').value = original.id; h.name('Changed title'); h.allow(false);
    await h.click('airspace-save'); assert.deepEqual(h.read(), [original]);
    let resolve; h.context.ATCSuiteWorkspace = { confirmAction: () => new Promise(done => { resolve = done; }) };
    await h.click('airspace-save'); h.state.revision++; resolve(true); await flush();
    assert.deepEqual(h.read(), [original]); assert.match(h.status(), /changed/);
});

test('airspace-only Load sends a revision-checked chart command and keeps all current traffic/progress fields', async () => {
    const chartState = scenario(); chartState.environment.aerodromeName = 'Alternate chart'; chartState.areas[0].name = 'Different area';
    const stored = prepared(chartState), h = harness({ stored: [stored] });
    const original = copy(h.state); h.get('airspace-select').value = stored.id; await h.click('airspace-load');
    assert.equal(h.commands.length, 1); const command = h.commands[0];
    assert.equal(command.type, 'airspace-replace'); assert.equal(command.exerciseId, original.exerciseId); assert.equal(command.payload.expectedRevision, 4);
    assert.deepEqual(Object.keys(command.payload).sort(), ['expectedRevision', 'environment', 'fixes', 'routes', 'areas', 'scopeDisplay'].sort());
    for (const key of ['exerciseId', 'elapsed', 'aircraft', 'strips', 'calls', 'reports', 'events', 'criteria', 'radio', 'pin']) assert.deepEqual(h.state[key], original[key], key);
    assert.equal(h.state.environment.qnhHpa, 998); assert.equal(h.state.environment.windSpeedKt, 15);
    assert.equal(h.state.environment.aerodromeName, 'Alternate chart'); assert.equal(h.changed(), 1);
    assert.match(h.prompts[0], /replace only the current airspace/); assert.match(h.status(), /records are kept/);
});

test('Load cancellation and stale confirmation retain unsaved chart entries and do not send any command', async () => {
    const stored = prepared(), h = harness({ stored: [stored] }); h.get('airspace-select').value = stored.id; h.draft(true); h.allow(false);
    await h.click('airspace-load'); assert.equal(h.commands.length, 0); assert.equal(h.changed(), 0); assert.match(h.prompts[0], /Unsaved chart entries/);
    let resolve; h.context.ATCSuiteWorkspace = { confirmAction: () => new Promise(done => { resolve = done; }) };
    await h.click('airspace-load'); h.state.revision++; resolve(true); await flush();
    assert.equal(h.commands.length, 0); assert.equal(h.changed(), 0); assert.match(h.status(), /changed/);
});

test('successful airspace load clears confirmed chart drafts and failed loads keep them', async () => {
    const stored = prepared(), h = harness({ stored: [stored] }); h.get('airspace-select').value = stored.id;
    let loaded = 0;
    h.context.host.loaded = () => { loaded++; h.draft(false); };
    h.draft(true); h.commandHandler(async () => { throw new Error('Chart load rejected'); });
    await h.click('airspace-load'); assert.equal(loaded, 0); assert.equal(h.context.host.hasDraft(), true);
    h.commandHandler(undefined);
    await h.click('airspace-load'); assert.equal(loaded, 1); assert.equal(h.context.host.hasDraft(), false);
    h.name('Loaded chart'); await h.click('airspace-save'); assert.match(h.status(), /Airspace saved/);
});

test('missing navigation dependency errors remain visible and leave the current chart untouched', async () => {
    const stored = prepared(), h = harness({ stored: [stored] }), original = copy(h.state); h.get('airspace-select').value = stored.id;
    h.commandHandler(async () => { throw new Error('Keep referenced route route-one and fix east unchanged before loading airspace.'); });
    await h.click('airspace-load'); assert.deepEqual(h.state, original); assert.equal(h.changed(), 0); assert.match(h.status(), /referenced route/);
});

test('student, running and terminated desks cannot load or manage airspace', async () => {
    const stored = prepared(), h = harness({ stored: [stored] }); h.get('airspace-select').value = stored.id;
    h.state.running = true; await h.click('airspace-load'); assert.equal(h.commands.length, 0); assert.match(h.status(), /Pause/);
    h.state.running = false; h.state.terminated = true; await h.click('airspace-load'); assert.equal(h.commands.length, 0); assert.match(h.status(), /Reopen/);
    h.state.terminated = false; h.state.role = 'student'; h.context.airspaceLibrary.render();
    assert.equal(h.get('airspace-library').hidden, true); assert.equal(h.get('airspace-save').disabled, true);
    await h.click('airspace-delete'); assert.deepEqual(h.read(), [stored]); assert.equal(h.commands.length, 0);
});

test('Import adds only the device asset; explicit Load applies it, and deletion never touches the exercise', async () => {
    const stored = prepared(), h = harness(), original = copy(h.state);
    assert.equal(h.get('airspace-export').textContent, 'Download file');
    assert.equal(h.get('airspace-files').contains(h.get('airspace-delete')), false, 'removal is not a routine file action');
    assert.equal(h.get('airspace-remove').contains(h.get('airspace-delete')), true);
    assert.equal(h.get('airspace-remove').querySelector('summary').textContent, 'Remove saved airspace');
    assert.equal(Boolean(h.get('airspace-remove').open), false);
    await h.importFile(JSON.stringify(stored)); assert.deepEqual(h.read(), [stored]); assert.equal(h.commands.length, 0);
    assert.match(h.status(), /Select Load/); assert.equal(h.get('airspace-select').value, stored.id);
    await h.click('airspace-export'); assert.equal(h.downloads.length, 1); assert.deepEqual(JSON.parse(await h.downloads[0].text()), stored);
    h.allow(false); await h.click('airspace-delete'); assert.deepEqual(h.read(), [stored]);
    h.allow(true); await h.click('airspace-delete'); assert.equal(h.read().length, 0); assert.deepEqual(h.state, original);
});

test('saved library reopens offline and detects a concurrent window change instead of overwriting it', async () => {
    const stored = prepared(), h = harness({ stored: [stored] }); assert.equal(h.get('airspace-select').querySelectorAll('option').length, 2);
    h.name('New chart'); let resolve; h.exportHandler(() => new Promise(done => { resolve = done; }));
    await h.click('airspace-save'); const another = prepared(scenario(), 'Other window chart');
    h.context.localStorage.setItem(storageKey, JSON.stringify([stored, another])); resolve(exported(h.state)); await flush();
    assert.deepEqual(h.read(), [stored, another]); assert.match(h.status(), /another window/);
});

test('map-backed Load verifies uploaded bytes and refuses checksum mismatch or a changed session before chart replacement', async () => {
    const chartState = scenario(); chartState.environment.map.imageId = 'a'.repeat(64);
    const bundle = exported(chartState); bundle.mapAsset = { id: 'a'.repeat(64), mime: 'image/png', data: 'aGVsbG8=' };
    const stored = copy(library.prepareAirspaceTemplate(bundle, 'Portable image chart'));
    const success = harness({ stored: [stored] }); success.get('airspace-select').value = stored.id;
    await success.click('airspace-load');
    assert.equal(success.requests.length, 1); assert.equal(success.requests[0].path, '/api/procedural/map');
    assert.equal(await success.requests[0].body.text(), 'hello'); assert.equal(success.requests[0].body.type, 'image/png');
    assert.equal(success.commands[0].type, 'airspace-replace');
    const mismatch = harness({ stored: [stored] }), original = copy(mismatch.state); mismatch.get('airspace-select').value = stored.id;
    mismatch.context.host.request = async () => ({ imageId: 'b'.repeat(64) });
    await mismatch.click('airspace-load'); assert.equal(mismatch.commands.length, 0); assert.deepEqual(mismatch.state, original); assert.match(mismatch.status(), /checksum/);
    const stale = harness({ stored: [stored] }); stale.get('airspace-select').value = stored.id;
    let resolve; stale.context.host.request = () => new Promise(done => { resolve = done; });
    await stale.click('airspace-load'); stale.generation(2); resolve({ imageId: 'a'.repeat(64) }); await flush();
    assert.equal(stale.commands.length, 0); assert.equal(stale.changed(), 0); assert.match(stale.status(), /changed/);
});

test('unreadable stored library is not silently erased when saving a new portable chart', async () => {
    const h = harness(); h.context.localStorage.setItem(storageKey, 'corrupt saved airspace bytes'); h.context.airspaceLibrary.render(); h.name('Recovery snapshot');
    await h.click('airspace-save');
    assert.equal(h.context.localStorage.getItem(storageKey), 'corrupt saved airspace bytes');
    assert.match(h.status(), /not saved/); assert.equal(h.get('airspace-backup').hidden, false);
    await h.click('airspace-backup'); assert.equal(JSON.parse(await h.downloads[0].text()).name, 'Recovery snapshot');
});
