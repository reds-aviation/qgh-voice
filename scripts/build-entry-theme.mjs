/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

import {readFile, writeFile, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';

function normalizeHeader(html) {
  return html.replace(/<header\b[^>]*class="[^\"]*(?:entry-header|app-header|tactical-app-header|site-header|topbar|common-header)[^\"]*"[^>]*>[\s\S]*?<\/header>/, header => {
    header=header.replace(/(<header\b[^>]*class=")([^\"]+)/,'$1$2 iaf-site-header');
    header=header.replace(/(<(?:a|div)\b[^>]*class=")([^\"]*(?:entry-brand|tactical-brand|header-left|\bbrand\b)[^\"]*)/, '$1$2 iaf-header-brand');
    if(!header.includes('iaf-header-brand'))header=header.replace(/(<a\b)/,'$1 class="iaf-header-brand"');
    const credit=/<div\b([^>]*(?:class="[^\"]*(?:entry-credit|tactical-credit|\bcredit\b|\bcreator\b)[^\"]*"|id="creator-credit")[^>]*)>[\s\S]*?<\/div>/;
    if(credit.test(header)){
      header=header.replace(credit, full=>{
        const normalized=/class="/.test(full)?full.replace(/class="([^\"]*)"/,'class="$1 iaf-header-credit"'):full.replace('<div','<div class="iaf-header-credit"');
        return normalized.replace(/>[\s\S]*<\/div>$/, '><strong>Flt Lt Balaram Reddy</strong><small>Service No. 38703</small></div>');
      });
    }else header=header.replace('</header>','<div class="iaf-header-credit"><strong>Flt Lt Balaram Reddy</strong><small>Service No. 38703</small></div></header>');
    return header.replace(/SERVICE NO\. 38703/g,'Service No. 38703')
      .replace(/>TRAINING CENTRE</g,'>Training centre<')
      .replace(/>CHANGE QGH TYPE</g,'>Change QGH type<')
      .replace(/>SUITE HOME</g,'>Suite home<')
      .replace(/>ATC SUITE</g,'>Suite home<')
      .replace(/>TRAINING GUIDE ↗</g,'>Training guide ↗<');
  });
}

// This is a Pages presentation layer. Flight controls and exercise canvases keep
// their original styles; the selectors follow each existing setup/desk state.
export async function buildEntryTheme(output, root, version) {
  for (const asset of ['flow-theme.css', 'iaf-theme.css', 'qgh-cloudbreak.png']) {
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
    // These entry rules own the final layout for both training families.
    // Keep their existing version query while moving them after the Pages theme.
    let entryStyle = '';
    if (['instructor', 'join', 'procedural'].includes(surface)) {
      html = html.replace(/<link\b[^>]*href="suite-entry\.css(?:\?[^\"]*)?"[^>]*>\s*/g, link => {
        if (entryStyle) throw new Error(`Duplicate suite entry stylesheet: ${page}`);
        entryStyle = link.trim();
        return '';
      });
      if (!entryStyle) throw new Error(`Missing suite entry stylesheet: ${page}`);
    }
    // Published Pages uses the shared tour; keep legacy engine assets for old recordings/builds.
    if(['qgh','single','tactical'].includes(surface))html=html.replace(/<script[^>]+src="guided-familiarisation\.js[^\"]*"[^>]*><\/script>\s*/g,'').replace(/<link[^>]+href="guided-familiarisation\.css[^\"]*"[^>]*>\s*/g,'');
    html = html.replace('<body', `<body data-suite-surface="${surface}"`)
      .replace('</head>', `<link rel="stylesheet" href="${prefix}flow-theme.css?release=${version}">${entryStyle}<link rel="stylesheet" href="${prefix}iaf-theme.css?release=${version}"></head>`);
    if (['qgh', 'instructor', 'guide'].includes(surface)) {
      html = html.replace(/(<meta name="theme-color" content=")[^"]+/, '$1#365e7b');
    }
    if (surface === 'qgh') {
      html = html.replace('<title>QGH Simulator</title>', '<title>ATS SIM BOX · Version 1 · QGH</title>')
        .replace('<h1>QGH SIMULATOR</h1>', '<h1>ATS SIM BOX</h1><span class="product-version">Version 1</span>')
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
        .replace('Build the exercise.', 'Instructor setup')
        .replace('Join with the session PIN.', 'Controller position');
      // The shared entry already supplies this label. Older entry markup still
      // needs the presentation-layer label, but a second copy crowds the form.
      if (!html.includes('PREPARE YOUR POSITION')) {
        html = html.replace('<div class="entry-desks">', '<div class="flow-section-label">PREPARE YOUR POSITION<span></span></div><div class="entry-desks">');
      }
    }
    // Operational guides stay public; the owner’s hardware handbook is private.
    if (['qgh', 'instructor', 'procedural', 'guide'].includes(surface)) {
      html = html.replace('</body>', `<footer class="flow-footer"><span>ATS SIM BOX · Version 1</span><span>INDEPENDENT TRAINING SIMULATOR</span></footer></body>`);
    }
    html=normalizeHeader(html);
    await writeFile(path, html);
  }
}
