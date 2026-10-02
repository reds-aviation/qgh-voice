'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const source = readFileSync(join(__dirname, '..', 'suite-student.js'), 'utf8');
const page = readFileSync(join(__dirname, '..', 'student.html'), 'utf8');

function harness(mode = 'surveillance', options = {}) {
  const { metadata: metadataOverrides = {}, reducedMotion = false, ...speech } = options;
  const playback = [], snapshotOverrides = {};
  const elements = new Map(), windowEvents = {};
  let onEvent, portrait = false;
  const context = () => new Proxy({ marks: [], labels: [], textDraws: [], strokes: [], path: [], dash: [], beginPath() { this.path = []; }, moveTo(x, y) { this.path.push({ x, y }); }, lineTo(x, y) { this.path.push({ x, y }); }, setLineDash(dash) { this.dash = [...dash]; }, stroke() { this.strokes.push({ path: [...this.path], dash: [...this.dash], colour: this.strokeStyle }); }, arc(x, y, r) { this.marks.push({ x, y, r, alpha: this.globalAlpha }); }, fillText(text, x, y) { this.labels.push(text); this.textDraws.push({ text, x, y, width: this.measureText(text).width }); }, clearRect() { this.marks = []; this.labels = []; this.textDraws = []; this.strokes = []; }, measureText(text) { return { width: text.length * 8.4 }; } }, { get: (target, key) => key in target ? target[key] : () => {} });
  const node = id => {
    if (!elements.has(id)) elements.set(id, { id, value: ({ joinPin: '123456', radarHistory: '3', radarRange: '40', parRangeScale: '10', parHistory: '3' })[id] || '', hidden: id === 'radarInspection', checked: false, width: id === 'radarScope' ? 1000 : 1000, height: id === 'radarScope' ? 800 : 300, offsetWidth: id === 'radarInspection' ? 270 : 1000, offsetHeight: id === 'radarInspection' ? 180 : 300, textContent: '', style: {}, events: {}, attributes: {}, ctx: context(), addEventListener(type, fn) { this.events[type] = fn; }, setAttribute(name, value) { this.attributes[name] = value; }, getContext() { return this.ctx; }, getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }, querySelector() { return node(`${id}-strong`); } });
    return elements.get(id);
  };
  const metadata = { mode, callsign: '101', approachCallsign: '202', runwayOrientation: 230, finalTrack: 230, glidepathDeg: 3, scanRpm: 12, revisitSeconds: 5, ...metadataOverrides };
  const sandbox = { document: { getElementById: node, body: { classList: { toggle() {} } } }, localStorage: {}, innerWidth: 1000, innerHeight: 800, matchMedia: query => ({ matches: query === '(prefers-reduced-motion: reduce)' ? reducedMotion : portrait }), addEventListener: (name, fn) => { windowEvents[name] = fn; }, setInterval() {}, setTimeout: fn => fn(), ...speech, ATCSuiteSession: { createLocalSessionTransport() {}, createStudentSession(options) { onEvent = options.onEvent; return { requestJoin: () => true, preferences() {}, pilotPlayback: (id, phase) => playback.push({id,phase}), snapshot: () => ({ publicMetadata: metadata, simulationTime: 20, state: 'running', ...snapshotOverrides }) }; } } };
  vm.runInNewContext(source, sandbox);
  node('joinSession').events.click();
  const emit = observation => onEvent({ kind: 'observation', observation });
  const start = () => onEvent({ kind: 'lifecycle' });
  return { node, emit, start, playback, rawEvent: onEvent, snapshot: snapshotOverrides, event: kind => onEvent({ kind }), caption: (caption, transmissionId) => onEvent({ kind: 'caption', caption, transmissionId }), windowEvent: (name, event) => windowEvents[name]?.(event), portrait: value => { portrait = value; windowEvents.resize(); } };
}
const plot = (trackId, timestamp, rangeNm = 8) => ({ trackId, timestamp, rangeNm, azimuthDeg: 90 });
const returns = h => h.node('radarScope').ctx.strokes.filter(stroke => (
  stroke.path.length === 5 || (stroke.path.length === 4
    && stroke.path[0].y === stroke.path[1].y && stroke.path[2].x === stroke.path[3].x)
)).map(stroke => ({ ...stroke, x: (stroke.path[0].x + stroke.path[1].x) / 2, y: (stroke.path[0].y + stroke.path.at(-1).y) / 2 }));

test('student reduced-motion presentation hides only the sweep, keeping transmitted targets unchanged', () => {
  const normal = harness(), reduced = harness('surveillance', { reducedMotion: true });
  const observation = { timestamp: 20, scanAngleDeg: 90, plots: [plot('a', 20)], history: [] };
  normal.emit(observation); reduced.emit(observation);
  assert.ok(normal.node('radarScope').ctx.strokes.some(stroke => stroke.colour === '#389481'));
  assert.equal(reduced.node('radarScope').ctx.strokes.some(stroke => stroke.colour === '#389481'), false);
  assert.deepEqual(returns(reduced), returns(normal));
  assert.equal(observation.plots[0].rangeNm, 8);
});

test('radar renders every sampled target and history selection applies per track immediately', () => {
  const h = harness();
  h.emit({ timestamp: 20, plots: [plot('a', 20), plot('b', 20)], history: Array.from({ length: 5 }, (_, i) => [plot('a', i), plot('b', i)]).flat() });
  assert.equal(returns(h).length, 8);
  h.node('radarHistory').value = '0'; h.node('radarHistory').events.change();
  assert.equal(returns(h).length, 2);
  h.node('radarHistory').value = '5'; h.node('radarHistory').events.change();
  assert.equal(returns(h).length, 12);
});

test('range changes rescale observations and suppress returns outside selected range', () => {
  const h = harness(); h.emit({ timestamp: 20, plots: [plot('a', 19, 8), plot('b', 18, 30)] });
  const x40 = returns(h)[0].x;
  h.node('radarRange').value = '10'; h.node('radarRange').events.change();
  assert.equal(returns(h).length, 1); assert.ok(returns(h)[0].x > x40);
  assert.match(h.node('lastPlot').textContent, /1.*2/);
});

test('portrait SRA and vectoring remain usable with scope and controls', () => {
  const h = harness(); h.start(); h.portrait(true);
  assert.equal(h.node('orientationGate').hidden, true);
  h.portrait(false); assert.equal(h.node('orientationGate').hidden, true);
});

test('DF mode toggle is safe before observation and labels the transmitting callsign', () => {
  const h = harness('qgh');
  assert.doesNotThrow(() => h.node('selectQte').events.click());
  h.emit({ bearingDeg: 40, bearingType: 'qte', callsign: '202', transmissionState: 'pilot', status: 'live' });
  assert.match(h.node('dfCallsign').textContent, /^202/);
});

test('pilot playback reports lifecycle and ignores callbacks from cancelled replies', () => {
  const spoken = [], speechSynthesis = {getVoices:()=>[{lang:'en-GB',localService:true}], cancel(){}, speak:u=>spoken.push(u), addEventListener(){}};
  const h = harness('qgh',{speechSynthesis,SpeechSynthesisUtterance:function(text){this.text=text;}});
  h.node('studentAudio').checked = true;
  h.caption('First reply','first'); spoken[0].onstart();
  h.caption('Second reply','second');
  spoken[0].onend(); spoken[0].onerror(); spoken[1].onstart(); spoken[1].onend();
  assert.deepEqual(h.playback, [{id:'first',phase:'started'},{id:'first',phase:'unavailable'},{id:'second',phase:'started'},{id:'second',phase:'ended'}]);
  h.node('studentAudio').checked = false;
  h.caption('Muted reply','third');
  assert.deepEqual(h.playback.at(-1),{id:'third',phase:'unavailable'});
});

test('mode handover clears the prior sensor picture before drawing the replacement', () => {
  const h = harness('surveillance'); h.start(); h.emit({plots:[plot('a',20)]});
  h.snapshot.publicMetadata = {mode:'par', glidepathDeg:3}; h.snapshot.observation = null;
  h.rawEvent({kind:'public-metadata',publicMetadata:h.snapshot.publicMetadata});
  assert.equal(h.node('parElevation').ctx.marks.length, 0);
  assert.match(h.node('parRange').textContent, /—/);
  assert.match(h.node('pictureFreshness').textContent, /AWAITING PICTURE/);
});

test('freshness distinguishes stalled flight, stale picture, pause and a normal absent DF signal', () => {
  const h = harness('qgh');
  h.emit({status:'idle',transmissionState:'idle'});
  assert.equal(h.node('pictureFreshness').textContent,'NO SIGNAL · READY');
  h.snapshot.lastHostSeenAt = Date.now(); h.snapshot.lastProgressAt = Date.now()-8000;
  h.event('host-heartbeat'); assert.equal(h.node('pictureFreshness').textContent,'SIMULATION STALLED');
  h.snapshot.lastProgressAt = Date.now(); h.snapshot.lastObservationAt = Date.now()-8000;
  h.event('host-heartbeat'); assert.equal(h.node('pictureFreshness').textContent,'PICTURE STALE');
  h.snapshot.state = 'paused'; h.event('lifecycle');
  assert.equal(h.node('pictureFreshness').textContent,'PAUSED · PICTURE HELD');
});

test('student north bearing never paints 360 after rounding', () => {
  const h = harness('qgh'); h.emit({bearingDeg:359.6,bearingType:'qdm',status:'live',transmissionState:'pilot'});
  assert.equal(h.node('dfBearing').textContent,'000°');
});

test('PAR orders elevation above azimuth and reports off-scale instead of clamping a target to the edge', () => {
  assert.ok(page.indexOf('id="parElevation"') < page.indexOf('id="parAzimuth"'));
  const h = harness('par');
  h.emit({ trackState: 'tracking', rangeNm: 30, azimuth: { deviationDeg: 1 }, elevation: { deviationDeg: .1 }, history: [] });
  assert.match(h.node('parTrackState').textContent, /OFF.?SCALE/);
  assert.equal(h.node('parElevation').ctx.marks.length, 0);
});

test('24 targets survive rendering and five historical returns remain bounded per target', () => {
  const h = harness();
  const plots = Array.from({ length: 24 }, (_, i) => plot(`opaque-${i}`, 20));
  const history = plots.flatMap(point => Array.from({ length: 5 }, (_, i) => ({ ...point, timestamp: i })));
  h.node('radarHistory').value = '5'; h.emit({ plots, history });
  assert.equal(returns(h).length, 144);
  assert.match(h.node('lastPlot').textContent, /^24 \/ 24/);
  assert.ok(h.node('radarScope').ctx.labels.every(label => !String(label).includes('opaque-')));
});

test('PAR on-glidepath samples rise with range, share horizontal scale and history off leaves only the sample', () => {
  const h = harness('par');
  h.emit({ trackState: 'tracking', timestamp: 20, rangeNm: 5, azimuth: { deviationDeg: 0 }, elevation: { deviationDeg: 0 }, history: [{ rangeNm: 6, timestamp: 19, azimuthDeviationDeg: 0, elevationDeviationDeg: 0 }] });
  const elevation = h.node('parElevation').ctx.marks, azimuth = h.node('parAzimuth').ctx.marks;
  assert.equal(elevation[1].x, azimuth[1].x);
  assert.ok(elevation[0].y < elevation[1].y, 'farther sample has more height above touchdown');
  assert.equal(azimuth[0].y, azimuth[1].y, 'centreline returns stay on the lateral reference');
  h.node('parHistory').value = '0'; h.node('parHistory').events.change();
  assert.equal(h.node('parElevation').ctx.marks.length, 1);
  h.emit({ trackState: 'lost', history: [] });
  assert.equal(h.node('parElevation').ctx.marks.length, 0);
  assert.match(h.node('parTrackState').textContent, /LOST/);
});

test('pilot audio chooses installed device voices and never falls back to a network voice', () => {
  const spoken = [];
  let voices = [{ name: 'Network English', lang: 'en-US', localService: false }];
  const speechSynthesis = { getVoices: () => voices, cancel() {}, speak: utterance => spoken.push(utterance), addEventListener() {} };
  const h = harness('qgh', { speechSynthesis, SpeechSynthesisUtterance: function (text) { this.text = text; } });
  assert.equal(h.node('studentAudio').disabled, true);
  h.node('studentAudio').checked = true;
  h.caption('Turning left 230, 202'); assert.equal(spoken.length, 0);
  voices.push({ name: 'Installed English', lang: 'en-GB', localService: true });
  h.caption('Turning left 230, 202'); assert.equal(spoken.length, 1);
  assert.equal(spoken[0].voice.localService, true);
});

test('clustered correlated labels do not overlap and remain inside the scope', () => {
  const h = harness('surveillance', { metadata: { radarProfile: 'correlated-training' } });
  h.node('radarLabelCallsign').checked = true;
  const plots = Array.from({ length: 24 }, (_, i) => ({ ...plot(`opaque-${i}`, 20, 39), azimuthDeg: i * .1, callsign: `FLEET-${String(i).padStart(2, '0')}`, altitudeFt: 12000 + i * 1000, surveillance: { secondary: true, squawk: `${4300 + i}` } }));
  const observation = { plots, history: [] };
  h.emit(observation);
  const labels = h.node('radarScope').ctx.textDraws.filter(item => item.text.startsWith('CS FLEET-'));
  assert.equal(labels.length, 24);
  for (const [index, label] of labels.entries()) {
    assert.ok(label.x >= 0 && label.x + label.width <= 1000 && label.y >= 14 && label.y <= 800);
    for (const other of labels.slice(index + 1)) {
      assert.ok(label.x + label.width <= other.x || other.x + other.width <= label.x || label.y + 3 <= other.y - 14 || other.y + 3 <= label.y - 14, `${label.text} overlaps ${other.text}`);
    }
  }
  h.emit(observation);
  assert.deepEqual(h.node('radarScope').ctx.textDraws.filter(item => item.text.startsWith('CS FLEET-')), labels);
});

test('PAR displays the transmitted closing, opening and stable trend vocabulary', () => {
  const h = harness('par');
  for (const trend of ['closing', 'opening', 'stable']) {
    h.emit({ trackState: 'tracking', rangeNm: 5, azimuth: { deviationDeg: .2, trend }, elevation: { deviationDeg: .1, trend } });
    assert.match(h.node('parLateral').textContent, new RegExp(trend.toUpperCase()));
    assert.match(h.node('parVertical').textContent, new RegExp(trend.toUpperCase()));
  }
});

test('live console titles remain compact across exercise modes', () => {
  for (const [mode, title] of Object.entries({ qgh: 'Direction finding console', surveillance: 'Surveillance console', sra: 'SRA radar console', par: 'Precision approach console' })) {
    const h = harness(mode); h.start(); assert.equal(h.node('studentModeTitle').textContent, title);
  }
});

test('live pilot audio defaults muted, toggles accessibly and cancels on mute, replacement, disconnect and end', () => {
  const calls = [];
  const speechSynthesis = { getVoices: () => [{ name: 'Installed English', lang: 'en-GB', localService: true }], cancel: () => calls.push('cancel'), speak: utterance => calls.push(utterance.text), addEventListener() {} };
  const h = harness('qgh', { speechSynthesis, SpeechSynthesisUtterance: function (text) { this.text = text; } });
  h.start();
  const control = h.node('togglePilotAudio');
  assert.equal(control.attributes['aria-pressed'], 'false');
  control.events.click(); assert.equal(control.attributes['aria-pressed'], 'true');
  h.caption('First reply'); h.caption('Replacement reply');
  assert.deepEqual(calls.slice(-4), ['cancel', 'First reply', 'cancel', 'Replacement reply']);
  control.events.click(); assert.equal(control.attributes['aria-pressed'], 'false'); assert.equal(calls.at(-1), 'cancel');
  const spokenBefore = calls.filter(call => call !== 'cancel').length;
  h.caption('Muted reply'); assert.equal(calls.filter(call => call !== 'cancel').length, spokenBefore);
  for (const event of ['disconnected', 'terminated']) {
    control.events.click(); h.event(event); assert.equal(calls.at(-1), 'cancel');
    assert.equal(control.attributes['aria-pressed'], 'false');
  }
});

test('SRA dashed corridor uses total training width and scales to the selected range', () => {
  const h = harness('sra');
  for (const configuredWidth of [undefined, 4]) {
    const overlays = { centrelineDeg: 0, terminationRangeNm: .5, ...(configuredWidth == null ? {} : { approachCorridorWidthNm: configuredWidth }) };
    h.emit({ overlays, plots: [] });
    const ctx = h.node('radarScope').ctx, boundaries = ctx.strokes.filter(stroke => stroke.dash.join() === '5,7');
    assert.equal(boundaries.length, 2);
    const halfWidthPx = (configuredWidth ?? 2) / 2 / 40 * 328;
    assert.ok(Math.abs(boundaries[0].path[0].x - (500 - halfWidthPx)) < 1e-9);
    assert.ok(Math.abs(boundaries[1].path[0].x - (500 + halfWidthPx)) < 1e-9);
    assert.ok(boundaries.every(stroke => stroke.path[0].x === stroke.path[1].x && stroke.path[1].y < stroke.path[0].y));
    assert.ok(ctx.labels.some(text => text.includes(`${configuredWidth ?? 2} NM TOTAL`) && text.includes('TRAINING')));
    assert.match(h.node('radarGuideNote').textContent, /not safety limits/i);
  }
});

test('radar environment overlays remain explicitly training-only and use the configured runway geometry', () => {
  const h = harness('surveillance', { metadata: { radarProfile: 'correlated-training', radarEnvironment: {
    runwayOrientationDeg: 230, extendedCentreline: true, extendedCentrelineNm: 20, centrelineTickNm: 5,
    lfaBoundary: [{ bearingDeg: 10, rangeNm: 12 }, { bearingDeg: 90, rangeNm: 16 }, { bearingDeg: 220, rangeNm: 14 }]
  } } });
  h.emit({ plots: [] });
  const ctx = h.node('radarScope').ctx;
  assert.equal(ctx.strokes.filter(stroke => stroke.dash.join() === '9,6').length, 2);
  assert.equal(ctx.strokes.filter(stroke => stroke.dash.join() === '4,8').length, 1);
  assert.ok(ctx.labels.includes('LFA · TRAINING BOUNDARY'));
  assert.ok(ctx.labels.some(text => text.includes('EXTENDED RWY CENTRELINE · 230° / 050°')));
  assert.match(h.node('radarGuideNote').textContent, /local training reference only/i);
});

test('SRA shows a calculated 3 degree descent training guide without changing radar target logic', () => {
  const h = harness('sra', { metadata: { radarProfile: 'correlated-training', approachSpeedKt: 240, approachAircraftType: 'fighter', radarEnvironment: { sraDescentProfile: true } } });
  h.node('radarRange').value = '10';
  h.emit({ overlays: { centrelineDeg: 0, terminationRangeNm: .5 }, plots: [] });
  const labels = h.node('radarScope').ctx.labels;
  assert.ok(labels.includes('2 NM · 640 FT AAL'));
  assert.ok(labels.some(text => text.includes('3.0° DESCENT TRAINING GUIDE')));
  assert.ok(labels.some(text => text.includes('FIGHTER · 240 KT CONFIGURED · ≈ 1,270 FT/MIN')));
  assert.match(h.node('radarGuideNote').textContent, /not safety limits or clearances/i);
});

test('SRA retains distance ticks while spacing long descent labels at wide ranges', () => {
  const h = harness('sra', { metadata: { radarEnvironment: { sraDescentProfile: true } } });
  h.node('radarRange').value = '40';
  h.emit({ overlays: { centrelineDeg: 90 }, plots: [] });
  const context = h.node('radarScope').ctx;
  const labels = context.textDraws.filter(draw => /\d+ NM · [\d,]+ FT AAL/.test(draw.text));
  assert.ok(labels.length >= 2, 'the 3° altitude reference remains available');
  for (let index = 0; index < labels.length; index += 1) {
    for (let other = index + 1; other < labels.length; other += 1) {
      const a = labels[index], b = labels[other];
      assert.ok(a.x + a.width + 8 <= b.x || b.x + b.width + 8 <= a.x || Math.abs(a.y - b.y) >= 25,
        `descent cue ${a.text} must not cover ${b.text}`);
    }
  }
  assert.ok(context.strokes.filter(stroke => stroke.dash.join() === '').length >= 10, 'distance ticks remain visible');
});

test('primary returns use plus symbols while correlated SSR squares open only the safe cooperative detail card', () => {
  const h = harness('surveillance', { metadata: { radarProfile: 'correlated-training' } });
  const primary = { ...plot('T1', 20), callsign: 'PRIMARY', altitudeFt: 9000 };
  const ssr = { ...plot('T2', 20), rangeNm: 8, callsign: 'RAVEN 21', altitudeFt: 12000,
    groundSpeedKt: 245, headingDeg: 225, surveillance: { secondary: true, modeS: true, squawk: '4301', modeSId: 'A1B2C3' } };
  h.emit({ plots: [primary, ssr] });
  const ctx = h.node('radarScope').ctx;
  assert.ok(ctx.strokes.some(stroke => stroke.path.length === 5), 'SSR return is a square');
  assert.ok(ctx.strokes.some(stroke => stroke.path.length === 4 && stroke.path[0].y === stroke.path[1].y), 'primary return is a plus');
  assert.ok(!ctx.labels.some(text => /4301|A1B2C3|M-S/.test(text)), 'Mode A/Mode S data stays out of scope labels');
  h.node('radarScope').events.pointerdown({ clientX: 500 + 8 / 40 * 328, clientY: 400 });
  assert.equal(h.node('radarInspection').hidden, false);
  assert.match(h.node('inspectTrack').textContent, /RAVEN 21/);
  assert.match(h.node('inspectSquawk').textContent, /4301/);
  assert.match(h.node('inspectAltitude').textContent, /12,000 FT/);
  assert.match(h.node('inspectGroundSpeed').textContent, /245 KT/);
  assert.match(h.node('inspectHeading').textContent, /225°/);
  assert.match(h.node('inspectBearingRange').textContent, /090°.*8\.0 NM/);
  assert.match(h.node('inspectModeS').textContent, /A1B2C3/);
  h.node('radarInspectionHandle').events.pointerdown({ button: 0, pointerId: 1, clientX: 100, clientY: 100, preventDefault() {} });
  h.windowEvent('pointermove', { pointerId: 1, clientX: 410, clientY: 330, preventDefault() {} });
  assert.equal(h.node('radarInspection').style.right, 'auto');
  assert.equal(h.node('radarInspection').style.bottom, 'auto');
  h.node('closeRadarInspection').events.click();
  assert.equal(h.node('radarInspection').hidden, true);
});

test('Mode A returns remain selectable SSR squares without a Mode S identity', () => {
  const h = harness('surveillance', { metadata: { radarProfile: 'correlated-training' } });
  const modeA = { ...plot('T2', 20), rangeNm: 8, callsign: 'RAVEN 21', altitudeFt: 12000,
    surveillance: { secondary: true, squawk: '4301' } };
  h.node('radarLabelModeS').checked = true;
  h.emit({ plots: [modeA] });
  assert.ok(h.node('radarScope').ctx.strokes.some(stroke => stroke.path.length === 5), 'Mode A return is a square');
  assert.ok(h.node('radarScope').ctx.labels.some(text => /SSR MODE A/.test(text)));
  h.node('radarScope').events.pointerdown({ clientX: 500 + 8 / 40 * 328, clientY: 400 });
  assert.equal(h.node('radarInspection').hidden, false);
  assert.match(h.node('inspectSquawk').textContent, /4301/);
  assert.equal(h.node('inspectModeS').textContent, 'NOT FITTED');
});

test('a dragged secondary detail card stays inside the visible mobile viewport', () => {
  const h = harness('surveillance', { metadata: { radarProfile: 'correlated-training' }, visualViewport: { width: 390, height: 640, offsetLeft: 0, offsetTop: 24 } });
  const ssr = { ...plot('T2', 20), callsign: 'RAVEN 21', altitudeFt: 12000, surveillance: { secondary: true, squawk: '4301' } };
  h.emit({ plots: [ssr] });
  h.node('radarScope').events.pointerdown({ clientX: 500 + 8 / 40 * 328, clientY: 400 });
  h.node('radarInspectionHandle').events.pointerdown({ button: 0, pointerId: 1, clientX: 100, clientY: 100, preventDefault() {} });
  h.windowEvent('pointermove', { pointerId: 1, clientX: 999, clientY: 999, preventDefault() {} });
  assert.equal(h.node('radarInspection').style.left, '112px');
  assert.equal(h.node('radarInspection').style.top, '476px');
});

test('scope data labels start decluttered, reveal only selected safe secondary fields and mark absent values as not reported', () => {
  const h = harness('surveillance', { metadata: { radarProfile: 'correlated-training' } });
  const ssr = { ...plot('T2', 20), rangeNm: 8, callsign: 'RAVEN 21', altitudeFt: 12000,
    surveillance: { secondary: true, modeS: true, squawk: '4301' } };
  h.emit({ plots: [ssr] });
  assert.ok(!h.node('radarScope').ctx.labels.some(text => /RAVEN 21|4301/.test(text)), 'no secondary label is painted before the student selects a field');
  h.node('radarLabelCallsign').checked = true;
  h.node('radarLabelSquawk').checked = true;
  h.node('radarLabelModeS').checked = true;
  h.node('radarLabelSpeed').checked = true;
  h.node('radarLabelHeading').checked = true;
  h.node('radarLabelBearingRange').checked = true;
  h.node('radarLabelCallsign').events.change();
  const labels = h.node('radarScope').ctx.labels;
  assert.ok(labels.some(text => /CS RAVEN 21/.test(text)));
  assert.ok(labels.some(text => /A 4301/.test(text)));
  assert.ok(labels.some(text => /SSR MODE S/.test(text)));
  assert.ok(labels.some(text => /GS NOT REPORTED/.test(text)));
  assert.ok(labels.some(text => /HDG NOT REPORTED/.test(text)));
  assert.ok(labels.some(text => /BRG 090°.*8\.0 NM/.test(text)));
  assert.match(h.node('radarScopeControlStatus').textContent, /6 LABELS/);
});

test('student scope controls can hide only instructor-provided centreline and descent aids', () => {
  const h = harness('sra', { metadata: { radarProfile: 'correlated-training', radarEnvironment: {
    extendedCentreline: true, extendedCentrelineNm: 20, centrelineTickNm: 5, sraDescentProfile: true
  } } });
  h.emit({ overlays: { centrelineDeg: 0, terminationRangeNm: .5 }, plots: [] });
  let ctx = h.node('radarScope').ctx;
  assert.equal(ctx.strokes.filter(stroke => stroke.dash.join() === '9,6').length, 2);
  assert.ok(ctx.labels.some(text => /DESCENT TRAINING GUIDE/.test(text)));
  h.node('radarOverlayCentreline').checked = false;
  h.node('radarOverlayDescent').checked = false;
  h.node('radarOverlayCentreline').events.change();
  ctx = h.node('radarScope').ctx;
  assert.equal(ctx.strokes.filter(stroke => stroke.dash.join() === '9,6').length, 0);
  assert.ok(!ctx.labels.some(text => /DESCENT TRAINING GUIDE/.test(text)));
  assert.match(h.node('radarScopeControlStatus').textContent, /DECLUTTERED/);

  const unavailable = harness('surveillance', { metadata: { radarProfile: 'primary', radarEnvironment: {} } });
  unavailable.emit({ plots: [] });
  assert.equal(unavailable.node('radarOverlayCentreline').disabled, true);
  assert.equal(unavailable.node('radarOverlayDescent').disabled, true);
  assert.equal(unavailable.node('radarLabelCallsign').disabled, true);
  assert.match(unavailable.node('radarScopeControlStatus').textContent, /PRIMARY ONLY/);
});

test('primary-only presentation refuses identity and SSR details even if a malformed local event includes them', () => {
  const h = harness('surveillance', { metadata: { radarProfile: 'primary' } });
  for (const id of ['radarLabelCallsign', 'radarLabelSquawk', 'radarLabelModeS', 'radarLabelLevel', 'radarLabelSpeed', 'radarLabelHeading', 'radarLabelBearingRange']) h.node(id).checked = true;
  h.emit({ plots: [{ ...plot('T1', 20), callsign: 'MUST NOT DISPLAY', altitudeFt: 12000,
    groundSpeedKt: 260, headingDeg: 220, surveillance: { secondary: true, modeS: true, squawk: '4301', modeSId: 'A1B2C3' } }] });
  assert.ok(h.node('radarScope').ctx.strokes.some(stroke => stroke.path.length === 4 && stroke.path[0].y === stroke.path[1].y));
  assert.ok(!h.node('radarScope').ctx.labels.some(text => /MUST NOT DISPLAY|4301|A1B2C3/.test(text)));
  h.node('radarScope').events.pointerdown({ clientX: 500 + 8 / 40 * 328, clientY: 400 });
  assert.equal(h.node('radarInspection').hidden, true);
});

test('PAR nominal training bands use angular geometry around centreline and glidepath', () => {
  const h = harness('par'); h.emit({ trackState: 'lost', history: [] });
  for (const [id, angularHalfWidth] of [['parAzimuth', 1], ['parElevation', .5]]) {
    const ctx = h.node(id).ctx, boundaries = ctx.strokes.filter(stroke => stroke.dash.join() === '5,7');
    assert.equal(boundaries.length, 2);
    for (let index = 0; index < 2; index += 1) {
      const angle = (id === 'parElevation' ? 3 : 0) + (index === 0 ? -angularHalfWidth : angularHalfWidth);
      const physical = Math.tan(angle * Math.PI / 180) * 10 * (id === 'parElevation' ? 6076.12 : 1);
      const expectedY = id === 'parElevation' ? 251 - physical / 4000 * 221 : 140.5 - physical * 221 / 2;
      assert.ok(Math.abs(boundaries[index].path[0].y - expectedY) < 1e-9);
      assert.equal(boundaries[index].path[0].x, 86);
      assert.equal(boundaries[index].path[1].x, 962);
      assert.equal(boundaries[index].path[1].y, id === 'parElevation' ? 251 : 140.5);
    }
    assert.ok(ctx.labels.some(text => text.includes(`±${angularHalfWidth}°`) && text.includes('TRAINING GUIDE')));
  }
  assert.match(page, /not safety limits/i);
});
