/* ATS SIM BOX — Copyright (c) 2026 Balaram Reddy. CPAL-1.0; see LICENSE. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {harness} from './testing/worker-harness.mjs';

const require=createRequire(import.meta.url);
const published=require('./static/published-airspace.js');
const read=name=>JSON.parse(readFileSync(new URL(`./static/${name}`,import.meta.url),'utf8'));
const data={catalogue:read('india-airbase-lfa-catalogue.json'),airspace:read('india-airspace.json'),enroute:read('india-aip-enroute.json')};

test('every selectable published LFA survives the real engine, student view and offline recovery',async()=>{
  const h=await harness(),instructor=h.port(),student=h.port();
  const session=(await instructor.request('session',{role:'instructor'})).body;
  const room=(await instructor.request('room',undefined,session)).body;
  const trainee=(await student.request('session',{role:'student',name:'Controller',pin:room.pin})).body;
  const member=(await instructor.request('room',undefined,session)).body.students[0];
  await instructor.request('room',{action:'admit',studentId:member.id},session);
  await student.request('room',{action:'ready'},trainee);
  const state=async()=>(await instructor.request('state',undefined,session)).body;
  const initial=await state();let count=0,lastChart;
  const command=(type,payload)=>instructor.request('command',{id:`published-engine-${++count}`,exerciseId:initial.exerciseId,type,payload},session);
  assert.equal((await command('clock',{action:'step',seconds:60})).status,200);
  const before=await state();
  const entries=published.bases(data).flatMap(base=>(base.lfaEntries||[]).filter(entry=>entry.geometryRef).map(entry=>({base,entry})));
  assert.ok(entries.length>=17,'the verified selectable catalogue must be exercised');
  for(const {base,entry} of entries){
    const chart=published.publicChart(published.buildSelection(data,base.id,entry.id));
    const current=await state();
    const result=await command('airspace-replace',{expectedRevision:current.revision,environment:{chartOrigin:chart.origin,publishedAirspace:chart,referenceBoundaries:chart.referenceBoundaries},fixes:current.fixes,routes:current.routes,areas:current.areas});
    assert.equal(result.status,200,`${base.id}/${entry.id}: ${JSON.stringify(result.body)}`);
    const after=await state(),visible=(await student.request('state',undefined,trainee)).body;
    assert.deepEqual(structuredClone(after.environment.publishedAirspace),chart,`${base.id}/${entry.id}: engine round trip`);
    assert.deepEqual(structuredClone(visible.environment.publishedAirspace),chart,`${base.id}/${entry.id}: student chart`);
    assert.equal(visible.aircraft,undefined,'reference chart cannot expose instructor aircraft truth');
    assert.deepEqual(after.aircraft,before.aircraft);assert.equal(after.elapsed,before.elapsed);
    assert.deepEqual(after.routes,before.routes);assert.deepEqual(after.fixes,before.fixes);
    assert.equal(after.environment.runwayHeadingDeg,before.environment.runwayHeadingDeg);
    lastChart=chart;
  }
  const reopened=await harness(h.saved),fresh=reopened.port();
  const restoredSession=(await fresh.request('session',{role:'instructor'})).body;
  const restored=(await fresh.request('state',undefined,restoredSession)).body;
  assert.deepEqual(structuredClone(restored.environment.publishedAirspace),lastChart);
  assert.deepEqual(structuredClone(restored.aircraft),structuredClone(before.aircraft));assert.equal(restored.elapsed,before.elapsed);
  const invalid=structuredClone(lastChart);invalid.fixes.push({id:'invalid',name:'MISSING AXIS',xNm:0});
  const snapshot=structuredClone(h.saved.get('checkpoint'));
  assert.equal((await command('environment',{publishedAirspace:invalid})).status,400);
  assert.deepEqual(h.saved.get('checkpoint'),snapshot,'invalid browser chart must not partially write');
});
