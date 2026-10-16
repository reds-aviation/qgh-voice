/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

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
