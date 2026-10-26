/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const Display = require('../suite-display.js');

test('scope zoom steps Auto values and bounds manual range consistently', () => {
  assert.equal(Display.zoomRange(32.5, 'in'), 20);
  assert.equal(Display.zoomRange(32.5, 'out'), 40);
  assert.equal(Display.zoomRange(10, 'in'), 5);
  assert.equal(Display.zoomRange(5, 'in'), 5);
  assert.equal(Display.zoomRange(100, 'out'), 100);
  assert.equal(Display.zoomRange(130, 'out'), 130, 'Auto beyond the manual limit cannot zoom in when scrolling out');
});

test('scope zoom consumes only vertical canvas wheel events while enabled and detaches cleanly', () => {
  let handler, range = 40, enabled = true, updates = 0;
  const canvas = {
    addEventListener(name, callback, options) { assert.equal(name, 'wheel'); assert.equal(options.passive, false); handler = callback; },
    removeEventListener(name, callback) { assert.equal(name, 'wheel'); assert.equal(callback, handler); handler = null; }
  };
  const binding = Display.bindScopeZoom(canvas, {
    getRange: () => range, setRange(value) { range = value; updates++; }, isEnabled: () => enabled
  });
  const event = { deltaY: -100, preventDefault() { this.prevented = true; } };
  handler(event); assert.equal(range, 20); assert.equal(event.prevented, true);
  for (const delta of [{ deltaY: 0 }, { deltaY: NaN }, { deltaY: 1, deltaX: 100 }]) {
    const ignored = { ...delta, preventDefault() { assert.fail('Unrelated scrolling should remain available'); } };
    handler(ignored);
  }
  assert.equal(updates, 1);
  enabled = false; binding.zoom('out'); handler({ ...event, preventDefault() { assert.fail('Hidden scope cannot consume wheel'); } });
  assert.equal(range, 20);
  binding.destroy(); assert.equal(handler, null);
});

test('radar sweep respects the sensor RPM, selected time rate and north-up wrap', () => {
  for (const rpm of [10, 12, 15]) {
    for (const timeRate of [1, 5, 10]) {
      const angle = Display.radarSweepAngle({ angleDeg: 350, elapsedSeconds: .2, rpm, timeRate, running: true });
      assert.ok(Math.abs(angle - (350 + .2 * rpm * 6 * timeRate) % 360) < 1e-9);
    }
  }
  assert.equal(Display.radarSweepAngle({ angleDeg: 45, elapsedSeconds: 10, running: false }), 45);
  assert.equal(Display.radarSweepAngle({ angleDeg: NaN, running: true }), null);
});

test('duplicate radar observations preserve the animation anchor instead of restarting the beam', () => {
  const clock = Display.createRadarSweepClock();
  clock.observe({ angleDeg: 90, simulationTime: 1, receivedAt: 1000, rpm: 12, running: true });
  const before = clock.angle(1100, true);
  clock.observe({ angleDeg: 90, simulationTime: 1, receivedAt: 1100, rpm: 12, running: true });
  assert.equal(clock.angle(1100, true), before);
  assert.ok(Math.abs(clock.angle(1200, true) - 104.4) < 1e-9);
});

test('radar animation freezes on pause, stale samples and reconnect until a fresh anchor arrives', () => {
  const clock = Display.createRadarSweepClock();
  clock.observe({ angleDeg: 90, simulationTime: 1, receivedAt: 1000, running: true });
  const bounded = clock.angle(2000, true);
  assert.equal(bounded, 121.5);
  assert.equal(clock.angle(8000, true), bounded, 'a lost stream cannot keep rotating');
  assert.equal(clock.angle(8000, false), 90, 'pause retains the authoritative scan phase');
  clock.hold();
  assert.equal(clock.angle(9000, true), 90, 'resume/reconnect waits for a fresh observation');
  clock.observe({ angleDeg: 90, simulationTime: 1, receivedAt: 9000, running: true });
  assert.equal(clock.angle(9100, true), 99);
  clock.reset(); assert.equal(clock.angle(9200, true), null);
});

test('shared radar sweep uses a faint trailing fan and clockwise north-up leading edge', () => {
  const fills = [], lines = [], arcs = [];
  const context = { save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {},
    lineTo(x, y) { lines.push({ x, y }); }, arc(...values) { arcs.push(values); },
    fill() { fills.push(this.fillStyle); }, stroke() {} };
  Display.drawRadarSweep(context, { cx: 100, cy: 100, radius: 80, angleDeg: 90 });
  assert.deepEqual(lines, [{ x: 180, y: 100 }]);
  assert.equal(fills.length, 9);
  assert.ok(fills.every(value => /^rgba\(56,148,129,0\.\d+\)$/.test(value)));
  assert.ok(arcs.every(([, , radius, from, to]) => radius === 80 && from < to && to <= 0));
});

function screen(left, top, width = 1920, height = 1040, label = '') {
  return { availLeft: left, availTop: top, availWidth: width, availHeight: height, label };
}

test('student window uses a stable reusable name and opens synchronously', () => {
  const calls = [];
  const child = { closed: false, location: { replace: url => calls.push(['navigate', url]) }, focus: () => calls.push('focus') };
  const result = Display.openStudentWindow({
    openWindow: (...args) => { calls.push(args); return child; },
    url: 'student.html'
  });
  assert.equal(result.ok, true);
  assert.equal(calls[0][0], '');
  assert.equal(calls[0][1], Display.STUDENT_WINDOW_NAME);
  assert.match(calls[0][2], /popup=yes/);
  assert.equal(child.opener, null);
  assert.deepEqual(calls[1], ['navigate', 'student.html']);
  assert.equal(calls[2], 'focus');
});

test('popup blocking is a typed failure', () => {
  const result = Display.openStudentWindow({ openWindow: () => null });
  assert.deepEqual(result, { ok: false, reason: 'popup-blocked', window: null });
});

test('student scripts never load when opener isolation fails', () => {
  let closed = false;
  const child = {
    closed: false,
    location: { replace: () => assert.fail('navigation must not occur') },
    close: () => { closed = true; }
  };
  Object.defineProperty(child, 'opener', { configurable: true, get: () => ({ unsafe: true }), set: () => {} });
  const result = Display.openStudentWindow({ openWindow: () => child });
  assert.equal(result.reason, 'isolation-failed');
  assert.equal(closed, true);
});

test('external screen is selected by geometry rather than object identity', () => {
  const current = screen(0, 0);
  const duplicate = screen(0, 0);
  const external = screen(-1280, 0, 1280, 984, 'Projector');
  assert.equal(Display.chooseExternalScreen({ currentScreen: current, screens: [duplicate, external] }), external);
  assert.equal(Display.chooseExternalScreen({ currentScreen: current, screens: [duplicate] }), null);
});

test('external placement uses available bounds and focuses the student window', async () => {
  const calls = [];
  const child = {
    closed: false,
    moveTo: (...args) => calls.push(['moveTo', ...args]),
    resizeTo: (...args) => calls.push(['resizeTo', ...args]),
    focus: () => calls.push(['focus'])
  };
  const current = screen(0, 0);
  const external = screen(-1280, 20, 1280, 960, 'Training display');
  const result = await Display.placeOnExternalScreen(child, {
    getScreenDetails: async () => ({ currentScreen: current, screens: [current, external] })
  });
  assert.equal(result.reason, 'external-display');
  assert.equal(result.placedExternal, true);
  assert.equal(result.label, 'Training display');
  assert.deepEqual(calls, [['moveTo', -1280, 20], ['resizeTo', 1280, 960], ['focus']]);
});

test('single display, unsupported API and denied permission stay usable', async () => {
  const child = { closed: false };
  const only = screen(0, 0);
  const single = await Display.placeOnExternalScreen(child, {
    getScreenDetails: async () => ({ currentScreen: only, screens: [only] })
  });
  assert.equal(single.reason, 'single-display');
  assert.equal(single.placedExternal, false);

  const unsupported = await Display.placeOnExternalScreen(child, { getScreenDetails: null });
  assert.equal(unsupported.reason, 'manual-placement');
  assert.equal(unsupported.ok, true);

  const denied = await Display.placeOnExternalScreen(child, {
    getScreenDetails: async () => { const error = new Error('denied'); error.name = 'NotAllowedError'; throw error; }
  });
  assert.equal(denied.reason, 'permission-needed');
  assert.equal(denied.ok, true);
});

test('closed window and placement errors are reported without throwing', async () => {
  const closed = await Display.placeOnExternalScreen({ closed: true }, { getScreenDetails: async () => ({}) });
  assert.equal(closed.reason, 'window-closed');

  const current = screen(0, 0);
  const external = screen(1920, 0);
  const child = { closed: false, moveTo: () => { throw new Error('blocked'); } };
  const blocked = await Display.placeOnExternalScreen(child, {
    getScreenDetails: async () => ({ currentScreen: current, screens: [current, external] })
  });
  assert.equal(blocked.reason, 'manual-placement');
  assert.equal(blocked.placedExternal, false);
});

function chartContext() {
  return { strokes: [], labels: [], path: [],
    beginPath() { this.path = []; }, moveTo(x, y) { this.path.push({ x, y }); }, lineTo(x, y) { this.path.push({ x, y }); },
    setLineDash() {}, stroke() { this.strokes.push({ color: this.strokeStyle, path: [...this.path] }); },
    fillText(text, x, y) { this.labels.push({ text, x, y }); }, measureText(text) { return { width: text.length * 8 }; }
  };
}

function publishedContext() {
  const context = chartContext();
  return Object.assign(context, { save() {}, restore() {}, rect() {}, clip() {}, closePath() {}, arc() {}, fill() {}, fillRect() {}, strokeRect() {} });
}
function publishedFixture() {
  return { baseName: 'Synthetic test base', lfaId: 'test-lfa', lfaName: 'Synthetic LFA', origin: { latitude: 30, longitude: 75 },
    areas: [{ id: 'test-lfa', name: 'TEST LFA', kind: 'local-flying', floorLabel: 'SFC', ceilingLabel: 'FL100', points: [{ xNm: -25, yNm: 10 }, { xNm: -10, yNm: 10 }, { xNm: -10, yNm: 25 }] },
      { id: 'test-danger', name: 'TEST DANGER', kind: 'danger', floorLabel: 'SFC', ceilingLabel: 'FL200', points: [{ xNm: 10, yNm: -10 }, { xNm: 25, yNm: -10 }, { xNm: 25, yNm: -25 }] }],
    routes: [{ name: 'A1', points: [{ xNm: -20, yNm: 0 }, { xNm: 20, yNm: 0 }], levelLimits: 'FL100 / FL200' }],
    fixes: [], runways: [{ name: '09/27', widthNm: .025, points: [{ xNm: 0, yNm: -1 }, { xNm: 1.6, yNm: -1 }] }], referenceBoundaries: [], layerVisibility: {} };
}
test('shared published layers preserve geometry, north-up axes, levels and separate runway strips', () => {
  const chart = publishedFixture(), before = JSON.stringify(chart), context = publishedContext();
  Display.drawPublishedAirspace(context, { publishedAirspace: chart, cx: 400, cy: 400, scale: 10, width: 800, height: 800 });
  const lfa = context.strokes.find(s => s.color === '#e5a67d');
  assert.deepEqual(lfa.path[0], { x: 150, y: 300 });
  const runway = context.strokes.find(s => s.color === '#a8adb2');
  assert.deepEqual(runway.path, [{ x: 400, y: 410 }, { x: 416, y: 410 }]);
  assert.ok(context.labels.some(l => l.text === 'SFC / FL100'));
  assert.ok(context.labels.some(l => l.text === 'FL100 / FL200'));
  assert.equal(JSON.stringify(chart), before, 'rendering cannot alter source geometry or shared visibility');
});
test('published layer selections and local LFA declutter do not suppress independent layers', () => {
  const chart = publishedFixture(), context = publishedContext();
  chart.layerVisibility = { specialUse: false, atsRoutes: false, runways: false, internationalBoundary: false };
  Display.drawPublishedAirspace(context, { publishedAirspace: chart, cx: 400, cy: 400, scale: 10, width: 800, height: 800 });
  assert.equal(context.strokes.length, 1); assert.equal(context.strokes[0].color, '#e5a67d');
  const hidden = publishedContext();
  Display.drawPublishedAirspace(hidden, { publishedAirspace: chart, cx: 400, cy: 400, scale: 10, width: 800, height: 800, layerVisibility: { lfa: false } });
  assert.equal(hidden.strokes.length, 0);
  chart.layerVisibility.lfa = false;
  const disallowed = publishedContext();
  Display.drawPublishedAirspace(disallowed, { publishedAirspace: chart, cx: 400, cy: 400, scale: 10, width: 800, height: 800, layerVisibility: { lfa: true } });
  assert.equal(disallowed.strokes.length, 0, 'local preferences cannot reveal a layer disabled in the shared chart');
});

test('compact published chart reduces only secondary annotations and keeps source geometry intact', () => {
  const chart = publishedFixture(), before = JSON.stringify(chart);
  const full = publishedContext(), compact = publishedContext();
  Display.drawPublishedAirspace(full, { publishedAirspace: chart, cx: 400, cy: 200, scale: 5, width: 800, height: 800 });
  Display.drawPublishedAirspace(compact, { publishedAirspace: chart, cx: 400, cy: 200, scale: 5, width: 800, height: 400 });
  assert.deepEqual(compact.strokes, full.strokes, 'scope size changes annotations only, never published geometry');
  assert.ok(compact.labels.some(label => label.text === 'TEST LFA'), 'selected LFA identifier stays visible');
  assert.equal(compact.labels.some(label => /FL100|FL200/.test(label.text)), false, 'published level paragraphs do not crowd the compact scope');
  assert.equal(JSON.stringify(chart), before);
});
test('published chart replaces synthetic LFA without inferring unavailable boundaries', () => {
  const environment = Display.radarChartEnvironment({ radarEnvironment: { publishedAirspace: publishedFixture(), lfaBoundary: [{ bearingDeg: 0, rangeNm: 20 }, { bearingDeg: 90, rangeNm: 20 }, { bearingDeg: 180, rangeNm: 20 }] } });
  const context = publishedContext();
  const labels = Display.drawRadarEnvironment(context, { width: 800, height: 800, cx: 400, cy: 400, scale: 10, rangeNm: 40, environment });
  assert.equal(context.strokes.length, 0, 'synthetic local LFA is not overlaid on selected published LFA');
  const result = Display.drawPublishedAirspace(context, { publishedAirspace: environment.publishedAirspace, cx: 400, cy: 400, scale: 10, width: 800, height: 800, chartLabels: labels });
  assert.equal(result.boundaries.status, 'unavailable'); assert.equal(result.boundaries.segments.length, 0);
});

test('shared chart draws configured LFA and offset runway centreline without modifying scenario data', () => {
  const metadata = { mode: 'sra', runwayOrientation: 90, radarEnvironment: {
    runwayOrientationDeg: 90, extendedCentreline: true, extendedCentrelineNm: 10, centrelineTickNm: 2,
    lfaBoundary: [{ bearingDeg: 0, rangeNm: 10 }, { bearingDeg: 90, rangeNm: 10 }, { bearingDeg: 180, rangeNm: 10 }], sraDescentProfile: true
  } };
  const before = JSON.stringify(metadata), environment = Display.radarChartEnvironment(metadata);
  const options = { width: 1000, height: 800, cx: 500, cy: 400, scale: 20, rangeNm: 20, environment, metadata,
    runway: { centre: { xNm: 1, yNm: 2 }, threshold: { xNm: -.5, yNm: 2 } } };
  const visible = chartContext();
  Display.drawRadarEnvironment(visible, options);
  const axis = visible.strokes.find(stroke => stroke.color === '#8f936d');
  assert.deepEqual(axis.path[0], { x: 520, y: 360 });
  assert.ok(Math.abs(axis.path[1].x - 720) < 1e-9 && Math.abs(axis.path[1].y - 360) < 1e-9);
  const lfa = visible.strokes.find(stroke => stroke.color === '#ca8a6a');
  assert.deepEqual(lfa.path[0], { x: 500, y: 200 }, 'LFA uses ARP-centred polar geometry');
  assert.deepEqual(lfa.path.at(-1), lfa.path[0]);
  const hidden = chartContext();
  Display.drawRadarEnvironment(hidden, { ...options, showLfa: false, showExtendedCentreline: false });
  assert.equal(hidden.strokes.length, 0);
  assert.equal(JSON.stringify(metadata), before, 'local chart visibility never changes shared exercise data');
});

test('shared SRA cues begin at landing threshold, retain half-mile ticks and keep labels in view', () => {
  const context = chartContext();
  const options = { width: 1000, height: 800, cx: 500, cy: 400, scale: 20, rangeNm: 20,
    environment: { centrelineTickNm: 2 }, metadata: { mode: 'sra', finalTrack: 180, glidepathDeg: 3 },
    runway: { centre: { xNm: 1, yNm: 2 }, threshold: { xNm: 1, yNm: 2.8 } },
    overlays: { centrelineDeg: 0, approachCorridorWidthNm: 2, terminationRangeNm: .5 }, showDescentProfile: true };
  Display.drawSraReferences(context, options);
  const final = context.strokes.find(stroke => stroke.color === '#c4af64');
  assert.deepEqual(final.path[0], { x: 520, y: 344 });
  const termination = context.strokes.find(stroke => stroke.color === '#edbb7d');
  assert.deepEqual(termination.path, [{ x: 507, y: 334 }, { x: 533, y: 334 }]);
  const halfMile = context.strokes.filter(stroke => stroke.color === '#c4af64').find(stroke =>
    stroke.path.length === 2 && stroke.path[0].x === 514 && stroke.path[0].y === 334);
  assert.ok(halfMile, 'half-mile tick remains even when its long label is decluttered');
  assert.ok(context.labels.filter(label => /FT AAL/.test(label.text)).every(label => label.y >= 10 && label.y <= 790));
  const hidden = chartContext();
  Display.drawSraReferences(hidden, { ...options, showDescentProfile: false });
  assert.equal(hidden.labels.some(label => /FT AAL|DESCENT TRAINING/.test(label.text)), false);
  assert.deepEqual(hidden.strokes, context.strokes, 'hiding descent text preserves final approach geometry');
});

test('compact SRA chart keeps readable major labels clear of radio, rail and each other', () => {
  const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  const obstacles = [{ x: 0, y: 30, width: 285, height: 340 }, { x: 865, y: 0, width: 104, height: 380 }];
  for (const bearing of [0, 50, 90, 180, 230, 270]) {
    const context = chartContext();
    const metadata = { mode: 'sra', finalTrack: (bearing + 180) % 360, glidepathDeg: 3 };
    const environment = Display.radarChartEnvironment({ ...metadata, radarEnvironment: { runwayOrientationDeg: metadata.finalTrack,
      extendedCentreline: true, sraDescentProfile: true, extendedCentrelineNm: 20, centrelineTickNm: 2 } });
    const options = { width: 969, height: 380, cx: 484.5, cy: 190, scale: 380 * .44 / 40, rangeNm: 40,
      metadata, environment, obstacles, overlays: { centrelineDeg: bearing, terminationRangeNm: .5 }, showDescentProfile: true };
    const layout = Display.drawRadarEnvironment(context, options);
    const before = context.strokes.length;
    Display.drawSraReferences(context, { ...options, chartLabels: layout });
    assert.ok(context.strokes.length - before >= 28, 'all approach ticks remain even on a compact scope');
    const boxes = context.labels.map(label => ({ x: label.x, y: label.y - 11, width: context.measureText(label.text).width, height: 14 }));
    assert.ok(boxes.length <= 9, `bearing ${bearing}: adapt label count to the available pixels`);
    for (let index = 0; index < boxes.length; index++) {
      assert.ok(boxes[index].x >= 10 && boxes[index].y >= 10 && boxes[index].x + boxes[index].width <= 959 && boxes[index].y + boxes[index].height <= 370);
      assert.ok(!obstacles.some(obstacle => overlap(boxes[index], obstacle)), 'chart text avoids movable controls');
      assert.ok(!boxes.slice(index + 1).some(other => overlap(boxes[index], other)), 'range and height labels never overlap');
    }
    assert.equal(context.labels.some(label => /TRAINING CORRIDOR|CONFIGURED|DESCENT TRAINING/.test(label.text)), false, 'long notes belong outside the operational scope');
  }
});

test('chart summary retains approach and configured descent details outside the scope', () => {
  const metadata = { mode: 'sra', finalTrack: 230, glidepathDeg: 3, approachSpeedKt: 240, approachAircraftType: 'fighter' };
  const environment = Display.radarChartEnvironment({ ...metadata, radarEnvironment: { sraDescentProfile: true } });
  const summary = Display.radarChartSummary({ environment, metadata, overlays: { terminationRangeNm: .5, approachCorridorWidthNm: 2 }, showDescentProfile: true }).join(' ');
  assert.match(summary, /Final 230°; SRA training corridor 2 NM total/);
  assert.match(summary, /Distances from landing threshold; termination 0\.5 NM/);
  assert.match(summary, /3\.0° descent training guide; heights AAL/);
  assert.match(summary, /FIGHTER · 240 KT configured; ≈ 1,270 FT\/MIN/);
});

test('range ring label boxes are reserved before compact SRA approach labels', () => {
  const Visuals = require('../../qgh-engine/scope-visuals.js');
  const context = chartContext();
  Object.assign(context, { save() {}, restore() {}, arc() {} });
  const ringLabelBoxes = [];
  Visuals.drawRangeRings(context, { width: 969, height: 380, cx: 484.5, cy: 190, rangeNm: 40,
    spacingNm: 10, scale: 380 * .44 / 40, labelBoxes: ringLabelBoxes });
  assert.equal(ringLabelBoxes.length, context.labels.length, 'only labels actually drawn reserve space');
  assert.ok(ringLabelBoxes.length > 0);
  for (let i = 0; i < ringLabelBoxes.length; i++) {
    assert.equal(ringLabelBoxes[i].x, context.labels[i].x);
    assert.equal(ringLabelBoxes[i].y, context.labels[i].y - 12);
  }
  const before = context.labels.length;
  const environment = Display.radarChartEnvironment({ mode: 'sra' });
  const chartLabels = Display.drawRadarEnvironment(context, { width: 969, height: 380, cx: 484.5, cy: 190,
    rangeNm: 40, scale: 380 * .44 / 40, environment, metadata: { mode: 'sra' }, obstacles: ringLabelBoxes });
  Display.drawSraReferences(context, { width: 969, height: 380, cx: 484.5, cy: 190,
    rangeNm: 40, scale: 380 * .44 / 40, environment, metadata: { mode: 'sra' },
    overlays: { centrelineDeg: 0, terminationRangeNm: .5 }, chartLabels });
  const approachLabels = context.labels.slice(before);
  assert.ok(approachLabels.some(label => /NM/.test(label.text)), 'readable approach ranges are retained');
  for (const label of approachLabels) {
    const box = { x: label.x, y: label.y - 11, width: context.measureText(label.text).width, height: 14 };
    assert.ok(ringLabelBoxes.every(ring => !(box.x < ring.x + ring.width && box.x + box.width > ring.x && box.y < ring.y + ring.height && box.y + box.height > ring.y)),
      `${label.text} must not overlap a range ring label`);
  }
});
