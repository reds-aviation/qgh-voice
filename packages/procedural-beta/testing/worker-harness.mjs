import vm from 'node:vm';
import { IDBFactory } from 'fake-indexeddb';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const folder = new URL('../static/',import.meta.url);
export async function harness(saved = new Map(), {roomId = 'legacy', directory = new IDBFactory(), omitRoomQuery = false, workerName = roomId === 'legacy' ? 'qgh-procedural-v1' : `qgh-procedural-${roomId}`} = {}) {
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
  const context = vm.createContext({console, URL, name: workerName, location: {href: `https://example.test/procedural-beta/browser-worker.js${omitRoomQuery ? '' : '?room='+roomId}`}, crypto:webcrypto, performance, TextEncoder, TextDecoder, WebAssembly, Uint8Array, Blob, Date, setTimeout, clearTimeout, setInterval:()=>0, btoa, atob,
    indexedDB:{open(name){if (name.includes('directory')) return directory.open(name, 1); const request={result:database}; setImmediate(()=>request.onsuccess());return request;}},
    fetch:async path=>new Response(readFileSync(new URL(path,folder))),
  });
  context.self = context;
  context.importScripts = (...paths) => { for (const path of paths) vm.runInContext(readFileSync(new URL(path,folder),'utf8'),context); };
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
