'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Suite = require('../suite-core.js');

function aircraft(id, overrides = {}) {
  return {
    aircraftId: id,
    callsign: id === 'AC1' ? '101' : '102',
    aircraftType: 'fighter',
    // QTE 050 on FINAL 230 puts the aircraft nine miles before touchdown.
    initialQteDeg: 50,
    initialRangeNm: 9,
    initialHeadingDeg: 230,
    altitudeFt: 5000,
    speedKt: 180,
    rateDegPerSecond: 3,
    verticalRateFpm: 1000,
    ...overrides
  };
}

function surveillance(overrides = {}) {
  const state = Suite.createState({
    exerciseFamily: 'surveillance',
    runwayOrientationDeg: 230,
    finalTrackDeg: 230,
    parTransferGateNm: 10,
    aircraft: [aircraft('AC1'), aircraft('AC2', { initialQteDeg: 80, initialRangeNm: 16, initialHeadingDeg: 260 })],
    ...overrides
  });
  return Suite.setLifecycle(state, 'running');
}

test('surveillance transfer gate accepts an inbound selected aircraft inside the configured approach range', () => {
  const state = surveillance();
  const status = Suite.parTransferStatus(state);
  assert.deepEqual({ eligible: status.eligible, reason: status.reason, gateNm: status.gateNm },
    { eligible: true, reason: 'ready', gateNm: 10 });
  assert.ok(Math.abs(status.approachRangeNm - 9) < 1e-9);
  assert.equal(status.inbound, true);

  const transferred = Suite.transferToPar(state);
  assert.equal(transferred.outcome.accepted, true);
  assert.equal(transferred.outcome.executionStatus, 'APPLIED');
  assert.equal(transferred.outcome.readback, null);
  assert.equal(transferred.state.scenario.exerciseFamily, 'par');
  assert.equal(transferred.state.scenario.parApproachAircraftId, 'AC1');
  assert.equal(transferred.state.selectedAircraftId, 'AC1');
  assert.equal(transferred.state.aircraft, transferred.state.aircraftList[0]);
  assert.equal(transferred.state.aircraftList, state.aircraftList);
  assert.equal(transferred.state.truthTrails, state.truthTrails);
  assert.equal(transferred.state.simulationSeconds, state.simulationSeconds);
  assert.deepEqual(transferred.state.events.at(-1), {
    id: 'E000002', type: 'PAR_TRANSFERRED', timestamp: 0, revision: 2,
    aircraftId: 'AC1', fromMode: 'surveillance', toMode: 'par',
    approachRangeNm: status.approachRangeNm, radialRangeNm: status.radialRangeNm,
    headingErrorDeg: 0, gateNm: 10
  });
});

test('transfer is not available until the selected aircraft is inbound and within the configured gate', () => {
  const cases = [
    { input: { aircraft: [aircraft('AC1', { initialHeadingDeg: 50 })] }, reason: 'outbound', text: /outbound/i },
    { input: { aircraft: [aircraft('AC1', { initialRangeNm: 11 })] }, reason: 'beyond-gate', text: /enter the 10\.0 NM PAR transfer gate/i },
    { input: { aircraft: [aircraft('AC1', { initialQteDeg: 230 })] }, reason: 'past-touchdown', text: /past the touchdown/i }
  ];
  for (const { input, reason, text } of cases) {
    const state = surveillance(input);
    const status = Suite.parTransferStatus(state);
    const result = Suite.transferToPar(state);
    assert.equal(status.eligible, false);
    assert.equal(status.reason, reason);
    assert.match(status.message, text);
    assert.equal(result.outcome.accepted, false);
    assert.equal(result.state, state);
    assert.equal(result.outcome.error, status.message);
  }
});

test('gate is configurable but stays within PAR training coverage and transfer keeps the chosen aircraft', () => {
  assert.throws(() => surveillance({ parTransferGateNm: .5 }), /PAR transfer gate/);
  assert.throws(() => surveillance({ parTransferGateNm: 20.1 }), /PAR transfer gate/);
  const state = surveillance({ parTransferGateNm: 8, selectedAircraftId: 'AC2', aircraft: [
    aircraft('AC1', { initialRangeNm: 12 }), aircraft('AC2', { initialQteDeg: 50, initialRangeNm: 8, initialHeadingDeg: 230 })
  ] });
  assert.equal(Suite.parTransferStatus(state).eligible, true);
  const transferred = Suite.transferToPar(state);
  assert.equal(transferred.state.selectedAircraftId, 'AC2');
  assert.equal(transferred.state.scenario.parApproachAircraftId, 'AC2');
  assert.equal(transferred.state.scenario.parTransferGateNm, 8);
});

test('standalone PAR configuration remains a PAR exercise and cannot be transferred again', () => {
  const direct = Suite.setLifecycle(Suite.createState({
    exerciseFamily: 'par', runwayOrientationDeg: 230, finalTrackDeg: 230,
    parRefreshHz: 5, approachAircraft: 'AC2', aircraft: [aircraft('AC1'), aircraft('AC2')]
  }), 'running');
  assert.equal(direct.scenario.exerciseFamily, 'par');
  assert.equal(direct.scenario.parApproachAircraftId, 'AC2');
  assert.equal(direct.scenario.parRefreshHz, 5);
  const status = Suite.parTransferStatus(direct);
  assert.equal(status.reason, 'not-surveillance');
  assert.equal(Suite.transferToPar(direct).outcome.accepted, false);
});
