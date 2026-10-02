(function initialiseInstructor() {
  'use strict';
  const Core = globalThis.ATCSuiteCore;
  const Sensors = globalThis.ATCSuiteSensors;
  const Session = globalThis.ATCSuiteSession;
  const Display = globalThis.ATCSuiteDisplay;
  if (!Core || !Sensors || !Session) return;

  const byId = id => document.getElementById(id);
  const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function enterWorkspace(element) {
    if (!element) return;
    if (globalThis.ATCSuiteWorkspace?.enter) globalThis.ATCSuiteWorkspace.enter(element, { block: 'start' });
    else element.scrollIntoView?.({ block: 'start', behavior: 'instant' });
  }
  const family = byId('exerciseFamily');
  const procedure = byId('procedureType');
  const TRAINING_TIME_RATES = Object.freeze([1, 5, 10]);
  const DEFAULT_TRAINING_TIME_RATE = 5;
  const state = {
    simulation: null, session: null, sensor: null, review: null, sra: null, cloudTransport: null, creating: false,
    running: false, accumulator: 0, trainingTimeRate: DEFAULT_TRAINING_TIME_RATE, previousFrame: null, readbackTimer: null,
    dfTimer: null, latestObservation: null, pendingClient: null, lastRenderedEvent: 0,
    lastRecordedObservation: null, rosterRows: [], transmission: null, scopeTransform: null,
    inspectedAircraftId: null, guideStep: 0, reviewTime: 0, reviewPlaying: false, clickTimer: null,
    studentWindow: null, previousTick: null, radioAudio: false, runtimeError: null, dirty: false,
    scopePan: { x: 0, y: 0 }, scopeDrag: null, lastRightClick: null, suppressClickUntil: 0,
    initialScenario: null, restoreMessage: '', lastCheckpoint: 0
  };

  const radioNow = () => performance.now() / 1000;
  const RECOVERY_KEY = 'atc-suite.instructor-attempt.v1';
  const SETUP_KEY = 'atc-suite.instructor-setup.v1';
  const PRESETS_KEY = 'atc-suite.saved-exercises.v1';
  const focusPanelIds = ['consoleNavigation', 'sessionDrawer', 'clockSettings', 'scopeSettings', 'aircraftControlDrawer', 'eventDrawer'];
  const focusMode = globalThis.ATCSuiteWorkspace?.createFocusMode?.({ root: byId('activeWorkspace'), panels: focusPanelIds.map(byId) });
  globalThis.ATCSuiteWorkspace?.bindShell?.({ root: byId('activeWorkspace'), scope: byId('instructorScope'),
    shelf: byId('instructorControlShelf'), actions: byId('instructorRunActions') });

  function presets() {
    try { const data = JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]'); return Array.isArray(data) ? data.slice(0, 40) : []; } catch (_) { return []; }
  }

  function refreshPresets(selected = '') {
    const options = [new Option('Choose an exercise', '')];
    for (const item of presets()) if (typeof item.name === 'string') options.push(new Option(item.name, item.id));
    byId('savedExercise').replaceChildren(...options); byId('savedExercise').value = selected;
  }

  function presetName() {
    const name = byId('savedExerciseName').value.trim().slice(0, 60);
    if (!name || name.includes('\0')) throw new Error('Name this exercise using 1–60 characters.');
    return name;
  }

  function selectedPreset() {
    const item = presets().find(entry => entry.id === byId('savedExercise').value);
    if (!item || !Array.isArray(item.setup)) throw new Error('Choose a saved exercise first.');
    return item;
  }

  function uniquePresetName(name, exceptId = '') {
    if (presets().some(item => item.id !== exceptId && item.name?.toLowerCase() === name.toLowerCase())) throw new Error('That exercise name is already used. Choose a new name or Update selected.');
  }

  function checkPresetCapacity(setup) {
    const mode = setup.find(item => item.id === 'exerciseFamily')?.value || 'qgh';
    const count = Number(setup.find(item => item.id === 'aircraftCount')?.value || 1);
    const limit = mode === 'qgh' ? Core.MAX_QGH_AIRCRAFT : Core.MAX_AIRCRAFT;
    if (!Number.isInteger(count) || count < 1 || count > limit) {
      throw new Error(`Saved ${mode === 'qgh' ? 'QGH' : 'radar'} setup has ${count} aircraft. New ${mode === 'qgh' ? 'QGH' : 'radar'} exercises support 1–${limit}. The stored setup is unchanged; export it to retain the original traffic.`);
    }
    if (setup.some(item => Number(item.id.match(/^(?:callsign|squawk|radarReturn|aircraftType|initialBearing|initialRange|initialHeading|initialAltitude|initialSpeed|turnRate|verticalRate)-(\d+)$/)?.[1] || 0) > count)) {
      throw new Error('Saved aircraft fields exceed the declared aircraft count. The stored setup is unchanged.');
    }
  }

  function persistPreset(item, { add = false } = {}) {
    const entries = presets();
    if (add && entries.length >= 40) throw new Error('Up to 40 exercises can be saved on this browser. Export an exercise before freeing storage.');
    const next = add ? [...entries, item] : entries.map(entry => entry.id === item.id ? item : entry);
    // Storage is the source of truth. A quota failure must not paint a saved
    // record or overwrite an existing entry only in memory.
    localStorage.setItem(PRESETS_KEY, JSON.stringify(next)); refreshPresets(item.id);
  }

  function savePresetAsNew() {
    try {
      Core.createState(scenarioInput()); const name = presetName(); uniquePresetName(name);
      persistPreset({ id: crypto.randomUUID(), name, version: 1, setup: captureSetup() }, { add: true });
      byId('presetStatus').textContent = 'New starting setup saved on this browser. Export selected to share or back it up.';
    } catch (error) { byId('presetStatus').textContent = `Not saved: ${error.message}`; }
  }

  function savePreset() {
    try {
      const item = selectedPreset(); Core.createState(scenarioInput());
      persistPreset({ ...item, version: 1, setup: captureSetup() });
      byId('savedExerciseName').value = item.name;
      byId('presetStatus').textContent = `${item.name} updated with the configured starting traffic.`;
    } catch (error) { byId('presetStatus').textContent = `Not saved: ${error.message}`; }
  }

  function duplicatePreset() {
    try {
      const source = selectedPreset(); checkPresetCapacity(source.setup);
      let name = byId('savedExerciseName').value.trim();
      if (!name || name.toLowerCase() === source.name.toLowerCase()) {
        const base = source.name.slice(0, 48); name = `${base} copy`; let suffix = 2;
        while (presets().some(item => item.name?.toLowerCase() === name.toLowerCase())) name = `${base} copy ${suffix++}`;
      }
      byId('savedExerciseName').value = name; name = presetName(); uniquePresetName(name);
      persistPreset({ id: crypto.randomUUID(), name, version: 1, setup: structuredClone(source.setup) }, { add: true });
      byId('presetStatus').textContent = 'Independent copy saved with exactly the selected exercise’s starting traffic.';
    } catch (error) { byId('presetStatus').textContent = `Not duplicated: ${error.message}`; }
  }

  function renamePreset() {
    try {
      const source = selectedPreset(), name = presetName(); uniquePresetName(name, source.id);
      persistPreset({ ...source, name });
      byId('presetStatus').textContent = 'Exercise renamed. Starting traffic is unchanged.';
    } catch (error) { byId('presetStatus').textContent = `Not renamed: ${error.message}`; }
  }

  function removePreset() {
    try {
      const item = selectedPreset(); if (!confirm(`Remove ${item.name} from this browser? Exported exercise files are unaffected.`)) return;
      localStorage.setItem(PRESETS_KEY, JSON.stringify(presets().filter(entry => entry.id !== item.id))); refreshPresets();
      byId('presetStatus').textContent = 'Stored exercise removed from this browser.';
    } catch (error) { byId('presetStatus').textContent = `Not removed: ${error.message}`; }
  }

  function loadPreset() {
    try {
      const item = selectedPreset(); checkPresetCapacity(item.setup);
      restoreSetup(item.setup); byId('savedExerciseName').value = item.name;
      byId('presetStatus').textContent = 'Loaded the original starting traffic. Create a session when ready.';
    } catch (error) { byId('presetStatus').textContent = error.message; }
  }

  function exportPreset() {
    try {
      const item = selectedPreset();
      const content = JSON.stringify({ format: 'ats-simbox-instructor-exercise', version: 1, name: item.name, setup: item.setup }, null, 2);
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'ats-simbox-exercise.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { byId('presetStatus').textContent = error.message; }
  }

  async function importPreset(event) {
    const previous = captureSetup(), previousName = byId('savedExerciseName').value;
    let changed = false;
    try {
      const file = event.target.files?.[0]; if (!file) return;
      if (file.size > 128000) throw new Error('Exercise file is too large.');
      const data = JSON.parse(await file.text());
      if (data.format !== 'ats-simbox-instructor-exercise' || data.version !== 1 || !Array.isArray(data.setup)) throw new Error('Use an exported ATS SIMBOX instructor exercise.');
      const allowed = new Set(captureSetup().map(item => item.id));
      if (data.setup.some(item => !item || typeof item.id !== 'string' || !(allowed.has(item.id) || /^(callsign|squawk|radarReturn|aircraftType|initialBearing|initialRange|initialHeading|initialAltitude|initialSpeed|turnRate|verticalRate)-\d+$/.test(item.id)))) throw new Error('Exercise contains unsupported fields.');
      if (new Set(data.setup.map(item => item.id)).size !== data.setup.length) throw new Error('Exercise contains repeated fields.');
      checkPresetCapacity(data.setup);
      let name = String(data.name || 'Imported exercise').trim().slice(0, 48) || 'Imported exercise', suffix = 2;
      const base = name;
      while (presets().some(item => item.name?.toLowerCase() === name.toLowerCase())) name = `${base} imported ${suffix++}`;
      changed = true; restoreSetup(data.setup); Core.createState(scenarioInput()); byId('savedExerciseName').value = name;
      persistPreset({ id: crypto.randomUUID(), name: presetName(), version: 1, setup: captureSetup() }, { add: true });
      byId('presetStatus').textContent = 'Imported as an independent saved exercise. Original entries are unchanged.';
    } catch (error) {
      if (changed) { restoreSetup(previous); byId('savedExerciseName').value = previousName; }
      byId('presetStatus').textContent = `Not imported: ${error.message}`;
    }
    finally { event.target.value = ''; }
  }

  function captureSetup() {
    return [...document.querySelectorAll('#scenarioForm input, #scenarioForm select')].map(node => ({
      id: node.id, value: node.value, checked: node.type === 'checkbox' ? node.checked : undefined,
      ...(node.id === 'radarReturn' || /^radarReturn-\d+$/.test(node.id) ? { radarAuto: node.dataset.radarReturnAuto } : {})
    })).filter(item => item.id);
  }

  function restoreSetup(saved) {
    if (!Array.isArray(saved)) return;
    const savedFamily = saved.find(item => item.id === 'exerciseFamily');
    if (savedFamily && ['qgh', 'surveillance', 'sra'].includes(savedFamily.value)) family.value = savedFamily.value;
    const count = saved.find(item => item.id === 'aircraftCount');
    if (count) byId('aircraftCount').value = String(Math.max(1, Math.min(maxNewAircraft(), Number(count.value) || 1)));
    syncRoster();
    for (const item of saved) {
      const node = byId(item.id);
      if (!node || !node.closest?.('#scenarioForm')) continue;
      if (item.id === 'exerciseFamily' && item.value === 'par') continue;
      node.value = item.id === 'scanPreset' ? '15' : String(item.value);
      if (node.type === 'checkbox') node.checked = item.checked === true;
      if (item.id === 'radarReturn' || /^radarReturn-\d+$/.test(item.id)) node.dataset.radarReturnAuto = item.radarAuto === 'true' ? 'true' : 'false';
    }
    configureFields();
    saveSetup();
  }

  function saveSetup() {
    try { sessionStorage.setItem(SETUP_KEY, JSON.stringify(captureSetup())); } catch (_) { /* Setup remains editable if storage is unavailable. */ }
  }

  function checkpoint() {
    if (!state.simulation || typeof sessionStorage === 'undefined') return;
    try {
      const timeline = state.review?.snapshot();
      // Keep exact commands and observations; sample recovery truth at one
      // second to prevent long fleet exercises exhausting browser storage.
      const review = timeline ? { ...timeline, truth: timeline.truth.filter((item, index, rows) => index === rows.length - 1 || index === 0 || Math.floor(item.timestamp) !== Math.floor(rows[index - 1].timestamp)) } : null;
      const simulation = structuredClone(state.simulation);
      for (const id of Object.keys(simulation.truthTrails)) simulation.truthTrails[id] = simulation.truthTrails[id].filter((item, index, rows) => index === rows.length - 1 || index === 0 || Math.floor(item.timestamp) !== Math.floor(rows[index - 1].timestamp));
      sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({ version: 1, savedAt: Date.now(), setup: captureSetup(),
        simulation, initialScenario: state.initialScenario, review,
        protocol: state.session?.recoverySnapshot?.(), cloud: state.cloudTransport?.recoverySnapshot?.(),
        trainingTimeRate: state.trainingTimeRate }));
      state.lastCheckpoint = performance.now();
    } catch (_) { byId('recoveryStatus').textContent = 'Recovery storage full · save/export the scenario before leaving.'; }
  }

  async function restoreAttempt() {
    let saved;
    try { restoreSetup(JSON.parse(sessionStorage.getItem(SETUP_KEY) || 'null')); saved = JSON.parse(sessionStorage.getItem(RECOVERY_KEY) || 'null'); } catch (_) { return; }
    if (saved?.version !== 1 || !saved.simulation?.scenario || !Array.isArray(saved.simulation.aircraftList) || !saved.protocol) return;
    try {
      restoreSetup(saved.setup);
      state.initialScenario = saved.initialScenario;
      const review = saved.simulation.lifecycle === 'review';
      state.simulation = Core.setLifecycle(saved.simulation, review ? 'review' : saved.protocol.admitted?.ready ? 'paused' : 'ready');
      state.running = false;
      state.sensor = createSensor({ ...state.simulation.scenario, startSeconds: state.simulation.simulationSeconds });
      state.review = Sensors.createReviewTimeline();
      for (const entry of saved.review?.truth || []) state.review.recordTruth(entry);
      for (const entry of saved.review?.observations || []) state.review.recordObservation(entry.sensor, entry);
      for (const entry of saved.review?.events || []) state.review.recordEvent(entry);
      const cloud = saved.cloud ? await globalThis.ATCSuiteCloud.prepareHost(Session, status => {
        if (!status.connected) setStudentDisplayStatus('ONLINE LINK LOST · retry connection, then resume.', 'attention');
      }, saved.cloud) : null;
      state.cloudTransport = cloud?.transport || null;
      state.session = Session.createInstructorSession({ ...saved.protocol, recovery: saved.protocol,
        publicMetadata: publicMetadataForSimulation(), storage: cloud ? undefined : localStorage, ...(cloud || {}),
        transportFactory: channelName => Session.createLocalSessionTransport({ channelName }), onEvent: onSessionEvent });
      if (review) state.session.terminate('exercise-terminated', state.simulation.simulationSeconds);
      setTrainingTimeRate(saved.trainingTimeRate);
      byId('setupPanel').hidden = true; byId('activeWorkspace').hidden = review; byId('reviewScreen').hidden = !review;
      document.body.classList.add('exercise-console');
      renderAircraftTabs(); refreshSelectionInputs(); configureActiveControls();
      byId('pauseExercise').textContent = 'RESUME';
      byId('commandStatus').textContent = review ? 'Review restored.' : 'ATTEMPT RESTORED · paused. Reconnect student, then Resume.';
      byId('studentStatus').textContent = 'RECONNECT STUDENT';
      byId('studentDetail').textContent = 'The same PIN and student seat are retained. Select Reconnect on the student display.';
      byId('sessionConnectionLabel').textContent = cloud ? 'Online · internet on both devices' : 'Offline · same PC and browser profile · Extend displays';
      collapseSetupControls(); updateAll();
      enterWorkspace(byId(review ? 'reviewScreen' : 'activeWorkspace'));
      if (review) { state.reviewTime = state.simulation.simulationSeconds; byId('reviewScrub').max = String(state.reviewTime); renderReview(); }
      state.cloudTransport?.start(); state.session.heartbeat(state.simulation.simulationSeconds);
    } catch (error) { byId('setupPreview').textContent = `Recovery unavailable: ${error.message}. Saved setup is retained.`; }
  }

  function collapseSetupControls() {
    if (focusMode) focusMode.enterRun();
    else for (const id of focusPanelIds) byId(id).open = false;
  }

  function retryScenario() {
    state.running = false; finishTransmission();
    state.session?.close(); state.cloudTransport = null; state.session = null;
    state.simulation = null; state.sensor = null; state.latestObservation = null; state.lastRenderedEvent = 0;
    state.review = null; state.reviewPlaying = false; state.scopePan = { x: 0, y: 0 };
    try { sessionStorage.removeItem(RECOVERY_KEY); } catch (_) {}
    byId('setupPanel').hidden = false; byId('activeWorkspace').hidden = true; byId('reviewScreen').hidden = true;
    document.body.classList.remove('exercise-console'); byId('consoleNavigation').open = true;
    byId('setupPreview').textContent = 'Same configured traffic · create a new session to repeat from the start.';
    byId('setupPanel').scrollIntoView?.({ block: 'start' });
  }

  function suspendExercise(message) {
    state.running = false; state.accumulator = 0;
    if (state.simulation?.lifecycle === 'running') {
      state.session.pause(state.simulation.simulationSeconds);
      state.simulation = Core.setLifecycle(state.simulation, 'paused');
    }
    byId('pauseExercise').textContent = 'RESUME';
    byId('commandStatus').textContent = message;
    state.runtimeError = message; state.dirty = true;
  }

  // Scheduling and painting have separate owners. Ordinary background timer
  // delays are accounted for; a long suspension explicitly pauses the lesson.
  function runtimeTick(timestamp = performance.now()) {
    const elapsed = state.previousTick == null ? 0 : Math.max(0, (timestamp - state.previousTick) / 1000);
    state.previousTick = timestamp;
    try {
      if (state.running && state.cloudTransport && !state.cloudTransport.connected) suspendExercise('ONLINE LINK LOST · exercise paused. Reconnect, then select Resume.');
      if (state.running && elapsed > 2) suspendExercise('BROWSER SUSPENDED · exercise paused. Select Resume when ready.');
      else advanceWallElapsed(elapsed);
      if (state.transmission && radioNow() >= state.transmission.expiresAt) finishTransmission();
      if (state.simulation && state.sensor && ['running', 'paused'].includes(state.simulation.lifecycle)) publishCurrentObservation();
      if (state.simulation && timestamp - state.lastCheckpoint > 3000) checkpoint();
    } catch (error) {
      suspendExercise(`SENSOR UPDATE FAILED · ${error.message}. Exercise paused.`);
    }
  }

  function setStudentDisplayStatus(message, status = '') {
    const output = byId('studentDisplayStatus');
    output.textContent = message;
    if (status) output.dataset.state = status;
    else delete output.dataset.state;
  }

  function openStudentDisplay() {
    if (!Display) {
      setStudentDisplayStatus('STUDENT DISPLAY MODULE UNAVAILABLE · reload this page and try again.', 'attention');
      return { ok: false, reason: 'unsupported', window: null };
    }
    const windowMissing = !state.studentWindow || state.studentWindow.closed;
    if (!windowMissing) {
      try { state.studentWindow.focus(); } catch (_) { /* Browser focus policy may decline. */ }
      setStudentDisplayStatus('STUDENT DISPLAY OPEN · enter the PIN there, or move it to a second display.');
      return { ok: true, reason: 'focused', window: state.studentWindow };
    }
    const opened = Display.openStudentWindow({ url: state.cloudTransport ? 'student.html?connection=online' : 'student.html' });
    if (!opened.ok) {
      setStudentDisplayStatus(opened.reason === 'popup-blocked'
        ? 'POP-UP BLOCKED · allow pop-ups, then select Open / Focus.'
        : 'STUDENT DISPLAY COULD NOT OPEN SAFELY · reload this page and try again.', 'attention');
      return opened;
    }
    state.studentWindow = opened.window;
    setStudentDisplayStatus('STUDENT DISPLAY OPEN · enter the PIN there, or move it to a second display.');
    return opened;
  }

  async function moveStudentDisplay() {
    const opened = openStudentDisplay();
    if (!opened.ok) return opened;
    // Opening a pop-up and requesting screen-placement permission may each
    // consume browser activation. A newly opened display therefore asks the
    // instructor to press Move once more; an existing display is positioned
    // by this direct, permission-bearing action.
    if (opened.reason === 'opened') {
      setStudentDisplayStatus('STUDENT DISPLAY OPEN · select Move to Second Display once more to place it.');
      return opened;
    }
    const result = await Display.placeOnExternalScreen(state.studentWindow);
    if (result.reason === 'external-display') {
      setStudentDisplayStatus(`STUDENT DISPLAY PLACED ON SECOND SCREEN${result.label ? ` · ${result.label}` : ''}.`, 'external');
    } else if (result.reason === 'single-display') {
      setStudentDisplayStatus('STUDENT DISPLAY OPEN · one screen detected; move or resize it manually.');
    } else if (result.reason === 'permission-needed') {
      setStudentDisplayStatus('STUDENT DISPLAY OPEN · allow window-placement access, then select this control again.', 'attention');
    } else if (result.reason === 'window-closed') {
      state.studentWindow = null;
      setStudentDisplayStatus('STUDENT DISPLAY CLOSED · select Open / Move to reopen it.', 'attention');
    } else {
      setStudentDisplayStatus('STUDENT DISPLAY OPEN · automatic placement is unavailable; move it manually.');
    }
    return result;
  }

  function number(id) { return Number(byId(id).value); }
  function pad(value) { return String(Math.round(((Number(value) % 360) + 360) % 360) % 360).padStart(3, '0'); }
  function clock(seconds) { const total = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; }
  function modeLabel(mode) { return ({ qgh: 'QGH / DIRECTION FINDING', surveillance: 'SURVEILLANCE VECTORING', sra: 'SURVEILLANCE RADAR APPROACH', par: 'PRECISION APPROACH RADAR' })[mode] || mode; }

  function normaliseTrainingTimeRate(value) {
    const candidate = Number(value);
    return TRAINING_TIME_RATES.includes(candidate) ? candidate : DEFAULT_TRAINING_TIME_RATE;
  }

  function setTrainingTimeRate(value) {
    const rate = normaliseTrainingTimeRate(value);
    state.trainingTimeRate = rate;
    byId('trainingTimeRate').value = String(rate);
    byId('trainingRateStatus').textContent = `SIMULATION · ${rate}×`;
    return rate;
  }

  function resetTrainingTimeRate(mode) {
    return setTrainingTimeRate(mode === 'qgh' ? DEFAULT_TRAINING_TIME_RATE : 1);
  }

  // This deliberately scales elapsed *wall time* before flight stepping. The
  // flight model still receives physical simulation seconds, so configured
  // ground speed, turn rate and turn radius retain their relationship.
  function advanceWallElapsed(elapsedSeconds) {
    if (!state.running) return 0;
    const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
    state.accumulator += elapsed * state.trainingTimeRate;
    let advanced = 0;
    while (state.accumulator >= .25) {
      advanceBy(.25);
      state.accumulator -= .25;
      advanced += .25;
    }
    return advanced;
  }

  setTrainingTimeRate(byId('trainingTimeRate').value);
  byId('trainingTimeRate').addEventListener('change', event => setTrainingTimeRate(event.currentTarget.value));

  function configureFields() {
    const mode = family.value;
    const radarMode = ['surveillance', 'sra'].includes(mode);
    byId('procedureField').hidden = mode !== 'qgh';
    byId('scanPresetField').hidden = !radarMode;
    byId('radarProfileField').hidden = !radarMode;
    byId('parRefreshField').hidden = mode !== 'par';
    byId('approachAircraftField').hidden = !['sra', 'par'].includes(mode);
    byId('parTransferGateField').hidden = true;
    for (const id of ['extendedCentrelineField', 'extendedCentrelineRangeField', 'centrelineTickField', 'localLfaField', 'localLfaRadiusField']) {
      byId(id).hidden = !radarMode;
    }
    byId('sraDescentProfileField').hidden = mode !== 'sra';
    syncRoster();
    for (const row of byId('aircraftRoster').children) {
      const radarReturn = [...row.querySelectorAll('input, select')][2];
      if (!radarReturn) continue;
      radarReturn.disabled = !radarMode;
      radarReturn.setAttribute('aria-disabled', String(!radarMode));
    }
    byId('setupPreview').textContent = `QTE ${pad(number('initialBearing'))} · ${number('initialRange')} NM · HDG ${pad(number('initialHeading'))}`;
  }

  function syncRoster() {
    const container = byId('aircraftRoster');
    if (!state.rosterRows.length) state.rosterRows = [...container.children];
    const maximum = maxNewAircraft();
    const count = Math.max(1, Math.min(maximum, Math.trunc(number('aircraftCount')) || 1));
    byId('aircraftCount').max = String(maximum); byId('aircraftCount').value = String(count);
    byId('aircraftCountLabel').textContent = `AIRCRAFT COUNT · 1–${maximum}`;
    const fields = [
      ['callsign', 'callsign', '101'], ['squawk', 'four digit octal squawk', '4300'], ['radarReturn', 'radar return', 'primary'], ['aircraftType', 'type', 'fighter'], ['initialBearing', 'initial QTE', '65'],
      ['initialRange', 'initial range', '25'], ['initialHeading', 'initial heading', '225'],
      ['initialAltitude', 'altitude', '12000'], ['initialSpeed', 'speed', '240'], ['turnRate', 'rate of turn', '3'], ['verticalRate', 'vertical rate feet per minute', '1000']
    ];
    while (state.rosterRows.length < count) {
      const index = state.rosterRows.length, row = state.rosterRows[0].cloneNode(true);
      const defaults = {
        callsign: 101 + index, squawk: automaticSquawkFor(index), initialBearing: (65 + index * 13) % 360,
        initialRange: 25 + index, initialHeading: (225 + index * 13) % 360,
        initialAltitude: 12000 + index * 1000, radarReturn: defaultRadarReturn(byId('radarProfile').value)
      };
      row.dataset.aircraftIndex = String(index);
      [...row.querySelectorAll('input, select')].forEach((input, column) => {
        input.id = `${fields[column][0]}-${index + 1}`;
        input.setAttribute('aria-label', `Aircraft ${index + 1} ${fields[column][1]}`);
        input.value = String(defaults[fields[column][0]] ?? fields[column][2]);
      });
      state.rosterRows.push(row);
    }
    if (container.children.length !== count) container.replaceChildren(...state.rosterRows.slice(0, count));
    syncRadarReturnDefaults();
    const approach = byId('approachAircraft'), selected = approach.value;
    const options = state.rosterRows.slice(0, count).map((row, index) => {
      const option = document.createElement('option'); option.value = `AC${index + 1}`;
      option.textContent = row.querySelector('input').value || `Aircraft ${index + 1}`; return option;
    });
    approach.replaceChildren(...options);
    approach.value = options.some(option => option.value === selected) ? selected : 'AC1';
  }

  function maxNewAircraft() { return family.value === 'qgh' ? Core.MAX_QGH_AIRCRAFT : Core.MAX_AIRCRAFT; }

  // The global profile selects the automatic roster default. An instructor can
  // deliberately override an individual return to create a mixed primary / SSR
  // training picture without losing that decision when the roster is resized.
  function defaultRadarReturn(profile) {
    return profile === 'correlated' ? 'mode-s' : 'primary';
  }

  function normaliseRadarReturn(value, profile) {
    const radarReturn = String(value || defaultRadarReturn(profile)).trim().toLowerCase();
    if (!['primary', 'mode-a', 'mode-s'].includes(radarReturn)) throw new Error('Each radar return must be Primary, Mode A or Mode S.');
    return radarReturn;
  }

  function syncRadarReturnDefaults() {
    const defaultReturn = defaultRadarReturn(byId('radarProfile').value);
    for (const row of byId('aircraftRoster').children) {
      const radarReturn = [...row.querySelectorAll('input, select')][2];
      if (!radarReturn || radarReturn.dataset?.radarReturnAuto === 'false') continue;
      radarReturn.value = defaultReturn;
      if (radarReturn.dataset) radarReturn.dataset.radarReturnAuto = 'true';
    }
  }

  // The training representation uses no real location or aerodrome data.
  // When enabled, the LFA is an instructor-defined regular local boundary
  // around the simulated station, not a published airspace boundary.
  function radarEnvironmentInput(mode) {
    if (!['surveillance', 'sra'].includes(mode)) return null;
    const localBoundary = byId('localLfaEnabled').checked === true
      ? Array.from({ length: 8 }, (_, index) => ({ bearingDeg: index * 45, rangeNm: number('localLfaRadius') }))
      : [];
    return {
      runwayOrientationDeg: number('runwayOrientation'),
      extendedCentreline: byId('extendedCentreline').checked === true,
      extendedCentrelineNm: number('extendedCentrelineNm'),
      centrelineTickNm: number('centrelineTickNm'),
      lfaBoundary: localBoundary,
      sraDescentProfile: mode === 'sra' && byId('sraDescentProfile').checked === true
    };
  }

  // Automatic assignments stay in a normal training range; they never allocate
  // 7500, 7600 or 7700. An instructor may deliberately enter any valid octal
  // code to model a specific classroom scenario.
  function automaticSquawkFor(index) {
    return (0o4300 + index).toString(8).padStart(4, '0');
  }

  function normaliseSquawk(value) {
    const squawk = String(value || '').trim();
    if (!/^[0-7]{4}$/.test(squawk)) throw new Error('Each transponder code must use exactly four octal digits (0–7).');
    return squawk;
  }

  function trainingSurveillanceFor(index, mode, radarReturn, squawk) {
    if (!['surveillance', 'sra'].includes(mode) || radarReturn === 'primary') return null;
    if (radarReturn === 'mode-a') return { secondary: true, squawk };
    return { secondary: true, modeS: true, squawk,
      modeSId: (0xA10000 + index).toString(16).toUpperCase().padStart(6, '0') };
  }

  function scenarioInput() {
    const mode = family.value;
    const profile = byId('radarProfile').value;
    const radarEnvironment = radarEnvironmentInput(mode);
    const squawks = new Set();
    const aircraft = [...byId('aircraftRoster').children].map((row, index) => {
      const controls = [...row.querySelectorAll('input, select')];
      const inputs = controls.map(input => input.value);
      const squawk = normaliseSquawk(String(inputs[1] || '').trim() || automaticSquawkFor(index));
      // Empty fields mean the instructor chose automatic allocation. Make the
      // result visible before session creation rather than silently hiding it.
      if (!String(inputs[1] || '').trim()) controls[1].value = squawk;
      if (squawks.has(squawk)) throw new Error('Each aircraft needs a unique four-digit octal transponder code.');
      squawks.add(squawk);
      const radarReturn = normaliseRadarReturn(inputs[2], profile);
      const surveillance = trainingSurveillanceFor(index, mode, radarReturn, squawk);
      return { aircraftId: `AC${index + 1}`, callsign: inputs[0], aircraftType: inputs[3], initialQteDeg: Number(inputs[4]),
        initialRangeNm: Number(inputs[5]), initialHeadingDeg: Number(inputs[6]), altitudeFt: Number(inputs[7]),
        speedKt: Number(inputs[8]), rateDegPerSecond: Number(inputs[9]), verticalRateFpm: Number(inputs[10]),
        // Always retain the code in instructor truth. The optional secondary
        // response below is what governs the controller/student picture.
        transponderCode: squawk,
        ...(surveillance ? { surveillance } : {}) };
    });
    const surveillanceProfile = ['surveillance', 'sra'].includes(mode) && aircraft.some(item => item.surveillance?.secondary === true)
      ? 'correlated'
      : 'primary';
    return Core.validateNewExercise({
      aircraft, approachAircraft: byId('approachAircraft').value,
      exerciseFamily: mode,
      qghProcedure: procedure.value === 'us-compass' ? 'us' : 'normal',
      callsign: byId('callsign').value,
      initialQteDeg: number('initialBearing'), initialRangeNm: number('initialRange'),
      initialHeadingDeg: number('initialHeading'), altitudeFt: number('initialAltitude'),
      speedKt: number('initialSpeed'), rateDegPerSecond: number('turnRate'),
      verticalRateFpm: 1000, runwayOrientationDeg: number('runwayOrientation'),
      finalTrackDeg: number('finalTrack'), surveillanceProfile,
      sensorProfile: mode === 'par' ? `${byId('parRefresh').value}hz` : '15rpm',
      parRefreshHz: Number(byId('parRefresh').value), parTransferGateNm: number('parTransferGate'),
      ...(radarEnvironment ? { radarEnvironment } : {})
    });
  }

  function publicMetadata(input) {
    const rpm = 15;
    const approachAircraft = input.aircraft.find(aircraft => aircraft.aircraftId === input.approachAircraft);
    return {
      mode: input.exerciseFamily,
      procedure: input.qghProcedure,
      callsign: input.callsign,
      aircraftCount: input.aircraft.length,
      approachCallsign: approachAircraft?.callsign || input.callsign,
      glidepathDeg: 3,
      radarProfile: input.surveillanceProfile,
      equipmentLabel: input.exerciseFamily === 'par' ? 'DP-RDR-8044-inspired training representation'
        : ['surveillance', 'sra'].includes(input.exerciseFamily) ? 'ATCR-33S-inspired training representation' : 'HRDF training representation',
      trainingReference: 'Co-aligned training references; zero magnetic variation',
      runwayOrientation: input.runwayOrientationDeg,
      finalTrack: input.finalTrackDeg,
      ...(['surveillance', 'sra'].includes(input.exerciseFamily) ? { scanRpm: rpm, revisitSeconds: 60 / rpm, historyCount: 5 } : {}),
      ...(input.exerciseFamily === 'par' ? { parRefreshHz: Number(byId('parRefresh').value), historyCount: 3 } : {}),
      ...(input.radarEnvironment ? { radarEnvironment: input.radarEnvironment } : {}),
      ...(['sra', 'par'].includes(input.exerciseFamily) && approachAircraft ? {
        approachSpeedKt: approachAircraft.speedKt, approachAircraftType: approachAircraft.aircraftType
      } : {})
    };
  }

  function publicMetadataForSimulation(simulation = state.simulation) {
    const scenario = simulation.scenario;
    const approachAircraft = simulation.aircraftList.find(item => item.id === scenario.parApproachAircraftId);
    const mode = scenario.exerciseFamily;
    const metadata = {
      mode,
      procedure: scenario.qghProcedure,
      callsign: simulation.aircraft.callsign,
      aircraftCount: simulation.aircraftList.length,
      approachCallsign: approachAircraft?.callsign || simulation.aircraft.callsign,
      glidepathDeg: 3,
      radarProfile: scenario.surveillanceProfile,
      equipmentLabel: mode === 'par' ? 'DP-RDR-8044-inspired training representation'
        : ['surveillance', 'sra'].includes(mode) ? 'ATCR-33S-inspired training representation' : 'HRDF training representation',
      trainingReference: 'Co-aligned training references; zero magnetic variation',
      runwayOrientation: scenario.runwayOrientationDeg,
      finalTrack: scenario.finalTrackDeg
    };
    if (['surveillance', 'sra'].includes(mode)) {
      metadata.scanRpm = 15;
      metadata.revisitSeconds = 4;
      metadata.historyCount = 5;
      if (scenario.radarEnvironment) metadata.radarEnvironment = scenario.radarEnvironment;
    }
    if (mode === 'par') {
      metadata.parRefreshHz = Number(scenario.parRefreshHz || 1);
      metadata.historyCount = 3;
    }
    if (['sra', 'par'].includes(mode) && approachAircraft) {
      metadata.approachSpeedKt = approachAircraft.speedKt;
      metadata.approachAircraftType = approachAircraft.type;
    }
    return metadata;
  }

  function createSensor(input) {
    if (input.exerciseFamily === 'qgh') return Sensors.createDfSensor({ holdSeconds: 2 });
    if (input.exerciseFamily === 'par') return Sensors.createParSensor({
      refreshHz: Number(input.parRefreshHz ?? byId('parRefresh').value), runwayHeadingDeg: input.finalTrackDeg,
      source: input.approachAircraft ?? input.parApproachAircraftId,
      startSeconds: Number(input.startSeconds ?? 0), touchdown: { x: 0, y: 0, altitudeFt: 0 },
      glidepathDeg: 3, maxRangeNm: 20, history: 3
    });
    state.sra = input.exerciseFamily === 'sra' ? Sensors.createSraReferences({ runwayHeadingDeg: input.finalTrackDeg, terminationRangeNm: .5 }) : null;
    return Sensors.createSurveillanceSensor({ rpm: 15, startSeconds: input.startSeconds || 0,
      profile: input.surveillanceProfile, sra: input.exerciseFamily === 'sra', history: 5, maxRangeNm: 100 });
  }

  function configureActiveControls() {
    if (!state.simulation) return;
    const mode = state.simulation.scenario.exerciseFamily;
    const us = mode === 'qgh' && state.simulation.scenario.qghProcedure === 'us';
    const radarMode = mode !== 'qgh';
    const approachMode = ['sra', 'par'].includes(mode);
    byId('normalCommands').hidden = us; byId('usCommands').hidden = !us;
    byId('continueHeading').hidden = us;
    byId('reportHeading').hidden = us;
    byId('radarApproachCommands').hidden = !radarMode;
    byId('transmitDf').hidden = radarMode;
    byId('continueApproach').hidden = !approachMode;
    byId('reportRunwayVisual').hidden = !approachMode;
    byId('missedApproach').hidden = !approachMode;
    byId('parTransferActions').hidden = true;
    byId('approachControlLabel').textContent = mode === 'par' ? 'PAR APPROACH ACTIONS'
      : mode === 'sra' ? 'SRA APPROACH ACTIONS' : 'SURVEILLANCE ACTIONS';
    byId('approachControlHint').textContent = approachMode
      ? 'Heading, descent, visual acquisition and missed-approach training controls.'
      : 'Position reports remain tied to the discrete surveillance picture.';
  }

  function onSessionEvent(event) {
    const snapshot = event.snapshot;
    if (event.kind === 'pilot-playback' && event.transmissionId === state.transmission?.id) {
      if (event.phase === 'started' && !state.transmission.audioStarted) {
        state.transmission.audioStarted = true; state.transmission.expiresAt = radioNow() + 30;
      }
      else if (event.phase === 'ended') finishTransmission();
      else if (event.phase === 'unavailable') state.transmission.expiresAt = Math.min(state.transmission.expiresAt, radioNow() + state.transmission.captionSeconds);
    }
    if (event.kind === 'student-ready') state.radioAudio = event.audioMode === 'audio';
    if (event.kind === 'student-preferences') state.radioAudio = event.preferences.audioEnabled;
    if (event.kind === 'join-requested') {
      state.pendingClient = event.clientId;
      byId('studentStatus').textContent = 'JOIN REQUEST RECEIVED';
      byId('studentDetail').textContent = 'Admit this controller position when ready.';
      byId('admitStudent').hidden = false; byId('rejectStudent').hidden = false;
    } else if (event.kind === 'student-admitted') {
      byId('studentStatus').textContent = 'ADMITTED · NOT READY';
      byId('studentDetail').textContent = 'Waiting for the controller position to confirm Ready.';
      byId('admitStudent').hidden = true; byId('rejectStudent').hidden = true;
    } else if (event.kind === 'student-ready') {
      byId('studentStatus').textContent = 'POSITION READY';
      byId('studentDetail').textContent = 'The exercise can now start.';
      byId('startExercise').disabled = false;
    } else if (event.kind === 'student-disconnected') {
      byId('studentStatus').textContent = 'POSITION DISCONNECTED';
      if (state.running) suspendExercise('STUDENT DISCONNECTED · exercise paused. Reconnect before resuming.');
    } else if (event.kind === 'student-rejoined') {
      byId('studentStatus').textContent = 'POSITION RECONNECTED';
      byId('studentDetail').textContent = 'Student display restored. Audio starts muted after refresh.';
    } else if (event.kind === 'terminated') {
      byId('studentStatus').textContent = 'SESSION CLOSED';
    }
    if (snapshot) byId('sessionPin').textContent = snapshot.pin.replace(/(\d{3})(\d{3})/, '$1 $2');
    state.dirty = true;
  }

  async function createSession(event) {
    event.preventDefault();
    if (state.creating || !byId('scenarioForm').reportValidity()) return;
    state.creating = true;
    const submit = byId('scenarioForm').querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const input = scenarioInput(); state.initialScenario = structuredClone(input);
      const online = byId('exerciseConnection')?.value === 'online';
      const cloud = online ? await globalThis.ATCSuiteCloud.prepareHost(Session, status => {
        if (!status.connected) {
          setStudentDisplayStatus('ONLINE LINK · ' + status.error, 'attention');
          if (state.running) suspendExercise('ONLINE LINK LOST · exercise paused. Select Resume after reconnection.');
        }
      }) : null;
      state.cloudTransport = cloud?.transport || null;
      resetTrainingTimeRate(input.exerciseFamily);
      state.simulation = Core.setLifecycle(Core.createState(input), 'ready');
      state.sensor = createSensor(input);
      state.review = Sensors.createReviewTimeline();
      state.review.recordTruth(truthForReview());
      state.session = Session.createInstructorSession({
        publicMetadata: publicMetadata(input), storage: online ? undefined : localStorage,
        ...(cloud || {}),
        transportFactory: channelName => Session.createLocalSessionTransport({ channelName }),
        onEvent: onSessionEvent
      });
      byId('sessionPin').textContent = state.session.pin.replace(/(\d{3})(\d{3})/, '$1 $2');
      byId('sessionConnectionLabel').textContent = online ? 'Online · internet on both devices' : 'Offline · same PC and browser profile · Extend displays';
      byId('setupPanel').hidden = true; byId('activeWorkspace').hidden = false;
      document.body.classList.add('exercise-console');
      byId('modeKicker').textContent = modeLabel(input.exerciseFamily);
      byId('scopeLabel').textContent = input.exerciseFamily === 'qgh' ? 'CONTINUOUS TRUTH · D/F PREVIEW' : 'CONTINUOUS TRUTH · SENSOR PREVIEW';
      byId('truthCallsign').textContent = input.callsign;
      renderAircraftTabs(); refreshSelectionInputs();
      configureActiveControls();
      byId('startExercise').disabled = true;
      updateAll();
      enterWorkspace(byId('activeWorkspace'));
      checkpoint();
      state.cloudTransport?.start();
      if (online) setStudentDisplayStatus('ONLINE ROOM · On the other PC/device open Controller position, select Online room and enter this PIN. Internet is required on both devices.');
      else openStudentDisplay();
    } catch (error) { state.cloudTransport?.close(); state.cloudTransport = null; byId('setupPreview').textContent = error.message; }
    finally { state.creating = false; if (submit) submit.disabled = false; }
  }

  function truthForSensor(simulation = state.simulation) {
    return { aircraft: simulation.aircraftList.map(aircraft => ({ id: aircraft.id, callsign: aircraft.callsign,
      position: { xNm: aircraft.position.xNm, yNm: aircraft.position.yNm },
      altitudeFt: aircraft.altitudeFt, headingDeg: aircraft.headingDeg,
      ...(aircraft.surveillance ? { surveillance: aircraft.surveillance } : {}) })),
      simulationSeconds: simulation.simulationSeconds };
  }

  function publishCurrentObservation() {
    if (!state.session || !state.sensor || !state.simulation) return;
    const mode = state.simulation.scenario.exerciseFamily;
    let observation;
    if (mode === 'qgh') observation = state.sensor.studentObservation('qdm', radioNow(), truthForSensor());
    else if (mode === 'par') observation = state.sensor.studentObservation();
    else observation = state.sensor.studentObservation(state.sra);
    state.session.publishObservation({ mode, ...observation }, state.simulation.simulationSeconds);
    state.latestObservation = observation;
    const signature = mode === 'qgh'
      ? `${state.simulation.simulationSeconds}:${observation.status}:${observation.callsign ?? ''}:${observation.bearingDeg ?? ''}`
      : mode === 'par' ? observation.timestamp : (observation.plots || []).map(plot => `${plot.trackId}:${plot.timestamp}`).join('|') || observation.plot?.timestamp;
    if (signature != null && signature !== state.lastRecordedObservation
      && observation && (observation.plots?.length || observation.plot || observation.bearingDeg != null || observation.rangeNm != null)) {
      state.review.recordObservation(mode, { ...observation, timestamp: state.simulation.simulationSeconds });
      state.lastRecordedObservation = signature;
    }
  }

  function advanceSensors(fromState, toState) {
    const mode = toState.scenario.exerciseFamily;
    const time = toState.simulationSeconds;
    if (mode === 'qgh') {
      const df = state.sensor.read(radioNow(), truthForSensor(toState));
      if (df.phase === 'live') state.sensor.update(truthForSensor(toState), radioNow());
      publishCurrentObservation();
      return;
    }
    const first = truthForSensor(fromState), second = truthForSensor(toState);
    const from = fromState.simulationSeconds, duration = Math.max(.0001, time - from);
    state.sensor.advance(time, sampleTime => {
      const fraction = Math.max(0, Math.min(1, (sampleTime - from) / duration));
      return { aircraft: second.aircraft.map((b, index) => {
        const a = first.aircraft[index];
        const turn = ((b.headingDeg - a.headingDeg + 540) % 360) - 180;
        return { id: b.id, callsign: b.callsign,
          position: { xNm: a.position.xNm + (b.position.xNm - a.position.xNm) * fraction,
            yNm: a.position.yNm + (b.position.yNm - a.position.yNm) * fraction },
          headingDeg: (a.headingDeg + turn * fraction + 360) % 360,
          altitudeFt: a.altitudeFt + (b.altitudeFt - a.altitudeFt) * fraction,
          ...(b.surveillance || a.surveillance ? { surveillance: b.surveillance || a.surveillance } : {}) };
      }), simulationSeconds: sampleTime };
    });
    publishCurrentObservation();
  }

  function advanceBy(seconds) {
    if (!state.simulation || !['running', 'paused'].includes(state.simulation.lifecycle)) return;
    const steps = Math.round(seconds / .25);
    for (let index = 0; index < steps; index += 1) {
      const previous = state.simulation;
      state.simulation = Core.advance(state.simulation, .25);
      state.review.recordTruth(truthForReview());
      advanceSensors(previous, state.simulation);
    }
    state.dirty = true;
  }

  function truthForReview() {
    return { timestamp: state.simulation.simulationSeconds, aircraft: state.simulation.aircraftList.map(a => ({
      id: a.id, callsign: a.callsign, xNm: a.position.xNm, yNm: a.position.yNm,
      headingDeg: a.headingDeg, altitudeFt: a.altitudeFt })) };
  }

  function frame(timestamp) {
    requestAnimationFrame(frame);
    if (state.previousFrame == null) state.previousFrame = timestamp;
    const elapsed = Math.min(1, Math.max(0, (timestamp - state.previousFrame) / 1000));
    state.previousFrame = timestamp;
    if (state.dirty) { state.dirty = false; updateAll(); }
    else if (!reducedMotion() && state.running && state.simulation?.scenario.exerciseFamily !== 'qgh') drawTruth(byId('instructorScope'), state.simulation, state.latestObservation);
    if (state.reviewPlaying) {
      state.reviewTime = Math.min(state.simulation.simulationSeconds, state.reviewTime + elapsed * number('reviewSpeed'));
      if (state.reviewTime >= state.simulation.simulationSeconds) state.reviewPlaying = false;
      drawReview(state.review.snapshot());
    }
  }

  function transferSelectedToPar() {
    if (!state.simulation || !['running', 'paused'].includes(state.simulation.lifecycle)) return false;
    const status = Core.parTransferStatus(state.simulation);
    if (!status.eligible) {
      byId('commandStatus').textContent = status.message;
      updateAll();
      return false;
    }
    // A handover is an instructor display transition, not a pilot RT call. End
    // any prior transmission before changing the student observation schema.
    finishTransmission();
    const result = Core.transferToPar(state.simulation);
    if (!result.outcome.accepted) {
      byId('commandStatus').textContent = result.outcome.error;
      updateAll();
      return false;
    }
    state.simulation = result.state;
    const scenario = state.simulation.scenario;
    state.sensor = createSensor({
      exerciseFamily: 'par', finalTrackDeg: scenario.finalTrackDeg,
      parApproachAircraftId: scenario.parApproachAircraftId, parRefreshHz: scenario.parRefreshHz,
      startSeconds: state.simulation.simulationSeconds
    });
    state.sra = null;
    state.latestObservation = null;
    state.lastRecordedObservation = null;
    const metadata = publicMetadataForSimulation();
    const sent = state.session?.updatePublicMetadata?.(metadata, state.simulation.simulationSeconds);
    state.review.recordEvent({ timestamp: result.outcome.timestamp, kind: 'par-transfer',
      aircraftId: result.outcome.aircraftId,
      xNm: state.simulation.aircraft.position.xNm, yNm: state.simulation.aircraft.position.yNm,
      readback: `TRANSFERRED ${state.simulation.aircraft.callsign} TO PAR · ${status.approachRangeNm.toFixed(1)} NM` });
    byId('commandStatus').textContent = sent === false
      ? 'PAR handover applied locally; controller position is unavailable.'
      : `TRANSFERRED ${state.simulation.aircraft.callsign} TO PAR · ${status.approachRangeNm.toFixed(1)} NM`;
    byId('transferToPar').classList.add('executed');
    setTimeout(() => byId('transferToPar')?.classList.remove('executed'), 900);
    byId('modeKicker').textContent = modeLabel('par');
    byId('scopeLabel').textContent = 'CONTINUOUS TRUTH · PAR PREVIEW';
    configureActiveControls();
    publishCurrentObservation();
    updateAll();
    return true;
  }

  function command(input, controlId) {
    if (!state.simulation || !['running', 'paused'].includes(state.simulation.lifecycle)) {
      return { outcome: { accepted: false, error: 'Exercise must be running or paused before a command can be issued.' } };
    }
    const result = Core.applyCommand(state.simulation, input);
    if (!result.outcome.accepted) { byId('commandStatus').textContent = result.outcome.error; return result; }
    finishTransmission();
    state.simulation = result.state;
    // The SRA descent aid presents the designated approach aircraft's current
    // configured speed. Refresh only when a speed command can affect that
    // public training cue; the underlying aircraft physics remains unchanged.
    if (input.type === 'set-speed' && ['sra', 'par'].includes(state.simulation.scenario.exerciseFamily)) {
      state.session?.updatePublicMetadata?.(publicMetadataForSimulation(), state.simulation.simulationSeconds);
    }
    state.review.recordEvent({ timestamp: result.outcome.timestamp, kind: 'command', command: result.outcome.command,
      aircraftId: result.outcome.readback.aircraftId,
      xNm: state.simulation.aircraftList.find(a => a.id === result.outcome.readback.aircraftId)?.position.xNm,
      yNm: state.simulation.aircraftList.find(a => a.id === result.outcome.readback.aircraftId)?.position.yNm,
      readback: result.outcome.readback.text });
    byId('commandStatus').textContent = result.outcome.readback.text;
    document.querySelectorAll('.command-deck button').forEach(button => button.classList.remove('executed'));
    byId(controlId)?.classList.add('executed');
    clearTimeout(state.readbackTimer);
    const captionSeconds = Math.max(3, Math.min(15, result.outcome.readback.text.split(/\s+/).length * 60 / 130 + 1));
    state.transmission = { id: result.outcome.readback.id, aircraftId: result.outcome.readback.aircraftId,
      text: result.outcome.readback.text, expiresAt: radioNow() + (state.radioAudio ? 30 : captionSeconds), captionSeconds, controlId };
    if (state.simulation.scenario.exerciseFamily === 'qgh') beginDfTransmission(result.outcome.readback.id, result.outcome.readback.aircraftId);
    state.session.publishCaption(result.outcome.readback.text, state.simulation.simulationSeconds, state.transmission.id);
    updateAll();
    return result;
  }

  function beginDfTransmission(readbackId, aircraftId) {
    clearTimeout(state.dfTimer);
    state.sensor.beginTransmission({ transmissionId: readbackId, source: aircraftId }, truthForSensor(), radioNow());
    publishCurrentObservation();
  }

  function finishTransmission() {
    if (!state.transmission) return;
    const active = state.transmission;
    state.transmission = null; clearTimeout(state.readbackTimer);
    state.simulation = Core.finishReadback(state.simulation, active.id);
    byId(active.controlId)?.classList.remove('executed');
    endDfTransmission();
  }

  function endDfTransmission() {
    if (!state.sensor || state.simulation?.scenario.exerciseFamily !== 'qgh') return;
    state.sensor.endTransmission(truthForSensor(), radioNow());
    publishCurrentObservation();
  }

  function startExercise() {
    if (state.cloudTransport && !state.cloudTransport.connected) { byId('commandStatus').textContent = 'Wait for the online connection before Start.'; return false; }
    if (!state.session || !state.simulation || ['running', 'paused', 'review'].includes(state.simulation.lifecycle)) return false;
    if (!state.session.start(state.simulation.simulationSeconds)) { byId('commandStatus').textContent = 'Controller position must be admitted and Ready.'; return false; }
    state.simulation = Core.setLifecycle(state.simulation, 'running'); state.running = true; state.previousFrame = null; state.previousTick = performance.now();
    byId('startExercise').disabled = true; byId('pauseExercise').disabled = false; byId('terminateExercise').disabled = false;
    setPhase('running'); updateAll();
    collapseSetupControls(); enterWorkspace(byId('activeWorkspace')); checkpoint();
    return true;
  }

  function pauseExercise() {
    if (state.simulation?.lifecycle === 'paused' && state.cloudTransport && !state.cloudTransport.connected) { byId('commandStatus').textContent = 'Wait for the online connection before Resume.'; return false; }
    if (!state.session || !state.simulation || !['running', 'paused'].includes(state.simulation.lifecycle)) return false;
    if (state.running) {
      state.running = false; state.session.pause(state.simulation.simulationSeconds);
      state.simulation = Core.setLifecycle(state.simulation, 'paused'); byId('pauseExercise').textContent = 'RESUME';
    } else {
      if (!state.session.resume(state.simulation.simulationSeconds)) return false;
      state.simulation = Core.setLifecycle(state.simulation, 'running'); state.previousTick = performance.now(); state.runtimeError = null;
      state.running = true; state.previousFrame = null; byId('pauseExercise').textContent = 'PAUSE';
    }
    updateAll();
    checkpoint();
    return true;
  }

  function terminateExercise() {
    if (!state.simulation || !['running', 'paused'].includes(state.simulation.lifecycle)) return;
    state.running = false; finishTransmission(); clearTimeout(state.readbackTimer); endDfTransmission();
    state.simulation = Core.setLifecycle(state.simulation, 'review');
    state.session.terminate('exercise-terminated', state.simulation.simulationSeconds);
    updateAll();
    state.reviewTime = state.simulation.simulationSeconds; state.reviewPlaying = false;
    byId('reviewScrub').max = String(state.reviewTime);
    byId('activeWorkspace').hidden = true; byId('reviewScreen').hidden = false; setPhase('review'); renderReview();
    enterWorkspace(byId('reviewScreen'));
    checkpoint();
  }

  function setPhase(name) { document.querySelectorAll('[data-phase]').forEach(item => item.classList.toggle('active', item.dataset.phase === name)); }

  function refreshSelectionInputs() {
    const aircraft = state.simulation.aircraft;
    byId('liveSpeed').value = String(Math.round(aircraft.speedKt));
    byId('altitudeInput').value = String(Math.round(aircraft.altitudeFt));
    byId('turnHeadingInput').value = String(Math.round(aircraft.headingDeg) % 360);
    byId('quickHeading').value = String(Math.round(aircraft.headingDeg) % 360);
  }

  function renderAircraftTabs() {
    const buttons = state.simulation.aircraftList.map(aircraft => {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = aircraft.callsign; button.dataset.aircraftId = aircraft.id;
      button.setAttribute('aria-label', `Control aircraft ${aircraft.callsign}`);
      button.addEventListener('click', () => selectAircraft(aircraft.id)); return button;
    });
    byId('aircraftRosterTabs').replaceChildren(...buttons);
  }

  function selectAircraft(aircraftId) {
    if (!state.simulation || state.simulation.lifecycle === 'review') return;
    state.simulation = Core.selectAircraft(state.simulation, aircraftId);
    refreshSelectionInputs(); updateAll();
  }

  function updateAll() {
    if (!state.simulation) return;
    const snapshot = Core.truthSnapshot(state.simulation), a = snapshot.aircraft, b = snapshot.bearing;
    focusMode?.setPhase(snapshot.lifecycle);
    byId('truthCallsign').textContent = a.callsign;
    for (const button of byId('aircraftRosterTabs').children) {
      const selected = button.dataset.aircraftId === a.id;
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    }
    const controllable = ['running', 'paused'].includes(snapshot.lifecycle);
    document.querySelectorAll('.command-grid button, .command-grid input, .command-grid select').forEach(control => { control.disabled = !controllable; });
    byId('pauseExercise').disabled = !controllable; byId('terminateExercise').disabled = !controllable;
    const transfer = snapshot.scenario.exerciseFamily === 'surveillance'
      ? Core.parTransferStatus(state.simulation) : null;
    byId('parTransferActions').hidden = true;
    if (transfer) {
      byId('parTransferGateStatus').textContent = transfer.message;
      byId('transferToPar').disabled = !controllable || !transfer.eligible;
      byId('transferToPar').title = transfer.message;
      byId('transferToPar').setAttribute('aria-describedby', 'parTransferGateStatus');
    }
    byId('truthHeading').textContent = `${pad(a.headingDeg)}°`;
    byId('truthBearing').textContent = `${pad(b.qteDeg)}°`;
    byId('truthRange').textContent = `${b.rangeNm.toFixed(1)} NM`;
    byId('truthAltitude').textContent = `${Math.round(a.altitudeFt).toLocaleString()} FT`;
    byId('truthSpeed').textContent = `${Math.round(a.speedKt)} KT`;
    byId('truthTurn').textContent = a.turn.mode === 'straight' ? 'STRAIGHT' : `${a.turn.side.toUpperCase()} · ${a.turn.mode.toUpperCase()}`;
    byId('truthSquawk').textContent = a.transponderCode || a.surveillance?.squawk || '—';
    byId('truthSurveillance').textContent = a.surveillance?.secondary === true
      ? a.surveillance.modeS === true ? 'SECONDARY · MODE S' : 'SECONDARY'
      : 'PRIMARY / NONE';
    byId('instructorClock').textContent = clock(snapshot.simulationSeconds);
    byId('exerciseState').textContent = snapshot.lifecycle.toUpperCase();
    byId('modeKicker').textContent = modeLabel(snapshot.scenario.exerciseFamily);
    byId('scopeLabel').textContent = snapshot.scenario.exerciseFamily === 'qgh'
      ? 'CONTINUOUS TRUTH · D/F PREVIEW'
      : snapshot.scenario.exerciseFamily === 'par' ? 'CONTINUOUS TRUTH · PAR PREVIEW'
        : 'CONTINUOUS TRUTH · SENSOR PREVIEW';
    byId('sensorPreview').textContent = sensorStatus();
    byId('compactPin').textContent = state.session?.pin || '—';
    byId('sessionPin').textContent = (state.session?.pin || '—').replace(/(\d{3})(\d{3})/, '$1 $2');
    byId('compactConnection').textContent = byId('studentStatus').textContent || 'Waiting';
    byId('quickAircraftStatus').textContent = `${a.callsign} · ${pad(a.headingDeg)}°M · ${Math.round(a.altitudeFt)} FT · ${Math.round(a.speedKt)} KT`;
    byId('instructorHoming').hidden = snapshot.scenario.exerciseFamily !== 'qgh';
    document.querySelectorAll('.quick-aircraft-controls button, .quick-aircraft-controls input, #quickTransmit').forEach(control => { control.disabled = !controllable; });
    const us = isUsCompass();
    byId('quickHeadingLeft').hidden = us; byId('quickHeadingRight').hidden = us; byId('quickHeading').parentElement && (byId('quickHeading').parentElement.hidden = us);
    byId('instructorPilotCaption').textContent = state.transmission?.text || snapshot.readbacks?.at(-1)?.text || 'Awaiting a transmission.';
    if (snapshot.scenario.exerciseFamily === 'qgh') {
      const signal = state.sensor.read(radioNow(), truthForSensor());
      const bearing = byId('instructorDfReference').value === 'qte' ? signal.qte : signal.qdm;
      byId('instructorDfBearing').textContent = Number.isFinite(bearing) ? `${pad(bearing)}°` : '—';
      byId('instructorDfPhase').textContent = signal.phase === 'blank' ? 'No transmission' : String(signal.phase || 'idle').toUpperCase();
    }
    drawTruth(byId('instructorScope'), state.simulation, state.latestObservation);
    updateInspection();
    renderNewEvents();
  }

  function sensorStatus() {
    const mode = state.simulation.scenario.exerciseFamily, observation = state.latestObservation;
    if (!observation) return 'STUDENT SENSOR READY';
    if (mode === 'qgh') return `${String(observation.status || 'idle').toUpperCase()} · ${observation.bearingDeg == null ? '---' : pad(observation.bearingDeg) + '°'}`;
    if (mode === 'par') return `${String(observation.trackState || 'lost').toUpperCase()} · ${observation.rangeNm == null ? 'NO RANGE' : observation.rangeNm.toFixed(1) + ' NM'}`;
    return observation.plots?.length ? `${observation.plots.length} PLOTS · DISCRETE SENSOR PICTURE`
      : observation.plot ? `PLOT · ${observation.plot.rangeNm.toFixed(1)} NM` : 'AWAITING BEAM CROSSING';
  }

  function renderNewEvents() {
    const events = state.simulation.events;
    if (events.length === state.lastRenderedEvent) return;
    const log = byId('eventLog');
    events.slice(state.lastRenderedEvent).forEach(event => {
      const item = document.createElement('li'); const time = document.createElement('time'); const text = document.createElement('span');
      time.textContent = clock(event.timestamp); text.textContent = event.type.replaceAll('_', ' ') + (event.text ? ` · ${event.text}` : '');
      item.append(time, text); log.prepend(item);
    });
    state.lastRenderedEvent = events.length;
  }

  function drawBase(context, canvas, maxRange, runway, finalTrack = runway) {
    const width = canvas.width, height = canvas.height, cx = width / 2 + (canvas.id === 'instructorScope' ? state.scopePan.x : 0), cy = height / 2 + (canvas.id === 'instructorScope' ? state.scopePan.y : 0);
    context.clearRect(0, 0, width, height); context.fillStyle = '#0e1319'; context.fillRect(0, 0, width, height);
    context.strokeStyle = '#1d5551'; context.lineWidth = 1; context.fillStyle = '#79aaa4'; context.font = '16px IBM Plex Mono';
    for (let range = 10; range <= maxRange; range += 10) { const radius = range / maxRange * Math.min(width, height) * .44; context.beginPath(); context.arc(cx, cy, radius, 0, Math.PI * 2); context.stroke(); context.fillText(`${range}`, cx + 4, cy - radius + 17); }
    context.beginPath(); context.moveTo(cx, 22); context.lineTo(cx, height - 22); context.moveTo(22, cy); context.lineTo(width - 22, cy); context.stroke();
    const scale = Math.min(width, height) * .44 / maxRange;
    const finalAngle = finalTrack * Math.PI / 180, length = Math.min(width, height) * .42;
    context.strokeStyle = '#758f82'; context.lineWidth = 1; context.setLineDash([7, 8]);
    context.beginPath(); context.moveTo(cx - Math.sin(finalAngle) * length, cy + Math.cos(finalAngle) * length);
    context.lineTo(cx + Math.sin(finalAngle) * length, cy - Math.cos(finalAngle) * length); context.stroke(); context.setLineDash([]);
    const angle = runway * Math.PI / 180, runwayHalfLength = Math.max(6, scale * .8);
    context.strokeStyle = '#d5dec8'; context.lineWidth = 6; context.beginPath();
    context.moveTo(cx - Math.sin(angle) * runwayHalfLength, cy + Math.cos(angle) * runwayHalfLength);
    context.lineTo(cx + Math.sin(angle) * runwayHalfLength, cy - Math.cos(angle) * runwayHalfLength); context.stroke();
    context.fillStyle = '#b8d1ca'; context.fillText(`RWY ${pad(runway)} / ${pad(runway + 180)}`, cx + 12, cy + 22);
    return { cx, cy, scale };
  }

  function displayRange() {
    const simulation = state.simulation;
    const selected = Number(byId('scopeRange').value);
    if (selected >= 10) return selected;
    return Math.max(30, ...simulation.aircraftList.map(a => Math.hypot(a.position.xNm, a.position.yNm) * 1.3),
      ...Object.values(simulation.truthTrails).map(trail => Math.hypot(trail[0].xNm, trail[0].yNm) * 1.3));
  }

  function drawAircraft(context, transform, aircraft, selected) {
    const x = transform.cx + aircraft.xNm * transform.scale, y = transform.cy + aircraft.yNm * transform.scale;
    if (selected) { context.strokeStyle = '#efa93a'; context.lineWidth = 2; context.beginPath(); context.arc(x, y, 22, 0, Math.PI * 2); context.stroke(); }
    context.save(); context.translate(x, y); context.rotate(aircraft.headingDeg * Math.PI / 180);
    context.fillStyle = selected ? '#fff7d5' : '#9fe1d9'; context.beginPath(); context.moveTo(0, -14);
    context.lineTo(9, 10); context.lineTo(0, 6); context.lineTo(-9, 10); context.closePath(); context.fill(); context.restore();
    context.fillStyle = selected ? '#fff7d5' : '#9fe1d9'; context.font = '14px IBM Plex Mono';
    const lines = [aircraft.callsign, ...(selected ? [`${Math.round(aircraft.altitudeFt)} FT · ${Math.round(aircraft.speedKt)} KT`, `${pad(aircraft.headingDeg)}°M`] : [])];
    const width = Math.max(...lines.map(line => context.measureText(line)?.width || line.length * 8));
    const labelX = Math.max(5, Math.min(x + 16, context.canvas?.width ? context.canvas.width - width - 5 : x + 16));
    for (let i = 0; i < lines.length; i++) context.fillText(lines[i], labelX, Math.max(16, y - 12) + i * 16);
  }

  function drawPlots(context, transform, observation) {
    for (const plot of observation?.plots || (observation?.plot ? [observation.plot] : [])) {
      const rad = plot.azimuthDeg * Math.PI / 180, r = plot.rangeNm * transform.scale;
      context.strokeStyle = '#efa93a'; context.lineWidth = 2; context.beginPath();
      context.arc(transform.cx + Math.sin(rad) * r, transform.cy - Math.cos(rad) * r, 7, 0, Math.PI * 2); context.stroke();
    }
  }

  function drawTruth(canvas, simulation, observation) {
    const bounds = canvas.getBoundingClientRect?.();
    if (bounds?.width > 0 && bounds?.height > 0) { canvas.width = Math.round(bounds.width); canvas.height = Math.round(bounds.height); }
    const context = canvas.getContext('2d');
    const transform = drawBase(context, canvas, displayRange(), simulation.scenario.runwayOrientationDeg, simulation.scenario.finalTrackDeg);
    state.scopeTransform = transform;
    for (const aircraft of simulation.aircraftList) {
      const selected = aircraft.id === simulation.selectedAircraftId, trail = simulation.truthTrails[aircraft.id];
      if (byId('historyDots').checked && trail.length > 1) {
        context.fillStyle = selected ? '#83c6ca' : '#658d94';
        const count = Math.min(12, Math.max(5, Number(byId('truthTrailCount').value) || 8));
        const spacingNm = 8 / transform.scale;
        let anchor = { xNm: aircraft.position.xNm, yNm: aircraft.position.yNm }, shown = 0;
        for (let index = trail.length - 1; index >= 0 && shown < count; index--) {
          const point = trail[index];
          if (Math.hypot(point.xNm - anchor.xNm, point.yNm - anchor.yNm) < spacingNm) continue;
          context.beginPath(); context.arc(transform.cx + point.xNm * transform.scale, transform.cy + point.yNm * transform.scale, selected ? 2.8 : 2.2, 0, Math.PI * 2); context.fill();
          anchor = point; shown++;
        }
      }
      drawAircraft(context, transform, { ...aircraft, ...aircraft.position }, selected);
    }
    if (simulation.scenario.exerciseFamily === 'qgh') {
      const signal = state.sensor.read(radioNow(), truthForSensor());
      const source = simulation.aircraftList.find(a => a.id === signal.source);
      if (['live', 'held'].includes(signal.phase) && source) {
        context.strokeStyle = '#efa93a'; context.lineWidth = 2; context.beginPath(); context.moveTo(transform.cx, transform.cy);
        context.lineTo(transform.cx + source.position.xNm * transform.scale, transform.cy + source.position.yNm * transform.scale); context.stroke();
      }
    }
    drawPlots(context, transform, observation);
    if (simulation.scenario.exerciseFamily !== 'qgh') {
      if (!reducedMotion()) {
        const scanTime = simulation.simulationSeconds + (state.running ? Math.max(0, (performance.now() - state.previousTick) / 1000) * state.trainingTimeRate : 0);
        const angle = (scanTime * 90 - 90) * Math.PI / 180;
        const radius = Math.min(canvas.width, canvas.height) * .44;
        context.strokeStyle = 'rgba(90,210,164,.5)'; context.lineWidth = 1; context.beginPath(); context.moveTo(transform.cx, transform.cy);
        context.lineTo(transform.cx + Math.cos(angle) * radius, transform.cy + Math.sin(angle) * radius); context.stroke();
      }
      if (simulation.scenario.exerciseFamily === 'sra') drawInstructorSra(context, transform, simulation);
    }
  }

  function drawInstructorSra(context, transform, simulation) {
    const angle = (simulation.scenario.finalTrackDeg + 180) * Math.PI / 180;
    const feetPerNm = Math.tan(3 * Math.PI / 180) * 6076.12;
    context.strokeStyle = '#d8c780'; context.fillStyle = '#d8c780'; context.font = '11px IBM Plex Mono';
    let lastLabel = null;
    for (let distance = .5; distance <= Math.min(20, displayRange()); distance += distance < 5 ? .5 : 1) {
      const x = transform.cx + Math.sin(angle) * distance * transform.scale, y = transform.cy - Math.cos(angle) * distance * transform.scale;
      const dx = Math.cos(angle) * (distance % 1 ? 4 : 7), dy = Math.sin(angle) * (distance % 1 ? 4 : 7);
      context.beginPath(); context.moveTo(x - dx, y - dy); context.lineTo(x + dx, y + dy); context.stroke();
      if (!lastLabel || Math.hypot(x - lastLabel.x, y - lastLabel.y) >= 32) {
        context.fillText(`${distance} NM · ${Math.round(feetPerNm * distance / 10) * 10} FT AAL`, x + 10, y + 4); lastLabel = { x, y };
      }
    }
  }

  function inspectScope(event, select = false) {
    if (!state.simulation || !state.scopeTransform) return;
    const canvas = byId('instructorScope'), bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * canvas.width / bounds.width;
    const y = (event.clientY - bounds.top) * canvas.height / bounds.height, t = state.scopeTransform;
    const nearest = state.simulation.aircraftList.map(a => ({ a,
      distance: Math.hypot(x - t.cx - a.position.xNm * t.scale, y - t.cy - a.position.yNm * t.scale) }))
      .sort((a, b) => a.distance - b.distance)[0];
    const hitRadius = 26 * canvas.width / bounds.width;
    state.inspectedAircraftId = nearest?.distance <= hitRadius ? nearest.a.id : null;
    if (select && state.inspectedAircraftId) selectAircraft(state.inspectedAircraftId);
    updateInspection();
    return state.inspectedAircraftId;
  }

  function updateInspection() {
    const aircraft = state.simulation.aircraftList.find(a => a.id === state.inspectedAircraftId);
    if (!aircraft) { byId('scopeInspection').textContent = 'Drag to pan · click aircraft to transmit · double left/right to turn · middle click to stop.'; return; }
    const bearing = Core.bearingFromPosition(aircraft.position);
    const surveillance = aircraft.surveillance?.secondary === true
      ? ` · SQWK ${aircraft.transponderCode || aircraft.surveillance.squawk || '—'}${aircraft.surveillance.modeS === true ? ' · MODE S' : ''}`
      : ` · SQWK ${aircraft.transponderCode || '—'} · PRIMARY / NONE`;
    byId('scopeInspection').textContent = `${aircraft.callsign} · QDM ${pad(bearing.qdmDeg)}° · QTE ${pad(bearing.qteDeg)}° · HDG ${pad(aircraft.headingDeg)}° · ${bearing.rangeNm.toFixed(1)} NM · ${Math.round(aircraft.altitudeFt).toLocaleString()} FT${surveillance}`;
  }

  function scopeTransmit() {
    return command({ type: state.simulation?.scenario.exerciseFamily === 'qgh' ? 'transmit' : 'report-position' }, 'quickTransmit');
  }

  function quickTurn(side) { return command({ type: 'turn-now', side }, side === 'left' ? 'quickTurnLeft' : 'quickTurnRight'); }

  function scopeClick(event) {
    if (performance.now() < state.suppressClickUntil || !inspectScope(event, true)) return;
    clearTimeout(state.clickTimer);
    state.clickTimer = setTimeout(() => { scopeTransmit(); }, 260);
  }

  function scopeDoubleClick(event) {
    event.preventDefault(); clearTimeout(state.clickTimer);
    if (inspectScope(event, true)) quickTurn('left');
  }

  function scopeRightClick(event) {
    event.preventDefault();
    const id = inspectScope(event, true), now = performance.now();
    if (!id) return;
    if (state.lastRightClick?.id === id && now - state.lastRightClick.time <= 450) { quickTurn('right'); state.lastRightClick = null; }
    else state.lastRightClick = { id, time: now };
  }

  function scopePointerDown(event) {
    if (event.button === 1) {
      event.preventDefault(); clearTimeout(state.clickTimer);
      if (inspectScope(event, true)) command({ type: 'stop-turn' }, 'quickStopTurn');
      return;
    }
    if (event.button !== 0 || inspectScope(event)) return;
    state.scopeDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, pan: { ...state.scopePan }, moved: false };
    byId('instructorScope').setPointerCapture?.(event.pointerId);
  }

  function scopePointerMove(event) {
    const drag = state.scopeDrag;
    if (!drag || drag.pointerId !== event.pointerId) { inspectScope(event); return; }
    const canvas = byId('instructorScope'), bounds = canvas.getBoundingClientRect();
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    drag.moved ||= Math.hypot(dx, dy) > 4;
    if (drag.moved) {
      state.scopePan = { x: drag.pan.x + dx * canvas.width / bounds.width, y: drag.pan.y + dy * canvas.height / bounds.height };
      state.suppressClickUntil = performance.now() + 500; updateAll();
    }
  }

  function scopePointerEnd(event) {
    if (state.scopeDrag?.pointerId !== event.pointerId) return;
    byId('instructorScope').releasePointerCapture?.(event.pointerId); state.scopeDrag = null;
  }

  function renderReview() {
    const record = state.review.snapshot(), simulation = state.simulation;
    byId('reviewMode').textContent = modeLabel(simulation.scenario.exerciseFamily);
    byId('reviewDuration').textContent = clock(simulation.simulationSeconds);
    byId('reviewCommandCount').textContent = String(record.events.length);
    byId('reviewObservationCount').textContent = String(record.observations.length);
    const bearing = Core.bearingFromPosition(simulation.aircraft.position);
    byId('reviewEndState').textContent = `${simulation.aircraftList.length} AIRCRAFT · ${simulation.aircraft.callsign}: ${bearing.rangeNm.toFixed(1)} NM`;
    drawReview(record);
  }

  function drawReview(record) {
    const canvas = byId('reviewScope'), context = canvas.getContext('2d');
    const transform = drawBase(context, canvas, displayRange(), state.simulation.scenario.runwayOrientationDeg, state.simulation.scenario.finalTrackDeg);
    const enabled = Object.fromEntries([...document.querySelectorAll('[data-review-layer]')].map(control => [control.dataset.reviewLayer, control.checked]));
    const truth = record.truth.filter(item => item.timestamp <= state.reviewTime);
    const events = record.events.filter(item => item.timestamp <= state.reviewTime);
    if (enabled.truth) {
      const tracks = new Map();
      for (const sample of truth) for (const aircraft of sample.aircraft || []) {
        if (!tracks.has(aircraft.id)) tracks.set(aircraft.id, []);
        tracks.get(aircraft.id).push(aircraft);
      }
      for (const points of tracks.values()) {
        context.strokeStyle = '#2bd1c6'; context.lineWidth = 2; context.beginPath();
        points.forEach((point, index) => { const x = transform.cx + point.xNm * transform.scale, y = transform.cy + point.yNm * transform.scale; index ? context.lineTo(x, y) : context.moveTo(x, y); }); context.stroke();
        drawAircraft(context, transform, points[points.length - 1], false);
      }
    }
    if (enabled.observations) {
      const observations = record.observations.filter(item => item.timestamp <= state.reviewTime);
      for (const item of observations) drawPlots(context, transform, item);
      const last = observations[observations.length - 1];
      if (last?.sensor === 'qgh' && last.bearingDeg != null) {
        const rad = (last.bearingDeg + (last.bearingType === 'qdm' ? 180 : 0)) * Math.PI / 180;
        context.strokeStyle = '#efa93a'; context.lineWidth = 2; context.beginPath(); context.moveTo(transform.cx, transform.cy);
        context.lineTo(transform.cx + Math.sin(rad) * canvas.height * .44, transform.cy - Math.cos(rad) * canvas.height * .44); context.stroke();
      }
      if (last?.sensor === 'par') {
        context.fillStyle = '#efa93a'; context.font = '16px IBM Plex Mono';
        context.fillText(`PAR ${last.trackState} · ${last.rangeNm == null ? 'NO RANGE' : last.rangeNm.toFixed(1) + ' NM'}`, 25, 30);
        const az = last.azimuth?.deviationDeg, el = last.elevation?.deviationDeg;
        context.fillText(`AZ ${az == null ? '—' : az.toFixed(2) + '°'} · ELEV ${el == null ? '—' : el.toFixed(2) + '°'}`, 25, 52);
      }
    }
    const list = byId('reviewEvents'); list.replaceChildren();
    if (enabled.events) for (const event of events.slice().reverse()) {
      const item = document.createElement('li'); item.textContent = `${clock(event.timestamp)} · ${event.readback || event.kind}`; list.append(item);
      if (Number.isFinite(event.xNm) && Number.isFinite(event.yNm)) {
        context.fillStyle = '#ffb9a5'; context.fillRect(transform.cx + event.xNm * transform.scale - 4, transform.cy + event.yNm * transform.scale - 4, 8, 8);
      }
    }
    byId('reviewScrub').value = String(state.reviewTime); byId('reviewTime').textContent = clock(state.reviewTime);
    byId('reviewPlay').textContent = state.reviewPlaying ? 'PAUSE' : 'PLAY';
  }

  function isEditableKeyboardTarget(target) {
    if (!target) return false;
    if (target.isContentEditable) return true;
    return Boolean(target.closest?.('input, select, textarea, [contenteditable], [role="textbox"]'));
  }

  function isShortcutInteractionTarget(target) {
    return isEditableKeyboardTarget(target)
      || Boolean(target?.closest?.('button, a, summary, [role="button"]'));
  }

  function commandFeedback(message, accepted) {
    const output = byId('keyboardCommandStatus');
    if (!output) return;
    output.textContent = message;
    output.setAttribute('data-state', accepted === true ? 'accepted' : accepted === false ? 'rejected' : 'ready');
  }

  function commandAccepted(message) { return { accepted: true, message }; }
  function commandRejected(message) { return { accepted: false, message }; }

  function selectedAircraftLabel() {
    return state.simulation?.aircraft?.callsign || 'selected aircraft';
  }

  function isControllableLifecycle() {
    return Boolean(state.simulation && ['running', 'paused'].includes(state.simulation.lifecycle));
  }

  // The command bar intentionally accepts a small, documented grammar. It does
  // not infer free-form language, call signs or intent: that keeps keyboard
  // training deterministic and prevents a partially typed instruction acting.
  function parseKeyboardCommand(value) {
    const text = String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
    if (!text) return commandRejected('Type HELP to see the accepted command-bar grammar.');
    if (text === 'HELP' || text === '?') return { accepted: true, action: 'help' };
    const direct = globalThis.ATCSuiteCommandReference.direct;
    if (direct[text]) return { accepted: true, action: direct[text] };
    const heading = text.match(/^(?:TURN\s+)?(L|LEFT|R|RIGHT)(?:\s+HEADING)?\s+(\d{1,3})$/);
    if (heading) return { accepted: true, action: 'turn-heading', side: /^L/.test(heading[1]) ? 'left' : 'right', headingDeg: Number(heading[2]) };
    const speed = text.match(/^(SPD|SPEED)\s+(\d{1,3})$/);
    if (speed) return { accepted: true, action: 'set-speed', speedKt: Number(speed[2]) };
    const altitude = text.match(/^(ALT|ALTITUDE)\s+(\d{1,5})$/);
    if (altitude) return { accepted: true, action: 'set-altitude', altitudeFt: Number(altitude[2]) };
    const vertical = text.match(/^(CLIMB|DESCEND|MAINTAIN)(?:\s+TO|\s+AT)?\s+(\d{1,5})$/);
    if (vertical) return { accepted: true, action: 'set-altitude', altitudeFt: Number(vertical[2]), verticalMode: vertical[1].toLowerCase() };
    return commandRejected('Not recognised. Use HELP for exact aliases; the command bar does not guess.');
  }

  function validateBarNumber(value, label, minimum, maximum, increment) {
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      return commandRejected(`${label} must be a whole number from ${minimum} to ${maximum}.`);
    }
    if (increment && value % increment !== 0) return commandRejected(`${label} must use ${increment}-unit increments.`);
    return commandAccepted('VALID');
  }

  function invokeCoreCommand(input, controlId) {
    const result = command(input, controlId);
    if (!result?.outcome?.accepted) return commandRejected(result?.outcome?.error || 'Command was not applied.');
    return commandAccepted(`${selectedAircraftLabel()} · ${result.outcome.readback.text}`);
  }

  function selectRelativeAircraft(direction) {
    if (!state.simulation || state.simulation.lifecycle === 'review') return commandRejected('Aircraft selection is unavailable after termination.');
    const aircraft = state.simulation.aircraftList;
    const index = aircraft.findIndex(item => item.id === state.simulation.selectedAircraftId);
    selectAircraft(aircraft[(index + direction + aircraft.length) % aircraft.length].id);
    return commandAccepted(`SELECTED ${selectedAircraftLabel()}`);
  }

  function requireControllable() {
    return isControllableLifecycle() ? null : commandRejected('Exercise must be running or paused before issuing this command.');
  }

  function isUsCompass() {
    return state.simulation?.scenario.exerciseFamily === 'qgh' && state.simulation.scenario.qghProcedure === 'us';
  }

  function performInstructorAction(plan) {
    if (!state.simulation) return commandRejected('Create a local session before using instructor controls.');
    if (plan.action === 'help') {
      byId('keyboardShortcuts').open = true;
      return commandAccepted('OPENED THE SHORTCUT AND COMMAND REFERENCE.');
    }
    if (plan.action === 'next') return selectRelativeAircraft(1);
    if (plan.action === 'previous') return selectRelativeAircraft(-1);
    if (plan.action === 'start') {
      if (state.simulation.lifecycle !== 'ready') return commandRejected('START is available only while the exercise is Ready.');
      return startExercise() ? commandAccepted('EXERCISE STARTED.') : commandRejected(byId('commandStatus').textContent || 'Controller position must be Ready.');
    }
    if (plan.action === 'pause') {
      if (state.simulation.lifecycle !== 'running') return commandRejected('PAUSE is available only while the exercise is running.');
      return pauseExercise() ? commandAccepted('EXERCISE PAUSED.') : commandRejected('Exercise could not be paused.');
    }
    if (plan.action === 'resume') {
      if (state.simulation.lifecycle !== 'paused') return commandRejected('RESUME is available only while the exercise is paused.');
      return pauseExercise() ? commandAccepted('EXERCISE RESUMED.') : commandRejected('Exercise could not be resumed.');
    }
    if (plan.action === 'lifecycle-toggle') {
      if (state.simulation.lifecycle === 'ready') return performInstructorAction({ action: 'start' });
      if (state.simulation.lifecycle === 'running') return performInstructorAction({ action: 'pause' });
      if (state.simulation.lifecycle === 'paused') return performInstructorAction({ action: 'resume' });
      return commandRejected('Start, pause and resume are unavailable after termination.');
    }

    const unavailable = requireControllable();
    if (unavailable) return unavailable;
    const mode = state.simulation.scenario.exerciseFamily;
    const us = isUsCompass();
    if (plan.action === 'turn-heading') {
      const validity = validateBarNumber(plan.headingDeg, 'Heading', 0, 359);
      if (!validity.accepted) return validity;
      if (us) return commandRejected('Use LEFT NOW, RIGHT NOW or STOP in U/S Compass QGH.');
      byId('turnHeadingInput').value = String(plan.headingDeg);
      return invokeCoreCommand({ type: 'turn-to-heading', side: plan.side, headingDeg: plan.headingDeg }, plan.side === 'left' ? 'turnLeftHeading' : 'turnRightHeading');
    }
    if (plan.action === 'turn-left-now' || plan.action === 'turn-right-now') {
      if (!us) return commandRejected('NOW turns are available only in U/S Compass QGH.');
      const side = plan.action === 'turn-left-now' ? 'left' : 'right';
      return invokeCoreCommand({ type: 'turn-now', side }, side === 'left' ? 'turnLeftNow' : 'turnRightNow');
    }
    if (plan.action === 'stop-turn') {
      if (!us) return commandRejected('STOP is available only in U/S Compass QGH.');
      return invokeCoreCommand({ type: 'stop-turn' }, 'stopTurnNow');
    }
    if (plan.action === 'set-speed') {
      const validity = validateBarNumber(plan.speedKt, 'Speed', 60, 600, 5);
      if (!validity.accepted) return validity;
      byId('liveSpeed').value = String(plan.speedKt);
      return invokeCoreCommand({ type: 'set-speed', speedKt: plan.speedKt }, 'liveSpeed');
    }
    if (plan.action === 'set-altitude') {
      const validity = validateBarNumber(plan.altitudeFt, 'Altitude', 500, 45000, 100);
      if (!validity.accepted) return validity;
      const difference = plan.altitudeFt - state.simulation.aircraft.altitudeFt;
      const inferredDirection = Math.abs(difference) < .01 ? 'maintain' : difference > 0 ? 'climb' : 'descend';
      const direction = plan.verticalMode || inferredDirection;
      if (plan.verticalMode && direction !== inferredDirection) {
        return commandRejected(`${plan.verticalMode.toUpperCase()} does not match the selected aircraft's current altitude.`);
      }
      byId('altitudeInput').value = String(plan.altitudeFt);
      return invokeCoreCommand({ type: 'set-altitude', direction, altitudeFt: plan.altitudeFt }, direction === 'climb' ? 'climbTo' : direction === 'descend' ? 'descendTo' : 'altitudeInput');
    }
    if (plan.action === 'transmit') {
      if (mode !== 'qgh') return commandRejected('D/F transmit is available only in QGH.');
      return invokeCoreCommand({ type: 'transmit' }, 'transmitDf');
    }
    if (plan.action === 'report-heading') {
      if (us) return commandRejected('Heading reports are unavailable in U/S Compass QGH.');
      return invokeCoreCommand({ type: 'report-heading' }, 'reportHeading');
    }
    if (plan.action === 'report-position') {
      if (mode === 'qgh') return commandRejected('Position reports are available only in Surveillance, SRA or PAR.');
      return invokeCoreCommand({ type: 'report-position' }, 'reportPosition');
    }
    if (plan.action === 'report') return mode === 'qgh'
      ? performInstructorAction({ action: 'report-heading' })
      : performInstructorAction({ action: 'report-position' });
    if (plan.action === 'advance') {
      advanceBy(60);
      return commandAccepted(`ADVANCED ONE MINUTE · ${selectedAircraftLabel()} REMAINS SELECTED.`);
    }
    if (plan.action === 'continue') {
      if (us) return commandRejected('CONTINUE is unavailable in U/S Compass QGH.');
      if (['sra', 'par'].includes(mode)) return invokeCoreCommand({ type: 'continue-approach' }, 'continueApproach');
      return invokeCoreCommand({ type: 'continue-heading', headingDeg: number('turnHeadingInput') }, 'continueHeading');
    }
    if (plan.action === 'visual') {
      if (!['sra', 'par'].includes(mode)) return commandRejected('VISUAL is available only in SRA or PAR.');
      return invokeCoreCommand({ type: 'report-runway-visual' }, 'reportRunwayVisual');
    }
    if (plan.action === 'missed') {
      if (!['sra', 'par'].includes(mode)) return commandRejected('MISSED is available only in SRA or PAR.');
      const target = Math.min(45000, Math.ceil((state.simulation.aircraft.altitudeFt + 3000) / 100) * 100);
      byId('altitudeInput').value = String(target);
      return invokeCoreCommand({ type: 'set-altitude', direction: 'climb', altitudeFt: target }, 'missedApproach');
    }
    if (plan.action === 'transfer-par') {
      if (mode !== 'surveillance') return commandRejected('TRANSFER PAR is available only from Surveillance Vectoring.');
      return transferSelectedToPar()
        ? commandAccepted(`TRANSFERRED ${selectedAircraftLabel()} TO PAR.`)
        : commandRejected(byId('commandStatus').textContent || 'Selected aircraft is not eligible for PAR transfer.');
    }
    return commandRejected('This command is not available in the current mode.');
  }

  function executeKeyboardCommand(rawValue = byId('keyboardCommandInput').value) {
    const parsed = parseKeyboardCommand(rawValue);
    const result = parsed.accepted ? performInstructorAction(parsed) : parsed;
    commandFeedback(`${result.accepted ? 'APPLIED' : 'REJECTED'} · ${result.message || 'NO ACTION'}`, result.accepted);
    if (result.accepted && parsed.action !== 'help') byId('keyboardCommandInput').value = '';
    return result;
  }

  function shortcutActionForKey(key) {
    const us = isUsCompass();
    if (key === '[') return { action: 'previous' };
    if (key === ']') return { action: 'next' };
    if (key === ' ' || key === 'spacebar') return { action: 'lifecycle-toggle' };
    if (key === 'a') return us ? { action: 'turn-left-now' } : { action: 'turn-heading', side: 'left', headingDeg: number('turnHeadingInput') };
    if (key === 'd') return us ? { action: 'turn-right-now' } : { action: 'turn-heading', side: 'right', headingDeg: number('turnHeadingInput') };
    if (key === 'x') return { action: 'stop-turn' };
    if (key === 't') return { action: 'transmit' };
    if (key === 'h') return { action: 'report-heading' };
    if (key === 'p') return { action: 'report-position' };
    if (key === 'c') return { action: 'continue' };
    if (key === 'v') return { action: 'visual' };
    if (key === 'm') return { action: 'missed' };
    if (key === 'g') return { action: 'advance' };
    return null;
  }

  function handleShortcut(event) {
    if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey
      || isShortcutInteractionTarget(event.target) || byId('trainingGuide')?.open || !state.simulation || state.simulation.lifecycle === 'review') return;
    const plan = shortcutActionForKey(String(event.key || '').toLowerCase());
    if (!plan) return;
    event.preventDefault();
    const result = performInstructorAction(plan);
    if (!result.accepted) commandFeedback(`REJECTED · ${result.message}`, false);
    else commandFeedback(`APPLIED · ${result.message}`, true);
  }

  function handleSetupInput(event) {
    const target = event.target;
    if (typeof target?.id === 'string' && (target.id === 'radarReturn' || /^radarReturn-\d+$/.test(target.id))) {
      target.dataset.radarReturnAuto = 'false';
    }
    configureFields();
    saveSetup();
  }

  family.addEventListener('change', () => { resetTrainingTimeRate(family.value); configureFields(); }); byId('scenarioForm').addEventListener('input', handleSetupInput); byId('scenarioForm').addEventListener('change', handleSetupInput); byId('scenarioForm').addEventListener('submit', createSession);
  byId('saveExercisePreset').addEventListener('click', savePreset);
  byId('saveExercisePresetAs').addEventListener('click', savePresetAsNew);
  byId('duplicateExercisePreset').addEventListener('click', duplicatePreset);
  byId('renameExercisePreset').addEventListener('click', renamePreset);
  byId('removeExercisePreset').addEventListener('click', removePreset);
  byId('savedExercise').addEventListener('change', () => {
    const item = presets().find(entry => entry.id === byId('savedExercise').value);
    if (item) byId('savedExerciseName').value = item.name;
  });
  byId('loadExercisePreset').addEventListener('click', loadPreset);
  byId('exportExercisePreset').addEventListener('click', exportPreset);
  byId('importExercisePreset').addEventListener('change', importPreset);
  byId('copyPin').addEventListener('click', () => navigator.clipboard?.writeText(state.session.pin));
  byId('openStudentDisplay').addEventListener('click', openStudentDisplay);
  byId('moveStudentDisplay').addEventListener('click', () => { void moveStudentDisplay(); });
  byId('admitStudent').addEventListener('click', () => state.pendingClient && state.session.admit(state.pendingClient));
  byId('rejectStudent').addEventListener('click', () => state.pendingClient && state.session.reject(state.pendingClient));
  byId('releaseStudent').addEventListener('click', () => {
    if (!state.session?.releaseStudent()) return;
    state.running = false; finishTransmission();
    state.simulation = Core.setLifecycle(state.simulation, 'ready');
    state.accumulator = 0; state.radioAudio = false;
    byId('studentStatus').textContent = 'SEAT RELEASED';
    byId('studentDetail').textContent = 'The exercise is stopped. Open a Student Display and join with this PIN.';
    byId('startExercise').disabled = true; byId('pauseExercise').disabled = true;
    byId('pauseExercise').textContent = 'PAUSE'; updateAll();
  });
  byId('startExercise').addEventListener('click', startExercise); byId('pauseExercise').addEventListener('click', pauseExercise); byId('terminateExercise').addEventListener('click', terminateExercise);
  byId('executeKeyboardCommand').addEventListener('click', () => executeKeyboardCommand());
  byId('keyboardCommandInput').addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault(); executeKeyboardCommand();
  });
  byId('turnLeftHeading').addEventListener('click', () => command({ type: 'turn-to-heading', side: 'left', headingDeg: number('turnHeadingInput') }, 'turnLeftHeading'));
  byId('turnRightHeading').addEventListener('click', () => command({ type: 'turn-to-heading', side: 'right', headingDeg: number('turnHeadingInput') }, 'turnRightHeading'));
  byId('turnLeftNow').addEventListener('click', () => command({ type: 'turn-now', side: 'left' }, 'turnLeftNow'));
  byId('turnRightNow').addEventListener('click', () => command({ type: 'turn-now', side: 'right' }, 'turnRightNow'));
  byId('stopTurnNow').addEventListener('click', () => command({ type: 'stop-turn' }, 'stopTurnNow'));
  byId('transmitDf').addEventListener('click', () => command({ type: 'transmit' }, 'transmitDf'));
  byId('reportHeading').addEventListener('click', () => command({ type: 'report-heading' }, 'reportHeading'));
  byId('continueHeading').addEventListener('click', () => command({ type: 'continue-heading', headingDeg: number('turnHeadingInput') }, 'continueHeading'));
  byId('climbTo').addEventListener('click', () => command({ type: 'set-altitude', direction: 'climb', altitudeFt: number('altitudeInput') }, 'climbTo'));
  byId('descendTo').addEventListener('click', () => command({ type: 'set-altitude', direction: 'descend', altitudeFt: number('altitudeInput') }, 'descendTo'));
  byId('reportPosition').addEventListener('click', () => command({ type: 'report-position' }, 'reportPosition'));
  byId('continueApproach').addEventListener('click', () => command({ type: 'continue-approach' }, 'continueApproach'));
  byId('reportRunwayVisual').addEventListener('click', () => command({ type: 'report-runway-visual' }, 'reportRunwayVisual'));
  byId('transferToPar').addEventListener('click', transferSelectedToPar);
  byId('missedApproach').addEventListener('click', () => {
    if (!state.simulation || !['running', 'paused'].includes(state.simulation.lifecycle)) return;
    const target = Math.min(45000, Math.ceil((state.simulation.aircraft.altitudeFt + 3000) / 100) * 100);
    byId('altitudeInput').value = target;
    command({ type: 'set-altitude', direction: 'climb', altitudeFt: target }, 'missedApproach');
  });
  byId('advanceMinute').addEventListener('click', () => advanceBy(60));
  byId('liveSpeed').addEventListener('change', () => command({ type: 'set-speed', speedKt: number('liveSpeed') }, 'liveSpeed'));
  byId('historyDots').addEventListener('change', updateAll);
  byId('instructorScope').addEventListener('pointermove', scopePointerMove);
  byId('instructorScope').addEventListener('pointerdown', scopePointerDown);
  byId('instructorScope').addEventListener('pointerup', scopePointerEnd);
  byId('instructorScope').addEventListener('pointercancel', scopePointerEnd);
  byId('instructorScope').addEventListener('click', scopeClick);
  byId('instructorScope').addEventListener('dblclick', scopeDoubleClick);
  byId('instructorScope').addEventListener('contextmenu', scopeRightClick);
  byId('instructorScope').addEventListener('auxclick', event => { if (event.button === 1) event.preventDefault(); });
  byId('scopeRange').addEventListener('change', updateAll);
  byId('truthTrailCount').addEventListener('change', updateAll);
  byId('instructorDfReference').addEventListener('change', updateAll);
  byId('resetScopePan').addEventListener('click', () => { state.scopePan = { x: 0, y: 0 }; updateAll(); });
  byId('quickTurnLeft').addEventListener('click', () => quickTurn('left'));
  byId('quickTurnRight').addEventListener('click', () => quickTurn('right'));
  byId('quickStopTurn').addEventListener('click', () => command({ type: 'stop-turn' }, 'quickStopTurn'));
  byId('quickTransmit').addEventListener('click', scopeTransmit);
  byId('quickHeadingLeft').addEventListener('click', () => command({ type: 'turn-to-heading', side: 'left', headingDeg: number('quickHeading') }, 'quickHeadingLeft'));
  byId('quickHeadingRight').addEventListener('click', () => command({ type: 'turn-to-heading', side: 'right', headingDeg: number('quickHeading') }, 'quickHeadingRight'));
  byId('moreAircraftControls').addEventListener('click', () => {
    const drawer = byId('aircraftControlDrawer'); drawer.open = !drawer.open;
    byId('moreAircraftControls').setAttribute('aria-expanded', String(drawer.open));
    if (drawer.open) drawer.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  });
  byId('instructorScope').addEventListener('pointerleave', () => { state.inspectedAircraftId = null; if (state.simulation) updateInspection(); });
  document.addEventListener('keydown', handleShortcut);
  byId('reviewScrub').addEventListener('input', () => { state.reviewPlaying = false; state.reviewTime = number('reviewScrub'); drawReview(state.review.snapshot()); });
  byId('reviewPlay').addEventListener('click', () => {
    if (state.reviewTime >= state.simulation.simulationSeconds) state.reviewTime = 0;
    state.reviewPlaying = !state.reviewPlaying; drawReview(state.review.snapshot());
  });
  byId('newScenario').addEventListener('click', retryScenario); byId('restartExercise').addEventListener('click', retryScenario);
  document.querySelectorAll('[data-review-layer]').forEach(control => control.addEventListener('change', () => drawReview(state.review.snapshot())));
  window.addEventListener('pagehide', () => { saveSetup(); checkpoint(); state.session?.detach?.(); });
  setInterval(() => { state.session?.tick(); if (state.session && state.simulation) state.session.heartbeat(state.simulation.simulationSeconds); }, 4000);
  setInterval(runtimeTick, 100);
  configureFields(); refreshPresets(); void restoreAttempt(); requestAnimationFrame(frame);
})();
