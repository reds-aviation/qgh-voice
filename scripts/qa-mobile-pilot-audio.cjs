'use strict';

// Real packaged worker, PCM and Web Audio in phone-sized desktop browsers.
// The analyser is a diagnostic tap, not a replacement audio implementation.
// This does not certify physical phones, microphones, headphones or intelligibility.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const playwright = require(process.env.QGH_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QGH_QA_URL || 'http://127.0.0.1:4280/';
const output = path.resolve('artifacts/mobile-pilot-audio/report.json');

function installAudioProbe() {
  const NativeContext = window.AudioContext || window.webkitAudioContext;
  const probe = window.__pilotAudioProbe = { contexts: [], sources: [], label: 'headphone-check' };
  function instrument(context) {
    probe.contexts.push(context);
    const create = context.createBufferSource.bind(context);
    context.createBufferSource = function () {
      const source = create();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      const silent = context.createGain();
      silent.gain.value = 0;
      source.connect(analyser);
      analyser.connect(silent);
      silent.connect(context.destination);
      const samples = new Float32Array(analyser.fftSize);
      const record = { label: probe.label, levels: [], states: [], ended: 0, stopped: false };
      let timer;
      let previousTime = -1;
      const stateChange = () => record.states.push({ state: context.state, at: performance.now() });
      const start = source.start.bind(source);
      source.start = function (...args) {
        record.startContext = Math.max(context.currentTime, Number(args[0]) || 0);
        record.startWall = performance.now();
        record.rate = source.playbackRate.value;
        record.bufferSeconds = source.buffer.duration;
        record.duration = source.buffer.duration / record.rate;
        record.frames = source.buffer.length;
        record.sampleRate = source.buffer.sampleRate;
        const pcm = source.buffer.getChannelData(0);
        const leadFrames = Math.ceil(0.24 * record.sampleRate * record.rate);
        record.leadSeconds = leadFrames / record.sampleRate / record.rate;
        record.silentLead = pcm.subarray(0, leadFrames).every(sample => sample === 0);
        record.speechPeak = pcm.subarray(leadFrames, Math.min(pcm.length, leadFrames + record.sampleRate))
          .reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0);
        record.contextIndex = probe.contexts.indexOf(context);
        probe.sources.push(record);
        context.addEventListener('statechange', stateChange);
        stateChange();
        timer = setInterval(() => {
          const position = context.currentTime - record.startContext;
          if (context.state !== 'running' || position <= previousTime || position < 0 || position > record.duration) return;
          previousTime = position;
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (const value of samples) sum += value * value;
          record.levels.push({ position, rms: Math.sqrt(sum / samples.length) });
        }, 20);
        return start(...args);
      };
      const stop = source.stop.bind(source);
      source.stop = function (...args) { record.stopped = true; return stop(...args); };
      source.addEventListener('ended', () => {
        record.ended += 1;
        record.endContext = context.currentTime;
        record.endWall = performance.now();
        clearInterval(timer);
        context.removeEventListener('statechange', stateChange);
        analyser.disconnect();
        silent.disconnect();
      });
      return source;
    };
    return context;
  }
  if (NativeContext) {
    const Wrapped = new Proxy(NativeContext, { construct(Target, args) { return instrument(new Target(...args)); } });
    window.AudioContext = Wrapped;
    if (window.webkitAudioContext) window.webkitAudioContext = Wrapped;
  }
  probe.summary = label => {
    const source = probe.sources.filter(item => item.label === label).at(-1);
    if (!source) return null;
    const thirds = [0, 1, 2].map(part => {
      const levels = source.levels.filter(item => item.position >= source.duration * part / 3
        && item.position < source.duration * (part + 1) / 3);
      return { samples: levels.length, energetic: levels.filter(item => item.rms > 0.005).length,
        maxRms: levels.reduce((max, item) => Math.max(max, item.rms), 0) };
    });
    const { levels, ...metadata } = source;
    return { ...metadata, thirds, renderedSeconds: source.endContext - source.startContext,
      elapsedSeconds: (source.endWall - source.startWall) / 1000 };
  };
}

function assertCompleteSignal(signal, label) {
  assert.ok(signal, `${label}: a real buffer source started`);
  assert.equal(signal.ended, 1, `${label}: source ended exactly once`);
  assert.ok(signal.frames > 24000, `${label}: real speech PCM`);
  assert.equal(signal.sampleRate, 24000, `${label}: packaged bank sample rate`);
  assert.ok(signal.leadSeconds >= 0.24 && signal.leadSeconds < 0.241 && signal.silentLead,
    `${label}: silent output-route lead precedes speech`);
  assert.ok(signal.speechPeak > 0.015, `${label}: speech follows the route lead`);
  assert.ok(Math.abs(signal.renderedSeconds - signal.duration) < 0.25,
    `${label}: full source rendered (${signal.renderedSeconds}/${signal.duration}s)`);
  for (const [part, section] of signal.thirds.entries()) {
    assert.ok(section.samples >= 3 && section.energetic >= 3 && section.maxRms > 0.015,
      `${label}: audible signal in ${['beginning', 'middle', 'tail'][part]}: ${JSON.stringify(section)}`);
  }
}

async function checkFlow(browser, browserName, viewport) {
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  const remoteRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (new URL(request.url()).origin !== new URL(base).origin) remoteRequests.push(request.url());
  });
  try {
    await page.addInitScript(installAudioProbe);
    await page.goto(new URL('single.html', base).href);
    await page.waitForFunction(() => !!window.QGHHeadphones);
    await page.locator('.voice-settings-toggle').click();
    await page.locator('#pilotAudio').click();
    await page.getByRole('button', { name: /^TEST HEADPHONE AUDIO/ }).click();
    await page.waitForFunction(() => !document.getElementById('headphoneConfirmed').disabled, null, { timeout: 30000 });
    await page.locator('#headphoneConfirmed').check();
    await page.getByRole('button', { name: 'ENABLE PILOT REPLIES', exact: true }).click();
    const headphone = await page.evaluate(() => __pilotAudioProbe.summary('headphone-check'));
    assertCompleteSignal(headphone, 'headphone check');
    await page.locator('#startExercise').click();
    const accepted = await page.evaluate(() => {
      __pilotAudioProbe.label = 'exercise-readback';
      return QGHVoiceWorkspace.dispatchTranscript('turn right two three zero');
    });
    assert.equal(accepted.ok, true, 'exercise command accepted');
    assert.equal(await page.locator('#headingInput').inputValue(), '230');
    await page.waitForFunction(() => __pilotAudioProbe.summary('exercise-readback')?.ended === 1);
    const exercise = await page.evaluate(() => __pilotAudioProbe.summary('exercise-readback'));
    assertCompleteSignal(exercise, 'exercise readback');
    await page.waitForFunction(() => QGHRadioAdapter.observation().phase !== 'live');

    const suspended = await page.evaluate(async () => {
      const label = 'suspend-resume';
      __pilotAudioProbe.label = label;
      const events = { starts: 0, ends: 0, pauses: 0, resumes: 0, errors: [] };
      let suspension;
      await new Promise((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error('Suspended readback did not complete')), 15000);
        QGHPilotVoiceEngine.speak({ source: 'B', targetWpm: 130,
          text: 'Roger, turning right two three zero, Falcon one one.',
          onstart() {
            events.starts++;
            const source = __pilotAudioProbe.sources.at(-1);
            const audioContext = __pilotAudioProbe.contexts[source.contextIndex];
            suspension = new Promise((done, fail) => setTimeout(async () => {
              try {
                await audioContext.suspend();
                await new Promise(wait => setTimeout(wait, 200));
                await audioContext.resume();
                done();
              } catch (error) { fail(error); }
            }, 650));
          },
          onpause() { events.pauses++; },
          onresume() { events.resumes++; },
          onend() { events.ends++; clearTimeout(deadline); resolve(); },
          onerror(error) { events.errors.push(error.message); clearTimeout(deadline); reject(error); }
        });
      });
      await suspension;
      await new Promise(resolve => setTimeout(resolve, 100));
      return { events, signal: __pilotAudioProbe.summary(label) };
    });
    assert.deepEqual(suspended.events, { starts: 1, ends: 1, pauses: 1, resumes: 1, errors: [] });
    assert.ok(suspended.signal.states.some(item => item.state === 'suspended'), 'actual context suspension observed');
    assertCompleteSignal(suspended.signal, 'suspend/resume readback');

    const cancellation = await page.evaluate(async () => {
      const stale = { starts: 0, ends: 0, errors: 0 };
      __pilotAudioProbe.label = 'cancelled-readback';
      await new Promise((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error('Cancellation scenario did not start')), 15000);
        QGHPilotVoiceEngine.speak({ source: 'C', targetWpm: 100,
          text: 'Roger, turning left one four zero, Raven two one.',
          onstart() {
            stale.starts++;
            const source = __pilotAudioProbe.sources.at(-1);
            const audioContext = __pilotAudioProbe.contexts[source.contextIndex];
            setTimeout(async () => {
              try {
                await audioContext.suspend();
                QGHPilotVoiceEngine.cancel();
                await audioContext.resume();
                clearTimeout(deadline);
                resolve();
              } catch (error) { clearTimeout(deadline); reject(error); }
            }, 300);
          },
          onend() { stale.ends++; },
          onerror(error) { stale.errors++; clearTimeout(deadline); reject(error); }
        });
      });
      const fresh = { starts: 0, ends: 0, errors: 0 };
      __pilotAudioProbe.label = 'replacement-readback';
      await new Promise((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error('Fresh readback did not complete')), 15000);
        QGHPilotVoiceEngine.speak({ source: 'D', targetWpm: 170,
          text: 'Roger, turning right two three zero, Falcon one one.',
          onstart() { fresh.starts++; },
          onend() { fresh.ends++; clearTimeout(deadline); resolve(); },
          onerror(error) { fresh.errors++; clearTimeout(deadline); reject(error); }
        });
      });
      await new Promise(resolve => setTimeout(resolve, 500));
      return { stale, fresh, cancelledSources: __pilotAudioProbe.sources.filter(item => item.label === 'cancelled-readback').length,
        stopped: __pilotAudioProbe.summary('cancelled-readback')?.stopped,
        signal: __pilotAudioProbe.summary('replacement-readback') };
    });
    assert.deepEqual(cancellation.stale, { starts: 1, ends: 0, errors: 0 }, 'cancel suppresses stale callbacks');
    assert.equal(cancellation.cancelledSources, 1, 'cancelled reply did not restart');
    assert.equal(cancellation.stopped, true, 'cancel stopped the real source');
    assert.deepEqual(cancellation.fresh, { starts: 1, ends: 1, errors: 0 });
    assertCompleteSignal(cancellation.signal, 'fresh readback after cancel');

    const manual = await page.evaluate(() => {
      QGHHeadphones.mute();
      const before = QGHRadioAdapter.snapshot('single').simulationSeconds;
      const button = document.getElementById('advanceFlight');
      const enabled = !button.disabled;
      button.click();
      return { enabled, before, after: QGHRadioAdapter.snapshot('single').simulationSeconds };
    });
    assert.equal(manual.enabled, true, 'manual advance remains enabled');
    assert.ok(manual.after > manual.before, 'manual advance still moves simulation');
    assert.deepEqual(errors, []);
    assert.deepEqual(remoteRequests, []);
    return { browser: browserName, viewport, passed: true, headphone, exercise, suspended, cancellation, manual, errors };
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      pilotCapability: window.QGHPilotVoiceEngine?.capability(),
      headphoneDialog: document.querySelector('.headphone-dialog')?.textContent,
      contexts: window.__pilotAudioProbe?.contexts.map(item => ({ state: item.state, currentTime: item.currentTime, sampleRate: item.sampleRate })),
      sources: window.__pilotAudioProbe?.sources.map(item => ({ label: item.label, duration: item.duration, ended: item.ended, levels: item.levels.length, states: item.states }))
    })).catch(() => null);
    error.qaDiagnostics = { browser: browserName, viewport, errors, diagnostics };
    throw error;
  } finally { await context.close(); }
}

(async () => {
  const report = { base, generatedAt: new Date().toISOString(), scope: 'Desktop Chromium/WebKit with phone viewport emulation; real PCM and output analyser; no physical microphone or headphone certification', flows: [], skipped: [] };
  try {
    const engines = [{ name: 'chromium', type: playwright.chromium, options: { channel: 'msedge', headless: true } }];
    if (fs.existsSync(playwright.webkit.executablePath())) engines.push({ name: 'webkit', type: playwright.webkit, options: { headless: true } });
    else report.skipped.push({ browser: 'webkit', reason: 'Playwright WebKit executable is not installed' });
    const requested = process.env.QGH_QA_BROWSERS?.split(',');
    for (const engine of engines.filter(item => !requested || requested.includes(item.name))) {
      const browser = await engine.type.launch(engine.options);
      try {
        const capabilityPage = await browser.newPage();
        const capabilities = await capabilityPage.evaluate(() => ({
          AudioContext: typeof window.AudioContext, webkitAudioContext: typeof window.webkitAudioContext,
          Worker: typeof window.Worker, userAgent: navigator.userAgent
        }));
        await capabilityPage.close();
        if (capabilities.AudioContext !== 'function' && capabilities.webkitAudioContext !== 'function') {
          report.skipped.push({ browser: engine.name, reason: 'Installed browser runtime exposes no Web Audio context', capabilities });
          console.log(`${engine.name}: skipped; installed runtime has no Web Audio API`);
          continue;
        }
        for (const viewport of [{ width: 390, height: 844 }, { width: 393, height: 873 }]) {
          report.flows.push(await checkFlow(browser, engine.name, viewport));
          console.log(`${engine.name} ${viewport.width}x${viewport.height}: actual readback, suspend/resume, cancel and manual-control checks passed`);
        }
      } finally { await browser.close(); }
    }
  } catch (error) {
    report.failure = error.stack || String(error);
    report.failureDiagnostics = error.qaDiagnostics;
    process.exitCode = 1;
    console.error(report.failure);
  } finally {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(`Saved ${output}`);
  }
})();
