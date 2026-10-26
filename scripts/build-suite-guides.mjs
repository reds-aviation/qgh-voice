/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

import {readFile, writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const knowledge = require('../packages/procedural-beta/static/guide-knowledge.js');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId = id => knowledge.entries.find(entry => entry.id === id);
const pointerList = items => '<ul class="guide-pointers">'+items.map(text=>'<li>'+escape(text)+'</li>').join('')+'</ul>';
const sentences = text => String(text).split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean);
function renderEntry(entry) {
  const all = sentences(entry.text), points = entry.pointers || all.slice(0,4);
  const more = entry.pointers ? all : all.slice(4);
  return '<details class="guide-answer" data-guide-entry="'+escape(entry.id)+'" id="answer-'+escape(entry.id)+'"><summary>'+escape(entry.title)+'</summary>'+pointerList(points)+(more.length?'<details class="guide-full"><summary>Further guidance</summary>'+pointerList(more)+'</details>':'')+'</details>';
}
function flow(label,steps) {
  return '<figure class="guide-flow"><figcaption>'+escape(label)+'</figcaption><ol>'+steps.map(([title,detail])=>'<li><strong>'+escape(title)+'</strong><span>'+escape(detail)+'</span></li>').join('')+'</ol></figure>';
}
const tracks = [
  {id:'qgh',label:'QGH',note:'Individual practice · Single or Tactical',href:'qgh.html',ids:['individual-start','qgh-turn','individual-distance','individual-voice'],steps:[['Choose','Single or Tactical'],['Set up','Aircraft, tracks and levels'],['Start','Manual or optional voice'],['Control','Transmit, command, check'],['Terminate','Reveal the flight track'],['Review','Timing and geometry']]},
  {id:'instructor',label:'Instructor',note:'Shared QGH · SRE / vectoring · SRA',href:'instructor-led/',ids:['instructor-start','instructor-traffic-return'],steps:[['Traffic','Select mode and aircraft'],['Create','Open the paused session'],['Airspace','Check optional chart aids'],['Connect','PIN → Admit → Ready'],['Start','Conduct the exercise'],['Review','Terminate and debrief']]},
  {id:'procedural',label:'Procedural',note:'Aerodrome · Approach · Area control',href:'procedural-beta/',ids:['procedural-start','traffic-return-exercise'],steps:[['Traffic','Set the starting aircraft'],['Create','Open the paused scope'],['Airspace','Published, draw or coordinates'],['Connect','Admit and Ready if paired'],['Run','Work the procedure'],['Review','Terminate, save and debrief']]}
];
const reference = [
 ['connection','Connection & sessions',['session'],['connections','extended-screens','session','session-isolation','local-pin-recovery','online-recovery']],
 ['scope','Scope & display',[],['instructor-instrument-shelf','scope-tools','sweep','mobile-workspace','student-estimates','roster-mobile']],
 ['aircraft','Aircraft & radio',['controls','pilot','voice','exercise','approach'],['suite-turn','turn','instructor-turn','stop-turn','orbit','speed-level','instructor-speed-level','transmit','instructor-transmit','meeting-room','meeting-debrief','run-pause','exercise-time','training-time','approach-reference','pressure']],
 ['airspace','Airspace & files',['traffic'],['public-lfa-samples','reference-boundaries','custom-polygons','route-chart-details','saved-airspaces','saved-exercises','arp-upload','lfa-image-alignment','aircraft-limits']],
 ['review','Review & debrief',[],['terminate-exercise','terminate-instructor','terminate-individual','terminate-location','review-controls']],
 ['help','Help & recovery',['tour','troubleshooting'],['guided-tour','help-limits','logout-position','app-logo']]
];
const scopeDiagram = '<figure class="scope-layout-guide"><figcaption>The same workspace arrangement, with data appropriate to each role</figcaption><div class="scope-layout-header">Exercise state · time · local display options</div><div class="scope-layout-body"><div><strong>Left panel</strong><span>Aircraft controls<br>(instructor only)</span><span>Homing</span><span>Pilot transmission</span></div><div class="scope-layout-centre"><span class="scope-layout-ring" aria-hidden="true"></span><strong>Central instrument</strong><span>QGH homing<br>or SRE / SRA radar</span></div><div><strong>Right tools</strong><span>Session</span><span>Display tools</span><span>Help / review as available</span></div></div><p>Panels move or fold away. On phones, radio sits below the instrument. A matching layout does not reveal instructor truth to the student.</p></figure>';
const radioFlow = flow('Homing indication follows the aircraft transmission', [['Transmit','Only the speaking aircraft'],['Live','QDM or QTE indication'],['Release','Hold last indication: 2 s'],['Blank','Await a new transmission']]);
const qghNotes = '<details class="guide-answer"><summary>Individual QGH: reports, orbit and formation</summary><div id="heading-passing"><h3>Report Heading Passing</h3>'+pointerList(['Arms a report when the aircraft crosses that heading; it does not assign a turn.','U/S Compass does not disclose actual heading.'])+'</div><div id="resume-normal"><h3>Resume Normal</h3>'+pointerList(['Requests an orbit exit onto the heading held before entry; watch the curved exit.'])+'</div><div id="stop-following-leader"><h3>Stop Following Leader</h3>'+pointerList(['Detaches the addressed Tactical follower; issue its subsequent instructions individually.'])+'</div><div id="continuous-listening"><h3>Continuous Listening</h3>'+pointerList(['Complete the call, then pause naturally. Recognition pauses while the pilot replies.','PTT takes priority for an interruption. Keep manual controls available.'])+'</div></details>';

export function renderGuideContent(version = knowledge.revision) {
  const used = new Set();
  const entries = ids => ids.map(id=>{const e=byId(id);if(!e||used.has(id))return '';used.add(id);return renderEntry(e);}).join('');
  let html='<div id="current-flow" data-guide-revision="'+escape(version)+'">';
  for (const [index,t] of tracks.entries()) html+='<section class="section guide-track" id="'+t.id+'">'+(t.id==='qgh'?'<span id="individual" class="guide-anchor"></span><span id="quick-start" class="guide-anchor"></span><span id="setup" class="guide-anchor"></span><span id="tactical" class="guide-anchor"></span>':'')+'<p class="eyebrow">0'+(index+1)+' · '+escape(t.note)+'</p><h2>'+t.label+'</h2>'+flow('From setup to review',t.steps)+entries(t.ids)+(t.id==='qgh'?qghNotes+'<p><a href="training-centre.html#calls">Search accepted QGH radio calls →</a></p>':'')+'<p class="guide-launch"><a class="button" href="'+t.href+'">Open '+t.label+' →</a></p></section>';
  for (const [id,title,aliases,ids] of reference) html+='<section class="section" id="'+id+'">'+aliases.map(a=>'<span id="'+a+'" class="guide-anchor"></span>').join('')+'<h2>'+title+'</h2>'+(id==='scope'?scopeDiagram:'')+(id==='aircraft'?'<details class="guide-answer"><summary>Instructor QGH / SRE / SRA: transmission and radar are separate</summary>'+radioFlow+pointerList(['A pilot Position report gives the selected aircraft’s current bearing and range.','The student’s radar return remains at its sampled position until the next beam crossing.','Procedural D/F uses its own configured hold; see Transmit and read the bearing below.'])+'</details>':'')+entries(ids)+'</section>';
  html+='<section class="section" id="tutorial"><h2>Using the video tutorial</h2>'+entries(['youtube-tutorial'])+'<p><a href="training-centre.html#demonstrations">Open the video player →</a></p></section>';
  // Preserve every knowledge answer and its destination in the same searchable guide.
  html+='<section class="section guide-reference" id="more-reference"><h2>About the suite</h2>'+entries(knowledge.entries.filter(e=>!used.has(e.id)).map(e=>e.id))+'<p class="note">'+escape(knowledge.learning)+'</p></section></div>';
  return html;
}

export function renderCurrentGuide(topic, prefix = '', version = knowledge.revision) {
  return '<section class="current-flow-guide" id="current-flow" data-guide-revision="'+escape(version)+'"><h2>Training guide</h2><p><a href="'+prefix+'training-centre.html">Open Training guide</a> · Version 1</p>'+knowledge.entries.filter(e=>e.topics.includes(topic)).map(renderEntry).join('')+'<p>'+escape(knowledge.learning)+'</p></section>';
}

export function renderCommonGuide(version = knowledge.revision) {
  return readFileSync(new URL('../packages/qgh-engine/training-centre.html',import.meta.url),'utf8').replace('<!-- SUITE_GUIDE_CONTENT -->',renderGuideContent(version));
}

export function legacyGuide(prefix = '', anchor = '') {
  const destination = prefix+'training-centre.html'+(anchor?'#'+anchor:'');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\'; object-src \'none\'; frame-src \'none\'"><meta name="training-guide-redirect" content="'+destination+'"><script src="'+prefix+'training-centre.js" defer></script><title>Training guide · ATS SIM BOX</title><link rel="canonical" href="'+prefix+'training-centre.html"></head><body><main><h1>Training guide</h1><p><a href="'+destination+'">Open Training guide</a></p></main></body></html>';
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
  await writeFile(resolve(outputRoot,'user-guide.html'),legacyGuide());
  await writeFile(resolve(outputRoot,'instructor-led/training-guide.html'),legacyGuide('../','instructor'));
  await writeFile(resolve(outputRoot,'procedural-beta/procedural-guide.html'),legacyGuide('../','procedural'));
  const centrePath=resolve(outputRoot,'training-centre.html');
  const centre=await readFile(centrePath,'utf8');
  if(!centre.includes('<!-- SUITE_GUIDE_CONTENT -->'))throw new Error('Missing Training guide content insertion point');
  await writeFile(centrePath,centre.replace('<!-- SUITE_GUIDE_CONTENT -->',renderGuideContent(version)));
  // Old nested guide routes remain bookmarks; application links use the canonical guide.
  for(const [page,prefix] of [['index.html',''],['qgh.html',''],['single.html',''],['tactical.html',''],['instructor-led/index.html','../'],['instructor-led/instructor.html','../'],['instructor-led/student.html','../'],['procedural-beta/index.html','../'],['procedural-beta/procedural.html','../']]) {
    const path=resolve(outputRoot,page);let html=await readFile(path,'utf8');
    html=html.replace(/href="(?:\.\.\/)?(?:instructor-led\/)?training-guide\.html(?:#[^"]*)?"/g,'href="'+prefix+'training-centre.html#instructor"')
      .replace(/href="(?:\.\.\/)?(?:procedural-beta\/)?procedural-guide\.html(?:#[^"]*)?"/g,'href="'+prefix+'training-centre.html#procedural"');
    await writeFile(path,html);
  }
}
