import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import Meeting from './static/meeting-room.js';
import { domHarness } from './testing/dom-harness.mjs';

const firstUrl = 'https://meet.google.com/abc-defg-hij';
const secondUrl = 'https://meet.google.com/xyz-abcd-efg';
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
};

function panelHarness(onSave = () => {}) {
  const {document, window} = parseHTML('<main id="session"></main><header id="head"></header>');
  const changes = [];
  const panel = Meeting.createPanel({container: document.getElementById('session'), onSave,
    onReadinessChange: change => changes.push(change)});
  panel.addShortcut(document.getElementById('head'));
  const input = panel.element.querySelector('input[type="url"]');
  const audio = panel.element.querySelector('.ats-meeting-audio-check');
  const save = panel.element.querySelector('.ats-meeting-actions button');
  const checkAudio = () => { audio.checked = true; audio.dispatchEvent(new window.Event('change')); };
  const update = (options = {}) => panel.update({roomKey: 'room-a', online: true, role: 'instructor', meetingUrl: firstUrl, ...options});
  const edit = url => { input.value = url; input.dispatchEvent(new window.Event('input')); };
  return {document, window, panel, input, audio, save, changes, update, edit, checkAudio};
}

test('preflight leaves offline admission/Ready unchanged and requires current online link, connection and mutual audio acknowledgement', () => {
  assert.equal(Meeting.startupReadiness({online: false, admitted: true, ready: true}).allowed, true);
  assert.equal(Meeting.startupReadiness({online: false, admitted: true, ready: false}).allowed, false);
  assert.equal(Meeting.startupReadiness({online: false, admitted: false, ready: true}).allowed, false);
  const online = {online: true, admitted: true, ready: true, connected: true, meetingUrl: firstUrl, voiceReady: true};
  assert.equal(Meeting.startupReadiness(online).allowed, true);
  for (const invalid of [{connected: false}, {meetingUrl: ''}, {meetingUrl: 'javascript:alert(1)'},
    {admitted: false}, {ready: false}, {disconnected: true}, {voiceReady: false}]) {
    const result = Meeting.startupReadiness({...online, ...invalid});
    assert.equal(result.allowed, false, JSON.stringify(invalid)); assert.ok(result.reason.length > 0);
  }
});

test('online checklist explains Ready opens the display/link before audio confirmation and Start', () => {
  const {document} = parseHTML('<main></main>');
  const checklist = Meeting.createStartupChecklist({container: document.querySelector('main')});
  const pending = checklist.update({online: true, admitted: true, ready: false, meetingUrl: firstUrl});
  assert.equal(pending.allowed, false);
  const steps = [...checklist.element.querySelectorAll('li')].map(item => item.textContent);
  assert.match(steps[2], /Ready.*display and meeting link/);
  assert.match(steps[3], /Both Join Meet.*hear|Both Join Meet.*audio/);
  assert.match(steps[4], /Start begins aircraft movement/);
  assert.equal(checklist.update({online: true, admitted: true, ready: true, meetingUrl: firstUrl, voiceReady: true}).allowed, true);
});

test('local solo guidance never marks admission or Ready complete and cannot relax online or QGH startup', () => {
  const {document} = parseHTML('<main></main>');
  const checklist = Meeting.createStartupChecklist({container: document.querySelector('main')});
  const solo = checklist.update({online: false, localSolo: true, admitted: true, ready: true});
  assert.equal(solo.allowed, true);
  assert.match(checklist.element.textContent, /without a controller.*Run/);
  assert.match(checklist.element.textContent, /To work with a controller.*Admit.*Ready/);
  assert.doesNotMatch(checklist.element.textContent, /Done/);
  assert.equal(checklist.update({online: false, admitted: false, ready: false}).allowed, false);
  assert.doesNotMatch(checklist.element.textContent, /without a controller/);
  assert.equal(checklist.update({online: true, localSolo: true, meetingUrl:firstUrl, voiceReady:true, admitted:false, ready:false}).allowed, false);
  assert.doesNotMatch(checklist.element.textContent, /without a controller/);
});

test('audio acknowledgement belongs to the current canonical room/link and resets after reconnect or offline transition', () => {
  const h = panelHarness(); h.update({meetingUrl: ''});
  assert.equal(h.audio.disabled, true); h.checkAudio(); assert.equal(h.panel.isVoiceReady(), false);
  h.update(); h.checkAudio(); assert.equal(h.panel.isVoiceReady(), true);
  h.update({meetingUrl: firstUrl + '?authuser=1'}); assert.equal(h.panel.isVoiceReady(), true, 'Equivalent canonical link keeps acknowledgement');
  h.update({meetingUrl: secondUrl}); assert.equal(h.panel.isVoiceReady(), false);
  h.checkAudio(); h.panel.resetVoice(); assert.equal(h.panel.isVoiceReady(), false);
  h.checkAudio(); h.update({roomKey: 'room-b', meetingUrl: secondUrl}); assert.equal(h.panel.isVoiceReady(), false);
  assert.equal(h.input.value, secondUrl, 'New room repopulates the saved URL even when it matches the previous room');
  h.checkAudio(); h.update({roomKey: 'room-b', online: false, meetingUrl: secondUrl});
  assert.equal(h.panel.isVoiceReady(), false); assert.equal(h.panel.element.hidden, true);
  h.update({roomKey: 'room-c', meetingUrl: 'javascript:alert(1)'});
  assert.equal(h.audio.disabled, true);
  for (const link of h.document.querySelectorAll('.ats-meeting-join')) assert.equal(link.getAttribute('href'), null);
});

test('changing rooms discards only the old meeting draft and an obsolete Save cannot restore its Join link', async () => {
  const pending = deferred(), h = panelHarness(() => pending.promise);
  h.update(); h.edit(secondUrl); h.save.click();
  h.update({roomKey: 'room-b', meetingUrl: ''});
  assert.equal(h.input.value, ''); assert.equal(h.panel.isVoiceReady(), false);
  pending.resolve(); await flush();
  assert.equal(h.input.value, '');
  for (const link of h.document.querySelectorAll('.ats-meeting-join')) {
    assert.equal(link.hidden, true); assert.equal(link.getAttribute('href'), null);
  }
  assert.match(h.panel.element.querySelector('.ats-meeting-status').textContent, /No meeting link/);
});

test('obsolete Save failures cannot overwrite current status or unlock a newer pending Save', async () => {
  const first = deferred(), second = deferred(), calls = [];
  const h = panelHarness(url => { calls.push(url); return calls.length === 1 ? first.promise : second.promise; });
  h.update({meetingUrl: ''}); h.edit(firstUrl); h.save.click();
  h.update({roomKey: 'room-b', meetingUrl: ''}); h.edit(secondUrl); h.save.click();
  assert.equal(calls.length, 2); assert.equal(h.save.disabled, true);
  first.reject(new Error('Obsolete room failure')); await flush();
  assert.equal(h.panel.element.querySelector('.ats-meeting-status').textContent.includes('Obsolete'), false);
  assert.equal(h.save.disabled, true);
  h.save.click(); assert.equal(calls.length, 2, 'A newer pending write keeps its duplicate-submit lock');
  second.resolve(); await flush();
  assert.equal(h.save.disabled, false); assert.equal(h.input.value, secondUrl);
  assert.equal(h.document.querySelector('.ats-meeting-join').getAttribute('href'), secondUrl);
});

const source = name => readFileSync(new URL('./static/' + name, import.meta.url), 'utf8');
const gestures = await import('data:text/javascript;base64,' + Buffer.from(source('scope-interaction.js')).toString('base64'));
function proceduralHarness(online = false, role = 'instructor') {
  const h = domHarness(source('procedural.html'));
  Object.assign(h.context, {
    ATCSuiteMeeting: Meeting,
    ATCSuiteWorkspace: {bindShell(){},enter(){},createFocusMode:()=>({setExpanded(){},setPhase(){}})},
    createAircraftGestures: gestures.createAircraftGestures, nearestAircraft: gestures.nearestAircraft, bindMiddleMouseStop: gestures.bindMiddleMouseStop,
    createRadarSweep:()=>({update(){}}),recordTrail(){},trailDots:()=>[],trailSpacing:()=>1,
    createTrafficReview:()=>({record(){},open(){},close(){},clear(){}}),createTrafficSetup:()=>({open(){},close(){},resetFromScenario(){}}),
    createStudentPlotting:()=>({mount(){},setEnabled(){},draw(){},onPointerDown(){},onPointerMove(){},onPointerUp(){},onPointerCancel(){}}),
    createMapWorkshop:()=>({}),alignmentBriefing:()=>'',createChartWorkshop:()=>({}),drawAreas(){},routeWindowOpen:()=>true,
    createExerciseSetupArchive:()=>({capture:async()=>{},downloadBundle:async()=>({})}),
    visibleSegment:()=>true,reserveLabel:()=>null,fitNavigation(){},approachReference:()=>[],resolveRouteFixIds:()=>[],
    onlineFixture:online, roleFixture:role,
  });
  vm.runInContext(source('procedural.js').replace(/^import .*;\r?\n/gm, '') + `
    globalThis.commands=[];globalThis.requests=[];
    command=async(type,payload)=>{commands.push({type,payload});if(type==='clock'&&payload.action==='resume')view.running=true;if(type==='clock'&&payload.action==='pause')view.running=false;};
    request=async(path,payload)=>{requests.push({path,payload});return {};};refresh=async()=>{};
    session={role:roleFixture,...(onlineFixture?{cloud:{id:'room-a'}}:{})};stage='desk';exerciseConnectionAvailable=true;
    room=roleFixture==='instructor'?{pin:'123456',students:onlineFixture?[{id:'controller',status:'ready'}]:[],meetingUrl:''}:{status:'admitted',meetingUrl:''};
    view={exerciseId:'preflight-test',available:true,running:false,terminated:false,elapsed:0,environment:{rangeNm:60},roster:[],aircraft:[],routes:[],fixes:[],areas:[]};
    globalThis.fixture={startExercise,advanceMinute,renderClockControls,
      lifecycleProbe({approve=true,fail=false}={}){
        render=()=>renderClockControls();confirm=()=>approve;
        command=async(type,payload)=>{commands.push({type,payload});if(fail)throw new Error('Replacement refused');if(type==='import')view={...view,...payload.scenario};if(type==='preset')view={...view,exerciseId:'sample-traffic',elapsed:0};if(type==='clock'&&payload.action==='resume')view.running=true;};
        request=async(path)=>({version:1,scenario:JSON.parse(JSON.stringify(view))});
      },
      state:()=>({startingTrafficRequired:session.startingTrafficRequired,exerciseId:view.exerciseId,elapsed:view.elapsed}),
      setStartingTrafficRequired(value){session.startingTrafficRequired=value;renderClockControls();},
      setLink(url){room.meetingUrl=url;session.meetingUrl=url;renderMeeting();renderClockControls();},
      setRunning(value){view.running=value;renderClockControls();},
      setConnection(value){exerciseConnectionAvailable=value;renderMeeting();renderClockControls();}
    };renderMeeting();renderClockControls();
  `, h.context);
  const get = id => h.document.getElementById(id);
  const acknowledge = () => {const input=h.document.querySelector('.ats-meeting-audio-check');input.checked=true;input.dispatchEvent(new h.Event('change'));};
  return {...h, ...h.context.fixture, get, acknowledge};
}

test('fresh Procedural traffic drafts block Run and step, while applied starting traffic enables the existing offline startup', async () => {
  const h = proceduralHarness(); h.setStartingTrafficRequired(true);
  assert.equal(h.get('resume').disabled, true); assert.equal(h.get('step').disabled, true);
  assert.match(h.get('start-setup-status').textContent, /Create your starting traffic/);
  await assert.rejects(h.startExercise(), /starting traffic/);
  await assert.rejects(h.advanceMinute(), /starting traffic/);
  assert.equal(h.context.commands.length, 0, 'a draft roster cannot accidentally run the default traffic');
  assert.equal(h.document.getElementById('setup').hidden, false, 'blocked startup returns to the traffic form');
  h.setStartingTrafficRequired(false); await h.startExercise();
  assert.deepEqual(JSON.parse(JSON.stringify(h.context.commands)), [{type:'clock',payload:{action:'resume'}}]);
});

test('restoring progress into a fresh instructor room clears the starting-traffic gate and enables continuing the saved exercise', async () => {
  const h=proceduralHarness();h.setStartingTrafficRequired(true);h.lifecycleProbe();
  const input=h.get('import');input.files=[{size:100,text:async()=>JSON.stringify({version:1,scenario:{exerciseId:'saved-progress',elapsed:75}})}];
  input.dispatchEvent(new h.Event('change'));await flush();await flush();
  assert.equal(h.state().startingTrafficRequired,false);
  assert.equal(h.state().elapsed,75);
  assert.equal(h.get('resume').disabled,false);
  assert.equal(JSON.parse(h.context.sessionStorage.getItem('qgh-procedural-browser-session-v1')).startingTrafficRequired,false);
  await h.startExercise();assert.equal(h.context.commands.at(-1).payload.action,'resume');
});

test('loading optional sample traffic completes fresh-room traffic setup, while cancelled or failed replacements leave its gate intact', async () => {
  for (const action of ['preset','import']) for (const result of ['success','cancel','fail']) {
    const h=proceduralHarness();h.setStartingTrafficRequired(true);h.lifecycleProbe({approve:result!=='cancel',fail:result==='fail'});
    if(action==='preset')h.get('preset-form').dispatchEvent(new h.Event('submit',{cancelable:true}));
    else {const input=h.get('import');input.files=[{size:100,text:async()=>JSON.stringify({version:1,scenario:{exerciseId:'restored-start',elapsed:0}})}];input.dispatchEvent(new h.Event('change'));}
    await flush();await flush();
    assert.equal(h.state().startingTrafficRequired,result!=='success',`${action} ${result}`);
    assert.equal(h.get('resume').disabled,result!=='success',`${action} ${result} Run availability`);
    if(result==='success')assert.equal(JSON.parse(h.context.sessionStorage.getItem('qgh-procedural-browser-session-v1')).startingTrafficRequired,false);
    else assert.equal(h.context.sessionStorage.getItem('qgh-procedural-browser-session-v1'),null,'unsuccessful replacement must not persist completed traffic');
  }
});

test('Procedural actual adapter preserves offline Run and gates online Run/manual step while Pause stays available', async () => {
  const offline = proceduralHarness(); assert.equal(offline.get('resume').disabled, false);
  assert.match(offline.document.querySelector('.ats-startup-checklist').textContent, /without a controller.*Run/);
  assert.doesNotMatch(offline.document.querySelector('.ats-startup-checklist').textContent, /Done/);
  await offline.startExercise(); assert.equal(offline.context.commands.length, 1);
  assert.equal(offline.context.commands[0].payload.action, 'resume');
  const h = proceduralHarness(true); assert.equal(h.get('resume').disabled, true);
  await assert.rejects(h.startExercise(), /share a Google Meet link/);
  await assert.rejects(h.advanceMinute(), /share a Google Meet link/); assert.equal(h.context.commands.length, 0);
  h.setLink(firstUrl); await assert.rejects(h.startExercise(), /check audio/);
  h.acknowledge(); assert.equal(h.get('resume').disabled, false); await h.startExercise();
  assert.equal(h.context.commands[0].payload.action, 'resume');
  h.setLink(secondUrl); h.setRunning(true);
  assert.equal(h.get('pause').disabled, false); await h.get('pause').onclick();
  assert.equal(h.context.commands.at(-1).payload.action, 'pause');
  await assert.rejects(h.startExercise(), /check audio/);
  h.acknowledge(); await h.advanceMinute();
  assert.equal(h.context.commands.at(-1).payload.action, 'step'); assert.equal(h.context.commands.at(-1).payload.seconds, 60);
  h.setConnection(false); assert.equal(h.get('resume').disabled, true);
  assert.equal(h.document.querySelector('.ats-meeting-audio-check').checked, false);
});

test('Procedural student Ready stays available before a meeting link/audio check and hides instructor startup tools', async () => {
  const h = proceduralHarness(true, 'student');
  assert.equal(h.document.querySelector('.ats-startup-checklist').hidden, true);
  assert.equal(h.get('start-setup-status').hidden, true); assert.equal(h.get('open-start-setup').hidden, true);
  assert.equal(h.document.querySelector('.ats-meeting-form').hidden, true);
  assert.equal(h.document.querySelector('.ats-meeting-audio-check').disabled, true);
  await h.get('student-ready').onclick();
  assert.equal(h.context.requests.length, 1); assert.equal(h.context.requests[0].path, '/api/procedural/room');
  assert.equal(h.context.requests[0].payload.action, 'ready'); assert.equal(h.context.commands.length, 0);
});
