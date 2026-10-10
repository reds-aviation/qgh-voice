const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const Core = require('../suite-core.js');
const Sensors = require('../suite-sensors.js');

function harness() {
  let wallMs = 0;
  const nodes = new Map();
  const canvasContext = new Proxy({}, { get(target, key) { return target[key] || (() => {}); } });
  const document = { getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, { value: '0', textContent: '', hidden: false, disabled: false,
      classList: { add() {}, remove() {}, toggle() {} }, children: [],
      replaceChildren(...children) { this.children = children; }, append(child) { this.children.push(child); }, prepend(child) { this.children.unshift(child); },
      getContext() { return canvasContext; }, width: 900, height: 700,
      addEventListener() {}, setAttribute() {}, closest() { return null; } });
    return nodes.get(id);
  }, querySelectorAll() { return []; }, createElement() { return { classList: { toggle() {} }, dataset: {},
    setAttribute() {}, addEventListener() {}, append() {} }; } };
  let source = readFileSync(join(__dirname, '../suite-instructor.js'), 'utf8');
  source = source.slice(0, source.indexOf("  family.addEventListener('change'")) +
    '\n globalThis.fixture = {state, runtimeTick, frame, onSessionEvent, truthForSensor, advanceSensors, advanceBy, advanceWallElapsed, setTrainingTimeRate, resetTrainingTimeRate, normaliseTrainingTimeRate, scenarioInput, publicMetadata, publicMetadataForSimulation, createSensor, command, transferSelectedToPar, syncRoster, finishTransmission, selectAircraft, updateAll, handleShortcut, drawReview};})();';
  const context = { document, ATCSuiteCore: Core, ATCSuiteSensors: Sensors, ATCSuiteSession: {}, ATCSuiteCommandReference: require('../suite-command-reference.js'),
    setTimeout() { return 1; }, clearTimeout() {}, requestAnimationFrame() {}, performance: { now: () => wallMs }, console };
  vm.runInNewContext(source, context);
  const aircraft = Array.from({ length: 24 }, (_, index) => ({ aircraftId: `AC${index + 1}`, callsign: String(101 + index),
    initialQteDeg: 30 + index, initialRangeNm: 20, initialHeadingDeg: 210,
    altitudeFt: 1000 + index * 1000, speedKt: 240, rateDegPerSecond: 3 }));
  context.fixture.state.simulation = Core.createState({ aircraft, runwayOrientationDeg: 230, finalTrackDeg: 230 });
  context.fixture.state.sensor = Sensors.createDfSensor({ holdSeconds: 2 });
  context.fixture.state.review = Sensors.createReviewTimeline();
  context.fixture.state.session = { publishObservation() {}, publishCaption() {}, pause() { return true; } };
  return { ...context.fixture, node: document.getElementById, wall: ms => { wallMs = ms; } };
}

test('sensor truth contains every aircraft independently of control selection', () => {
  const h = harness();
  h.state.simulation = Core.selectAircraft(h.state.simulation, 'AC24');
  const truth = h.truthForSensor();
  assert.equal(truth.aircraft.length, 24);
  assert.equal(truth.aircraft[0].id, 'AC1');
  assert.equal(truth.aircraft[23].id, 'AC24');
});

function rosterRow(values) {
  const controls = values.map((value, index) => ({ value, dataset: index === 2 ? { radarReturnAuto: 'true' } : {}, setAttribute() {} }));
  return { dataset: {}, querySelectorAll() { return controls; }, querySelector() { return controls[0]; },
    cloneNode() {
      const clone = rosterRow(controls.map(control => control.value));
      clone.querySelectorAll().forEach((control, index) => Object.assign(control.dataset, controls[index].dataset));
      return clone;
    } };
}

function initialiseRoster(h, count) {
  h.node('aircraftRoster').children = [rosterRow(['101', '4300', 'primary', 'fighter', '65', '25', '225', '12000', '240', '3', '1000'])];
  h.node('aircraftCount').value = String(count);
  h.syncRoster();
}

test('all 24 generated aircraft have distinct bearings, ranges, headings and separated altitude levels', () => {
  const h = harness();
  initialiseRoster(h, 24);
  const automaticSquawks = h.node('aircraftRoster').children.map(row => row.querySelectorAll()[1].value);
  assert.equal(new Set(automaticSquawks).size, 24, 'automatic squawks must be unique');
  assert.equal(automaticSquawks[0], '4300');
  assert.equal(automaticSquawks.at(-1), '4327');
  const aircraft = h.scenarioInput().aircraft;
  for (const field of ['initialQteDeg', 'initialRangeNm', 'initialHeadingDeg', 'altitudeFt']) {
    assert.equal(new Set(aircraft.map(item => item[field])).size, 24, `${field} must be distinct for every aircraft`);
  }
  for (let index = 1; index < aircraft.length; index += 1) {
    assert.equal(aircraft[index].altitudeFt - aircraft[index - 1].altitudeFt, 1000);
  }
  assert.deepEqual([aircraft[0].initialQteDeg, aircraft[0].initialRangeNm, aircraft[0].initialHeadingDeg, aircraft[0].altitudeFt], [65, 25, 225, 12000]);
  const last = aircraft.at(-1);
  assert.deepEqual([last.initialQteDeg, last.initialRangeNm, last.initialHeadingDeg, last.altitudeFt], [4, 48, 164, 35000]);
  const simulation = Core.createState({ aircraft, runwayOrientationDeg: 230, finalTrackDeg: 230 });
  assert.equal(new Set(simulation.aircraftList.map(item => `${item.position.xNm}:${item.position.yNm}`)).size, 24);
});

test('new QGH roster is capped at two without reducing SRA or vectoring traffic', () => {
  const h = harness(); h.node('exerciseFamily').value = 'qgh'; initialiseRoster(h, 24);
  assert.equal(h.node('aircraftCount').max, '2'); assert.equal(h.node('aircraftCount').value, '2');
  assert.equal(h.node('aircraftRoster').children.length, 2);
  assert.equal(h.node('aircraftCountLabel').textContent, 'AIRCRAFT COUNT · 1–2');
  for (const mode of ['sra', 'surveillance']) {
    h.node('exerciseFamily').value = mode; h.node('aircraftCount').value = '24'; h.syncRoster();
    assert.equal(h.node('aircraftCount').max, '24'); assert.equal(h.node('aircraftRoster').children.length, 24);
  }
});

test('changing count restores every edited field without regenerating cached aircraft', () => {
  const h = harness();
  initialiseRoster(h, 24);
  assert.equal(h.node('aircraftRoster').children.length, 24);
  const last = h.node('aircraftRoster').children[23].querySelectorAll();
  const entered = ['789', '5001', 'mode-a', 'transport', '123', '17.4', '87', '9000', '310', '2.1', '700'];
  last.forEach((control, index) => { control.value = entered[index]; });
  last[2].dataset.radarReturnAuto = 'false';
  h.node('aircraftCount').value = '1'; h.syncRoster();
  h.node('aircraftCount').value = '24'; h.syncRoster();
  assert.deepEqual(h.node('aircraftRoster').children[23].querySelectorAll().map(control => control.value), entered);
  const input = h.scenarioInput();
  assert.equal(input.aircraft[23].aircraftType, 'transport');
  assert.equal(input.aircraft[23].transponderCode, '5001');
  assert.equal(input.aircraft[23].surveillance, undefined);
  assert.equal(input.aircraft[23].altitudeFt, 9000);
  assert.equal(input.aircraft[23].verticalRateFpm, 700);
});

test('a blank squawk receives the visible automatic octal allocation while duplicate manual squawks are rejected', () => {
  const h = harness();
  initialiseRoster(h, 2);
  h.node('exerciseFamily').value = 'surveillance';
  h.node('radarProfile').value = 'correlated';
  h.syncRoster();
  const second = h.node('aircraftRoster').children[1].querySelectorAll();
  second[1].value = '';
  const input = h.scenarioInput();
  assert.equal(second[1].value, '4301');
  assert.equal(input.aircraft[1].transponderCode, '4301');
  assert.equal(input.aircraft[1].surveillance.squawk, '4301');
  second[1].value = '4300';
  assert.throws(() => h.scenarioInput(), /unique four-digit octal/i);
});

test('generated defaults are deterministic for direct and gradual count increases', () => {
  const direct = harness(), gradual = harness();
  initialiseRoster(direct, 24);
  initialiseRoster(gradual, 1);
  for (const count of [2, 8, 12, 24]) {
    gradual.node('aircraftCount').value = String(count); gradual.syncRoster();
  }
  assert.equal(JSON.stringify(gradual.scenarioInput().aircraft), JSON.stringify(direct.scenarioInput().aircraft));
});

test('radar profile defaults every surveillance or SRA return to primary or Mode S', () => {
  const h = harness();
  initialiseRoster(h, 3);
  h.node('exerciseFamily').value = 'surveillance';
  h.node('radarProfile').value = 'primary'; h.syncRoster();
  assert.deepEqual(h.node('aircraftRoster').children.map(row => row.querySelectorAll()[2].value), ['primary', 'primary', 'primary']);
  const primary = h.scenarioInput();
  assert.equal(primary.surveillanceProfile, 'primary');
  assert.ok(primary.aircraft.every(item => item.surveillance === undefined));

  h.node('radarProfile').value = 'correlated'; h.syncRoster();
  assert.deepEqual(h.node('aircraftRoster').children.map(row => row.querySelectorAll()[2].value), ['mode-s', 'mode-s', 'mode-s']);
  const correlated = h.scenarioInput();
  assert.equal(correlated.surveillanceProfile, 'correlated');
  assert.ok(correlated.aircraft.every(item => item.surveillance?.modeS === true));
});

test('per-aircraft radar return configuration preserves primary, Mode A and Mode S', () => {
  const h = harness();
  initialiseRoster(h, 3);
  h.node('exerciseFamily').value = 'sra';
  h.node('radarProfile').value = 'correlated'; h.syncRoster();
  const rows = h.node('aircraftRoster').children.map(row => row.querySelectorAll());
  rows[0][2].value = 'primary'; rows[0][2].dataset.radarReturnAuto = 'false';
  rows[1][2].value = 'mode-a'; rows[1][2].dataset.radarReturnAuto = 'false';
  rows[2][2].value = 'mode-s'; rows[2][2].dataset.radarReturnAuto = 'false';

  const input = h.scenarioInput();
  assert.equal(input.surveillanceProfile, 'correlated');
  assert.equal(input.aircraft[0].transponderCode, '4300');
  assert.equal(input.aircraft[0].surveillance, undefined);
  assert.equal(JSON.stringify(input.aircraft[1].surveillance), JSON.stringify({ secondary: true, squawk: '4301' }));
  assert.equal(Object.hasOwn(input.aircraft[1].surveillance, 'modeS'), false);
  assert.equal(Object.hasOwn(input.aircraft[1].surveillance, 'modeSId'), false);
  assert.equal(JSON.stringify(input.aircraft[2].surveillance), JSON.stringify({ secondary: true, modeS: true, squawk: '4302', modeSId: 'A10002' }));
});

test('correlated radar setup generates secondary SSR data for every configured aircraft with a local-only environment', () => {
  const h = harness();
  initialiseRoster(h, 3);
  h.node('exerciseFamily').value = 'sra';
  h.node('radarProfile').value = 'correlated';
  h.syncRoster();
  h.node('scanPreset').value = '12';
  h.node('parRefresh').value = '1';
  h.node('parTransferGate').value = '10';
  h.node('runwayOrientation').value = '230';
  h.node('finalTrack').value = '230';
  h.node('approachAircraft').value = 'AC1';
  h.node('extendedCentreline').checked = true;
  h.node('extendedCentrelineNm').value = '20';
  h.node('centrelineTickNm').value = '2';
  h.node('localLfaEnabled').checked = true;
  h.node('localLfaRadius').value = '16';
  h.node('sraDescentProfile').checked = true;

  const input = h.scenarioInput();
  assert.equal(JSON.stringify(input.aircraft[0].surveillance), JSON.stringify({ secondary: true, modeS: true, squawk: '4300', modeSId: 'A10000' }));
  assert.equal(input.aircraft[0].transponderCode, '4300');
  assert.equal(JSON.stringify(input.aircraft[1].surveillance), JSON.stringify({ secondary: true, modeS: true, squawk: '4301', modeSId: 'A10001' }));
  assert.equal(JSON.stringify(input.aircraft[2].surveillance), JSON.stringify({ secondary: true, modeS: true, squawk: '4302', modeSId: 'A10002' }));
  assert.equal(input.radarEnvironment.runwayOrientationDeg, 230);
  assert.equal(input.radarEnvironment.extendedCentreline, true);
  assert.equal(input.radarEnvironment.lfaBoundary.length, 8);
  assert.equal(JSON.stringify(input.radarEnvironment.lfaBoundary[2]), JSON.stringify({ bearingDeg: 90, rangeNm: 16 }));

  h.state.simulation = Core.createState(JSON.parse(JSON.stringify(input)));
  h.state.sensor = Sensors.createSurveillanceSensor({ rpm: 12, profile: 'correlated', sra: true, history: 3 });
  const truth = h.truthForSensor();
  assert.equal(JSON.stringify(truth.aircraft[0].surveillance), JSON.stringify(input.aircraft[0].surveillance));
  assert.equal(JSON.stringify(truth.aircraft[1].surveillance), JSON.stringify(input.aircraft[1].surveillance));
  assert.equal(truth.aircraft[0].speedKt, undefined, 'ground speed is calculated from sampled radar movement, not injected into sensor truth');
  const metadata = h.publicMetadataForSimulation();
  assert.equal(metadata.approachSpeedKt, 240);
  assert.equal(metadata.approachAircraftType, 'fighter');
  assert.equal(JSON.stringify(metadata.radarEnvironment), JSON.stringify(input.radarEnvironment));
});

test('selection preserves transmitting source and frames do not replace typed speed or altitude', () => {
  const h = harness();
  h.state.simulation = Core.setLifecycle(h.state.simulation, 'running');
  h.command({ type: 'transmit' }, 'transmitDf');
  h.selectAircraft('AC24');
  assert.equal(h.state.sensor.read(0, h.truthForSensor()).source, 'AC1');
  assert.equal(h.node('truthCallsign').textContent, '124');
  h.node('liveSpeed').value = '315'; h.node('altitudeInput').value = '8300';
  h.updateAll();
  assert.equal(h.node('liveSpeed').value, '315');
  assert.equal(h.node('altitudeInput').value, '8300');
  h.advanceBy(60);
  assert.equal(h.state.simulation.simulationSeconds, 60);
  assert.equal(h.state.sensor.read(0).phase, 'live', 'flight advance must not consume radio wall time');
  h.wall(16000); h.runtimeTick();
  assert.equal(h.state.transmission, null);
  assert.equal(h.state.sensor.read(16).phase, 'held');
  assert.equal(h.state.sensor.read(18.01).phase, 'idle');
  assert.equal(h.state.review.snapshot().truth.at(-1).aircraft.length, 24);
});

test('runtime advances without animation frames and pauses explicitly after browser suspension', () => {
  const h = harness();
  h.setTrainingTimeRate(5);
  h.state.simulation = Core.setLifecycle(h.state.simulation, 'running'); h.state.running = true;
  h.state.previousTick = 0; h.wall(1500); h.runtimeTick();
  assert.equal(h.state.simulation.simulationSeconds, 7.5, '1.5 seconds at 5x must not be clamped to 1');
  h.frame(1500); h.frame(2000);
  assert.equal(h.state.simulation.simulationSeconds, 7.5, 'painting has no authority to advance flight');
  h.wall(10000); h.runtimeTick();
  assert.equal(h.state.simulation.simulationSeconds, 7.5);
  assert.equal(h.state.simulation.lifecycle, 'paused');
  assert.match(h.node('commandStatus').textContent, /SUSPENDED/);
});

test('every exercise defaults to real-time while explicit instructor acceleration remains available', () => {
  const h = harness();
  for (const mode of ['qgh','surveillance','sra','par']) {
    assert.equal(h.resetTrainingTimeRate(mode), 1);
    assert.equal(h.setTrainingTimeRate(5), 5);
    assert.equal(h.setTrainingTimeRate(10), 10);
  }
  assert.equal(h.resetTrainingTimeRate('qgh'), 1);
});

test('DF follows current pilot playback then holds for two wall seconds at every flight speed', () => {
  for (const rate of [1, 5, 10]) {
    const h = harness(); h.setTrainingTimeRate(rate);
    h.state.simulation = Core.setLifecycle(h.state.simulation, 'running'); h.state.running = true; h.state.radioAudio = true;
    h.command({ type: 'transmit' }, 'transmitDf');
    const id = h.state.transmission.id;
    h.onSessionEvent({kind: 'pilot-playback', transmissionId: id, phase: 'started'});
    h.state.previousTick = 0;
    for (let ms = 1000; ms <= 5000; ms += 1000) { h.wall(ms); h.runtimeTick(); }
    assert.equal(h.state.sensor.read(5).phase, 'live');
    assert.equal(h.state.simulation.simulationSeconds, rate * 5);
    h.onSessionEvent({kind: 'pilot-playback', transmissionId: id, phase: 'ended'});
    assert.equal(h.state.sensor.read(6.99).phase, 'held');
    assert.equal(h.state.sensor.read(7.01).phase, 'idle');
  }
});

test('obsolete playback completion cannot release a newer transmission and sensor errors pause safely', () => {
  const h = harness(); h.state.simulation = Core.setLifecycle(h.state.simulation, 'running');
  h.command({type:'transmit'}, 'transmitDf'); const old = h.state.transmission.id;
  h.command({type:'report-heading'}, 'reportHeading'); const fresh = h.state.transmission.id;
  h.onSessionEvent({kind:'pilot-playback', transmissionId:old, phase:'ended'});
  assert.equal(h.state.transmission.id, fresh);
  h.state.session.publishObservation = () => { throw new Error('test-invalid-observation'); };
  h.runtimeTick();
  assert.equal(h.state.simulation.lifecycle, 'paused');
  assert.match(h.node('commandStatus').textContent, /SENSOR UPDATE FAILED/);
});

test('surveillance samples interpolate every aircraft across a simulation step', () => {
  const h = harness();
  const first = Core.createState({ ...h.state.simulation.scenario, runwayOrientationDeg: 230, finalTrackDeg: 230,
    exerciseFamily: 'surveillance', aircraft: h.state.simulation.aircraftList.map(a => ({
      aircraftId: a.id, callsign: a.callsign, initialQteDeg: 60, initialRangeNm: 20,
      initialHeadingDeg: 90, altitudeFt: a.altitudeFt, speedKt: 240, rateDegPerSecond: 3
    })) });
  const second = Core.advance(first, 1);
  let sampled;
  h.state.simulation = second;
  h.state.sensor = { advance(time, read) { sampled = read(.5); }, studentObservation() { return {}; } };
  h.advanceSensors(first, second);
  assert.equal(sampled.aircraft.length, 24);
  for (let index = 0; index < 24; index += 1) {
    assert.equal(sampled.aircraft[index].id, first.aircraftList[index].id);
    assert.equal(sampled.aircraft[index].position.xNm, (first.aircraftList[index].position.xNm + second.aircraftList[index].position.xNm) / 2);
  }
});

test('advance minute is inert before start and after termination', () => {
  const h = harness();
  const initial = h.state.simulation;
  h.advanceBy(60);
  assert.equal(h.state.simulation, initial);
  h.state.simulation = Core.setLifecycle(initial, 'review');
  const review = h.state.simulation;
  h.advanceBy(60);
  assert.equal(h.state.simulation, review);
});

test('default clock rate advances a 240-knot aircraft four nautical miles in one real minute', () => {
  const h = harness();
  const initial = h.state.simulation;
  h.state.simulation = Core.setLifecycle(initial, 'running');
  h.state.running = true;
  assert.equal(h.state.trainingTimeRate, 1);
  assert.equal(h.advanceWallElapsed(60), 60);
  assert.equal(h.state.simulation.simulationSeconds, 60);
  const a=initial.aircraftList[0],b=h.state.simulation.aircraftList[0];
  assert.ok(Math.abs(Math.hypot(b.position.xNm-a.position.xNm,b.position.yNm-a.position.yNm)-4)<1e-9);
  const expected = Core.advance(Core.setLifecycle(initial, 'running'), 60);
  assert.deepEqual(h.state.simulation.aircraftList.map(aircraft => ({ position: aircraft.position, headingDeg: aircraft.headingDeg })),
    expected.aircraftList.map(aircraft => ({ position: aircraft.position, headingDeg: aircraft.headingDeg })));
});

test('training time rate scales wall time only and preserves speed, travel and turn relationships', () => {
  function turningHarness(rate, wallFrames) {
    const h = harness();
    h.state.simulation = Core.setLifecycle(h.state.simulation, 'running');
    const result = Core.applyCommand(h.state.simulation, {
      type: 'turn-to-heading', side: 'right', headingDeg: 270, aircraftId: 'AC1'
    });
    assert.equal(result.outcome.accepted, true);
    h.state.simulation = result.state;
    h.state.running = true;
    h.setTrainingTimeRate(rate);
    for (const seconds of wallFrames) h.advanceWallElapsed(seconds);
    return h;
  }
  const realtime = turningHarness(1, [1, 1, 1, 1, 1]);
  const accelerated = turningHarness(5, [1]);
  assert.equal(realtime.state.simulation.simulationSeconds, 5);
  assert.equal(accelerated.state.simulation.simulationSeconds, 5);
  const a = realtime.state.simulation.aircraftList[0];
  const b = accelerated.state.simulation.aircraftList[0];
  assert.equal(a.speedKt, 240);
  assert.equal(b.speedKt, 240);
  assert.equal(a.headingDeg, b.headingDeg);
  assert.deepEqual(a.position, b.position);

  const minute = harness();
  minute.state.simulation = Core.setLifecycle(minute.state.simulation, 'running');
  minute.setTrainingTimeRate(10);
  minute.advanceBy(60);
  assert.equal(minute.state.simulation.simulationSeconds, 60, 'Advance 1 Min is not multiplied by training time rate');
});

test('PAR designated aircraft stays fixed while control selection changes', () => {
  const h = harness();
  h.node('parRefresh').value = '1';
  const sensor = h.createSensor({ exerciseFamily: 'par', finalTrackDeg: 230, approachAircraft: 'AC2' });
  const truth = { aircraft: [
    {id: 'AC1', position: {xNm: 0, yNm: 0}, altitudeFt: 0},
    {id: 'AC2', position: {xNm: 10, yNm: -8.390996}, altitudeFt: 4000}
  ] };
  sensor.advance(1, () => truth);
  assert.ok(sensor.studentObservation().rangeNm > 12);
});

test('instructor handover replaces only the student sensor picture at the configured PAR gate', () => {
  const h = harness();
  const simulation = Core.createState({
    exerciseFamily: 'surveillance', runwayOrientationDeg: 230, finalTrackDeg: 230,
    parTransferGateNm: 10, parRefreshHz: 5,
    aircraft: [{ aircraftId: 'AC1', callsign: '101', aircraftType: 'fighter', initialQteDeg: 50,
      initialRangeNm: 9, initialHeadingDeg: 230, altitudeFt: 5000, speedKt: 180,
      rateDegPerSecond: 3, verticalRateFpm: 1000 }]
  });
  h.state.simulation = Core.setLifecycle(simulation, 'running');
  h.state.sensor = Sensors.createSurveillanceSensor({ rpm: 12, profile: 'primary', history: 3 });
  let metadata;
  h.state.session = {
    publishObservation() {}, publishCaption() {},
    updatePublicMetadata(value) { metadata = value; return value; }
  };

  h.transferSelectedToPar();

  assert.equal(h.state.simulation.scenario.exerciseFamily, 'par');
  assert.equal(h.state.simulation.scenario.parApproachAircraftId, 'AC1');
  assert.equal(h.state.simulation.aircraft.callsign, '101');
  assert.equal(h.state.sensor.refreshHz, 5);
  h.state.sensor.advance(.2, () => h.truthForSensor());
  assert.equal(h.state.sensor.studentObservation().trackState, 'tracking');
  assert.ok(Math.abs(h.state.sensor.studentObservation().rangeNm - 9) < .01);
  assert.equal(metadata.mode, 'par');
  assert.equal(metadata.approachCallsign, '101');
  assert.equal(h.node('parTransferActions').hidden, true);
  assert.match(h.node('commandStatus').textContent, /TRANSFERRED 101 TO PAR/);
});

test('shortcuts ignore editable inputs and repeated keys', () => {
  const h = harness();
  for (const extra of [{ repeat: true }, { ctrlKey: true }, { target: { closest: () => ({}) } }]) {
    let prevented = false;
    h.handleShortcut({ key: ']', target: { closest: () => null }, preventDefault() { prevented = true; }, ...extra });
    assert.equal(prevented, false);
    assert.equal(h.state.simulation.selectedAircraftId, 'AC1');
  }
});
