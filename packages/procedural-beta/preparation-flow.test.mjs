import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { domHarness } from './testing/dom-harness.mjs';

const source = name => readFileSync(new URL('./static/' + name, import.meta.url), 'utf8');
const uri = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const geometryURI = uri(source('chart-geometry.js'));
const geometry = await import(geometryURI);
const scopeNavigationURI = uri(source('scope-navigation.js'));
const routeChart = await import(uri(source('route-chart.js').replace("'./chart-geometry.js'", JSON.stringify(geometryURI)).replace("'./scope-navigation.js'", JSON.stringify(scopeNavigationURI))));
const calibration = await import(uri(source('chart-calibration.js').replace("'./chart-geometry.js'", JSON.stringify(geometryURI))));
const navigation = await import(uri(source('aip-navigation.js').replace("'./chart-geometry.js'", JSON.stringify(geometryURI))));
const flush = () => new Promise(resolve => setImmediate(resolve));
const copy = value => JSON.parse(JSON.stringify(value));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} / ${expected}`);
const storageKey = 'ats-simbox-exercise-templates-v1';

function startingScenario() {
    return {
        version: 1, exerciseId: 'prepare-one', revision: 4, mode: 'approach', title: 'Saved starting setup',
        elapsed: 0, running: false, terminated: false,
        environment: { chartOrigin: { latitude: 26, longitude: 73 }, stationXNm: 7, stationYNm: -4,
            runwayHeadingDeg: 270, qnhHpa: 998, rangeNm: 60, aerodromeName: 'Training base',
            chartReference: 'Instructor chart', effectiveInfo: '2026-10-08', map: {} },
        aircraft: [{ id: 'ac1', callsign: 'VIPER1', type: 'TRAINER', xNm: 10, yNm: 0,
            headingDeg: 359, speedKt: 315, altitudeFt: 13500, turnRateDegSec: 2.5,
            verticalRateFpm: 1400, spawnTime: 45, compassUnserviceable: true },
        { id: 'ac2', callsign: 'VIPER2', type: 'JET', xNm: 1, yNm: -12,
            headingDeg: 50, speedKt: 410, altitudeFt: 16000, turnRateDegSec: 3,
            verticalRateFpm: 1800, spawnTime: 90, compassUnserviceable: false }],
        fixes: [], routes: [], areas: [], criteria: [], calls: [], events: [],
    };
}

// Real UI modules and their event handlers; only the server boundary is replaced.
// This harness does not render a browser or claim a device/layout result.
async function preparationHarness() {
    const h = domHarness(source('procedural.html'));
    for (const form of h.document.querySelectorAll('form')) form.reset = () => {};
    const trafficContainer = h.document.createElement('div'); trafficContainer.id = 'prepare-traffic';
    h.document.getElementById('setup').append(trafficContainer);
    let scenario = startingScenario(), generation = 1, allowConfirmation = true;
    const commands = [], submissions = [], prompts = [], messages = [], requests = [], loads = [];
    Object.assign(h.context, geometry, calibration, navigation, routeChart, {
        confirm: prompt => { prompts.push(prompt); return allowConfirmation; },
        fetch: async path => ({ ok: true, json: async () => JSON.parse(source(path)) }),
    });
    const loadModule = (name, exports) => vm.runInContext('(function(){\n' + source(name)
        .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '')
        + '\n' + exports.map(name => `globalThis.${name}=${name};`).join('\n') + '\n})();', h.context);
    loadModule('airspace-preparation.js', ['createAirspacePreparation', 'selectPublishedCatalogue', 'validateBoundary']);
    loadModule('scenario-library.js', ['createScenarioLibrary', 'prepareExerciseTemplate']);
    loadModule('airspace-library.js', ['createAirspaceLibrary']);
    loadModule('airspace-preview.js', ['drawAirspacePreview']);
    loadModule('traffic-setup.js', ['createTrafficSetup']);
    loadModule('chart-workshop.js', ['createChartWorkshop']);
    const host = {
        view: () => ({ ...scenario, role: 'instructor' }), generation: () => generation,
        request: async path => { requests.push(path); return { version: 1, scenario: copy(scenario) }; },
        message: (...args) => messages.push(args),
        command: async (name, payload, _, exerciseId) => {
            commands.push({ name, payload: copy(payload), exerciseId });
            if (name === 'environment') Object.assign(scenario.environment, copy(payload));
            else if (name === 'area-upsert') scenario.areas.push({ id: 'custom-area', ...copy(payload) });
            else if (name === 'clock') scenario.running = false;
            else if (name === 'airspace-replace') {
                Object.assign(scenario.environment, copy(payload.environment));
                for (const key of ['fixes', 'routes', 'areas', 'scopeDisplay']) scenario[key] = copy(payload[key]);
            }
            else if (name === 'import') { scenario = copy(payload.scenario); scenario.exerciseId = 'prepare-loaded'; generation++; }
            scenario.revision++;
        }, changed: () => h.context.workshop?.render(),
    };
    h.context.trafficHost = { container: trafficContainer, view: host.view,
        submit: async payload => { submissions.push(copy(payload)); h.context.traffic.markApplied(); },
        airspace() {}, cancel() {} };
    vm.runInContext('globalThis.traffic=createTrafficSetup(trafficHost);', h.context);
    h.context.workshopHost = { ...host,
        openTraffic: () => h.context.traffic.open(), closeTraffic: () => h.context.traffic.close(),
        hasDraft: () => h.context.traffic.hasDraft(),
        loaded: loaded => {
            loads.push(copy(loaded)); h.context.workshop.discardDraft(); h.context.traffic.resetFromScenario(loaded);
            h.context.workshop.render();
        },
    };
    vm.runInContext('globalThis.workshop=createChartWorkshop(workshopHost);workshop.render();', h.context);
    await flush();
    const get = id => h.document.getElementById(id);
    const edit = (input, value) => { input.value = String(value); input.dispatchEvent(new h.Event('input', { bubbles: true })); };
    const click = async id => { get(id).click(); await flush(); };
    const submit = async id => { get(id).dispatchEvent(new h.Event('submit', { cancelable: true })); await flush(); };
    return { ...h, get, edit, click, submit, commands, submissions, prompts, messages, requests, loads,
        workshop: h.context.workshop, traffic: h.context.traffic,
        state: () => scenario, confirm: allowed => { allowConfirmation = allowed; },
        readSaved: () => JSON.parse(h.context.localStorage.getItem(storageKey) || '[]'),
    };
}

test('suggested save name follows a new exercise and preserves typed names or selected saved identity', async () => {
    const h = await preparationHarness();
    assert.equal(h.get('template-name').value, h.state().title);
    h.state().title = 'New custom exercise'; h.workshop.render();
    assert.equal(h.get('template-name').value, 'New custom exercise');
    h.edit(h.get('template-name'), 'Instructor chosen name');
    h.state().title = 'Another created exercise'; h.workshop.render();
    assert.equal(h.get('template-name').value, 'Instructor chosen name', 'typed names survive subsequent exercise titles');
    await h.click('template-save'); const savedID = h.get('template-select').value;
    h.get('template-select').dispatchEvent(new h.Event('change'));
    h.state().title = 'Latest live exercise'; h.workshop.render();
    assert.equal(h.get('template-select').value, savedID);
    assert.equal(h.get('template-name').value, 'Instructor chosen name', 'selected saved exercise identity controls its name');
});

test('shared same-screen replacement waits for a choice, preserves Cancel, and rejects a changed exercise before Load', async () => {
    const h = await preparationHarness();
    h.edit(h.get('template-name'), 'Dialog exercise'); await h.click('template-save');
    const original = h.readSaved();
    let resolve, label;
    h.context.ATCSuiteWorkspace = { confirmAction: (_, options) => { label = options.confirmLabel; return new Promise(done => { resolve = done; }); } };
    h.edit(h.get('template-name'), 'Updated dialog exercise'); await h.click('template-save');
    assert.equal(label, 'Replace saved exercise');
    assert.equal(h.get('template-save').disabled, true);
    assert.deepEqual(h.readSaved(), original, 'replacement has not happened while confirmation is pending');
    resolve(false); await flush();
    assert.deepEqual(h.readSaved(), original, 'Cancel keeps the saved exercise');
    await h.click('template-load');
    assert.equal(label, 'Load exercise');
    assert.equal(h.commands.length, 0);
    h.state().exerciseId = 'different-live-exercise'; resolve(true); await flush();
    assert.equal(h.commands.length, 0, 'a stale confirmation cannot replace a different exercise');
    assert.match(h.get('scenario-library-status').textContent, /exercise changed/i);
});

test('opening setup contains only starting traffic while saved exercises and samples are inside airspace preparation', async () => {
    const h = await preparationHarness();
    assert.equal(h.get('setup').contains(h.get('prepare-traffic')), true);
    assert.equal(h.get('tab-build').contains(h.get('prepare-traffic')), false);
    assert.equal(h.get('setup').contains(h.get('preset-form')), false);
    assert.equal(h.get('tab-build').contains(h.get('preset-form')), true);
    assert.equal(h.get('setup').contains(h.get('aircraft-form')), false);
    assert.equal(h.get('tab-pilot').contains(h.get('aircraft-form')), true);
    assert.equal(h.get('setup').contains(h.get('prepare-save-load')), false);
    assert.equal(h.get('tab-build').contains(h.get('prepare-save-load')), true);
    assert.equal(h.get('prepare-save-load').contains(h.get('scenario-library')), true);
    assert.equal(h.get('prepare-airspace-library').contains(h.get('airspace-library')), true);
    assert.equal(h.get('prepare-save-load').contains(h.get('prepare-airspace-library')), true);
    assert.equal(h.get('prepare-save-load').contains(h.get('prepare-exercise-library')), true);
    assert.equal(h.get('prepare-save-load').querySelector(':scope > summary').textContent, 'Save or load');
    assert.match(h.get('prepare-save-load').querySelector(':scope > .hint').textContent, /Airspace: chart only.*Exercise: starting aircraft and chart/);
    assert.equal(h.get('prepare-airspace-library').tagName, 'SECTION', 'chart saving does not require another accordion');
    assert.equal(Boolean(h.get('prepare-save-load').open), false, 'storage choices stay collapsed until needed');
    assert.equal(h.get('prepare-save-kind').value, 'airspace');
    assert.equal(h.get('prepare-airspace-library').hidden, false);
    assert.equal(h.get('prepare-exercise-library').hidden, true, 'only the selected library is shown');
    assert.equal(h.get('prepare-advanced').contains(h.get('preset-form')), true, 'samples are not another primary preparation choice');
    assert.equal(h.get('prepare-advanced').contains(h.get('import')), true, 'progress files remain available away from starting-setup saving');
    assert.equal(h.get('prepare-custom').querySelector('h2'), null, 'embedded editor does not repeat a competing page heading');
    assert.equal(h.get('prepare-published').contains(h.get('aerodrome-form')), true);
    assert.equal(h.get('prepare-custom').contains(h.get('custom-arp-form')), true);
    assert.equal(h.get('custom-airspace-discard').hidden, true, 'embedded custom editor uses the common airspace discard action');
    assert.equal(h.get('prepare-airspace-discard').hidden, true, 'there is nothing to discard initially');
    assert.equal(Boolean(h.get('prepare-advanced').open), false);
    assert.equal(Boolean(h.get('template-manage').open), false);
    h.document.querySelector('[data-source="draw"]').click();
    assert.equal(h.get('prepare-custom').hidden, false);
    assert.equal(h.get('prepare-published').hidden, true);
    assert.equal(h.get('custom-boundary-form').elements.namedItem('points').parentElement.hidden, true);
    h.document.querySelector('[data-source="coordinates"]').click();
    assert.equal(h.get('custom-boundary-form').elements.namedItem('points').parentElement.hidden, false);
    await h.click('prepare-traffic-next');
    assert.equal(h.get('prepare-traffic').hidden, false);
    assert.equal(h.get('prepare-traffic').querySelector('.roster-editor').open, true);
    assert.equal(h.get('prepare-traffic').querySelector('button[type="submit"]').textContent, 'Create exercise', 'dynamic traffic updates retain the preparation action label');
    h.workshop.openLibrary();
    assert.equal(h.get('prepare-save-load').open, true);
    assert.equal(h.get('prepare-save-kind').value, 'exercise');
    assert.equal(h.get('prepare-airspace-library').hidden, true);
    assert.equal(h.get('prepare-exercise-library').hidden, false, 'Saved exercises opens the correct library and parent');
    assert.equal(h.get('prepare-traffic').hidden, true);
    h.get('prepare-save-kind').value = 'airspace'; h.get('prepare-save-kind').dispatchEvent(new h.Event('change'));
    assert.equal(h.get('prepare-airspace-library').hidden, false);
    assert.equal(h.get('prepare-exercise-library').hidden, true);
    assert.equal(h.commands.length, 0, 'opening preparation sections does not alter the exercise');
});

test('the common Discard action follows typed and mouse drafts, preserves Cancel, and disappears after applying or clearing entries', async () => {
    const h = await preparationHarness(), discard = h.get('prepare-airspace-discard');
    const arp = h.get('custom-arp-form'), boundary = h.get('custom-boundary-form');
    h.document.querySelector('[data-source="coordinates"]').click();
    assert.equal(discard.hidden, true);
    h.edit(arp.elements.namedItem('aerodromeName'), 'Unsaved name');
    assert.equal(discard.hidden, false, 'typing reveals the applicable discard action');
    h.workshop.render(); assert.equal(discard.hidden, false, 'rendering retains a real draft');
    h.confirm(false); await h.click('prepare-airspace-discard');
    assert.equal(discard.hidden, false); assert.equal(arp.elements.namedItem('aerodromeName').value, 'Unsaved name');
    h.confirm(true); await h.click('prepare-airspace-discard');
    assert.equal(discard.hidden, true); assert.equal(h.workshop.hasDraft(), false);
    h.edit(boundary.elements.namedItem('name'), 'Saved boundary');
    h.edit(boundary.elements.namedItem('points'), '-10,-10\n10,-10\n10,10\n-10,10');
    assert.equal(discard.hidden, false); await h.submit('custom-boundary-form');
    assert.equal(h.commands.at(-1).name, 'area-upsert'); assert.equal(discard.hidden, true);
    h.document.querySelector('[data-source="draw"]').click();
    const canvas = h.get('boundary-sketch-canvas'); canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 720, height: 380 });
    for (const type of ['pointerdown','pointerup']) {
        const event = new h.Event(type, { bubbles: true, cancelable: true });
        Object.assign(event, { clientX: 360, clientY: 190, pointerId: 7, isPrimary: true, button: 0, pointerType: 'mouse' });
        canvas.dispatchEvent(event);
    }
    assert.equal(discard.hidden, false, 'a mouse point reveals Discard without a server update or a typed-input event');
    h.workshop.discardDraft(); assert.equal(discard.hidden, true);
    assert.equal(h.workshop.hasDraft(), false);
});

test('traffic setup can return to an existing exercise without submitting or losing draft aircraft entries', async () => {
    const h = await preparationHarness();
    let canReturn = false, returned = 0;
    h.context.trafficHost.canReturn = () => canReturn;
    h.context.trafficHost.returnToExercise = () => { returned++; };
    h.traffic.open();
    assert.equal(h.get('traffic-return-exercise').hidden, true, 'a fresh room must still create its starting traffic');
    h.traffic.close(); canReturn = true; h.state().elapsed = 120;
    const current = copy(h.state());
    h.traffic.open();
    assert.equal(h.get('traffic-return-exercise').hidden, false);
    const speed = h.get('prepare-traffic').querySelector('[data-field="speedKt"]');
    h.edit(speed, 600);
    await h.click('traffic-return-exercise');
    assert.equal(returned, 1);
    assert.equal(h.get('prepare-traffic').hidden, true);
    assert.equal(h.submissions.length, 0);
    assert.equal(h.commands.length, 0);
    assert.deepEqual(h.state(), current, 'return does not replace aircraft, chart or elapsed time');
    h.traffic.open();
    assert.equal(speed.value, '600', 'unapplied roster changes remain available');
    assert.equal(h.traffic.hasDraft(), true);
});

test('custom ARP and boundary remain staged until saved and block saving an unfinished exercise', async () => {
    const h = await preparationHarness(), arp = h.get('custom-arp-form');
    h.edit(arp.elements.namedItem('latitude'), '26.2');
    h.edit(arp.elements.namedItem('longitude'), '73.1');
    h.edit(arp.elements.namedItem('aerodromeName'), 'Custom training LFA');
    assert.equal(h.workshop.hasDraft(), true); assert.equal(h.commands.length, 0);
    h.get('template-name').value = 'Custom exercise'; await h.click('template-save');
    assert.equal(h.requests.length, 0, 'draft guard runs before exporting');
    assert.equal(h.readSaved().length, 0);
    assert.match(h.get('scenario-library-status').textContent, /Apply your airspace changes/);
    await h.submit('custom-arp-form');
    assert.equal(h.commands.at(-1).name, 'environment');
    assert.deepEqual(h.state().environment.chartOrigin, { latitude: 26.2, longitude: 73.1 });
    assert.equal(h.workshop.hasDraft(), false);
    const boundary = h.get('custom-boundary-form');
    boundary.elements.namedItem('mode').value = 'local';
    h.edit(boundary.elements.namedItem('name'), 'Training boundary');
    h.edit(boundary.elements.namedItem('points'), '-10,-10\n10,-10\n10,10\n-10,10');
    await h.click('template-save'); assert.equal(h.readSaved().length, 0);
    await h.submit('custom-boundary-form');
    assert.equal(h.commands.at(-1).name, 'area-upsert');
    assert.equal(h.commands.at(-1).payload.points.length, 4);
    assert.equal(h.commands.at(-1).payload.geoPoints.length, 4);
    assert.equal(h.workshop.hasDraft(), false);
    await h.click('template-save');
    assert.equal(h.readSaved().length, 1);
    assert.equal(h.readSaved()[0].bundle.scenario.areas[0].name, 'Training boundary');
    assert.equal(h.readSaved()[0].bundle.scenario.environment.aerodromeName, 'Custom training LFA');
});

test('saving an unchanged ARP retains boundary drafts and changing it requires explicit discard confirmation', async () => {
    const h = await preparationHarness(), arp = h.get('custom-arp-form'), boundary = h.get('custom-boundary-form');
    boundary.elements.namedItem('mode').value = 'local';
    const points = '-10,-10\n10,-10\n10,10\n-10,10';
    h.edit(boundary.elements.namedItem('name'), 'Unfinished boundary');
    h.edit(boundary.elements.namedItem('points'), points);
    h.edit(arp.elements.namedItem('aerodromeName'), 'Updated chart name');
    await h.submit('custom-arp-form');
    assert.equal(h.commands.length, 1); assert.equal(h.commands[0].name, 'environment');
    assert.equal(boundary.elements.namedItem('name').value, 'Unfinished boundary');
    assert.equal(boundary.elements.namedItem('points').value, points);
    assert.equal(h.prompts.length, 0, 'same origin preserves the staged boundary without a discard prompt');
    h.edit(arp.elements.namedItem('latitude'), 27); h.confirm(false);
    await h.submit('custom-arp-form');
    assert.equal(h.commands.length, 1);
    assert.match(h.prompts.at(-1), /discards the unsaved route or boundary/);
    assert.equal(arp.elements.namedItem('latitude').value, '27');
    assert.equal(boundary.elements.namedItem('points').value, points);
    h.confirm(true); await h.submit('custom-arp-form');
    assert.equal(h.commands.length, 2);
    assert.equal(h.state().environment.chartOrigin.latitude, 27);
    assert.equal(boundary.elements.namedItem('name').value, '');
    assert.equal(boundary.elements.namedItem('points').value, '');
    assert.equal(h.workshop.hasDraft(), false);
});

test('visible airspace discard confirms replacement and leaves unrelated traffic drafts intact', async () => {
    const h = await preparationHarness(), arp = h.get('custom-arp-form'), chart = h.get('chart-form');
    h.traffic.resetFromScenario(h.state()); h.traffic.open();
    const speed = h.get('prepare-traffic').querySelector('[data-field="speedKt"]'); h.edit(speed, 600);
    h.edit(arp.elements.namedItem('latitude'), 27);
    h.edit(h.get('custom-boundary-form').elements.namedItem('name'), 'Unfinished boundary');
    h.edit(chart.elements.namedItem('stationName'), 'Unfinished station');
    assert.equal(h.workshop.hasDraft(), true);
    h.confirm(false); await h.click('prepare-airspace-discard');
    assert.equal(arp.elements.namedItem('latitude').value, '27');
    assert.equal(chart.elements.namedItem('stationName').value, 'Unfinished station');
    assert.equal(h.workshop.hasDraft(), true);
    h.confirm(true); await h.click('prepare-airspace-discard');
    assert.equal(h.workshop.hasDraft(), false);
    assert.equal(arp.elements.namedItem('latitude').value, '26');
    assert.equal(chart.elements.namedItem('stationName').value, '');
    assert.equal(h.get('custom-boundary-form').elements.namedItem('name').value, '');
    assert.equal(h.traffic.hasDraft(), true); assert.equal(speed.value, '600');
    assert.equal(h.commands.length, 0, 'discard resets only unapplied form entries');
});

test('loaded traffic reconstructs bearing and range about the station and preserves every starting aircraft parameter', async () => {
    const h = await preparationHarness(), saved = startingScenario();
    saved.aircraft[0].routeId = 'saved-route'; saved.aircraft[0].wakeCategory = 'HEAVY';
    h.traffic.resetFromScenario(saved); h.traffic.open();
    const form = h.get('prepare-traffic').querySelector('form');
    const field = (index, name) => form.elements.namedItem(`aircraft-${index}-${name}`);
    assert.equal(form.elements.namedItem('aircraftCount').value, '2');
    assert.ok(!form.elements.namedItem('qnhHpa'), 'QNH is configured in airspace preparation');
    assert.ok(!form.elements.namedItem('runwayHeadingDeg'), 'Runway belongs to airspace preparation');
    close(Number(field(1, 'rangeNm').value), 5);
    close(Number(field(1, 'qteDeg').value), Math.atan2(3, 4) * 180 / Math.PI);
    close(Number(field(2, 'rangeNm').value), 10);
    close(Number(field(2, 'qteDeg').value), (Math.atan2(-6, -8) * 180 / Math.PI + 360) % 360);
    assert.equal(field(1, 'compassUnserviceable').checked, true);
    assert.equal(field(2, 'compassUnserviceable').checked, false);
    assert.equal(h.traffic.hasDraft(), false);
    h.edit(field(1, 'speedKt'), 320); assert.equal(h.traffic.hasDraft(), true);
    form.dispatchEvent(new h.Event('submit', { cancelable: true })); await flush();
    assert.equal(h.submissions.length, 1);
    const created = h.submissions[0];
    assert.equal(created.environment.qnhHpa, 998); assert.equal(created.environment.runwayHeadingDeg, 270);
    assert.equal(created.title, saved.title); assert.equal(created.mode, 'approach');
    assert.equal(created.aircraft.length, 2);
    for (let i = 0; i < 2; i++) {
        for (const key of ['callsign', 'type', 'headingDeg', 'altitudeFt', 'turnRateDegSec', 'verticalRateFpm', 'spawnTime', 'compassUnserviceable'])
            assert.equal(created.aircraft[i][key], saved.aircraft[i][key], `Aircraft ${i + 1} ${key}`);
        assert.equal(created.aircraft[i].speedKt, i === 0 ? 320 : 410);
    }
    assert.equal(created.aircraft[0].routeId, 'saved-route', 'editing speed keeps an assigned starting route');
    assert.equal(created.aircraft[0].wakeCategory, 'HEAVY', 'editing starting traffic retains its wake category');
    assert.equal(h.traffic.hasDraft(), false);
});

test('creating starting traffic keeps the configured D/F hold instead of resetting bearing settings', async () => {
    const h = await preparationHarness();
    for (const seconds of [2, 27, 30, undefined]) {
        h.state().environment.dfHoldSeconds = seconds;
        h.traffic.open();
        const form = h.get('prepare-traffic').querySelector('form');
        form.dispatchEvent(new h.Event('submit', { cancelable: true })); await flush();
        assert.equal(h.submissions.at(-1)?.environment.dfHoldSeconds, seconds ?? 10,
            'Create exercise preserves the selected D/F hold; only an unset value uses the default');
    }
});

test('Save preserves selected identity when renamed and refuses edited traffic or advanced chart drafts', async () => {
    const h = await preparationHarness(); h.get('template-name').value = 'Exercise one';
    await h.click('template-save'); const id = h.get('template-select').value;
    h.get('template-name').value = 'Exercise renamed'; await h.click('template-save');
    assert.equal(h.readSaved().length, 1); assert.equal(h.readSaved()[0].id, id);
    assert.equal(h.readSaved()[0].name, 'Exercise renamed');
    h.traffic.resetFromScenario(h.state()); h.traffic.open();
    h.edit(h.get('prepare-traffic').querySelector('[data-field="spawnTime"]'), 123);
    const exportsBefore = h.requests.length;
    await h.click('template-save'); assert.equal(h.requests.length, exportsBefore);
    assert.match(h.get('scenario-library-status').textContent, /create the traffic/);
    h.traffic.resetFromScenario(h.state());
    h.edit(h.get('chart-form').elements.namedItem('stationName'), 'Unapplied station');
    assert.equal(h.workshop.hasDraft(), true);
    await h.click('template-save'); assert.equal(h.requests.length, exportsBefore);
    assert.equal(h.readSaved()[0].bundle.scenario.environment.stationName, undefined);
});

test('Load cancellation keeps drafts and confirmed Load resets both the exercise and its traffic editor', async () => {
    const h = await preparationHarness(); h.get('template-name').value = 'Original start';
    await h.click('template-save'); const saved = copy(h.readSaved()[0].bundle.scenario);
    h.traffic.resetFromScenario(h.state()); h.traffic.open();
    const trafficSpeed = h.get('prepare-traffic').querySelector('[data-field="speedKt"]');
    h.edit(trafficSpeed, 600);
    const boundary = h.get('custom-boundary-form'); h.edit(boundary.elements.namedItem('name'), 'Unsaved boundary');
    h.edit(h.get('chart-form').elements.namedItem('stationName'), 'Unapplied station');
    h.state().running = true; h.state().elapsed = 90;
    h.confirm(false); await h.click('template-load');
    assert.equal(h.commands.length, 0); assert.equal(h.loads.length, 0);
    assert.equal(trafficSpeed.value, '600'); assert.equal(h.traffic.hasDraft(), true);
    assert.equal(boundary.elements.namedItem('name').value, 'Unsaved boundary');
    assert.match(h.prompts.at(-1), /unsaved airspace \/ traffic entries/);
    h.confirm(true); await h.click('template-load');
    assert.deepEqual(h.commands.map(c => c.name), ['clock', 'import']);
    assert.equal(h.loads.length, 1); assert.deepEqual(h.loads[0], saved);
    assert.equal(h.state().elapsed, 0); assert.equal(h.state().running, false);
    assert.equal(h.state().aircraft[0].xNm, 10); assert.equal(h.state().aircraft[0].speedKt, 315);
    assert.equal(h.get('prepare-traffic').querySelector('[data-field="speedKt"]').value, '315');
    assert.equal(h.traffic.hasDraft(), false);
    assert.equal(h.workshop.hasDraft(), false);
    assert.equal(boundary.elements.namedItem('name').value, '');
    h.traffic.open();
    assert.equal(h.get('prepare-traffic').querySelector('[name="aircraftCount"]').value, '2');
    assert.equal(h.get('prepare-traffic').querySelector('[data-field="spawnTime"]').value, '45');
});
