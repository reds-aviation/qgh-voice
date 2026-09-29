import './browser-room-registry.js';
import { remoteConfig } from './remote-config.js';
import { createRemoteService, validRemoteConfig } from './remote-service.js';
import { createRemoteRoom } from './remote-room.js';
const nativeFetch = window.fetch.bind(window);
const pending = new Map();
const sessionKey = 'qgh-procedural-browser-session-v1';
const lastRoomKey = 'qgh-procedural-last-instructor-room';
let worker, connectedRoom = '', remote, activeSession;
const parsed = key => { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } };
const cloudKey = id => `atc-cloud-room:${id}`;
const response = result => new Response(result.body instanceof Blob ? result.body : JSON.stringify(result.body), {status: result.status, headers: {'Content-Type': result.body instanceof Blob ? result.body.type : 'application/json'}});
function rpc(message, signal, port = worker?.port) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID(); let timer;
    const cleanup = () => { clearTimeout(timer); pending.delete(id); signal?.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(signal?.reason || new Error('Request timed out')); };
    if (signal?.aborted) return abort();
    timer = setTimeout(abort, 30000);
    signal?.addEventListener('abort', abort, {once: true});
    pending.set(id, result => { cleanup(); resolve(result); });
    port.postMessage({...message, id});
  });
}
function detach() { worker?.port.postMessage({kind: 'detach'}); }
function createConnection(roomId) {
  if (!window.SharedWorker || !window.WebAssembly || !window.indexedDB) throw new Error('Use a current browser with SharedWorker, WebAssembly and browser storage for the instructor or this-device session.');
  if (roomId !== 'legacy' && !/^[a-f0-9-]{36}$/.test(roomId)) throw new Error('Invalid room identifier. Open a new instructor setup.');
  const url = new URL('browser-worker.js', import.meta.url);
  if (roomId !== 'legacy') url.searchParams.set('room', roomId);
  const connection = new SharedWorker(url, {name: roomId === 'legacy' ? 'qgh-procedural-v1' : `qgh-procedural-${roomId}`});
  connection.port.onmessage = event => pending.get(event.data.id)?.(event.data);
  connection.port.start();
  return connection;
}
function activate(connection, roomId, cloudRoom, auth) {
  remote?.stop(true); detach(); worker?.port.close();
  worker = connection; connectedRoom = roomId; remote = cloudRoom; activeSession = auth;
}
function localClient(connection, auth) {
  return (path, body, method = body === undefined ? 'GET' : 'POST') => rpc({path, method,
    headers: {authorization: `Bearer ${auth.token}`, 'x-csrf-token': auth.csrf},
    body: body === undefined || body instanceof Blob ? body : JSON.stringify(body)}, undefined, connection.port);
}
async function cloudClient(auth, connection, restore = false) {
  const service = createRemoteService(remoteConfig, auth.cloud.clientId, {fetcher: nativeFetch});
  const local = connection && localClient(connection, auth);
  if (local) {
    const health = await local('cloud-heartbeat', {enabled:true});
    if (health.status !== 200) throw new Error(health.body.error);
  }
  if (restore && auth.role === 'instructor') {
    auth.cloud.hostKey = crypto.randomUUID();
    const claimed = await service.call('claim', auth.cloud.id, {hostKey: auth.cloud.hostKey});
    auth.cloud.sequence = claimed.sequence;
  }
  const channel = createRemoteRoom({service,local,session:auth});
  try { await channel.start(); return channel; }
  catch (error) { channel.stop(); throw error; }
}

try {
  let saved = parsed(sessionKey);
  const params = new URLSearchParams(location.search);
  if (params.get('position') === 'student' && saved?.role === 'instructor') { saved = null; sessionStorage.removeItem(sessionKey); }
  if (saved?.token) {
    const connection = saved.role === 'instructor' || !saved.cloud ? createConnection(saved.roomId || 'legacy') : null;
    try {
      const channel = saved.cloud ? await cloudClient(saved, connection, true) : null;
      activate(connection,saved.roomId || 'legacy',channel,saved);
      sessionStorage.setItem(sessionKey,JSON.stringify(saved));
    } catch (error) {
      connection?.port.postMessage({kind:'detach'}); connection?.port.close();
      sessionStorage.removeItem(sessionKey); saved = null;
      document.getElementById('message').textContent = `Reconnect from the entry form: ${error.message}`;
    }
  }
  const restore = document.getElementById('resume-local-exercise');
  restore.hidden = !sessionStorage.getItem(lastRoomKey) && !saved;
  const mode = document.getElementById('session-mode');
  mode.querySelector('[value="online"]').disabled = !validRemoteConfig(remoteConfig);
  mode.querySelector('[value="online"]').textContent = validRemoteConfig(remoteConfig) ? 'Online room · different devices' : 'Online room · setup pending';
  mode.value = validRemoteConfig(remoteConfig) && (saved?.cloud || params.get('connection') === 'online') ? 'online' : 'local';
  const updateMode = () => {
    document.getElementById('connection-help').textContent = mode.value === 'online'
      ? 'Online room: different PCs/devices, internet on both. Select Online room on both and use the same PIN. Keep the instructor tab open.'
      : 'This device / offline: same PC AND same browser profile, separate windows. Best with two monitors: Windows + P → Extend. Keep the student on screen 2; Duplicate shows the instructor picture.';
  };
  mode.onchange = updateMode; updateMode();
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/procedural/')) return nativeFetch(input, init);
    const path = url.pathname.slice('/api/procedural/'.length);
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const message = {path, method: init.method || 'GET', headers, body: init.body};
    let result;
    if (path === 'session' && init.method === 'POST') {
      let roomId, candidate, candidateRemote, auth;
      const login = JSON.parse(init.body);
      try {
        const online = login.connection === 'online';
        if (login.role === 'instructor' || !online) {
          roomId = login.role === 'instructor'
            ? login.resumeRoom ? (sessionStorage.getItem(lastRoomKey) || saved?.roomId || 'legacy') : crypto.randomUUID()
            : await ProceduralRooms.find(String(login.pin || ''));
          if (!roomId) return response({status:403,body:{error:'Incorrect or expired PIN. Use the same browser profile and device, or choose Online room on both devices.'}});
          candidate = createConnection(roomId);
          result = await rpc(message, init.signal, candidate.port);
          if (result.status !== 200) { candidate.port.postMessage({kind:'detach'}); candidate.port.close(); return response(result); }
          auth = result.body;
        } else {
          roomId = crypto.randomUUID();
          auth = {token:crypto.randomUUID(),csrf:crypto.randomUUID(),role:'student',name:login.name,workspace:'procedural',roomId};
        }
        if (online) {
          const remembered = login.role === 'instructor' && login.resumeRoom && parsed(cloudKey(roomId));
          const clientId = remembered?.clientId || crypto.randomUUID(), hostKey = crypto.randomUUID();
          const service = createRemoteService(remoteConfig,clientId,{fetcher:nativeFetch});
          const opened = login.role === 'instructor'
            ? await service.call(remembered ? 'claim' : 'create', remembered?.id || null, {hostKey,localId:roomId})
            : await service.call('join',null,{pin:login.pin,name:login.name});
          auth.cloud = {id:opened.id,clientId,hostKey:login.role === 'instructor' ? hostKey : undefined,sequence:opened.sequence || 0};
          candidateRemote = await cloudClient(auth,candidate);
          if (login.role === 'instructor') sessionStorage.setItem(cloudKey(roomId),JSON.stringify(auth.cloud));
        } else if (login.role === 'instructor') await localClient(candidate,auth)('cloud-heartbeat',{enabled:false});
        activate(candidate,roomId,candidateRemote,auth);
        result = {status:200,body:auth};
      } catch (error) {
        candidateRemote?.stop(true); candidate?.port.postMessage({kind:'detach'}); candidate?.port.close();
        return response({status:error.status || 503,body:{error:error.message}});
      }
    }
    if (!worker && !remote && !result) return response({status:401,body:{error:'Open a session first.'}});
    if (!result && remote) {
      if (headers.authorization !== `Bearer ${activeSession.token}` || message.method !== 'GET' && headers['x-csrf-token'] !== activeSession.csrf) return response({status:401,body:{error:'Session ended. Reopen your desk.'}});
      result = await remote.dispatch(path,init.body instanceof Blob ? init.body : init.body ? JSON.parse(init.body) : undefined,message.method);
    }
    result ||= await rpc(message, init.signal);
    if (path === 'session' && result.status === 200 && result.body.role === 'instructor') {
      sessionStorage.setItem(lastRoomKey, connectedRoom); restore.hidden = false;
    }
    return response(result);
  };
  window.addEventListener('pagehide', () => { remote?.stop(); detach(); });
  document.addEventListener('click', event => { if (event.target.closest('#signout, #waiting-leave')) { remote?.stop(true); detach(); } }, true);
  setInterval(() => worker?.port.postMessage({kind: 'heartbeat'}), 1000);
  await import('./procedural.js');
} catch (error) {
  const message = document.getElementById('message');
  message.textContent = error.message;
  message.setAttribute('role', 'alert');
}
