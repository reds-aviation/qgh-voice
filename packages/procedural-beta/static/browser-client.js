const nativeFetch = window.fetch.bind(window);
const pending = new Map();
let worker;
function rpc(message, signal) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const abort = () => { pending.delete(id); reject(signal?.reason || new Error('Request timed out')); };
    if (signal?.aborted) return abort();
    const timer = setTimeout(abort, 30000);
    signal?.addEventListener('abort', abort, {once: true});
    pending.set(id, result => { clearTimeout(timer); signal?.removeEventListener('abort', abort); resolve(result); });
    worker.port.postMessage({...message, id});
  });
}
try {
  if (!window.SharedWorker || !window.WebAssembly || !window.indexedDB) throw new Error('Open Procedural Beta in desktop Chrome or Edge with browser storage enabled.');
  worker = new SharedWorker(new URL('browser-worker.js', import.meta.url), {name: 'qgh-procedural-v1'});
  worker.port.onmessage = event => { const receive = pending.get(event.data.id); pending.delete(event.data.id); receive?.(event.data); };
  worker.port.start();
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/procedural/')) return nativeFetch(input, init);
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const result = await rpc({path: url.pathname.slice('/api/procedural/'.length), method: init.method || 'GET', headers, body: init.body}, init.signal);
    return new Response(result.body instanceof Blob ? result.body : JSON.stringify(result.body), {status: result.status, headers: {'Content-Type': result.body instanceof Blob ? result.body.type : 'application/json'}});
  };
  const detach = () => worker.port.postMessage({kind: 'detach'});
  window.addEventListener('pagehide', detach);
  document.addEventListener('click', event => { if (event.target.closest('#signout, #waiting-leave')) detach(); }, true);
  setInterval(() => worker.port.postMessage({kind: 'heartbeat'}), 1000);
  await import('./procedural.js');
} catch (error) {
  const message = document.getElementById('message');
  message.textContent = error.message;
  message.setAttribute('role', 'alert');
}
