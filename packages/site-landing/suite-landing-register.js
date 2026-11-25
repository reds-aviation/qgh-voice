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
      (document.querySelector('.topbar nav, .suite-header-left, .site-header .header-links') || document.body).append(button);
    }
    button.hidden = active();
  };
  const welcome = document.getElementById('offline-welcome');
  if (welcome && window.isSecureContext) {
    const preference = 'ats-simbox-offline-welcome-seen';
    let seen = false;
    try {
      seen = localStorage.getItem(preference) === '1';
      if (!seen) localStorage.setItem(preference, '1');
    } catch {
      try {
        seen = sessionStorage.getItem(preference) === '1';
        if (!seen) sessionStorage.setItem(preference, '1');
      } catch { /* The reminder still works with storage disabled. */ }
    }
    if (!seen) {
      welcome.hidden = false;
      const dismiss = () => {
        welcome.hidden = true;
        document.querySelector('.suite-header a[href="training-centre.html"]')?.focus();
      };
      welcome.querySelector('button').addEventListener('click', dismiss);
      welcome.addEventListener('keydown', event => { if (event.key === 'Escape') dismiss(); });
      welcome.querySelector('a').addEventListener('click', () => { welcome.hidden = true; });
    }
  }

  const offlineSetup = document.getElementById('offline-preparation');
  if (offlineSetup && window.isSecureContext) {
    const coreButton = document.getElementById('offline-prepare-core');
    const voiceButton = document.getElementById('offline-prepare-voice');
    const mainStatus = document.getElementById('offline-main-status');
    const instructorStatus = document.getElementById('offline-instructor-status');
    const voiceStatus = document.getElementById('offline-voice-status');
    const notice = document.getElementById('offline-preparation-status');
    const instructorRoot = new URL('instructor-led/', root);
    let preparingCore = false;
    let preparingVoice = false;
    let voiceReady = false;
    const voiceAdapter = async () => {
      await import(new URL('offline-voice-engine.js', root).href);
      return globalThis.QGHOfflineVoiceEngine;
    };

    function shellWorker(record) {
      const worker = record?.installing || record?.waiting || record?.active;
      if (!worker) return Promise.reject(new Error('Offline installer unavailable'));
      const installed = () => ['installed', 'activating', 'activated'].includes(worker.state);
      if (installed()) return Promise.resolve(worker);
      return new Promise((resolve, reject) => {
        const finish = (callback, result) => {
          clearTimeout(timer);
          worker.removeEventListener('statechange', check);
          callback(result);
        };
        const check = () => {
          if (installed()) finish(resolve, worker);
          if (worker.state === 'redundant') finish(reject, new Error('Offline installer did not complete'));
        };
        const timer = setTimeout(() => finish(reject, new Error('Offline installer timed out')), 180000);
        worker.addEventListener('statechange', check);
        check();
      });
    }

    function shellStatus(worker, repair = false) {
      return new Promise(resolve => {
        const channel = new MessageChannel();
        const finish = ready => {
          clearTimeout(timer);
          channel.port1.close();
          resolve(ready);
        };
        const timer = setTimeout(() => finish(false), repair ? 180000 : 4000);
        channel.port1.onmessage = event => finish(event.data?.ready === true);
        try { worker.postMessage({type:'OFFLINE_SHELL_STATUS', repair}, [channel.port2]); }
        catch { finish(false); }
      });
    }

    async function isShellReady(url) {
      try {
        const record = await navigator.serviceWorker.getRegistration(url.href);
        const worker = record?.waiting || record?.active;
        return record?.scope === url.href && worker && await shellStatus(worker);
      } catch { return false; }
    }

    async function refreshCore() {
      const [mainReady, instructorReady] = await Promise.all([isShellReady(root), isShellReady(instructorRoot)]);
      if (preparingCore) return;
      mainStatus.textContent = mainReady ? 'Ready on this device' : 'Needs preparation';
      instructorStatus.textContent = instructorReady ? 'Ready on this device' : 'Needs preparation';
    }
    async function refreshVoice() {
      try {
        if (!preparingVoice && await caches.has('qgh-offline-voice-pack-v1')) {
          voiceReady = await (await voiceAdapter()).hasCachedArchive();
          voiceStatus.textContent = voiceReady ? 'Ready on this device' : 'Optional';
          voiceButton.disabled = voiceReady;
        }
      } catch { voiceStatus.textContent = 'Optional'; }
    }

    coreButton.disabled = false;
    voiceButton.disabled = !window.caches;
    notice.textContent = 'Choose Prepare exercises before going offline.';
    void refreshCore();
    if (window.caches) void refreshVoice();

    coreButton.addEventListener('click', async () => {
      if (preparingCore) return;
      preparingCore = coreButton.disabled = true;
      notice.textContent = 'Checking and saving exercises…';
      mainStatus.textContent = instructorStatus.textContent = 'Preparing…';
      try {
        const [main, instructor] = await Promise.all([
          navigator.serviceWorker.register(workerURL.href, {scope:root.pathname}),
          navigator.serviceWorker.register(new URL('service-worker.js', instructorRoot).href, {scope:instructorRoot.pathname})
        ]);
        // A previously installed instructor worker may predate the Guide controls.
        if (instructor.active && !instructor.installing && !instructor.waiting) {
          await instructor.update().catch(() => {});
        }
        const workers = await Promise.all([shellWorker(main), shellWorker(instructor)]);
        const ready = await Promise.all(workers.map(worker => shellStatus(worker, true)));
        if (ready.every(Boolean)) notice.textContent = 'Exercises and the written guide are ready on this device.';
        else throw new Error('Some offline exercises are missing');
      } catch {
        notice.textContent = 'Preparation did not finish. Check your connection and storage, then try again.';
      } finally {
        preparingCore = false;
        await refreshCore();
        coreButton.disabled = false;
      }
    });

    voiceButton.addEventListener('click', async () => {
      if (preparingVoice || voiceReady) return;
      preparingVoice = voiceButton.disabled = true;
      voiceStatus.textContent = 'Downloading…';
      let lastProgress = 0;
      try {
        const installed = await (await voiceAdapter()).downloadOfflineVoicePack(progress => {
          if (progress.phase === 'downloading' && progress.total > 0) {
            const percent = Math.min(99, Math.floor(100 * progress.loaded / progress.total));
            if (percent - lastProgress >= 10) {
              lastProgress = percent;
              voiceStatus.textContent = 'Downloading · ' + percent + '%';
            }
          }
        });
        if (!installed) throw new Error('Offline storage unavailable');
        voiceReady = true;
        voiceStatus.textContent = 'Ready on this device';
      } catch {
        voiceStatus.textContent = 'Download incomplete. Check your connection and storage, then try again.';
      } finally {
        preparingVoice = false;
        voiceButton.disabled = voiceReady;
      }
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!preparingCore) void refreshCore(); });
  }
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
