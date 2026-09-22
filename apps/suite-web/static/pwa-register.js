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

  const hasActiveLocalSession = () => Boolean(document.querySelector(ACTIVE_SESSION_SELECTOR));

  const setNoticeText = text => {
    const copy = updateNotice?.querySelector('[data-update-copy]');
    if (copy) copy.textContent = text;
  };

  const offerUpdate = registration => {
    if (!registration.waiting || !navigator.serviceWorker.controller) return;

    if (!updateNotice) {
      updateNotice = document.createElement('section');
      updateNotice.className = 'pwa-update-notice';
      updateNotice.setAttribute('role', 'status');
      updateNotice.setAttribute('aria-live', 'polite');
      updateNotice.innerHTML = '<span data-update-copy>A new ATC Suite version is ready.</span> <button type="button">UPDATE</button>';
      updateNotice.querySelector('button').addEventListener('click', () => {
        if (hasActiveLocalSession()) {
          setNoticeText('End the active local session or review before updating.');
          return;
        }

        reloadApproved = true;
        setNoticeText('Updating Reds ATC Training Suite…');
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      });
      document.body.append(updateNotice);
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
        if (document.visibilityState === 'visible') checkForUpdate();
      });
    } catch {
      // The local suite remains usable online when registration is unavailable.
    }
  });
})();
