const test = require('node:test');
const assert = require('node:assert/strict');

const Core = require('../suite-core.js');
const Sensors = require('../suite-sensors.js');

function random(seed) {
  let value = seed >>> 0;
  return () => ((value = Math.imul(1664525, value) + 1013904223 >>> 0) / 2 ** 32);
}

function scenario(mode, index) {
  const rng = random(index + mode.length * 997);
  const input = {
    exerciseFamily: mode,
    qghProcedure: index % 2 ? 'normal' : 'us',
    callsign: String(100 + index),
    initialQteDeg: Math.floor(rng() * 360),
    initialRangeNm: 8 + rng() * 42,
    initialHeadingDeg: Math.floor(rng() * 360),
    altitudeFt: 6000 + Math.floor(rng() * 120) * 100,
    speedKt: 120 + Math.floor(rng() * 300),
    rateDegPerSecond: 1.5 + rng() * 3,
    runwayOrientationDeg: Math.floor(rng() * 360),
    finalTrackDeg: Math.floor(rng() * 360),
    surveillanceProfile: index % 3 ? 'primary' : 'correlated'
  };
  let state = Core.setLifecycle(Core.createState(input), 'running');
  const turn = mode === 'qgh' && input.qghProcedure === 'us'
    ? { type: 'turn-now', side: index % 2 ? 'left' : 'right' }
    : { type: 'turn-to-heading', side: index % 2 ? 'left' : 'right', headingDeg: Math.floor(rng() * 360) };
  const outcome = Core.applyCommand(state, turn);
  assert.equal(outcome.outcome.accepted, true);
  state = Core.advance(outcome.state, 60);
  if (mode === 'qgh' && input.qghProcedure === 'us') state = Core.applyCommand(state, { type: 'stop-turn' }).state;
  return state;
}

for (const mode of ['qgh', 'surveillance', 'sra', 'par']) {
  test(`${mode} preserves finite state, ordered events and safe projections across 20 seeded exercises`, () => {
    for (let index = 1; index <= 20; index += 1) {
      const state = scenario(mode, index);
      const snapshot = Core.truthSnapshot(state);
      assert.ok(Number.isFinite(snapshot.aircraft.position.xNm));
      assert.ok(Number.isFinite(snapshot.aircraft.position.yNm));
      assert.ok(snapshot.aircraft.headingDeg >= 0 && snapshot.aircraft.headingDeg < 360);
      assert.ok(snapshot.aircraft.altitudeFt >= 0 && snapshot.aircraft.altitudeFt <= 45000);
      for (let eventIndex = 1; eventIndex < state.events.length; eventIndex += 1) {
        assert.ok(state.events[eventIndex].timestamp >= state.events[eventIndex - 1].timestamp);
      }
      let observation;
      if (mode === 'qgh') {
        const sensor = Sensors.createDfSensor();
        sensor.beginTransmission({ source: snapshot.aircraft.id }, snapshot, snapshot.simulationSeconds);
        observation = sensor.studentObservation('qdm', snapshot.simulationSeconds, snapshot);
      } else if (mode === 'par') {
        const sensor = Sensors.createParSensor({ startSeconds: 0, refreshHz: 1, runwayHeadingDeg: state.scenario.finalTrackDeg });
        sensor.advance(snapshot.simulationSeconds, snapshot);
        observation = sensor.studentObservation();
      } else {
        const sensor = Sensors.createSurveillanceSensor({ startSeconds: 0, rpm: 12,
          profile: state.scenario.surveillanceProfile, sra: mode === 'sra' });
        sensor.advance(snapshot.simulationSeconds, snapshot);
        observation = sensor.studentObservation(mode === 'sra'
          ? Sensors.createSraReferences({ runwayHeadingDeg: state.scenario.finalTrackDeg }) : undefined);
      }
      const envelope = Core.studentEnvelope(state, observation);
      const serialized = JSON.stringify(envelope).toLowerCase();
      for (const forbidden of ['"xnm"', '"ynm"', '"headingdeg"', '"truthtrail"', '"controlstate"']) {
        assert.equal(serialized.includes(forbidden), false, forbidden);
      }
    }
  });
}
