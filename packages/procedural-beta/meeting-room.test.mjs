import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import Meeting from './static/meeting-room.js';
import { createRemoteRoom } from './static/remote-room.js';

test('Only canonical HTTPS Google Meet rooms become links', () => {
  assert.equal(Meeting.normalizeMeetUrl(' https://meet.google.com/ABC-DEFG-HIJ/?authuser=2#fragment '), 'https://meet.google.com/abc-defg-hij');
  assert.equal(Meeting.normalizeMeetUrl(''), '');
  for (const value of ['javascript:alert(1)', 'data:text/html,hello', 'http://meet.google.com/abc-defg-hij',
    'https://meet.google.com.evil.test/abc-defg-hij', 'https://meet.google.com@evil.test/abc-defg-hij',
    'https://user:pass@meet.google.com/abc-defg-hij', 'https://meet.google.com:8080/abc-defg-hij',
    'https://meet.google.com/', 'https://meet.google.com/new', 'https://meet.google.com/%61bc-defg-hij',
    'https://meet.google.com/abc-defg-hij/extra', 'https://meet.google.com/abc-defg-hij\n', 123, {}]) {
    assert.throws(() => Meeting.normalizeMeetUrl(value), /Paste a Google Meet/, String(value));
  }
});

test('The common panel hides offline, shares and clears links, and opens external links safely', async () => {
  const { document, window } = parseHTML('<main id="session"></main><header id="head"></header>');
  const saved = [];
  const panel = Meeting.createPanel({ container: document.getElementById('session'), onSave: url => saved.push(url) });
  panel.addShortcut(document.getElementById('head'));
  panel.update({ online: false });
  assert.equal(panel.element.hidden, true);
  panel.update({ online: true, role: 'instructor' });
  assert.equal(panel.element.querySelector('summary').textContent, 'Google Meet · exercise voice');
  const input = panel.element.querySelector('input');
  input.value = 'https://meet.google.com/abc-defg-hij?authuser=1';
  panel.element.querySelector('button').dispatchEvent(new window.Event('click'));
  await new Promise(setImmediate);
  assert.deepEqual(saved, ['https://meet.google.com/abc-defg-hij']);
  for (const link of document.querySelectorAll('.ats-meeting-join')) {
    assert.equal(link.hidden, false); assert.equal(link.getAttribute('href'), saved[0]);
    assert.equal(link.target, '_blank'); assert.equal(link.rel, 'noopener noreferrer');
  }
  panel.element.querySelectorAll('button')[1].dispatchEvent(new window.Event('click'));
  await new Promise(setImmediate);
  assert.deepEqual(saved, ['https://meet.google.com/abc-defg-hij', '']);
  panel.update({ online: true, role: 'student', meetingUrl: 'javascript:alert(1)' });
  assert.equal(panel.element.querySelector('.ats-meeting-form').hidden, true);
  assert.equal(document.querySelector('header .ats-meeting-join').hidden, true);
  assert.equal(document.querySelector('header .ats-meeting-join').getAttribute('href'), null);
});

test('Procedural meeting metadata uses the existing projection, respects Ready, survives interruption, and resets with an exercise', async () => {
  let state = { role: 'student', exerciseId: 'exercise-a', available: true, running: false, environment: {}, roster: [] };
  let snapshot, fail = false, studentStatus = 'waiting';
  const original = structuredClone(state);
  const service = { async call(action, _id, payload) {
    if (fail) throw new Error('offline');
    if (action === 'exchange') { snapshot = structuredClone(payload.state); return { room: { pin: '123456', students: [] }, commands: [] }; }
    return { room: { status: studentStatus, name: 'Controller' }, state: studentStatus === 'ready' ? snapshot : null, receipts: [] };
  } };
  const local = async path => ({ status: 200, body: path === 'cloud-view' ? state : path === 'state' ? { ...state, role: 'instructor', aircraft: [] } : { ok: true } });
  const auth = { role: 'instructor', cloud: { id: 'room-a', hostKey: 'host' } };
  const host = createRemoteRoom({ service, local, session: auth });
  const student = createRemoteRoom({ service, session: { role: 'student', cloud: { id: 'room-a' } } });
  await host.sync();
  assert.deepEqual(state, original, 'Transport metadata never mutates the engine projection');
  assert.equal((await host.dispatch('meeting', { meetingUrl: 'javascript:alert(1)' })).status, 400);
  assert.equal((await student.dispatch('meeting', { meetingUrl: 'https://meet.google.com/abc-defg-hij' })).status, 403);
  assert.equal((await host.dispatch('meeting', { meetingUrl: 'https://meet.google.com/abc-defg-hij?authuser=1' })).body.shared, true);
  assert.equal(snapshot.meetingUrl, 'https://meet.google.com/abc-defg-hij');
  assert.equal(snapshot.aircraft, undefined); assert.equal(snapshot.events, undefined);
  await student.sync(); assert.equal((await student.dispatch('room')).body.meetingUrl, '');
  studentStatus = 'admitted'; await student.sync(); assert.equal((await student.dispatch('room')).body.meetingUrl, '');
  studentStatus = 'ready'; await student.sync(); assert.equal((await student.dispatch('room')).body.meetingUrl, snapshot.meetingUrl);
  fail = true;
  const saved = await host.dispatch('meeting', { meetingUrl: 'https://meet.google.com/xyz-abcd-efg' });
  assert.equal(saved.body.shared, false); assert.equal(auth.meetingUrl, 'https://meet.google.com/xyz-abcd-efg');
  fail = false; await host.sync(); await student.sync();
  assert.equal((await student.dispatch('state')).body.meetingUrl, auth.meetingUrl);
  state = { ...state, exerciseId: 'exercise-b' };
  await host.sync(); assert.equal(snapshot.meetingUrl, ''); assert.equal(auth.meetingUrl, '');
  host.stop(); student.stop();
});
