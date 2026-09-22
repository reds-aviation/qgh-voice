'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Core = require('../suite-core.js');
const Sensors = require('../suite-sensors.js');
const Session = require('../suite-session.js');

function configuredState(profile = 'correlated') {
  return Core.createState({
    exerciseFamily: 'sra', qghProcedure: 'normal', surveillanceProfile: profile,
    runwayOrientationDeg: 230, finalTrackDeg: 50,
    radarEnvironment: {
      runwayOrientationDeg: 230, extendedCentreline: true, extendedCentrelineNm: 20,
      centrelineTickNm: 5, sraDescentProfile: true,
      lfaBoundary: [{ bearingDeg: 10, rangeNm: 12 }, { qteDeg: 95, rangeNm: 16 }, { bearingDeg: 220, rangeNm: 14 }]
    },
    aircraft: [{
      aircraftId: 'AC1', callsign: '431', aircraftType: 'fighter', initialQteDeg: 90,
      initialRangeNm: 12, initialHeadingDeg: 50, altitudeFt: 12000, speedKt: 240, rateDegPerSecond: 3,
      surveillance: { secondary: true, modeS: true, squawk: '4301', modeSId: 'A1B2C3' }
    }]
  });
}

test('correlated training projects explicitly configured environment and cooperative metadata without truth', () => {
  const state = configuredState();
  const sensor = Sensors.createSurveillanceSensor({ rpm: 12, profile: 'correlated', sra: true, history: 3 });
  sensor.advance(5.01, { aircraft: state.aircraftList });
  const observation = sensor.studentObservation({ runwayOrientationDeg: 230, centrelineDeg: 50, terminationRangeNm: .5 });
  // The sensor supplies only sampled return data. A later track sample may
  // add these two correlated values; this fixture exercises the safe
  // projection boundary independently of hidden aircraft truth.
  const correlatedObservation = {
    ...observation,
    plot: { ...observation.plot, headingDeg: 50, groundSpeedKt: 240 },
    plots: observation.plots.map(plot => ({ ...plot, headingDeg: 50, groundSpeedKt: 240 }))
  };
  assert.deepEqual(observation.plots[0].surveillance, { secondary: true, modeS: true, squawk: '4301', modeSId: 'A1B2C3' });

  const envelope = Core.studentEnvelope(state, correlatedObservation);
  assert.equal(envelope.publicScenario.radarEnvironment.runwayOrientationDeg, 230);
  assert.deepEqual(envelope.publicScenario.radarEnvironment.lfaBoundary[1], { bearingDeg: 95, rangeNm: 16 });
  assert.equal(envelope.publicScenario.approachSpeedKt, 240);
  assert.equal(envelope.publicScenario.approachAircraftType, 'fighter');
  assert.deepEqual(envelope.observation.plots[0].surveillance, observation.plots[0].surveillance);
  assert.equal(envelope.observation.plots[0].headingDeg, 50);
  assert.equal(envelope.observation.plots[0].groundSpeedKt, 240);
  assert.doesNotMatch(JSON.stringify(envelope), /xNm|yNm|position|truthTrail/);

  const wire = Session.sanitizeStudentObservation({ mode: 'sra', ...correlatedObservation }, { profile: 'correlated-training' });
  const metadata = Session.sanitizePublicMetadata({ mode: 'sra', radarProfile: 'correlated-training',
    approachSpeedKt: 240, approachAircraftType: 'fighter', radarEnvironment: envelope.publicScenario.radarEnvironment });
  assert.deepEqual(wire.plots[0].surveillance, envelope.observation.plots[0].surveillance);
  assert.deepEqual(metadata.radarEnvironment, envelope.publicScenario.radarEnvironment);
});

test('primary-only projection strips cooperative metadata while retaining an unidentifying return', () => {
  const state = configuredState('primary');
  const observation = {
    plots: [{ trackId: 'T1', timestamp: 5, rangeNm: 12, azimuthDeg: 90, callsign: '431', altitudeFt: 12000, headingDeg: 230, groundSpeedKt: 240,
      surveillance: { secondary: true, modeS: true, squawk: '4301', modeSId: 'A1B2C3' } }]
  };
  const envelope = Core.studentEnvelope(state, observation);
  assert.deepEqual(envelope.observation.plots, [{ trackId: 'T1', timestamp: 5, rangeNm: 12, azimuthDeg: 90 }]);
  assert.doesNotMatch(JSON.stringify(envelope), /4301|A1B2C3|callsign|altitude|headingDeg|groundSpeedKt/);
});

test('a primary exercise retains its instructor transponder code without projecting it to the student', () => {
  const state = Core.createState({
    exerciseFamily: 'surveillance', qghProcedure: 'normal', surveillanceProfile: 'primary',
    runwayOrientationDeg: 230, finalTrackDeg: 50,
    aircraft: [{ aircraftId: 'AC1', callsign: '431', initialQteDeg: 90, initialRangeNm: 12,
      initialHeadingDeg: 50, altitudeFt: 12000, speedKt: 240, rateDegPerSecond: 3, transponderCode: '4301' }]
  });
  assert.equal(state.aircraftList[0].transponderCode, '4301');
  assert.equal(state.aircraftList[0].surveillance, undefined);
  const envelope = Core.studentEnvelope(state, { plots: [{ trackId: 'T1', timestamp: 5, rangeNm: 12, azimuthDeg: 90 }] });
  assert.doesNotMatch(JSON.stringify(envelope), /4301|transponderCode/);
});

test('environment and surveillance validators reject malformed training configuration', () => {
  assert.throws(() => Core.createState({
    exerciseFamily: 'surveillance', qghProcedure: 'normal', runwayOrientationDeg: 230, finalTrackDeg: 50,
    radarEnvironment: { lfaBoundary: [{ bearingDeg: 1, rangeNm: 1 }, { bearingDeg: 2, rangeNm: 2 }] },
    callsign: '431', initialQteDeg: 90, initialRangeNm: 12, initialHeadingDeg: 50,
    altitudeFt: 12000, speedKt: 240, rateDegPerSecond: 3
  }), /LFA boundary/);
  assert.throws(() => Session.sanitizePublicMetadata({ mode: 'surveillance',
    radarEnvironment: { extendedCentrelineNm: 10, lfaBoundary: [{ bearingDeg: 0, rangeNm: 1 }, { bearingDeg: 90, rangeNm: 1 }] } }), /invalid-lfaBoundary/);
  assert.throws(() => Session.sanitizeStudentObservation({ mode: 'surveillance', plots: [{ rangeNm: 12, azimuthDeg: 90,
    surveillance: { squawk: '8989' } }] }, { profile: 'correlated-training' }), /invalid-surveillance-squawk/);
});
