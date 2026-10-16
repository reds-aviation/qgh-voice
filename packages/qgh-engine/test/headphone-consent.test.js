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
const { create } = require('../headphone-consent.js');

function harness() {
  const enabled = [];
  const rates = [];
  let complete;
  let stops = 0;
  const consent = create({
    setEnabled: value => enabled.push(value),
    setRate: value => rates.push(value),
    playTest: () => new Promise(resolve => { complete = resolve; }),
    stopTest: () => { stops++; },
    onChange() {}
  });
  return { consent, enabled, rates, complete: value => complete(value), stops: () => stops };
}

test('pilot audio requires a completed test and fresh explicit headphone confirmation', async () => {
  const h = harness();
  assert.equal(h.consent.status().confirmed, false);
  assert.equal(h.consent.confirm(true), false);
  h.consent.open();
  assert.equal(h.consent.confirm(true), false);
  const pending = h.consent.test();
  assert.equal(h.consent.status().testing, true);
  assert.equal(h.consent.confirm(true), false);
  h.complete(true); await pending;
  assert.equal(h.consent.confirm(false), false);
  assert.equal(h.consent.confirm(true), true);
  assert.equal(h.enabled.at(-1), true);
  assert.equal(h.consent.status().open, false);
  h.consent.mute();
  assert.equal(h.consent.status().confirmed, false);
  h.consent.open();
  assert.equal(h.consent.confirm(true), false, 'old audio test does not enable a new confirmation');
});

test('device changes mute immediately and invalidate pending audio-test results', async () => {
  const h = harness(); h.consent.open();
  const pending = h.consent.test();
  h.consent.deviceChanged();
  assert.equal(h.enabled.at(-1), false);
  assert.equal(h.consent.status().confirmed, false);
  h.complete(true); await pending;
  assert.equal(h.consent.status().tested, false);
  assert.equal(h.consent.confirm(true), false);
  assert.match(h.consent.status().message, /changed/i);
});

test('failed and cancelled tests cannot enable replies or resurrect closed prompts', async () => {
  const h = harness(); h.consent.open();
  let pending = h.consent.test(); h.complete(false); await pending;
  assert.equal(h.consent.confirm(true), false);
  pending = h.consent.test(); h.consent.close(); h.complete(true); await pending;
  assert.equal(h.consent.status().open, false);
  assert.equal(h.consent.status().testing, false);
  assert.equal(h.consent.status().tested, false);
  assert.equal(h.enabled.at(-1), false);
  assert.ok(h.stops() > 0);
});

test('changing voice invalidates the test and only the latest test can succeed', async () => {
  const h = harness(); h.consent.open();
  const pending = h.consent.test();
  h.consent.invalidateTest();
  h.complete(true); await pending;
  assert.equal(h.consent.status().tested, false);
  assert.equal(h.consent.confirm(true), false);
});

test('pilot readback pace is selected only while the pre-flight confirmation is open', async () => {
  const h = harness();
  assert.equal(h.consent.status().rate, 100);
  assert.equal(h.consent.setRate(130), false);
  h.consent.open();
  const pending = h.consent.test();
  assert.equal(h.consent.setRate(170), true);
  assert.equal(h.consent.status().rate, 170);
  assert.equal(h.consent.status().tested, false);
  assert.equal(h.rates.at(-1), 170);
  h.complete(true); await pending;
  assert.equal(h.consent.confirm(true), false, 'changing speed requires a fresh audio test');
  assert.equal(h.consent.setRate(180), false);
});
