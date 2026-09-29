/* One authoritative Go engine per isolated instructor room. No network API. */
'use strict';
importScripts('wasm_exec.js', 'browser-room-registry.js');
const roomID = new URL(self.location.href).searchParams.get('room') || 'legacy';
if (roomID !== 'legacy' && !/^[a-f0-9-]{36}$/.test(roomID)) throw new Error('Invalid room identifier');
const storageKey = key => roomID === 'legacy' ? key : `room:${roomID}:${key}`;
let directoryUpdated = 0;
async function advertise(rotate = false) {
  const active = !!owner?.port && Date.now() - owner.seen < 6000;
  const registered = await ProceduralRooms.register(roomID, active, rotate);
  room.pin = registered.pin; directoryUpdated = Date.now();
}
const sessions = new Map();
let db, checkpoint, owner, fault, queue = Promise.resolve();
let room = {pin: '', students: []}, attempts = {start: 0, count: 0};
let cloud = { enabled: false, seen: 0 };
const uuid = () => crypto.randomUUID();
const fail = (message, status = 400) => { throw Object.assign(new Error(message), {status}); };
function engine(op, value = '', role = 'instructor') {
  const result = JSON.parse(self.proceduralEngine(op, typeof value === 'string' ? value : JSON.stringify(value), role));
  if (result.error) fail(result.error);
  return result.value;
}
function transaction(mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('exercise', mode), store = tx.objectStore('exercise');
    let request;
    try { request = action(store); } catch (error) { reject(error); return; }
    tx.oncomplete = () => resolve(request?.result);
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('Browser storage is unavailable. Export your exercise before closing.'));
  });
}
async function persist() {
  const next = engine('checkpoint');
  if (checkpoint?.state.revision === next.state.revision) return;
  try { await transaction('readwrite', store => store.put(next, storageKey('checkpoint'))); checkpoint = next; }
  catch (error) {
    engine('init', checkpoint || 'null');
    fault = 'Exercise paused: browser storage failed. Free space, then reopen this page.';
    fail(fault, 507);
  }
}
async function resetRoom() {
  await advertise(true);
  room.students = [];
}
const started = (async () => {
  db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('qgh-procedural-browser-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('exercise');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Allow browser storage to open Procedural Beta.'));
    request.onblocked = () => reject(new Error('Close older procedural tabs and try again.'));
  });
  checkpoint = await transaction('readonly', store => store.get(storageKey('checkpoint')));
  const go = new Go();
  const response = await fetch('procedural-engine.wasm');
  if (!response.ok) throw new Error('Cannot load the procedural engine. Refresh while online.');
  const result = await WebAssembly.instantiate(await response.arrayBuffer(), go.importObject);
  go.run(result.instance).catch(error => { fault = `Engine stopped: ${error.message}`; });
  if (!self.proceduralEngine) throw new Error('Procedural engine did not start.');
  engine('init', checkpoint || 'null');
  await resetRoom();
  await persist();
})();
// Attach immediately so startup failures cannot become unhandled rejections.
started.catch(error => { fault = error.message; });
function serial(action) {
  const next = queue.then(action);
  queue = next.catch(() => {});
  return next;
}
function tick() { engine('tick', !!owner && Date.now() - owner.seen < 6000 && (!cloud.enabled || Date.now() - cloud.seen < 6000) ? 'true' : 'false'); }
setInterval(() => serial(async () => { await started; if (fault) return; tick(); await persist(); if (Date.now() - directoryUpdated > 5000) await advertise(); }).catch(() => {}), 250);
function roomView(session) {
  return session.role === 'instructor' ? {pin: room.pin, students: room.students.map(({id, name, status}) => ({id, name, status}))}
    : {name: session.name, status: room.students.find(s => s.token === session.token)?.status || 'rejected'};
}
function auth(port, headers, mutate) {
  const session = sessions.get((headers.authorization || '').replace(/^Bearer /, ''));
  if (!session || session.port && session.port !== port) fail('Session ended. Reopen your desk.', 401);
  if (mutate && headers['x-csrf-token'] !== session.csrf) fail('Invalid session request', 403);
  session.port = port; session.seen = Date.now();
  if (session.role === 'instructor') owner = session;
  return session;
}
async function dispatch(port, request) {
  await started;
  if (fault) fail(fault, 503);
  const {path, method, headers = {}} = request;
  const body = request.body instanceof Blob ? request.body : request.body ? JSON.parse(request.body) : {};
  if (path === 'session' && method === 'POST') {
    if (!['instructor', 'student'].includes(body.role)) fail('Choose a desk');
    if (sessions.size >= 128) fail('Close all procedural tabs and reopen to start a new room.', 429);
    if (body.role === 'instructor' && owner?.port && Date.now() - owner.seen < 6000) fail('The instructor desk is already open. Return to that tab.', 409);
    if (body.role === 'student') {
      body.name = String(body.name || '').trim();
      if (!body.name || [...body.name].length > 60 || /[\x00-\x1f\x7f]/.test(body.name)) fail('Enter your name (1–60 characters)');
      if (Date.now() - attempts.start > 60000) attempts = {start: Date.now(), count: 0};
      if (attempts.count >= 12) fail('Too many incorrect PIN attempts. Try again in one minute.', 429);
      if (body.pin !== room.pin || !owner) { attempts.count++; fail('Incorrect or expired session PIN', 403); }
    }
    const result = {token: uuid(), csrf: uuid(), role: body.role, workspace: 'procedural', roomId: roomID, name: body.name || ''};
    const session = {...result, port, seen: Date.now()};
    sessions.set(result.token, session);
    if (session.role === 'instructor') { if (owner) sessions.delete(owner.token); owner = session; await advertise(); }
    else room.students.push({id: uuid(), name: session.name, token: session.token, status: 'waiting'});
    return result;
  }
  const session = auth(port, headers, method !== 'GET');
  tick();
  if (path.startsWith('cloud-')) {
    if (session.role !== 'instructor') fail('Instructor control required', 403);
    if (path === 'cloud-view' && method === 'GET') return engine('state', '', 'student');
    if (path === 'cloud-heartbeat' && method === 'POST') { cloud = { enabled: body.enabled === true, seen: Date.now() }; return {ok: true}; }
    if (path === 'cloud-command' && method === 'POST') { const result = engine('command', body, 'student'); await persist(); return result; }
    fail('Unknown cloud request', 400);
  }
  if (path === 'room') {
    if (method === 'POST') {
      const {action, studentId} = body;
      if (!['ready', 'admit', 'reject', 'reset'].includes(action)) fail('Unknown room action');
      if ((action === 'ready') !== (session.role === 'student')) fail('Instructor control required', 403);
      if (action === 'reset') await resetRoom();
      else {
        const student = room.students.find(s => action === 'ready' ? s.token === session.token : s.id === studentId);
        if (!student) fail('Student is no longer in this room', 404);
        if (action === 'ready' && !['admitted', 'ready'].includes(student.status)) fail('Wait for instructor admission', 403);
        student.status = action === 'ready' ? 'ready' : action === 'reject' ? 'rejected' : student.status === 'ready' ? 'ready' : 'admitted';
      }
    } else if (method !== 'GET') fail('Unsupported method', 405);
    return roomView(session);
  }
  if (session.role === 'student' && !['admitted', 'ready'].includes(roomView(session).status)) fail('Instructor admission required', 403);
  if (path === 'state' && method === 'GET') return engine('state', '', session.role);
  if (path === 'command' && method === 'POST') {
    if (body.type === 'clock' && body.payload?.action === 'resume' && room.students.some(s => s.status === 'admitted')) fail('Wait for admitted controllers to press Ready');
    const before = engine('checkpoint').state.exerciseId;
    const result = engine('command', body, session.role);
    await persist(); // Never acknowledge before the command receipt and state are durable.
    if (before !== checkpoint.state.exerciseId) await resetRoom();
    return result;
  }
  if (path === 'export' && method === 'GET') {
    if (session.role !== 'instructor') fail('Instructor control required', 403);
    const result = engine('export'), id = result.scenario.environment?.map?.imageId;
    if (id) {
      const blob = await transaction('readonly', store => store.get(storageKey(`map:${id}`)));
      if (!blob) fail('The scenario map is missing. Upload it again before exporting.', 404);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      result.mapAsset = {id, mime: blob.type, data: btoa(binary)};
    }
    return result;
  }
  if (path === 'map' && method === 'POST') {
    if (session.role !== 'instructor') fail('Instructor control required', 403);
    if (!(body instanceof Blob) || body.size > 5 * 1024 * 1024 || !body.size) fail('Choose a PNG or JPEG up to 5 MB');
    const bytes = new Uint8Array(await body.arrayBuffer());
    const mime = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 ? 'image/png' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : '';
    if (!mime) fail('Choose a PNG or JPEG image');
    const blob = new Blob([bytes], {type: mime}), bitmap = await createImageBitmap(blob);
    const {width, height} = bitmap; bitmap.close();
    if (width > 4096 || height > 4096 || width * height > 16000000) fail('Map dimensions must be within 4096 pixels and 16 megapixels');
    const imageId = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    await transaction('readwrite', store => store.put(blob, storageKey(`map:${imageId}`)));
    return {imageId, width, height};
  }
  if (/^map\/[a-f0-9]{64}$/.test(path) && method === 'GET') {
    const blob = await transaction('readonly', store => store.get(storageKey(`map:${path.slice(4)}`)));
    if (!blob) fail('Map is unavailable', 404);
    return blob;
  }
  fail('Unknown procedural request', 404);
}
self.onconnect = event => {
  const port = event.ports[0];
  port.onmessage = event => {
    const request = event.data;
    serial(async () => {
      if (request?.kind === 'detach') {
        for (const session of sessions.values()) if (session.port === port) { session.port = null; session.seen = 0; }
        if (self.proceduralEngine) { tick(); await persist(); await advertise(); }
        return;
      }
      if (request?.kind === 'heartbeat') {
        for (const session of sessions.values()) if (session.port === port) session.seen = Date.now();
        return;
      }
      try { port.postMessage({id: request.id, status: 200, body: await dispatch(port, request)}); }
      catch (error) { port.postMessage({id: request.id, status: error.status || 503, body: {error: error.message || 'Browser engine unavailable'}}); }
    }).catch(() => {});
  };
  port.start();
};
