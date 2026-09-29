import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import Session from '../atc-suite/suite-session.js';
import Cloud from '../atc-suite/suite-cloud.js';

test('QGH online relay: independent rooms, admission, ready, observation, retry, recovery and termination', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    await db.exec(await readFile(new URL('./supabase/001_sessions.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../atc-suite/002_online_sessions.sql',import.meta.url),'utf8'));
    const [host,student,other] = [randomUUID(),randomUUID(),randomUUID()];
    for(const id of [host,student,other]) await db.query('insert into auth.users values($1)',[id]);
    async function call(user,action,id=null,payload={}) {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
      await db.exec('set role authenticated');
      try { return (await db.query('select public.atc_suite_session($1,$2,$3) as result',[action,id,payload])).rows[0].result; }
      finally { await db.exec('reset role'); }
    }
    let fault=false;
    const service = user => ({async call(action,id,payload) { if(fault) throw Error('network unavailable'); const r=await call(user,action,id,payload); if(r.error) throw Error(r.error); return r; }});
    const hostKey=randomUUID(), room={...await call(host,'create',null,{hostKey}),hostKey};
    const second=await call(other,'create',null,{hostKey:randomUUID()});
    assert.notEqual(room.pin,second.pin);
    assert.equal((await call(student,'exchange',room.id,{messages:[]})).status,403);
    await call(student,'join',null,{pin:room.pin});
    const h=Cloud.createTransport({service:service(host),room,host:true,sessionApi:Session});
    const s=Cloud.createTransport({service:service(student),room,host:false,sessionApi:Session});
    const hostSession=Session.createInstructorSession({transport:h,pin:room.pin,sessionId:room.sessionId,senderId:host,channelName:room.channelName,publicMetadata:{mode:'qgh'}});
    const memory=new Map(), recovery={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
    let studentSession=Session.createStudentSession({transport:s,pin:room.pin,clientId:student,discovery:{...room,expiresAt:Date.now()+3600000},recoveryStorage:recovery});
    studentSession.requestJoin(); await s.sync(); await h.sync();
    assert.deepEqual(hostSession.snapshot().waitingClientIds,[student]);
    assert.equal(studentSession.snapshot().publicMetadata,null);
    assert.equal((await call(student,'exchange',second.id,{messages:[]})).status,403);
    hostSession.admit(student); await h.sync(); await s.sync();
    assert.equal(studentSession.snapshot().state,'admitted');
    studentSession.ready(); await s.sync(); await h.sync(); await h.sync(); await s.sync();
    assert.equal(hostSession.snapshot().state,'ready');
    assert.equal(hostSession.start(0),true); await h.sync(); await s.sync();
    assert.equal(studentSession.snapshot().state,'running');
    for(let i=0;i<40;i++) hostSession.publishObservation({mode:'qgh',status:'live',transmissionState:'pilot',bearingType:'qdm',bearingDeg:i},i);
    await h.sync(); await s.sync();
    assert.equal(studentSession.snapshot().observation.bearingDeg,39,'queued sensor frames coalesce to newest');
    hostSession.publishCaption('101, turning right',40);
    fault=true; await assert.rejects(h.sync(),/network/); assert.equal(h.connected,false);
    fault=false; await h.sync(); await s.sync(); assert.equal(studentSession.snapshot().caption,'101, turning right');
    assert.equal(h.connected,true);
    hostSession.pause(40); await h.sync(); await s.sync();
    assert.equal(studentSession.snapshot().state,'paused');
    // Simulate a refreshed student using the same authenticated identity and saved seat.
    const recoveredTransport=Cloud.createTransport({service:service(student),room,host:false,sessionApi:Session});
    studentSession=Session.createStudentSession({transport:recoveredTransport,pin:room.pin,clientId:student,discovery:{...room,expiresAt:Date.now()+3600000},recoveryStorage:recovery});
    studentSession.requestJoin(); await recoveredTransport.sync(); await h.sync(); await h.sync(); await recoveredTransport.sync();
    assert.equal(studentSession.snapshot().state,'paused');
    assert.equal(studentSession.snapshot().observation.bearingDeg,39);
    const forged={protocol:1,type:'lifecycle',sessionId:room.id,senderRole:'instructor',senderId:student,revision:999,simulationTime:40,sentAt:Date.now(),payload:{state:'running'}};
    assert.equal((await call(student,'exchange',room.id,{messages:[forged]})).status,403);
    assert.equal((await call(host,'exchange',room.id,{hostKey,messages:[{...forged,senderId:host,payload:{aircraft:[]}}]})).status,403);
    studentSession.heartbeat(); // In flight when the instructor ends the exercise.
    hostSession.terminate('exercise-terminated',41); await h.sync(); await recoveredTransport.sync();
    assert.equal(studentSession.snapshot().state,'terminated'); assert.equal(studentSession.snapshot().observation,null);
    assert.equal((await call(student,'join',null,{pin:room.pin})).status,403,'terminated rooms release capacity and invalidate the PIN');
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from atc_private.suite_messages'),/permission denied/);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query("select public.atc_suite_session('create',null,'{}')"),/permission denied/);
    await db.exec('reset role');
  } finally { await db.close(); }
});
