import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const folder = new URL('./static/',import.meta.url);
async function harness(saved = new Map()) {
  let failWrite = false;
  const database = {transaction(_name, mode) {
    const tx = {}, changes = [];
    tx.objectStore = () => ({get: key => ({result: structuredClone(saved.get(key))}), put(value,key) { changes.push([key,structuredClone(value)]); return {}; }});
    setImmediate(() => {
      if (mode === 'readwrite' && failWrite) { failWrite = false; tx.error = new Error('Quota exceeded'); tx.onabort?.(); }
      else { for (const [key,value] of changes) saved.set(key,value); tx.oncomplete?.(); }
    });
    return tx;
  }};
  const context = vm.createContext({console, crypto:webcrypto, performance, TextEncoder, TextDecoder, WebAssembly, Uint8Array, Blob, Date, setTimeout, clearTimeout, setInterval:()=>0, btoa, atob,
    indexedDB:{open(){const request={result:database}; setImmediate(()=>request.onsuccess());return request;}},
    fetch:async path=>new Response(readFileSync(new URL(path,folder))),
  });
  context.self = context;
  context.importScripts = path => vm.runInContext(readFileSync(new URL(path,folder),'utf8'),context);
  vm.runInContext(readFileSync(new URL('browser-worker.js',folder),'utf8'),context);
  let sequence = 0;
  function port() {
    const pending = new Map();
    const p = {start(){},postMessage(result){pending.get(result.id)?.(result);pending.delete(result.id);}};
    context.onconnect({ports:[p]});
    return {raw:p, request(path, body, session, method=body===undefined?'GET':'POST') {
      return new Promise(resolve=>{
        const id = ++sequence;
        pending.set(id,resolve);
        p.onmessage({data:{id,path,method,body:body===undefined?undefined:JSON.stringify(body),headers:session?{authorization:`Bearer ${session.token}`,'x-csrf-token':session.csrf}:{}}});
      });
    }};
  }
  return {port, saved, failNextWrite(){failWrite=true;}};
}
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
