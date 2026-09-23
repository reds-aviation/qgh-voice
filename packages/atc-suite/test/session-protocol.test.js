'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const Session = require('../suite-session.js');
const SuiteCore = require('../suite-core.js');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    entries: () => [...values.entries()]
  };
}

function deterministicCrypto(seed = 1) {
  let next = seed;
  return {
    getRandomValues(array) {
      for (let index = 0; index < array.length; index += 1) array[index] = next++;
      return array;
    }
  };
}

function harness(options = {}) {
  let time = options.time || 1000;
  const now = () => time;
  const storage = memoryStorage();
  const hub = Session.createFakeTransportHub();
  const transportFactory = name => hub.createTransport(name);
  const instructorEvents = [];
  const instructor = Session.createInstructorSession({
    now, storage, transportFactory, crypto: deterministicCrypto(7), pin: '431230',
    publicMetadata: { mode: 'qgh', procedure: 'normal', callsign: '431', runwayOrientation: 230,
      finalTrack: 230, trainingReference: 'Co-aligned; zero variation modelled' },
    onEvent: event => instructorEvents.push(event)
  });
  function student(clientId = 'student_00000001', pin = '431230', events = [], recoveryStorage) {
    return Session.createStudentSession({ now, storage, transportFactory, crypto: deterministicCrypto(91),
      clientId, pin, recoveryStorage, onEvent: event => events.push(event) });
  }
  return { now, storage, hub, transportFactory, instructor, instructorEvents, student,
    setTime: value => { time = value; }, advance: value => { time += value; } };
}

test('local session performs join, instructor admission, ready, run, pause, resume and termination', () => {
  const h = harness();
  const events = [];
  const student = h.student('student_00000001', '431230', events);
  assert.equal(student.requestJoin().type, Session.TYPES.JOIN_REQUEST);
  assert.equal(student.snapshot().state, 'waiting');
  assert.deepEqual(h.instructor.snapshot().waitingClientIds, ['student_00000001']);
  assert.equal(student.snapshot().publicMetadata, null, 'No scenario metadata arrives before admission');

  assert.equal(h.instructor.admit('student_00000001'), true);
  assert.equal(student.snapshot().state, 'admitted');
  assert.equal(student.snapshot().publicMetadata.callsign, '431');
  assert.equal(student.snapshot().publicMetadata.runwayOrientation, 230);
  assert.equal(student.ready('captions').type, Session.TYPES.READY);
  assert.equal(h.instructor.snapshot().state, 'ready');
  assert.equal(student.snapshot().state, 'ready');

  assert.equal(h.instructor.start(0), true);
  assert.equal(student.snapshot().state, 'running');
  const observation = h.instructor.publishObservation({ mode: 'qgh', status: 'live',
    transmissionState: 'pilot', bearingType: 'qdm', bearingDeg: 148 }, 12);
  assert.equal(observation.bearingDeg, 148);
  assert.equal(student.snapshot().observation.bearingDeg, 148);
  assert.equal(student.snapshot().simulationTime, 12);
  assert.equal(h.instructor.publishCaption('TURNING RIGHT 230 · 431', 12), true);
  assert.equal(student.snapshot().caption, 'TURNING RIGHT 230 · 431');

  assert.equal(h.instructor.pause(13), true);
  assert.equal(student.snapshot().state, 'paused');
  assert.equal(h.instructor.resume(13), true);
  assert.equal(student.snapshot().state, 'running');
  assert.equal(h.instructor.terminate('exercise-terminated', 14), true);
  assert.equal(student.snapshot().state, 'terminated');
  assert.equal(student.snapshot().observation, null);
  assert.equal(Session.readDiscovery(h.storage, '431230', h.now()), null, 'Terminating invalidates the PIN');
  assert.ok(events.some(event => event.kind === 'observation'));
});

test('student reload restores its authorized seat, monotonic revision and paused observation', () => {
  const h = harness(), recovery = memoryStorage();
  const first = h.student('student_00000001', '431230', [], recovery);
  first.requestJoin(); h.instructor.admit(first.clientId); first.ready(); h.instructor.start();
  h.instructor.publishObservation({ mode:'qgh', status:'held', transmissionState:'held', bearingType:'qdm', bearingDeg:148, callsign:'431' }, 20);
  h.instructor.pause(20); first.heartbeat(); first.close();
  const restored = h.student('student_00000099', '431230', [], recovery);
  assert.equal(restored.clientId, first.clientId);
  assert.equal(restored.requestJoin().type, Session.TYPES.REJOIN_REQUEST);
  assert.equal(restored.snapshot().state, 'paused');
  assert.equal(restored.snapshot().simulationTime, 20);
  assert.equal(restored.snapshot().observation.bearingDeg, 148);
  assert.ok(!h.instructorEvents.some(e => e.kind === 'message-rejected'));
  h.instructor.terminate(); assert.equal(recovery.entries().length, 0);
});

test('released seat invalidates the old token and renews admission after the original PIN lifetime', () => {
  const h = harness(), first = h.student();
  first.requestJoin(); h.instructor.admit(first.clientId); first.ready(); h.instructor.start();
  h.advance(Session.PIN_TTL_MS + 100);
  assert.equal(h.instructor.releaseStudent(), true);
  assert.equal(first.snapshot().state, 'terminated');
  assert.equal(first.rejoin(), false);
  const second = h.student('student_00000002');
  second.requestJoin(); assert.equal(h.instructor.admit(second.clientId), true);
  second.ready(); assert.equal(h.instructor.start(), true);
});

test('pilot playback acknowledgements carry the immutable transmission ID without changing flight time', () => {
  const h = harness(), events = [], student = h.student('student_00000001', '431230', events);
  student.requestJoin(); h.instructor.admit(student.clientId); student.ready('audio'); h.instructor.start(10);
  h.instructor.publishCaption('Turning right 230, 431', 10, 'reply-1');
  assert.equal(events.find(e => e.kind === 'caption').transmissionId, 'reply-1');
  for (const phase of ['started','ended','unavailable']) student.pilotPlayback('reply-1',phase);
  assert.deepEqual(h.instructorEvents.filter(e => e.kind === 'pilot-playback').map(e => e.phase), ['started','ended','unavailable']);
  assert.equal(h.instructor.snapshot().simulationTime, 10);
  assert.throws(() => student.pilotPlayback('reply-1','invented'), /Invalid student message/);
});

test('fresh heartbeats cannot disguise a frozen picture or stopped flight clock', () => {
  const h = harness(), student = h.student();
  student.requestJoin(); h.instructor.admit(student.clientId); student.ready(); h.instructor.start();
  h.instructor.publishObservation({mode:'qgh',status:'idle',transmissionState:'idle'}, 2);
  const before = student.snapshot(); h.advance(8000); h.instructor.heartbeat(2);
  const after = student.snapshot();
  assert.equal(after.lastHostSeenAt, h.now());
  assert.equal(after.lastObservationAt, before.lastObservationAt);
  assert.equal(after.lastProgressAt, before.lastProgressAt);
});

test('join remains pending until admission and a second controller seat is rejected', () => {
  const h = harness();
  const first = h.student('student_00000001');
  const second = h.student('student_00000002');
  first.requestJoin();
  second.requestJoin();
  assert.equal(first.snapshot().state, 'waiting');
  assert.equal(second.snapshot().state, 'waiting');
  assert.equal(h.instructor.snapshot().waitingClientIds.length, 2);
  assert.equal(h.instructor.admit('student_00000001'), true);
  assert.equal(first.snapshot().state, 'admitted');
  assert.equal(second.snapshot().state, 'rejected');
  assert.equal(second.snapshot().reason, 'unable-to-join');
  assert.equal(h.instructor.admit('student_00000002'), false);
});

test('incorrect and waiting-expired PINs fail generically without session detail', () => {
  const h = harness();
  const wrong = h.student('student_00000003', '000000');
  assert.equal(wrong.requestJoin(), false);
  assert.deepEqual({ state: wrong.snapshot().state, reason: wrong.snapshot().reason },
    { state: 'rejected', reason: 'unable-to-join' });
  assert.equal(wrong.snapshot().sessionId, null);

  h.advance(Session.PIN_TTL_MS);
  assert.equal(h.instructor.tick().state, 'expired');
  assert.equal(Session.readDiscovery(h.storage, '431230', h.now()), null);
  const expired = h.student('student_00000004');
  assert.equal(expired.requestJoin(), false);
  assert.equal(expired.snapshot().reason, 'unable-to-join');
});

test('an admitted student can rejoin while active and preferences never alter aircraft state', () => {
  const h = harness();
  const student = h.student();
  student.requestJoin();
  h.instructor.admit(student.clientId);
  const first = student.snapshot();
  assert.equal(first.admitted, true);
  assert.equal(student.preferences({ captions: true, audioEnabled: false }).type, Session.TYPES.PREFERENCES);
  h.advance(Session.PIN_TTL_MS + 1);
  assert.ok(Session.readDiscovery(h.storage, '431230', h.now()), 'An admitted active session remains discoverable');
  assert.equal(student.rejoin().type, Session.TYPES.REJOIN_REQUEST);
  assert.equal(student.snapshot().state, 'admitted');
  assert.ok(h.instructorEvents.some(event => event.kind === 'student-rejoined'));
});

test('BroadcastChannel adapter clones messages, subscribes and closes cleanly', () => {
  const channels = new Map();
  class FakeBroadcastChannel {
    constructor(name) { this.name = name; this.listeners = new Set(); (channels.get(name) || channels.set(name, new Set()).get(name)).add(this); }
    addEventListener(type, listener) { if (type === 'message') this.listeners.add(listener); }
    removeEventListener(type, listener) { if (type === 'message') this.listeners.delete(listener); }
    postMessage(data) {
      for (const peer of channels.get(this.name)) if (peer !== this) peer.listeners.forEach(listener => listener({ data: JSON.parse(JSON.stringify(data)) }));
    }
    close() { channels.get(this.name).delete(this); }
  }
  const first = Session.createLocalSessionTransport({ channelName: 'suite-channel', BroadcastChannelImpl: FakeBroadcastChannel });
  const second = Session.createLocalSessionTransport({ channelName: 'suite-channel', BroadcastChannelImpl: FakeBroadcastChannel });
  const received = [];
  second.subscribe(message => received.push(message));
  const source = { hello: { value: 1 } };
  first.post(source);
  source.hello.value = 2;
  assert.deepEqual(received, [{ hello: { value: 1 } }]);
  second.close();
  first.post({ ignored: true });
  assert.equal(received.length, 1);
  first.close();
});

test('heartbeats report a stale student and a stale host without manufacturing observations', () => {
  const h = harness();
  const student = h.student();
  student.requestJoin();
  h.instructor.admit(student.clientId);
  student.ready();
  h.instructor.start();
  assert.equal(student.snapshot().observation, null);

  h.advance(Session.HEARTBEAT_TIMEOUT_MS + 1);
  assert.equal(h.instructor.tick().admittedClientId, student.clientId);
  assert.ok(h.instructorEvents.some(event => event.kind === 'student-disconnected'));
  assert.equal(student.tick().state, 'disconnected');
  assert.equal(student.snapshot().observation, null);
  assert.equal(student.snapshot().reason, 'heartbeat-timeout');
});

test('revision and authoritative simulation time increase across instructor messages', () => {
  const h = harness();
  const received = [];
  const observer = h.hub.createTransport(h.instructor.channelName);
  observer.subscribe(message => received.push(message));
  const student = h.student();
  student.requestJoin();
  h.instructor.admit(student.clientId);
  student.ready();
  h.instructor.start(2);
  h.instructor.heartbeat(3);
  h.instructor.pause(4);
  const hostMessages = received.filter(message => message.senderRole === 'instructor');
  for (let index = 1; index < hostMessages.length; index += 1) {
    assert.ok(hostMessages[index].revision > hostMessages[index - 1].revision);
    assert.ok(hostMessages[index].simulationTime >= hostMessages[index - 1].simulationTime);
  }
  assert.throws(() => h.instructor.resume(1), /cannot move backwards/);
});

test('a canonical U1 student envelope survives the instructor-to-student session round trip', () => {
  const h = harness();
  const student = h.student();
  student.requestJoin();
  h.instructor.admit(student.clientId);
  student.ready();
  h.instructor.start();
  const state = SuiteCore.createState({ exerciseFamily: 'qgh', qghProcedure: 'normal', callsign: '431',
    aircraftType: 'fighter', initialQteDeg: 328, initialRangeNm: 18, initialHeadingDeg: 30,
    altitudeFt: 9000, speedKt: 240, rateDegPerSecond: 3, runwayOrientationDeg: 230,
    finalTrackDeg: 230, surveillanceProfile: 'primary' });
  const projection = SuiteCore.studentEnvelope(state, {
    status: 'live', transmissionState: 'pilot', bearingType: 'qdm', bearingDeg: 148
  });
  h.instructor.publishObservation(projection, 0);
  assert.deepEqual(student.snapshot().observation, {
    mode: 'qgh', status: 'live', transmissionState: 'pilot', bearingType: 'qdm', bearingDeg: 148
  });
});
