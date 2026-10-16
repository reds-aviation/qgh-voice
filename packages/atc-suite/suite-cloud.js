/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ATCSuiteCloud = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';
  // Relay only already-validated protocol messages. Simulation/sensor truth stays local.
  const replaceable = new Set(['observation', 'host-heartbeat', 'student-heartbeat']);
  function createTransport({ service, room, host, sessionApi, initialCursor = 0, now = Date.now, onStatus = () => {}, schedule = setTimeout, cancel = clearTimeout }) {
    const listeners = new Set(), queue = [];
    let cursor = initialCursor, stopped = false, closing = false, timer, job, lastSuccess = now(), healthy = true;
    function post(message) {
      if (stopped || closing) return;
      const validation = (host ? sessionApi.validateInstructorMessage : sessionApi.validateStudentMessage)(message, { sessionId: room.sessionId });
      if (!validation.ok) throw new Error('Refusing an invalid online message: ' + validation.reason);
      if (replaceable.has(message.type)) {
        const index = queue.findIndex(x => x.type === message.type && x.targetClientId === message.targetClientId);
        if (index >= 0) queue.splice(index, 1);
      }
      if (queue.length >= 200) { healthy = false; onStatus({ connected: false, error: 'Online queue full. Pause and reconnect.' }); return; }
      queue.push(JSON.parse(JSON.stringify(message)));
    }
    async function sync() {
      if (job) return job;
      if (stopped) return;
      job = (async () => {
        const batch = queue.slice(0, 32);
        const result = await service.call('exchange', room.id, {
          ...(host ? { hostKey: room.hostKey } : {}), cursor, messages: batch,
        });
        for (const item of batch) { const index = queue.indexOf(item); if (index >= 0) queue.splice(index, 1); }
        // Server IDs are delivered in order; original protocol revisions detect retries.
        for (const item of result.messages || []) {
          if (item.id <= cursor) continue;
          listeners.forEach(fn => fn(item.body)); cursor = item.id;
        }
        lastSuccess = now(); healthy = true;
        onStatus({ connected: true, closed: result.closed === true });
        if (result.closed) stopped = true;
      })();
      try { return await job; }
      catch (error) { healthy = false; onStatus({ connected: false, error: error.message }); throw error; }
      finally { job = null; }
    }
    async function cycle() {
      try { await sync(); } catch { /* The instructor pauses; retry preserves revisions. */ }
      if (!stopped) timer = schedule(cycle, 750);
    }
    return {
      channelName: room.channelName, post,
      subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      sync,
      start() { if (!timer && !stopped) timer = schedule(cycle, 0); },
      get connected() { return !stopped && healthy && now() - lastSuccess < 6000; },
      recoverySnapshot() { return { room: JSON.parse(JSON.stringify(room)), cursor }; },
      detach() { stopped = true; cancel(timer); listeners.clear(); },
      close() {
        if (stopped || closing) return;
        closing = true; cancel(timer);
        // Flush termination before closing. Closing a browser may interrupt this;
        // the server heartbeat/expiry still invalidates the disconnected picture.
        void (async () => {
          try { if (job) await job; await sync(); if (host) await service.call('close', room.id, { hostKey: room.hostKey }); }
          catch { /* Timeouts/expiry remain visible on the other desk. */ }
          finally { stopped = true; listeners.clear(); }
        })();
      },
    };
  }
  async function client(student = false) {
    const [{ createRemoteService }, { remoteConfig }] = await Promise.all([import('./remote-service.js'), import('./remote-config.js')]);
    // A random identity per page avoids sharing instructor Auth with an opened student tab.
    const identityKey = student ? 'atc-suite-student-auth' : 'atc-suite-host-auth';
    let clientId = sessionStorage.getItem(identityKey);
    if (!clientId) { clientId = crypto.randomUUID(); sessionStorage.setItem(identityKey,clientId); }
    const service = createRemoteService(remoteConfig, clientId, { rpc: 'atc_suite_session' });
    const auth = await service.authenticate();
    return { service, senderId: auth.user.id };
  }
  async function prepareHost(sessionApi, onStatus, recovery) {
    const { service, senderId } = await client(), hostKey = crypto.randomUUID();
    const room = recovery?.room?.hostKey ? recovery.room : await service.call('create', null, { hostKey });
    if (!room.hostKey) room.hostKey = hostKey;
    const transport = createTransport({ service, room, host: true, sessionApi, initialCursor: recovery?.cursor || 0, onStatus });
    return { transport, senderId, sessionId: room.sessionId, channelName: room.channelName, pin: room.pin };
  }
  async function prepareStudent(pin, sessionApi, onStatus) {
    const { service, senderId } = await client(true);
    const room = await service.call('join', null, { pin });
    const transport = createTransport({ service, room, host: false, sessionApi, onStatus });
    return { transport, clientId: senderId, discovery: { pin, sessionId: room.sessionId, channelName: room.channelName, expiresAt: Date.now() + 8 * 3600000 } };
  }
  async function configureConnection() {
    const select = document.getElementById('exerciseConnection');
    if (!select) return;
    const { remoteConfig } = await import('./remote-config.js');
    const available = !!remoteConfig.url && !!remoteConfig.publishableKey;
    select.querySelector('[value="online"]').disabled = !available;
    const requested = new URLSearchParams(globalThis.location?.search || '').get('connection');
    if (requested === 'local' || requested === 'online') select.value = requested;
    if (!available) select.value = 'local';
    const update = () => {
      const online = select.value === 'online';
      const help = document.getElementById('connectionHelp');
      if (help) help.textContent = online
        ? 'Online room: instructor and student may use different PCs or devices. Internet is required on both. Use the same PIN; the instructor must admit the student.'
        : 'This device / offline: one PC, same browser profile, separate windows. Best with two monitors: Windows + P → Extend. Keep instructor and student on separate screens; Duplicate reveals the instructor picture.';
    };
    select.addEventListener('change', update); update();
  }
  if (typeof document === 'object') document.addEventListener('DOMContentLoaded', () => { void configureConnection().catch(() => {}); });
  return Object.freeze({ createTransport, prepareHost, prepareStudent, configureConnection });
});
