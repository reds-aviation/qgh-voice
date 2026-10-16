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
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const engineDirectory = path.join(__dirname, '..');

function readEngineFile(name) {
  return fs.readFileSync(path.join(engineDirectory, name), 'utf8');
}

test('the QGH entry page routes to the single and tactical simulators', () => {
  const entry = readEngineFile('index.html');
  const entryCss = readEngineFile('entry.css');

  assert.match(entry, /href="single\.html"/);
  assert.match(entry, /href="tactical\.html"/);
  assert.match(entry, /Flt Lt Balaram Reddy/);
  assert.match(entry, /SERVICE NO\. 38703/);
  assert.match(entry, /Order in the air begins with clarity on the ground\./);
  assert.match(entry, /entry\.css/);
  assert.match(entryCss, /@media/);
});

test('each simulator page offers a local return to the QGH entry page', () => {
  const single = readEngineFile('single.html');
  const tactical = readEngineFile('tactical.html');

  assert.match(single, /href="index\.html"/);
  assert.match(tactical, /href="index\.html"/);
});

test('each live homing display includes an unobtrusive voice-command acknowledgement', () => {
  const single = readEngineFile('single.html');
  const tactical = readEngineFile('tactical.html');
  const voiceCss = readEngineFile('voice.css');

  assert.match(single, /id="voiceCommandAck" class="voice-command-ack"/);
  assert.match(tactical, /id="tVoiceCommandAck" class="voice-command-ack"/);
  assert.match(single, /voice-ack-slot">\s*<output id="voiceCommandAck"[^>]*aria-live="off"/);
  assert.match(tactical, /voice-ack-slot">\s*<output id="tVoiceCommandAck"[^>]*aria-live="off"/);
  assert.match(single, /id="homingClock"[^>]*role="timer"[^>]*aria-live="off"[^>]*hidden/);
  assert.match(tactical, /id="tHomingClock"[^>]*role="timer"[^>]*aria-live="off"[^>]*hidden/);
  assert.match(voiceCss, /\.voice-command-ack\s*\{[\s\S]*#a32c27/);
  assert.match(voiceCss, /overflow-wrap: anywhere/);
  assert.match(readEngineFile('voice-workspace.js'), /announcement.setAttribute\('aria-live', 'polite'\)/);
  assert.match(voiceCss, /prefers-reduced-motion: reduce/);
});

test('guided familiarisation teaches exercise-first RT calls for each QGH mode', () => {
  const guidedTour = readEngineFile('guided-familiarisation.js');
  const userGuide = readEngineFile('training-centre.html');

  assert.match(guidedTour, /continue zero six zero/);
  assert.match(guidedTour, /while a same-direction turn is active/i);
  assert.match(guidedTour, /turn right heading zero six zero/);
  assert.match(guidedTour, /turn right now/);
  assert.match(guidedTour, /stop turn now/);
  assert.match(guidedTour, /Raven Twenty One turn right heading zero six zero/);
  assert.match(guidedTour, /Raven Twenty One transmit for D\/F/);
  assert.match(guidedTour, /Raven Twenty One stop following leader/);
  assert.match(readEngineFile('user-guide.html'), /url=training-centre.html/);
  assert.match(userGuide, /Accepted RT calls/);
});
