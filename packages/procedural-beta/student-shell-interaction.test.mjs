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
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {domHarness} from './testing/dom-harness.mjs';

const html=readFileSync(new URL('../atc-suite/student.html',import.meta.url),'utf8');
const source=readFileSync(new URL('./static/workspace-shell.js',import.meta.url),'utf8');

function studentShell(width=1280) {
  const h=domHarness(html,'/qgh-voice/instructor-led/student.html',width);
  const get=id=>h.document.getElementById(id),root=get('studentWorkspace');
  const retained=new Map(['studentEstimateScope','radarScope','parStudentView','qghStudentView','studentCaption','studentPlotTools'].map(id=>[id,get(id)]));
  vm.runInContext(source,h.context);
  const bind=()=>h.context.ATCSuiteWorkspace.bindShell({root,scope:get('radarScope'),shelf:get('student-estimate-panel'),actions:root.querySelector('.student-head')});
  bind();
  root.hidden=false;h.document.body.classList.add('exercise-console');
  const trigger=id=>get('studentTools').querySelector('[aria-controls="'+id+'"]');
  const key=(value,shiftKey=false)=>{const event=new h.Event('keydown',{bubbles:true,cancelable:true});event.key=value;event.shiftKey=shiftKey;h.document.dispatchEvent(event);return event;};
  return {...h,get,root,retained,bind,trigger,key};
}

test('student drawer close works when Ready or a shortcut opened it outside the tool rail',()=>{
  const h=studentShell(),drawer=h.get('studentNavigation');
  // Before the browser delivers its toggle event, the close button must still
  // close its own drawer rather than relying on the rail's selected drawer.
  drawer.open=true;
  drawer.querySelector('.ats-drawer-close').click();
  assert.equal(drawer.open,false);
  assert.equal(h.trigger('studentNavigation').getAttribute('aria-expanded'),'false');
  drawer.open=true;drawer.dispatchEvent(new h.Event('toggle'));
  assert.equal(h.trigger('studentNavigation').getAttribute('aria-expanded'),'true');
  h.key('Escape');
  assert.equal(drawer.open,false,'an externally opened drawer also responds to Escape');
});

test('student tools keep one drawer open and restore focus on close and Escape',()=>{
  const h=studentShell(),session=h.trigger('studentNavigation'),plotting=h.trigger('student-estimate-panel');
  session.focus();session.click();
  assert.equal(h.get('studentNavigation').open,true);
  plotting.focus();plotting.click();
  assert.equal(h.get('studentNavigation').open,false);
  assert.equal(h.get('student-estimate-panel').open,true);
  assert.equal(plotting.getAttribute('aria-expanded'),'true');
  h.key('Escape');
  assert.equal(h.get('student-estimate-panel').open,false);
  assert.equal(h.document.activeElement,plotting);
  session.click();h.get('studentNavigation').querySelector('.ats-drawer-close').click();
  assert.equal(h.get('studentNavigation').open,false);
  assert.equal(h.document.activeElement,session);
});

test('radio hide, minimize and reopen retain the original D/F, captions and listeners',()=>{
  const h=studentShell(),radio=h.get('studentRadioPanel'),toggle=h.trigger('studentRadioPanel'),body=h.get('studentRadioBody');
  let selections=0;h.get('selectQte').addEventListener('click',()=>selections++);
  h.get('studentCaption').querySelector('strong').textContent='101, position report.';
  toggle.click();assert.equal(radio.hidden,true);assert.equal(toggle.getAttribute('aria-expanded'),'false');
  toggle.click();assert.equal(radio.hidden,false);assert.equal(toggle.getAttribute('aria-expanded'),'true');
  const minimize=radio.querySelector('.ats-overlay-collapse');
  minimize.click();assert.equal(body.hidden,true);assert.equal(minimize.getAttribute('aria-expanded'),'false');
  minimize.click();assert.equal(body.hidden,false);
  h.get('selectQte').click();assert.equal(selections,1);
  h.bind();
  for(const [id,node]of h.retained){assert.equal(h.get(id),node,id+' is retained');assert.equal(h.document.querySelectorAll('#'+id).length,1);}
  assert.equal(h.document.querySelectorAll('#studentRadioPanel').length,1);
  assert.equal(h.document.querySelectorAll('#studentTools').length,1);
  assert.equal(h.document.querySelectorAll('#studentOptionsToggle').length,1);
  assert.equal(h.get('studentCaption').querySelector('strong').textContent,'101, position report.');
});

test('phone student drawers retain accessible close buttons and contain Tab focus',()=>{
  const h=studentShell(390);
  for(const id of ['studentNavigation','student-estimate-panel']){
    const trigger=h.trigger(id),drawer=h.get(id),close=drawer.querySelector('.ats-drawer-close');
    assert.equal(close.closest('.ats-overlay-desktop'),null,'close is not in the CSS group hidden on phones');
    assert.equal(close.getAttribute('aria-label'),'Close panel');
    trigger.click();
    const nodes=[...drawer.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(node=>!node.closest('[hidden]'));
    nodes.at(-1).focus();h.key('Tab');assert.equal(h.document.activeElement,nodes[0]);
    h.key('Tab',true);assert.equal(h.document.activeElement,nodes.at(-1));
    close.click();assert.equal(drawer.open,false);assert.equal(h.document.activeElement,trigger);
  }
});

test('student shell only changes display regions and never adds instructor aircraft controls',()=>{
  const h=studentShell();
  for(const id of ['instructorScope','startExercise','pauseExercise','quickTransmit','quickTurnLeft','quickTurnRight','reportPosition','turnLeftHeading','assignedHeading']){
    assert.equal(h.get(id),null,id+' remains instructor-only');
  }
  assert.equal(h.get('radarScope').closest('.student-console'),h.root.querySelector('.student-console'));
  assert.equal(h.get('parStudentView').closest('.student-console'),h.root.querySelector('.student-console'));
  assert.equal(h.get('qghStudentView').closest('#studentRadioBody'),h.get('studentRadioBody'));
  const settings=[...h.get('studentTools').querySelectorAll('button')].find(node=>node.textContent==='Scope settings');
  h.get('studentOptionsToggle').click();
  assert.equal(h.root.classList.contains('ats-student-focus'),true);
  assert.equal(settings.getAttribute('aria-expanded'),'false');
  settings.click();
  assert.equal(h.root.classList.contains('ats-student-focus'),false);
  assert.equal(h.get('studentOptionsToggle').getAttribute('aria-expanded'),'true');
  assert.equal(h.get('studentRadioPanel').hidden,false);
});
