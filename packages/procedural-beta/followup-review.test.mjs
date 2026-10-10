import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {domHarness} from './testing/dom-harness.mjs';

const source = name => readFileSync(new URL('./static/' + name, import.meta.url), 'utf8');
const gesturesModule = await import('data:text/javascript;base64,' + Buffer.from(source('scope-interaction.js')).toString('base64'));

function consoleHarness() {
  const h = domHarness(source('procedural.html'));
  const jobs = new Map(), sketchEvents = [], archiveCalls = [];
  const archiveTemplate = { name: 'Original training exercise', bundle: { scenario: { elapsed: 0, aircraft: [{ id: 'a1', callsign: '101', xNm: -20, yNm: 10 }], areas: [] } } };
  let nextJob = 0, sketching = false, chartContext;
  Object.assign(h.context, {
    createAircraftGestures: options => gesturesModule.createAircraftGestures({...options,
      schedule: fn => { jobs.set(++nextJob, fn); return nextJob; }, cancel: id => jobs.delete(id)}),
    nearestAircraft: gesturesModule.nearestAircraft,
    bindMiddleMouseStop: gesturesModule.bindMiddleMouseStop,
    createRadarSweep: () => ({update(){}}), recordTrail(){}, trailDots: () => [], trailSpacing: () => 1,
    createTrafficReview: () => ({record(){},open(){},close(){},clear(){}}),
    createStudentPlotting: () => ({mount(){},setEnabled(){},draw(){},onPointerDown(){},onPointerMove(){},onPointerUp(){},onPointerCancel(){}}),
    createMapWorkshop: () => ({render(){}}), alignmentBriefing: () => '',
    createExerciseSetupArchive: () => ({ capture: async () => { archiveCalls.push('capture'); }, downloadBundle: async () => { archiveCalls.push('download'); return archiveTemplate; } }),
    createChartWorkshop: options => { chartContext = options; return {render(){},isSketching:()=>sketching,cancelSketch:()=>{sketching=false;},onPointer:()=>{sketchEvents.push('down');return true;},onPointerMove:()=>{sketchEvents.push('move');return true;},onPointerUp:()=>{if(!sketching)return false;sketchEvents.push('up');return true;}}; }, drawAreas(){}, routeWindowOpen: () => true,
    visibleSegment: () => true, reserveLabel: () => null, fitNavigation(){}, approachReference: () => [], resolveRouteFixIds: () => [],
  });
  vm.runInContext(source('workspace-shell.js'), h.context);
  vm.runInContext(source('meeting-room.js'), h.context);
  vm.runInContext('(function(){' + source('traffic-setup.js').replace(/^export /gm, '') + ';globalThis.createTrafficSetup=createTrafficSetup;})();', h.context);
  vm.runInContext(source('procedural.js').replace(/^import .*;\r?\n/gm, '') + `
    globalThis.commands = []; command = async (...args) => commands.push(args);
    globalThis.downloads = []; download = (name, data) => downloads.push({name, data});
    globalThis.downloadRequests = []; request = async path => { downloadRequests.push(path); return {scenario:{elapsed:120,events:[{text:'Attempt record'}]}}; };
    globalThis.prepare = (role, running = false) => {
      session = {role,token:'active-session-token',csrf:'active-csrf'}; stage = 'desk';
      const a = {id:'a1',callsign:'101',type:'TRAINER',status:'airborne',mode:'heading',headingDeg:90,speedKt:240,altitudeFt:10000,targetAltitudeFt:10000,xNm:0,yNm:0};
      view = {exerciseId:'review-test',available:true,running,environment:{rangeNm:60,stationName:'NAV0',map:{}},roster:[a],aircraft:[a],routes:[],fixes:[],areas:[],elapsed:0};
      choose(a.id); setStage('desk');
    };
    globalThis.cancelScope = resetScopePointer;
    globalThis.changeStage = setStage;
    globalThis.clearSelection = () => { selected = ''; };
    globalThis.setEnded = ended => { view.terminated = ended; };
    globalThis.setElapsed = elapsed => { view.elapsed = elapsed; };
    globalThis.setStartingTrafficRequired = required => { session.startingTrafficRequired = required; };
    globalThis.addSecondAircraft = () => { const a = {...view.aircraft[0],id:'a2',callsign:'102',xNm:20}; view.aircraft.push(a);view.roster.push(a); };
    globalThis.aircraftPoint = id => { const a=view.aircraft.find(a=>a.id===id),g=geometry();return {x:g.cx+a.xNm*g.scale,y:g.cy-a.yNm*g.scale}; };
  `, h.context);
  for (const form of h.document.querySelectorAll('form')) form.reset = () => {};
  const canvas = h.document.getElementById('scope');
  let capture = null;
  canvas.setPointerCapture = id => { capture = id; };
  canvas.hasPointerCapture = id => id === capture;
  canvas.releasePointerCapture = id => { if (capture === id) capture = null; };
  function emit(type, {button = 0, time = 0, x = 300, y = 250, pointerType = 'mouse', id = 1} = {}) {
    const e = new h.Event(type, {bubbles:true,cancelable:true});
    Object.assign(e, {isPrimary:true,pointerId:id,pointerType,button,clientX:x,clientY:y,timeStamp:time});
    canvas.dispatchEvent(e); return e;
  }
  return {...h, canvas, jobs, emit, sketchEvents, archiveCalls, archiveTemplate, startSketch() {sketching=true;chartContext.scope.openScope();}, flush() {const tasks = [...jobs.values()]; jobs.clear(); for (const fn of tasks) fn();}};
}

test('Back to traffic setup returns to the paused desk or ended Review without replacing the attempt', async () => {
  const h = consoleHarness(); h.context.prepare('instructor'); h.context.setElapsed(120);
  const next = () => new Promise(resolve => setImmediate(resolve));
  h.context.setStartingTrafficRequired(true);
  await h.context.showTrafficSetup();
  assert.equal(h.document.getElementById('traffic-return-exercise').hidden, true);
  h.document.querySelector('#prepare-traffic .setup-actions button[type="button"]').click();
  h.context.setStartingTrafficRequired(false);
  h.context.changeStage('desk');
  await h.context.showTrafficSetup();
  assert.equal(h.document.getElementById('traffic-return-exercise').hidden, false);
  const speed = h.document.querySelector('#prepare-traffic [data-field="speedKt"]');
  speed.value = '600'; speed.dispatchEvent(new h.Event('input', {bubbles:true}));
  h.document.getElementById('traffic-return-exercise').click(); await next();
  assert.equal(h.document.getElementById('desk').hidden, false);
  assert.equal(h.document.getElementById('setup').hidden, true);
  assert.equal(h.document.getElementById('clock').textContent, '00:02:00');
  assert.equal(h.document.getElementById('clock-state').textContent, 'PAUSED');
  assert.equal(h.context.commands.length, 0);
  await h.context.showTrafficSetup();
  assert.equal(speed.value, '600');
  h.context.setEnded(true);
  h.document.getElementById('traffic-return-exercise').click(); await next();
  assert.equal(h.document.getElementById('tab-debrief').hidden, false);
  assert.equal(h.document.getElementById('clock-state').textContent, 'ENDED');
  assert.equal(h.context.commands.length, 0, 'returning does not reopen an ended exercise');
});

test('Review setup button downloads the original archive while progress button exports the current attempt', async () => {
  const h = consoleHarness(); h.context.prepare('instructor'); h.context.setElapsed(120); h.context.setEnded(true);
  h.document.getElementById('review-download-setup').click(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.archiveCalls, ['download']); assert.equal(h.context.downloadRequests.length, 0, 'Setup download must not export the progressed aircraft state');
  assert.equal(h.context.downloads.length, 1); assert.equal(h.context.downloads[0].name, 'Original-training-exercise-setup.json');
  assert.equal(h.context.downloads[0].data, h.archiveTemplate); assert.equal(h.context.downloads[0].data.bundle.scenario.elapsed, 0);
  assert.doesNotMatch(JSON.stringify(h.context.downloads[0].data), /active-session-token|active-csrf|Attempt record/);
  assert.equal(h.document.querySelector('.ats-confirm-dialog'), null, 'A local setup download needs no external publishing approval');
  h.document.getElementById('review-download-progress').click(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual([...h.context.downloadRequests], ['/api/procedural/export']); assert.equal(h.context.downloads.length, 2);
  assert.equal(h.context.downloads[1].name, 'ats-simbox-exercise-progress.json'); assert.equal(h.context.downloads[1].data.scenario.elapsed, 120);
  assert.equal(h.context.downloads[1].data.scenario.events[0].text, 'Attempt record'); assert.deepEqual(h.archiveCalls, ['download']);
});

test('Procedural boots with the real shared workspace helper and keeps capture-loss after a completed click distinct from cancellation', () => {
  const h = consoleHarness(); h.context.prepare('instructor');
  assert.equal(h.document.getElementById('desk').classList.contains('ats-workspace-shell'), true);
  assert.equal(h.canvas.classList.contains('ats-scope-surface'), true);
  h.emit('pointerdown', {time:10}); h.emit('pointerup', {time:30});
  h.emit('lostpointercapture', {time:31});
  assert.equal(h.jobs.size, 1, 'ordinary capture release retains the pending single-click transmission');
  h.flush(); assert.equal(h.context.commands.length, 1); assert.equal(h.context.commands[0][0], 'transmit');
});

test('drag, pointer cancellation and leaving the desk cancel pending aircraft gestures without any turn or transmission', () => {
  for (const interruption of ['drag', 'cancel', 'leave']) {
    const h = consoleHarness(); h.context.prepare('instructor');
    h.emit('pointerdown', {time:10}); h.emit('pointerup', {time:30});
    h.emit('pointerdown', {time:100});
    if (interruption === 'drag') { h.emit('pointermove', {time:120,x:330}); h.emit('pointerup', {time:130,x:330}); }
    if (interruption === 'cancel') { h.emit('pointercancel', {time:120}); h.emit('pointerup', {time:130}); }
    if (interruption === 'leave') { h.context.changeStage('waiting'); h.emit('pointerup', {time:130}); }
    h.flush(); assert.equal(h.context.commands.length, 0, interruption);
  }
});

test('middle click stops one aircraft only after release, and student pointer gestures cannot mutate traffic', () => {
  const h = consoleHarness(); h.context.prepare('instructor');
  const middle = h.emit('pointerdown', {button:1,time:10}); assert.equal(middle.defaultPrevented, true);
  h.emit('pointercancel', {button:1,time:15}); h.emit('pointerup', {button:1,time:20});
  assert.equal(h.context.commands.length, 0, 'cancelled middle press cannot stop an aircraft');
  h.emit('pointerdown', {button:1,time:100}); h.emit('pointerup', {button:1,time:120});
  assert.equal(h.context.commands.length, 1); assert.equal(h.context.commands[0][1].action, 'stop-turn');
  h.context.prepare('student');
  for (const button of [0,1,2]) { h.emit('pointerdown', {button,time:200}); h.emit('pointerup', {button,time:230}); }
  h.flush(); assert.equal(h.context.commands.length, 1, 'student pointer actions never reach the instructor command API');
});

test('boundary sketch mode takes scope focus, owns pointer actions and blocks aircraft/clock shortcuts and middle Stop',()=>{
  const h=consoleHarness();h.context.prepare('instructor');
  h.emit('pointerdown',{time:10});h.emit('pointerup',{time:30});assert.equal(h.jobs.size,1);
  const focus=[];h.canvas.focus=options=>{focus.push(options);h.document.activeElement=h.canvas;};
  h.document.getElementById('aircraft-hover').hidden=false;h.startSketch();
  assert.equal(h.jobs.size,0);assert.equal(focus.at(-1).preventScroll,true);assert.equal(h.document.activeElement===h.canvas,true);
  assert.equal(h.document.getElementById('aircraft-hover').hidden,true);assert.equal(h.canvas.style.cursor,'crosshair');
  h.emit('pointermove',{time:100});h.emit('pointerdown',{time:110});h.emit('pointermove',{time:120,x:310});h.emit('pointerup',{time:130,x:310});
  assert.deepEqual(h.sketchEvents,['move','down','move','up']);assert.equal(h.canvas.style.cursor,'crosshair');
  for(const value of ['a','d','x','t','h','p','g',' ']){
    const event=new h.Event('keydown',{bubbles:true,cancelable:true});event.key=value;event.code=value===' '?'Space':`Key${value.toUpperCase()}`;h.canvas.dispatchEvent(event);
  }
  h.emit('pointerdown',{button:1,time:200});h.emit('pointerup',{button:1,time:220});h.flush();
  assert.equal(h.context.commands.length,0,'sketch interactions cannot send aircraft instructions or change exercise time');
  assert.equal(h.document.getElementById('aircraft-hover').hidden,true);
  h.context.cancelScope();h.emit('pointerdown',{button:1,time:300});h.emit('pointerup',{button:1,time:330});
  assert.equal(h.context.commands.length,1,'normal Stop remains available after leaving sketch mode');assert.equal(h.context.commands[0][1].action,'stop-turn');
});

test('middle background click stops selected traffic; a different hit selects and stops once without D/F', () => {
  const h = consoleHarness(); h.context.prepare('instructor');
  h.emit('pointerdown', {time:10}); h.emit('pointerup', {time:30});
  for (const type of ['pointerdown','mousedown','pointerup','auxclick']) {
    const event = h.emit(type, {button:1,time:100,x:20,y:20}); assert.equal(event.defaultPrevented,true,type);
  }
  h.flush();
  assert.equal(h.context.commands.length,1); assert.equal(h.context.commands[0][0],'clearance');
  assert.equal(h.context.commands[0][1].action,'stop-turn'); assert.equal(h.context.commands[0][2],'a1');
  h.context.addSecondAircraft(); const point = h.context.aircraftPoint('a2');
  h.emit('pointerdown', {button:1,time:200,...point}); h.emit('pointerup', {button:1,time:230,...point}); h.emit('auxclick', {button:1,time:240,...point});
  assert.equal(h.context.commands.length,2); assert.equal(h.context.commands[1][2],'a2');
  assert.equal(h.context.commands[1][1].action,'stop-turn'); h.flush(); assert.equal(h.context.commands.length,2);
});

test('boundary preview canvas owns keyboard editing without sending aircraft or clock commands',()=>{
  const h=consoleHarness();h.context.prepare('instructor');
  const editor=h.document.createElement('section');editor.id='boundary-sketch';
  const preview=h.document.createElement('canvas');preview.id='boundary-sketch-canvas';editor.append(preview);
  h.document.getElementById('tab-build').append(editor);
  const editing=[];h.document.addEventListener('keydown',e=>{if(['Enter','Delete','Escape'].includes(e.key)&&e.target.closest('#boundary-sketch'))editing.push(e.key);});
  function key(target,value){const e=new h.Event('keydown',{bubbles:true,cancelable:true});e.key=value;e.code=value===' '?'Space':`Key${value.toUpperCase()}`;target.dispatchEvent(e);return e;}
  for(const value of ['t','a','d','x','h','p','g',' '])key(preview,value);
  assert.equal(h.context.commands.length,0,'preview editing must not leak to normal instructor shortcuts when main-scope sketch mode is inactive');
  for(const value of ['Enter','Delete','Escape'])assert.equal(key(preview,value).defaultPrevented,false);
  assert.deepEqual(editing,['Enter','Delete','Escape'],'editor editing keys still reach its document listener');
  key(h.canvas,'t');assert.equal(h.context.commands.length,1,'normal scope transmission remains available outside the preview');
  assert.equal(h.context.commands[0][0],'transmit');
});

test('middle background Stop permits a paused instructor but rejects missing selection, ended and student desks', () => {
  const h = consoleHarness(); h.context.prepare('instructor');
  h.emit('pointerdown', {button:1,x:20,y:20}); h.emit('pointerup', {button:1,x:20,y:20});
  assert.equal(h.context.commands.length,1,'A paused instructor may stop traffic');
  h.context.clearSelection(); h.emit('pointerdown', {button:1,x:20,y:20}); h.emit('pointerup', {button:1,x:20,y:20});
  assert.equal(h.context.commands.length,1);
  h.context.prepare('instructor'); h.context.setEnded(true);
  h.emit('pointerdown', {button:1,x:20,y:20}); h.emit('pointerup', {button:1,x:20,y:20}); assert.equal(h.context.commands.length,1);
  h.context.prepare('student'); h.emit('pointerdown', {button:1,x:20,y:20}); h.emit('pointerup', {button:1,x:20,y:20}); assert.equal(h.context.commands.length,1);
});

test('running Procedural middle Stop stays on the scope and ignores tool rail, drawer and aircraft controls',()=>{
  const h=consoleHarness();h.context.prepare('instructor',true);
  for(const id of ['edge-actions','work-panel','aircraft-quick-controls']){
    const target=h.document.getElementById(id);
    for(const type of ['pointerdown','mousedown','pointerup','auxclick']){
      const event=new h.Event(type,{bubbles:true,cancelable:true});
      Object.assign(event,{isPrimary:true,pointerId:1,pointerType:'mouse',button:1,clientX:20,clientY:20});
      target.dispatchEvent(event);assert.equal(event.defaultPrevented,false,`${id} ${type} is not a scope gesture`);
    }
  }
  assert.equal(h.context.commands.length,0,'middle clicks on panels cannot stop an aircraft');
  for(const type of ['pointerdown','mousedown','pointerup','auxclick'])assert.equal(h.emit(type,{button:1,x:20,y:20}).defaultPrevented,true,`${type} blocks browser autoscroll`);
  assert.equal(h.context.commands.length,1,'one completed middle click stops the running selected aircraft once');
  assert.equal(h.context.commands[0][0],'clearance');assert.equal(h.context.commands[0][1].action,'stop-turn');assert.equal(h.context.commands[0][2],'a1');
});

test('traffic setup submits exactly twenty initial aircraft and refuses twenty-one before calling its host', async () => {
  const h = domHarness('<html><body><section id="setup"></section></body></html>'), submitted = [];
  Object.assign(h.context, {host:{container:h.document.getElementById('setup'),view:()=>({title:'Capacity exercise',mode:'area',environment:{}}),
    submit:async payload => submitted.push(payload),cancel(){},airspace(){}}});
  vm.runInContext(source('traffic-setup.js').replace(/export /g, '') + ';globalThis.setup=createTrafficSetup(host);setup.open();', h.context);
  const count = h.document.querySelector('[name="aircraftCount"]'), form = h.document.querySelector('form');
  count.value = '20'; count.dispatchEvent(new h.Event('input'));
  form.dispatchEvent(new h.Event('submit', {cancelable:true})); await new Promise(resolve => setImmediate(resolve));
  assert.equal(submitted.length, 1); assert.equal(submitted[0].aircraft.length, 20);
  assert.equal(new Set(submitted[0].aircraft.map(a => a.callsign)).size, 20);
  h.context.setup.open(); count.value = '21'; count.dispatchEvent(new h.Event('input'));
  form.dispatchEvent(new h.Event('submit', {cancelable:true})); await new Promise(resolve => setImmediate(resolve));
  assert.equal(submitted.length, 1); assert.match(h.document.querySelector('.setup-error').textContent, /1 to 20/);
});
