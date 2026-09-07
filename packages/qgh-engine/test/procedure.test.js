'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../procedure-core.js');
const I = require('../procedure-intent.js');
const V = require('../voice-control.js');
const make = (fleet = [{ id: 'single', callsign: '430', level: 15000 }], environment) => P.create({ aircraft: fleet, environment });
const parse = text => I.parse(text, { single: true, callsigns: [{ id: 'single', callsign: '430' }] }, V);
const command = (state, text, context) => { const plan = parse(text); assert.equal(plan?.accepted, true, JSON.stringify(plan)); return P.apply(state, plan, context); };

test('RT structured briefing stores exact mandatory items atomically and weather never changes the path', () => {
  const state = make();
  const result = command(state, '430 runway in use two three left surface wind two three zero degrees ten knots qnh nine one eight squawk four one zero zero');
  assert.equal(result.authorization, 'AUTHORIZED'); assert.equal(state.environment.runway, '23L');
  assert.equal(state.environment.qnhHpa, 918); assert.equal(state.aircraft.single.squawk, '4100');
  assert.equal(state.environment.weather.windSpeedKt, 10);
  assert.equal(state.aircraft.single.actualAltitudeMslFt, 15000);
  assert.match(result.response.text, /QNH 918 HECTOPASCALS SET/); assert.doesNotMatch(result.response.text, /230.*10/);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.response));
  const before = JSON.stringify(state.environment);
  const invalid = command(state, 'runway in use two three qnh eight hundred squawk four one zero zero');
  assert.equal(invalid.authorization, 'REJECTED'); assert.equal(JSON.stringify(state.environment), before);
});
test('numeric routing, correction, units and ambiguity preserve zero-mutation rejection', () => {
  for (const text of ['squawk 7182', 'squawk 410', 'qnh 1013 inches', 'climb 120', 'climb altitude 18000 feet if required', 'qnh 1013 turn right 220']) {
    assert.equal(parse(text)?.accepted, false, text);
  }
  assert.equal(parse('430 squawk four one zero zero').aircraft, 'single');
  assert.equal(parse('431 squawk four one zero zero').accepted, false);
  assert.equal(I.parse('report level', { single: false }, V).accepted, false);
  const state = make(); command(state, 'qnh nine one eight correction one zero one three');
  assert.equal(state.environment.qnhHpa, 1013);
  const before = state.aircraft.single.actualAltitudeMslFt;
  const wait = command(state, 'stand by to commence descent');
  assert.equal(wait.executionStatus, 'DEFERRED'); P.step(state, 60); assert.equal(state.aircraft.single.actualAltitudeMslFt, before);
});
test('vertical clearances move continuously, clamp and report reaching once', () => {
  const state = make();
  command(state, 'descend to altitude fourteen thousand feet report reaching');
  assert.equal(state.aircraft.single.verticalMode, 'DESCENT');
  P.step(state, 30); assert.equal(state.aircraft.single.actualAltitudeMslFt, 14500);
  assert.match(command(state, 'report level').response.text, /PASSING ALTITUDE 14500 FEET, DESCENDING TO ALTITUDE 14000/);
  const events = P.step(state, 60);
  assert.equal(events.length, 1); assert.equal(events[0].timestamp, 60);
  assert.equal(state.aircraft.single.actualAltitudeMslFt, 14000); assert.equal(state.aircraft.single.verticalMode, 'LEVEL');
  assert.equal(P.step(state, 60).length, 0);
});
test('passing reports cross multiple targets chronologically over an advance, with no target change', () => {
  const state = make(); command(state, 'descend altitude 12000 feet');
  command(state, 'report passing altitude 14500 feet'); command(state, 'report passing altitude 14000 feet');
  const reports = P.step(state, 90);
  assert.deepEqual(reports.map(r => r.timestamp), [30, 60]); assert.equal(state.aircraft.single.clearedAltitudeMslFt, 12000);
  command(state, 'stop descent now'); const stopped = state.aircraft.single.actualAltitudeMslFt;
  P.step(state, 60); assert.equal(state.aircraft.single.actualAltitudeMslFt, stopped);
});
test('pressure reference changes preserve position and target conversion across datums', () => {
  const state = make(undefined, { aerodromeElevationFt: 1000, qnhHpa: 1000 });
  const a = state.aircraft.single;
  assert.equal(P.toMsl({ datum: 'STANDARD', value: 150 }, state.environment), 14642.25);
  assert.equal(P.toMsl({ datum: 'QFE', value: 3000 }, state.environment), 4000);
  command(state, 'set qfe nine nine eight'); assert.equal(state.aircraft.single.actualAltitudeMslFt, a.actualAltitudeMslFt);
  assert.equal(P.displayedLevel(state.aircraft.single, state.environment).value, 14000);
  command(state, 'descend flight level one two zero'); assert.equal(state.aircraft.single.clearedAltitudeMslFt, 11642.25);
});
test('formation follows vertical delta, individual conflicts require explicit confirmation', () => {
  const state = make([{ id: 'single', callsign: '430', level: 15000 }, { id: 'B', callsign: '431', level: 16000 }]);
  command(state, 'climb altitude 17000 feet', { attachedIds: ['B'] });
  P.step(state, 60, { B: 'single' }); assert.equal(state.aircraft.B.actualAltitudeMslFt - state.aircraft.single.actualAltitudeMslFt, 1000);
  const plan = { aircraft: 'B', actions: [{ type: 'vertical', direction: 'DESCENT', target: { datum: 'QNH', value: 16000 } }] };
  const before = state.aircraft.B.actualAltitudeMslFt;
  assert.equal(P.apply(state, plan, { follower: true }).requiresSeparationConfirmation, true);
  assert.equal(state.aircraft.B.actualAltitudeMslFt, before);
  assert.equal(P.apply(state, plan, { follower: true, confirmSeparation: true }).detach, true);
});
test('visual calls evaluate range, level, phase, heading, weather and latched override separately', () => {
  const state = make([{ id: 'single', callsign: '430', level: 2000 }]); const a = state.aircraft.single;
  const geometry = { range: 1, phase: 'inbound', heading: 225, inbound: 225 };
  assert.equal(P.visual(a, state.environment, geometry, 'runway'), true);
  for (const bad of [{ range: 3 }, { phase: 'outbound' }, { heading: 65 }]) assert.equal(P.visual(a, state.environment, { ...geometry, ...bad }, 'runway'), false);
  state.environment.weather.visibilityM = 500; assert.equal(P.visual(a, state.environment, geometry, 'runway'), false);
  state.environment.weather.visibilityM = 10000; a.visualOverride = 'NOT_VISUAL';
  assert.equal(P.visual(a, state.environment, geometry, 'runway'), false);
});
test('overhead needs two distinct qualifying transmissions and expiry resets evidence', () => {
  const state = make(); const sample = { range: .1, qte: null, overhead: true };
  assert.equal(P.observeOverhead(state, 'single', sample, 1), false);
  assert.equal(P.observeOverhead(state, 'single', sample, 1), false);
  assert.equal(P.observeOverhead(state, 'single', sample, 2), true);
  P.observeOverhead(state, 'single', sample, 3); P.step(state, 61);
  assert.equal(P.observeOverhead(state, 'single', sample, 4), false);
});
test('migration preserves original data on failure', () => {
  const input = { schemaVersion: 99, important: 'retain' };
  assert.equal(P.migrate(input).ok, false); assert.equal(input.important, 'retain');
});
test('domain rejects invalid references and mixed action plans without hidden partial movement', () => {
  const state = make();
  for (const actions of [
    [{ type: 'vertical', direction: 'DESCENT', target: { datum: 'BOGUS', value: 9000 } }],
    [{ type: 'vertical', direction: 'DESCENT', target: { datum: 'QNH', value: 9000 } }, { type: 'unsupported' }]
  ]) {
    assert.equal(P.apply(state, { aircraft: 'single', actions }).authorization, 'REJECTED');
    assert.equal(state.aircraft.single.verticalMode, 'LEVEL');
  }
  assert.equal(parse('qnh 1000 squawk 1234 correction squawk 1235').accepted, false);
  state.aircraft.single.clearedAltitudeMslFt = 'bad'; assert.equal(P.migrate(state).ok, false);
});
test('negative temperature, explicit report datum and numeric step preserve values', () => {
  const state = make([{ id: 'single', callsign: '430', level: 5000 }], { aerodromeElevationFt: 1000 });
  for (const temperature of ['-5', '−5', 'minus five']) {
    command(state, `temperature ${temperature} degrees celsius`); assert.equal(state.environment.weather.temperatureC, -5);
  }
  assert.match(command(state, 'report height').response.text, /HEIGHT 4000/);
  assert.match(command(state, 'report flight level').response.text, /FLIGHT LEVEL 050/);
  P.step(state, '1'); assert.equal(state.simulationSeconds, 1);
});
