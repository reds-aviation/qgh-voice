/* ATS SIM BOX. Copyright (c) 2026 Balaram Reddy. CPAL-1.0. See LICENSE. */
(() => {
  'use strict';
  const key = 'ats-simbox-appearance';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const parse = value => value === 'dark' || value === 'light' ? value : 'system';
  let preference = 'system';
  try { preference = parse(localStorage.getItem(key)); } catch { /* Private browsing may limit storage. */ }
  let toggle;
  let themeFrame = 0;
  function apply() {
    const theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    const root = document.documentElement;
    const changed = root.dataset.theme !== theme;
    if (changed && root.dataset.theme) {
      // Paint the new ink and surface together before restoring normal hover transitions.
      root.setAttribute('data-theme-switching', '');
      window.cancelAnimationFrame(themeFrame);
      themeFrame = window.requestAnimationFrame(() => {
        themeFrame = window.requestAnimationFrame(() => root.removeAttribute('data-theme-switching'));
      });
    }
    root.dataset.theme = theme;
    if (changed) window.dispatchEvent(new CustomEvent('ats-appearance-change', { detail: theme }));
    if (toggle) toggle.checked = theme === 'dark';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#172b3a' : '#64b4e6');
  }
  apply();
  system.addEventListener('change', () => { if (preference === 'system') apply(); });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = parse(event.newValue);
    apply();
  });

  function install() {
    if (document.querySelector('meta[http-equiv="refresh" i]')) return;
    const control = document.createElement('label');
    control.className = 'sim-appearance';
    const label = document.createElement('span');
    label.className = 'sim-switch-label';
    label.textContent = 'Dark mode';
    toggle = document.createElement('input');
    toggle.type = 'checkbox';
    control.title = 'Dark mode';
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-label', 'Dark mode');
    const track = document.createElement('span');
    track.className = 'sim-switch-track';
    track.setAttribute('aria-hidden', 'true');
    control.append(label, toggle, track);
    toggle.addEventListener('change', () => {
      preference = toggle.checked ? 'dark' : 'light';
      try {
        localStorage.setItem(key, preference);
      } catch { /* The selected mode still applies in this window. */ }
      apply();
    });
    apply();

    // Keep one control in the visible page chrome as the desk changes phase.
    const locations = [
      'body.desk-open #desk .exercisebar .clockblock', '#activeWorkspace:not([hidden]) .console-toolbar',
      '#studentWorkspace:not([hidden]) .student-head', '#reviewScreen:not([hidden]) .workspace-head',
      '.suite-header-left', '.iaf-site-header nav', '.iaf-site-header', '.site-header',
      '#setupPanel:not([hidden])', '#joinPanel:not([hidden])', '#waitingPanel:not([hidden])',
      '#readyPanel:not([hidden])', '#studentEnded:not([hidden])'
    ];
    function mount() {
      const target = locations.map(selector => document.querySelector(selector)).find(node =>
        node && !node.closest('[hidden],details:not([open])') && node.getClientRects().length
      );
      if (!target || control.parentElement === target) return;
      if (target.matches('section')) target.prepend(control);
      else target.insertBefore(control, target.querySelector(':scope > .iaf-header-credit'));
    }
    mount();
    const observer = new MutationObserver(mount);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    for (const node of document.querySelectorAll('#activeWorkspace,#studentWorkspace,#reviewScreen,#desk,#joinPanel,#waitingPanel,#readyPanel,#studentEnded,#setupPanel,#consoleNavigation,#studentNavigation')) {
      observer.observe(node, { attributes: true, attributeFilter: ['open', 'hidden'] });
    }
    window.addEventListener('pageshow', mount);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
