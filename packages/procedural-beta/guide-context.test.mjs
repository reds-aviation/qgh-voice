/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parseHTML} from 'linkedom';
import guide from './static/guide-context.js';

function page(path) {
    return parseHTML(readFileSync(new URL(path, import.meta.url), 'utf8')).document;
}

test('route guidance first identifies the close control on a drawer covering Prepare airspace', () => {
    const doc = page('./static/procedural.html');
    const get = id => doc.getElementById(id);
    get('entry').hidden = true;
    get('desk').hidden = false;
    get('role').textContent = 'INSTRUCTOR / PSEUDO-PILOT';
    get('work-panel').hidden = false;
    get('tab-build').hidden = true;
    get('drawer-title').textContent = 'Session';
    const answer = guide.routeAnswer(doc, 'procedural');
    assert.match(answer.text, /Close Session/);
    assert.equal(answer.controlId, 'drawer-close');
});

test('controller-only guidance follows the current visible role', () => {
    assert.equal(guide.isControllerDesk(page('../atc-suite/student.html')), true);
    assert.equal(guide.isControllerDesk(page('../atc-suite/instructor.html')), false);
    const doc = page('./static/procedural.html');
    assert.equal(guide.isControllerDesk(doc), false);
    doc.getElementById('entry').hidden = true;
    doc.getElementById('waiting').hidden = false;
    assert.equal(guide.isControllerDesk(doc), true);
    doc.getElementById('waiting').hidden = true;
    doc.getElementById('desk').hidden = false;
    doc.getElementById('role').textContent = 'STUDENT / PROCEDURAL CONTROLLER';
    assert.equal(guide.isControllerDesk(doc), true);
    doc.getElementById('role').textContent = 'INSTRUCTOR / PSEUDO-PILOT';
    assert.equal(guide.isControllerDesk(doc), false);
});

test('Controller entry on the shared role page points to the PIN', () => {
    const doc = page('../atc-suite/index.html');
    assert.equal(guide.startAnswer(doc, 'sra', 'how do i join').controlId, 'entryJoinPin');
    assert.equal(guide.startAnswer(doc, 'sra').controlId, 'openInstructorSetup');
    Object.defineProperty(doc, 'location', {value: {hash: '#controllerposition'}});
    assert.equal(guide.startAnswer(doc, 'sra').controlId, 'entryJoinPin');
});

test('ATS route guidance distinguishes the controller picture from the Procedural editor and Instructor published routes', () => {
    const doc = page('./static/procedural.html'), get = id => doc.getElementById(id);
    get('entry').hidden = true;
    get('desk').hidden = false;
    get('role').textContent = 'INSTRUCTOR / PSEUDO-PILOT';
    get('clock-state').textContent = 'RUNNING';
    let next = guide.routeAnswer(doc, 'procedural');
    assert.equal(next.controlId, 'traffic-setup');
    assert.match(next.text, /pauses the exercise/);
    assert.equal(get('clock-state').textContent, 'RUNNING');
    get('role').textContent = 'STUDENT / PROCEDURAL CONTROLLER';
    next = guide.routeAnswer(doc, 'procedural');
    assert.equal(next.controlId, undefined);
    assert.match(next.text, /instructor prepares/);
    const sra = page('../atc-suite/instructor.html');
    sra.querySelector('main').removeAttribute('inert');
    const published = guide.routeAnswer(sra, 'sra');
    assert.match(published.text, /published|Published/);
    assert.match(published.text, /Procedural/);
    assert.match(guide.routeAnswer(page('../atc-suite/student.html'), 'sra').text, /instructor prepares/);
});

test('Instructor-led gives the actual admission, ready, start, pause and resume controls', () => {
    const doc = page('../atc-suite/instructor.html');
    const get = id => doc.getElementById(id);
    const next = () => guide.startAnswer(doc, 'sra');
    doc.querySelector('main').removeAttribute('inert');
    assert.equal(next().controlId, 'createSession');
    get('setupPanel').hidden = true;
    get('activeWorkspace').hidden = false;
    get('admitStudent').hidden = true;
    get('startExercise').disabled = true;
    get('startSetupStatus').textContent = 'Ask the admitted controller to press Ready to open the display.';
    assert.match(next().text, /controller to press Ready/);
    assert.equal(next().controlId, 'openStartSetup');
    get('admitStudent').hidden = false;
    assert.equal(next().controlId, 'admitStudent');
    get('admitStudent').hidden = true;
    get('startExercise').disabled = false;
    assert.equal(next().controlId, 'startExercise');
    get('exerciseState').textContent = 'RUNNING';
    assert.match(next().text, /exercise is running/);
    get('exerciseState').textContent = 'PAUSED';
    get('startExercise').hidden = true;
    get('pauseExercise').disabled = false;
    get('pauseExercise').textContent = 'RESUME';
    assert.equal(next().controlId, 'pauseExercise');
});

test('Instructor-led controller sees their own admission status and a reconnect action for a frozen picture', () => {
    const doc = page('../atc-suite/student.html');
    const get = id => doc.getElementById(id);
    const next = () => guide.startAnswer(doc, 'qgh-instructor');
    assert.equal(next().controlId, 'joinPin');
    get('joinPanel').hidden = true;
    get('waitingPanel').hidden = false;
    assert.match(next().text, /request has been sent/);
    get('waitingPanel').hidden = true;
    get('readyPanel').hidden = false;
    assert.equal(next().controlId, 'studentReady');
    get('readyPanel').hidden = true;
    get('studentWorkspace').hidden = false;
    get('studentExerciseState').textContent = 'READY';
    assert.match(next().text, /instructor selects Start/);
    get('connectionState').textContent = 'DISCONNECTED';
    assert.equal(next().controlId, 'reconnectStudent');
});

test('Procedural uses real Run availability, including offline practice and an admitted controller awaiting Ready', () => {
    const doc = page('./static/procedural.html');
    const get = id => doc.getElementById(id);
    const next = () => guide.startAnswer(doc, 'procedural');
    get('entry').hidden = true;
    get('desk').hidden = false;
    get('clock-controls').hidden = false;
    get('role').textContent = 'INSTRUCTOR / PSEUDO-PILOT';
    get('clock-state').textContent = 'PAUSED';
    get('resume').disabled = false;
    assert.equal(next().controlId, 'resume');
    get('resume').disabled = true;
    get('start-setup-status').textContent = 'Ask the admitted controller to press Ready to open the display.';
    const drawer = doc.createElement('div');
    drawer.hidden = true;
    doc.body.append(drawer);
    drawer.append(get('start-setup-status'));
    get('open-start-setup').setAttribute('aria-describedby', 'start-setup-status');
    assert.equal(next().controlId, 'open-start-setup');
    assert.match(next().text, /press Ready/);
    get('clock-state').textContent = 'ENDED';
    get('exercise-notice').hidden = false;
    get('notice-review').hidden = false;
    assert.equal(next().controlId, 'notice-review');
});

test('Procedural controller never sees instructor instructions even when their HTML still exists', () => {
    const doc = page('./static/procedural.html');
    const get = id => doc.getElementById(id);
    const next = () => guide.startAnswer(doc, 'procedural');
    get('entry').hidden = true;
    get('waiting').hidden = false;
    get('student-ready').hidden = false;
    assert.equal(next().controlId, 'student-ready');
    get('waiting').hidden = true;
    get('desk').hidden = false;
    get('role').textContent = 'STUDENT / PROCEDURAL CONTROLLER';
    get('clock-state').textContent = 'PAUSED';
    get('start-setup-status').textContent = 'PRIVATE INSTRUCTOR PROMPT';
    const response = next();
    assert.equal(response.controlId, undefined);
    assert.doesNotMatch(response.text, /PRIVATE/);
    assert.match(response.text, /instructor selects Run/);
    get('role').textContent = '';
    assert.equal(next(), undefined);
});

test('both solo consoles use their own controls and never issue admission instructions', () => {
    for (const [file, setupId, liveId, startId, transmitId] of [
        ['single', 'setup', 'console', 'startExercise', 'transmit'],
        ['tactical', 'tSetup', 'tConsole', 'tStart', 'tTransmit'],
    ]) {
        const doc = page('../qgh-engine/' + file + '.html');
        doc.querySelector('[inert]')?.removeAttribute('inert');
        const next = () => guide.startAnswer(doc, 'qgh-individual');
        assert.equal(next().controlId, startId);
        doc.getElementById(setupId).classList.remove('active');
        doc.getElementById(liveId).classList.add('active');
        assert.equal(next().controlId, transmitId);
        assert.doesNotMatch(next().text, /admission|instructor/i);
    }
});
