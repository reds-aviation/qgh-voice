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
