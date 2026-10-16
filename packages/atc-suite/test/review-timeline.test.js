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

const assert = require('node:assert/strict');
const test = require('node:test');
const Sensors = require('../suite-sensors.js');

const stationary = () => ({ id: 'A1', callsign: '430', position: { xNm: 0, yNm: -15 }, altitudeFt: 6000 });

test('review keeps truth, observations and events on one authoritative time base', () => {
  const timeline = Sensors.createReviewTimeline();
  timeline.recordTruth({ timestamp: 0, xNm: 0, yNm: -15, headingDeg: 180 });
  timeline.recordEvent({ timestamp: 1, kind: 'command', text: 'TURN RIGHT 220' });
  timeline.recordObservation('surveillance', { timestamp: 5, bearingDeg: 0, rangeNm: 15 });
  timeline.recordTruth({ timestamp: 5, xNm: 0, yNm: -14.5, headingDeg: 185 });
  const result = timeline.snapshot();
  assert.equal(result.durationSeconds, 5);
  assert.equal(result.observations[0].sensor, 'surveillance');
  assert.equal(result.observations[0].timestamp, result.truth[1].timestamp);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.observations));
});

test('review observation times are identical for accelerated and short sensor stepping', () => {
  function run(accelerated) {
    const sensor = Sensors.createSurveillanceSensor({ rpm: 12 });
    if (accelerated) sensor.advance(60, stationary);
    else for (let second = 1; second <= 60; second += 1) sensor.advance(second, stationary);
    const timeline = Sensors.createReviewTimeline();
    for (const observation of sensor.observations()) timeline.recordObservation('surveillance', observation);
    return timeline.snapshot().observations;
  }
  assert.deepEqual(run(true), run(false));
});

test('review rejects backwards timestamps rather than silently reordering evidence', () => {
  const timeline = Sensors.createReviewTimeline();
  timeline.recordObservation('par', { timestamp: 2, trackState: 'tracked' });
  assert.throws(() => timeline.recordObservation('par', { timestamp: 1, trackState: 'tracked' }), /monotonic/i);
  timeline.recordEvent({ timestamp: 5, kind: 'reply' });
  assert.throws(() => timeline.recordEvent({ timestamp: 4, kind: 'command' }), /monotonic/i);
});
