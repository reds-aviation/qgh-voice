import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';

const source = name => readFileSync(new URL('./static/' + name, import.meta.url), 'utf8');
const uri = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const geometryURI = uri(source('chart-geometry.js'));
const scopeURI = uri(source('scope-navigation.js'));
const chartURI = uri(source('route-chart.js').replace("'./chart-geometry.js'", JSON.stringify(geometryURI)).replace("'./scope-navigation.js'", JSON.stringify(scopeURI)));
const boundaryURI = uri(source('airspace-preparation.js').replace("'./chart-geometry.js'", JSON.stringify(geometryURI)));
const exerciseURI = uri(source('scenario-library.js').replace("'./airspace-preparation.js'", JSON.stringify(boundaryURI)).replace("'./chart-geometry.js'", JSON.stringify(geometryURI)).replace("'./route-chart.js'", JSON.stringify(chartURI)));
const { parseExerciseTemplate } = await import(exerciseURI);
const { createExerciseSetupArchive } = await import(uri(source('exercise-setup-archive.js').replace("'./scenario-library.js'", JSON.stringify(exerciseURI))));
const copy = value => JSON.parse(JSON.stringify(value));

function harness() {
    globalThis.indexedDB = new IDBFactory();
    const state = {
        version: 1, exerciseId: 'starting-archive', role: 'instructor', revision: 4,
        elapsed: 0, running: false, terminated: false, title: 'Training sector', mode: 'area',
        environment: { stationName: 'ARP', stationXNm: 2, stationYNm: -3, drawnARP: true,
            qnhHpa: 1002, runwayHeadingDeg: 270, map: { imageId: 'a'.repeat(64) } },
        fixes: [{ id: 'west', name: 'WEST', xNm: -10, yNm: 0 }, { id: 'east', name: 'EAST', xNm: 10, yNm: 0 }],
        routes: [{ id: 'ats', name: 'TRAINING1', kind: 'ats', fixIds: ['west', 'east'], active: true,
            minAltitudeFt: 8000, maxAltitudeFt: 24000, chartDirection: 'both', levelLimits: 'FL 100–200' }],
        areas: [{ id: 'danger', name: 'Danger training area', kind: 'danger', active: true,
            floorLabel: 'GND', ceilingLabel: 'FL100', points: [{ xNm: 1, yNm: 1 }, { xNm: 4, yNm: 1 }, { xNm: 4, yNm: 4 }] }],
        scopeDisplay: { hiddenRouteIds: [], hiddenAreaIds: ['danger'] },
        aircraft: [{ id: 'ac1', callsign: 'TEST101', xNm: 14, yNm: 5, headingDeg: 90, speedKt: 315,
            altitudeFt: 9000, routeId: 'ats', routeIndex: 0, turnRateDegPerSec: 3, verticalRateFtPerMin: 1500 }],
        calls: [{ text: 'preparation call' }], reports: [{ text: 'preparation report' }],
        events: [{ type: 'target-heading' }], radio: { phase: 'talking', text: 'preparation radio' },
        pin: '123456', token: 'PRIVATE', sequence: 10,
    };
    const mapAsset = { id: 'a'.repeat(64), mime: 'image/png', data: 'YQ==' };
    let generation = 1, requests = 0, exportHandler = async () => ({ version: 1, scenario: copy(state), mapAsset: copy(mapAsset) });
    const host = { view: () => state, generation: () => generation,
        request: async path => { assert.equal(path, '/api/procedural/export'); requests++; return exportHandler(); } };
    return { state, host, mapAsset, archive: createExerciseSetupArchive(host),
        generation: value => { generation = value; }, requests: () => requests,
        exportHandler: value => { exportHandler = value; },
        exported: () => ({ version: 1, scenario: copy(state), mapAsset: copy(mapAsset) }) };
}

test('review download preserves initial traffic and complete chart after movement and termination, and reimports as a starting exercise', async () => {
    const h = harness(), initial = copy(h.state);
    const captured = await h.archive.capture();
    Object.assign(h.state.aircraft[0], { xNm: -35, yNm: 50, headingDeg: 225, speedKt: 200, altitudeFt: 17000 });
    h.state.areas[0].active = false; h.state.routes[0].levelLimits = 'Changed during exercise';
    Object.assign(h.state, { elapsed: 180, revision: 120, running: false, terminated: true,
        events: [{ type: 'terminate' }], calls: [{ text: 'later call' }], radio: { phase: 'talking', text: 'later radio' } });
    const downloaded = await h.archive.downloadBundle(), scenario = downloaded.bundle.scenario;
    assert.equal(h.requests(), 1, 'review uses the captured export rather than reconstructing final traffic');
    assert.deepEqual(scenario.aircraft, initial.aircraft); assert.deepEqual(scenario.environment, initial.environment);
    assert.deepEqual(scenario.fixes, initial.fixes); assert.deepEqual(scenario.routes, initial.routes);
    assert.deepEqual(scenario.areas, initial.areas); assert.deepEqual(scenario.scopeDisplay, initial.scopeDisplay);
    assert.deepEqual(downloaded.bundle.mapAsset, h.mapAsset);
    assert.equal(scenario.elapsed, 0); assert.equal(scenario.running, false); assert.equal(scenario.terminated, false);
    assert.equal(scenario.sequence, 0); assert.deepEqual(scenario.events, []); assert.deepEqual(scenario.calls, []); assert.deepEqual(scenario.reports, []);
    assert.equal(scenario.radio.phase, 'idle'); assert.equal(scenario.radio.text, '');
    assert.doesNotMatch(JSON.stringify(downloaded), /123456|PRIVATE|"pin"|"token"/);
    assert.deepEqual(copy(parseExerciseTemplate(JSON.stringify(downloaded))), downloaded);
    assert.equal(downloaded.id, captured.id);
    downloaded.bundle.scenario.aircraft[0].xNm = 123;
    assert.equal((await h.archive.downloadBundle()).bundle.scenario.aircraft[0].xNm, 14, 'consumer mutations cannot alter the archive');
});

test('a new archive instance recovers the initial setup from IndexedDB after page recovery', async () => {
    const h = harness(); await h.archive.capture();
    Object.assign(h.state, { elapsed: 600, revision: 80, terminated: true }); h.state.aircraft[0].xNm = 25;
    h.exportHandler(async () => { throw new Error('Final export must not be requested'); });
    const recovered = await createExerciseSetupArchive(h.host).downloadBundle();
    assert.equal(recovered.bundle.scenario.aircraft[0].xNm, 14); assert.equal(recovered.bundle.scenario.elapsed, 0);
});

test('legacy 21–24 aircraft exercises remain startable and their initial archive survives page recovery', async () => {
    for (const count of [21, 24]) {
        const h = harness(), first = h.state.aircraft[0];
        h.state.aircraft = Array.from({ length: count }, (_, index) => ({ ...first, id: `ac${index + 1}`, callsign: `TEST${index + 101}`, xNm: 14 + index }));
        const initial = copy(h.state.aircraft);
        const captured = await h.archive.capture();
        assert.equal(captured.bundle.scenario.aircraft.length, count);
        assert.throws(() => parseExerciseTemplate(JSON.stringify(captured)), /up to 20 aircraft/, 'new templates still use the current 20-aircraft limit');
        Object.assign(h.state, { elapsed: 60, revision: 80 });
        h.state.aircraft[0].xNm = 90;
        h.exportHandler(async () => { throw new Error('Final export must not be requested'); });
        const recovered = await createExerciseSetupArchive(h.host).downloadBundle();
        assert.deepEqual(recovered.bundle.scenario.aircraft, initial);
        assert.equal(recovered.bundle.scenario.elapsed, 0);
    }
});

test('zero-time downloads capture the current setup and refresh any earlier pre-run snapshot', async () => {
    const h = harness(); await h.archive.capture(); h.state.aircraft[0].xNm = 24; h.state.revision++;
    const downloaded = await h.archive.downloadBundle(); assert.equal(downloaded.bundle.scenario.aircraft[0].xNm, 24);
    h.state.elapsed = 60; h.state.revision++; h.state.aircraft[0].xNm = 28;
    assert.equal((await h.archive.downloadBundle()).bundle.scenario.aircraft[0].xNm, 24);
});

test('older underway exercises without a snapshot offer progress download instead of inventing starts', async () => {
    const h = harness(); Object.assign(h.state, { elapsed: 120, revision: 80, terminated: true });
    await assert.rejects(h.archive.downloadBundle(), /Starting setup unavailable.*Download current progress/);
    await assert.rejects(h.archive.capture(), /Starting setup unavailable/);
    assert.equal(h.requests(), 0);
});

test('capture rejects changed generation, exercise identity and revision during export', async () => {
    for (const change of [h => h.generation(2), h => { h.state.exerciseId = 'other'; }, h => { h.state.revision++; }]) {
        const h = harness(); h.exportHandler(async () => { const bundle = h.exported(); change(h); return bundle; });
        await assert.rejects(h.archive.capture(), /exercise changed/);
        h.state.elapsed = 10; await assert.rejects(h.archive.downloadBundle(), /Starting setup unavailable/);
    }
});

test('exports from another state and invalid chart geometry cannot become an archive', async () => {
    for (const change of [bundle => { bundle.scenario.exerciseId = 'wrong'; }, bundle => { bundle.scenario.revision++; },
        bundle => { bundle.scenario.running = true; }, bundle => { bundle.scenario.routes[0].fixIds[1] = 'missing'; }]) {
        const h = harness(); h.exportHandler(async () => { const bundle = h.exported(); change(bundle); return bundle; });
        await assert.rejects(h.archive.capture(), /changed|before Run|references/);
        h.state.elapsed = 10; await assert.rejects(h.archive.downloadBundle(), /Starting setup unavailable/);
    }
});

test('blocked durable storage keeps the starting snapshot downloadable in the current page', async () => {
    const h = harness(); globalThis.indexedDB = { open() { throw new Error('Storage denied'); } };
    await h.archive.capture(); h.state.elapsed = 180; h.state.revision++;
    assert.equal((await h.archive.downloadBundle()).bundle.scenario.aircraft[0].xNm, 14);
    await assert.rejects(createExerciseSetupArchive(h.host).downloadBundle(), /Starting setup unavailable/);
});

test('student positions cannot capture or download instructor exercise setup', async () => {
    const h = harness(); h.state.role = 'student';
    await assert.rejects(h.archive.capture(), /instructor exercise/); await assert.rejects(h.archive.downloadBundle(), /instructor exercise/);
    assert.equal(h.requests(), 0);
});
