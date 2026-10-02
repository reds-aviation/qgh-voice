import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { domHarness } from './testing/dom-harness.mjs';
const source=readFileSync(new URL('./static/traffic-review.js',import.meta.url),'utf8');
const module=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

test('traffic replay interpolates position and altitude without introducing future aircraft',()=>{
  const a={id:'a',callsign:'101',x:0,y:10,z:10000},b={...a,x:10,y:0,z:12000};
  const frames=[{t:0,aircraft:[a],alerts:[]},{t:10,aircraft:[b,{id:'new'}],alerts:[{text:'Later cue'}]}];
  const middle=module.interpolateTraffic(frames,5);
  assert.equal(middle.aircraft.length,1);assert.deepEqual(middle.aircraft[0],{...a,x:5,y:5,z:11000});
  assert.deepEqual(middle.alerts,[]);assert.equal(module.interpolateTraffic([],3),null);
  assert.equal(module.interpolateTraffic(frames,20),frames[1]);
});

test('traffic replay records short separation cues and resets on replacement or clock rewind',()=>{
  const h=domHarness('<html><body><section id="review"></section></body></html>');
  vm.runInContext(source.replace(/^export /gm,'')+'\nglobalThis.makeReview=createTrafficReview;',h.context);
  const review=h.context.makeReview(h.document.getElementById('review'));
  const view={exerciseId:'one',elapsed:0,aircraft:[{id:'a',callsign:'101',status:'airborne',xNm:0,yNm:0,altitudeFt:10000}],alerts:[]};
  review.record(view);review.record({...view,elapsed:1,alerts:[{text:'Loss of configured spacing',aircraftIds:['a'],kind:'proximity'}]});
  review.record({...view,elapsed:2});
  const read=()=>JSON.parse(h.context.sessionStorage.getItem('ats-procedural-replay'));
  assert.equal(read().frames.length,3);assert.deepEqual(read().frames[1].alerts[0].ids,['a']);
  review.record({...view,elapsed:1});assert.equal(read().frames.length,1,'rewind starts a coherent replay');
  review.record({...view,exerciseId:'two',elapsed:0});assert.equal(read().exercise,'two');assert.equal(read().frames.length,1);
  review.open({...view,exerciseId:'two'});review.close();
  review.record({...view,exerciseId:'two',aircraft:[{...view.aircraft[0],callsign:'202',xNm:20}]});
  assert.equal(read().frames[0].aircraft[0].callsign,'202','paused preparation replaces the starting snapshot');
  review.open({...view,exerciseId:'two'});review.record({...view,exerciseId:'two',elapsed:8});
  assert.equal(h.document.querySelector('input[type=range]').max,'8','live review can seek newly recorded frames');
  const scrub=h.document.querySelector('input[type=range]');scrub.value='8';scrub.oninput();
  review.record({...view,exerciseId:'two',elapsed:1});assert.equal(scrub.value,'1','rewind clamps both displayed and internal replay time');
});

test('replay keeps configured measurements and command markers on the same top/side timeline',()=>{
  const h=domHarness('<html><body><section id="review"></section></body></html>');
  vm.runInContext(source.replace(/^export /gm,'')+'\nglobalThis.makeReview=createTrafficReview;',h.context);
  const review=h.context.makeReview(h.document.getElementById('review'));
  const view={exerciseId:'evidence',elapsed:0,aircraft:[{id:'a',callsign:'101',status:'airborne',xNm:0,yNm:10,altitudeFt:10000}],alerts:[],events:[{id:'start',elapsed:0,kind:'setup',text:'Traffic set'}]};
  review.record(view);
  const cue={text:'Configured vertical cue',aircraftIds:['a'],kind:'vertical',measured:600,threshold:1000,unit:'ft',criterionId:'c'};
  const next={...view,elapsed:8,alerts:[cue],criteria:[{id:'c',reference:'Instructor scenario',applicability:'Specified pair',evidence:'Observed reports'}],events:[...view.events,{id:'turn',elapsed:4,kind:'clearance',text:'101 turn right',aircraftId:'a'}]};
  review.record(next);review.open(next);
  const scrub=h.document.querySelector('input[type=range]');scrub.value='8';scrub.oninput();
  assert.match(h.document.querySelector('.review-cues').textContent,/Measured 600 ft · configured threshold 1000 ft/);
  assert.match(h.document.querySelector('.review-cues').textContent,/Instructor scenario/);
  const views=h.document.querySelector('[aria-label="Traffic replay view"]');views.value='side';views.onchange();
  assert.equal(scrub.value,'8','changing view preserves replay time');
  const selection=h.document.querySelector('[aria-label="Replay aircraft"]');selection.value='a';selection.onchange();
  assert.equal(scrub.value,'8','selection preserves replay time');
  const turn=[...h.document.querySelectorAll('.traffic-review-events button')].find(b=>b.textContent.includes('turn right'));turn.onclick();
  assert.equal(scrub.value,'4','command marker seeks its recorded time');
  const saved=JSON.parse(h.context.sessionStorage.getItem('ats-procedural-replay'));
  assert.equal(saved.events.length,2,'repeated snapshots deduplicate events');assert.equal(saved.frames.at(-1).alerts[0].measured,600);
  const without=module.recordedReviewEvents(saved.events,[{id:'turn',elapsed:4,kind:'clearance',text:'101 turn right'}],5);
  assert.equal(without.length,0,'events outside retained frame interval are omitted');
});

test('stable measured cues record at scan spacing, while threshold transitions are captured immediately',()=>{
  assert.equal(module.reviewCueSeverity({kind:'criterion-measurement'}),'measurement');
  assert.equal(module.reviewCueSeverity({kind:'instructor-assessment'}),'assessment');
  assert.equal(module.reviewCueSeverity({kind:'criterion-below-threshold'}),'warning');
  const h=domHarness('<html><body><section id="review"></section></body></html>');
  vm.runInContext(source.replace(/^export /gm,'')+'\nglobalThis.makeReview=createTrafficReview;',h.context);
  const review=h.context.makeReview(h.document.getElementById('review'));
  const view={exerciseId:'spacing',running:true,aircraft:[{id:'a',callsign:'101',status:'airborne',xNm:0,yNm:10,altitudeFt:10000}],events:[]};
  for(let t=0;t<=4;t+=.5)review.record({...view,elapsed:t,alerts:[{id:'criterion-c',text:`Measured ${1100-t}`,aircraftIds:['a'],kind:'criterion-measurement',measured:1100-t,threshold:1000,unit:'ft'}]});
  let saved=JSON.parse(h.context.sessionStorage.getItem('ats-procedural-replay'));assert.equal(saved.frames.length,2,'measurement polling must not consume the replay budget');
  review.record({...view,elapsed:4.5,alerts:[{id:'criterion-c',text:'Below configured threshold',aircraftIds:['a'],kind:'criterion-below-threshold',measured:999,threshold:1000,unit:'ft'}]});
  saved=JSON.parse(h.context.sessionStorage.getItem('ats-procedural-replay'));assert.equal(saved.frames.length,3,'brief threshold transition is preserved between scan samples');
  review.open({...view,elapsed:4.5,alerts:[]});
  const scrub=h.document.querySelector('input[type=range]');scrub.value='4';scrub.oninput();
  assert.equal(h.document.querySelector('.review-cues').classList.contains('has-cue'),false,'satisfied measurements are never painted as a warning');
});
