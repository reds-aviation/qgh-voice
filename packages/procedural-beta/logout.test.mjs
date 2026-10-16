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

const source = name => readFileSync(new URL('./static/' + name, import.meta.url), 'utf8');
const gestures = await import('data:text/javascript;base64,' + Buffer.from(source('scope-interaction.js')).toString('base64'));
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise,resolve};};
const sessionKey = 'qgh-procedural-browser-session-v1', lastRoomKey = 'qgh-procedural-last-instructor-room';

function adapterHarness(role = 'instructor') {
  const h = domHarness(source('procedural.html'));
  let disconnected = 0;
  Object.assign(h.context, {
    ProceduralBrowserSession:{logout(){disconnected++;}},
    createAircraftGestures:gestures.createAircraftGestures,nearestAircraft:gestures.nearestAircraft,bindMiddleMouseStop:gestures.bindMiddleMouseStop,
    createRadarSweep:()=>({update(){}}),recordTrail(){},trailDots:()=>[],trailSpacing:()=>1,
    createTrafficReview:()=>({record(){},open(){},close(){},clear(){}}),createTrafficSetup:()=>({open(){},close(){}}),
    createStudentPlotting:()=>({mount(){},setEnabled(){},draw(){},onPointerDown(){},onPointerMove(){},onPointerUp(){},onPointerCancel(){}}),
    createMapWorkshop:()=>({}),alignmentBriefing:()=>'',createChartWorkshop:()=>({discardDraft(){}}),drawAreas(){},routeWindowOpen:()=>true,
    createExerciseSetupArchive:()=>({capture:async()=>{},downloadBundle:async()=>({})}),
    visibleSegment:()=>true,reserveLabel:()=>null,fitNavigation(){},approachReference:()=>[],resolveRouteFixIds:()=>[],roleFixture:role,
  });
  vm.runInContext(source('workspace-shell.js'),h.context);
  vm.runInContext(source('procedural.js').replace(/^import .*;\r?\n/gm,'') + `
    session={role:roleFixture,token:'active-token',csrf:'active-csrf',workspace:'procedural',roomId:'room-a',name:'Controller'};
    view={exerciseId:'logout-exercise',available:true,running:true,terminated:false,elapsed:120,environment:{rangeNm:60},roster:[],aircraft:[],routes:[],fixes:[],areas:[]};
    setStage('desk');selected='';
    globalThis.fixture={state:()=>({session,view,generation,loginBusy,commandBusy,stage}),command,openSession,abortPendingLogin:logoutToHome,
      setRequest(fn){request=fn;},entry(){session=null;view=null;setStage('entry');}, setup(elapsed=0){view.elapsed=elapsed;view.running=false;setStage('setup');},
    };
  `,h.context);
  const store=h.context.sessionStorage, local=h.context.localStorage;
  store.setItem(sessionKey,'active progress');store.setItem('reds-procedural-drafts','unsent strip');store.setItem('reds-procedural-draft-exercise','logout-exercise');
  store.setItem('ats-procedural-replay','replay');store.setItem('ats-student-plot-identity','plot-id');
  const estimates='ats-simbox-student-estimates-v1:'+encodeURIComponent('logout-exercise:plot-id:Controller');
  if(role==='student')local.setItem(estimates,'estimate dots');
  local.setItem('ats-simbox-exercise-templates-v1','named saved exercise');
  const logout=()=>{const button=h.document.getElementById('workspaceLogout');assert.ok(button,'Logout must exist on the actual Procedural adapter');button.click();};
  const answer=async accept=>{const button=h.document.querySelector(accept?'.ats-confirm-accept':'.ats-confirm-cancel');assert.ok(button);button.click();await flush();};
  return {...h,...h.context.fixture,logout,answer,estimates,disconnected:()=>disconnected};
}

for(const role of ['instructor','student'])test(`Procedural ${role} Logout cancel preserves progress; confirmation clears current progress and returns Home while retaining saved exercises`,async()=>{
  const h=adapterHarness(role), before=h.state(), store=h.context.sessionStorage;
  h.logout();assert.match(h.document.querySelector('.ats-confirm-dialog').textContent,/Current exercise progress will be lost/);
  await h.answer(false);
  assert.equal(h.state().session===before.session,true);assert.equal(h.state().view===before.view,true);
  assert.equal(h.state().generation,before.generation);assert.equal(store.getItem(sessionKey),'active progress');assert.equal(h.disconnected(),0);
  assert.equal(h.context.location.href,'https://example.test/qgh-voice/procedural-beta/');
  h.logout();await h.answer(true);
  assert.equal(h.state().session,null);assert.equal(h.state().view,null);assert.ok(h.state().generation>before.generation);assert.equal(h.disconnected(),1);
  for(const key of [sessionKey,'reds-procedural-drafts','reds-procedural-draft-exercise','ats-procedural-replay','ats-student-plot-identity'])assert.equal(store.getItem(key),null,key);
  if(role==='student')assert.equal(h.context.localStorage.getItem(h.estimates),null);
  assert.equal(h.context.localStorage.getItem('ats-simbox-exercise-templates-v1'),'named saved exercise');
  assert.equal(h.context.location.href,'https://example.test/qgh-voice/index.html');
});

test('a pending Procedural command cannot restore the logged-out desk or its progress after confirmation',async()=>{
  const h=adapterHarness(), pending=deferred();h.setRequest(()=>pending.promise);
  const command=h.command('clock',{action:'pause'});assert.equal(h.state().commandBusy,true);
  h.logout();await h.answer(true);pending.resolve({accepted:true});
  await assert.rejects(command,/Session changed/);assert.equal(h.state().session,null);assert.equal(h.state().commandBusy,false);
  assert.equal(h.context.sessionStorage.getItem(sessionKey),null);
});

test('a login completed after Logout cannot reopen the desk or unlock a newer pending login',async()=>{
  const h=adapterHarness(), first=deferred(), second=deferred(), replies=[first,second];
  h.entry();h.setRequest(()=>replies.shift().promise);
  const opening=h.openSession('student');assert.equal(h.state().loginBusy,true);
  await h.abortPendingLogin();
  const newer=h.openSession('student');assert.equal(h.state().loginBusy,true);
  first.resolve({role:'student',token:'obsolete',csrf:'obsolete',workspace:'procedural'});await opening;
  assert.equal(h.state().session,null);assert.equal(h.state().loginBusy,true);
  assert.equal(h.document.getElementById('student-login').disabled,true,'Obsolete login finalization must preserve the new login lock');
  await h.abortPendingLogin();
  second.resolve({role:'student',token:'also-obsolete',csrf:'obsolete',workspace:'procedural'});await newer;
  assert.equal(h.state().session,null);assert.equal(h.state().loginBusy,false);
  assert.equal(h.context.sessionStorage.getItem(sessionKey),null);
});

test('untouched Procedural entry and its pending join have no exercise Logout',async()=>{
  const h=adapterHarness();h.entry();await flush();
  const slot=h.document.querySelector('.ats-logout-slot');
  assert.equal(slot.hidden,true);assert.equal(h.document.body.classList.contains('ats-has-logout'),false);
  h.logout();assert.equal(h.document.querySelector('.ats-confirm-dialog'),null);
  const pending=deferred();h.setRequest(()=>pending.promise);
  const opening=h.openSession('student');assert.equal(h.state().loginBusy,true);
  await flush();assert.equal(slot.hidden,true,'pending login is still an input page');
  h.logout();assert.equal(h.document.querySelector('.ats-confirm-dialog'),null);
  await h.abortPendingLogin();
  pending.resolve({role:'student',token:'obsolete',csrf:'obsolete',workspace:'procedural'});await opening;
  assert.equal(h.state().session,null);assert.equal(slot.hidden,true);
});

async function transportHarness() {
  const h=domHarness(source('procedural.html')), calls=[], ports=[], createGate={current:null};
  const roomId='11111111-1111-4111-8111-111111111111';
  const projected={role:'student',exerciseId:'transport-exercise',available:true,running:false,environment:{map:{}},roster:[]};
  const service={async call(action,id,payload={}){
    calls.push({action,id,payload});
    if(action==='create'&&createGate.current)return createGate.current.promise;
    if(['create','join','claim'].includes(action))return {id:'cloud-room',pin:'123456',sequence:0};
    if(action==='poll')return {room:{status:'ready'},state:projected};
    return {room:{pin:'123456',students:[]},commands:[]};
  }};
  class SharedWorker {
    constructor(url){const port={messages:[],closed:false,start(){},close(){this.closed=true;},postMessage(message){
      this.messages.push(message);if(!message.id)return;
      const body=message.path==='session'?{token:'transport-token',csrf:'transport-csrf',role:JSON.parse(message.body).role,workspace:'procedural',roomId}
        :message.path==='cloud-view'?projected:{};
      this.onmessage?.({data:{id:message.id,status:200,body}});
    }};this.port=port;ports.push(port);}
  }
  h.window.fetch=async()=>{throw new Error('No external request is permitted');};
  Object.assign(h.window,{SharedWorker,WebAssembly:{},indexedDB:{}});
  Object.assign(h.context,{SharedWorker,Response,Headers,remoteConfig:{},validRemoteConfig:()=>true,createRemoteService:()=>service,ProceduralRooms:{find:async()=>roomId},adapterImported:false});
  vm.runInContext(source('meeting-room.js'),h.context);
  vm.runInContext(source('remote-room.js').replace(/^import .*;\r?\n/gm,'').replace(/export /g,''),h.context);
  const client=source('browser-client.js').replace(/^import .*;\r?\n/gm,'').replace(/import\.meta\.url/g,JSON.stringify('https://example.test/qgh-voice/procedural-beta/browser-client.js'))
    .replace("await import('./procedural.js');",'adapterImported=true;');
  await vm.runInContext('(async()=>{'+client+'})()',h.context);
  const login=role=>h.window.fetch('/api/procedural/session',{method:'POST',body:JSON.stringify({role,connection:'online',pin:'123456',name:'Controller'})});
  return {...h,calls,ports,createGate,roomId,login};
}

for(const role of ['instructor','student'])test(`browser transport Logout disconnects ${role} without restoring current room progress or affecting saved exercises`,async()=>{
  const h=await transportHarness();assert.equal((await h.login(role)).status,200);
  const store=h.context.sessionStorage;store.setItem(sessionKey,'current session');store.setItem('ats-simbox-exercise-templates-v1','named exercise');
  assert.equal(typeof h.context.ProceduralBrowserSession?.logout,'function');
  await h.context.ProceduralBrowserSession.logout();await flush();
  assert.equal((await h.window.fetch('/api/procedural/state')).status,401);
  for(const key of [sessionKey,lastRoomKey,`atc-cloud-room:${h.roomId}`])assert.equal(store.getItem(key),null,key);
  assert.equal(store.getItem('ats-simbox-exercise-templates-v1'),'named exercise');
  assert.equal(h.calls.filter(call=>call.action==='close').length,role==='instructor'?1:0,'Only an instructor closes the online room');
  for(const port of h.ports){assert.equal(port.closed,true);assert.ok(port.messages.some(message=>message.kind==='detach'));}
});

test('Logout during online room creation prevents late activation or recovery keys and closes the obsolete instructor room',async()=>{
  const h=await transportHarness(), pending=deferred();h.createGate.current=pending;
  const opening=h.login('instructor');await flush();assert.equal(h.calls.at(-1).action,'create');
  assert.equal(typeof h.context.ProceduralBrowserSession?.logout,'function');await h.context.ProceduralBrowserSession.logout();
  pending.resolve({id:'obsolete-cloud-room',pin:'654321',sequence:0});
  assert.equal((await opening).status,503);await flush();
  assert.equal((await h.window.fetch('/api/procedural/state')).status,401);
  assert.equal(h.context.sessionStorage.getItem(lastRoomKey),null);assert.equal(h.context.sessionStorage.getItem(`atc-cloud-room:${h.roomId}`),null);
  assert.ok(h.calls.some(call=>call.action==='close'&&call.id==='obsolete-cloud-room'));
  assert.equal(h.ports[0].closed,true);
});

test('starting traffic input hides Logout before movement; revisiting setup with exercise progress retains it',async()=>{
  const h=adapterHarness(),slot=h.document.querySelector('.ats-logout-slot');
  h.setup(0);await flush();assert.equal(slot.hidden,true,'input setup before the first run has no progress to discard');
  h.logout();assert.equal(h.document.querySelector('.ats-confirm-dialog'),null);
  h.setup(120);await flush();assert.equal(slot.hidden,false,'the same setup view retains an exercise already in progress');
  h.logout();await h.answer(false);assert.equal(h.state().view.elapsed,120);
});
