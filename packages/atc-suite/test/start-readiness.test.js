'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Session = require('../suite-session.js');

function room() {
  let time = 1000;
  const hub = Session.createFakeTransportHub(), values = new Map();
  const storage = {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)};
  const options = {pin: '654321', storage, now: () => time, transportFactory: name => hub.createTransport(name)};
  const instructor = Session.createInstructorSession({...options, publicMetadata: {mode: 'qgh'}});
  const student = Session.createStudentSession(options);
  return {instructor, student, advance: ms => {time += ms;}};
}

test('offline Start requires admission and Ready; a disconnected Ready seat cannot start until it rejoins', () => {
  const h = room();
  assert.equal(h.instructor.start(0), false);
  h.student.requestJoin(); h.instructor.admit(h.student.clientId);
  assert.equal(h.instructor.start(0), false);
  h.student.ready();
  h.advance(Session.HEARTBEAT_TIMEOUT_MS + 1); h.instructor.tick();
  assert.equal(h.instructor.recoverySnapshot().admitted.disconnected, true);
  assert.equal(h.instructor.start(12), false);
  assert.equal(h.instructor.snapshot().state, 'ready');
  assert.equal(h.instructor.snapshot().simulationTime, 0, 'Rejected Start does not advance exercise time');
  assert.equal(h.student.snapshot().state, 'disconnected');
  h.student.rejoin();
  assert.equal(h.instructor.recoverySnapshot().admitted.disconnected, false);
  assert.equal(h.instructor.start(0), true);
  assert.equal(h.student.snapshot().state, 'running');
  h.instructor.close(); h.student.close();
});
