import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {webcrypto} from 'node:crypto';
import {harness} from './testing/worker-harness.mjs';

test('browser worker: admission, privacy, authoritative commands, durability and recovery',async()=>{
  const h = await harness(), instructor = h.port(), student = h.port(), intruder = h.port();
  const opened = await instructor.request('session',{role:'instructor'});
  assert.equal(opened.status,200); const i = opened.body;
  const room = (await instructor.request('room',undefined,i)).body;
  assert.match(room.pin,/^\d{6}$/);
  assert.equal((await intruder.request('session',{role:'student',name:'Test',pin:'invalid'})).status,403);
  const s = (await student.request('session',{role:'student',name:'Test controller',pin:room.pin})).body;
  assert.equal((await student.request('state',undefined,s)).status,403);
  assert.equal((await intruder.request('state',undefined,i)).status,401,'token cannot be used from another port');
  const waiting = (await instructor.request('room',undefined,i)).body.students[0];
  await instructor.request('room',{action:'admit',studentId:waiting.id},i);
  const first = (await instructor.request('state',undefined,i)).body;
  const cmd = (type,payload,id=webcrypto.randomUUID())=>({id,exerciseId:first.exerciseId,type,payload});
  assert.equal((await instructor.request('command',cmd('clock',{action:'resume'}),i)).status,400,'Ready gates Run');
  await student.request('room',{action:'ready'},s);
  const sv = (await student.request('state',undefined,s)).body;
  assert.equal(sv.aircraft,undefined); assert.equal(sv.events,undefined); assert.equal(sv.alerts,undefined);
  assert.equal((await student.request('cloud-view',undefined,s)).status,403);
  assert.equal((await instructor.request('cloud-view',undefined,i)).body.aircraft,undefined);
  assert.equal((await instructor.request('cloud-command',cmd('clearance',{action:'right'}),i)).status,400,'cloud commands always run with student authority');
  assert.equal((await student.request('command',cmd('clock',{action:'resume'}),s)).status,400);
  const step = cmd('clock',{action:'step',seconds:60});
  assert.equal((await instructor.request('command',step,i)).status,200);
  const stepped = (await instructor.request('state',undefined,i)).body;
  assert.equal(stepped.elapsed,first.elapsed+60);
  assert.equal((await instructor.request('command',step,i)).status,200);
  assert.equal((await instructor.request('state',undefined,i)).body.elapsed,stepped.elapsed,'retry does not double advance');
  assert.equal(h.saved.get('checkpoint').receipts[step.id].receipt.accepted,true,'receipt persisted with state');
  const hide = cmd('scope-display',{routesHidden:true});
  assert.equal((await instructor.request('command',hide,i)).status,200);
  assert.equal((await student.request('state',undefined,s)).body.scopeDisplay.routesHidden,true);
  assert.equal((await student.request('command',cmd('scope-display',{routesHidden:false}),s)).status,400);
  const exported = (await instructor.request('export',undefined,i)).body;
  assert.equal(exported.version,1); assert.equal(exported.scenario.running,false); assert.equal(exported.scenario.elapsed,stepped.elapsed);
  assert.equal((await student.request('export',undefined,s)).status,403);
  assert.equal((await instructor.request('command',cmd('clock',{action:'terminate'}),i)).status,200);
  for(const ended of [(await student.request('state',undefined,s)).body,(await instructor.request('cloud-view',undefined,i)).body]) {
    assert.equal(ended.terminated,true); assert.equal(ended.running,false);
  }
  assert.equal((await student.request('command',cmd('clock',{action:'reopen'}),s)).status,400);
  assert.equal((await instructor.request('command',cmd('clock',{action:'reopen'}),i)).status,200);
  assert.equal((await student.request('state',undefined,s)).body.terminated,false);

  assert.equal((await instructor.request('command',cmd('clock',{action:'resume'}),i)).status,200);
  assert.equal((await instructor.request('state',undefined,i)).body.running,true);
  instructor.raw.onmessage({data:{kind:'detach'}});
  assert.equal((await student.request('state',undefined,s)).body.running,false,'instructor departure pauses traffic');
  const reopened = await harness(h.saved), fresh = reopened.port();
  const ri = (await fresh.request('session',{role:'instructor'})).body;
  const restored = (await fresh.request('state',undefined,ri)).body;
  assert.equal(restored.running,false); assert.equal(restored.scopeDisplay.routesHidden,true);
  assert.equal((await fresh.request('command',step,ri)).status,200,'dedup survives worker restart');
  assert.equal((await fresh.request('state',undefined,ri)).body.elapsed,restored.elapsed);
  reopened.failNextWrite();
  const failure = await fresh.request('command',cmd('clock',{action:'step',seconds:60}),ri);
  assert.equal(failure.status,507,'failed persistence cannot return accepted');
  assert.equal(reopened.saved.get('checkpoint').state.elapsed,restored.elapsed,'durable state unchanged after failed write');
});

test('concurrent instructor rooms keep traffic, PINs, commands and storage separate', async () => {
  const saved = new Map(), directory = new IDBFactory();
  const rooms = await Promise.all(Array.from({length: 6}, async (_, index) => {
    const roomId = webcrypto.randomUUID(), h = await harness(saved, {roomId, directory}), instructor = h.port();
    const session = (await instructor.request('session', {role: 'instructor'})).body;
    let state = (await instructor.request('state', undefined, session)).body;
    const command = async (type, payload, aircraftId) => {
      const result = await instructor.request('command', {id: webcrypto.randomUUID(), exerciseId: state.exerciseId, type, payload, aircraftId}, session);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      state = (await instructor.request('state', undefined, session)).body;
      return state;
    };
    await command('scenario-setup', {title: `Room ${index}`, mode: 'area', aircraft: Array.from({length: 20}, (_, i) => ({id: `ac${i + 1}`, callsign: String(1000 + index * 100 + i), qteDeg: i * 15, rangeNm: 25 + i, headingDeg: 180, speedKt: 240, altitudeFt: 10000 + i * 500}))});
    const room = (await instructor.request('room', undefined, session)).body;
    return {h, instructor, session, roomId, room, command, state};
  }));
  assert.equal(new Set(rooms.map(r => r.room.pin)).size, 6, 'unique simultaneous PINs');
  assert.equal(new Set(rooms.map(r => r.state.exerciseId)).size, 6, 'unique exercise generations');
  await Promise.all(rooms.map((r, i) => r.command('clock', {action: 'step', seconds: (i + 1) * 60})));
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i], state = (await r.instructor.request('state', undefined, r.session)).body;
    assert.equal(state.elapsed, (i + 1) * 60);
    assert.equal(state.aircraft.length, 20); assert.equal(state.title, `Room ${i}`);
    assert.equal(saved.get(`room:${r.roomId}:checkpoint`).state.exerciseId, state.exerciseId);
    const stranger = r.h.port();
    assert.equal((await stranger.request('state', undefined, rooms[(i + 1) % 6].session)).status, 401);
    assert.equal((await stranger.request('session', {role:'student',name:'Wrong room',pin:rooms[(i + 1) % 6].room.pin})).status,403);
  }
  const a = rooms[0], b = rooms[1], learner = a.h.port();
  const student = (await learner.request('session', {role:'student',name:'Controller A',pin:a.room.pin})).body;
  const waiting = (await a.instructor.request('room',undefined,a.session)).body.students[0];
  await a.instructor.request('room',{action:'admit',studentId:waiting.id},a.session);
  await learner.request('room',{action:'ready'},student);
  await a.command('scope-display',{routesHidden:true});
  const studentView = (await learner.request('state',undefined,student)).body;
  assert.equal(studentView.aircraft,undefined); assert.equal(studentView.scopeDisplay.routesHidden,true);
  assert.notEqual((await b.instructor.request('state',undefined,b.session)).body.scopeDisplay.routesHidden,true);
});

test('quick continuous turns use existing clearances and cannot be flown by a student', async () => {
  const h=await harness(), instructor=h.port(), learner=h.port();
  const session=(await instructor.request('session',{role:'instructor'})).body;
  const room=(await instructor.request('room',undefined,session)).body;
  const student=(await learner.request('session',{role:'student',name:'Controller',pin:room.pin})).body;
  const waiting=(await instructor.request('room',undefined,session)).body.students[0];
  await instructor.request('room',{action:'admit',studentId:waiting.id},session);
  let state=(await instructor.request('state',undefined,session)).body;
  const id=state.aircraft[0].id, start=state.aircraft[0].headingDeg;
  const cmd=(action)=>({id:webcrypto.randomUUID(),exerciseId:state.exerciseId,type:'clearance',aircraftId:id,payload:{action}});
  assert.equal((await learner.request('command',cmd('right'),student)).status,400);
  assert.equal((await instructor.request('command',cmd('right'),session)).status,200);
  await instructor.request('command',{id:webcrypto.randomUUID(),exerciseId:state.exerciseId,type:'clock',payload:{action:'step',seconds:5}},session);
  state=(await instructor.request('state',undefined,session)).body;
  assert.notEqual(state.aircraft[0].headingDeg,start);
  assert.equal((await instructor.request('command',cmd('stop-turn'),session)).status,200);
  state=(await instructor.request('state',undefined,session)).body;
  const stopped=state.aircraft[0].headingDeg;
  await instructor.request('command',{id:webcrypto.randomUUID(),exerciseId:state.exerciseId,type:'clock',payload:{action:'step',seconds:5}},session);
  assert.equal((await instructor.request('state',undefined,session)).body.aircraft[0].headingDeg,stopped);
});


test('cached query-free worker scripts retain named room identity and student admission',async()=>{
  const saved=new Map(),directory=new IDBFactory();
  const roomId=webcrypto.randomUUID(),otherId=webcrypto.randomUUID();
  const host=await harness(saved,{roomId,directory,omitRoomQuery:true});
  const other=await harness(saved,{roomId:otherId,directory,omitRoomQuery:true});
  const instructor=host.port(),student=host.port(),stranger=other.port();
  const auth=(await instructor.request('session',{role:'instructor'})).body;
  const otherAuth=(await stranger.request('session',{role:'instructor'})).body;
  assert.equal(auth.roomId,roomId); assert.equal(otherAuth.roomId,otherId);
  const room=(await instructor.request('room',undefined,auth)).body;
  const learner=(await student.request('session',{role:'student',name:'Cached client',pin:room.pin})).body;
  assert.equal(learner.roomId,roomId);
  const waiting=(await instructor.request('room',undefined,auth)).body.students[0];
  await instructor.request('room',{action:'admit',studentId:waiting.id},auth);
  await student.request('room',{action:'ready'},learner);
  assert.equal((await student.request('state',undefined,learner)).status,200);
  assert.ok(saved.has(`room:${roomId}:checkpoint`)); assert.ok(saved.has(`room:${otherId}:checkpoint`));
  assert.equal(saved.has('checkpoint'),false,'named rooms never overwrite legacy saved traffic');
  await assert.rejects(harness(new Map(),{roomId,workerName:`qgh-procedural-${otherId}`}),/Conflicting room identifier/);
});
