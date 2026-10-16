/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

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
