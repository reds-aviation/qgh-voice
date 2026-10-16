/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

(() => {
  'use strict';

  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;

  const ACTIVE_SESSION_SELECTOR = [
    '#activeWorkspace:not([hidden])',
    '#waitingPanel:not([hidden])',
    '#readyPanel:not([hidden])',
    '#studentWorkspace:not([hidden])',
    '#reviewScreen:not([hidden])',
  ].join(', ');
  let reloadApproved = false;
  let updateNotice;
  let noticeObserver;

  const hasActiveLocalSession = () => Boolean(document.querySelector(ACTIVE_SESSION_SELECTOR));

  const setNoticeText = text => {
    const copy = updateNotice?.querySelector('[data-update-copy]');
    if (copy) copy.textContent = text;
  };

  const refreshNoticeVisibility = () => {
    if (!updateNotice) return;
    const protectedSession = hasActiveLocalSession();
    // A disabled UPDATE button is still an obstruction over a mobile scope.
    // Keep the entire notice out of every admitted/waiting/run/review view.
    if (updateNotice.hidden !== protectedSession) updateNotice.hidden = protectedSession;
    const button = updateNotice.querySelector('button');
    if (button) button.disabled = protectedSession;
  };

  const offerUpdate = registration => {
    if (!registration.waiting || !navigator.serviceWorker.controller) return;

    if (!updateNotice) {
      updateNotice = document.createElement('section');
      updateNotice.className = 'pwa-update-notice';
      updateNotice.setAttribute('role', 'status');
      updateNotice.setAttribute('aria-live', 'polite');
      updateNotice.innerHTML = '<span data-update-copy>A new ATS SIM BOX version is ready.</span> <button type="button">UPDATE</button>';
      updateNotice.querySelector('button').addEventListener('click', () => {
        if (hasActiveLocalSession()) {
          setNoticeText('End the active local session or review before updating.');
          return;
        }

        reloadApproved = true;
        setNoticeText('Updating ATS SIM BOX…');
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      });
      document.body.append(updateNotice);
    }
    refreshNoticeVisibility();
    if (!noticeObserver && typeof MutationObserver === 'function') {
      noticeObserver = new MutationObserver(refreshNoticeVisibility);
      noticeObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
    }
  };

  const observeRegistration = registration => {
    if (registration.waiting) offerUpdate(registration);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') offerUpdate(registration);
      });
    });
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadApproved) window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('service-worker.js', { scope: './' });
      observeRegistration(registration);

      let updateCheck;
      const checkForUpdate = () => {
        updateCheck ??= registration.update()
          .catch(() => {})
          .finally(() => { updateCheck = undefined; });
        return updateCheck;
      };

      window.addEventListener('online', checkForUpdate);
      document.addEventListener('visibilitychange', () => {
        refreshNoticeVisibility();
        if (document.visibilityState === 'visible') checkForUpdate();
      });
    } catch {
      // The local suite remains usable online when registration is unavailable.
    }
  });
})();
