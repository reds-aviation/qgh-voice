'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../simulator-core.js');
const Tactical = require('../tactical-core.js');

function harness(tactical, procedure) {
  const nodes = new Map(), intervals = new Map(), timeouts = new Map();
  let timer = 0, resets = 0, receiverResets = 0, reviews = 0;
  function element(id) {
    if (!nodes.has(id)) {
      const classes = new Set();
      const node = { value: '', textContent: '', dataset: {}, hidden: false, open: false,
        setAttribute() {}, focus() {}, showModal() { this.open = true; }, close() { this.open = false; },
        classList: { contains: value => classes.has(value), add: value => classes.add(value), remove: value => classes.delete(value),
          toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value) } };
      nodes.set(id, node);
    }
    return nodes.get(id);
  }
  const context = { document: { getElementById: element }, console, QGHCore: Core, QGHTacticalCore: Tactical,
    QGHRadioSession: { createReceiver: () => ({ reset: () => { receiverResets++; } }) },
    QGHRadioWorkspace: { resetExercise: () => { resets++; } },
    setInterval: callback => { const id = ++timer; intervals.set(id, callback); return id; },
    clearInterval: id => intervals.delete(id),
    setTimeout: callback => { const id = ++timer; timeouts.set(id, callback); return id; },
    clearTimeout: id => timeouts.delete(id) };
  context.window = context; context.reviewPrepared = () => { reviews++; };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '..', tactical ? 'tactical-simulator.js' : 'simulator.js'), 'utf8');
  const boundary = source.lastIndexOf('  bindEvents();');
  assert.ok(boundary > 0);
  vm.runInContext(source.slice(0, boundary) + `
    renderDF = () => {}; updateClock = () => {}; updateReplayButton = () => {};
    prepareReview = () => window.reviewPrepared(); showToast = () => {};
    window.fixture = { state, terminate, requestTermination, confirmTermination, closeTerminationDialog, startFlightLoop, startClock };
  })();`, context);
  const state = context.fixture.state;
  state.procedure = procedure;
  const cfg = { runway: 230, inbound: 225, outbound: 65, speed: 240, rate: 3, distance: 15, type: 'fighter', callsign: '430' };
  if (tactical) {
    state.exercise = Tactical.createExercise({ ...cfg, procedure, randomizeInitial: false, random: () => .3,
      aircraft: [{ ...cfg, id: 'A', level: 10000 }, { ...cfg, id: 'B', callsign: '431', level: 11000 }] });
    state.activeAircraftId = 'A';
  } else {
    state.cfg = cfg; state.plane = { x: 10, y: 10, heading: 90 }; state.targetHeading = 90;
    state.path = [{ ...state.plane }]; element('liveSpeed').dataset.lastLogged = '240';
  }
  element(tactical ? 'tConsole' : 'console').classList.add('active');
  context.fixture.startFlightLoop(); context.fixture.startClock();
  state.dfLive = true; state.dfExpiry = context.setTimeout(() => { throw new Error('stale D/F timer survived termination'); });
  return { ...context.fixture, nodes, intervals, timeouts, counts: () => ({ resets, receiverResets, reviews }),
    plane: () => JSON.parse(JSON.stringify(tactical ? state.exercise.aircraft.map(a => a.plane) : state.plane)) };
}

for (const tactical of [false, true]) for (const procedure of ['normal', 'us']) {
  const label = `${tactical ? 'Tactical' : 'Single'} ${procedure}`;
  test(`${label} confirmed termination resets radio once and stops exercise timers`, () => {
    const h = harness(tactical, procedure);
    assert.equal(h.intervals.size, 2, 'exercise flight and clock were running');
    h.requestTermination();
    assert.equal(h.counts().resets, 0, 'opening confirmation does not terminate the radio session');
    assert.equal(h.intervals.size, 0, 'confirmation pauses flight and clock');
    h.confirmTermination();
    assert.deepEqual(h.counts(), { resets: 1, receiverResets: 1, reviews: 1 });
    assert.equal(h.state.flightTimer, null);
    assert.equal(h.state.clockRunning, false);
    assert.equal(h.state.dfLive, false);
    assert.equal(h.state.dfExpiry, null);
    assert.equal(h.timeouts.size, 0);
    assert.equal(h.nodes.get(tactical ? 'tAnalysis' : 'analysis').classList.contains('active'), true);
    assert.equal(h.state.commands.filter(c => c.type === 'TERMINATED').length, 1);
    const before = h.plane();
    for (const callback of h.intervals.values()) callback();
    assert.deepEqual(h.plane(), before, 'no surviving flight timer can move an aircraft in review');
  });
  test(`${label} cancelling termination resumes prior exercise timers without resetting radio`, () => {
    const h = harness(tactical, procedure);
    h.requestTermination();
    assert.equal(h.intervals.size, 0);
    h.closeTerminationDialog();
    assert.equal(h.intervals.size, 2);
    assert.equal(h.state.clockRunning, true);
    assert.deepEqual(h.counts(), { resets: 0, receiverResets: 0, reviews: 0 });
    assert.equal(h.state.commands.some(c => c.type === 'TERMINATED'), false);
  });
}
