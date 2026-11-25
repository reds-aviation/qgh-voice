/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

/* One authoritative Go engine per isolated instructor room. No network API. */
'use strict';
importScripts('wasm_exec.js', 'browser-room-registry.js');
// A cached script response may resolve to its query-free cache URL. The explicit
// SharedWorker name retains the room identity in that case.
const urlRoom = new URL(self.location.href).searchParams.get('room');
const namedRoom = /^qgh-procedural-([a-f0-9-]{36})$/.exec(self.name || '')?.[1];
if (urlRoom && namedRoom && urlRoom !== namedRoom) throw new Error('Conflicting room identifier');
const roomID = namedRoom || urlRoom || 'legacy';
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
let automaticVoice = false, voiceRun = '', voiceExercise = '';
const fail = (message, status = 400) => { throw Object.assign(new Error(message), {status}); };
function engine(op, value = '', role = 'instructor') {
  const result = JSON.parse(self.proceduralEngine(op, typeof value === 'string' ? value : JSON.stringify(value), role));
  if (result.error) fail(result.error);
  return result.value;
}
function voiceView(role) {
  const state = engine('state', '', role);
  if (voiceExercise !== state.exerciseId) {
    automaticVoice = false;
    voiceExercise = state.exerciseId;
    voiceRun = '';
  }
  if (state.running && state.available && !state.terminated) voiceRun ||= uuid();
  else voiceRun = '';
  return { ...state, controllerVoice: { automatic: automaticVoice, runKey: voiceRun, issuedAt: Date.now() } };
}

function liveVoiceClearance(command, aircraft) {
  switch (command?.type) {
    case 'turn-now': return {action:command.side};
    case 'stop-turn': return {action:'stop-turn'};
    case 'set-altitude': return {action:command.direction === 'maintain' ? 'altitude' : command.direction,
      reference:'qnh', value:command.altitudeFt};
    case 'set-speed':
      if ((command.speedDirection === 'reduce' && command.speedKt >= aircraft.speedKt) ||
          (command.speedDirection === 'increase' && command.speedKt <= aircraft.speedKt)) return null;
      return {action:'speed', value:command.speedKt};
    default: return null;
  }
}

function receiveControllerCall(body) {
  if (body.type !== 'controller-call' || body.payload?.source !== 'voice') return engine('command', body, 'student');
  const state = voiceView('instructor');
  const {text, runKey, issuedAt} = body.payload;
  if (!voiceRun || runKey !== voiceRun || body.exerciseId !== state.exerciseId ||
      !Number.isFinite(issuedAt) || issuedAt > Date.now() || Date.now() - issuedAt > 15000) {
    fail('Exercise or connection changed. Repeat the call while the exercise is running.', 409);
  }
  if (typeof text !== 'string' || !text.trim() || text.length > 1000 ||
      typeof body.id !== 'string' || !/^[a-zA-Z0-9_-]{1,52}$/.test(body.id)) fail('Invalid voice call.');
  const roster = state.roster.filter(a => a.status !== 'scheduled');
  // Voice is optional. A missing recognizer/grammar still leaves human radio calls usable.
  if (!self.ATSControllerVoice) {
    try { importScripts('../rt-intent-model.js', '../voice-control.js'); }
    catch { /* Retain the call for the instructor if the optional parser is unavailable. */ }
  }
  const callsigns = roster.map(a => a.callsign);
  const heading = self.ATSControllerVoice?.interpretHeading(text, callsigns);
  const request = heading || self.ATSControllerVoice?.interpretRequest?.(text, callsigns, body.payload.candidateIntent)
    || self.ATSControllerVoice?.interpretClearance?.(text, callsigns);
  const aircraft = request && state.aircraft.find(a => a.callsign === request.callsign);
  const aircraftId = aircraft?.id || body.aircraftId;
  const previous = state.calls.at(-1)?.id;
  const receipt = engine('command', {id:body.id, exerciseId:state.exerciseId, type:'controller-call', aircraftId, payload:{text:'Voice · ' + text.trim()}}, 'student');
  const call = engine('state', '', 'instructor').calls.at(-1);
  if (!call || call.id === previous) return {...receipt, voiceOutcome:'Call already received. Check pilot readback or the calls list.'};
  if (automaticVoice && aircraft?.status === 'active') {
    try {
      const dispatchPilot = (type, payload) => engine('command', {
        id: type + '-' + body.id, exerciseId:state.exerciseId, aircraftId, type, payload
      }, 'instructor');
      const clearance = heading ? {action:'heading', direction:heading.side, value:heading.heading}
        : liveVoiceClearance(request.command, aircraft);
      if (clearance) {
        dispatchPilot('clearance', {...clearance, callId:call.id});
      } else {
        let payload;
        if (request.command?.type === 'report-position') payload = {mode:'position'};
        if (request.intent === 'heading-report') payload = {mode:'heading'};
        if (request.intent === 'df-transmission') payload = {mode:'df'};
        if (request.intent === 'range-report') {
          const station = state.environment;
          const range = Math.hypot(aircraft.xNm - station.stationXNm, aircraft.yNm - station.stationYNm);
          if (Number.isFinite(range)) payload = {text:`${aircraft.callsign}, range ${range.toFixed(1)} nautical miles from ${station.stationName}.`};
        }
        if (!payload) return {...receipt, voiceOutcome:'Sent for instructor review. Await pilot readback.'};
        dispatchPilot('transmit', {...payload, durationSeconds:8});
        dispatchPilot('call-handled', {id:call.id});
      }
      return {...receipt, voiceOutcome:engine('state', '', 'instructor').reports.at(-1).text};
    } catch (error) {
      if (error.status !== 400) throw error;
      // A compass failure or another flight rule can require the human pseudo-pilot.
    }
  }
  return {...receipt, voiceOutcome:'Sent for instructor review. Await pilot readback.'};
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
  automaticVoice = false;
  voiceRun = '';
  await advertise(true);
  room.students = [];
}
const started = (async () => {
  db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('qgh-procedural-browser-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('exercise');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Allow browser storage to open ATS SIM BOX Procedural.'));
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
    if (path === 'cloud-view' && method === 'GET') return voiceView('student');
    if (path === 'cloud-heartbeat' && method === 'POST') { cloud = { enabled: body.enabled === true, seen: Date.now() }; return {ok: true}; }
    if (path === 'cloud-command' && method === 'POST') { const result = receiveControllerCall(body); await persist(); return result; }
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
  if (path === 'state' && method === 'GET') return voiceView(session.role);
  if (path === 'voice-mode' && method === 'POST') {
    if (session.role !== 'instructor') fail('Instructor control required.', 403);
    const state = voiceView(session.role);
    if (body.exerciseId !== state.exerciseId || state.terminated || typeof body.automatic !== 'boolean') fail('Open the current exercise before choosing a voice mode.', 409);
    automaticVoice = body.automatic;
    voiceRun = '';
    return voiceView(session.role).controllerVoice;
  }
  if (path === 'command' && method === 'POST') {
    if (body.type === 'clock' && body.payload?.action === 'resume' && room.students.some(s => s.status === 'admitted')) fail('Wait for admitted controllers to press Ready');
    const before = engine('checkpoint').state.exerciseId;
    if (body.type === 'controller-call' && body.payload?.source === 'voice' &&
        (session.role !== 'student' || roomView(session).status !== 'ready')) fail('A ready controller is required for voice calls.', 403);
    const result = session.role === 'student' ? receiveControllerCall(body) : engine('command', body, session.role);
    if (body.type === 'clock') voiceRun = '';
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
        if (owner?.port === port) { automaticVoice = false; voiceRun = ''; }
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
