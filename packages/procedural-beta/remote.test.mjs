import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createRemoteService, validRemoteConfig } from './static/remote-service.js';
import { createRemoteRoom } from './static/remote-room.js';
import { harness as workerHarness } from './testing/worker-harness.mjs';

test('Supabase SQL: rooms, admission, role boundaries, receipts, expiry and private maps', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    await db.exec(await readFile(new URL('./supabase/001_sessions.sql', import.meta.url), 'utf8'));
    const [hostA, hostB, student, stranger] = Array.from({length:4}, () => randomUUID());
    for (const user of [hostA,hostB,student,stranger]) await db.query('insert into auth.users values($1)', [user]);
    async function call(user, action, room = null, payload = {}) {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
      await db.exec('set role authenticated');
      try { return (await db.query('select public.atc_session($1,$2,$3) as result',[action,room,payload])).rows[0].result; }
      finally { await db.exec('reset role'); }
    }
    const keyA=randomUUID(),keyB=randomUUID();
    const a=await call(hostA,'create',null,{localId:randomUUID(),hostKey:keyA});
    const b=await call(hostB,'create',null,{localId:randomUUID(),hostKey:keyB});
    assert.notEqual(a.id,b.id); assert.notEqual(a.pin,b.pin);
    const view={role:'student',exerciseId:'exercise-a',running:true,available:true,elapsed:10,roster:[],environment:{map:{}}};
    let sequence=0;
    const exchange=(extra={})=>call(hostA,'exchange',a.id,{hostKey:keyA,state:view,sequence:++sequence,receipts:[],...extra});
    assert.equal((await exchange()).error,undefined);
    assert.equal((await call(hostB,'room',a.id,{hostKey:keyB})).status,403);
    assert.equal((await call(student,'join',null,{pin:a.pin,name:'Controller'})).id,a.id);
    assert.equal((await call(student,'poll',a.id)).state,null,'PIN alone never reveals exercise state');
    assert.equal((await call(student,'ready',a.id)).status,403);
    assert.equal((await call(student,'admit',a.id,{studentId:student})).status,403);
    await call(hostA,'admit',a.id,{hostKey:keyA,studentId:student});
    assert.equal((await call(student,'poll',a.id)).state,null,'admitted controllers must also be Ready');
    await call(student,'ready',a.id);
    assert.equal((await call(student,'poll',a.id)).state.exerciseId,'exercise-a');
    assert.equal((await call(student,'poll',b.id)).status,403);
    assert.equal((await exchange({state:{...view,role:'instructor',aircraft:[{xNm:4}]}})).status,400);
    assert.equal((await exchange({state:{...view,events:[]}})).status,400);
    assert.equal((await call(student,'exchange',a.id,{state:view,sequence:999})).status,403);
    const command={id:randomUUID(),exerciseId:view.exerciseId,type:'controller-call',payload:{text:'Turn right'},aircraftId:'test-aircraft'};
    assert.equal((await call(student,'command',a.id,{command:{...command,type:'clearance'}})).status,403);
    assert.equal((await call(student,'command',a.id,{command})).result,null);
    assert.equal((await call(student,'command',a.id,{command})).result,null,'retry remains one pending command');
    assert.deepEqual((await exchange()).commands,[command]);
    const receipt={status:200,body:{id:command.id,accepted:true}};
    await exchange({receipts:[{id:command.id,result:receipt}]});
    assert.deepEqual((await call(student,'command',a.id,{command})).result,receipt);
    assert.equal((await call(student,'command',a.id,{command:{...command,payload:{text:'different'}}})).status,409);
    const hash='a'.repeat(64), map=Buffer.from([137,80,78,71,1,2,3]);
    assert.equal((await call(hostA,'map-put',a.id,{hostKey:keyA,imageId:hash,mime:'image/png',data:map.toString('base64')})).saved,true);
    view.environment.map.imageId=hash;
    await exchange();
    assert.equal((await call(student,'map-get',a.id,{imageId:hash})).mime,'image/png');
    assert.equal((await call(stranger,'map-get',a.id,{imageId:hash})).status,403);
    await db.query("update atc_private.rooms set seen_at=now()-interval '8 seconds' where id=$1",[a.id]);
    const stale=(await call(student,'poll',a.id)).state;
    assert.equal(stale.running,false); assert.equal(stale.available,false); assert.equal(stale.df,null);
    await exchange();
    await call(hostA,'reject',a.id,{hostKey:keyA,studentId:student});
    assert.equal((await call(student,'poll',a.id)).state,null);
    assert.equal((await call(student,'map-get',a.id,{imageId:hash})).status,403);
    const renewedKey=randomUUID();
    await call(hostA,'claim',a.id,{hostKey:renewedKey});
    assert.equal((await exchange()).status,409,'old host lease cannot publish');
    for(let n=0;n<12;n++) await call(stranger,'join',null,{pin:'bad',name:'Guest'});
    assert.equal((await call(stranger,'join',null,{pin:a.pin,name:'Guest'})).status,429,'failed PIN attempts persist');
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select snapshot from atc_private.rooms'), /permission denied/);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query("select public.atc_session('create',null,'{}')"), /permission denied/);
    await db.exec('reset role');
    // Two independent client identities through the real SQL API and actual Go/WASM engine.
    const worker = await workerHarness(), port = worker.port();
    const localAuth = (await port.request('session',{role:'instructor'})).body;
    const hostKey = randomUUID();
    const online = await call(hostB,'create',null,{localId:randomUUID(),hostKey});
    const serviceFor = user => ({async call(action,id,payload){
      const result = await call(user,action,id,payload);
      if(result.error) throw Object.assign(new Error(result.error),{status:result.status});
      return result;
    }});
    const hostDriver = createRemoteRoom({service:serviceFor(hostB),local:(path,body,method)=>port.request(path,body,localAuth,method),session:{...localAuth,cloud:{id:online.id,hostKey}}});
    await hostDriver.sync();
    await call(student,'join',null,{pin:online.pin,name:'Remote controller'});
    await call(hostB,'admit',online.id,{hostKey,studentId:student});
    await call(student,'ready',online.id);
    const controller = createRemoteRoom({service:serviceFor(student),session:{role:'student',cloud:{id:online.id}}});
    await controller.sync();
    const projected = (await controller.dispatch('state')).body;
    assert.ok(projected.roster.length>0); assert.equal(projected.aircraft,undefined);
    const typed = {id:randomUUID(),exerciseId:projected.exerciseId,type:'controller-call',aircraftId:projected.roster[0].id,payload:{text:'Turn right heading zero niner zero'}};
    await call(student,'command',online.id,{command:typed});
    await hostDriver.sync(); await hostDriver.sync(); await controller.sync();
    assert.equal((await controller.dispatch('command',typed)).body.accepted,true);
    const truth = (await port.request('state',undefined,localAuth)).body;
    assert.ok(truth.aircraft.length>0);
    assert.equal(truth.calls.filter(c=>c.text===typed.payload.text).length,1,'remote receipt retries do not duplicate controller calls');
    const clear = {...typed,id:randomUUID(),type:'clearance',payload:{action:'right'}};
    assert.equal((await controller.dispatch('command',clear)).status,403);
    const stolen = await call(student,'poll',a.id);
    assert.equal(stolen.state,null,'rejected membership cannot see another room');
    for(const [action,ended] of [['terminate',true],['reopen',false]]) {
      const change={id:randomUUID(),exerciseId:projected.exerciseId,type:'clock',payload:{action}};
      assert.equal((await hostDriver.dispatch('command',change)).status,200);
      await hostDriver.sync(); await controller.sync();
      const studentState=(await controller.dispatch('state')).body;
      assert.equal(studentState.terminated,ended,'instructor '+action+' reaches the remote student');
      assert.equal(studentState.running,false);
    }
    hostDriver.stop(); controller.stop();
  } finally { await db.close(); }
});

test('cloud transport shares only student projection; freeze on lost link; no direct student clearances', async () => {
  let now=10000, lastPublished, connected=true;
  const view={role:'student',exerciseId:'exercise',available:true,running:true,environment:{},roster:[]};
  const room={pin:'123456',students:[]};
  const service={async call(action, _room, payload){
    if(!connected) throw new Error('offline');
    if(action==='exchange'){lastPublished=payload; return {room,commands:[]};}
    return {room:{name:'Controller',status:'ready'},state:view,receipts:[]};
  }};
  const local=async(path)=>({status:200,body:path==='cloud-view'?view:path==='state'?{...view,role:'instructor',aircraft:[]}:{ok:true}});
  const host=createRemoteRoom({service,local,now:()=>now,session:{role:'instructor',cloud:{id:'room',hostKey:'host'}}});
  await host.sync();
  assert.equal(lastPublished.state.role,'student'); assert.equal(lastPublished.state.aircraft,undefined);
  room.students.push({status:'admitted'});
  assert.equal((await host.dispatch('command',{type:'clock',payload:{action:'resume'}})).status,409);
  connected=false; now+=7000;
  assert.equal((await host.dispatch('state')).body.running,false);
  connected=true;
  const student=createRemoteRoom({service,local:()=>{throw new Error('Student must never access local engine');},now:()=>now,session:{role:'student',cloud:{id:'room'}}});
  await student.sync();
  assert.equal((await student.dispatch('export')).status,403);
  now+=7000;
  assert.equal((await student.dispatch('state')).body.available,false);
  host.stop(); student.stop();
});

test('public configuration rejects elevated keys; anonymous auth and refresh are isolated per tab',async()=>{
  const config={url:'https://training.supabase.co',publishableKey:'sb_publishable_test'};
  assert.equal(validRemoteConfig(config),true);
  assert.equal(validRemoteConfig({...config,publishableKey:'sb_secret_never'}),false);
  assert.equal(validRemoteConfig({...config,url:'http://evil.test'}),false);
  const store=new Map(), storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
  let clock=100000, signups=0, refreshes=0, requests=[];
  const fetcher=async(url,init)=>{
    requests.push({url,body:JSON.parse(init.body),headers:init.headers});
    if(url.includes('/auth/')) {
      if(url.includes('/signup')) signups++; else refreshes++;
      return Response.json({access_token:'access',refresh_token:'refresh',expires_at:Math.floor(clock/1000)+3600,user:{id:'auth-id'}});
    }
    return Response.json({id:'room'});
  };
  const a=createRemoteService(config,'tab-a',{fetcher,storage,now:()=>clock});
  const b=createRemoteService(config,'tab-b',{fetcher,storage,now:()=>clock});
  await a.call('create'); await a.call('poll','room'); await b.call('join');
  assert.equal(signups,2); assert.equal(store.size,2);
  clock+=3600000; await a.call('poll','room'); assert.equal(refreshes,1);
  assert.equal(requests.at(-1).headers.Authorization,'Bearer access');
});
