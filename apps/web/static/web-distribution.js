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

  if (!window.QGH_WEB_ENVIRONMENT?.isHostedBrowser()) return;

  const distribution = document.getElementById('webDistribution');
  const installButton = document.getElementById('installWebApp');
  const nativeDownloads = document.getElementById('nativeDownloads');
  const releaseAvailability = document.getElementById('releaseAvailability');
  const sheet = document.getElementById('pwaInstallSheet');
  const sheetContent = document.getElementById('pwaInstallContent');
  const closeSheet = document.getElementById('closeInstallSheet');
  if (!installButton || !sheet || !sheetContent || !closeSheet) return;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (isStandalone) return;

  const installLabel = installButton.textContent;
  const supportsWebInstall = typeof navigator.install === 'function';
  let deferredInstallPrompt;
  let installInProgress = false;
  let lastFocusedElement;
  const hasNativePrompt = () => supportsWebInstall || Boolean(deferredInstallPrompt);
  const updateInstallLabel = () => {
    installButton.textContent = hasNativePrompt() ? installLabel : 'Install help';
  };
  updateInstallLabel();
  installButton.hidden = false;
  if (distribution) distribution.hidden = false;

  const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const releaseUrl = value => {
    if (typeof value !== 'string' || value.trim() === '') return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : null;
    } catch {
      return null;
    }
  };

  const configureDownload = (id, value) => {
    const link = document.getElementById(id);
    const href = releaseUrl(value);
    if (!link || !href) return false;
    link.href = href;
    link.hidden = false;
    return true;
  };

  const releases = window.QGH_RELEASES || {};
  const hasWindows = configureDownload('downloadWindows', releases.windows);
  const hasAndroid = configureDownload('downloadAndroid', releases.android);
  if (nativeDownloads) nativeDownloads.hidden = !hasWindows && !hasAndroid;
  if (releaseAvailability) releaseAvailability.hidden = hasWindows || hasAndroid;

  const showSheet = paragraphs => {
    sheetContent.replaceChildren(...paragraphs.map(text => {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      return paragraph;
    }));
    lastFocusedElement = document.activeElement;
    if (!sheet.open) sheet.showModal();
    closeSheet.focus();
  };

  const hideSheet = () => {
    if (sheet.open) sheet.close();
  };

  closeSheet.addEventListener('click', hideSheet);
  sheet.addEventListener('click', event => {
    if (event.target === sheet) hideSheet();
  });
  sheet.addEventListener('close', () => {
    const focusTarget = lastFocusedElement instanceof HTMLElement ? lastFocusedElement : installButton;
    focusTarget.focus();
  });

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallLabel();
    // A first visit can become installable while the help dialog is open.
    // Return focus to Install so the browser can prompt on the next click.
    if (!installInProgress) hideSheet();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = undefined;
    installButton.hidden = true;
  });

  installButton.addEventListener('click', async () => {
    if (installInProgress) return;
    if (hasNativePrompt()) {
      const prompt = deferredInstallPrompt;
      deferredInstallPrompt = undefined;
      const setInstallBusy = busy => {
        installInProgress = busy;
        if (busy) installButton.setAttribute('aria-disabled', 'true');
        else installButton.removeAttribute('aria-disabled');
      };
      setInstallBusy(true);
      try {
        if (supportsWebInstall) {
          await navigator.install();
          installButton.hidden = true;
        } else {
          await prompt.prompt();
          if ((await prompt.userChoice).outcome === 'accepted') installButton.hidden = true;
        }
      } catch (error) {
        if (error.name !== 'AbortError') showSheet(['Open this page in your regular browser and use its Install app or Add to Home screen option.']);
      } finally {
        setInstallBusy(false);
        updateInstallLabel();
      }
      return;
    }

    if (appleMobile) {
      showSheet([
        'In Safari, tap Share.',
        'Choose Add to Home Screen, enable Open as Web App if shown, then tap Add.',
      ]);
      return;
    }

    showSheet(['Use your browser menu and choose Install app or Add to Home screen.']);
  });
})();
