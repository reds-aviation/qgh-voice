(function exposeSuiteSensors(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ATCSuiteSensors = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function createSuiteSensors() {
  'use strict';

  const EPSILON = 1e-9;
  const EARTH_FT_PER_NM = 6076.12;
  const RADAR_RPMS = Object.freeze([10, 12, 15]);
  const PAR_REFRESH_HZ = Object.freeze([1, 5]);
  const HISTORY_SETTINGS = Object.freeze([0, 3, 5]);

  function finite(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(label + ' must be a finite number.');
    return number;
  }

  function nonNegative(value, label) {
    const number = finite(value, label);
    if (number < 0) throw new Error(label + ' must not be negative.');
    return number;
  }

  function normalize(angle) {
    return ((finite(angle, 'Angle') % 360) + 360) % 360;
  }

  function radians(angle) {
    return angle * Math.PI / 180;
  }

  function degrees(angle) {
    return angle * 180 / Math.PI;
  }

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  }

  function immutable(value) {
    return deepFreeze(clone(value));
  }

  function surveillanceFrom(aircraft) {
    const source = aircraft && aircraft.surveillance && typeof aircraft.surveillance === 'object'
      ? aircraft.surveillance
      : aircraft && (aircraft.secondary != null || aircraft.modeS != null || aircraft.squawk != null || aircraft.modeSId != null)
        ? aircraft : null;
    if (!source) return null;
    const modeS = source.modeS === true;
    const squawk = typeof source.squawk === 'string' && /^[0-7]{4}$/.test(source.squawk.trim())
      ? source.squawk.trim() : null;
    const modeSId = typeof source.modeSId === 'string' && /^[0-9A-F]{6}$/.test(source.modeSId.trim().toUpperCase())
      ? source.modeSId.trim().toUpperCase() : null;
    const secondary = source.secondary === true || modeS || squawk != null || modeSId != null;
    return secondary ? { secondary: true, ...(modeS || modeSId ? { modeS: true } : {}), ...(squawk ? { squawk } : {}), ...(modeSId ? { modeSId } : {}) } : null;
  }

  function pointFrom(snapshot, source) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    let aircraft = snapshot;
    if (snapshot.aircraft) {
      if (snapshot.aircraft.position || snapshot.aircraft.plane
        || Number.isFinite(Number(snapshot.aircraft.x ?? snapshot.aircraft.xNm))) {
        aircraft = snapshot.aircraft;
      } else if (Array.isArray(snapshot.aircraft)) {
        aircraft = source == null ? snapshot.aircraft[0] : snapshot.aircraft.find(item => item && String(item.id) === String(source));
      } else if (source != null && snapshot.aircraft[source]) {
        aircraft = snapshot.aircraft[source];
      } else if (source == null) {
        aircraft = Object.values(snapshot.aircraft)[0];
      } else {
        aircraft = Object.values(snapshot.aircraft).find(item => item && String(item.id) === String(source));
      }
    }
    if (!aircraft || typeof aircraft !== 'object') return null;
    if (source != null && aircraft.id != null && String(aircraft.id) !== String(source)) return null;
    const position = aircraft.plane || aircraft.position || aircraft;
    const x = Number(position.x ?? position.xNm);
    const y = Number(position.y ?? position.yNm);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const altitudeCandidate = aircraft.altitudeFt ?? aircraft.actualAltitudeMslFt ?? aircraft.level
      ?? position.altitudeFt ?? position.actualAltitudeMslFt ?? position.level;
    const altitudeFt = Number(altitudeCandidate);
    return {
      id: aircraft.id == null ? source == null ? null : String(source) : String(aircraft.id),
      callsign: aircraft.callsign == null ? null : String(aircraft.callsign),
      x,
      y,
      altitudeFt: Number.isFinite(altitudeFt) ? altitudeFt : null,
      surveillance: surveillanceFrom(aircraft)
    };
  }

  function bearingFrom(snapshot, options = {}) {
    const point = pointFrom(snapshot, options.source);
    if (!point) return null;
    const station = options.station || { x: 0, y: 0 };
    const stationX = finite(station.x ?? 0, 'Station x');
    const stationY = finite(station.y ?? 0, 'Station y');
    const x = point.x - stationX;
    const y = point.y - stationY;
    const rangeNm = Math.hypot(x, y);
    const overheadZoneNm = nonNegative(options.overheadZoneNm ?? 0.25, 'Overhead zone');
    if (rangeNm <= overheadZoneNm) {
      return immutable({ source: point.id, callsign: point.callsign, rangeNm, qte: null, qdm: null,
        unavailable: true, reason: 'overhead' });
    }
    const qte = normalize(degrees(Math.atan2(x, -y)));
    return immutable({ source: point.id, callsign: point.callsign, rangeNm, qte, qdm: normalize(qte + 180),
      unavailable: false, reason: null });
  }

  function createDfSensor(options = {}) {
    const holdSeconds = nonNegative(options.holdSeconds ?? 2, 'DF hold time');
    const station = immutable(options.station || { x: 0, y: 0 });
    const overheadZoneNm = nonNegative(options.overheadZoneNm ?? 0.25, 'Overhead zone');
    let active = null;
    let held = null;
    let lastTime = nonNegative(options.startSeconds ?? 0, 'Start time');
    let generation = 0;
    const review = [];

    function assertTime(timestamp) {
      const time = nonNegative(timestamp, 'Authoritative time');
      if (time + EPSILON < lastTime) throw new Error('DF time must be monotonic.');
      lastTime = Math.max(lastTime, time);
      return time;
    }

    function observe(snapshot, source, timestamp, signalPhase, transmissionId) {
      const bearing = bearingFrom(snapshot, { source, station, overheadZoneNm });
      if (!bearing || bearing.unavailable) {
        return immutable({ sensor: 'df', phase: 'unavailable', signalPhase, timestamp, transmissionId,
          source: bearing ? bearing.source : source, callsign: bearing ? bearing.callsign : null,
          rangeNm: bearing ? bearing.rangeNm : null, qdm: null, qte: null,
          unavailable: true, reason: bearing ? bearing.reason : 'no-track' });
      }
      return immutable({ sensor: 'df', phase: signalPhase, signalPhase, timestamp, transmissionId,
        source: bearing.source, callsign: bearing.callsign, rangeNm: bearing.rangeNm,
        qdm: bearing.qdm, qte: bearing.qte, unavailable: false, reason: null });
    }

    function beginTransmission(details = {}, snapshot, timestamp = lastTime) {
      const time = assertTime(timestamp);
      generation += 1;
      held = null;
      active = {
        generation,
        id: String(details.transmissionId ?? 'tx-' + generation),
        source: details.source == null ? null : String(details.source),
        startedAt: time,
        latestSnapshot: snapshot
      };
      const sample = observe(snapshot, active.source, time, 'live', active.id);
      review.push(sample);
      return generation;
    }

    function update(snapshot, timestamp = lastTime, token = generation) {
      const time = assertTime(timestamp);
      if (!active || token !== active.generation) return read(time, snapshot);
      active.latestSnapshot = snapshot;
      const sample = observe(snapshot, active.source, time, 'live', active.id);
      review.push(sample);
      return sample;
    }

    function endTransmission(snapshot, timestamp = lastTime, token = generation) {
      const time = assertTime(timestamp);
      if (!active || token !== active.generation) return read(time);
      const releaseSnapshot = snapshot === undefined ? active.latestSnapshot : snapshot;
      const sample = observe(releaseSnapshot, active.source, time, 'held', active.id);
      held = immutable({ ...sample, signalPhase: 'held', phase: sample.unavailable ? 'unavailable' : 'held',
        releasedAt: time, expiresAt: time + holdSeconds });
      active = null;
      review.push(held);
      return held;
    }

    function read(timestamp = lastTime, snapshot) {
      const time = assertTime(timestamp);
      if (active) {
        if (snapshot !== undefined) active.latestSnapshot = snapshot;
        return observe(active.latestSnapshot, active.source, time, 'live', active.id);
      }
      if (held && time < held.expiresAt - EPSILON) return held;
      held = null;
      return immutable({ sensor: 'df', phase: 'idle', signalPhase: 'idle', timestamp: time,
        transmissionId: null, source: null, callsign: null, rangeNm: null,
        qdm: null, qte: null, unavailable: false, reason: null });
    }

    function reset(timestamp = lastTime) {
      assertTime(timestamp);
      generation += 1;
      active = null;
      held = null;
    }

    function studentObservation(reference = 'qdm', timestamp = lastTime, snapshot) {
      const bearingType = String(reference || '').toLowerCase();
      if (!['qdm', 'qte'].includes(bearingType)) throw new Error('DF reference must be QDM or QTE.');
      const current = read(timestamp, snapshot);
      const heldSignal = current.signalPhase === 'held';
      const result = {
        status: current.phase,
        transmissionState: current.phase === 'idle' ? 'idle' : heldSignal ? 'held' : 'pilot',
        bearingType
      };
      if (!current.unavailable && Number.isFinite(current[bearingType])) result.bearingDeg = current[bearingType];
      if (result.transmissionState !== 'idle' && current.callsign) result.callsign = current.callsign;
      return immutable(result);
    }

    return Object.freeze({ beginTransmission, update, endTransmission, read, reset,
      studentObservation, observations: () => immutable(review), get generation() { return generation; } });
  }

  function validateHistory(value) {
    const number = typeof value === 'string' && value.trim().toLowerCase() === 'off' ? 0 : Number(value);
    if (!HISTORY_SETTINGS.includes(number)) throw new Error('History must be Off, 3 or 5.');
    return number;
  }

  function interpolatePoint(first, second, fraction) {
    if (!first || !second) return null;
    const altitude = first.altitudeFt == null || second.altitudeFt == null ? null
      : first.altitudeFt + (second.altitudeFt - first.altitudeFt) * fraction;
    return {
      id: second.id || first.id,
      callsign: second.callsign || first.callsign,
      x: first.x + (second.x - first.x) * fraction,
      y: first.y + (second.y - first.y) * fraction,
      altitudeFt: altitude,
      surveillance: second.surveillance || first.surveillance || null
    };
  }

  function shortestAngleDelta(from, to) {
    return normalize(to - from + 180) - 180;
  }

  // Track data is intentionally calculated only from two sampled positions.
  // It is not copied from the authoritative aircraft state and may be absent
  // on an initial plot, a stationary target, or a too-short sample interval.
  function derivedTrack(previous, point, timestamp) {
    if (!previous || !point || !Number.isFinite(timestamp) || timestamp <= previous.timestamp + EPSILON) return null;
    const dx = point.x - previous.point.x, dy = point.y - previous.point.y;
    const distanceNm = Math.hypot(dx, dy);
    if (distanceNm <= EPSILON) return null;
    const elapsedSeconds = timestamp - previous.timestamp;
    return {
      headingDeg: normalize(degrees(Math.atan2(dx, -dy))),
      groundSpeedKt: distanceNm * 3600 / elapsedSeconds
    };
  }

  function radarObservation(point, timestamp, options) {
    const bearing = bearingFrom(point, { station: options.station, overheadZoneNm: 0 });
    if (!bearing) return null;
    const detected = options.available !== false && bearing.rangeNm <= options.maxRangeNm && bearing.rangeNm > EPSILON;
    const observation = {
      sensor: options.sra ? 'sra' : 'surveillance',
      timestamp,
      detected,
      trackState: detected ? 'plot' : 'not-detected',
      bearingDeg: detected ? bearing.qte : null,
      rangeNm: detected ? bearing.rangeNm : null,
      profile: options.profile,
      scanRpm: options.rpm,
      revisitSeconds: 60 / options.rpm
    };
    // A correlated scope can contain both primary and cooperative returns.
    // Do not attach identity or track-derived data unless this individual
    // aircraft has an explicit secondary response.
    if (options.profile === 'correlated' && detected && point.surveillance?.secondary === true) {
      observation.callsign = point.callsign;
      observation.levelFt = point.altitudeFt == null ? null : Math.round(point.altitudeFt / 100) * 100;
      // A sampled track estimate, not avionics truth. The student UI labels
      // both fields as training track-derived data and can hide them.
      if (options.trackDerived?.headingDeg != null) observation.headingDeg = Math.round(normalize(options.trackDerived.headingDeg));
      if (options.trackDerived?.groundSpeedKt != null) observation.groundSpeedKt = Math.round(options.trackDerived.groundSpeedKt);
      observation.surveillance = point.surveillance;
    }
    return immutable(observation);
  }

  function createSurveillanceSensor(options = {}) {
    const rpm = Number(options.rpm ?? 12);
    if (!RADAR_RPMS.includes(rpm)) throw new Error('Radar scan rate must be 10, 12 or 15 RPM.');
    const profile = options.profile || 'primary';
    if (!['primary', 'correlated'].includes(profile)) throw new Error('Radar profile must be primary or correlated.');
    const station = immutable(options.station || { x: 0, y: 0 });
    const maxRangeNm = nonNegative(options.maxRangeNm ?? 100, 'Radar range');
    const initialAzimuthDeg = normalize(options.initialAzimuthDeg ?? 0);
    const startSeconds = nonNegative(options.startSeconds ?? 0, 'Start time');
    const substepSeconds = finite(options.substepSeconds ?? 0.25, 'Radar substep');
    if (substepSeconds <= 0) throw new Error('Radar substep must be greater than zero.');
    let historySetting = validateHistory(options.history ?? 3);
    let lastTime = startSeconds;
    const observations = [];
    const tracks = new Map();
    let trackNumber = 0;

    const scanDegreesPerSecond = rpm * 6;
    const beamAngleAt = timestamp => normalize(initialAzimuthDeg + scanDegreesPerSecond * (timestamp - startSeconds));

    function crossings(first, second, fromSeconds, toSeconds, lastPlotTime) {
      if (!first || !second || toSeconds <= fromSeconds + EPSILON) return [];
      const firstBearing = bearingFrom(first, { station, overheadZoneNm: 0 });
      const secondBearing = bearingFrom(second, { station, overheadZoneNm: 0 });
      if (!firstBearing || !secondBearing || firstBearing.rangeNm <= EPSILON || secondBearing.rangeNm <= EPSILON) return [];
      const targetStart = firstBearing.qte;
      const targetEnd = targetStart + shortestAngleDelta(targetStart, secondBearing.qte);
      const beamStart = initialAzimuthDeg + scanDegreesPerSecond * (fromSeconds - startSeconds);
      const beamEnd = initialAzimuthDeg + scanDegreesPerSecond * (toSeconds - startSeconds);
      const differenceStart = beamStart - targetStart;
      const differenceEnd = beamEnd - targetEnd;
      const denominator = differenceEnd - differenceStart;
      if (Math.abs(denominator) < EPSILON) return [];
      const low = Math.min(differenceStart, differenceEnd);
      const high = Math.max(differenceStart, differenceEnd);
      const firstIndex = Math.ceil((low - EPSILON) / 360);
      const lastIndex = Math.floor((high + EPSILON) / 360);
      const result = [];
      for (let index = firstIndex; index <= lastIndex; index += 1) {
        const fraction = (360 * index - differenceStart) / denominator;
        if (fraction < -EPSILON || fraction > 1 + EPSILON) continue;
        const boundedFraction = Math.max(0, Math.min(1, fraction));
        const timestamp = fromSeconds + (toSeconds - fromSeconds) * boundedFraction;
        if (timestamp <= startSeconds + EPSILON || timestamp <= lastPlotTime + EPSILON) continue;
        result.push({ timestamp, point: interpolatePoint(first, second, boundedFraction) });
      }
      return result.sort((left, right) => left.timestamp - right.timestamp);
    }

    function advance(toSeconds, truthAt) {
      const target = nonNegative(toSeconds, 'Authoritative time');
      if (target + EPSILON < lastTime) throw new Error('Radar time must be monotonic.');
      const sample = typeof truthAt === 'function' ? truthAt : () => truthAt;
      const emitted = [];
      let from = lastTime;
      while (from < target - EPSILON) {
        const to = Math.min(target, from + substepSeconds);
        const firstPoints = pointsFrom(sample(from));
        const secondPoints = pointsFrom(sample(to));
        for (const [source, point] of [...firstPoints, ...secondPoints]) {
          if (!tracks.has(source)) {
            if (tracks.size >= 24) throw new Error('Radar supports at most 24 tracks.');
            tracks.set(source, { trackId: 'T' + ++trackNumber, point, lastPlotTime: -Infinity, latest: null, history: [], lastSample: null });
          }
        }
        const pending = [];
        for (const [source, track] of tracks) {
          const first = firstPoints.get(source) || track.point;
          const second = secondPoints.get(source) || first;
          for (const crossing of crossings(first, second, from, to, track.lastPlotTime)) {
            pending.push({ ...crossing, track, available: secondPoints.has(source) });
          }
          if (secondPoints.has(source)) track.point = second;
        }
        pending.sort((left, right) => left.timestamp - right.timestamp);
        for (const crossing of pending) {
          const observation = radarObservation(crossing.point, crossing.timestamp,
            { station, maxRangeNm, profile, rpm, sra: options.sra === true, available: crossing.available,
              trackDerived: derivedTrack(crossing.track.lastSample, crossing.point, crossing.timestamp) });
          if (observation) {
            const tracked = immutable({ ...observation, trackId: crossing.track.trackId });
            observations.push(tracked);
            emitted.push(tracked);
            crossing.track.lastPlotTime = crossing.timestamp;
            crossing.track.latest = tracked;
            if (tracked.detected) {
              crossing.track.lastSample = { timestamp: crossing.timestamp, point: crossing.point };
              crossing.track.history.push(tracked);
              if (crossing.track.history.length > 6) crossing.track.history.shift();
            }
          }
        }
        from = to;
      }
      lastTime = target;
      return immutable(emitted);
    }

    function pointsFrom(snapshot) {
      const points = new Map();
      const fleet = snapshot && Array.isArray(snapshot.aircraft) ? snapshot.aircraft : null;
      if (fleet && fleet.length > 24) throw new Error('Radar supports at most 24 aircraft.');
      const candidates = fleet || [snapshot];
      for (const candidate of candidates) {
        const point = pointFrom(candidate, fleet ? undefined : options.source);
        if (point) points.set(point.id == null ? 'single' : point.id, point);
      }
      return points;
    }

    function setHistory(value) {
      historySetting = validateHistory(value);
    }

    function getDisplay() {
      const latest = observations.length ? observations[observations.length - 1] : null;
      const detected = observations.filter(item => item.detected);
      const current = latest && latest.detected ? latest : null;
      const prior = current ? detected.slice(0, -1) : detected;
      return immutable({ current, history: historySetting ? prior.slice(-historySetting) : [],
        historySetting, trackState: latest ? latest.trackState : 'waiting',
        beamAngleDeg: beamAngleAt(lastTime), timestamp: lastTime });
    }

    function plotForStudent(item, includeTrackId = false) {
      if (!item || !item.detected) return null;
      const plot = { rangeNm: item.rangeNm, azimuthDeg: item.bearingDeg, timestamp: item.timestamp };
      if (includeTrackId) plot.trackId = item.trackId;
      if (profile === 'correlated' && item.surveillance?.secondary === true) {
        plot.callsign = item.callsign;
        plot.altitudeFt = item.levelFt;
        if (item.headingDeg != null) plot.headingDeg = item.headingDeg;
        if (item.groundSpeedKt != null) plot.groundSpeedKt = item.groundSpeedKt;
        if (item.surveillance) plot.surveillance = item.surveillance;
      }
      return plot;
    }

    function studentObservation(overlays) {
      const display = getDisplay();
      const result = {
        scanAngleDeg: display.beamAngleDeg,
        plots: [],
        history: []
      };
      for (const track of tracks.values()) {
        const current = plotForStudent(track.latest, true);
        if (current) result.plots.push(current);
        const prior = current ? track.history.slice(0, -1) : track.history;
        if (historySetting) result.history.push(...prior.slice(-historySetting).map(item => plotForStudent(item, true)));
      }
      const plot = plotForStudent(display.current);
      if (plot) result.plot = plot;
      if (options.sra === true && overlays) {
        result.overlays = {
          runwayOrientationDeg: overlays.runwayOrientationDeg ?? overlays.runwayHeadingDeg,
          centrelineDeg: overlays.centrelineDeg ?? overlays.extendedCentrelineDeg,
          touchdownRangeNm: overlays.touchdownRangeNm ?? 0,
          terminationRangeNm: overlays.terminationRangeNm
        };
      }
      return immutable(result);
    }

    return Object.freeze({ advance, setHistory, getDisplay, studentObservation, beamAngleAt,
      observations: () => immutable(observations),
      get rpm() { return rpm; }, get revisitSeconds() { return 60 / rpm; }, get time() { return lastTime; } });
  }

  function createSraReferences(options = {}) {
    const rangeMarksNm = Array.from(options.rangeMarksNm || [2, 4, 6, 8, 10], value => nonNegative(value, 'SRA range mark'));
    const runwayHeadingDeg = normalize(options.runwayHeadingDeg ?? 0);
    return immutable({
      kind: 'sra-training-references',
      runwayHeadingDeg,
      runwayOrientationDeg: runwayHeadingDeg,
      touchdown: { x: finite(options.touchdown?.x ?? options.touchdown?.xNm ?? 0, 'Touchdown x'),
        y: finite(options.touchdown?.y ?? options.touchdown?.yNm ?? 0, 'Touchdown y') },
      extendedCentrelineDeg: normalize(runwayHeadingDeg + 180),
      centrelineDeg: normalize(runwayHeadingDeg + 180),
      touchdownRangeNm: nonNegative(options.touchdownRangeNm ?? 0, 'SRA touchdown range'),
      rangeMarksNm,
      approachCorridorWidthNm: nonNegative(options.approachCorridorWidthNm ?? 2, 'SRA corridor width'),
      terminationRangeNm: nonNegative(options.terminationRangeNm ?? 0.5, 'SRA termination range'),
      fidelity: 'training-representation'
    });
  }

  function trend(current, previous, tolerance) {
    if (!previous || current == null || previous.value == null) return 'new';
    const difference = Math.abs(current) - Math.abs(previous.value);
    if (Math.abs(difference) <= tolerance) return 'steady';
    return difference < 0 ? 'closing' : 'diverging';
  }

  function parObservation(snapshot, timestamp, options, previousTracked) {
    const point = pointFrom(snapshot, options.source);
    if (!point) return immutable({ sensor: 'par', timestamp, trackState: 'lost', reason: 'no-track',
      refreshHz: options.refreshHz });
    const heading = radians(options.runwayHeadingDeg);
    const dx = point.x - options.touchdown.x;
    const dy = point.y - options.touchdown.y;
    const alongRunwayNm = dx * Math.sin(heading) - dy * Math.cos(heading);
    const approachRangeNm = -alongRunwayNm;
    const lateralDeviationNm = dx * Math.cos(heading) + dy * Math.sin(heading);
    const radialRangeNm = Math.hypot(dx, dy);
    const tracked = approachRangeNm >= 0 && radialRangeNm <= options.maxRangeNm && radialRangeNm > EPSILON;
    if (!tracked) return immutable({ sensor: 'par', timestamp, trackState: 'lost',
      reason: approachRangeNm < 0 ? 'past-touchdown' : radialRangeNm > options.maxRangeNm ? 'outside-coverage' : 'overhead',
      refreshHz: options.refreshHz });
    const heightFt = point.altitudeFt == null ? null : point.altitudeFt - options.touchdown.altitudeFt;
    const expectedHeightFt = Math.tan(radians(options.glidepathDeg)) * approachRangeNm * EARTH_FT_PER_NM;
    const verticalDeviationFt = heightFt == null ? null : heightFt - expectedHeightFt;
    const azimuthDeviationDeg = degrees(Math.atan2(lateralDeviationNm, Math.max(approachRangeNm, EPSILON)));
    const elevationAngleDeg = heightFt == null ? null
      : degrees(Math.atan2(heightFt, Math.max(approachRangeNm, EPSILON) * EARTH_FT_PER_NM));
    const glidepathDeviationDeg = elevationAngleDeg == null ? null : elevationAngleDeg - options.glidepathDeg;
    return immutable({ sensor: 'par', timestamp, trackState: 'tracked', reason: null,
      refreshHz: options.refreshHz, rangeNm: approachRangeNm, lateralDeviationNm,
      azimuthDeviationDeg, elevationAngleDeg, glidepathDeviationDeg, verticalDeviationFt,
      lateralTrend: trend(lateralDeviationNm, previousTracked && { value: previousTracked.lateralDeviationNm }, 0.005),
      verticalTrend: trend(verticalDeviationFt, previousTracked && { value: previousTracked.verticalDeviationFt }, 10) });
  }

  function createParSensor(options = {}) {
    const refreshHz = Number(options.refreshHz ?? 1);
    if (!PAR_REFRESH_HZ.includes(refreshHz)) throw new Error('PAR refresh must be 1 Hz or 5 Hz.');
    const startSeconds = nonNegative(options.startSeconds ?? 0, 'Start time');
    const interval = 1 / refreshHz;
    let historySetting = validateHistory(options.history ?? 3);
    let lastTime = startSeconds;
    let nextSampleSeconds = startSeconds + interval;
    let previousTracked = null;
    const observations = [];
    const configuration = {
      source: options.source,
      refreshHz,
      runwayHeadingDeg: normalize(options.runwayHeadingDeg ?? 0),
      touchdown: {
        x: finite(options.touchdown?.x ?? options.touchdown?.xNm ?? 0, 'Touchdown x'),
        y: finite(options.touchdown?.y ?? options.touchdown?.yNm ?? 0, 'Touchdown y'),
        altitudeFt: finite(options.touchdown?.altitudeFt ?? 0, 'Touchdown altitude')
      },
      glidepathDeg: finite(options.glidepathDeg ?? 3, 'Glidepath'),
      maxRangeNm: nonNegative(options.maxRangeNm ?? 20, 'PAR range')
    };
    if (configuration.glidepathDeg <= 0 || configuration.glidepathDeg >= 10) {
      throw new Error('Glidepath must be greater than 0 and less than 10 degrees.');
    }

    function advance(toSeconds, truthAt) {
      const target = nonNegative(toSeconds, 'Authoritative time');
      if (target + EPSILON < lastTime) throw new Error('PAR time must be monotonic.');
      const sample = typeof truthAt === 'function' ? truthAt : () => truthAt;
      const emitted = [];
      while (nextSampleSeconds <= target + EPSILON) {
        const timestamp = Number(nextSampleSeconds.toFixed(9));
        const observation = parObservation(sample(timestamp), timestamp, configuration, previousTracked);
        observations.push(observation);
        emitted.push(observation);
        if (observation.trackState === 'tracked') previousTracked = observation;
        nextSampleSeconds += interval;
      }
      lastTime = target;
      return immutable(emitted);
    }

    function setHistory(value) {
      historySetting = validateHistory(value);
    }

    function getDisplay() {
      const latest = observations.length ? observations[observations.length - 1] : null;
      const tracked = observations.filter(item => item.trackState === 'tracked');
      const current = latest && latest.trackState === 'tracked' ? latest : null;
      const prior = current ? tracked.slice(0, -1) : tracked;
      return immutable({ current, history: historySetting ? prior.slice(-historySetting) : [],
        historySetting, trackState: latest ? latest.trackState : 'waiting', timestamp: lastTime });
    }

    function publicTrend(value) {
      if (value === 'closing') return 'closing';
      if (value === 'diverging') return 'opening';
      return 'stable';
    }

    function historyForStudent(item) {
      return {
        timestamp: item.timestamp,
        rangeNm: item.rangeNm,
        azimuthDeviationDeg: item.azimuthDeviationDeg,
        elevationDeviationDeg: item.glidepathDeviationDeg
      };
    }

    function studentObservation() {
      const display = getDisplay();
      const result = {
        trackState: display.trackState === 'tracked' ? 'tracking' : display.trackState === 'waiting' ? 'lost' : display.trackState,
        history: display.history.map(historyForStudent)
      };
      if (display.current) {
        result.timestamp = display.current.timestamp;
        result.rangeNm = display.current.rangeNm;
        result.azimuth = { deviationDeg: display.current.azimuthDeviationDeg,
          trend: publicTrend(display.current.lateralTrend) };
        result.elevation = { deviationDeg: display.current.glidepathDeviationDeg,
          trend: publicTrend(display.current.verticalTrend) };
      }
      return immutable(result);
    }

    return Object.freeze({ advance, setHistory, getDisplay, studentObservation,
      observations: () => immutable(observations),
      get refreshHz() { return refreshHz; }, get time() { return lastTime; } });
  }

  function createReviewTimeline() {
    const truth = [];
    const observations = [];
    const events = [];
    const sequence = { truth: 0, observation: 0, event: 0 };

    function timestampFor(value) {
      return nonNegative(value && (value.timestamp ?? value.simulationSeconds), 'Timeline timestamp');
    }

    function append(target, kind, value, fields = {}) {
      const timestamp = timestampFor(value);
      const previous = target[target.length - 1];
      if (previous && timestamp + EPSILON < previous.timestamp) throw new Error(kind + ' timeline must be monotonic.');
      const entry = immutable({ ...clone(value), ...fields, timestamp, sequence: sequence[kind]++ });
      target.push(entry);
      return entry;
    }

    return Object.freeze({
      recordTruth(value) { return append(truth, 'truth', value); },
      recordObservation(mode, value) {
        const sensor = String(mode || value?.sensor || '').trim();
        if (!sensor) throw new Error('Observation mode is required.');
        return append(observations, 'observation', value, { sensor });
      },
      recordEvent(value) { return append(events, 'event', value); },
      snapshot() {
        return immutable({ truth, observations, events,
          durationSeconds: Math.max(0, truth.length ? truth[truth.length - 1].timestamp : 0,
            observations.length ? observations[observations.length - 1].timestamp : 0,
            events.length ? events[events.length - 1].timestamp : 0) });
      }
    });
  }

  return Object.freeze({ RADAR_RPMS, PAR_REFRESH_HZ, HISTORY_SETTINGS, bearingFrom,
    createDfSensor, createSurveillanceSensor, createSraReferences, createParSensor, createReviewTimeline });
});
