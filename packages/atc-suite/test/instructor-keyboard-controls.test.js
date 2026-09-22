const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const Core = require('../suite-core.js');
const Sensors = require('../suite-sensors.js');

function harness(options = {}) {
  const nodes = new Map();
  const values = {
    trainingTimeRate: '5', turnHeadingInput: '230', liveSpeed: '240', altitudeInput: '10000',
    keyboardCommandInput: '', parRefresh: '1', scanPreset: '12', radarProfile: 'primary',
    procedureType: 'normal', exerciseFamily: 'qgh', parTransferGate: '10'
  };
  const canvasContext = new Proxy({}, { get(target, key) { return target[key] || (() => {}); } });
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { value: values[id] || '0', textContent: '', hidden: false, disabled: false,
      open: false, children: [], dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
      replaceChildren(...children) { this.children = children; }, append(child) { this.children.push(child); }, prepend(child) { this.children.unshift(child); },
      getContext() { return canvasContext; }, width: 900, height: 700, addEventListener() {}, setAttribute() {}, closest() { return null; } });
    return nodes.get(id);
  }
  const document = { getElementById: node, querySelectorAll() { return []; }, createElement() { return node(`created-${nodes.size}`); } };
  let source = readFileSync(join(__dirname, '../suite-instructor.js'), 'utf8');
  source = source.slice(0, source.indexOf("  family.addEventListener('change'")) +
    '\n globalThis.fixture = { state, parseKeyboardCommand, performInstructorAction, executeKeyboardCommand, handleShortcut, selectAircraft };})();';
  const context = { document, ATCSuiteCore: Core, ATCSuiteSensors: Sensors, ATCSuiteSession: {},
    setTimeout() { return 1; }, clearTimeout() {}, performance: { now: () => 0 }, console };
  vm.runInNewContext(source, context);
  const aircraft = [
    { aircraftId: 'AC1', callsign: '101', initialQteDeg: 30, initialRangeNm: 20, initialHeadingDeg: 210, altitudeFt: 10000, speedKt: 240, rateDegPerSecond: 3 },
    { aircraftId: 'AC2', callsign: '102', initialQteDeg: 80, initialRangeNm: 24, initialHeadingDeg: 150, altitudeFt: 11000, speedKt: 260, rateDegPerSecond: 3 }
  ];
  const scenario = { aircraft, runwayOrientationDeg: 230, finalTrackDeg: 230, ...options.scenario };
  context.fixture.state.simulation = Core.setLifecycle(Core.createState(scenario), options.lifecycle || 'running');
  context.fixture.state.sensor = Sensors.createDfSensor({ holdSeconds: 2 });
  context.fixture.state.review = Sensors.createReviewTimeline();
  context.fixture.state.session = { publishObservation() {}, publishCaption() {}, start() { return true; }, pause() {}, resume() {} };
  return { ...context.fixture, node };
}

test('command bar accepts only its deterministic documented grammar', () => {
  const h = harness();
  assert.equal(h.parseKeyboardCommand(' L 230 ').action, 'turn-heading');
  assert.equal(h.parseKeyboardCommand('L 230').headingDeg, 230);
  assert.equal(h.parseKeyboardCommand('RIGHT 005').side, 'right');
  assert.equal(h.parseKeyboardCommand('TURN LEFT HEADING 230').action, 'turn-heading');
  assert.equal(h.parseKeyboardCommand('SPD 240').action, 'set-speed');
  assert.equal(h.parseKeyboardCommand('ALT 7000').action, 'set-altitude');
  assert.equal(h.parseKeyboardCommand('CLIMB TO 12000').verticalMode, 'climb');
  assert.equal(h.parseKeyboardCommand('DESCEND 7000').verticalMode, 'descend');
  assert.equal(h.parseKeyboardCommand('TRANSMIT FOR D/F').action, 'transmit');
  assert.equal(h.parseKeyboardCommand('transfer par').action, 'transfer-par');
  assert.equal(h.parseKeyboardCommand('turn right when ready').accepted, false);
  assert.equal(h.parseKeyboardCommand('L 360').headingDeg, 360, 'range is rejected by execution validation, not coerced');
});

test('instructor page exposes an accessible command bar and its safe shortcut reference', () => {
  const page = readFileSync(join(__dirname, '../instructor.html'), 'utf8');
  assert.match(page, /id="keyboardCommandInput"/);
  assert.match(page, /id="executeKeyboardCommand"/);
  assert.match(page, /id="keyboardShortcuts"/);
  assert.match(page, /Termination remains a deliberate button action/);
  assert.match(page, /TRANSFER PAR/);
});

test('typed commands apply only to the selected aircraft and preserve direct-control physics', () => {
  const h = harness();
  h.selectAircraft('AC2');
  const turn = h.executeKeyboardCommand('L 230');
  assert.equal(turn.accepted, true);
  assert.equal(h.state.simulation.selectedAircraftId, 'AC2');
  assert.equal(h.state.simulation.aircraftList[1].turn.targetHeadingDeg, 230);
  assert.equal(h.state.simulation.aircraftList[0].turn.mode, 'straight');

  const speed = h.executeKeyboardCommand('SPD 300');
  assert.equal(speed.accepted, true);
  assert.equal(h.state.simulation.aircraftList[1].speedKt, 300);
  assert.equal(h.executeKeyboardCommand('SPD 301').accepted, false);

  const altitude = h.executeKeyboardCommand('ALT 7000');
  assert.equal(altitude.accepted, true);
  assert.equal(h.state.simulation.aircraftList[1].vertical.targetAltitudeFt, 7000);
  assert.equal(h.executeKeyboardCommand('ALT 7050').accepted, false);
  assert.equal(h.executeKeyboardCommand('DESCEND 6000').accepted, true);
  assert.equal(h.executeKeyboardCommand('CLIMB 5000').accepted, false, 'explicit climb direction cannot silently reverse into a descent');
});

test('U/S command bar forbids heading turns and permits immediate independent NOW / STOP controls', () => {
  const h = harness({ scenario: { qghProcedure: 'us' } });
  assert.equal(h.executeKeyboardCommand('L 230').accepted, false);
  const left = h.executeKeyboardCommand('LEFT NOW');
  assert.equal(left.accepted, true);
  assert.equal(h.state.simulation.aircraft.turn.mode, 'timed');
  assert.equal(h.state.simulation.aircraft.turn.side, 'left');
  const stop = h.executeKeyboardCommand('STOP');
  assert.equal(stop.accepted, true);
  assert.equal(h.state.simulation.aircraft.turn.mode, 'straight');
});

test('global shortcuts never run while an editable field is active, repeated, or modified', () => {
  const h = harness();
  const before = h.state.simulation;
  for (const extra of [
    { target: { closest: () => ({}) } }, { repeat: true, target: { closest: () => null } },
    { ctrlKey: true, target: { closest: () => null } }, { isComposing: true, target: { closest: () => null } },
    { target: { closest: selector => selector.includes('button') ? {} : null } }
  ]) {
    let prevented = false;
    h.handleShortcut({ key: 'a', preventDefault() { prevented = true; }, ...extra });
    assert.equal(prevented, false);
    assert.equal(h.state.simulation, before);
  }
  let prevented = false;
  h.handleShortcut({ key: 'a', target: { closest: () => null }, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.state.simulation.aircraft.turn.targetHeadingDeg, 230);
});

test('shortcut and command-bar lifecycle gates prevent inactive exercise mutation', () => {
  const h = harness({ lifecycle: 'ready' });
  const before = h.state.simulation;
  assert.equal(h.executeKeyboardCommand('ADVANCE').accepted, false);
  assert.equal(h.state.simulation, before);
  let prevented = false;
  h.handleShortcut({ key: 'g', target: { closest: () => null }, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.state.simulation, before);
  assert.equal(h.executeKeyboardCommand('START').accepted, true);
  assert.equal(h.state.simulation.lifecycle, 'running');
});
