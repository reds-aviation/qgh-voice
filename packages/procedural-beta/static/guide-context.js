/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

(function () {
    'use strict';

    // A page can keep every desk in the DOM. Read only the desk the user can see.
    function visible(doc, id) {
        const element = doc.getElementById(id);
        if (!element || element.closest('[hidden], [inert], [aria-hidden="true"], dialog:not([open])')) return;
        if (element.checkVisibility && !element.checkVisibility({visibilityProperty: true})) return;
        return element;
    }

    function answer(text, anchor, control) {
        const result = {text, anchor};
        if (control?.id && !control.disabled) result.controlId = control.id;
        return result;
    }

    function isControllerDesk(doc) {
        if (!doc?.getElementById) return false;
        if (doc.getElementById('studentWorkspace')) return true;
        if (visible(doc, 'waiting') && doc.getElementById('student-ready')) return true;
        if (visible(doc, 'desk') && /STUDENT|CONTROLLER/i.test(visible(doc, 'role')?.textContent || '')) return true;
        return doc.location?.hash === '#controllerposition' && !!visible(doc, 'entryJoinPin');
    }

    // The desk moves the existing Start description into the Session drawer.
    // A closed drawer still supplies the visible button's accessible description.
    function startDescription(doc, id, control) {
        const status = visible(doc, id) ||
            (control?.getAttribute('aria-describedby')?.split(/\s+/).includes(id) && doc.getElementById(id));
        return status?.textContent?.trim();
    }

    function instructor(doc) {
        const get = id => visible(doc, id);
        if (get('reviewScreen')) return answer('The exercise has ended. Review the track and observations. Download exercise setup saves the starting configuration for another session.', 'review', get('downloadReviewSetup'));
        if (get('setupPanel')) {
            if (get('returnToExercise')) return answer('Select Return to exercise to reopen your current desk.', 'session', get('returnToExercise'));
            return answer('Choose the exercise and set the starting aircraft, then select Create session. The controller can then join using the session PIN.', 'traffic', get('createSession'));
        }
        if (!get('activeWorkspace')) return;
        if (get('exerciseState')?.textContent.trim() === 'RUNNING') return answer('The exercise is running. Use the aircraft controls to respond to the controller. Pause freezes the exercise when you need to discuss it.', 'aircraft');
        const start = get('startExercise') || get('pauseExercise');
        if (start && !start.disabled) {
            if (start.id === 'pauseExercise' && !/resume/i.test(start.textContent)) return;
            return answer(start.id === 'startExercise' ? 'The controller is ready. Select Start to begin aircraft movement.' : 'The exercise is paused. Select Resume to continue from the current position.', 'exercise', start);
        }
        const admit = get('admitStudent');
        if (admit && !admit.disabled) return answer('A controller has requested to join. Select Admit, then ask the controller to press Ready on their display.', 'session', admit);
        const steps = get('openStartSetup');
        const status = startDescription(doc, 'startSetupStatus', steps || start);
        if (status) return answer(status, 'session', steps);
    }

    function student(doc) {
        const get = id => visible(doc, id);
        if (get('orientationGate')) return answer('Rotate this device to landscape or use a wider display for the surveillance scope.', 'scope');
        if (get('studentEnded')) return answer('The instructor has ended the exercise. Your last picture is frozen. Select Leave session when the debrief is complete.', 'review');
        if (get('joinPanel')) return answer('Use the same connection setting as the instructor. Enter their six-digit session PIN and select Request to join.', 'connection', get('joinPin'));
        if (get('waitingPanel')) return answer('Your request has been sent. The instructor must admit this position before you can press Ready.', 'session');
        if (get('readyPanel')) {
            const ready = get('studentReady');
            return ready && !ready.disabled
                ? answer('You have been admitted. Press Ready to open your display. The instructor starts aircraft movement.', 'session', ready)
                : answer('You have marked your position ready. The instructor starts aircraft movement.', 'session');
        }
        if (!get('studentWorkspace')) return;
        const state = get('studentExerciseState')?.textContent.trim();
        const connection = get('connectionState')?.textContent.trim() || '';
        if (/DISCONNECTED|LINK LOST/.test(connection) || /RECONNECT|FROZEN/.test(state || '')) return answer('Your picture has stopped updating. Select Reconnect to rejoin the session.', 'connection', get('reconnectStudent'));
        if (state === 'RUNNING') return answer('The exercise is running. Follow the observations on your display and give your instructions to the instructor.', 'scope');
        if (state === 'PAUSED') return answer('The instructor has paused aircraft movement. Your display will update when they select Resume.', 'exercise');
        if (state === 'READY') return answer('Your display is ready. The instructor selects Start to begin aircraft movement.', 'session');
    }

    function procedural(doc) {
        const get = id => visible(doc, id);
        if (get('entry')) {
            if (get('return-desk')) return answer('Select Return to current exercise to reopen your desk.', 'procedural', get('return-desk'));
            if (new URLSearchParams(doc.location?.search).get('position') === 'student') return answer('Enter your name and the instructor’s six-digit PIN, then select Request to join. Use the same connection as the instructor.', 'connection', get('student-name'));
            return answer('Choose the connection for both positions. The instructor selects Set up starting traffic. The controller enters their name and the instructor’s six-digit PIN to request admission.', 'connection', get('session-mode'));
        }
        if (get('setup')) {
            if (get('traffic-return-exercise')) return answer('Return to exercise reopens your current scope and keeps your traffic edits as a draft.', 'traffic', get('traffic-return-exercise'));
            return answer('Enter the starting aircraft and select Create exercise. Prepare airspace is available on the instructor desk.', 'traffic');
        }
        if (get('waiting')) {
            const ready = get('student-ready');
            if (ready && !ready.disabled) return answer('You have been admitted. Press Ready to open your scope. The instructor controls aircraft movement.', 'session', ready);
            const status = get('join-status')?.textContent.trim();
            if (status) return answer(status, 'session', /return to entry/i.test(status) ? get('waiting-leave') : undefined);
            return;
        }
        if (!get('desk')) return;
        const role = get('role')?.textContent || '';
        const state = get('clock-state')?.textContent.trim();
        const connection = get('connection')?.textContent.trim();
        if (/RECONNECTING|HOST UNAVAILABLE/.test(connection || '')) return answer('Your desk has lost contact with the exercise. Check that the instructor desk is open. For an online room, check the internet connection on both devices.', 'connection');
        if (/STUDENT|CONTROLLER/i.test(role)) {
            if (state === 'ENDED') return answer('The instructor has ended this exercise. Your scope will show the end notice. Await the instructor’s debrief.', 'review');
            if (state === 'PAUSED') return answer('Aircraft movement is paused. The instructor selects Run to start or continue the exercise.', 'session');
            if (state === 'RUNNING') return answer('The exercise is running. Use your controller picture and reports to follow the traffic.', 'procedural');
            return;
        }
        if (!/INSTRUCTOR/i.test(role)) return;
        if (state === 'ENDED') return answer('The exercise has ended. Open Review for the records and downloads, or select Reopen exercise to continue with this traffic.', 'review', get('notice-review'));
        if (state === 'RUNNING') return answer('The exercise is running. Select an aircraft to use its controls, or open Calls to review pilot calls.', 'aircraft', get('incoming-calls-open'));
        const run = get('resume');
        if (run && !run.disabled) return answer('Select Run to start or continue aircraft movement.', 'exercise', run);
        if (get('clock-controls')?.getAttribute('aria-busy') === 'true') return answer('The desk is applying your last clock command. Wait for the exercise time and status to update.', 'exercise');
        const steps = get('open-start-setup');
        const reason = startDescription(doc, 'start-setup-status', steps || run);
        if (reason && !/^Select Run/.test(reason)) return answer(reason, 'session', steps);
        const notice = get('exercise-notice-text')?.textContent.trim();
        if (notice) return answer(notice, 'session', get('notice-session'));
    }

    function solo(doc) {
        const tactical = !!doc.getElementById('tSetup');
        const screen = (singleId, tacticalId) => visible(doc, tactical ? tacticalId : singleId);
        if (screen('setup', 'tSetup')?.classList.contains('active')) {
            return answer(tactical ? 'Set up the tactical exercise and select Start tactical exercise. This is individual practice.' : 'Set up the aircraft and select Start single exercise. This is individual practice.', 'individual', screen('startExercise', 'tStart'));
        }
        if (screen('analysis', 'tAnalysis')?.classList.contains('active')) return answer('Review the recorded track. Select New exercise to return to setup.', 'review', screen('newExercise', 'tNewExercise'));
        if (screen('console', 'tConsole')?.classList.contains('active')) return answer('Your exercise console is open. Use Transmit for D/F to request a bearing indication.', 'individual', screen('transmit', 'tTransmit'));
    }

    function startAnswer(doc, topic, question = '') {
        if (!doc?.getElementById) return;
        if (topic === 'procedural' && doc.getElementById('student-join')) return procedural(doc);
        if (topic === 'qgh-individual') return solo(doc);
        if (['qgh-instructor', 'sra', 'qgh'].includes(topic)) {
            if (doc.getElementById('studentWorkspace')) return student(doc);
            if (doc.getElementById('activeWorkspace')) return instructor(doc);
            const joinPin = visible(doc, 'entryJoinPin');
            if (joinPin && (doc.location?.hash === '#controllerposition' || /\bjoin\b/.test(question))) {
                return answer('Use the same connection as your instructor. Enter their six-digit PIN under Controller position, then select Request to join.', 'session', joinPin);
            }
            const setup = visible(doc, 'openInstructorSetup');
            if (setup) return answer('For the instructor, select Open instructor setup to prepare traffic. For the controller, enter the instructor’s PIN under Controller position.', 'instructor', setup);
        }
    }

    function proceduralRoute(doc) {
        const get = id => visible(doc, id);
        const next = (text, id) => answer(text, 'airspace', get(id));
        if (get('entry')) return next('To draw a route, open Set up starting traffic as the instructor, then choose Prepare airspace.', 'instructor-login');
        if (get('traffic-prepare-airspace')) return next('Select Prepare airspace below the traffic entries.', 'traffic-prepare-airspace');
        if (!get('desk') || !/INSTRUCTOR/i.test(get('role')?.textContent || '')) return;
        const state = get('clock-state')?.textContent.trim();
        if (get('work-panel') && !get('tab-build') && get('drawer-close')) {
            const title = get('drawer-title')?.textContent.trim() || 'the open panel';
            return next('Close '+title+' to reach Prepare airspace on the scope.', 'drawer-close');
        }
        if (state === 'ENDED') return next('Reopen the exercise before editing its chart.', 'reopen-exercise');

        // The full-scope drawing tools stay visible after the chart drawer closes.
        const overlay = get('boundary-scope-tools');
        const scopeFinish = get('boundary-scope-close');
        if (overlay && !/DRAW \/ EDIT BOUNDARY/.test(overlay.querySelector('strong')?.textContent || '')) {
            if (/PLACE ARP/.test(overlay.querySelector('strong')?.textContent || '')) return next('Click the airfield centre on the scope to place the ARP.', 'scope');
            if (scopeFinish && !scopeFinish.disabled) return next('Select Finish route when the points are in order.', 'boundary-scope-close');
            return next('Click at least two points on the scope, in route order.', 'scope');
        }
        if (overlay) return answer('An area boundary is being drawn. Finish or cancel that draft before choosing ATS route.', 'airspace');
        if (!get('prepare-draw-chart')) {
            if (get('traffic-setup')) return next(state === 'RUNNING' ? 'Select Prepare airspace when you are ready to edit. Opening it pauses the exercise.' : 'Select Prepare airspace on the scope.', 'traffic-setup');
            return next('Open Options to reveal Prepare airspace.', 'workspace-options-toggle');
        }
        const draw = get('prepare-draw-chart');
        if (draw.getAttribute('aria-expanded') !== 'true') return next('Select Draw on chart in Prepare airspace.', draw.id);
        const drawing = get('boundary-drawing-status');
        if (drawing?.dataset.phase === 'placing-arp') return next('Click the airfield centre in the preview to place the ARP.', 'boundary-sketch-canvas');
        if (drawing?.dataset.phase === 'blocked') {
            const place = get('drawn-arp-preview');
            if (place && !place.disabled) return next('Select Place ARP on preview, then click the airfield centre.', place.id);
            return answer(drawing.textContent.trim(), 'airspace');
        }
        const route = get('draw-feature-route');
        if (route && route.getAttribute('aria-pressed') !== 'true') return next('Choose ATS route under Draw on chart.', route.id);
        const sketch = get('boundary-sketch');
        if (sketch && !sketch.open) return next('Expand Draw ATS route points to use the chart preview or radar scope.', 'chart-sketch-heading');
        if (drawing?.dataset.phase === 'finished') {
            const name = get('custom-route-name');
            if (name && !name.value.trim()) return next('Enter a route name, then choose the direction and flight-level limits.', name.id);
            return next('Check the direction and flight levels, then select Save route to apply the route.', 'custom-route-save');
        }
        const finish = get('finish-chart-feature');
        if (finish && !finish.disabled) return next('Select Finish route when your points are in order.', finish.id);
        return next('Click at least two points in order in the chart preview, or choose Draw / edit on radar scope.', 'boundary-sketch-canvas');
    }

    function routeAnswer(doc, topic) {
        if (!doc?.getElementById) return;
        if (isControllerDesk(doc)) return answer('The instructor prepares ATS routes. Ask them to update the chart for your controller scope.', 'airspace');
        if (topic === 'procedural' && doc.getElementById('student-join')) return proceduralRoute(doc);
        if (!['qgh-instructor', 'sra', 'qgh'].includes(topic)) return;
        const get = id => visible(doc, id);
        if (!doc.getElementById('activeWorkspace') && !doc.getElementById('entryJoinForm')) return;
        const family = get('exerciseFamily');
        if (family?.value === 'qgh') return answer('Hand-drawn routes are available in Procedural. To use a published route in Instructor, choose Surveillance vectoring or SRA under Exercise family.', 'airspace', family);
        const choose = get('suite-published-base');
        if (choose) return answer('For published SRA or vectoring routes, select an airbase and its LFA. For a hand-drawn route, use Procedural → Prepare airspace.', 'airspace', choose);
        const environment = get('setupEnvironment');
        if (environment) return answer('SRA and vectoring use published ATS routes. Open Prepare airspace & radar to choose the published airspace. Hand-drawn routes are available in Procedural.', 'airspace', environment);
        return answer('Custom route drawing is available in Procedural → Prepare airspace. SRA and vectoring use the routes supplied by the published airspace selected in instructor setup.', 'airspace');
    }

    const api = {startAnswer, isControllerDesk, routeAnswer};
    if (typeof module === 'object' && module.exports) module.exports = api;
    else globalThis.ATCGuideContext = api;
})();
