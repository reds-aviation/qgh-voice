/* ATS SIM BOX · Copyright 2026 Balaram Reddy. Common Public Attribution License 1.0. */
(function exposeControllerVoice(root) {
  'use strict';

  function mount(container, options) {
    if (!container || typeof options?.context !== 'function' || typeof options.send !== 'function') return null;
    const doc = container.ownerDocument;
    const events = new AbortController();
    const api = root.QGHOfflineVoiceEngine;
    const supported = Boolean(api?.supportsOfflineVoice());
    let ready = false, preparing = false, checkedCache = false, destroyed = false;
    let capture = null, pending = null, ackTimer = null, lastContextKey = null;
    let enabled = false, running = false, mode = '';
    const node = (tag, className, text) => {
      const element = doc.createElement(tag);
      element.className = className;
      element.textContent = text;
      container.append(element);
      return element;
    };
    container.classList.add('suite-controller-voice');
    const label = node('strong', 'scv-label', 'Controller voice');
    const setup = node('button', 'scv-setup', 'Set up offline voice · 45 MB');
    const talk = node('button', 'scv-talk', 'Hold to talk');
    setup.type = talk.type = 'button';
    talk.setAttribute('aria-pressed', 'false');
    talk.title = 'Hold the button or hold Space or Enter, speak your callsign and instruction, then release.';
    const status = node('span', 'scv-status', '');
    status.setAttribute('role', 'status');
    const heard = node('small', 'scv-heard', '');
    heard.hidden = true;
    const engine = supported ? api.create({ onEnded: finish }) : null;

    function say(text) {
      if (status.textContent !== text) status.textContent = text;
    }
    function controls() {
      setup.hidden = !supported || ready;
      setup.disabled = !enabled || preparing;
      talk.hidden = !ready;
      // Keep the button focusable while the press is completing.
      talk.disabled = !enabled || !running || !ready;
      talk.setAttribute('aria-pressed', String(Boolean(capture && !capture.released)));
    }
    function idle() {
      if (!supported) return 'Microphone recognition is unavailable on this browser.';
      if (!enabled) return 'Voice calls are unavailable for this position.';
      if (preparing) return 'Preparing on-device speech…';
      if (!ready) return 'Set up once on this device.';
      if (!running) return 'Ready when the exercise is running.';
      return mode === 'automatic' ? 'Automatic pilot · say the callsign first.' : 'Instructor receives your calls.';
    }
    async function prepare() {
      if (!engine || destroyed || preparing || ready || !enabled) return;
      preparing = true; controls(); say(idle());
      try {
        await engine.prepare();
        if (destroyed) { engine.model?.terminate?.(); return; }
        ready = true; preparing = false; controls(); say(idle());
      } catch {
        if (!destroyed) { preparing = false; controls(); say('Voice setup failed. Check the connection and try again.'); }
      }
    }
    function checkCache() {
      if (!engine || checkedCache || !enabled) return;
      checkedCache = true;
      api.hasCachedArchive().then(cached => { if (cached && !destroyed && enabled) prepare(); })
        .catch(() => {});
    }
    function clearPending() {
      clearTimeout(ackTimer); ackTimer = null; pending = null;
    }
    function clearCapture() {
      if (!capture) return;
      clearTimeout(capture.timer);
      capture = null;
      engine?.cancel();
      controls();
    }
    function reset() {
      clearCapture(); clearPending();
      heard.hidden = true; heard.textContent = '';
      settleContext(); controls(); say(idle());
    }
    function settleContext() {
      const state = options.context() || {};
      enabled = state.enabled === true;
      running = state.running === true;
      mode = state.mode === 'automatic' ? 'automatic' : 'human';
      return [state.key || '', state.exerciseId || '', state.runKey || '', enabled, running, mode].join('|');
    }
    function refresh() {
      if (destroyed) return;
      const contextKey = settleContext();
      if (contextKey !== lastContextKey) {
        lastContextKey = contextKey;
        reset();
      }
      controls(); checkCache();
    }
    async function finish(details = {}) {
      const call = capture;
      if (!call) return;
      clearTimeout(call.timer);
      capture = null; controls();
      if (!call.released || !details.finalDrained || call.invalid || call.key !== settleContext() || !enabled || !running) {
        say('Call interrupted or unclear. Repeat the whole call.'); return;
      }
      const transcript = call.segments.join(' ').trim();
      if (!transcript || transcript.length > 240 || transcript.includes('[unk]')) {
        say('Call unclear. Repeat the callsign and instruction.'); return;
      }
      const requestId = root.crypto.randomUUID();
      const interpretation = root.ATSRadioIntent?.classify(transcript);
      heard.textContent = 'Heard: ' + transcript + (interpretation ? ' · Likely request: ' + interpretation.label : '');
      heard.hidden = false;
      clearPending(); pending = requestId;
      try {
        let modelIntent;
        const context = options.context() || {};
        if (mode === 'automatic' && root.atsRadioPilot && context.allowModelHint !== false
          && /\b(?:what|how|report|say|confirm|distance|range|bearing|transmit|standby|stand by|could you|give me|tell me)\b/i.test(transcript)
          && !root.ATSControllerVoice?.interpretRequest?.(transcript, context.callsigns)) {
          say('Interpreting your call on this PC…');
          try { modelIntent = (await root.atsRadioPilot.understand(transcript))?.intent; } catch { /* Exact calls still work. */ }
          if (destroyed || pending !== requestId || call.key !== settleContext() || !enabled || !running) return;
        }
        say('Waiting for instructor confirmation…');
        ackTimer = setTimeout(() => {
          clearPending(); say('No confirmation received. Check with the instructor.');
        }, 10000);
        if (await options.send({ requestId, transcript, ...(modelIntent ? { modelIntent } : {}) }) !== true) throw new Error('not sent');
      } catch {
        if (pending === requestId) { clearPending(); say('Call could not be sent. Check the session connection.'); }
      }
    }
    function acknowledge(result) {
      if (!pending || result?.requestId !== pending) return false;
      clearPending(); say(String(result.text || result.message || 'Instructor received your call.'));
      return true;
    }
    function start(input) {
      refresh();
      if (capture || destroyed || !enabled || !running || !ready) return;
      if (pending) { say('Waiting for instructor confirmation…'); return; }
      const call = { input, key: lastContextKey, segments: [], started: false, released: false, invalid: false };
      options.onPress?.();
      capture = call; heard.hidden = true;
      call.timer = setTimeout(() => {
        if (capture !== call) return;
        clearCapture(); say('Call timed out. Release and repeat one short call.');
      }, 20000);
      controls(); say('Opening microphone…');
      // Use full utterance recognition. A command-only grammar can turn a question
      // or condition into an executable fragment by dropping unfamiliar words.
      engine.start({
        onStarted() { if (capture === call) { call.started = true; say('Listening… release after the complete call.'); } },
        onResult(text) {
          if (capture !== call || !text) return;
          if (call.segments.length >= 20) call.invalid = true;
          else call.segments.push(text.trim());
        },
        onUnrecognizedSegment() { if (capture === call) call.invalid = true; },
        onError(reason) {
          if (capture !== call) return;
          clearCapture();
          say(reason === 'not-allowed' ? 'Allow microphone access in browser settings, then try again.' : 'Microphone unavailable. Try again.');
        }
      }).catch(() => {
        if (capture === call) { clearCapture(); say('Microphone unavailable. Check permission and try again.'); }
      });
    }
    function release(input) {
      if (!capture || capture.input !== input || capture.released) return;
      if (!capture.started) { clearCapture(); say('Microphone was still opening. Hold again and wait for Listening.'); return; }
      capture.released = true; controls(); say('Recognising your call…'); engine.stop();
    }
    function interrupt() {
      if (capture) { clearCapture(); say('Call cancelled.'); }
    }
    function on(target, type, handler) {
      target.addEventListener(type, handler, { signal: events.signal });
    }
    on(setup, 'click', prepare);
    on(talk, 'pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault(); talk.focus({ preventScroll: true }); talk.setPointerCapture(event.pointerId); start(event.pointerId);
    });
    on(talk, 'pointerup', event => release(event.pointerId));
    on(talk, 'pointercancel', interrupt);
    on(talk, 'lostpointercapture', event => {
      if (capture?.input === event.pointerId && !capture.released) interrupt();
    });
    on(talk, 'keydown', event => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault(); event.stopPropagation();
      if (!event.repeat) start(event.key);
    });
    on(talk, 'keyup', event => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault(); event.stopPropagation(); release(event.key);
    });
    // Screen readers can activate buttons without generating pointer/key events.
    on(talk, 'click', event => {
      if (event.detail !== 0) return;
      if (capture?.input === 'assistive') release('assistive'); else if (!capture) start('assistive');
    });
    on(talk, 'blur', interrupt);
    on(root, 'blur', interrupt);
    on(root, 'pagehide', reset);
    on(doc, 'visibilitychange', () => { if (doc.hidden) interrupt(); });
    refresh();
    return { refresh, reset, acknowledge, isCapturing: () => Boolean(capture), destroy() {
      if (destroyed) return;
      destroyed = true; reset(); events.abort();
      engine?.model?.terminate?.();
      for (const element of [label, setup, talk, status, heard]) element.remove();
    } };
  }
  root.SuiteControllerVoice = { mount };
})(typeof globalThis !== 'undefined' ? globalThis : window);
