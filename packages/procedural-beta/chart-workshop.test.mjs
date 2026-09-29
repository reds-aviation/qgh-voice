import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { domHarness } from './testing/dom-harness.mjs';
const source = name => readFileSync(new URL('./static/' + name, import.meta.url), 'utf8');
const uri = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const geometryURI = uri(source('chart-geometry.js'));
const { destination } = await import(geometryURI);
const calibration = await import(uri(source('chart-calibration.js').replace("'./chart-geometry.js'", JSON.stringify(geometryURI))));
const { parseARP, calibrateImage, alignmentBriefing } = calibration;
const origin = { latitude: 26, longitude: 73 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} / ${b}`);

test('ARP upload accepts one sourced DD or DMS record and rejects incomplete or ambiguous input', () => {
    const row = { aerodromeName: 'Test base', latitude: '260000N', longitude: '0730000E', chartReference: 'AIP AD 2.2', effectiveInfo: '2026-09-03' };
    assert.deepEqual(parseARP(JSON.stringify(row)), { ...row, ...origin });
    assert.deepEqual(parseARP('aerodromeName,latitude,longitude,chartReference,effectiveInfo\n"Test, base",26,73,"AIP, AD 2.2",2026-09-03'), { ...origin, aerodromeName: 'Test, base', chartReference: 'AIP, AD 2.2', effectiveInfo: '2026-09-03' });
    for (const invalid of [{ ...row, latitude: 'N' }, { ...row, longitude: '181' }, { ...row, latitude: '90' }, { ...row, chartReference: '' }, { ...row, latitude: null }]) assert.throws(() => parseARP(JSON.stringify(invalid)));
    assert.throws(() => parseARP('latitude,longitude\n26,73\n27,74'));
    assert.throws(() => parseARP('latitude,latitude\n26,73'));
});

test('image fit recovers known width, off-centre ARP and clockwise rotation', () => {
    for (const angle of [0, 37, -65, 179]) {
        const a = { x: 35, y: 60 }, b = { x: 80, y: 50 }, c = { x: 20, y: 10 }, width = 1200, height = 800, widthNm = 80;
        const geo = p => {
            const x = (p.x - a.x) / 100 * widthNm, y = -(p.y - a.y) / 100 * height / width * widthNm;
            return destination(origin, Math.atan2(x, y) * 180 / Math.PI + angle, Math.hypot(x, y));
        };
        const fit = calibrateImage({ origin, width, height, a, b, c, bGeo: geo(b), cGeo: geo(c) });
        close(fit.widthNm, widthNm); close(fit.rotationDeg, angle); close(fit.errorNm, 0); assert.equal(fit.originXPct, 35); assert.equal(fit.originYPct, 60);
    }
});

const valid = { origin, width: 1000, height: 800, a: { x: 50, y: 50 }, b: { x: 75, y: 50 }, c: { x: 50, y: 20 }, bGeo: destination(origin, 90, 10), cGeo: destination(origin, 0, 9.6) };
test('independent C check rejects skew, mirrored charts, coincident and collinear marks', () => {
    for (const delta of [{ cGeo: destination(origin, 0, 15) }, { cGeo: destination(origin, 180, 9.6) }, { b: valid.a }, { c: { x: 90, y: 50 } }, { a: { x: -1, y: 50 } }, { width: NaN }]) assert.throws(() => calibrateImage({ ...valid, ...delta }));
    assert.match(alignmentBriefing('Runway briefing', 'Source X'), /Runway briefing\n\[LFA image alignment\]/);
    const updated = alignmentBriefing(alignmentBriefing('Briefing', 'Old'), 'New');
    assert.ok(!updated.includes('Old')); assert.ok(updated.includes('New'));
    assert.throws(() => alignmentBriefing('a'.repeat(1990), 'Too long'));
});

test('image upload stays staged until validated, shares calibration, and rejects a changed ARP', async () => {
    const h = domHarness(source('procedural.html'));
    const form = h.document.getElementById('map-align-form');
    form.reset = () => {};
    const image = h.document.getElementById('map-align-image'); image.decode = async () => {};
    image.naturalWidth = 1000; image.naturalHeight = 800;
    const state = { exerciseId: 'test', environment: { chartOrigin: origin, briefing: 'Retain this briefing.' }, running: false };
    const commands = [], uploads = []; let shown = 0;
    Object.assign(h.context, calibration, { coordinate: (await import(geometryURI)).coordinate, host: {
        view: () => state, generation: () => 1, message() {}, showMap: () => shown++,
        command: async (...args) => commands.push(args), request: async (...args) => { uploads.push(args); return { imageId: 'a'.repeat(64) }; }
    } });
    vm.runInContext(source('map-workshop.js').replace(/^import .*;\r?\n/gm, '').replace('export function', 'function') + ';globalThis.workshop=createMapWorkshop(host);workshop.render();', h.context);
    const f = name => form.elements.namedItem(name);
    const file = h.document.getElementById('map-file'); file.files = [new Blob(['image'], { type: 'image/png' })];
    file.dispatchEvent(new h.Event('change')); await new Promise(resolve => setImmediate(resolve));
    assert.equal(uploads.length, 0, 'choosing a file never changes the shared scope');
    const values = { source: 'AIP page', edition: '2026-09-03', description: 'Training LFA / GND–FL150', aX: 50, aY: 50, bX: 75, bY: 50, cX: 50, cY: 20, bLat: valid.bGeo.latitude, bLon: valid.bGeo.longitude, cLat: valid.cGeo.latitude, cLon: valid.cGeo.longitude };
    Object.entries(values).forEach(([name, value]) => f(name).value = String(value));
    form.dispatchEvent(new h.Event('submit')); await new Promise(resolve => setImmediate(resolve));
    const apply = h.document.getElementById('map-align-apply'); assert.equal(apply.disabled, false);
    state.environment.chartOrigin = { ...origin, latitude: 26.01 };
    apply.click(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(uploads.length, 0); assert.equal(apply.disabled, true);
    state.environment.chartOrigin = origin;
    form.dispatchEvent(new h.Event('submit')); await new Promise(resolve => setImmediate(resolve));
    apply.click(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(uploads.length, 1); assert.equal(commands.length, 1); assert.equal(shown, 1);
    close(commands[0][1].map.widthNm, 40); assert.equal(commands[0][1].map.imageId, 'a'.repeat(64));
    assert.match(commands[0][1].briefing, /Retain this briefing/); assert.match(commands[0][1].briefing, /C residual 0.000 NM/);
});

test('every selectable real base has sourced LFA geometry, ARP and real route records for its preview', () => {
    const bases = JSON.parse(source('india-airspace.json')), routes = JSON.parse(source('india-aip-enroute.json'));
    for (const base of bases) {
        assert.ok(base.areas.some(a => /LFA/.test(a.name)), base.id);
        assert.match(base.source, /^https:\/\/aim-india\.aai\.aero\//);
        assert.ok(Number.isFinite(base.origin.latitude) && Number.isFinite(base.origin.longitude));
        assert.ok(routes.aerodromes[base.id].routes.length > 0);
        for (const route of routes.aerodromes[base.id].routes) assert.match(route.reference, /IN-ENR%203\./);
    }
});
