import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const knowledge = require('../packages/procedural-beta/static/guide-knowledge.js');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sections = [
  ['start','Choose your exercise',['suite-choice']],
  ['connection','Offline or online',['connections','extended-screens']],
  ['session','Create, join and recover',['session','session-isolation','local-pin-recovery','online-recovery']],
  ['voice','Voice and screen sharing',['meeting-room','meeting-debrief']],
  ['tutorial','Narrated tutorial',['youtube-tutorial']],
  ['individual','Single and Tactical QGH',['individual-start','qgh-turn','individual-voice']],
  ['instructor','Instructor QGH + SRA',['instructor-start']],
  ['procedural','Procedural control',['procedural-start']],
  ['traffic','Build and reuse traffic',['aircraft-limits','roster-mobile','saved-exercises']],
  ['airspace','Published and custom airspace',['public-lfa-samples','custom-polygons','saved-airspaces','arp-upload','lfa-image-alignment']],
  ['scope','Scope and screen space',['instructor-instrument-shelf','scope-tools','sweep','mobile-workspace','student-estimates']],
  ['aircraft','Aircraft controls',['suite-turn','turn','instructor-turn','stop-turn','orbit','speed-level','instructor-speed-level']],
  ['pilot','Pilot transmissions and D/F',['transmit','instructor-transmit']],
  ['approach','SRA and pressure references',['approach-reference','pressure']],
  ['exercise','Run, pause and exercise time',['run-pause','exercise-time','training-time']],
  ['review','Terminate and debrief',['terminate-exercise','terminate-instructor','terminate-individual','review-controls']],
  ['tour','Guided tour',['guided-tour']],
  ['help','Ask Gyani',['help-limits']],
];
const renderEntry = entry => `<details id="answer-${escape(entry.id)}"><summary>${escape(entry.title)}</summary><p>${escape(entry.text)}</p></details>`;

// Kept as a small public API for existing build/tests that import this helper.
export function renderCurrentGuide(topic, prefix = '', version = knowledge.revision) {
  return `<section class="current-flow-guide" id="current-flow" data-guide-revision="${escape(version)}"><h2>One training guide for the suite</h2><p><a href="${prefix}user-guide.html">Open the common training guide</a> · Version 1</p>${knowledge.entries.filter(e=>e.topics.includes(topic)).map(renderEntry).join('')}</section>`;
}

function renderCommonGuideSource(version) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fafaf8"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"><title>Training guide · ATS SIM BOX · Version 1</title><link rel="icon" href="icons/favicon-32.png"><link rel="stylesheet" href="procedural-beta/current-flow-guide.css"><link rel="stylesheet" href="procedural-beta/suite-guide-chat.css"><script defer src="procedural-beta/guide-knowledge.js"></script><script defer src="procedural-beta/guide-search.js"></script><script defer src="procedural-beta/suite-guide-chat.js"></script><script defer src="suite-landing-register.js?release=${escape(version)}"></script></head>
<body class="suite-common-guide"><a class="common-skip" href="#guide-main">Skip to guide</a><header class="common-header"><a href="./">ATS SIM BOX · Version 1</a><nav aria-label="Guide navigation"><a href="qgh.html">Single QGH</a><a href="instructor-led/">Instructor QGH + SRA</a><a href="procedural-beta/">Procedural</a></nav></header><div class="common-layout"><aside class="common-nav"><strong>TRAINING GUIDE</strong><nav aria-label="Guide sections">${sections.map(([id,title])=>`<a href="#${id}">${escape(title)}</a>`).join('')}</nav><a href="training-centre.html#catalogue">Accepted QGH radio calls ↗</a></aside><main id="guide-main"><section class="common-hero"><p class="common-eyebrow">ONE GUIDE · ALL EXERCISES</p><h1>Prepare. Control. Review.</h1><p>QGH cloud-breaking, SRE/vectoring, SRA and procedural control.</p><small>Version 1 · updated with this release</small></section><section class="common-flow" id="current-flow" data-guide-revision="${escape(version)}"><h2>Choose your starting point</h2><div>${knowledge.flow.map(step=>`<a href="${escape(step.href)}"><strong>${escape(step.title)}</strong><span>${escape(step.text)}</span></a>`).join('')}</div></section>${sections.map(([id,title,ids])=>`<section class="common-section" id="${id}"><h2>${escape(title)}</h2>${ids.map(key=>knowledge.entries.find(e=>e.id===key)).filter(Boolean).map(renderEntry).join('')}${id==='individual'?'<p><a href="training-centre.html#catalogue">Open the accepted radio-call catalogue</a></p>':''}</section>`).join('')}<footer class="common-footer">Independent training simulator · ${escape(knowledge.learning)}</footer></main></div></body></html>`;
}

export function renderCommonGuide(version = knowledge.revision) {
  return renderCommonGuideSource(version).replaceAll('training-centre.html#catalogue','training-centre.html#calls')
    .replace('<a href="procedural-beta/">Procedural</a>', '<a href="procedural-beta/">Procedural</a><a href="training-centre.html#demonstrations">Tutorial</a>')
    .replace('<section class="common-section" id="tutorial"><h2>Narrated tutorial</h2>', '<section class="common-section" id="tutorial"><h2>Narrated tutorial</h2><p><a href="training-centre.html#demonstrations">Open the tutorial player in Training Centre</a></p>');
}

function legacyGuide(prefix, anchor) {
  const destination = `${prefix}user-guide.html#${anchor}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${destination}"><title>Training guide · ATS SIM BOX · Version 1</title><link rel="canonical" href="${prefix}user-guide.html"></head><body><main><h1>One training guide for the suite</h1><p><a href="${destination}">Open the common training guide</a></p></main></body></html>`;
}

export async function buildSuiteGuides(outputRoot, sourceRoot, version) {
  if (version !== knowledge.revision) throw new Error('Guide knowledge revision must match the Procedural release');
  const paths={procedural:'packages/procedural-beta/static/procedural.html',single:'packages/qgh-engine/single.html',tactical:'packages/qgh-engine/tactical.html','instructor-entry':'packages/atc-suite/index.html',instructor:'packages/atc-suite/instructor.html',student:'packages/atc-suite/student.html','training-centre':'packages/qgh-engine/training-centre.html'};
  const sources={};
  for(const [page,path] of Object.entries(paths))sources[page]=await readFile(resolve(sourceRoot,path),'utf8');
  const workspaceShell=await readFile(resolve(sourceRoot,'packages/procedural-beta/static/workspace-shell.js'),'utf8');
  for(const page of ['procedural','instructor','student'])sources[page]+=workspaceShell;
  const plotting=await readFile(resolve(sourceRoot,'packages/procedural-beta/static/student-plotting.js'),'utf8');
  sources.procedural+=plotting;sources.student+=plotting;
  for(const filename of ['procedural.js','traffic-setup.js','airspace-preparation.js','airspace-library.js','scenario-library.js','chart-workshop.js'])sources.procedural+=await readFile(resolve(sourceRoot,'packages/procedural-beta/static',filename),'utf8');
  const hasControl=(source,id)=>{
    const text=source||'';
    if (/function button\(text, id, action\)/.test(text) && new RegExp(`\\bbutton\\(\\s*['"][^'"]*['"]\\s*,\\s*['"]${id}['"]`).test(text)) return true;
    const adapterIds=[...text.matchAll(/\.id\s*=\s*root\.id\s*===\s*['"]activeWorkspace['"]\s*\?\s*['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g)];
    return text.includes(`id="${id}"`)||adapterIds.some(match=>match[1]===id||match[2]===id)||new RegExp(`\\.id\\s*=\\s*['"]${id}['"]`).test(text)||(/\.id\s*=\s*id\b/.test(text)&&(new RegExp(`\\[\\s*[a-zA-Z_$][\\w$]*\\s*,\\s*['"]${id}['"]\\s*\\]`).test(text)||(/const step\s*=\s*\(id,\s*label\)/.test(text)&&new RegExp(`\\bstep\\(\\s*['"]${id}['"]`).test(text))));
  };
  for(const step of [...(knowledge.tours || []),...(knowledge.firstUse || [])]) {
    if(step.entry && !knowledge.entries.some(e=>e.id===step.entry))throw new Error(`Missing tour answer: ${step.entry}`);
    for(const page of step.pages)if(/^#[a-zA-Z0-9-]+$/.test(step.selector)&&!hasControl(sources[page],step.selector.slice(1)))throw new Error(`Tour references missing ${page} control: ${step.selector}`);
  }
  for(const entry of knowledge.entries)for(const id of entry.controls)if(!Object.values(sources).some(source=>hasControl(source,id)))throw new Error(`Guide references missing control: ${id}`);
  const controlled=[...sources.procedural.matchAll(/id="(quick-[a-z-]+|resume|pause|step|bearing-type|terminate|terminate-quick)"/g)].map(m=>m[1]).filter(id=>!['quick-aircraft-info','quick-more'].includes(id));
  const documented=new Set(knowledge.entries.flatMap(e=>e.controls));
  for(const id of controlled)if(!documented.has(id))throw new Error(`Add guide knowledge for new quick control: ${id}`);
  await writeFile(resolve(outputRoot,'user-guide.html'),renderCommonGuide(version));
  await writeFile(resolve(outputRoot,'instructor-led/training-guide.html'),legacyGuide('../','instructor'));
  await writeFile(resolve(outputRoot,'procedural-beta/procedural-guide.html'),legacyGuide('../','procedural'));
  // The Training Centre remains the accepted radio-call catalogue, not a second handbook.
  const centrePath=resolve(outputRoot,'training-centre.html');
  let centre=await readFile(centrePath,'utf8');
  centre=centre.replace('</main>','<section class="current-flow-guide" id="current-flow"><h2>Common suite training guide</h2><p><a href="user-guide.html#individual">Setup, aircraft controls, sessions and review →</a></p></section></main>');
  await writeFile(centrePath,centre);
  // Every entry point exposes the same handbook. Old bookmarked guide URLs remain valid.
  for(const [page,prefix] of [['index.html',''],['qgh.html',''],['single.html',''],['tactical.html',''],['training-centre.html',''],['instructor-led/index.html','../'],['instructor-led/instructor.html','../'],['instructor-led/student.html','../'],['procedural-beta/index.html','../'],['procedural-beta/procedural.html','../']]) {
    const path=resolve(outputRoot,page);let html=await readFile(path,'utf8');
    html=html.replace(/href="(?:\.\.\/)?(?:instructor-led\/)?training-guide\.html(?:#[^"]*)?"/g,`href="${prefix}user-guide.html#instructor"`)
      .replace(/href="(?:\.\.\/)?(?:procedural-beta\/)?procedural-guide\.html(?:#[^"]*)?"/g,`href="${prefix}user-guide.html#procedural"`);
    await writeFile(path,html);
  }
}
