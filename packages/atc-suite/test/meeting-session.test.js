'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const Session = require('../suite-session.js');

function sessions() {
  const store = new Map();
  const storage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
  const hub = Session.createFakeTransportHub();
  const transportFactory = channelName => hub.createTransport(channelName);
  const instructor = Session.createInstructorSession({ pin: '123456', storage, transportFactory, publicMetadata: { mode: 'qgh' } });
  const student = Session.createStudentSession({ pin: '123456', storage, transportFactory });
  return { instructor, student };
}

test('Meet coordination stays private until admission, can change before Start, and does not alter the clock or sensor', () => {
  const { instructor, student } = sessions();
  instructor.setMeetingLink('https://meet.google.com/ABC-DEFG-HIJ?authuser=1#fragment');
  student.requestJoin();
  assert.equal(student.snapshot().publicMetadata, null);
  instructor.admit(student.clientId);
  assert.equal(student.snapshot().publicMetadata.meetingUrl, 'https://meet.google.com/abc-defg-hij');
  assert.equal(student.snapshot().simulationTime, 0);
  assert.equal(student.snapshot().observation, null);
  instructor.setMeetingLink('https://meet.google.com/xyz-abcd-efg');
  assert.equal(student.snapshot().state, 'admitted');
  assert.equal(student.snapshot().publicMetadata.meetingUrl, 'https://meet.google.com/xyz-abcd-efg');
  student.ready(); instructor.start();
  instructor.publishObservation({ mode: 'qgh', status: 'live', transmissionState: 'pilot', bearingType: 'qdm', bearingDeg: 150 }, 30);
  const picture = student.snapshot().observation;
  instructor.setMeetingLink('');
  assert.equal(student.snapshot().publicMetadata.meetingUrl, '');
  assert.deepEqual(student.snapshot().observation, picture);
  assert.equal(student.snapshot().simulationTime, 30);
  assert.equal(student.snapshot().state, 'running');
  instructor.setMeetingLink('https://meet.google.com/abc-defg-hij');
  instructor.terminate();
  assert.equal(student.snapshot().publicMetadata.meetingUrl, 'https://meet.google.com/abc-defg-hij', 'The debrief link remains available after the exercise ends');
  assert.equal(instructor.setMeetingLink(''), false);
  const fresh = sessions();
  fresh.student.requestJoin(); fresh.instructor.admit(fresh.student.clientId);
  assert.equal(fresh.student.snapshot().publicMetadata.meetingUrl, undefined);
});

test('Invalid meeting links are rejected before a protocol receiver can display them', () => {
  const { instructor, student } = sessions();
  student.requestJoin(); instructor.admit(student.clientId);
  assert.throws(() => instructor.setMeetingLink('https://meet.google.com.evil.test/abc-defg-hij'), /Paste a Google Meet/);
  const message = { protocol: 1, type: Session.TYPES.PUBLIC_METADATA, sessionId: instructor.sessionId,
    senderRole: 'instructor', senderId: instructor.senderId, revision: 100, simulationTime: 0, sentAt: Date.now(),
    targetClientId: student.clientId, payload: { publicMetadata: { mode: 'qgh', meetingUrl: 'javascript:alert(1)' } } };
  assert.equal(student.receive(message).reason, 'invalid-meeting-link');
  assert.equal(student.snapshot().publicMetadata.meetingUrl, undefined);
  assert.equal(Session.validateStudentMessage({ ...message, senderRole: 'student', senderId: student.clientId }).ok, false);
});
