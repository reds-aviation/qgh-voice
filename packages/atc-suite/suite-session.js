(function exposeAtcSuiteSession(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ATCSuiteSession = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function createSessionModule(root) {
  'use strict';

  const PROTOCOL_VERSION = 1;
  const PIN_TTL_MS = 15 * 60 * 1000;
  const HEARTBEAT_TIMEOUT_MS = 15 * 1000;
  const MAX_MESSAGE_BYTES = 64 * 1024;
  const DISCOVERY_PREFIX = 'reds.atc-suite.discovery.';
  const CHANNEL_PREFIX = 'reds-atc-suite-';

  const TYPES = Object.freeze({
    JOIN_REQUEST: 'join-request',
    REJOIN_REQUEST: 'rejoin-request',
    READY: 'ready',
    STUDENT_HEARTBEAT: 'student-heartbeat',
    PREFERENCES: 'preferences',
    PILOT_PLAYBACK: 'pilot-playback',
    ADMISSION_GRANTED: 'admission-granted',
    ADMISSION_REJECTED: 'admission-rejected',
    LIFECYCLE: 'lifecycle',
    PUBLIC_METADATA: 'public-metadata',
    OBSERVATION: 'observation',
    CAPTION: 'caption',
    HOST_HEARTBEAT: 'host-heartbeat',
    STUDENT_DISCONNECTED: 'student-disconnected',
    TERMINATED: 'terminated'
  });

  const STUDENT_TYPES = new Set([
    TYPES.JOIN_REQUEST, TYPES.REJOIN_REQUEST, TYPES.READY,
    TYPES.STUDENT_HEARTBEAT, TYPES.PREFERENCES, TYPES.PILOT_PLAYBACK
  ]);
  const INSTRUCTOR_TYPES = new Set([
    TYPES.ADMISSION_GRANTED, TYPES.ADMISSION_REJECTED, TYPES.LIFECYCLE,
    TYPES.PUBLIC_METADATA, TYPES.OBSERVATION, TYPES.CAPTION,
    TYPES.HOST_HEARTBEAT, TYPES.STUDENT_DISCONNECTED, TYPES.TERMINATED
  ]);
  const ALL_TYPES = new Set([...STUDENT_TYPES, ...INSTRUCTOR_TYPES]);
  const STUDENT_PAYLOAD_KEYS = Object.freeze({
    [TYPES.JOIN_REQUEST]: ['clientId', 'pin', 'seat'],
    [TYPES.REJOIN_REQUEST]: ['clientId', 'pin', 'seatToken'],
    [TYPES.READY]: ['clientId', 'seatToken', 'audioMode'],
    [TYPES.STUDENT_HEARTBEAT]: ['clientId', 'seatToken'],
    [TYPES.PREFERENCES]: ['clientId', 'seatToken', 'captions', 'audioEnabled'],
    [TYPES.PILOT_PLAYBACK]: ['clientId', 'seatToken', 'transmissionId', 'phase']
  });
  const INSTRUCTOR_PAYLOAD_KEYS = Object.freeze({
    [TYPES.ADMISSION_GRANTED]: ['seatToken', 'rejoined', 'publicMetadata'],
    [TYPES.ADMISSION_REJECTED]: ['reason'],
    [TYPES.LIFECYCLE]: ['state'],
    [TYPES.PUBLIC_METADATA]: ['publicMetadata'],
    [TYPES.OBSERVATION]: ['observation'],
    [TYPES.CAPTION]: ['caption', 'transmissionId'],
    [TYPES.HOST_HEARTBEAT]: ['state'],
    [TYPES.STUDENT_DISCONNECTED]: ['reason'],
    [TYPES.TERMINATED]: ['reason']
  });
  const FORBIDDEN_STUDENT_KEYS = new Set([
    'x', 'y', 'lat', 'lon', 'latitude', 'longitude', 'position', 'coordinates',
    'heading', 'magneticheading', 'initialheading', 'targetheading', 'turnstate',
    'turnrate', 'controlstate', 'instructorcontrols', 'truth', 'truthstate',
    'truthtrack', 'truthtrail', 'flightpath', 'velocity', 'aircraftstate'
  ]);
  const ENVELOPE_KEYS = Object.freeze([
    'protocol', 'type', 'sessionId', 'senderRole', 'senderId', 'revision',
    'simulationTime', 'sentAt', 'targetClientId', 'payload'
  ]);

  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }

  function jsonClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function byteLength(value) {
    let serialized;
    try { serialized = JSON.stringify(value); } catch (_) { return Infinity; }
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(serialized).length;
    if (typeof Buffer !== 'undefined') return Buffer.byteLength(serialized, 'utf8');
    return serialized.length;
  }

  function normalizeKey(key) {
    return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function inspectObject(value, visitor, depth = 0, budget = { nodes: 0 }) {
    if (depth > 12 || ++budget.nodes > 4000) throw new Error('payload-complexity');
    if (value == null || typeof value !== 'object') return;
    if (!Array.isArray(value) && !isPlainObject(value)) throw new Error('non-plain-payload');
    if (Array.isArray(value)) {
      value.forEach(item => inspectObject(item, visitor, depth + 1, budget));
      return;
    }
    for (const [key, item] of Object.entries(value)) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new Error('unsafe-key');
      visitor(key, item);
      inspectObject(item, visitor, depth + 1, budget);
    }
  }

  function containsForbiddenTruth(value) {
    try {
      let found = false;
      inspectObject(value, key => { if (FORBIDDEN_STUDENT_KEYS.has(normalizeKey(key))) found = true; });
      return found;
    } catch (_) {
      return true;
    }
  }

  function hasOnlyKeys(value, allowed) {
    return isPlainObject(value) && Object.keys(value).every(key => allowed.includes(key));
  }

  function finite(value, minimum = -Infinity, maximum = Infinity) {
    return Number.isFinite(value) && value >= minimum && value <= maximum;
  }

  function text(value, maximum = 80) {
    return typeof value === 'string' && value.length > 0 && value.length <= maximum ? value : null;
  }

  function safeId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value);
  }

  function secureSource(source) {
    const selected = source || (root && root.crypto);
    if (!selected || typeof selected.getRandomValues !== 'function') {
      throw new Error('A cryptographically secure random source is required.');
    }
    return selected;
  }

  function secureInteger(range, source) {
    const cryptoSource = secureSource(source);
    const upper = 0x100000000;
    const limit = Math.floor(upper / range) * range;
    const values = new Uint32Array(1);
    do { cryptoSource.getRandomValues(values); } while (values[0] >= limit);
    return values[0] % range;
  }

  function generatePin(source) {
    return String(100000 + secureInteger(900000, source));
  }

  function generateHex(bytes, source) {
    const values = new Uint8Array(bytes);
    secureSource(source).getRandomValues(values);
    return Array.from(values, value => value.toString(16).padStart(2, '0')).join('');
  }

  function discoveryKey(pin) {
    return `${DISCOVERY_PREFIX}${pin}`;
  }

  function writeDiscovery(storage, metadata) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    const safe = {
      protocol: PROTOCOL_VERSION,
      sessionId: metadata.sessionId,
      channelName: metadata.channelName,
      createdAt: metadata.createdAt,
      expiresAt: metadata.expiresAt
    };
    if (!/^\d{6}$/.test(metadata.pin) || !safeId(safe.sessionId)
      || !text(safe.channelName, 120) || !finite(safe.createdAt, 0) || !finite(safe.expiresAt, safe.createdAt)) return false;
    try { storage.setItem(discoveryKey(metadata.pin), JSON.stringify(safe)); return true; } catch (_) { return false; }
  }

  function readDiscovery(storage, pin, now = Date.now()) {
    if (!storage || typeof storage.getItem !== 'function' || !/^\d{6}$/.test(String(pin))) return null;
    try {
      const raw = storage.getItem(discoveryKey(String(pin)));
      const value = raw && JSON.parse(raw);
      if (!isPlainObject(value) || value.protocol !== PROTOCOL_VERSION || !safeId(value.sessionId)
        || !text(value.channelName, 120) || !finite(value.createdAt, 0)
        || !finite(value.expiresAt, value.createdAt) || now >= value.expiresAt) return null;
      return deepFreeze({ ...value });
    } catch (_) { return null; }
  }

  function clearDiscovery(storage, pin) {
    if (!storage || typeof storage.removeItem !== 'function') return false;
    try { storage.removeItem(discoveryKey(pin)); return true; } catch (_) { return false; }
  }

  function validateEnvelope(message, options = {}) {
    if (!isPlainObject(message)) return { ok: false, reason: 'invalid-envelope' };
    if (byteLength(message) > (options.maxBytes || MAX_MESSAGE_BYTES)) return { ok: false, reason: 'oversized' };
    try { inspectObject(message, () => {}); } catch (error) { return { ok: false, reason: error.message }; }
    if (!Object.keys(message).every(key => ENVELOPE_KEYS.includes(key))) {
      return { ok: false, reason: 'invalid-envelope-fields' };
    }
    if (message.protocol !== PROTOCOL_VERSION) return { ok: false, reason: 'unsupported-protocol' };
    if (!ALL_TYPES.has(message.type)) return { ok: false, reason: 'unknown-type' };
    if (!safeId(message.sessionId) || !safeId(message.senderId)) return { ok: false, reason: 'invalid-identity' };
    if (!['instructor', 'student'].includes(message.senderRole)) return { ok: false, reason: 'invalid-role' };
    if (!Number.isSafeInteger(message.revision) || message.revision < 1) return { ok: false, reason: 'invalid-revision' };
    if (!finite(message.simulationTime, 0) || !finite(message.sentAt, 0)) return { ok: false, reason: 'invalid-time' };
    if (!isPlainObject(message.payload)) return { ok: false, reason: 'invalid-payload' };
    if (message.targetClientId != null && !safeId(message.targetClientId)) return { ok: false, reason: 'invalid-target' };
    if (options.sessionId && message.sessionId !== options.sessionId) return { ok: false, reason: 'wrong-session' };
    if (options.role && message.senderRole !== options.role) return { ok: false, reason: 'wrong-role' };
    const expectedTypes = options.role === 'student' ? STUDENT_TYPES : options.role === 'instructor' ? INSTRUCTOR_TYPES : null;
    if (expectedTypes && !expectedTypes.has(message.type)) {
      return { ok: false, reason: options.role === 'student' ? 'student-mutation' : 'invalid-direction' };
    }
    return { ok: true };
  }

  function validateStudentMessage(message, options = {}) {
    const envelope = validateEnvelope(message, { ...options, role: 'student' });
    if (!envelope.ok) return envelope;
    if (containsForbiddenTruth(message.payload)) return { ok: false, reason: 'truth-shaped-payload' };
    if (!hasOnlyKeys(message.payload, STUDENT_PAYLOAD_KEYS[message.type])) return { ok: false, reason: 'student-mutation' };
    if (message.payload.clientId !== message.senderId) return { ok: false, reason: 'identity-mismatch' };
    if ([TYPES.JOIN_REQUEST, TYPES.REJOIN_REQUEST].includes(message.type) && !/^\d{6}$/.test(message.payload.pin)) {
      return { ok: false, reason: 'invalid-pin' };
    }
    if (message.type === TYPES.JOIN_REQUEST && message.payload.seat !== 'controller') return { ok: false, reason: 'invalid-seat' };
    if ([TYPES.REJOIN_REQUEST, TYPES.READY, TYPES.STUDENT_HEARTBEAT, TYPES.PREFERENCES, TYPES.PILOT_PLAYBACK].includes(message.type)
      && !text(message.payload.seatToken, 64)) return { ok: false, reason: 'invalid-seat-token' };
    if (message.type === TYPES.READY && !['audio', 'captions'].includes(message.payload.audioMode)) {
      return { ok: false, reason: 'invalid-audio-mode' };
    }
    if (message.type === TYPES.PILOT_PLAYBACK && (!text(message.payload.transmissionId, 120)
      || !['started', 'ended', 'unavailable'].includes(message.payload.phase))) return { ok: false, reason: 'invalid-playback' };
    if (message.type === TYPES.PREFERENCES
      && (typeof message.payload.captions !== 'boolean' || typeof message.payload.audioEnabled !== 'boolean')) {
      return { ok: false, reason: 'invalid-preferences' };
    }
    return { ok: true };
  }

  function validateInstructorMessage(message, options = {}) {
    const envelope = validateEnvelope(message, { ...options, role: 'instructor' });
    if (!envelope.ok) return envelope;
    if (containsForbiddenTruth(message.payload)) return { ok: false, reason: 'truth-shaped-payload' };
    if (!hasOnlyKeys(message.payload, INSTRUCTOR_PAYLOAD_KEYS[message.type])) {
      return { ok: false, reason: 'invalid-instructor-payload' };
    }
    return { ok: true };
  }

  function copyNumber(target, source, key, minimum, maximum) {
    if (source[key] == null) return;
    if (!finite(source[key], minimum, maximum)) throw new Error(`invalid-${key}`);
    target[key] = source[key];
  }

  function copyText(target, source, key, maximum = 80, choices) {
    if (source[key] == null) return;
    const value = text(source[key], maximum);
    if (!value || (choices && !choices.includes(value))) throw new Error(`invalid-${key}`);
    target[key] = value;
  }

  function sanitizeSurveillanceMetadata(value) {
    if (!isPlainObject(value)) throw new Error('invalid-surveillance');
    for (const key of ['secondary', 'modeS']) {
      if (value[key] != null && typeof value[key] !== 'boolean') throw new Error(`invalid-surveillance-${key}`);
    }
    let squawk;
    if (value.squawk != null) {
      if (typeof value.squawk !== 'string' || !/^[0-7]{4}$/.test(value.squawk)) throw new Error('invalid-surveillance-squawk');
      squawk = value.squawk;
    }
    let modeSId;
    if (value.modeSId != null) {
      if (typeof value.modeSId !== 'string' || !/^[0-9A-F]{6}$/.test(value.modeSId)) throw new Error('invalid-surveillance-modeSId');
      modeSId = value.modeSId;
    }
    const modeS = value.modeS === true || modeSId != null;
    const secondary = value.secondary === true || modeS || squawk != null;
    return secondary ? { secondary: true, ...(modeS ? { modeS: true } : {}), ...(squawk ? { squawk } : {}), ...(modeSId ? { modeSId } : {}) } : null;
  }

  function sanitizeRadarEnvironment(value) {
    if (!isPlainObject(value) || containsForbiddenTruth(value)) throw new Error('invalid-radarEnvironment');
    const safe = {};
    copyNumber(safe, value, 'runwayOrientationDeg', 0, 359);
    if (value.extendedCentreline != null) {
      if (typeof value.extendedCentreline !== 'boolean') throw new Error('invalid-extendedCentreline');
      safe.extendedCentreline = value.extendedCentreline;
    }
    copyNumber(safe, value, 'extendedCentrelineNm', 0, 100);
    if (safe.extendedCentreline == null && safe.extendedCentrelineNm != null) safe.extendedCentreline = true;
    copyNumber(safe, value, 'centrelineTickNm', .5, 20);
    if (value.sraDescentProfile != null) {
      if (typeof value.sraDescentProfile !== 'boolean') throw new Error('invalid-sraDescentProfile');
      safe.sraDescentProfile = value.sraDescentProfile;
    }
    if (value.lfaBoundary != null) {
      if (!Array.isArray(value.lfaBoundary) || value.lfaBoundary.length > 12
        || (value.lfaBoundary.length && value.lfaBoundary.length < 3)) throw new Error('invalid-lfaBoundary');
      safe.lfaBoundary = value.lfaBoundary.map((point, index) => {
        if (!isPlainObject(point) || containsForbiddenTruth(point)) throw new Error(`invalid-lfaBoundary-${index}`);
        const vertex = {};
        copyNumber(vertex, point, 'bearingDeg', 0, 359);
        copyNumber(vertex, point, 'rangeNm', 0, 100);
        if (vertex.bearingDeg == null || vertex.rangeNm == null) throw new Error(`invalid-lfaBoundary-${index}`);
        return vertex;
      });
    }
    return safe;
  }

  function sanitizedRadarPlot(plot, correlated) {
    if (!isPlainObject(plot) || containsForbiddenTruth(plot)) throw new Error('invalid-observation-plot');
    const safe = {};
    copyNumber(safe, plot, 'timestamp', 0, Number.MAX_SAFE_INTEGER);
    copyNumber(safe, plot, 'rangeNm', 0, 250);
    copyNumber(safe, plot, 'azimuthDeg', 0, 360);
    if (plot.trackId != null) {
      if (typeof plot.trackId !== 'string' || !/^T[1-9][0-9]{0,30}$/.test(plot.trackId)) throw new Error('invalid-trackId');
      safe.trackId = plot.trackId;
    }
    if (correlated && plot.surveillance != null) {
      const surveillance = sanitizeSurveillanceMetadata(plot.surveillance);
      // The training scope may mix primary and secondary targets. A primary
      // return must never inherit identity or track data from the global
      // correlated profile.
      if (surveillance) {
        copyText(safe, plot, 'callsign', 32);
        copyNumber(safe, plot, 'altitudeFt', -2000, 100000);
        copyNumber(safe, plot, 'headingDeg', 0, 359);
        copyNumber(safe, plot, 'groundSpeedKt', 0, 700);
        safe.surveillance = surveillance;
      }
    }
    return safe;
  }

  function sanitizedParPanel(panel) {
    if (!isPlainObject(panel) || containsForbiddenTruth(panel)) throw new Error('invalid-par-panel');
    const safe = {};
    copyNumber(safe, panel, 'deviationDeg', -20, 20);
    copyText(safe, panel, 'trend', 16, ['opening', 'closing', 'stable', 'left', 'right', 'above', 'below']);
    return safe;
  }

  function sanitizedParHistory(point) {
    if (!isPlainObject(point) || containsForbiddenTruth(point)) throw new Error('invalid-par-history');
    const safe = {};
    copyNumber(safe, point, 'timestamp', 0, Number.MAX_SAFE_INTEGER);
    copyNumber(safe, point, 'rangeNm', 0, 50);
    copyNumber(safe, point, 'azimuthDeviationDeg', -20, 20);
    copyNumber(safe, point, 'elevationDeviationDeg', -20, 20);
    return safe;
  }

  function sanitizeStudentObservation(observation, context = {}) {
    if (!isPlainObject(observation) || containsForbiddenTruth(observation)) throw new Error('truth-shaped-observation');
    const wrapped = isPlainObject(observation.observation) && observation.mode;
    const source = wrapped ? observation.observation : observation;
    const mode = wrapped ? observation.mode : observation.mode || context.mode;
    if (!['qgh', 'surveillance', 'sra', 'par'].includes(mode)) throw new Error('invalid-observation-mode');
    const safe = { mode };
    if (mode === 'qgh') {
      copyText(safe, source, 'status', 16, ['live', 'held', 'idle', 'unavailable']);
      copyText(safe, source, 'transmissionState', 16, ['pilot', 'held', 'idle']);
      copyText(safe, source, 'bearingType', 8, ['qdm', 'qte']);
      copyNumber(safe, source, 'bearingDeg', 0, 360);
      if (['pilot', 'held'].includes(safe.transmissionState)) copyText(safe, source, 'callsign', 32);
    } else if (mode === 'surveillance' || mode === 'sra') {
      const declaredProfile = context.profile
        || context.radarProfile
        || (wrapped && observation.publicScenario && observation.publicScenario.displayProfile)
        || source.profile;
      const correlated = ['correlated', 'correlated-training'].includes(declaredProfile);
      copyNumber(safe, source, 'scanAngleDeg', 0, 360);
      if (source.plot != null) safe.plot = sanitizedRadarPlot(source.plot, correlated);
      if (source.plots != null) {
        if (!Array.isArray(source.plots) || source.plots.length > 24) throw new Error('invalid-plots');
        safe.plots = source.plots.map(item => sanitizedRadarPlot(item, correlated));
      }
      if (source.history != null) {
        if (!Array.isArray(source.history) || source.history.length > 120) throw new Error('invalid-history');
        safe.history = source.history.map(item => sanitizedRadarPlot(item, correlated));
      }
      if (mode === 'sra' && source.overlays != null) {
        if (!isPlainObject(source.overlays) || containsForbiddenTruth(source.overlays)) throw new Error('invalid-overlays');
        const overlays = {};
        copyNumber(overlays, source.overlays, 'runwayOrientationDeg', 0, 360);
        copyNumber(overlays, source.overlays, 'centrelineDeg', 0, 360);
        copyNumber(overlays, source.overlays, 'touchdownRangeNm', 0, 50);
        copyNumber(overlays, source.overlays, 'terminationRangeNm', 0, 50);
        safe.overlays = overlays;
      }
    } else {
      copyNumber(safe, source, 'timestamp', 0, Number.MAX_SAFE_INTEGER);
      copyNumber(safe, source, 'rangeNm', 0, 50);
      if (source.azimuth != null) safe.azimuth = sanitizedParPanel(source.azimuth);
      if (source.elevation != null) safe.elevation = sanitizedParPanel(source.elevation);
      copyText(safe, source, 'trackState', 16, ['tracking', 'coasting', 'lost']);
      if (source.history != null) {
        if (!Array.isArray(source.history) || source.history.length > 5) throw new Error('invalid-history');
        safe.history = source.history.map(sanitizedParHistory);
      }
    }
    return deepFreeze(safe);
  }

  function sanitizePublicMetadata(metadata) {
    if (!isPlainObject(metadata) || containsForbiddenTruth(metadata)) throw new Error('truth-shaped-public-metadata');
    const safe = {};
    copyText(safe, metadata, 'mode', 16, ['qgh', 'surveillance', 'sra', 'par']);
    copyText(safe, metadata, 'procedure', 16, ['normal', 'us']);
    copyText(safe, metadata, 'callsign', 32);
    copyText(safe, metadata, 'approachCallsign', 32);
    copyNumber(safe, metadata, 'aircraftCount', 1, 24);
    if (safe.aircraftCount != null && !Number.isInteger(safe.aircraftCount)) throw new Error('invalid-aircraftCount');
    copyNumber(safe, metadata, 'glidepathDeg', 0.1, 15);
    if (metadata.radarProfile === 'correlated') safe.radarProfile = 'correlated-training';
    else copyText(safe, metadata, 'radarProfile', 24, ['primary', 'correlated-training']);
    copyText(safe, metadata, 'equipmentLabel', 80);
    copyText(safe, metadata, 'trainingReference', 80);
    copyNumber(safe, metadata, 'runwayOrientation', 0, 360);
    copyNumber(safe, metadata, 'finalTrack', 0, 360);
    copyNumber(safe, metadata, 'scanRpm', 10, 15);
    if (safe.scanRpm != null && ![10, 12, 15].includes(safe.scanRpm)) throw new Error('invalid-scanRpm');
    copyNumber(safe, metadata, 'revisitSeconds', 4, 6);
    if (safe.revisitSeconds != null && ![4, 5, 6].includes(safe.revisitSeconds)) throw new Error('invalid-revisitSeconds');
    copyNumber(safe, metadata, 'parRefreshHz', 1, 5);
    if (safe.parRefreshHz != null && ![1, 5].includes(safe.parRefreshHz)) throw new Error('invalid-parRefreshHz');
    copyNumber(safe, metadata, 'historyCount', 0, 5);
    if (safe.historyCount != null && ![0, 3, 5].includes(safe.historyCount)) throw new Error('invalid-historyCount');
    copyNumber(safe, metadata, 'approachSpeedKt', 30, 700);
    copyText(safe, metadata, 'approachAircraftType', 20, ['fighter', 'transport', 'helicopter', 'general']);
    if (metadata.radarEnvironment != null) safe.radarEnvironment = sanitizeRadarEnvironment(metadata.radarEnvironment);
    return deepFreeze(safe);
  }

  function createLocalSessionTransport(options) {
    const channelName = options && options.channelName;
    const BroadcastChannelImpl = options && options.BroadcastChannelImpl
      ? options.BroadcastChannelImpl : root && root.BroadcastChannel;
    if (!text(channelName, 120) || typeof BroadcastChannelImpl !== 'function') {
      throw new Error('BroadcastChannel is unavailable for local two-tab verification.');
    }
    const channel = new BroadcastChannelImpl(channelName);
    const listeners = new Set();
    const receive = event => listeners.forEach(listener => listener(event.data));
    if (typeof channel.addEventListener === 'function') channel.addEventListener('message', receive);
    else channel.onmessage = receive;
    let closed = false;
    return Object.freeze({
      channelName,
      post(message) { if (!closed) channel.postMessage(jsonClone(message)); },
      subscribe(listener) {
        if (typeof listener !== 'function') throw new TypeError('Listener must be a function.');
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      close() {
        if (closed) return;
        closed = true;
        listeners.clear();
        if (typeof channel.removeEventListener === 'function') channel.removeEventListener('message', receive);
        channel.close();
      }
    });
  }

  function createFakeTransportHub() {
    const channels = new Map();
    let endpointNumber = 0;
    return Object.freeze({
      createTransport(channelName) {
        if (!text(channelName, 120)) throw new Error('Channel name is required.');
        const endpointId = ++endpointNumber;
        const listeners = new Set();
        const endpoints = channels.get(channelName) || new Map();
        endpoints.set(endpointId, { listeners, get closed() { return closed; } });
        channels.set(channelName, endpoints);
        let closed = false;
        return Object.freeze({
          channelName,
          post(message) {
            if (closed) return;
            for (const [id, endpoint] of endpoints) {
              if (id === endpointId || endpoint.closed) continue;
              const copy = jsonClone(message);
              endpoint.listeners.forEach(listener => listener(copy));
            }
          },
          subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
          close() { closed = true; listeners.clear(); endpoints.delete(endpointId); }
        });
      },
      endpointCount(channelName) { return channels.get(channelName)?.size || 0; }
    });
  }

  function transportFrom(factory, channelName) {
    if (typeof factory !== 'function') throw new Error('A session transport factory is required.');
    const transport = factory(channelName);
    if (!transport || typeof transport.post !== 'function' || typeof transport.subscribe !== 'function') {
      throw new Error('The session transport is invalid.');
    }
    return transport;
  }

  function createInstructorSession(options = {}) {
    const now = options.now || Date.now;
    const createdAt = now();
    const cryptoSource = secureSource(options.crypto);
    const pin = options.pin || generatePin(cryptoSource);
    if (!/^\d{6}$/.test(pin)) throw new Error('PIN must contain six digits.');
    const sessionId = options.sessionId || generateHex(16, cryptoSource);
    const senderId = options.senderId || `host_${generateHex(8, cryptoSource)}`;
    const channelName = options.channelName || `${CHANNEL_PREFIX}${sessionId}`;
    let expiresAt = createdAt + PIN_TTL_MS;
    let publicMetadata = sanitizePublicMetadata(options.publicMetadata || { mode: 'qgh' });
    const transport = options.transport || transportFrom(options.transportFactory, channelName);
    const onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {};
    let state = 'waiting';
    let revision = 0;
    let simulationTime = 0;
    let admitted = null;
    let waiting = new Map();
    let endedReason = null;
    let latestObservation = null;
    let unsubscribe;
    const inboundRevision = new Map();
    writeDiscovery(options.storage, { pin, sessionId, channelName, createdAt, expiresAt });

    function snapshot() {
      return deepFreeze({ sessionId, pin, channelName, createdAt, expiresAt, state, simulationTime,
        admittedClientId: admitted && admitted.clientId, waitingClientIds: [...waiting.keys()], endedReason });
    }

    function event(kind, details = {}) { onEvent(deepFreeze({ kind, ...details, snapshot: snapshot() })); }

    function advanceTime(value) {
      if (!finite(value, simulationTime)) throw new Error('Authoritative simulation time cannot move backwards.');
      simulationTime = value;
    }

    function send(type, payload = {}, targetClientId) {
      const message = deepFreeze({ protocol: PROTOCOL_VERSION, type, sessionId,
        senderRole: 'instructor', senderId, revision: ++revision, simulationTime,
        sentAt: now(), ...(targetClientId ? { targetClientId } : {}), payload: jsonClone(payload) });
      const validation = validateInstructorMessage(message, { sessionId });
      if (!validation.ok) throw new Error(`Invalid instructor message: ${validation.reason}`);
      transport.post(message);
      return message;
    }

    function rejectJoin(clientId) {
      send(TYPES.ADMISSION_REJECTED, { reason: 'unable-to-join' }, safeId(clientId) ? clientId : undefined);
    }

    function authorized(message) {
      return admitted && message.senderId === admitted.clientId
        && message.payload.seatToken === admitted.seatToken;
    }

    function receive(message) {
      const validation = validateStudentMessage(message, { sessionId });
      if (!validation.ok) { event('message-rejected', { reason: validation.reason }); return validation; }
      const previousRevision = inboundRevision.get(message.senderId) || 0;
      if (message.revision <= previousRevision) {
        event('message-rejected', { reason: 'stale-revision', clientId: message.senderId });
        return { ok: false, reason: 'stale-revision' };
      }
      if (message.simulationTime > simulationTime) {
        event('message-rejected', { reason: 'future-student-time', clientId: message.senderId });
        return { ok: false, reason: 'future-student-time' };
      }
      inboundRevision.set(message.senderId, message.revision);
      if (state === 'terminated' || state === 'expired') {
        rejectJoin(message.senderId);
        return { ok: false, reason: 'inactive-session' };
      }
      if (message.type === TYPES.JOIN_REQUEST) {
        if (now() >= expiresAt && !admitted) { expire(); rejectJoin(message.senderId); return { ok: false, reason: 'expired' }; }
        if (message.payload.pin !== pin || message.payload.seat !== 'controller' || admitted) {
          rejectJoin(message.senderId);
          return { ok: false, reason: 'unable-to-join' };
        }
        waiting.set(message.senderId, { clientId: message.senderId, requestedAt: now() });
        event('join-requested', { clientId: message.senderId });
        return { ok: true };
      }
      if (message.type === TYPES.REJOIN_REQUEST) {
        if (!authorized(message)) { rejectJoin(message.senderId); return { ok: false, reason: 'unable-to-join' }; }
        admitted.lastSeenAt = now();
        admitted.disconnected = false;
        send(TYPES.ADMISSION_GRANTED, { seatToken: admitted.seatToken, rejoined: true, publicMetadata }, admitted.clientId);
        send(TYPES.LIFECYCLE, { state }, admitted.clientId);
        if (latestObservation) send(TYPES.OBSERVATION, { observation: latestObservation }, admitted.clientId);
        event('student-rejoined', { clientId: admitted.clientId });
        return { ok: true };
      }
      if (!authorized(message)) {
        event('message-rejected', { reason: 'not-admitted', clientId: message.senderId });
        return { ok: false, reason: 'not-admitted' };
      }
      admitted.lastSeenAt = now();
      if (message.type === TYPES.READY) {
        admitted.ready = true;
        admitted.audioMode = ['audio', 'captions'].includes(message.payload.audioMode) ? message.payload.audioMode : 'captions';
        if (state === 'admitted') state = 'ready';
        send(TYPES.LIFECYCLE, { state }, admitted.clientId);
        event('student-ready', { clientId: admitted.clientId, audioMode: admitted.audioMode });
      } else if (message.type === TYPES.PREFERENCES) {
        admitted.preferences = { captions: message.payload.captions !== false, audioEnabled: message.payload.audioEnabled === true };
        event('student-preferences', { clientId: admitted.clientId, preferences: admitted.preferences });
      } else if (message.type === TYPES.PILOT_PLAYBACK) {
        event('pilot-playback', { transmissionId: message.payload.transmissionId, phase: message.payload.phase });
      } else if (message.type === TYPES.STUDENT_HEARTBEAT) event('student-heartbeat', { clientId: admitted.clientId });
      return { ok: true };
    }

    function admit(clientId) {
      if (state !== 'waiting' || admitted || !waiting.has(clientId)) return false;
      admitted = { clientId, seatToken: generateHex(16, cryptoSource), ready: false, lastSeenAt: now(), preferences: {} };
      waiting.delete(clientId);
      for (const other of waiting.keys()) rejectJoin(other);
      waiting = new Map();
      state = 'admitted';
      // The fifteen-minute limit applies while waiting.  Once admitted, the
      // discovery record remains valid for reconnect until termination/host close.
      writeDiscovery(options.storage, { pin, sessionId, channelName, createdAt, expiresAt: Number.MAX_SAFE_INTEGER });
      send(TYPES.ADMISSION_GRANTED, { seatToken: admitted.seatToken, rejoined: false, publicMetadata }, clientId);
      event('student-admitted', { clientId });
      return true;
    }

    function reject(clientId) {
      if (!waiting.delete(clientId)) return false;
      rejectJoin(clientId);
      event('student-rejected', { clientId });
      return true;
    }

    function transition(next, allowed, time = simulationTime) {
      if (!allowed.includes(state)) return false;
      advanceTime(time);
      state = next;
      send(TYPES.LIFECYCLE, { state }, admitted && admitted.clientId);
      event('lifecycle', { state });
      return true;
    }

    function start(time = simulationTime) { return admitted?.ready ? transition('running', ['ready'], time) : false; }
    function pause(time = simulationTime) { return transition('paused', ['running'], time); }
    function resume(time = simulationTime) { return transition('running', ['paused'], time); }

    function publishObservation(observation, time = simulationTime) {
      if (!admitted || !['running', 'paused'].includes(state)) return false;
      advanceTime(time);
      const safe = sanitizeStudentObservation(observation, {
        mode: publicMetadata.mode,
        radarProfile: publicMetadata.radarProfile
      });
      send(TYPES.OBSERVATION, { observation: safe }, admitted.clientId);
      latestObservation = safe;
      return safe;
    }

    // A display-family handover may change the controller picture without
    // recreating the local session or exposing instructor truth.  This message
    // is separate from an observation so the student can discard the previous
    // sensor shape before it renders the next one.
    function updatePublicMetadata(metadata, time = simulationTime) {
      if (!admitted || !['running', 'paused'].includes(state)) return false;
      advanceTime(time);
      const nextMetadata = sanitizePublicMetadata(metadata);
      if (nextMetadata.mode !== publicMetadata.mode || nextMetadata.radarProfile !== publicMetadata.radarProfile) latestObservation = null;
      publicMetadata = nextMetadata;
      send(TYPES.PUBLIC_METADATA, { publicMetadata }, admitted.clientId);
      return publicMetadata;
    }

    function publishCaption(caption, time = simulationTime, transmissionId) {
      if (!admitted || !text(caption, 240) || !['running', 'paused'].includes(state)) return false;
      advanceTime(time);
      send(TYPES.CAPTION, { caption, ...(text(transmissionId, 120) ? { transmissionId } : {}) }, admitted.clientId);
      return true;
    }

    function heartbeat(time = simulationTime) {
      if (!admitted || ['terminated', 'expired'].includes(state)) return false;
      advanceTime(time);
      send(TYPES.HOST_HEARTBEAT, { state }, admitted.clientId);
      return true;
    }

    function end(reason, finalState) {
      if (['terminated', 'expired'].includes(state)) return false;
      state = finalState;
      endedReason = reason;
      clearDiscovery(options.storage, pin);
      send(TYPES.TERMINATED, { reason }, admitted && admitted.clientId);
      event(finalState, { reason });
      return true;
    }

    function terminate(reason = 'exercise-terminated', time = simulationTime) {
      advanceTime(time);
      return end(reason, 'terminated');
    }

    function expire() { return end('pin-expired', 'expired'); }

    function tick() {
      if (!admitted && state === 'waiting' && now() >= expiresAt) expire();
      if (admitted && !['terminated', 'expired'].includes(state)
        && now() - admitted.lastSeenAt > HEARTBEAT_TIMEOUT_MS && !admitted.disconnected) {
        admitted.disconnected = true;
        send(TYPES.STUDENT_DISCONNECTED, { reason: 'heartbeat-timeout' }, admitted.clientId);
        event('student-disconnected', { clientId: admitted.clientId });
      }
      return snapshot();
    }

    function close() {
      if (!['terminated', 'expired'].includes(state)) end('host-left', 'terminated');
      if (unsubscribe) unsubscribe();
      transport.close?.();
    }

    function releaseStudent() {
      if (!admitted || ['terminated', 'expired'].includes(state)) return false;
      send(TYPES.TERMINATED, { reason: 'seat-released' }, admitted.clientId);
      admitted = null; state = 'waiting'; waiting.clear();
      expiresAt = now() + PIN_TTL_MS;
      writeDiscovery(options.storage, { pin, sessionId, channelName, createdAt, expiresAt });
      event('seat-released');
      return true;
    }

    unsubscribe = transport.subscribe(receive);
    return Object.freeze({ pin, sessionId, channelName, senderId, admit, reject, start, pause, resume,
      publishObservation, updatePublicMetadata, publishCaption, heartbeat, terminate, expire, tick, receive, close, snapshot, releaseStudent });
  }

  function createStudentSession(options = {}) {
    const now = options.now || Date.now;
    const cryptoSource = secureSource(options.crypto);
    const pin = String(options.pin || '');
    const discovery = options.discovery || readDiscovery(options.storage, pin, now());
    const recoveryKey = `reds.atc-suite.seat.${pin}`;
    let recovery = null;
    try { recovery = JSON.parse(options.recoveryStorage?.getItem(recoveryKey) || 'null'); } catch (_) {}
    if (!recovery || recovery.sessionId !== discovery?.sessionId || !safeId(recovery.clientId)
      || !text(recovery.seatToken, 64) || !Number.isSafeInteger(recovery.revision) || recovery.revision < 0) recovery = null;
    const clientId = recovery?.clientId || options.clientId || `student_${generateHex(8, cryptoSource)}`;
    const onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {};
    let transport = options.transport || null;
    let state = discovery ? 'joining' : 'rejected';
    let revision = recovery?.revision || 0;
    let simulationTime = 0;
    let lastInstructorRevision = 0;
    let lastHostSeenAt = discovery ? now() : null;
    let lastObservationAt = null;
    let lastProgressAt = null;
    let seatToken = recovery?.seatToken || null;
    let publicMetadata = null;
    let observation = null;
    let caption = null;
    let reason = discovery ? null : 'unable-to-join';
    let unsubscribe;
    const sessionId = discovery && discovery.sessionId;
    const channelName = discovery && discovery.channelName;
    if (!transport && discovery) transport = transportFrom(options.transportFactory, channelName);

    function snapshot() {
      return deepFreeze({ clientId, sessionId, channelName, state, simulationTime, publicMetadata,
        observation, caption, reason, admitted: Boolean(seatToken), lastHostSeenAt, lastObservationAt, lastProgressAt });
    }
    function event(kind, details = {}) { onEvent(deepFreeze({ kind, ...details, snapshot: snapshot() })); }

    function saveRecovery() {
      try {
        if (seatToken) options.recoveryStorage?.setItem(recoveryKey, JSON.stringify({ sessionId, clientId, seatToken, revision }));
        else options.recoveryStorage?.removeItem(recoveryKey);
      } catch (_) { /* Storage denial leaves manual PIN admission available. */ }
    }

    function send(type, payload) {
      if (!transport || !sessionId) return false;
      const message = deepFreeze({ protocol: PROTOCOL_VERSION, type, sessionId,
        senderRole: 'student', senderId: clientId, revision: ++revision,
        simulationTime, sentAt: now(), payload: { clientId, ...payload } });
      const validation = validateStudentMessage(message, { sessionId });
      if (!validation.ok) throw new Error(`Invalid student message: ${validation.reason}`);
      saveRecovery();
      transport.post(message);
      return message;
    }

    function receive(message) {
      const validation = validateInstructorMessage(message, { sessionId });
      if (!validation.ok) { event('message-rejected', { reason: validation.reason }); return validation; }
      if (message.targetClientId && message.targetClientId !== clientId) return { ok: false, reason: 'different-target' };
      if (message.revision <= lastInstructorRevision) return { ok: false, reason: 'stale-revision' };
      if (message.simulationTime < simulationTime) return { ok: false, reason: 'stale-simulation-time' };
      lastInstructorRevision = message.revision;
      if (message.simulationTime > simulationTime) lastProgressAt = now();
      simulationTime = message.simulationTime;
      lastHostSeenAt = now();
      if (message.type === TYPES.ADMISSION_REJECTED) {
        state = 'rejected'; reason = 'unable-to-join'; seatToken = null;
        saveRecovery();
        event('join-rejected');
      } else if (message.type === TYPES.ADMISSION_GRANTED) {
        if (!text(message.payload.seatToken, 64)) return { ok: false, reason: 'invalid-seat-token' };
        seatToken = message.payload.seatToken;
        saveRecovery();
        publicMetadata = sanitizePublicMetadata(message.payload.publicMetadata || {});
        state = 'admitted'; reason = null;
        event(message.payload.rejoined ? 'rejoined' : 'admitted');
      } else if (message.type === TYPES.PUBLIC_METADATA) {
        if (!seatToken) return { ok: false, reason: 'state-before-admission' };
        const nextMetadata = sanitizePublicMetadata(message.payload.publicMetadata || {});
        if (nextMetadata.mode !== publicMetadata?.mode || nextMetadata.radarProfile !== publicMetadata?.radarProfile) observation = null;
        if (!observation) lastObservationAt = null;
        publicMetadata = nextMetadata;
        event('public-metadata', { publicMetadata });
      } else if (message.type === TYPES.LIFECYCLE) {
        if (!['admitted', 'ready', 'running', 'paused'].includes(message.payload.state)) return { ok: false, reason: 'invalid-lifecycle' };
        if (!seatToken) return { ok: false, reason: 'state-before-admission' };
        if (message.payload.state === 'running' && state !== 'running') lastProgressAt = now();
        state = message.payload.state;
        event('lifecycle', { state });
      } else if (message.type === TYPES.OBSERVATION) {
        if (!seatToken) return { ok: false, reason: 'state-before-admission' };
        try { observation = sanitizeStudentObservation(message.payload.observation, {
          mode: publicMetadata && publicMetadata.mode,
          radarProfile: publicMetadata && publicMetadata.radarProfile
        }); }
        catch (_) { event('observation-rejected', { reason: 'unsafe-observation' }); return { ok: false, reason: 'unsafe-observation' }; }
        lastObservationAt = now();
        event('observation', { observation });
      } else if (message.type === TYPES.CAPTION) {
        if (!seatToken || !text(message.payload.caption, 240)) return { ok: false, reason: 'invalid-caption' };
        caption = message.payload.caption;
        event('caption', { caption, transmissionId: message.payload.transmissionId });
      } else if (message.type === TYPES.STUDENT_DISCONNECTED) {
        state = 'disconnected'; reason = message.payload.reason || 'disconnected'; event('disconnected', { reason });
      } else if (message.type === TYPES.TERMINATED) {
        state = 'terminated'; reason = message.payload.reason || 'terminated'; seatToken = null; observation = null;
        saveRecovery();
        event('terminated', { reason });
      } else if (message.type === TYPES.HOST_HEARTBEAT) {
        event('host-heartbeat');
      }
      return { ok: true };
    }

    function requestJoin() {
      if (!discovery || !transport) { state = 'rejected'; reason = 'unable-to-join'; event('join-rejected'); return false; }
      if (now() >= discovery.expiresAt) { state = 'rejected'; reason = 'unable-to-join'; event('join-rejected'); return false; }
      if (seatToken) return rejoin();
      state = 'waiting';
      return send(TYPES.JOIN_REQUEST, { pin, seat: 'controller' });
    }
    function ready(audioMode = 'captions') {
      if (!seatToken || state !== 'admitted') return false;
      return send(TYPES.READY, { seatToken, audioMode: audioMode === 'audio' ? 'audio' : 'captions' });
    }
    function heartbeat() { return seatToken ? send(TYPES.STUDENT_HEARTBEAT, { seatToken }) : false; }
    function preferences(values = {}) {
      return seatToken ? send(TYPES.PREFERENCES, { seatToken, captions: values.captions !== false,
        audioEnabled: values.audioEnabled === true }) : false;
    }
    function rejoin() { return seatToken ? send(TYPES.REJOIN_REQUEST, { pin, seatToken }) : false; }
    function pilotPlayback(transmissionId, phase) {
      return seatToken ? send(TYPES.PILOT_PLAYBACK, { seatToken, transmissionId, phase }) : false;
    }
    function tick() {
      if (lastHostSeenAt != null && !['terminated', 'rejected', 'disconnected'].includes(state)
        && now() - lastHostSeenAt > HEARTBEAT_TIMEOUT_MS) {
        state = 'disconnected'; reason = 'heartbeat-timeout'; event('disconnected', { reason });
      }
      return snapshot();
    }
    function close() { if (unsubscribe) unsubscribe(); transport?.close?.(); }
    if (transport) unsubscribe = transport.subscribe(receive);
    return Object.freeze({ clientId, sessionId, channelName, requestJoin, ready, heartbeat,
      preferences, rejoin, pilotPlayback, receive, tick, close, snapshot });
  }

  return Object.freeze({
    PROTOCOL_VERSION, PIN_TTL_MS, HEARTBEAT_TIMEOUT_MS, MAX_MESSAGE_BYTES,
    DISCOVERY_PREFIX, TYPES, generatePin, writeDiscovery, readDiscovery, clearDiscovery,
    validateEnvelope, validateStudentMessage, validateInstructorMessage,
    sanitizeStudentObservation, sanitizePublicMetadata,
    createLocalSessionTransport, createFakeTransportHub, createInstructorSession, createStudentSession
  });
});
