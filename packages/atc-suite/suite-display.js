(function exposeAtcSuiteDisplay(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ATCSuiteDisplay = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function createDisplayModule(root) {
  'use strict';

  const STUDENT_WINDOW_NAME = 'reds-atc-student-display';
  const DEFAULT_WINDOW_FEATURES = Object.freeze({ width: 1280, height: 800, left: 48, top: 48 });

  // Middle click is a Stop control, including empty scope beside a selected
  // aircraft. Its own release path never enters single/double-click radio RT.
  function bindMiddleMouseStop(element, { isAllowed = () => false, getTargetId = () => null,
    onReset = () => {}, onStop = () => {} } = {}) {
    if (!element?.addEventListener) return null;
    let pressed = null;
    const preventDefault = event => { if (event.button === 1) event.preventDefault(); };
    function cancel(event) {
      if (event && pressed && event.pointerId !== pressed.pointerId) return;
      const pointerId = pressed?.pointerId; pressed = null;
      if (pointerId != null && element.hasPointerCapture?.(pointerId)) element.releasePointerCapture?.(pointerId);
    }
    function down(event) {
      if (event.button !== 1) return;
      event.preventDefault(); cancel();
      if (event.isPrimary === false || event.pointerType && event.pointerType !== 'mouse' || !isAllowed()) return;
      onReset();
      const id = getTargetId(event);
      if (!id || !isAllowed(id)) return;
      pressed = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      if (event.pointerId != null) element.setPointerCapture?.(event.pointerId);
    }
    function move(event) {
      if (pressed && pressed.pointerId === event.pointerId
        && Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 5) cancel();
    }
    function up(event) {
      if (event.button !== 1) return;
      event.preventDefault();
      if (!pressed || pressed.pointerId !== event.pointerId) return;
      const action = pressed; cancel();
      if (isAllowed(action.id) && Math.hypot(event.clientX - action.x, event.clientY - action.y) <= 5) onStop(action.id);
    }
    const listeners = { pointerdown: down, pointermove: move, pointerup: up,
      pointercancel: cancel, lostpointercapture: cancel, mousedown: preventDefault, auxclick: preventDefault };
    for (const [type, listener] of Object.entries(listeners)) element.addEventListener(type, listener);
    return Object.freeze({ cancel, close() { cancel(); for (const [type, listener] of Object.entries(listeners)) element.removeEventListener?.(type, listener); } });
  }

  function finite(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function screenBounds(screen, fallback = DEFAULT_WINDOW_FEATURES) {
    if (!screen) return { ...fallback };
    return {
      left: finite(screen.availLeft, finite(screen.left, fallback.left)),
      top: finite(screen.availTop, finite(screen.top, fallback.top)),
      width: Math.max(640, finite(screen.availWidth, finite(screen.width, fallback.width))),
      height: Math.max(560, finite(screen.availHeight, finite(screen.height, fallback.height)))
    };
  }

  function windowFeatures(bounds = DEFAULT_WINDOW_FEATURES) {
    const safe = screenBounds(bounds);
    return `popup=yes,resizable=yes,scrollbars=yes,left=${Math.round(safe.left)},top=${Math.round(safe.top)},width=${Math.round(safe.width)},height=${Math.round(safe.height)}`;
  }

  function sameScreen(first, second) {
    if (!first || !second) return false;
    const a = screenBounds(first);
    const b = screenBounds(second);
    return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
  }

  function chooseExternalScreen(details) {
    const screens = Array.isArray(details?.screens) ? details.screens : [];
    if (!screens.length) return null;
    const current = details.currentScreen || screens.find(screen => screen.isPrimary) || screens[0];
    return screens.find(screen => !sameScreen(screen, current)) || null;
  }

  function openStudentWindow(options = {}) {
    const openWindow = options.openWindow || (typeof root.open === 'function' ? root.open.bind(root) : null);
    if (!openWindow) return { ok: false, reason: 'unsupported', window: null };
    const child = openWindow(
      '',
      options.name || STUDENT_WINDOW_NAME,
      windowFeatures(options.bounds)
    );
    if (!child) return { ok: false, reason: 'popup-blocked', window: null };
    try {
      child.opener = null;
      if (child.opener !== null) throw new Error('Unable to isolate student display');
      if (typeof child.location?.replace === 'function') child.location.replace(options.url || 'student.html');
      else child.location = options.url || 'student.html';
    } catch (_) {
      try { child.close(); } catch (_) { /* The browser may already have closed it. */ }
      return { ok: false, reason: 'isolation-failed', window: null };
    }
    try { child.focus(); } catch (_) { /* A browser may refuse programmatic focus. */ }
    return { ok: true, reason: 'opened', window: child };
  }

  function placeWindowOnScreen(child, screen) {
    if (!child || child.closed || !screen) return false;
    const bounds = screenBounds(screen);
    try {
      child.moveTo(bounds.left, bounds.top);
      child.resizeTo(bounds.width, bounds.height);
      child.focus();
      return true;
    } catch (_) {
      return false;
    }
  }

  async function placeOnExternalScreen(child, options = {}) {
    if (!child || child.closed) return { ok: false, reason: 'window-closed', placedExternal: false };
    const getScreenDetails = options.getScreenDetails
      || (typeof root.getScreenDetails === 'function' ? root.getScreenDetails.bind(root) : null);
    if (!getScreenDetails) {
      return { ok: true, reason: 'manual-placement', placedExternal: false, screenCount: 1 };
    }
    try {
      const details = await getScreenDetails();
      const screenCount = Array.isArray(details?.screens) ? details.screens.length : 0;
      const target = chooseExternalScreen(details);
      if (!target) return { ok: true, reason: 'single-display', placedExternal: false, screenCount };
      const placed = placeWindowOnScreen(child, target);
      return {
        ok: true,
        reason: placed ? 'external-display' : 'manual-placement',
        placedExternal: placed,
        screenCount,
        label: typeof target.label === 'string' ? target.label.trim() : ''
      };
    } catch (error) {
      const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
      return { ok: true, reason: denied ? 'permission-needed' : 'manual-placement', placedExternal: false, screenCount: 0 };
    }
  }

  return Object.freeze({
    STUDENT_WINDOW_NAME,
    bindMiddleMouseStop,
    chooseExternalScreen,
    openStudentWindow,
    placeOnExternalScreen,
    placeWindowOnScreen,
    screenBounds,
    sameScreen,
    windowFeatures
  });
});
