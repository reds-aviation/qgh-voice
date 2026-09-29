// Explicit manual integration check. Never runs automatically in CI or an exercise.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRemoteService } from '../static/remote-service.js';
import { createRemoteRoom } from '../static/remote-room.js';
import { remoteConfig } from '../static/remote-config.js';
import { harness } from '../testing/worker-harness.mjs';

if(process.env.ATC_SUPABASE_LIVE_TEST !== '1') throw new Error('Set ATC_SUPABASE_LIVE_TEST=1 to create disposable cloud test rooms.');
const store=new Map(), storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
const clients=Array.from({length:4},()=>createRemoteService(remoteConfig,randomUUID(),{storage}));
const hosts=[],students=[],opened=[];
try {
  for(let n=0;n<2;n++) {
    const worker=await harness(), port=worker.port(), auth=(await port.request('session',{role:'instructor'})).body;
    const hostKey=randomUUID();
    const room=await clients[n].call('create',null,{localId:randomUUID(),hostKey});
    opened.push({service:clients[n],id:room.id,hostKey});
    const driver=createRemoteRoom({service:clients[n],local:(path,body,method)=>port.request(path,body,auth,method),session:{...auth,cloud:{id:room.id,hostKey}}});
    hosts.push({driver,port,auth,room,hostKey}); await driver.sync();
    const joined=await clients[n+2].call('join',null,{pin:room.pin,name:`Release check controller ${n+1}`});
    assert.equal(joined.id,room.id);
    assert.equal((await clients[n+2].call('poll',room.id)).state,null);
    await clients[n].call('admit',room.id,{hostKey,studentId:(await clients[n+2].authenticate()).user.id});
    await clients[n+2].call('ready',room.id);
    const student=createRemoteRoom({service:clients[n+2],session:{role:'student',cloud:{id:room.id}}});
    students.push(student); await student.sync();
  }
  const views=await Promise.all(students.map(s=>s.dispatch('state')));
  assert.notEqual(hosts[0].room.pin,hosts[1].room.pin);
  assert.notEqual(views[0].body.exerciseId,views[1].body.exerciseId);
  for(const view of views) for(const hidden of ['aircraft','events','alerts']) assert.equal(view.body[hidden],undefined);
  await assert.rejects(clients[2].call('poll',hosts[1].room.id),e=>e.status===403);
  const host=hosts[0], exercise=views[0].body.exerciseId, aircraft=views[0].body.roster[0].id;
  const command={id:randomUUID(),exerciseId:exercise,type:'controller-call',aircraftId:aircraft,payload:{text:'Release check: turn right heading zero niner zero'}};
  await clients[2].call('command',host.room.id,{command});
  await host.driver.sync(); await host.driver.sync(); await students[0].sync();
  assert.equal((await students[0].dispatch('command',command)).body.accepted,true);
  const truth=(await host.port.request('state',undefined,host.auth)).body;
  assert.equal(truth.calls.filter(c=>c.text===command.payload.text).length,1);
  assert.equal((await students[0].dispatch('command',{...command,id:randomUUID(),type:'clearance',payload:{action:'right'}})).status,403);
  const hide={id:randomUUID(),exerciseId:exercise,type:'scope-display',payload:{routesHidden:true}};
  assert.equal((await host.driver.dispatch('command',hide)).status,200);
  await students[0].sync(); assert.equal((await students[0].dispatch('state')).body.scopeDisplay.routesHidden,true);
  await students[1].sync(); assert.notEqual((await students[1].dispatch('state')).body.scopeDisplay?.routesHidden,true);
  await clients[0].call('reject',host.room.id,{hostKey:host.hostKey,studentId:(await clients[2].authenticate()).user.id});
  assert.equal((await clients[2].call('poll',host.room.id)).state,null);
  console.log('PASS: live Supabase, 2 separate instructor rooms / 2 controller identities, admission, student privacy, typed call receipt, retry, role denial, shared declutter and removal.');
} finally {
  hosts.forEach(h=>h.driver.stop()); students.forEach(s=>s.stop());
  const closed=await Promise.allSettled(opened.map(r=>r.service.call('close',r.id,{hostKey:r.hostKey})));
  if(closed.some(r=>r.status==='rejected')) console.log('Some disposable rooms could not be closed; they expire after 8 hours.');
  store.clear();
}
