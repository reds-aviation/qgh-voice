import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {domHarness} from './testing/dom-harness.mjs';

const source=readFileSync(new URL('./static/suite-tour.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function studentTour({ready=false,workspace=false,phase='READY',compactStatus=false,releaseKnowledge=false}={}) {
  const h=domHarness(`<html><body class="student-page"><header></header><section id="readyPanel" ${ready?'':'hidden'}><button id="studentReady">POSITION READY</button></section><section id="studentWorkspace" ${workspace?'':'hidden'}><b id="studentExerciseState">${phase}</b><canvas id="studentScope"></canvas></section><section id="studentEnded" hidden></section><time id="studentClock">00:00</time></body></html>`,'/qgh-voice/instructor-led/student.html');
  h.context.HTMLElement.prototype.getClientRects=function(){return this.hidden||(compactStatus&&this.id==='studentExerciseState')?[]:[{}];};
  h.context.requestAnimationFrame=fn=>fn();h.context.innerHeight=844;
  if(releaseKnowledge)vm.runInContext(readFileSync(new URL('./static/guide-knowledge.js',import.meta.url),'utf8'),h.context);
  else h.context.ATCGuideKnowledge={revision:'tour-regression',firstUse:[{pages:['student'],selector:'#readyPanel',title:'Your student position',text:'Select Position ready and wait for the instructor to start.'}],tours:[{pages:['student'],selector:'#studentScope',title:'Student observations',text:'This scope contains only your permitted observations.'}]};
  vm.runInContext(source,h.context);
  return {...h,panel:h.document.getElementById('suite-tour'),button:h.document.getElementById('suite-tour-open')};
}

test('release knowledge introduces the student at admission and Position ready before workspace controls are visible',()=>{
  const h=studentTour({ready:true,phase:'RUNNING',releaseKnowledge:true});
  assert.equal(h.panel.hidden,false);
  assert.match(h.panel.textContent,/same PC|connection mode|PIN/i);
  assert.equal(h.document.querySelector('.suite-tour-target').id,'readyPanel');
  h.panel.querySelectorAll('button')[1].click();
  assert.equal(h.document.querySelector('.suite-tour-target').id,'studentReady');
  assert.match(h.panel.textContent,/Ready.*instructor|instructor.*Ready/i);
  assert.equal(h.document.getElementById('studentWorkspace').hidden,true);
});

test('student introduction opens before Position ready and closes without changing the exercise clock',async()=>{
  const h=studentTour({ready:true,phase:'RUNNING'});
  assert.equal(h.panel.hidden,false,'a hidden initial RUNNING label does not suppress admission guidance');
  assert.match(h.panel.textContent,/Quick introduction/);
  h.document.getElementById('studentReady').click();
  assert.equal(h.panel.hidden,true,'Ready dismisses onboarding before its async session delivery');
  h.document.getElementById('readyPanel').hidden=true;
  h.document.getElementById('studentWorkspace').hidden=false;
  await tick();
  assert.equal(h.panel.hidden,true);
  assert.equal(h.document.getElementById('studentClock').textContent,'00:00');
});

test('late student workspace mutations cannot open automatic onboarding during Run or its first Pause',async()=>{
  const h=studentTour();
  h.document.getElementById('studentWorkspace').hidden=false;
  await tick();
  assert.equal(h.panel.hidden,true,'revealing the workspace before its lifecycle text does not trigger onboarding');
  h.document.body.classList.add('exercise-console');
  h.document.getElementById('studentExerciseState').textContent='RUNNING';
  await tick();
  assert.equal(h.panel.hidden,true);
  assert.equal(h.button.hidden,true);
  h.document.getElementById('studentExerciseState').textContent='PAUSED';
  await tick();
  assert.equal(h.panel.hidden,true,'first Pause does not trigger a missed automatic introduction');
  h.document.getElementById('readyPanel').hidden=false;
  await tick();
  assert.equal(h.panel.hidden,true,'a late admission panel message cannot reopen first-use help');
  h.button.click();
  assert.equal(h.panel.hidden,false,'an explicit manual tour remains available while paused');
  h.document.getElementById('studentExerciseState').textContent='RUNNING';
  await tick();
  assert.equal(h.panel.hidden,true,'Resume dismisses a manually requested paused tour');
  assert.equal(h.document.querySelector('.suite-tour-target'),null);
});

test('paused recovery skips automatic onboarding and compact hidden status still closes manual help at Run',async()=>{
  const h=studentTour({workspace:true,phase:'PAUSED',compactStatus:true});
  assert.equal(h.panel.hidden,true,'a recovered paused exercise is already past automatic onboarding');
  h.button.click();assert.equal(h.panel.hidden,false);
  h.document.getElementById('studentExerciseState').textContent='RUNNING';
  await tick();
  assert.equal(h.panel.hidden,true,'phase does not depend on whether responsive CSS displays the status label');
  assert.equal(h.button.hidden,true);
  h.document.getElementById('studentExerciseState').textContent='PAUSED';
  await tick();assert.equal(h.panel.hidden,true);
});

test('instructor and procedural onboarding cannot reappear after their first Run',async()=>{
  for(const [path,workspace,status,paused] of [
    ['/qgh-voice/instructor-led/instructor.html','activeWorkspace','exerciseState','READY'],
    ['/qgh-voice/procedural-beta/procedural.html','desk','clock-state','PAUSED'],
  ]) {
    const h=domHarness(`<html><body><header></header><section id="${workspace}"><b id="${status}">${paused}</b><canvas id="testScope"></canvas><time id="clock">10:00:00</time></section></body></html>`,path);
    h.context.HTMLElement.prototype.getClientRects=function(){return this.hidden?[]:[{}];};h.context.requestAnimationFrame=fn=>fn();h.context.innerHeight=800;
    const page=workspace==='desk'?'procedural':'instructor';
    h.context.ATCGuideKnowledge={revision:'sticky-regression',firstUse:[{pages:[page],selector:'#missingControl',title:'Not ready',text:'Unavailable until a later update.'}]};
    vm.runInContext(source,h.context);
    const panel=h.document.getElementById('suite-tour');
    assert.equal(panel.hidden,true);
    h.document.body.classList.add('exercise-running');await tick();
    h.document.body.classList.remove('exercise-running');h.document.getElementById(status).textContent='PAUSED';
    const target=h.document.createElement('button');target.id='missingControl';h.document.getElementById(workspace).append(target);
    await tick();assert.equal(panel.hidden,true,`${page}: late controls after Pause do not start a missed tour`);
  }
});
