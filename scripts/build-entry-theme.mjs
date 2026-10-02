import {readFile, writeFile, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// This is a Pages presentation layer. Flight controls and exercise canvases keep
// their original styles; the selectors follow each existing setup/desk state.
export async function buildEntryTheme(output, root, version) {
  for (const asset of ['flow-theme.css', 'qgh-cloudbreak.png']) {
    await copyFile(resolve(root, 'packages/site-landing', asset), resolve(output, asset));
  }
  const pages = [
    ['qgh.html', 'qgh'], ['single.html', 'single'], ['tactical.html', 'tactical'],
    ['instructor-led/index.html', 'instructor'], ['instructor-led/instructor.html', 'host-setup'],
    ['instructor-led/student.html', 'join'], ['procedural-beta/index.html', 'procedural'],
    ['procedural-beta/procedural.html', 'procedural'], ['training-centre.html', 'guide'],
    ['user-guide.html', 'guide'], ['instructor-led/training-guide.html', 'guide'],
    ['procedural-beta/procedural-guide.html', 'guide'],
  ];
  for (const [page, surface] of pages) {
    const prefix = page.includes('/') ? '../' : '';
    const path = resolve(output, page);
    let html = await readFile(path, 'utf8');
    html = html.replace('<body', `<body data-suite-surface="${surface}"`)
      .replace('</head>', `<link rel="stylesheet" href="${prefix}flow-theme.css?release=${version}"></head>`);
    if (['qgh', 'instructor', 'guide'].includes(surface)) {
      html = html.replace(/(<meta name="theme-color" content=")[^"]+/, '$1#fafaf8');
    }
    if (surface === 'qgh') {
      html = html.replace('<title>QGH Simulator</title>', '<title>QGH · ATC Training Suite</title>')
        .replace('<h1>QGH SIMULATOR</h1>', '<h1>ATC TRAINING SUITE</h1>')
        .replace('SELECT QGH TYPE', 'SINGLE QGH · INDIVIDUAL PRACTICE')
        .replace('Choose your exercise</h2>', 'QGH</h2><p class="flow-subtitle">Cloud-breaking procedure</p>')
        .replace('Practise one aircraft, or manage a small tactical flight. Each path opens its own setup before the exercise begins.', 'Practise the QGH cloud-breaking procedure. Choose a single aircraft or tactical flight, then prepare your exercise.')
        .replace('<nav class="entry-options"', '<div class="flow-section-label">CHOOSE YOUR EXERCISE<span></span></div><nav class="entry-options"')
        .replace('“Order in the air begins with clarity on the ground.”', 'QGH · CLOUD-BREAKING PROCEDURE · INDIVIDUAL PRACTICE');
    } else if (surface === 'instructor') {
      html = html.replace('One shared airspace.<br>Three training perspectives.', 'Train together.<br>Build confidence.')
        .replace('INSTRUCTOR · CONTROLLER TRAINING', 'QGH &amp; SRA · INSTRUCTOR-LED')
        .replace('Configure 1–24 aircraft. The instructor controls the exercise; the trainee works from the selected sensor picture.', 'QGH cloud-breaking, SRE/vectoring and SRA. One instructor shapes the traffic; one controller works the procedure.')
        .replace('<span>QGH / D/F</span>', '<span>QGH · CLOUD BREAKING</span>');
    } else if (surface === 'procedural') {
      html = html.replace('INSTRUCTOR LED · PROCEDURAL CONTROL', 'PROCEDURAL CONTROL · INSTRUCTOR-LED')
        .replace('One airspace.<br>Your exercise.', 'One airspace.<br>Every decision matters.')
        .replace('Set the traffic. Share the PIN. Work the procedure.', 'Aerodrome, approach and area control in one shared exercise. Set the traffic. Work the procedure.')
        .replace('<div class="entry-desks">', '<div class="flow-section-label">PREPARE YOUR POSITION<span></span></div><div class="entry-desks">')
        .replace('Build the exercise.', 'Instructor setup')
        .replace('Join with the session PIN.', 'Controller position');
    }
    // Operational guides stay public; the owner’s hardware handbook is private.
    if (['qgh', 'instructor', 'procedural', 'guide'].includes(surface)) {
      html = html.replace('</body>', `<footer class="flow-footer"><span>ATC TRAINING SUITE</span><span>INDEPENDENT TRAINING SIMULATOR</span></footer></body>`);
    }
    await writeFile(path, html);
  }
}
