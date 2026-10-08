// The instructor's existing worker remains the sole simulation authority.
// Supabase relays only the student projection and checked student commands.
import './meeting-room.js';
const normalizeMeetUrl = value => {
  try { return globalThis.ATCSuiteMeeting.normalizeMeetUrl(value); }
  catch (error) { throw Object.assign(error, { status: 400 }); }
};
const ok = body => ({ status: 200, body });
const errorResult = error => ({ status: error.status || 503, body: { error: error.message || 'Online session unavailable.' } });
const staleView = state => state && ({ ...state, available: false, running: false, radio: { phase: 'idle' }, df: null });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export function createRemoteRoom({ service, local, session, now = Date.now }) {
  const cloud = session.cloud;
  let room, state, sequence = cloud.sequence || 0, syncedAt = 0, syncJob, timer, stopped = false, lastError;
  const receipts = new Map();
  let sharedMap = '';
  const host = session.role === 'instructor';
  let meetingUrl = host ? normalizeMeetUrl(session.meetingUrl || '') : '';
  let meetingExerciseId;
  const call = (action, payload = {}) => service.call(action, cloud.id, { ...payload, ...(host ? { hostKey: cloud.hostKey } : {}) });
  const unwrap = result => {
    if (result.status !== 200) throw Object.assign(new Error(result.body?.error || 'Exercise unavailable.'), { status: result.status });
    return result.body;
  };
  async function shareMap(view) {
    const id = view.environment?.map?.imageId;
    if (!id || id === sharedMap) return;
    const blob = unwrap(await local(`map/${id}`));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let n = 0; n < bytes.length; n += 8192) binary += String.fromCharCode(...bytes.subarray(n, n + 8192));
    await call('map-put', { imageId: id, mime: blob.type, data: btoa(binary) });
    sharedMap = id;
  }
  async function sync() {
    if (syncJob) return syncJob;
    if (stopped) throw new Error('Session closed.');
    syncJob = (async () => {
      let result;
      if (host) {
        const projection = { ...unwrap(await local('cloud-view')) };
        if (projection.role !== 'student' || ['aircraft', 'events', 'alerts'].some(key => key in projection)) throw new Error('Refusing to share an instructor view.');
        if (meetingExerciseId && projection.exerciseId !== meetingExerciseId) {
          meetingUrl = ''; session.meetingUrl = '';
        }
        meetingExerciseId = projection.exerciseId;
        // A meeting link is session coordination; flight truth stays in the worker.
        projection.meetingUrl = meetingUrl;
        await shareMap(projection);
        const sent = [...receipts].map(([id, result]) => ({ id, result }));
        result = await call('exchange', { state: projection, sequence: ++sequence, receipts: sent });
        for (const {id} of sent) receipts.delete(id);
        unwrap(await local('cloud-heartbeat', { enabled: true }));
        for (const command of result.commands || []) {
          // Existing worker validates the role, exercise ID and idempotency receipt.
          if (!receipts.has(command.id)) receipts.set(command.id, await local('cloud-command', command));
        }
      } else {
        result = await call('poll');
        state = result.state;
        for (const receipt of result.receipts || []) receipts.set(receipt.id, receipt.result);
        // Bounded client memory; the server retains acknowledged command receipts for retries.
        while (receipts.size > 200) receipts.delete(receipts.keys().next().value);
      }
      room = result.room; syncedAt = now(); lastError = null;
      return result;
    })();
    try { return await syncJob; }
    catch (error) { lastError = error; throw error; }
    finally { syncJob = null; }
  }
  async function cycle() {
    try { await sync(); } catch { /* Six seconds without a heartbeat pauses the worker. */ }
    if (!stopped) timer = setTimeout(cycle, 1000);
  }
  async function dispatch(path, body, method = body === undefined ? 'GET' : 'POST') {
    try {
      if (stopped) throw new Error('Session closed.');
      if (path === 'room') {
        if (method === 'POST') {
          const result = await call(body.action, { studentId: body.studentId });
          room = result.room;
          if (!host && body.action === 'ready') await sync();
        }
        if (!room) await sync();
        return ok({ ...room, meetingUrl: host ? meetingUrl : room?.status === 'ready' ? state?.meetingUrl || '' : '' });
      }
      if (path === 'meeting') {
        if (!host || method !== 'POST') return { status: 403, body: { error: 'Instructor control required.' } };
        meetingUrl = normalizeMeetUrl(body?.meetingUrl);
        session.meetingUrl = meetingUrl;
        try { await sync(); } catch { /* Keep the link and retry through the existing room exchange. */ }
        return ok({ meetingUrl, shared: !lastError });
      }
      if (path === 'state') {
        if (host) {
          const result = await local(path);
          if (now() - syncedAt > 6000) result.body = staleView(result.body);
          result.body = { ...result.body, meetingUrl };
          return result;
        }
        if (!state) throw new Error('Waiting for the instructor’s exercise picture.');
        return ok(now() - syncedAt > 6000 ? staleView(state) : state);
      }
      if (path === 'command') {
        if (host) {
          if (body.type === 'clock' && body.payload?.action === 'resume') {
            await sync();
            if (room.students?.some(s => s.status === 'admitted')) return { status: 409, body: { error: 'Wait for admitted controllers to press Ready.' } };
          }
          const result = await local(path, body);
          // A failed cloud connection must not turn an accepted local command into a retry.
          if (result.status === 200) { try { await sync(); } catch { /* Paused automatically if the link stays down. */ } }
          return result;
        }
        const queued = await call('command', { command: body });
        if (queued.result) return queued.result;
        const deadline = now() + 12000;
        while (now() < deadline && !stopped) {
          if (receipts.has(body.id)) return receipts.get(body.id);
          await sync();
          if (receipts.has(body.id)) return receipts.get(body.id);
          await sleep(500);
        }
        // The caller retries with the same command ID, never a second clearance.
        throw new TypeError('Waiting for instructor acknowledgement.');
      }
      if (/^map\/[a-f0-9]{64}$/.test(path) && !host) {
        const image = await call('map-get', { imageId: path.slice(4) });
        const bytes = Uint8Array.from(atob(image.data.replace(/\s/g, '')), c => c.charCodeAt(0));
        return ok(new Blob([bytes], { type: image.mime }));
      }
      if (host) return local(path, body, method);
      return { status: 403, body: { error: 'Instructor control required.' } };
    } catch (error) {
      if (error instanceof TypeError) throw error;
      return errorResult(error);
    }
  }
  return {
    dispatch, sync,
    async start() { await sync(); if (!stopped) timer = setTimeout(cycle, 1000); },
    stop(close = false) { stopped = true; clearTimeout(timer); if (close && host) void call('close').catch(() => {}); },
    get lastError() { return lastError; },
  };
}
