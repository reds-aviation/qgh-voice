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
});
