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

const workspace = fs.readFileSync(path.join(__dirname, '..', 'voice-workspace.js'), 'utf8');
const offlineEngine = fs.readFileSync(path.join(__dirname, '..', 'offline-voice-engine.js'), 'utf8');
const guide = fs.readFileSync(path.join(__dirname, '..', 'training-centre.html'), 'utf8');
const voiceStyles = fs.readFileSync(path.join(__dirname, '..', 'voice.css'), 'utf8');

test('voice workspace is a local DOM adapter and does not contain flight-model logic', () => {
  assert.match(workspace, /element\.click\(\)/);
  assert.match(workspace, /new root\.Event\(type, \{ bubbles: true \}\)/);
  assert.match(workspace, /QGHOfflineVoiceEngine/);
  assert.match(workspace, /PTT/);
  assert.match(workspace, /RECENT_TRANSCRIPT_WINDOW_MS/);
  assert.doesNotMatch(workspace, /\b(fetch|XMLHttpRequest|WebSocket)\b/);
  assert.doesNotMatch(workspace, /SpeechRecognition|webkitSpeechRecognition|processLocally/);
  assert.doesNotMatch(workspace, /\b(physicsStep|turnRadiusNm|simulateFlight|Tactical\.)\b/);
  assert.match(offlineEngine, /Vosk\.createModel/);
  assert.match(offlineEngine, /buildQghGrammar/);
  assert.doesNotMatch(offlineEngine, /SpeechRecognition|webkitSpeechRecognition/);
});

test('voice workspace preserves UI safety gates for procedures, formation, and termination', () => {
  assert.match(workspace, /HEADING TURNS ARE NOT AVAILABLE IN U\/S COMPASS/);
  assert.match(workspace, /U\/S TURNS ARE NOT AVAILABLE IN NORMAL QGH/);
  assert.match(workspace, /FORMATION FOLLOWING STOPPED/);
  assert.match(workspace, /NO TERMINATION CONFIRMATION IS OPEN/);
  assert.match(workspace, /VALUE DOES NOT MATCH CONTROL STEP/);
});

test('the in-app guide documents the shipped local voice workflow', () => {
  assert.match(guide, /PRESS TO TALK BY DEFAULT/);
  assert.match(guide, /continuous listening/i);
  assert.match(guide, /no cloud speech fallback/i);
  assert.match(guide, /Confirm termination/);
  assert.match(guide, /Raven Twenty One turn right heading zero six zero/);
  assert.match(guide, /unique designator/i);
});

test('phone voice dock follows the live browser viewport instead of Safari browser chrome', () => {
  assert.match(workspace, /visualViewport/);
  assert.match(workspace, /--qgh-browser-bottom-inset/);
  assert.match(voiceStyles, /--qgh-browser-bottom-inset/);
  assert.match(voiceStyles, /--qgh-phone-bottom-inset/);
  assert.match(workspace, /scheduleBrowserBottomInset/);
  assert.match(workspace, /pageshow/);
  assert.match(workspace, /requestAnimationFrame/);
});
