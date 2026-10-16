/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

const test = require('node:test');
const assert = require('node:assert/strict');
const Display = require('../suite-display.js');

function screen(left, top, width = 1920, height = 1040, label = '') {
  return { availLeft: left, availTop: top, availWidth: width, availHeight: height, label };
}

test('student window uses a stable reusable name and opens synchronously', () => {
  const calls = [];
  const child = { closed: false, location: { replace: url => calls.push(['navigate', url]) }, focus: () => calls.push('focus') };
  const result = Display.openStudentWindow({
    openWindow: (...args) => { calls.push(args); return child; },
    url: 'student.html'
  });
  assert.equal(result.ok, true);
  assert.equal(calls[0][0], '');
  assert.equal(calls[0][1], Display.STUDENT_WINDOW_NAME);
  assert.match(calls[0][2], /popup=yes/);
  assert.equal(child.opener, null);
  assert.deepEqual(calls[1], ['navigate', 'student.html']);
  assert.equal(calls[2], 'focus');
});

test('popup blocking is a typed failure', () => {
  const result = Display.openStudentWindow({ openWindow: () => null });
  assert.deepEqual(result, { ok: false, reason: 'popup-blocked', window: null });
});

test('student scripts never load when opener isolation fails', () => {
  let closed = false;
  const child = {
    closed: false,
    location: { replace: () => assert.fail('navigation must not occur') },
    close: () => { closed = true; }
  };
  Object.defineProperty(child, 'opener', { configurable: true, get: () => ({ unsafe: true }), set: () => {} });
  const result = Display.openStudentWindow({ openWindow: () => child });
  assert.equal(result.reason, 'isolation-failed');
  assert.equal(closed, true);
});

test('external screen is selected by geometry rather than object identity', () => {
  const current = screen(0, 0);
  const duplicate = screen(0, 0);
  const external = screen(-1280, 0, 1280, 984, 'Projector');
  assert.equal(Display.chooseExternalScreen({ currentScreen: current, screens: [duplicate, external] }), external);
  assert.equal(Display.chooseExternalScreen({ currentScreen: current, screens: [duplicate] }), null);
});

test('external placement uses available bounds and focuses the student window', async () => {
  const calls = [];
  const child = {
    closed: false,
    moveTo: (...args) => calls.push(['moveTo', ...args]),
    resizeTo: (...args) => calls.push(['resizeTo', ...args]),
    focus: () => calls.push(['focus'])
  };
  const current = screen(0, 0);
  const external = screen(-1280, 20, 1280, 960, 'Training display');
  const result = await Display.placeOnExternalScreen(child, {
    getScreenDetails: async () => ({ currentScreen: current, screens: [current, external] })
  });
  assert.equal(result.reason, 'external-display');
  assert.equal(result.placedExternal, true);
  assert.equal(result.label, 'Training display');
  assert.deepEqual(calls, [['moveTo', -1280, 20], ['resizeTo', 1280, 960], ['focus']]);
});

test('single display, unsupported API and denied permission stay usable', async () => {
  const child = { closed: false };
  const only = screen(0, 0);
  const single = await Display.placeOnExternalScreen(child, {
    getScreenDetails: async () => ({ currentScreen: only, screens: [only] })
  });
  assert.equal(single.reason, 'single-display');
  assert.equal(single.placedExternal, false);

  const unsupported = await Display.placeOnExternalScreen(child, { getScreenDetails: null });
  assert.equal(unsupported.reason, 'manual-placement');
  assert.equal(unsupported.ok, true);

  const denied = await Display.placeOnExternalScreen(child, {
    getScreenDetails: async () => { const error = new Error('denied'); error.name = 'NotAllowedError'; throw error; }
  });
  assert.equal(denied.reason, 'permission-needed');
  assert.equal(denied.ok, true);
});

test('closed window and placement errors are reported without throwing', async () => {
  const closed = await Display.placeOnExternalScreen({ closed: true }, { getScreenDetails: async () => ({}) });
  assert.equal(closed.reason, 'window-closed');

  const current = screen(0, 0);
  const external = screen(1920, 0);
  const child = { closed: false, moveTo: () => { throw new Error('blocked'); } };
  const blocked = await Display.placeOnExternalScreen(child, {
    getScreenDetails: async () => ({ currentScreen: current, screens: [current, external] })
  });
  assert.equal(blocked.reason, 'manual-placement');
  assert.equal(blocked.placedExternal, false);
});
