(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QGHProcedure = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';
  const SCHEMA_VERSION = 1;
  const FT_PER_HPA = 27;
  const clone = value => JSON.parse(JSON.stringify(value));
  function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
  function bounded(value, min, max, label) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${label}: use ${min}–${max}.`);
    return number;
  }
  function weather(input = {}, previous = {}) {
    if (!input || Object.prototype.toString.call(input) !== '[object Object]') throw new Error('Weather must contain named training values.');
    const next = { windDirectionDeg: 0, windSpeedKt: 0, windGustKt: 0, visibilityM: 10000,
      cloudLayers: [], temperatureC: 20, dewPointC: 10, trend: 'no change', ...previous };
    const limits = { windDirectionDeg: [0, 360], windSpeedKt: [0, 150], windGustKt: [0, 200], visibilityM: [0, 100000], temperatureC: [-60, 60], dewPointC: [-80, 60] };
    const number = (value, min, max, label) => {
      if (typeof value !== 'number') throw new Error(`${label}: use a numeric training value.`);
      return bounded(value, min, max, label);
    };
    for (const [key, value] of Object.entries(input)) {
      if (Object.prototype.hasOwnProperty.call(limits, key)) next[key] = number(value, ...limits[key], key);
      else if (key === 'cloudLayers') {
        if (!Array.isArray(value)) throw new Error('Cloud layers must be a list.');
        next.cloudLayers = Array.from(value, layer => {
          if (!layer || typeof layer !== 'object' || Array.isArray(layer)
            || Object.keys(layer).some(name => !['cover', 'baseFt'].includes(name))
            || !['few', 'scattered', 'broken', 'overcast'].includes(layer.cover)) throw new Error('Unknown or malformed cloud layer.');
          return { cover: layer.cover, baseFt: number(layer.baseFt, 0, 60000, 'Cloud base feet') };
        });
      } else if (key === 'trend' && ['no change', 'improving', 'deteriorating'].includes(value)) next.trend = value;
      else throw new Error('Unsupported weather value.');
    }
    return next;
  }
  function environment(input = {}) {
    return {
      runway: String(input.runway || '15').toUpperCase(),
      aerodromeElevationFt: bounded(input.aerodromeElevationFt ?? 0, 0, 15000, 'Aerodrome elevation'),
      qnhHpa: bounded(input.qnhHpa ?? 1013, 850, 1100, 'QNH hPa'),
      qfeHpa: bounded(input.qfeHpa ?? 1013, 850, 1100, 'QFE hPa'),
      transitionAltitudeFt: bounded(input.transitionAltitudeFt ?? 10000, 1000, 25000, 'Transition altitude'),
      transitionLevel: bounded(input.transitionLevel ?? 120, 30, 300, 'Transition level'),
      weather: weather(input.weather),
      visualRangeNm: bounded(input.visualRangeNm ?? 2, .1, 10, 'Visual range'),
      visualAltitudeAalFt: bounded(input.visualAltitudeAalFt ?? 3000, 100, 10000, 'Visual altitude gate'),
      inboundSectorDeg: bounded(input.inboundSectorDeg ?? 45, 1, 90, 'Inbound sector'),
      overheadRangeNm: 1, overheadWindowSeconds: 60
    };
  }
  function aircraft(input) {
    const actual = bounded(input.level ?? 15000, 0, 45000, 'Initial altitude');
    return { id: input.id, callsign: input.callsign, actualAltitudeMslFt: actual,
      clearedAltitudeMslFt: actual, clearance: null, verticalMode: 'LEVEL',
      verticalRateFpm: bounded(input.verticalRateFpm ?? 1000, 100, 6000, 'Vertical rate'),
      pressureReference: 'QNH', squawk: '2000', transponderMode: 'ALT', frequency: null,
      pendingReports: [], visualOverride: null, aerodromeVisual: false, runwayVisual: false,
      overheadObservations: [], lastOverheadBearing: null, deferredSubject: null };
  }
  function create(input = {}) {
    const env = environment(input.environment);
    if (!/^(?:0[1-9]|[12]\d|3[0-6])[LRC]?$/.test(env.runway)) throw new Error('Runway designator must be 01–36 with optional L, R or C.');
    const fleet = (input.aircraft || []).map(aircraft);
    if (!fleet.length || new Set(fleet.map(a => a.id)).size !== fleet.length) throw new Error('Unique aircraft required.');
    if (fleet.some(a => a.actualAltitudeMslFt < env.aerodromeElevationFt)) throw new Error('Initial altitude must not be below aerodrome elevation.');
    return { schemaVersion: SCHEMA_VERSION, simulationSeconds: 0, environment: env,
      aircraft: Object.fromEntries(fleet.map(a => [a.id, a])), outcomes: [] };
  }
  function toMsl(target, env) {
    if (!target || !['QNH', 'QFE', 'STANDARD'].includes(target.datum)) throw new Error('Specify a valid level reference.');
    if (target.datum === 'STANDARD') return bounded(target.value, 0, 450, 'Flight level') * 100 - (1013.25 - env.qnhHpa) * FT_PER_HPA;
    const value = bounded(target.value, 0, 45000, 'Level feet');
    return target.datum === 'QFE' ? env.aerodromeElevationFt + value : value;
  }
  function displayedLevel(a, env, datum = a.pressureReference) {
    const value = datum === 'STANDARD' ? a.actualAltitudeMslFt + (1013.25 - env.qnhHpa) * FT_PER_HPA
      : datum === 'QFE' ? a.actualAltitudeMslFt - env.aerodromeElevationFt : a.actualAltitudeMslFt;
    return { datum, value: Math.round(value / 100) * (datum === 'STANDARD' ? 1 : 100) };
  }
  function levelText(target) {
    return target.datum === 'STANDARD' ? `FLIGHT LEVEL ${String(target.value).padStart(3, '0')}`
      : `${target.datum === 'QFE' ? 'HEIGHT' : 'ALTITUDE'} ${target.value} FEET`;
  }
  function levelReport(a, env) {
    const current = levelText(displayedLevel(a, env));
    return a.verticalMode === 'LEVEL' ? `MAINTAINING ${current}`
      : `PASSING ${current}, ${a.verticalMode === 'CLIMB' ? 'CLIMBING' : 'DESCENDING'} TO ${levelText(a.clearance)}`;
  }
  function visual(a, env, geometry, kind) {
    if (a.visualOverride === 'NOT_VISUAL') return false;
    if (a.visualOverride === 'VISUAL') return true;
    if (!geometry || !['inbound', 'final', 'overhead'].includes(geometry.phase)) return false;
    const aal = a.actualAltitudeMslFt - env.aerodromeElevationFt;
    const angle = Math.abs(((geometry.heading - geometry.inbound + 540) % 360) - 180);
    const ceiling = env.weather.cloudLayers.filter(layer => ['broken', 'overcast'].includes(layer.cover))
      .reduce((value, layer) => Math.min(value, layer.baseFt), Infinity);
    return geometry.range <= env.visualRangeNm && aal >= 0 && aal <= env.visualAltitudeAalFt
      && angle <= env.inboundSectorDeg && env.weather.visibilityM >= geometry.range * 1852
      && aal < ceiling && (kind !== 'runway' || angle <= Math.min(30, env.inboundSectorDeg));
  }
  function outcome(plan, timestamp, fields) {
    return freeze({ parseStatus: 'ACCEPTED', authorization: 'AUTHORIZED', executionStatus: 'RECEIVED',
      mutations: [], response: { kind: 'ROGER', text: 'ROGER' }, pendingReports: [],
      transmission: { shouldReply: true, dfEligible: true }, targetAircraftId: plan.aircraft,
      timestamp, ...fields });
  }
  // Pure validation on a cloned domain state; commit only after every field and conflict passes.
  function apply(state, plan, context = {}) {
    const original = state.aircraft[plan.aircraft];
    if (!original) return outcome(plan, state.simulationSeconds, { authorization: 'REJECTED', executionStatus: 'NOT_APPLIED',
      response: { kind: 'NONE', text: 'UNKNOWN AIRCRAFT' }, transmission: { shouldReply: false, dfEligible: false } });
    const draft = clone(state), a = draft.aircraft[plan.aircraft], env = draft.environment;
    const mutations = [], readbacks = []; let kind = 'READBACK', status = 'APPLIED', detach = false;
    try {
      if (!Array.isArray(plan.actions) || !plan.actions.length) throw new Error('An action is required.');
      const briefing = new Set(['pressure', 'runway', 'squawk', 'weather', 'frequency']);
      if (plan.actions.length > 1 && !plan.actions.every(action => briefing.has(action.type))) throw new Error('Separate flight instructions from other calls.');
      for (const action of plan.actions) {
        const target = action.target;
        switch (action.type) {
          case 'pressure':
            if (!['QNH', 'QFE', 'STANDARD'].includes(action.reference)) throw new Error('Specify QNH, QFE or standard.');
            if (action.reference !== 'STANDARD') {
              const pressure = bounded(action.value, 850, 1100, 'Pressure hPa');
              if (!Number.isInteger(pressure)) throw new Error('Use a whole pressure in hPa.');
              env[action.reference === 'QNH' ? 'qnhHpa' : 'qfeHpa'] = pressure;
              readbacks.push(`${action.reference} ${pressure}${pressure < 1000 ? ' HECTOPASCALS' : ''} SET`);
            } else readbacks.push('STANDARD PRESSURE SET');
            a.pressureReference = action.reference; break;
          case 'runway':
            if (!/^(?:0[1-9]|[12]\d|3[0-6])[LRC]?$/.test(action.value)) throw new Error('Runway must be 01–36 with optional L, R or C.');
            env.runway = action.value; readbacks.push(`RUNWAY ${action.value}`); break;
          case 'squawk':
            if (!/^[0-7]{4}$/.test(action.value)) throw new Error('Squawk needs four digits from 0 to 7.');
            a.squawk = action.value; readbacks.push(`SQUAWK ${action.value}`); break;
          case 'frequency':
            a.frequency = bounded(action.value, 118, 399.975, 'Training frequency MHz');
            readbacks.push(`FREQUENCY ${a.frequency.toFixed(3)}`); break;
          case 'weather':
            if (action.values === undefined) throw new Error('Specify weather values.');
            env.weather = weather(action.values, env.weather);
            break;
          case 'vertical': {
            if (!['CLIMB', 'DESCENT', 'MAINTAIN'].includes(action.direction)) throw new Error('Specify climb, descend or maintain.');
            const msl = bounded(toMsl(target, env), env.aerodromeElevationFt, 45000, 'Cleared MSL altitude');
            if (action.direction === 'CLIMB' && msl < a.actualAltitudeMslFt || action.direction === 'DESCENT' && msl > a.actualAltitudeMslFt) throw new Error('Level conflicts with climb or descent direction.');
            a.clearedAltitudeMslFt = msl; a.clearance = clone(target); a.pressureReference = target.datum;
            a.verticalMode = msl > a.actualAltitudeMslFt ? 'CLIMB' : msl < a.actualAltitudeMslFt ? 'DESCENT' : 'LEVEL';
            a.pendingReports = a.pendingReports.filter(report => report.kind !== 'reaching');
            if (action.reportReaching) a.pendingReports.push({ kind: 'reaching', msl, target: clone(target) });
            readbacks.push(`${a.verticalMode === 'LEVEL' ? 'MAINTAINING' : a.verticalMode === 'CLIMB' ? 'CLIMBING TO' : 'DESCENDING TO'} ${levelText(target)}${action.reportReaching ? ', WILCO' : ''}`);
            detach = Boolean(context.follower); break;
          }
          case 'stop-vertical':
            a.verticalMode = 'LEVEL'; a.clearedAltitudeMslFt = a.actualAltitudeMslFt; a.clearance = displayedLevel(a, env);
            a.pendingReports = a.pendingReports.filter(report => report.kind !== 'reaching');
            readbacks.push(`MAINTAINING ${levelText(a.clearance)}`); detach = Boolean(context.follower); break;
          case 'vertical-rate':
            a.verticalRateFpm = bounded(action.value, 100, 6000, 'Vertical rate'); readbacks.push(`VERTICAL RATE ${a.verticalRateFpm} FEET PER MINUTE`); detach = Boolean(context.follower); break;
          case 'report-level':
            readbacks.push(action.datum ? `${a.verticalMode === 'LEVEL' ? 'MAINTAINING' : 'PASSING'} ${levelText(displayedLevel(a, env, action.datum))}` : levelReport(a, env)); status = 'RECEIVED'; break;
          case 'report-pressure': readbacks.push(a.pressureReference === 'STANDARD' ? 'STANDARD PRESSURE SET'
            : `${a.pressureReference} ${a.pressureReference === 'QNH' ? env.qnhHpa : env.qfeHpa} HECTOPASCALS SET`); status = 'RECEIVED'; break;
          case 'report-squawk': readbacks.push(`SQUAWK ${a.squawk}`); status = 'RECEIVED'; break;
          case 'arm-level': {
            if (!['passing', 'reaching'].includes(action.kind)) throw new Error('Specify passing or reaching.');
            const sample = target || a.clearance;
            if (!sample) throw new Error('No cleared level to report reaching.');
            // A later pressure update must not move an already accepted target.
            const msl = target ? toMsl(sample, env) : a.clearedAltitudeMslFt;
            a.pendingReports = a.pendingReports.filter(report => report.kind !== action.kind || report.msl !== msl);
            a.pendingReports.push({ kind: action.kind, msl, target: clone(sample) });
            status = 'ARMED'; kind = 'WILCO'; readbacks.push(`WILL REPORT ${action.kind.toUpperCase()} ${levelText(sample)}`); break;
          }
          case 'report-visual': {
            const sighted = visual(a, env, context.geometry, action.kind);
            a[action.kind === 'runway' ? 'runwayVisual' : 'aerodromeVisual'] = sighted;
            readbacks.push(sighted ? `${action.kind.toUpperCase()} IN SIGHT` : `NEGATIVE, ${action.kind.toUpperCase()} NOT IN SIGHT`); status = 'RECEIVED'; break;
          }
          case 'standby': a.deferredSubject = action.subject; status = 'DEFERRED'; kind = 'ROGER'; readbacks.push('STANDING BY'); break;
          case 'unsupported': status = 'NOT_APPLIED'; kind = 'UNABLE'; readbacks.push('REQUEST RECEIVED, NOT SIMULATED'); break;
          default: throw new Error('Unsupported procedure action.');
        }
        if (!action.type.startsWith('report-') && !['unsupported', 'standby'].includes(action.type)) mutations.push(clone(action));
      }
      const verticalChange = plan.actions.some(action => ['vertical', 'stop-vertical', 'vertical-rate'].includes(action.type));
      if (verticalChange) {
        const replacesAltitude = plan.actions.some(action => ['vertical', 'stop-vertical'].includes(action.type));
        const companions = context.attachedIds || [];
        const affected = new Set([a.id, ...companions]);
        const originalDelta = a.clearedAltitudeMslFt - original.actualAltitudeMslFt;
        for (const id of companions) {
          const member = draft.aircraft[id];
          if (!member) continue;
          member.clearedAltitudeMslFt = bounded(member.actualAltitudeMslFt + originalDelta, env.aerodromeElevationFt, 45000, 'Formation altitude');
          member.verticalMode = a.verticalMode; member.verticalRateFpm = a.verticalRateFpm;
          member.clearance = { datum: 'QNH', value: member.clearedAltitudeMslFt };
          if (replacesAltitude) member.pendingReports = member.pendingReports.filter(report => report.kind !== 'reaching');
        }
        const conflicts = [];
        for (const id of affected) for (const other of Object.values(draft.aircraft)) {
          if (affected.has(other.id)) continue;
          const member = draft.aircraft[id];
          // Relative altitude is linear until either aircraft levels off. Check
          // both arrival times, not just cleared levels: a faster climb may
          // catch another aircraft even when their final levels are separated.
          const arrival = ac => ac.verticalMode === 'LEVEL' ? 0 : Math.abs(ac.clearedAltitudeMslFt - ac.actualAltitudeMslFt) * 60 / ac.verticalRateFpm;
          const projected = (ac, seconds) => ac.actualAltitudeMslFt + (ac.verticalMode === 'LEVEL' ? 0 : Math.sign(ac.clearedAltitudeMslFt - ac.actualAltitudeMslFt) * Math.min(Math.abs(ac.clearedAltitudeMslFt - ac.actualAltitudeMslFt), ac.verticalRateFpm * seconds / 60));
          const times = [...new Set([0, arrival(member), arrival(other)])].sort((left, right) => left - right);
          const separations = times.map(seconds => projected(member, seconds) - projected(other, seconds));
          if (separations.some((gap, i) => Math.abs(gap) < 1000 - 1e-7 || i > 0 && gap * separations[i - 1] < 0)) conflicts.push(other.callsign);
        }
        if (conflicts.length && !context.confirmSeparation) {
          return outcome(plan, state.simulationSeconds, { authorization: 'REJECTED', executionStatus: 'NOT_APPLIED',
            response: { kind: 'NONE', text: `CONFIRM SEPARATION CONFLICT: ${[...new Set(conflicts)].join(', ')}` },
            requiresSeparationConfirmation: true, transmission: { shouldReply: false, dfEligible: false } });
        }
      }
      if (!readbacks.length) { kind = 'ROGER'; status = 'RECEIVED'; readbacks.push('ROGER, WEATHER RECEIVED'); }
      const result = outcome(plan, state.simulationSeconds, { executionStatus: status, mutations,
        response: { kind, text: readbacks.join(', ') }, pendingReports: clone(a.pendingReports), detach });
      state.environment = draft.environment; state.aircraft = draft.aircraft;
      state.outcomes.push(result); return result;
    } catch (error) {
      const result = outcome(plan, state.simulationSeconds, { authorization: 'REJECTED', executionStatus: 'NOT_APPLIED',
        response: { kind: 'SAY_AGAIN', text: `SAY AGAIN. ${error.message}` } });
      state.outcomes.push(result); return result;
    }
  }
  function step(state, duration, following = {}) {
    duration = bounded(duration, 0, 3600, 'Vertical time step');
    const reports = [], previous = Object.fromEntries(Object.values(state.aircraft).map(a => [a.id, a.actualAltitudeMslFt]));
    for (const a of Object.values(state.aircraft)) {
      if (following[a.id]) continue;
      const delta = a.clearedAltitudeMslFt - a.actualAltitudeMslFt;
      if (a.verticalMode !== 'LEVEL') a.actualAltitudeMslFt += Math.sign(delta) * Math.min(Math.abs(delta), a.verticalRateFpm * duration / 60);
      if (Math.abs(a.clearedAltitudeMslFt - a.actualAltitudeMslFt) < 1e-7) a.verticalMode = 'LEVEL';
    }
    for (const [id, leaderId] of Object.entries(following)) {
      const a = state.aircraft[id], leader = state.aircraft[leaderId];
      if (!a || !leader) continue;
      a.actualAltitudeMslFt = previous[id] + leader.actualAltitudeMslFt - previous[leaderId];
      a.clearedAltitudeMslFt = leader.clearedAltitudeMslFt + previous[id] - previous[leaderId];
      a.verticalMode = leader.verticalMode; a.verticalRateFpm = leader.verticalRateFpm;
      a.clearance = { datum: 'QNH', value: a.clearedAltitudeMslFt };
    }
    for (const a of Object.values(state.aircraft)) {
      a.pendingReports = a.pendingReports.filter(report => {
        const start = previous[a.id], end = a.actualAltitudeMslFt;
        const crossed = start !== end && (report.msl - start) * (report.msl - end) <= 0 && report.msl !== start;
        const reached = report.kind === 'reaching' && Math.abs(end - report.msl) < 1e-7;
        if (!crossed && !reached) return true;
        const elapsed = start === end ? 0 : Math.min(duration, Math.abs(report.msl - start) / a.verticalRateFpm * 60);
        reports.push(freeze({ source: a.id, callsign: a.callsign, timestamp: state.simulationSeconds + elapsed,
          text: `${report.kind === 'reaching' ? 'REACHING' : 'PASSING'} ${levelText(report.target)}` }));
        return false;
      });
    }
    state.simulationSeconds += duration; return reports.sort((a, b) => a.timestamp - b.timestamp);
  }
  function observeOverhead(state, id, sample, transmissionId) {
    const a = state.aircraft[id], env = state.environment;
    if (!a || !sample) return false;
    if (sample.range > env.overheadRangeNm) { a.overheadObservations = []; a.lastOverheadBearing = null; return false; }
    const previous = a.lastOverheadBearing;
    const rapid = previous && state.simulationSeconds - previous.time <= env.overheadWindowSeconds && Number.isFinite(sample.qte) && Number.isFinite(previous.qte)
      && Math.abs(((sample.qte - previous.qte + 540) % 360) - 180) >= 45;
    a.lastOverheadBearing = { qte: sample.qte, time: state.simulationSeconds };
    a.overheadObservations = a.overheadObservations.filter(item => state.simulationSeconds - item.time <= env.overheadWindowSeconds);
    if ((sample.overhead || rapid) && !a.overheadObservations.some(item => item.id === transmissionId)) {
      a.overheadObservations.push({ id: transmissionId, time: state.simulationSeconds });
    }
    if (a.overheadObservations.length < 2) return false;
    a.overheadObservations = []; return true;
  }
  function migrate(value) {
    try {
      const input = clone(value);
      if (input.schemaVersion > SCHEMA_VERSION) return { ok: false, original: value };
      const next = create({ environment: input.environment, aircraft: Object.values(input.aircraft || {}).map(a => ({ ...a, level: a.actualAltitudeMslFt ?? a.level })) });
      if (input.schemaVersion === SCHEMA_VERSION) {
        input.environment = { ...input.environment, weather: next.environment.weather };
        bounded(input.simulationSeconds, 0, Number.MAX_SAFE_INTEGER, 'Simulation time');
        for (const a of Object.values(input.aircraft)) {
          bounded(a.clearedAltitudeMslFt, next.environment.aerodromeElevationFt, 45000, 'Cleared altitude');
          bounded(a.verticalRateFpm, 100, 6000, 'Vertical rate');
          if (!['QNH', 'QFE', 'STANDARD'].includes(a.pressureReference) || !['LEVEL', 'CLIMB', 'DESCENT'].includes(a.verticalMode)) throw new Error('Invalid saved vertical state.');
          if (a.clearance) toMsl(a.clearance, next.environment);
          if (!Array.isArray(a.pendingReports)) throw new Error('Invalid saved reports.');
          for (const report of a.pendingReports) {
            if (!['passing', 'reaching'].includes(report.kind)) throw new Error('Invalid saved report kind.');
            bounded(report.msl, 0, 45000, 'Report altitude'); toMsl(report.target, next.environment);
          }
        }
        return { ok: true, state: input };
      }
      return { ok: true, state: next };
    } catch { return { ok: false, original: value }; }
  }
  return Object.freeze({ SCHEMA_VERSION, FT_PER_HPA, create, apply, step, toMsl, displayedLevel, levelText, levelReport, visual, observeOverhead, migrate });
});
