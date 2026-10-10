import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { harness } from './testing/worker-harness.mjs';
const source = name => readFileSync(new URL('./static/' + name, import.meta.url), 'utf8');
const uri = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const geometryURI = uri(source('chart-geometry.js'));
const geometry = await import(geometryURI);
const routeURI = uri(source('route-chart.js').replace("'./chart-geometry.js'", JSON.stringify(geometryURI)).replace("'./scope-navigation.js'", JSON.stringify(uri(source('scope-navigation.js')))));
const chart = await import(routeURI);
const navigation = await import(uri(source('aip-navigation.js').replace("'./chart-geometry.js'", JSON.stringify(geometryURI))));
const fixes = [{ id: 'a', name: 'A', xNm: -100, yNm: 50 }, { id: 'b', name: 'B', xNm: 400, yNm: 50 }];
const route = { id: 'r', name: 'Route', fixIds: ['a', 'b'], minAltitudeFt: 5000, maxAltitudeFt: 15000 };
const screen = (x, y) => [x, y];

test('one-way and bidirectional arrows follow listed fixes and remain clipped after pan/scale', () => {
    const legs = chart.routeChartLegs({ ...route, chartDirection: 'forward' }, fixes, screen, 300, 200);
    assert.equal(legs.length, 1); assert.equal(legs[0].arrows.length, 1); assert.equal(legs[0].arrows[0].dx, 1);
    assert.deepEqual(legs[0].a, { x: 18, y: 50 }); assert.deepEqual(legs[0].b, { x: 282, y: 50 });
    const both = chart.routeChartLegs({ ...route, chartDirection: 'both' }, fixes, (x, y) => [300 - x, 100 + y / 2], 300, 200)[0];
    assert.deepEqual(both.arrows.map(a => a.dx), [-1, 1]);
    assert.ok(both.arrows.every(a => a.x >= 18 && a.x <= 282 && a.y >= 18 && a.y <= 182));
    assert.equal(chart.routeChartLegs(route, fixes, screen, 300, 200)[0].arrows.length, 0, 'legacy route must not gain fabricated arrows');
    assert.equal(chart.routeChartLegs(route, fixes, (x, y) => [x, y + 300], 300, 200).length, 0);
});
test('published Odd/Even marks retain per-leg labels and table direction without inventing one-way clearance', () => {
    const legs = chart.routeChartLegs({ ...route, publishedSegments: [{ oddLevels: '↑', evenLevels: '↓', levelLimits: 'FL 460 FL 270 Class D 2400 FT' }] }, fixes, screen, 300, 200);
    assert.deepEqual(legs[0].arrows.map(a => [a.label, a.dx]), [['Odd', -1], ['Even', 1]]);
    assert.equal(legs[0].level, 'FL 460 FL 270 Class D 2400 FT');
    assert.equal(chart.routeChartLegs({ ...route, oddLevels: '↑', evenLevels: '↓' }, fixes, screen, 300, 200)[0].arrows.length, 0, 'flat summary cannot assign directions to individual legs');
    const short = chart.routeChartLegs({ ...route, chartDirection: 'both' }, [{ ...fixes[0], xNm: 30 }, { ...fixes[1], xNm: 40 }], screen, 300, 200)[0];
    assert.equal(short.arrows.length, 0, 'short leg must not spill arrows outside clipped segment');
});
test('coordinate labels use authored WGS84 or chart-local NM without adding station offset', () => {
    const origin = { latitude: 26, longitude: 73 }, geoPoints = [origin, geometry.destination(origin, 90, 10)];
    const saved = geoPoints.map((p, i) => ({ id: ['a', 'b'][i], name: ['A', 'B'][i], ...geometry.project(p, origin) }));
    const value = { ...route, coordinateOrigin: origin, geoPoints };
    assert.equal(chart.validateRouteChartMetadata(value, saved), true);
    assert.match(chart.routePointLabels(value, saved).get('a'), /26.0000°N 73.0000°E/);
    assert.equal(chart.routePointLabels(route, fixes).get('a'), '100.00 W / 50.00 N NM');
    assert.throws(() => chart.validateRouteChartMetadata({ ...value, geoPoints: [geoPoints[1], origin] }, saved), /projected/);
});
test('offline metadata rejects malformed direction/source legs and keeps labels separate from numeric MSL limits', () => {
    for (const chartDirection of ['reverse', 'one-way', false]) assert.throws(() => chart.validateRouteChartMetadata({ ...route, chartDirection }, fixes));
    assert.throws(() => chart.validateRouteChartMetadata({ ...route, publishedSegments: [{ from: 'A', to: 'B', sourceSequence: 1, sha256: 'bad' }] }, fixes), /hash/);
    assert.throws(() => chart.validateRouteChartMetadata({ ...route, publishedSegments: [{ from: 'A', to: 'B', sourceSequence: 1 }, { from: 'B', to: 'C', sourceSequence: 2 }] }, fixes), /one source segment/);
    assert.throws(() => chart.validateRouteChartMetadata({ ...route, reference: 'x'.repeat(501) }, fixes));
    assert.equal(chart.routeLevelLabel(route), '5000–15000 ft MSL');
    assert.equal(chart.routeLevelLabel({ ...route, levelLimits: 'FL 270 Class D' }), 'FL 270 Class D');
    assert.equal(route.minAltitudeFt, 5000);
});
test('chart-only environment clone excludes pressure/weather/voice while retaining runway geometry', () => {
    const original = { chartOrigin: { latitude: 26, longitude: 73 }, stationXNm: 8, stationYNm: 5, aerodromeElevationFt: 1500, thresholdCrossingHeightFt: 50, runwayHeadingDeg: 90, qnhHpa: 999, windSpeedKt: 20, dfHoldSeconds: 10, transitionLevel: 80, separationNm: 5 };
    const filtered = chart.chartEnvironment(original);
    assert.deepEqual(Object.keys(filtered).sort(), ['chartOrigin', 'stationXNm', 'stationYNm', 'aerodromeElevationFt', 'thresholdCrossingHeightFt', 'runwayHeadingDeg'].sort());
    filtered.chartOrigin.latitude = 20; assert.equal(original.chartOrigin.latitude, 26);
});
test('all published aerodromes preserve exact per-leg metadata, geographic order and legacy unspecified direction', () => {
    const data = JSON.parse(source('india-aip-enroute.json'));
    for (const entry of Object.values(data.aerodromes)) {
        const first = entry.fixes[0], origin = { latitude: first.latitude, longitude: first.longitude };
        const merged = navigation.mergePublishedNavigation({ aircraft: [], fixes: [], routes: [] }, entry, origin);
        for (const published of entry.routes) {
            const saved = merged.routes.find(r => r.id === published.id);
            assert.deepEqual(saved.publishedSegments, published.publishedSegments);
            assert.equal(saved.levelLimits, published.levelLimits); assert.equal(saved.chartDirection, undefined);
            assert.equal(chart.validateRouteChartMetadata(saved, merged.fixes), true);
            assert.equal(saved.minAltitudeFt, -1500); assert.equal(saved.maxAltitudeFt, 60000);
        }
    }
});
test('drawing annotations never mutate route/fixes or join across a missing fix', () => {
    const value = { ...route, chartDirection: 'forward', fixIds: ['a', 'missing', 'b'] }, before = JSON.stringify({ value, fixes });
    const calls = [], ctx = Object.fromEntries(['beginPath', 'moveTo', 'lineTo', 'stroke', 'save', 'restore', 'setLineDash'].map(name => [name, (...args) => calls.push([name, ...args])]));
    chart.drawRouteChart(ctx, value, fixes, screen, { width: 300, height: 200, label() {} });
    assert.equal(calls.filter(c => c[0] === 'lineTo').length, 0, 'missing fix must break route line');
    assert.equal(JSON.stringify({ value, fixes }), before);
});
test('published rebase retains assigned old navigation while separate current points keep truthful WGS84', () => {
    const oldOrigin = { latitude: 26, longitude: 73 }, origin = { latitude: 27, longitude: 73 };
    const publishedFixes = ['A', 'B', 'C'].map((name, i) => ({ id: `aip-base-fix-${name}`, name, ...geometry.destination(oldOrigin, 90, i * 10) }));
    const oldFixes = publishedFixes.slice(0, 2).map(f => ({ id: f.id, name: f.name, ...geometry.project(f, oldOrigin) }));
    const oldRoute = { ...route, id: 'aip-old-route', fixIds: oldFixes.map(f => f.id) };
    const published = { fixes: publishedFixes, routes: [{ id: 'aip-old-route', name: 'Old', kind: 'ats', fixNames: ['A', 'B'] }, { id: 'aip-new-route', name: 'New', kind: 'ats', fixNames: ['B', 'C'] }] };
    const merged = navigation.mergePublishedNavigation({ aircraft: [{ routeId: oldRoute.id }], routes: [oldRoute], fixes: oldFixes }, published, origin);
    assert.deepEqual(merged.routes.find(r => r.id === oldRoute.id), oldRoute);
    assert.deepEqual(merged.fixes.find(f => f.id === oldFixes[1].id), oldFixes[1]);
    const current = merged.routes.find(r => r.id === 'aip-new-route');
    assert.notEqual(current.fixIds[0], oldFixes[1].id);
    assert.equal(chart.validateRouteChartMetadata(current, merged.fixes), true);
    assert.equal(merged.fixes.find(f => f.id === current.fixIds[0]).name, 'B');
});
test('rebuilt browser engine saves route and chart-only load durably without exposing aircraft truth to student', async () => {
    const h = await harness(), instructor = h.port(), student = h.port();
    const session = (await instructor.request('session', { role: 'instructor' })).body;
    const room = (await instructor.request('room', undefined, session)).body;
    const trainee = (await student.request('session', { role: 'student', name: 'Controller', pin: room.pin })).body;
    const member = (await instructor.request('room', undefined, session)).body.students[0];
    await instructor.request('room', { action: 'admit', studentId: member.id }, session);
    await student.request('room', { action: 'ready' }, trainee);
    const state = async () => (await instructor.request('state', undefined, session)).body;
    const initial = await state(); let count = 0;
    const command = (type, payload, role = session) => instructor.request('command', { id: `chart-test-${++count}`, exerciseId: initial.exerciseId, type, payload }, role);
    const origin = { latitude: 26, longitude: 73 }, geoPoints = [origin, geometry.destination(origin, 90, 10)];
    const custom = { name: 'Custom R1', kind: 'ats', active: true, chartDirection: 'both', minAltitudeFt: 5000, maxAltitudeFt: 12000, levelLimits: '5000–12000 ft MSL', coordinateOrigin: origin, geoPoints,
        fixes: geoPoints.map((point, i) => ({ name: `CUSTOM${i + 1}`, ...geometry.project(point, origin) })) };
    const saved = await command('route-geometry-upsert', custom); assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal((await command('clock', { action: 'step', seconds: 60 })).status, 200);
    const before = await state();
    const replaced = await command('airspace-replace', { expectedRevision: before.revision, environment: { stationName: 'ARP', aerodromeElevationFt: 1000, drawnARP: true, chartOrigin: null, stationXNm: 7.5, stationYNm: -4.25 }, fixes: before.fixes, routes: before.routes, areas: before.areas });
    assert.equal(replaced.status, 200, JSON.stringify(replaced.body));
    const after = await state();
    assert.equal(after.exerciseId, initial.exerciseId); assert.equal(after.elapsed, 60); assert.deepEqual(after.aircraft, before.aircraft); assert.deepEqual(after.reports, before.reports);
    assert.equal(after.environment.drawnARP, true); assert.equal(after.environment.chartOrigin, undefined); assert.equal(after.environment.stationXNm, 7.5); assert.equal(after.environment.stationYNm, -4.25);
    assert.equal((await instructor.request('room', undefined, session)).body.pin, room.pin);
    const visible = (await student.request('state', undefined, trainee)).body;
    assert.equal(visible.aircraft, undefined); assert.equal(visible.events, undefined); assert.equal(visible.routes.at(-1).chartDirection, 'both'); assert.deepEqual(structuredClone(visible.routes.at(-1).geoPoints), geoPoints);
    assert.equal(visible.environment.drawnARP, true); assert.equal(visible.environment.stationXNm, 7.5); assert.equal(visible.environment.stationYNm, -4.25);
    const checkpoint = structuredClone(h.saved.get('checkpoint'));
    const bad = await command('airspace-replace', { expectedRevision: after.revision, environment: {}, fixes: after.fixes, routes: [], areas: [] });
    assert.equal(bad.status, 400); assert.match(bad.body.error, /referenced/); assert.deepEqual(h.saved.get('checkpoint'), checkpoint);
    const reopened = await harness(h.saved), fresh = reopened.port(), recovered = (await fresh.request('session', { role: 'instructor' })).body;
    const restored = (await fresh.request('state', undefined, recovered)).body;
    assert.equal(restored.elapsed, 60); assert.equal(restored.routes.at(-1).chartDirection, 'both'); assert.deepEqual(structuredClone(restored.routes.at(-1).geoPoints), geoPoints);
    assert.equal(restored.environment.drawnARP, true); assert.equal(restored.environment.chartOrigin, undefined); assert.equal(restored.environment.stationXNm, 7.5); assert.equal(restored.environment.stationYNm, -4.25);
});
