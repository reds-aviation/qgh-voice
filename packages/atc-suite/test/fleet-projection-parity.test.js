const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../suite-core.js');
const Sensors = require('../suite-sensors.js');
const Session = require('../suite-session.js');

function fleet(mode, profile = 'primary') {
  return Core.createState({ exerciseFamily: mode, qghProcedure: 'normal',
    runwayOrientationDeg: 230, finalTrackDeg: 230, surveillanceProfile: profile,
    aircraft: Array.from({ length: 24 }, (_, index) => ({ aircraftId: `AC${index + 1}`,
      callsign: String(101 + index), initialQteDeg: (index * 15 + 3) % 360, initialRangeNm: 20 + index,
      initialHeadingDeg: 230, altitudeFt: 4000 + index * 1000, speedKt: 240, rateDegPerSecond: 3 })) });
}

test('core and session public fleet projections preserve measured plots and bounded history', () => {
  for (const profile of ['primary', 'correlated']) {
    const state = fleet('surveillance', profile);
    const sensor = Sensors.createSurveillanceSensor({ profile, history: 5 });
    sensor.advance(31, { aircraft: state.aircraftList });
    const observation = sensor.studentObservation();
    const core = Core.studentEnvelope(state, observation).observation;
    const wire = Session.sanitizeStudentObservation({ mode: 'surveillance', ...observation }, { profile });
    assert.equal(core.plots.length, 24);
    assert.equal(core.history.length, 120);
    assert.deepEqual(core.plots, wire.plots);
    assert.deepEqual(core.history, wire.history);
    assert.doesNotMatch(JSON.stringify(core), /headingDeg|xNm|yNm|truthTrail/);
  }
});

test('core DF projection retains the actual transmitting aircraft rather than control selection', () => {
  const state = fleet('qgh');
  const sensor = Sensors.createDfSensor();
  sensor.beginTransmission({ source: 'AC24' }, { aircraft: state.aircraftList }, 0);
  const projected = Core.studentEnvelope(state, sensor.studentObservation('qdm', 0)).observation;
  assert.equal(projected.callsign, '124');
});
