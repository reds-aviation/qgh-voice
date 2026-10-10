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
    stage='desk';selected='';
    globalThis.fixture={state:()=>({session,view,generation,loginBusy,commandBusy,stage}),command,openSession,
      setRequest(fn){request=fn;},entry(){session=null;view=null;stage='entry';},
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
  h.logout();await h.answer(true);
  const newer=h.openSession('student');assert.equal(h.state().loginBusy,true);
  first.resolve({role:'student',token:'obsolete',csrf:'obsolete',workspace:'procedural'});await opening;
  assert.equal(h.state().session,null);assert.equal(h.state().loginBusy,true);
  assert.equal(h.document.getElementById('student-login').disabled,true,'Obsolete login finalization must preserve the new login lock');
  h.logout();await h.answer(true);
  second.resolve({role:'student',token:'also-obsolete',csrf:'obsolete',workspace:'procedural'});await newer;
  assert.equal(h.state().session,null);assert.equal(h.state().loginBusy,false);
  assert.equal(h.context.sessionStorage.getItem(sessionKey),null);
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
