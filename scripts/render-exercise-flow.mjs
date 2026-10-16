/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

const steps = [
  ['Traffic', 'Set the aircraft and starting conditions.'],
  ['Airspace', 'Optional: load or customise the available chart.'],
  ['Create', 'Open the instructor exercise.'],
  ['PIN · Admit · Ready', 'Join the controller and check readiness.'],
  ['Start / Run', 'Conduct the exercise; Pause when needed.'],
  ['Terminate', 'Finish traffic and open the review.'],
  ['Review', 'Download the setup, then return Home.'],
];

// Native text remains readable offline, with CSS disabled and by screen readers.
// SVG only connects the steps; it does not duplicate their accessible labels.
export function renderExerciseFlow() {
  const connector = '<svg class="exercise-flow-connector" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M3 12h17m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return `<section class="common-exercise-flow" aria-labelledby="exercise-flow-title"><h2 id="exercise-flow-title">Instructor exercise, at a glance</h2><ol class="exercise-flow-steps">${steps.map(([title, description], index) => `<li${index === 4 ? ' class="exercise-flow-conduct"' : ''}><span class="exercise-flow-number" aria-hidden="true">${index + 1}</span><strong>${title}</strong><p>${description}</p>${index < steps.length - 1 ? connector : ''}</li>`).join('')}</ol><div class="exercise-flow-notes"><p><strong>Controller connection:</strong> Instructor QGH, SRE/vectoring and SRA need an admitted controller who is Ready before Start. Local Procedural can run without a controller; when one is admitted, wait for Ready before Run.</p><p><strong>Airspace and voice:</strong> Procedural has the full published and custom airspace editor. Instructor QGH/SRE/SRA keeps its own airspace and radar setup. Google Meet is optional; use it for conversation and screen sharing if needed. Online rooms require internet on both devices. This device / offline uses the same PC and browser profile in separate windows.</p></div></section>`;
}
