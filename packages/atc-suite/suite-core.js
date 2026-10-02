(function exposeAtcSuiteCore(root, factory) {
  const flightCore = typeof module === 'object' && module.exports
    ? require('../qgh-engine/simulator-core.js')
    : root.QGHCore;
  const api = factory(flightCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ATCSuiteCore = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function createAtcSuiteCore(Flight) {
  'use strict';

  if (!Flight) throw new Error('QGH flight core failed to load.');

  const SCHEMA_VERSION = 1;
  const STEP_SECONDS = .25;
  const MAX_AIRCRAFT = 24;
  const MAX_QGH_AIRCRAFT = 2;
  const FAMILIES = new Set(['qgh', 'surveillance', 'sra', 'par']);
  const QGH_PROCEDURES = new Set(['normal', 'us']);
  const TURN_SIDES = new Set(['left', 'right']);
  const SURVEILLANCE_PROFILES = new Set(['primary', 'correlated']);
  const LIFECYCLES = new Set(['configuring', 'ready', 'running', 'paused', 'review', 'ended']);
  // A training-only handover gate.  It is bounded to the PAR sensor's declared
  // 20 NM coverage and must not be read as an operational equipment limit.
  const PAR_TRANSFER_GATE_MIN_NM = 1;
  const PAR_TRANSFER_GATE_MAX_NM = 20;
  const PAR_TRAINING_MAX_RANGE_NM = 20;
  const PAR_REFRESH_HZ = new Set([1, 5]);
  const EPSILON = 1e-9;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }

  function finite(value, label) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) throw new Error(label + ' must be a finite number.');
    return numeric;
  }

  function bounded(value, minimum, maximum, label) {
    const numeric = finite(value, label);
    if (numeric < minimum || numeric > maximum) {
      throw new Error(label + ' must be from ' + minimum + ' to ' + maximum + '.');
    }
    return numeric;
  }

  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function degrees(value, label) {
    return Flight.normalize(bounded(value, 0, 359, label));
  }

  function padHeading(value) {
    return String(Math.round(Flight.normalize(value))).padStart(3, '0');
  }

  function normalizeCallsign(value) {
    const normalized = String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
    if (!normalized) throw new Error('Aircraft callsign is required.');
    if (normalized.length > 20) throw new Error('Callsigns must be 20 characters or fewer.');
    if (/^\d+$/.test(normalized) && !/^[1-9]\d{2}$/.test(normalized)) {
      throw new Error('Numeric callsigns must be from 100 to 999.');
    }
    if (!/^[A-Z0-9][A-Z0-9 -]*$/.test(normalized)) throw new Error('Callsign contains unsupported characters.');
    return normalized;
  }

  // This is deliberately a small training representation of cooperative
  // surveillance. It models the display-relevant availability of an SSR reply,
  // a Mode S indication, and an optional Mode A code; it is not avionics data.
  function normalizeSurveillance(value) {
    if (value == null) return null;
    if (!isPlainObject(value)) throw new Error('Surveillance metadata must be an object.');
    for (const key of ['secondary', 'modeS']) {
      if (value[key] != null && typeof value[key] !== 'boolean') {
        throw new Error(`${key} surveillance metadata must be true or false.`);
      }
    }
    let squawk = null;
    if (value.squawk != null) {
      squawk = String(value.squawk).trim();
      if (!/^[0-7]{4}$/.test(squawk)) throw new Error('Squawk must contain four octal digits.');
    }
    let modeSId = null;
    if (value.modeSId != null) {
      modeSId = String(value.modeSId).trim().toUpperCase();
      if (!/^[0-9A-F]{6}$/.test(modeSId)) throw new Error('Mode S ID must contain six hexadecimal characters.');
    }
    const modeS = value.modeS === true;
    // A Mode S reply or a valid Mode A code is necessarily a cooperative
    // (secondary) response in this training model.
    const secondary = value.secondary === true || modeS || squawk != null || modeSId != null;
    return secondary ? freeze({ secondary: true, ...(modeS || modeSId != null ? { modeS: true } : {}), ...(squawk ? { squawk } : {}), ...(modeSId ? { modeSId } : {}) }) : null;
  }

  // A roster code is instructor-owned configuration. It is deliberately
  // separate from an SSR reply: a primary-only exercise may retain a code in
  // the instructor truth picture while the controller's student display sees
  // only anonymous primary plots.
  function normalizeTransponderCode(value) {
    if (value == null || value === '') return null;
    const code = String(value).trim();
    if (!/^[0-7]{4}$/.test(code)) throw new Error('Transponder code must contain four octal digits.');
    return code;
  }

  // Optional, scenario-local display configuration. Bearings and ranges are
  // relative to the simulated station; this intentionally has no real-world
  // location field. Shape:
  // { runwayOrientationDeg, extendedCentreline, extendedCentrelineNm,
  //   centrelineTickNm, lfaBoundary:[{ bearingDeg | qteDeg, rangeNm }],
  //   sraDescentProfile }
  function normalizeRadarEnvironment(value, fallbackRunwayOrientationDeg) {
    if (value == null) return null;
    if (!isPlainObject(value)) throw new Error('Radar environment must be an object.');
    for (const key of ['extendedCentreline', 'sraDescentProfile']) {
      if (value[key] != null && typeof value[key] !== 'boolean') {
        throw new Error(`${key} radar environment setting must be true or false.`);
      }
    }
    const extendedCentrelineNm = value.extendedCentrelineNm == null ? 20
      : bounded(value.extendedCentrelineNm, 0, 100, 'Extended centreline range');
    const centrelineTickNm = value.centrelineTickNm == null ? 2
      : bounded(value.centrelineTickNm, .5, 20, 'Centreline tick interval');
    const runwayOrientationDeg = value.runwayOrientationDeg == null ? fallbackRunwayOrientationDeg
      : degrees(value.runwayOrientationDeg, 'Radar environment runway orientation');
    const lfaBoundary = value.lfaBoundary == null ? [] : value.lfaBoundary;
    if (!Array.isArray(lfaBoundary) || lfaBoundary.length > 12 || (lfaBoundary.length && lfaBoundary.length < 3)) {
      throw new Error('LFA boundary must contain either zero or three to twelve points.');
    }
    const points = lfaBoundary.map((point, index) => {
      if (!isPlainObject(point)) throw new Error(`LFA boundary point ${index + 1} must be an object.`);
      const bearing = point.bearingDeg ?? point.qteDeg;
      return freeze({
        bearingDeg: degrees(bearing, `LFA boundary point ${index + 1} bearing`),
        rangeNm: bounded(point.rangeNm, 0, 100, `LFA boundary point ${index + 1} range`)
      });
    });
    const extendedCentreline = value.extendedCentreline === true
      || (value.extendedCentreline == null && value.extendedCentrelineNm != null);
    return freeze({
      runwayOrientationDeg,
      extendedCentreline,
      extendedCentrelineNm,
      centrelineTickNm,
      lfaBoundary: points,
      sraDescentProfile: value.sraDescentProfile !== false
    });
  }

  function bearingFromPosition(position) {
    const rangeNm = Math.hypot(position.xNm, position.yNm);
    const qteDeg = Flight.normalize(Math.atan2(position.xNm, -position.yNm) * 180 / Math.PI);
    return { rangeNm, qteDeg, qdmDeg: Flight.normalize(qteDeg + 180) };
  }

  function positionFromBearing(qteDeg, rangeNm) {
    const angle = Flight.radians(qteDeg);
    return {
      xNm: Math.sin(angle) * rangeNm,
      yNm: -Math.cos(angle) * rangeNm
    };
  }

  function signedHeadingDelta(from, to) {
    return Flight.normalize(to - from + 180) - 180;
  }

  function approachGeometry(aircraft, finalTrackDeg) {
    const heading = Flight.radians(finalTrackDeg);
    const dx = aircraft.position.xNm;
    const dy = aircraft.position.yNm;
    // Positive approach range is the extended-final side of the training
    // touchdown point. This deliberately matches the PAR sensor geometry.
    const approachRangeNm = -(dx * Math.sin(heading) - dy * Math.cos(heading));
    const lateralDeviationNm = dx * Math.cos(heading) + dy * Math.sin(heading);
    const radialRangeNm = Math.hypot(dx, dy);
    const headingErrorDeg = Math.abs(signedHeadingDelta(aircraft.headingDeg, finalTrackDeg));
    return {
      approachRangeNm,
      lateralDeviationNm,
      radialRangeNm,
      headingErrorDeg,
      inbound: headingErrorDeg < 90,
      onApproachSide: approachRangeNm > EPSILON
    };
  }

  function createAircraft(input, index) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Aircraft settings are required.');
    const initialQteDeg = degrees(input.initialQteDeg, 'Initial QTE');
    const initialRangeNm = bounded(input.initialRangeNm, .1, 200, 'Initial range');
    const initialHeadingDeg = degrees(input.initialHeadingDeg, 'Initial heading');
    const callsign = normalizeCallsign(input.callsign);
    const position = positionFromBearing(initialQteDeg, initialRangeNm);
    const id = String(input.aircraftId ?? ('AC' + (index + 1))).trim();
    if (!id) throw new Error('Aircraft ID is required.');
    const surveillanceInput = input.surveillance !== undefined ? input.surveillance
      : ['secondary', 'modeS', 'squawk', 'modeSId'].some(key => Object.hasOwn(input, key))
        ? { secondary: input.secondary, modeS: input.modeS, squawk: input.squawk, modeSId: input.modeSId } : null;
    const surveillance = normalizeSurveillance(surveillanceInput);
    const transponderCode = normalizeTransponderCode(input.transponderCode);
    return {
      id,
      callsign,
      type: String(input.aircraftType || 'fighter').trim().toLowerCase(),
      position,
      headingDeg: initialHeadingDeg,
      altitudeFt: bounded(input.altitudeFt, 0, 45000, 'Initial altitude'),
      verticalRateFpm: bounded(input.verticalRateFpm ?? 1000, 100, 6000, 'Vertical rate'),
      speedKt: bounded(input.speedKt, 30, 700, 'Ground speed'),
      rateDegPerSecond: bounded(input.rateDegPerSecond, .5, 8, 'Rate of turn'),
      ...(transponderCode ? { transponderCode } : {}),
      ...(surveillance ? { surveillance } : {}),
      turn: { mode: 'straight', side: null, targetHeadingDeg: initialHeadingDeg },
      vertical: { mode: 'LEVEL', targetAltitudeFt: bounded(input.altitudeFt, 0, 45000, 'Initial altitude') }
    };
  }

  function trailPoint(aircraft, timestamp) {
    return {
      timestamp,
      xNm: aircraft.position.xNm,
      yNm: aircraft.position.yNm,
      headingDeg: aircraft.headingDeg,
      altitudeFt: aircraft.altitudeFt
    };
  }

  // New session admission has mode-specific traffic limits. The underlying
  // engine continues to read old attempts and replay their original fleet.
  function validateNewExercise(input = {}) {
    const family = String(input.exerciseFamily || 'qgh').toLowerCase();
    const maximum = family === 'qgh' ? MAX_QGH_AIRCRAFT : MAX_AIRCRAFT;
    const aircraft = input.aircraft === undefined ? [input] : input.aircraft;
    if (!Array.isArray(aircraft) || aircraft.length < 1 || aircraft.length > maximum) {
      throw new Error(`${family === 'qgh' ? 'QGH' : 'A radar'} exercise must contain from 1 to ${maximum} aircraft.`);
    }
    return input;
  }

  function createState(input = {}) {
    const exerciseFamily = String(input.exerciseFamily || 'qgh').toLowerCase();
    if (!FAMILIES.has(exerciseFamily)) throw new Error('Choose QGH, surveillance, SRA or PAR.');
    const qghProcedure = String(input.qghProcedure || 'normal').toLowerCase();
    if (!QGH_PROCEDURES.has(qghProcedure)) throw new Error('QGH procedure must be Normal or U/S Compass.');
    const surveillanceProfile = String(input.surveillanceProfile || 'primary').toLowerCase();
    if (!SURVEILLANCE_PROFILES.has(surveillanceProfile)) {
      throw new Error('Surveillance profile must be Primary Only or Correlated Training.');
    }
    const inputs = input.aircraft === undefined ? [input] : input.aircraft;
    if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > MAX_AIRCRAFT) {
      throw new Error('An exercise must contain from 1 to ' + MAX_AIRCRAFT + ' aircraft.');
    }
    const aircraftList = inputs.map(createAircraft);
    if (new Set(aircraftList.map(item => item.id)).size !== aircraftList.length) throw new Error('Aircraft IDs must be unique.');
    if (new Set(aircraftList.map(item => item.callsign)).size !== aircraftList.length) throw new Error('Aircraft callsigns must be unique.');
    const selectedAircraftId = input.selectedAircraftId === undefined ? aircraftList[0].id : String(input.selectedAircraftId);
    const aircraft = aircraftList.find(item => item.id === selectedAircraftId);
    if (!aircraft) throw new Error('Selected aircraft is not available.');
    const approachAircraftId = input.approachAircraft === undefined ? selectedAircraftId : String(input.approachAircraft);
    if (!aircraftList.some(item => item.id === approachAircraftId)) {
      throw new Error('Designated approach aircraft is not available.');
    }
    const parTransferGateNm = bounded(input.parTransferGateNm ?? 10,
      PAR_TRANSFER_GATE_MIN_NM, PAR_TRANSFER_GATE_MAX_NM, 'PAR transfer gate');
    const parRefreshHz = Number(input.parRefreshHz ?? 1);
    if (!PAR_REFRESH_HZ.has(parRefreshHz)) throw new Error('PAR refresh must be 1 Hz or 5 Hz.');
    const runwayOrientationDeg = degrees(input.runwayOrientationDeg, 'Runway orientation');
    const finalTrackDeg = degrees(input.finalTrackDeg, 'Final track');
    const radarEnvironment = normalizeRadarEnvironment(input.radarEnvironment, runwayOrientationDeg);
    const scenario = {
      id: String(input.scenarioId || 'LOCAL-TRAINING'),
      exerciseFamily,
      qghProcedure,
      callsign: aircraft.callsign,
      aircraftType: aircraft.type,
      runwayOrientationDeg,
      finalTrackDeg,
      surveillanceProfile,
      sensorProfile: String(input.sensorProfile || '').trim().toLowerCase(),
      parTransferGateNm,
      parApproachAircraftId: approachAircraftId,
      parRefreshHz,
      zeroMagneticVariation: true,
      ...(radarEnvironment ? { radarEnvironment } : {})
    };
    const truthTrails = Object.fromEntries(aircraftList.map(item => [item.id, [trailPoint(item, 0)]]));
    return freeze({
      schemaVersion: SCHEMA_VERSION,
      revision: 0,
      lifecycle: 'configuring',
      simulationSeconds: 0,
      scenario,
      aircraftList,
      selectedAircraftId,
      aircraft,
      activeReadback: null,
      events: [],
      outcomes: [],
      truthTrails,
      truthTrail: truthTrails[selectedAircraftId],
      counters: { event: 0, outcome: 0, readback: 0 }
    });
  }

  function truthSnapshot(state) {
    assertState(state);
    return freeze({
      revision: state.revision,
      simulationSeconds: state.simulationSeconds,
      lifecycle: state.lifecycle,
      scenario: clone(state.scenario),
      aircraft: clone(state.aircraft),
      aircraftList: clone(state.aircraftList),
      selectedAircraftId: state.selectedAircraftId,
      bearing: bearingFromPosition(state.aircraft.position)
    });
  }

  function assertState(state) {
    if (!state || state.schemaVersion !== SCHEMA_VERSION || !state.aircraft || !state.scenario) {
      throw new Error('ATC suite state is not available.');
    }
  }

  // Historical entries are immutable. Copy containers only when writing them;
  // never serialize an entire growing exercise to change one aircraft.
  function draftState(state) {
    return { ...state, counters: { ...state.counters } };
  }

  function syncSelection(draft) {
    draft.aircraft = draft.aircraftList.find(item => item.id === draft.selectedAircraftId);
    draft.truthTrail = draft.truthTrails[draft.selectedAircraftId];
  }

  function selectAircraft(state, aircraftId) {
    assertState(state);
    const id = String(aircraftId);
    const aircraft = state.aircraftList.find(item => item.id === id);
    if (!aircraft) throw new Error('Selected aircraft is not available.');
    if (id === state.selectedAircraftId) return state;
    const draft = draftState(state);
    draft.selectedAircraftId = id;
    draft.revision += 1;
    draft.scenario = { ...state.scenario, callsign: aircraft.callsign, aircraftType: aircraft.type };
    syncSelection(draft);
    return freeze(draft);
  }

  function parTransferStatus(state, aircraftId = state?.selectedAircraftId) {
    assertState(state);
    const targetId = String(aircraftId || '');
    const aircraft = state.aircraftList.find(item => item.id === targetId);
    const gateNm = Number.isFinite(state.scenario.parTransferGateNm)
      ? state.scenario.parTransferGateNm : 10;
    const base = { aircraftId: targetId, gateNm };
    if (!aircraft) {
      return freeze({ ...base, eligible: false, reason: 'aircraft-unavailable',
        message: 'Select an available aircraft before transfer to PAR.' });
    }
    if (state.scenario.exerciseFamily !== 'surveillance') {
      return freeze({ ...base, callsign: aircraft.callsign, eligible: false, reason: 'not-surveillance',
        message: 'Transfer to PAR is available only from Surveillance Vectoring.' });
    }
    if (!['running', 'paused'].includes(state.lifecycle)) {
      return freeze({ ...base, callsign: aircraft.callsign, eligible: false, reason: 'exercise-not-active',
        message: 'Start or pause the exercise before transferring to PAR.' });
    }
    if (targetId !== state.selectedAircraftId) {
      return freeze({ ...base, callsign: aircraft.callsign, eligible: false, reason: 'not-selected',
        message: `Select ${aircraft.callsign} before transferring that aircraft to PAR.` });
    }
    const geometry = approachGeometry(aircraft, state.scenario.finalTrackDeg);
    const status = { ...base, callsign: aircraft.callsign, ...geometry };
    if (!geometry.onApproachSide) {
      return freeze({ ...status, eligible: false, reason: 'past-touchdown',
        message: `${aircraft.callsign} is past the touchdown point; PAR transfer is unavailable.` });
    }
    if (!geometry.inbound) {
      return freeze({ ...status, eligible: false, reason: 'outbound',
        message: `${aircraft.callsign} is outbound (HDG ${padHeading(aircraft.headingDeg)}°); vector inbound on FINAL ${padHeading(state.scenario.finalTrackDeg)}° first.` });
    }
    if (geometry.approachRangeNm > gateNm + EPSILON) {
      return freeze({ ...status, eligible: false, reason: 'beyond-gate',
        message: `${aircraft.callsign} is ${geometry.approachRangeNm.toFixed(1)} NM on approach; enter the ${gateNm.toFixed(1)} NM PAR transfer gate.` });
    }
    if (geometry.radialRangeNm > PAR_TRAINING_MAX_RANGE_NM + EPSILON) {
      return freeze({ ...status, eligible: false, reason: 'outside-par-coverage',
        message: `${aircraft.callsign} is outside the ${PAR_TRAINING_MAX_RANGE_NM} NM PAR training coverage.` });
    }
    return freeze({ ...status, eligible: true, reason: 'ready',
      message: `${aircraft.callsign} inbound at ${geometry.approachRangeNm.toFixed(1)} NM; transfer to PAR is available.` });
  }

  function transferToPar(state, input = {}) {
    assertState(state);
    const aircraftId = input.aircraftId === undefined ? state.selectedAircraftId : String(input.aircraftId);
    const status = parTransferStatus(state, aircraftId);
    const command = { type: 'transfer-to-par', aircraftId };
    if (!status.eligible) {
      return freeze({
        state,
        outcome: freeze({ id: null, accepted: false, authorization: 'REJECTED', executionStatus: 'NOT_APPLIED',
          timestamp: state.simulationSeconds, command, mutations: [], readback: null,
          cancelledReadbackId: null, transfer: clone(status), error: status.message })
      });
    }
    const draft = draftState(state);
    draft.revision += 1;
    draft.scenario = {
      ...state.scenario,
      exerciseFamily: 'par',
      parApproachAircraftId: aircraftId,
      callsign: state.aircraft.callsign,
      aircraftType: state.aircraft.type
    };
    appendEvent(draft, 'PAR_TRANSFERRED', {
      aircraftId,
      fromMode: 'surveillance',
      toMode: 'par',
      approachRangeNm: status.approachRangeNm,
      radialRangeNm: status.radialRangeNm,
      headingErrorDeg: status.headingErrorDeg,
      gateNm: status.gateNm
    });
    const outcome = {
      id: identifier(draft, 'outcome', 'O'),
      aircraftId,
      accepted: true,
      authorization: 'AUTHORIZED',
      executionStatus: 'APPLIED',
      timestamp: draft.simulationSeconds,
      command,
      mutations: ['scenario.exerciseFamily', 'scenario.parApproachAircraftId'],
      readback: null,
      cancelledReadbackId: null,
      transfer: clone(status)
    };
    draft.outcomes = draft.outcomes.concat(outcome);
    syncSelection(draft);
    return freeze({ state: freeze(draft), outcome: freeze(clone(outcome)) });
  }

  function identifier(draft, counter, prefix) {
    draft.counters[counter] += 1;
    return prefix + String(draft.counters[counter]).padStart(6, '0');
  }

  function appendEvent(draft, type, fields = {}) {
    const item = {
      id: identifier(draft, 'event', 'E'),
      type,
      timestamp: draft.simulationSeconds,
      revision: draft.revision,
      ...clone(fields)
    };
    draft.events = draft.events.concat(item);
    return item;
  }

  function reject(state, command, message) {
    return freeze({
      state,
      outcome: {
        id: null,
        accepted: false,
        authorization: 'REJECTED',
        executionStatus: 'NOT_APPLIED',
        timestamp: state.simulationSeconds,
        command: clone(command),
        mutations: [],
        readback: null,
        cancelledReadbackId: null,
        error: message
      }
    });
  }

  function validateSide(value) {
    const side = String(value || '').toLowerCase();
    if (!TURN_SIDES.has(side)) throw new Error('Turn side must be left or right.');
    return side;
  }

  function readbackFor(command, aircraft, report) {
    const suffix = ', ' + aircraft.callsign;
    switch (command.type) {
      case 'turn-to-heading':
        return 'TURNING ' + command.side.toUpperCase() + ' HEADING ' + padHeading(command.headingDeg) + suffix;
      case 'continue-heading':
        return 'CONTINUING ' + command.side.toUpperCase() + ' HEADING ' + padHeading(command.headingDeg) + suffix;
      case 'turn-now':
        return 'TURNING ' + command.side.toUpperCase() + suffix;
      case 'stop-turn':
        return 'WINGS LEVEL' + suffix;
      case 'set-speed':
        return 'SPEED ' + Math.round(command.speedKt) + ' KNOTS' + suffix;
      case 'set-altitude':
        return (command.direction === 'climb'
          ? 'CLIMBING TO ALTITUDE '
          : command.direction === 'descend'
            ? 'DESCENDING TO ALTITUDE '
            : 'MAINTAINING ALTITUDE ')
          + Math.round(command.altitudeFt) + ' FEET' + suffix;
      case 'report-heading':
        return 'HEADING ' + padHeading(aircraft.headingDeg) + suffix;
      case 'report-position':
        return 'QTE ' + padHeading(report.qteDeg) + ' DEGREES, RANGE '
          + report.rangeNm.toFixed(1) + ' NAUTICAL MILES' + suffix;
      case 'continue-approach':
        return 'CONTINUING APPROACH' + suffix;
      case 'report-runway-visual':
        return (report.runwayVisual ? 'RUNWAY IN SIGHT' : 'NEGATIVE, RUNWAY NOT IN SIGHT') + suffix;
      case 'transmit':
        return 'ROGER' + suffix;
      default:
        throw new Error('Unsupported suite command.');
    }
  }

  function normalizeCommand(state, input) {
    const type = String(input && input.type || '').trim().toLowerCase();
    const command = { type };
    if (type === 'turn-to-heading') {
      if (state.scenario.exerciseFamily === 'qgh' && state.scenario.qghProcedure === 'us') {
        throw new Error('Heading-directed turns are unavailable in U/S Compass QGH.');
      }
      command.side = validateSide(input.side);
      command.headingDeg = degrees(input.headingDeg, 'Assigned heading');
    } else if (type === 'continue-heading') {
      if (state.scenario.exerciseFamily === 'qgh' && state.scenario.qghProcedure === 'us') {
        throw new Error('Continue heading is unavailable in U/S Compass QGH.');
      }
      if (state.aircraft.turn.mode !== 'target' || !TURN_SIDES.has(state.aircraft.turn.side)) {
        throw new Error('No heading-directed turn is active.');
      }
      command.side = state.aircraft.turn.side;
      command.headingDeg = degrees(input.headingDeg, 'Assigned heading');
    } else if (type === 'turn-now') {
      command.side = validateSide(input.side);
    } else if (type === 'stop-turn') {
      // Quick turn buttons and mouse gestures use the same manual flight path
      // across QGH, SRA and vectoring. A stop always captures current heading.
    } else if (type === 'set-speed') {
      command.speedKt = bounded(input.speedKt, 30, 700, 'Ground speed');
    } else if (type === 'set-altitude') {
      command.direction = String(input.direction || '').trim().toLowerCase();
      if (!['climb', 'descend', 'maintain'].includes(command.direction)) {
        throw new Error('Altitude direction must be climb, descend or maintain.');
      }
      command.altitudeFt = bounded(input.altitudeFt, 0, 45000, 'Cleared altitude');
      const difference = command.altitudeFt - state.aircraft.altitudeFt;
      if (command.direction === 'climb' && difference <= EPSILON) {
        throw new Error('Climb target must be above current altitude.');
      }
      if (command.direction === 'descend' && difference >= -EPSILON) {
        throw new Error('Descent target must be below current altitude.');
      }
      if (command.direction === 'maintain' && Math.abs(difference) > EPSILON) {
        throw new Error('Maintain altitude must match current altitude.');
      }
    } else if (type === 'report-heading') {
      if (state.scenario.exerciseFamily === 'qgh' && state.scenario.qghProcedure === 'us') {
        throw new Error('Heading reports are unavailable in U/S Compass QGH.');
      }
    } else if (type === 'report-position') {
      if (!['surveillance', 'sra', 'par'].includes(state.scenario.exerciseFamily)) {
        throw new Error('Position reports are available only in surveillance, SRA or PAR.');
      }
    } else if (type === 'continue-approach') {
      if (!['sra', 'par'].includes(state.scenario.exerciseFamily)) {
        throw new Error('Continue approach is available only in SRA or PAR.');
      }
    } else if (type === 'report-runway-visual') {
      if (!['sra', 'par'].includes(state.scenario.exerciseFamily)) {
        throw new Error('Runway visual reports are available only in SRA or PAR.');
      }
    } else if (type !== 'transmit') {
      throw new Error('Unsupported suite command.');
    }
    return command;
  }

  function reportFor(state, command) {
    if (command.type === 'report-position') {
      const bearing = bearingFromPosition(state.aircraft.position);
      return {
        kind: 'position',
        timestamp: state.simulationSeconds,
        qteDeg: bearing.qteDeg,
        rangeNm: bearing.rangeNm
      };
    }
    if (command.type === 'continue-approach') {
      return {
        kind: 'approach-status',
        timestamp: state.simulationSeconds,
        status: 'continuing-approach'
      };
    }
    if (command.type === 'report-runway-visual') {
      const bearing = bearingFromPosition(state.aircraft.position);
      const trackErrorDeg = Math.abs(signedHeadingDelta(
        state.aircraft.headingDeg,
        state.scenario.finalTrackDeg
      ));
      const limits = {
        maximumRangeNm: 3,
        maximumAltitudeFt: 3000,
        maximumTrackErrorDeg: 30
      };
      return {
        kind: 'runway-visual',
        timestamp: state.simulationSeconds,
        runwayVisual: bearing.rangeNm <= limits.maximumRangeNm
          && state.aircraft.altitudeFt <= limits.maximumAltitudeFt
          && trackErrorDeg <= limits.maximumTrackErrorDeg,
        trainingGate: {
          trainingOnly: true,
          rangeNm: bearing.rangeNm,
          altitudeFt: state.aircraft.altitudeFt,
          trackErrorDeg,
          limits
        }
      };
    }
    return null;
  }

  function applyCommand(state, input = {}) {
    assertState(state);
    let command;
    let target;
    try {
      const aircraftId = input.aircraftId === undefined ? state.selectedAircraftId : String(input.aircraftId);
      target = state.aircraftList.find(item => item.id === aircraftId);
      if (!target) throw new Error('Command aircraft is not available.');
      command = { ...normalizeCommand({ ...state, aircraft: target }, input), aircraftId };
    } catch (error) {
      return reject(state, input, error.message);
    }

    const draft = draftState(state);
    draft.aircraft = { ...target };
    draft.aircraftList = state.aircraftList.map(item => item.id === target.id ? draft.aircraft : item);
    draft.revision += 1;
    const mutations = [];
    if (command.type === 'turn-to-heading' || command.type === 'continue-heading') {
      draft.aircraft.turn = {
        mode: 'target',
        side: command.side,
        targetHeadingDeg: command.headingDeg
      };
      mutations.push('aircraft.turn');
    } else if (command.type === 'turn-now') {
      draft.aircraft.turn = { mode: 'timed', side: command.side, targetHeadingDeg: null };
      mutations.push('aircraft.turn');
    } else if (command.type === 'stop-turn') {
      draft.aircraft.turn = {
        mode: 'straight',
        side: null,
        targetHeadingDeg: draft.aircraft.headingDeg
      };
      mutations.push('aircraft.turn');
    } else if (command.type === 'set-speed') {
      draft.aircraft.speedKt = command.speedKt;
      mutations.push('aircraft.speedKt');
    } else if (command.type === 'set-altitude') {
      draft.aircraft.vertical = {
        mode: command.direction === 'climb' ? 'CLIMB' : command.direction === 'descend' ? 'DESCENT' : 'LEVEL',
        targetAltitudeFt: command.direction === 'maintain' ? draft.aircraft.altitudeFt : command.altitudeFt
      };
      mutations.push('aircraft.vertical');
    }

    const cancelledReadbackId = draft.activeReadback && draft.activeReadback.status === 'speaking'
      ? draft.activeReadback.id
      : null;
    if (cancelledReadbackId) {
      appendEvent(draft, 'READBACK_INTERRUPTED', {
        aircraftId: draft.activeReadback.aircraftId,
        readbackId: cancelledReadbackId,
        reason: 'superseded-command'
      });
    }

    appendEvent(draft, 'COMMAND_ACCEPTED', {
      aircraftId: draft.aircraft.id,
      command
    });
    const report = reportFor(draft, command);
    const readback = {
      id: identifier(draft, 'readback', 'RB'),
      aircraftId: target.id,
      status: 'speaking',
      text: readbackFor(command, draft.aircraft, report),
      startedAt: draft.simulationSeconds,
      commandType: command.type
    };
    draft.activeReadback = readback;
    appendEvent(draft, 'READBACK_STARTED', {
      aircraftId: draft.aircraft.id,
      readbackId: readback.id,
      text: readback.text
    });
    const outcome = {
      id: identifier(draft, 'outcome', 'O'),
      aircraftId: target.id,
      accepted: true,
      authorization: 'AUTHORIZED',
      executionStatus: mutations.length ? 'APPLIED' : 'RECEIVED',
      timestamp: draft.simulationSeconds,
      command,
      mutations,
      readback,
      report,
      cancelledReadbackId,
      turnRadiusNm: TURN_SIDES.has(command.side)
        ? Flight.turnRadiusNm(draft.aircraft.speedKt, draft.aircraft.rateDegPerSecond)
        : null
    };
    draft.outcomes = draft.outcomes.concat(outcome);
    syncSelection(draft);
    return freeze({ state: freeze(draft), outcome: freeze(clone(outcome)) });
  }

  function finishReadback(state, readbackId) {
    assertState(state);
    if (!state.activeReadback || state.activeReadback.id !== readbackId) return state;
    const draft = draftState(state);
    draft.revision += 1;
    appendEvent(draft, 'READBACK_FINISHED', {
      aircraftId: draft.activeReadback.aircraftId,
      readbackId
    });
    draft.activeReadback = null;
    return freeze(draft);
  }

  function turnDelta(aircraft, duration) {
    const maximum = aircraft.rateDegPerSecond * duration;
    const turn = aircraft.turn;
    if (!turn || turn.mode === 'straight' || !TURN_SIDES.has(turn.side)) return 0;
    const direction = turn.side === 'right' ? 1 : -1;
    if (turn.mode === 'timed') return direction * maximum;
    const remaining = turn.side === 'right'
      ? Flight.normalize(turn.targetHeadingDeg - aircraft.headingDeg)
      : Flight.normalize(aircraft.headingDeg - turn.targetHeadingDeg);
    if (remaining <= EPSILON) return 0;
    return direction * Math.min(maximum, remaining);
  }

  function advance(state, durationSeconds) {
    assertState(state);
    const duration = finite(durationSeconds, 'Advance duration');
    const steps = duration / STEP_SECONDS;
    if (duration <= 0 || Math.abs(steps - Math.round(steps)) > EPSILON) {
      throw new Error('Advance duration must use quarter-second flight steps.');
    }
    const draft = draftState(state);
    draft.aircraftList = state.aircraftList.map(aircraft => ({ ...aircraft }));
    draft.truthTrails = Object.fromEntries(state.aircraftList.map(aircraft => [aircraft.id, state.truthTrails[aircraft.id].slice()]));
    for (let index = 0; index < Math.round(steps); index += 1) {
      draft.simulationSeconds += STEP_SECONDS;
      draft.revision += 1;
      for (const aircraft of draft.aircraftList) {
        const delta = turnDelta(aircraft, STEP_SECONDS);
        const motion = Flight.advanceArc(
          { x: aircraft.position.xNm, y: aircraft.position.yNm },
          aircraft.headingDeg,
          aircraft.speedKt,
          delta / STEP_SECONDS,
          STEP_SECONDS
        );
        aircraft.position = { xNm: motion.x, yNm: motion.y };
        aircraft.headingDeg = motion.heading;
        if (aircraft.turn.mode === 'target'
          && Math.abs(signedHeadingDelta(aircraft.headingDeg, aircraft.turn.targetHeadingDeg)) <= EPSILON) {
          aircraft.headingDeg = aircraft.turn.targetHeadingDeg;
          aircraft.turn = { mode: 'straight', side: null, targetHeadingDeg: aircraft.headingDeg };
        }
        if (aircraft.vertical.mode !== 'LEVEL') {
          const target = aircraft.vertical.targetAltitudeFt;
          const remaining = target - aircraft.altitudeFt;
          const maximum = aircraft.verticalRateFpm * STEP_SECONDS / 60;
          aircraft.altitudeFt += Math.sign(remaining) * Math.min(Math.abs(remaining), maximum);
          if (Math.abs(target - aircraft.altitudeFt) <= EPSILON) {
            aircraft.altitudeFt = target;
            aircraft.vertical = { mode: 'LEVEL', targetAltitudeFt: target };
            appendEvent(draft, 'ALTITUDE_REACHED', { aircraftId: aircraft.id, altitudeFt: aircraft.altitudeFt });
          }
        }
        draft.truthTrails[aircraft.id].push(trailPoint(aircraft, draft.simulationSeconds));
      }
    }
    syncSelection(draft);
    return freeze(draft);
  }

  function setLifecycle(state, lifecycle) {
    assertState(state);
    const normalized = String(lifecycle || '').toLowerCase();
    if (!LIFECYCLES.has(normalized)) throw new Error('Unsupported exercise lifecycle.');
    if (state.lifecycle === normalized) return state;
    const draft = draftState(state);
    draft.lifecycle = normalized;
    draft.revision += 1;
    appendEvent(draft, 'LIFECYCLE_CHANGED', { lifecycle: normalized });
    return freeze(draft);
  }

  function addFinite(target, key, value) {
    if (Number.isFinite(value)) target[key] = Number(value);
  }

  function addText(target, key, value, allowed) {
    if (typeof value !== 'string') return;
    const normalized = value.trim().toLowerCase();
    if (!normalized || allowed && !allowed.has(normalized)) return;
    target[key] = normalized;
  }

  function sanitizeSurveillanceMetadata(value) {
    if (!isPlainObject(value)) return null;
    const safe = {};
    if (value.secondary === true) safe.secondary = true;
    if (value.modeS === true) { safe.secondary = true; safe.modeS = true; }
    if (typeof value.squawk === 'string' && /^[0-7]{4}$/.test(value.squawk)) {
      safe.secondary = true;
      safe.squawk = value.squawk;
    }
    if (typeof value.modeSId === 'string' && /^[0-9A-F]{6}$/.test(value.modeSId)) {
      safe.secondary = true;
      safe.modeS = true;
      safe.modeSId = value.modeSId;
    }
    return Object.keys(safe).length ? safe : null;
  }

  function sanitizePlot(value, correlated) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const plot = {};
    addFinite(plot, 'rangeNm', value.rangeNm);
    addFinite(plot, 'azimuthDeg', value.azimuthDeg);
    addFinite(plot, 'timestamp', value.timestamp);
    if (typeof value.trackId === 'string' && /^T[1-9][0-9]{0,30}$/.test(value.trackId)) plot.trackId = value.trackId;
    if (correlated) {
      const surveillance = sanitizeSurveillanceMetadata(value.surveillance);
      // Mixed scopes may be globally correlated while an individual return is
      // still primary-only. Correlated fields are valid only for an explicit
      // secondary response, never merely because the wider scope supports SSR.
      if (surveillance) {
        if (typeof value.callsign === 'string' && value.callsign.trim()) plot.callsign = value.callsign.trim().toUpperCase();
        addFinite(plot, 'altitudeFt', value.altitudeFt);
        // These are sampled, correlated training data. They are deliberately
        // unavailable to primary-only returns and bounded before projection.
        if (Number.isFinite(value.headingDeg) && value.headingDeg >= 0 && value.headingDeg <= 359) plot.headingDeg = Number(value.headingDeg);
        if (Number.isFinite(value.groundSpeedKt) && value.groundSpeedKt >= 0 && value.groundSpeedKt <= 700) plot.groundSpeedKt = Number(value.groundSpeedKt);
        plot.surveillance = surveillance;
      }
    }
    return Object.keys(plot).length ? plot : null;
  }

  function sanitizeHistory(value, mapper, maximum = 5) {
    if (!Array.isArray(value)) return undefined;
    return value.map(mapper).filter(Boolean).slice(-maximum);
  }

  function sanitizeQghObservation(value) {
    const source = value && typeof value === 'object' ? value : {};
    const observation = {};
    addText(observation, 'status', source.status, new Set(['live', 'held', 'idle', 'unavailable']));
    addText(observation, 'transmissionState', source.transmissionState, new Set(['pilot', 'held', 'idle']));
    addText(observation, 'bearingType', source.bearingType, new Set(['qdm', 'qte']));
    addFinite(observation, 'bearingDeg', source.bearingDeg);
    if (['pilot', 'held'].includes(observation.transmissionState) && typeof source.callsign === 'string') {
      observation.callsign = source.callsign.trim().slice(0, 32);
    }
    return observation;
  }

  function sanitizeSurveillanceObservation(value, state) {
    const source = value && typeof value === 'object' ? value : {};
    const correlated = state.scenario.surveillanceProfile === 'correlated';
    const observation = {};
    addFinite(observation, 'scanAngleDeg', source.scanAngleDeg);
    const plot = sanitizePlot(source.plot, correlated);
    if (plot) observation.plot = plot;
    const plots = sanitizeHistory(source.plots, item => sanitizePlot(item, correlated), MAX_AIRCRAFT);
    if (plots) observation.plots = plots;
    const history = sanitizeHistory(source.history, item => sanitizePlot(item, correlated), MAX_AIRCRAFT * 5);
    if (history) observation.history = history;
    if (state.scenario.exerciseFamily === 'sra' && source.overlays && typeof source.overlays === 'object') {
      const overlays = {};
      addFinite(overlays, 'runwayOrientationDeg', source.overlays.runwayOrientationDeg);
      addFinite(overlays, 'centrelineDeg', source.overlays.centrelineDeg);
      addFinite(overlays, 'touchdownRangeNm', source.overlays.touchdownRangeNm);
      addFinite(overlays, 'terminationRangeNm', source.overlays.terminationRangeNm);
      if (Object.keys(overlays).length) observation.overlays = overlays;
    }
    return observation;
  }

  function sanitizeParPanel(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const panel = {};
    addFinite(panel, 'deviationDeg', value.deviationDeg);
    addText(panel, 'trend', value.trend, new Set(['opening', 'closing', 'stable', 'left', 'right', 'above', 'below']));
    return Object.keys(panel).length ? panel : null;
  }

  function sanitizeParHistory(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const point = {};
    addFinite(point, 'timestamp', value.timestamp);
    addFinite(point, 'rangeNm', value.rangeNm);
    addFinite(point, 'azimuthDeviationDeg', value.azimuthDeviationDeg);
    addFinite(point, 'elevationDeviationDeg', value.elevationDeviationDeg);
    return Object.keys(point).length ? point : null;
  }

  function sanitizeParObservation(value) {
    const source = value && typeof value === 'object' ? value : {};
    const observation = {};
    addFinite(observation, 'timestamp', source.timestamp);
    addFinite(observation, 'rangeNm', source.rangeNm);
    const azimuth = sanitizeParPanel(source.azimuth);
    const elevation = sanitizeParPanel(source.elevation);
    if (azimuth) observation.azimuth = azimuth;
    if (elevation) observation.elevation = elevation;
    addText(observation, 'trackState', source.trackState, new Set(['tracking', 'coasting', 'lost']));
    const history = sanitizeHistory(source.history, sanitizeParHistory);
    if (history) observation.history = history;
    return observation;
  }

  function safeCaption(state, caption) {
    if (typeof caption !== 'string' || !caption.trim()) return undefined;
    const value = caption.trim();
    if (state.scenario.exerciseFamily === 'qgh' && state.scenario.qghProcedure === 'us'
      && (/\bHEADING\b/i.test(value) || !state.activeReadback || value !== state.activeReadback.text)) {
      return 'PILOT TRANSMISSION';
    }
    return value;
  }

  function studentEnvelope(state, observation = {}, extras = {}) {
    assertState(state);
    const family = state.scenario.exerciseFamily;
    const publicScenario = {
      exerciseFamily: family,
      zeroMagneticVariation: true
    };
    let sanitized;
    if (family === 'qgh') {
      publicScenario.callsign = state.scenario.callsign;
      publicScenario.qghProcedure = state.scenario.qghProcedure;
      sanitized = sanitizeQghObservation(observation);
    } else if (family === 'surveillance' || family === 'sra') {
      publicScenario.displayProfile = state.scenario.surveillanceProfile === 'correlated'
        ? 'correlated-training'
        : 'primary-only';
      if (state.scenario.radarEnvironment) publicScenario.radarEnvironment = state.scenario.radarEnvironment;
      if (family === 'sra') {
        const approachAircraft = state.aircraftList.find(item => item.id === state.scenario.parApproachAircraftId) || state.aircraft;
        publicScenario.approachSpeedKt = approachAircraft.speedKt;
        publicScenario.approachAircraftType = approachAircraft.type;
      }
      sanitized = sanitizeSurveillanceObservation(observation, state);
    } else {
      publicScenario.displayProfile = 'par-training';
      sanitized = sanitizeParObservation(observation);
    }
    const envelope = {
      schemaVersion: SCHEMA_VERSION,
      revision: state.revision,
      simulationSeconds: state.simulationSeconds,
      lifecycle: state.lifecycle,
      mode: family,
      publicScenario,
      observation: sanitized
    };
    const caption = safeCaption(state, extras.caption);
    if (caption) envelope.caption = caption;
    return freeze(envelope);
  }

  return freeze({
    SCHEMA_VERSION,
    STEP_SECONDS,
    MAX_AIRCRAFT,
    MAX_QGH_AIRCRAFT,
    validateNewExercise,
    createState,
    selectAircraft,
    parTransferStatus,
    transferToPar,
    applyCommand,
    finishReadback,
    advance,
    setLifecycle,
    truthSnapshot,
    studentEnvelope,
    bearingFromPosition,
    positionFromBearing,
    padHeading,
    PAR_TRANSFER_GATE_MIN_NM,
    PAR_TRANSFER_GATE_MAX_NM,
    PAR_TRAINING_MAX_RANGE_NM
  });
});
