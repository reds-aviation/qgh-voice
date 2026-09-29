// Register the shared app shell without starting QGH's optional pilot voice pack.
(() => {
  if (!('serviceWorker' in navigator) || !['https:', 'http:'].includes(location.protocol)) return;
  const script = document.currentScript?.src;
  if (!script) return;
  const root = new URL('./', script), workerURL = new URL('service-worker.js', root);
  let registration, button, approved = false, checking;
  const active = () => {
    try { return !!sessionStorage.getItem('qgh-procedural-browser-session-v1'); }
    catch { return document.body.classList.contains('desk-open') || document.body.classList.contains('setup-open'); }
  };
  const offer = () => {
    if (!registration?.waiting || !navigator.serviceWorker.controller) return;
    if (!button) {
      button = document.createElement('button');
      button.type = 'button'; button.className = 'suite-update';
      button.textContent = 'Update available · reload';
      button.title = 'Load the latest simulator and training guides';
      button.addEventListener('click', () => {
        if (active() || !registration.waiting) return;
        approved = true; button.disabled = true; button.textContent = 'Updating…';
        registration.waiting.postMessage({type:'SKIP_WAITING'});
      });
      (document.querySelector('.topbar nav, .suite-header-left') || document.body).append(button);
    }
    button.hidden = active();
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (approved) location.reload(); });
  new MutationObserver(offer).observe(document.body, {attributes:true,attributeFilter:['class']});
  window.addEventListener('load', async () => {
    try {
      registration = await navigator.serviceWorker.register(workerURL.href, {scope:root.pathname});
      offer();
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', offer);
      });
      const check = () => {
        checking ||= registration.update().catch(() => {}).finally(() => {checking = null; offer();});
      };
      window.addEventListener('online', check);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    } catch { /* Online use remains available when offline storage is unavailable. */ }
  }, {once:true});
})();
