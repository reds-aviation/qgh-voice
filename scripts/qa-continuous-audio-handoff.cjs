'use strict';

// Real application, packaged pilot PCM, input graph and output Web Audio.
// The microphone stream is generated silence and recognizer results are scripted.
// This does not record a physical microphone or certify a physical audio route.
const playwright = require(process.env.QGH_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QGH_QA_URL || 'http://127.0.0.1:4280/';
const microphoneDelay = Number(process.env.QGH_QA_MIC_DELAY_MS || 700);
if (!Number.isFinite(microphoneDelay) || microphoneDelay < 500 || microphoneDelay > 3000) {
  throw new Error('QGH_QA_MIC_DELAY_MS must be between 500 and 3000 milliseconds');
}

function installProbe(delayMs) {
  const audit = window.__continuousHandoff = {
    events: [], sources: [], recognizers: [], requests: 0, inputFrames: 0,
    label: 'headphone', injectedStaleResult: false
  };
  const log = (type, details = {}) => audit.events.push({ at: performance.now(), type, ...details });
  const NativeContext = window.AudioContext || window.webkitAudioContext;
  let nextContext = 0;
  const WrappedContext = new Proxy(NativeContext, {
    construct(Target, args) {
      const context = new Target(...args);
      const id = ++nextContext;
      const kind = args[0]?.latencyHint === 'playback' ? 'pilot' : 'input';
      log('context-created', { id, kind });
      const close = context.close.bind(context);
      context.close = () => {
        log('context-close-called', { id, kind });
        return close().then(() => log('context-close-resolved', { id, kind }));
      };
      const create = context.createBufferSource.bind(context);
      context.createBufferSource = () => {
        const source = create();
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        const silent = context.createGain();
        silent.gain.value = 0;
        source.connect(analyser); analyser.connect(silent); silent.connect(context.destination);
        const samples = new Float32Array(analyser.fftSize);
        const record = { label: audit.label, contextId: id, stopped: false, ended: 0, levels: [] };
        let timer;
        const start = source.start.bind(source);
        source.start = (...values) => {
          record.start = performance.now();
          record.startContext = context.currentTime;
          record.duration = source.buffer.duration / source.playbackRate.value;
          record.frames = source.buffer.length;
          record.sampleRate = source.buffer.sampleRate;
          audit.sources.push(record);
          log('pilot-source-start', { id, label: record.label, duration: record.duration });
          timer = setInterval(() => {
            const position = context.currentTime - record.startContext;
            if (context.state !== 'running' || position < 0 || position > record.duration) return;
            analyser.getFloatTimeDomainData(samples);
            let sum = 0;
            for (const value of samples) sum += value * value;
            record.levels.push({ position, rms: Math.sqrt(sum / samples.length) });
          }, 20);
          return start(...values);
        };
        const stop = source.stop.bind(source);
        source.stop = (...values) => {
          record.stopped = true;
          log('pilot-source-stop', { id, label: record.label });
          return stop(...values);
        };
        source.addEventListener('ended', () => {
          record.ended += 1;
          record.end = performance.now();
          record.renderedSeconds = context.currentTime - record.startContext;
          log('pilot-source-ended', { id, label: record.label });
          clearInterval(timer); analyser.disconnect(); silent.disconnect();
        });
        return source;
      };
      return context;
    }
  });
  window.AudioContext = WrappedContext;
  if (window.webkitAudioContext) window.webkitAudioContext = WrappedContext;

  let generator;
  const makeStream = async request => {
    if (!generator) { generator = new NativeContext(); await generator.resume(); }
    const destination = generator.createMediaStreamDestination();
    const oscillator = generator.createOscillator();
    const gain = generator.createGain();
    gain.gain.value = 0;
    oscillator.connect(gain); gain.connect(destination); oscillator.start();
    const track = destination.stream.getAudioTracks()[0];
    const stop = track.stop.bind(track);
    let stopped = false;
    track.stop = () => {
      log('microphone-track-stop', { request });
      stop();
      if (!stopped) { stopped = true; oscillator.stop(); oscillator.disconnect(); gain.disconnect(); }
    };
    log('microphone-stream-granted', { request, readyState: track.readyState });
    return destination.stream;
  };
  // Never invoke the browser's real getUserMedia: this audit cannot record a person.
  navigator.mediaDevices.getUserMedia = async () => {
    const request = ++audit.requests;
    log('microphone-request', { request });
    const delayed = audit.delayNextRequest || request === 2;
    audit.delayNextRequest = false;
    if (delayed) await new Promise(resolve => setTimeout(resolve, delayMs));
    return makeStream(request);
  };

  let offline;
  Object.defineProperty(window, 'QGHOfflineVoiceEngine', {
    configurable: true, get: () => offline,
    set(api) {
      offline = { ...api, hasCachedArchive: async () => true, create(options) {
        const session = api.create(options);
        // Use the actual session's capture, cancellation, graph and close logic.
        // Only decoding speech into text is replaced by deterministic test messages.
        session.model = { KaldiRecognizer: class {
          constructor() { this.events = {}; audit.recognizers.push(this); log('recognizer-created'); }
          on(type, callback) { this.events[type] = callback; }
          acceptWaveform() { audit.inputFrames += 1; }
          retrieveFinalResult() {
            log('recognizer-final-request');
            queueMicrotask(() => this.events.result?.({ result: { text: '' } }));
          }
          remove() { log('recognizer-removed'); }
        } };
        const released = session.whenAudioReleased.bind(session);
        session.whenAudioReleased = () => {
          log('input-release-wait');
          return released().then(() => log('input-release-complete'));
        };
        return session;
      } };
    }
  });

  let pilot;
  Object.defineProperty(window, 'QGHPilotVoiceEngine', {
    configurable: true, get: () => pilot,
    set(api) {
      pilot = { ...api, speak(request) {
        const label = audit.label;
        return api.speak({ ...request,
          onstart(payload) {
            log('pilot-onstart', { label, inputFrames: audit.inputFrames });
            request.onstart?.(payload);
            if (label === 'continuous-reply' && !audit.injectedStaleResult) {
              audit.injectedStaleResult = true;
              // A late recognizer callback must not treat pilot audio as a new command.
              setTimeout(() => {
                log('stale-recognizer-result-injected');
                audit.recognizers[0].events.result?.({ result: { text: 'turn left heading one four zero' } });
              }, 200);
            }
          },
          onend() { log('pilot-onend', { label, inputFrames: audit.inputFrames }); request.onend?.(); },
          onerror(error) { log('pilot-onerror', { label }); request.onerror?.(error); }
        });
      } };
    }
  });
  audit.summary = label => {
    const source = audit.sources.find(item => item.label === label);
    if (!source) return null;
    const thirds = [0, 1, 2].map(part => {
      const levels = source.levels.filter(item => item.position >= source.duration * part / 3
        && item.position < source.duration * (part + 1) / 3);
      return { samples: levels.length, energetic: levels.filter(item => item.rms > 0.005).length,
        maxRms: levels.reduce((max, item) => Math.max(max, item.rms), 0) };
    });
    const { levels, ...metadata } = source;
    return { ...metadata, thirds };
  };
}

(async () => {
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };
  const report = { base, microphoneDelay,
    scope: 'Real Web Audio and packaged pilot PCM; generated silent input; scripted recognizer; no physical microphone or device-route certification' };
  const browser = await playwright.chromium.launch({ channel: process.env.QGH_QA_CHANNEL || 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.addInitScript(installProbe, microphoneDelay);
    await page.goto(new URL('single.html', base).href);
    await page.waitForFunction(() => !!window.QGHHeadphones);
    await page.locator('.voice-settings-toggle').click();
    await page.locator('#pilotAudio').click();
    await page.getByRole('button', { name: /^TEST HEADPHONE AUDIO/ }).click();
    await page.waitForFunction(() => !document.getElementById('headphoneConfirmed').disabled);
    await page.locator('#headphoneConfirmed').check();
    await page.getByRole('button', { name: 'ENABLE PILOT REPLIES', exact: true }).click();
    await page.locator('#startExercise').click();
    await page.locator('.voice-settings-toggle').click();
    await page.locator('.voice-continuous input').first().check();
    await page.waitForFunction(() => __continuousHandoff.recognizers.length === 1 && __continuousHandoff.inputFrames > 0);
    await page.evaluate(() => {
      __continuousHandoff.label = 'continuous-reply';
      __continuousHandoff.events = [];
      __continuousHandoff.recognizers[0].events.result({ result: { text: 'turn right two three zero' } });
    });
    await page.waitForFunction(() => __continuousHandoff.summary('continuous-reply')?.ended === 1);
    report.continuous = await page.evaluate(() => ({
      events: __continuousHandoff.events,
      audio: __continuousHandoff.summary('continuous-reply'),
      heading: document.getElementById('headingInput').value,
      requests: __continuousHandoff.requests,
      sources: __continuousHandoff.sources.filter(item => item.label === 'continuous-reply').length
    }));
    const continuous = report.continuous;
    const source = continuous.audio;
    check(continuous.requests === 1, 'Continuous listening reopened input before the queued reply finished');
    const lateGrants = continuous.events.filter(event => event.type === 'microphone-stream-granted'
      && event.at > source.start && event.at < source.end);
    check(lateGrants.length === 0, 'A microphone stream arrived after pilot playback started');
    for (const event of continuous.events.filter(event => event.type === 'microphone-request' && event.at < source.start)) {
      const stopped = continuous.events.find(candidate => candidate.type === 'microphone-track-stop' && candidate.request === event.request);
      check(Boolean(stopped && stopped.at <= source.start), 'A pending input stream was not stopped before pilot playback');
    }
    const speechStart = continuous.events.find(event => event.type === 'pilot-onstart');
    const speechEnd = continuous.events.find(event => event.type === 'pilot-onend');
    check(speechStart?.inputFrames === speechEnd?.inputFrames, 'Input processing continued during pilot playback');
    check(continuous.heading === '230' && continuous.sources === 1, 'A stale recognizer result changed or repeated the command');
    check(!continuous.events.some(event => event.type === 'pilot-onerror'), 'Continuous reply reported an audio error');

    // The normal reply must suppress rearming. Exercise the separate release
    // barrier with a manual command while a new capture is already opening.
    await page.locator('.voice-continuous input').first().uncheck();
    const expectedRequest = await page.evaluate(() => {
      __continuousHandoff.label = 'manual-during-pending-input';
      __continuousHandoff.events = [];
      __continuousHandoff.delayNextRequest = true;
      return __continuousHandoff.requests + 1;
    });
    await page.locator('.voice-continuous input').first().check();
    await page.waitForFunction(request => __continuousHandoff.events.some(event =>
      event.type === 'microphone-request' && event.request === request), expectedRequest);
    await page.locator('.voice-settings-toggle').click();
    await page.locator('#requestHeading').click();
    await page.waitForFunction(() => __continuousHandoff.summary('manual-during-pending-input')?.ended === 1);
    report.pendingManual = await page.evaluate(() => ({
      events: __continuousHandoff.events,
      audio: __continuousHandoff.summary('manual-during-pending-input')
    }));
    const pending = report.pendingManual;
    const pendingGrant = pending.events.find(event => event.type === 'microphone-stream-granted' && event.request === expectedRequest);
    const pendingStop = pending.events.find(event => event.type === 'microphone-track-stop' && event.request === expectedRequest);
    const pendingWait = pending.events.find(event => event.type === 'input-release-wait');
    const pendingReleased = pending.events.find(event => event.type === 'input-release-complete');
    check(Boolean(pendingWait && pendingGrant && pendingStop && pendingReleased), 'Manual scenario did not exercise a pending microphone acquisition');
    check(Boolean(pendingWait && pendingGrant && pendingWait.at < pendingGrant.at), 'Manual scenario did not wait while microphone acquisition was pending');
    check(Boolean(pendingStop && pendingReleased && pendingStop.at <= pendingReleased.at
      && pendingReleased.at <= pending.audio.start), 'Manual pilot playback started before the late stream stopped');
    const pendingStart = pending.events.find(event => event.type === 'pilot-onstart');
    const pendingEnd = pending.events.find(event => event.type === 'pilot-onend');
    check(pendingStart?.inputFrames === pendingEnd?.inputFrames, 'Input processing continued during the manual reply');
    check(!pending.events.some(event => event.type === 'recognizer-created'), 'Cancelled pending input still created a recognizer graph');
    check(!pending.events.some(event => event.type === 'microphone-stream-granted'
      && event.at > pending.audio.start && event.at < pending.audio.end), 'A microphone stream arrived during the manual reply');

    // Stop automatic listening before its audio tail; PTT remains explicit.
    await page.locator('.voice-settings-toggle').click();
    await page.locator('.voice-continuous input').first().uncheck();
    await page.locator('.voice-settings-toggle').click();
    await page.evaluate(() => { __continuousHandoff.label = 'manual-before-ptt'; });
    await page.locator('#requestHeading').click();
    await page.waitForFunction(() => __continuousHandoff.summary('manual-before-ptt')?.start);
    const mic = page.locator('.voice-mic');
    const box = await mic.boundingBox();
    if (!box) throw new Error('PTT control is not visible');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForFunction(() => __continuousHandoff.summary('manual-before-ptt')?.stopped
      && document.querySelector('.voice-mic').getAttribute('aria-pressed') === 'true');
    await page.waitForFunction(() => document.querySelector('.voice-status').textContent === 'LISTENING');
    await page.evaluate(() => {
      __continuousHandoff.recognizers.at(-1).events.result({ result: { text: 'report heading' } });
      __continuousHandoff.label = 'ptt-replacement';
    });
    await page.mouse.up();
    await page.waitForFunction(() => __continuousHandoff.summary('ptt-replacement')?.ended === 1);
    report.ptt = await page.evaluate(() => ({
      interrupted: __continuousHandoff.summary('manual-before-ptt'),
      replacement: __continuousHandoff.summary('ptt-replacement'),
      replacementSources: __continuousHandoff.sources.filter(item => item.label === 'ptt-replacement').length,
      interruptedCompletionCallbacks: __continuousHandoff.events.filter(event => event.type === 'pilot-onend' && event.label === 'manual-before-ptt').length,
      radio: QGHRadioWorkspace.status()
    }));
    check(report.ptt.interrupted.stopped, 'PTT did not interrupt the existing source');
    check(report.ptt.interruptedCompletionCallbacks === 0, 'Cancelled pilot speech delivered a stale completion callback');
    check(report.ptt.replacementSources === 1, 'PTT replacement was not played exactly once');
    for (const [label, audio] of [['continuous', source], ['manual pending-input reply', pending.audio], ['PTT replacement', report.ptt.replacement]]) {
      check(audio.ended === 1 && !audio.stopped, `${label}: playback ended unnaturally`);
      check(audio.frames > 24000 && audio.sampleRate === 24000, `${label}: packaged PCM was not used`);
      check(Math.abs(audio.renderedSeconds - audio.duration) < 0.25, `${label}: incomplete audio duration`);
      check(audio.thirds.every(part => part.energetic >= 3 && part.maxRms > 0.015), `${label}: missing signal in beginning, middle or ending`);
    }
    check(pageErrors.length === 0, `Browser errors: ${pageErrors.join('; ')}`);
    for (const flow of [continuous, pending]) {
      const origin = flow.events[0]?.at || 0;
      flow.events = flow.events.map(event => ({ ...event, at: Math.round((event.at - origin) * 10) / 10 }));
    }
    report.failures = failures;
    report.result = failures.length ? 'FAIL' : 'PASS';
    if (failures.length) process.exitCode = 1;
  } catch (error) {
    report.result = 'ERROR';
    report.error = error.stack || String(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
    console.log(JSON.stringify(report, null, 2));
  }
})();
