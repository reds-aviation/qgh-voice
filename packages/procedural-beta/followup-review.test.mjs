import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {domHarness} from './testing/dom-harness.mjs';

const source = name => readFileSync(new URL('./static/' + name, import.meta.url), 'utf8');
const gesturesModule = await import('data:text/javascript;base64,' + Buffer.from(source('scope-interaction.js')).toString('base64'));

function consoleHarness() {
  const h = domHarness(source('procedural.html'));
  const jobs = new Map(); let nextJob = 0;
  Object.assign(h.context, {
    createAircraftGestures: options => gesturesModule.createAircraftGestures({...options,
      schedule: fn => { jobs.set(++nextJob, fn); return nextJob; }, cancel: id => jobs.delete(id)}),
    nearestAircraft: gesturesModule.nearestAircraft,
    createRadarSweep: () => ({update(){}}), recordTrail(){}, trailDots: () => [], trailSpacing: () => 1,
    createTrafficReview: () => ({record(){},open(){},close(){},clear(){}}),
    createTrafficSetup: () => ({open(){},close(){}}),
    createStudentPlotting: () => ({mount(){},setEnabled(){},draw(){},onPointerDown(){},onPointerMove(){},onPointerUp(){},onPointerCancel(){}}),
    createMapWorkshop: () => ({}), alignmentBriefing: () => '',
    createChartWorkshop: () => ({}), drawAreas(){}, routeWindowOpen: () => true,
    visibleSegment: () => true, reserveLabel: () => null, fitNavigation(){}, approachReference: () => [], resolveRouteFixIds: () => [],
  });
  vm.runInContext(source('workspace-shell.js'), h.context);
  vm.runInContext(source('procedural.js').replace(/^import .*;\r?\n/gm, '') + `
    globalThis.commands = []; command = async (...args) => commands.push(args);
    globalThis.prepare = role => {
      session = {role}; stage = 'desk';
      const a = {id:'a1',callsign:'101',type:'TRAINER',status:'airborne',mode:'heading',headingDeg:90,speedKt:240,altitudeFt:10000,targetAltitudeFt:10000,xNm:0,yNm:0};
      view = {exerciseId:'review-test',available:true,environment:{rangeNm:60,stationName:'NAV0'},roster:[a],aircraft:[a],routes:[],fixes:[],areas:[],elapsed:0};
      choose(a.id); setStage('desk');
    };
    globalThis.cancelScope = resetScopePointer;
    globalThis.changeStage = setStage;
  `, h.context);
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
  return {...h, canvas, jobs, emit, flush() {const tasks = [...jobs.values()]; jobs.clear(); for (const fn of tasks) fn();}};
}

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
