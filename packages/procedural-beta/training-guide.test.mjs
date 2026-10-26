/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {domHarness} from './testing/dom-harness.mjs';
import {renderCommonGuide,legacyGuide} from '../../scripts/build-suite-guides.mjs';
const require=createRequire(import.meta.url);
const knowledge=require('./static/guide-knowledge.js');
const {matchGuideQuestion,topicForPage}=require('./static/suite-guide-chat.js');

test('one Training guide exposes three complete flows and keeps every answer searchable',()=>{
 const {document}=parseHTML(renderCommonGuide());
 assert.equal(document.querySelector('h1').textContent,'Training guide');
 assert.deepEqual([...document.querySelectorAll('.guide-choice h2')].map(n=>n.textContent),['QGH','Instructor','Procedural']);
 for(const id of ['qgh','instructor','procedural'])assert.equal(document.getElementById(id).querySelectorAll('.guide-flow li').length,6,id);
 const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length,'no duplicate destinations');
 for(const e of knowledge.entries){assert.ok(document.getElementById(e.anchor),e.id);assert.equal(document.querySelectorAll('[data-guide-entry="'+e.id+'"]').length,1,e.id+' occurs once');}
 assert.ok(document.querySelector('.scope-layout-guide'));
 assert.ok(document.getElementById('callSearch'));assert.ok(document.getElementById('suiteTutorialLaunch'));
 assert.equal(document.querySelector('iframe'),null,'video remains optional until explicitly loaded');
});

test('legacy guide paths redirect to the same page with readable fallback links',()=>{
 for(const [prefix,anchor]of [['',''],['../','instructor'],['../','procedural']]){
  const {document}=parseHTML(legacyGuide(prefix,anchor)),target=prefix+'training-centre.html'+(anchor?'#'+anchor:'');
  assert.equal(document.querySelector('meta[name="training-guide-redirect"]').getAttribute('content'),target);
  assert.equal(document.querySelector('a').getAttribute('href'),target);
  assert.equal(document.querySelectorAll('[data-guide-entry]').length,0);
 }
});

test('legacy guide redirects preserve bookmarks and never initialize catalogue or media',()=>{
 for(const [prefix,anchor,oldHash,wanted]of [['','','#procedural','#procedural'],['','','#individual','#individual'],['../','instructor','','#instructor']]){
  const h=domHarness(legacyGuide(prefix,anchor),prefix?'/qgh-voice/instructor-led/training-guide.html':'/qgh-voice/user-guide.html');
  h.context.location.hash=oldHash;let redirected='';h.context.location.replace=url=>{redirected=url;};
  vm.runInContext(readFileSync(new URL('../qgh-engine/training-centre.js',import.meta.url),'utf8'),h.context);
  assert.equal(redirected,'https://example.test/qgh-voice/training-centre.html'+wanted);
  assert.equal(h.document.querySelector('iframe'),null);
 }
});

test('guide search reveals collapsed detail and keeps RT catalogue usable',async()=>{
 const h=domHarness(renderCommonGuide(),'/qgh-voice/training-centre.html');
 h.context.requestAnimationFrame=fn=>fn();
 h.context.QGHRTCatalogue={entries:[{id:'sample-turn',canonicalPhrase:'Turn right heading 260',acceptedVariants:[],modes:['normal'],category:'turn',simulatorEffect:'Turn the addressed aircraft.',classification:'executed',requiredState:'Normal QGH',callsignRule:'Address aircraft',pilotResponseClass:'readback',dfBehavior:'Transmission-bound',limitations:'Heading must be valid.'}]};
 vm.runInContext(readFileSync(new URL('../qgh-engine/training-centre.js',import.meta.url),'utf8'),h.context);
 const input=h.document.getElementById('guideSearch');input.value='position report';input.dispatchEvent(new h.Event('input'));
 const results=h.document.getElementById('guideSearchResults');assert.equal(results.hidden,false);
 const positionLink=[...results.querySelectorAll('a')].find(a=>a.getAttribute('href')==='#answer-instructor-transmit');assert.ok(positionLink);
 positionLink.click();const answer=h.document.getElementById('answer-instructor-transmit');assert.equal(answer.open,true);assert.equal(answer.querySelector('.guide-full').open,true);assert.equal(h.document.activeElement,answer.querySelector('summary'));
 input.value='zzzzmissingtopic';input.dispatchEvent(new h.Event('input'));assert.equal(results.hidden,true);assert.match(h.document.getElementById('guideSearchStatus').textContent,/No matching topic/);
 const rt=h.document.getElementById('callSearch');rt.value='260';rt.dispatchEvent(new h.Event('input'));assert.match(h.document.getElementById('callCount').textContent,/1 of 1/);assert.match(h.document.getElementById('callResults').textContent,/Turn right heading 260/);
 await new Promise(resolve=>setImmediate(resolve));
});

test('Gyani context and current scope/radio guidance use canonical destinations',()=>{
 for(const [hash,topic]of [['#qgh','qgh-individual'],['#instructor','qgh-instructor'],['#procedural','procedural'],['','suite']])assert.equal(topicForPage('/qgh-voice/training-centre.html',hash),topic);
 const distance=matchGuideQuestion('Why does QGH Transmit no longer show range?','qgh-individual');assert.equal(distance.intent,'individual-distance');assert.match(distance.text,/bearing only/);assert.match(distance.text,/does not update continuously/);
 const position=matchGuideQuestion('Where is Position report in SRA?','sra');assert.equal(position.intent,'instructor-transmit');assert.match(position.text,/2 seconds/);assert.match(position.text,/does not replace or refresh/);assert.match(position.links[0].href,/training-centre\.html#pilot/);
 const scope=knowledge.entries.find(e=>e.id==='scope-tools');assert.match(scope.text,/5 NM or 10 NM/);assert.match(scope.text,/cannot enable a withheld aid/);
});
