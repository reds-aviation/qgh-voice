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
