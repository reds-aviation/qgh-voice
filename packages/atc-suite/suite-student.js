/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

(function initialiseStudent() {
  'use strict';
  const Session = globalThis.ATCSuiteSession;
  if (!Session) return;
  // Entry and PIN collection share the paired portal. Only an explicit request
  // or an existing seat recovery opens this protected controller route.
  try {
    const params = new URLSearchParams(location.search), pin = params.get('pin');
    let recovery = false, savedMode = 'local';
    try {
      const savedPin = sessionStorage.getItem('reds.atc-suite.last-pin');
      savedMode = sessionStorage.getItem('atc-suite-connection') === 'online' ? 'online' : 'local';
      const seat = JSON.parse(sessionStorage.getItem(`reds.atc-suite.seat.${savedPin}`) || 'null');
      const selectedMode = params.get('connection');
      recovery = /^\d{6}$/.test(savedPin || '') && seat
        && typeof seat.sessionId === 'string' && seat.sessionId.length > 0 && /^[A-Za-z0-9_-]{8,64}$/.test(seat.clientId || '')
        && typeof seat.seatToken === 'string' && seat.seatToken.length > 0 && seat.seatToken.length <= 64
        && Number.isSafeInteger(seat.revision) && seat.revision >= 0
        && (!params.has('pin') || pin === savedPin)
        && (!(selectedMode === 'local' || selectedMode === 'online') || selectedMode === savedMode);
    } catch (_) { /* The shared entry remains usable without browser storage. */ }
    if (!(params.get('join') === '1' && /^\d{6}$/.test(pin || '')) && !recovery) {
      const portal = new URL('index.html', location.href);
      const mode = params.get('connection');
      portal.searchParams.set('connection', mode === 'local' || mode === 'online' ? mode : savedMode);
      if (/^\d{6}$/.test(pin || '')) portal.searchParams.set('pin', pin);
      portal.hash = 'controllerposition';
      location.replace(portal.href);
      return;
    }
  } catch (_) { /* Test/embedded hosts without navigation keep the controller form. */ }
  const byId = id => document.getElementById(id);
  let publishedBoundaryControls = null;
  const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const radarSweepClock = globalThis.ATCSuiteDisplay?.createRadarSweepClock();
  function enterWorkspace(element) {
    if (!element) return;
    if (globalThis.ATCSuiteWorkspace?.enter) globalThis.ATCSuiteWorkspace.enter(element, { block: 'start' });
    else element.scrollIntoView?.({ block: 'start', behavior: 'instant' });
  }
  const state = { session: null, metadata: null, observation: null, simulationTime: 0, displayBearing: 'qdm', heartbeat: null, cloudTransport: null, joining: false,
    radarInspection: null, radarDrag: null, audioGeneration: 0, activeTransmission: null, renderedAt: null, pictureError: false,
    scopePan: { x: 0, y: 0 }, scopeDrag: null, plotting: null, observationReceivedAt: null,
    loggingOut: false, freshnessTimer: null, animationFrame: null };
  let joinGeneration = 0;
  const clock = seconds => { const total = Math.max(0, Math.floor(Number(seconds) || 0)); return `${String(Math.floor(total / 3600)).padStart(2, '0')}:${String(Math.floor(total / 60) % 60).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; };
  const pad = value => String(Math.round(((Number(value) % 360) + 360) % 360) % 360).padStart(3, '0');
  const modeLabel = mode => ({ qgh: 'QGH / DIRECTION FINDING', surveillance: 'SURVEILLANCE VECTORING', sra: 'SURVEILLANCE RADAR APPROACH', par: 'PRECISION APPROACH RADAR' })[mode] || 'CONTROLLER POSITION';
  const radarLabelFields = [
    ['callsign', 'radarLabelCallsign'], ['squawk', 'radarLabelSquawk'], ['modeS', 'radarLabelModeS'], ['level', 'radarLabelLevel'],
    ['groundSpeed', 'radarLabelSpeed'], ['heading', 'radarLabelHeading'], ['bearingRange', 'radarLabelBearingRange']
  ];
  globalThis.ATCSuiteWorkspace?.bindShell?.({ root: byId('studentWorkspace'), scope: byId('radarScope'),
    shelf: byId('student-estimate-panel'), actions: byId('studentWorkspace')?.querySelector?.('.student-head'), onLogout: logout,
    hasAttempt: () => Boolean(state.session && state.session.snapshot().state !== 'rejected') });
  byId('studentEstimateScope').classList?.add?.('ats-scope-surface');
  const meetingPanel = globalThis.ATCSuiteMeeting?.createPanel({ container: byId('readyPanel'), role: 'student' });
  meetingPanel?.addShortcut(byId('studentWorkspace')?.querySelector('.student-head'));
  function renderMeeting() {
    const visible = ['readyPanel', 'studentWorkspace', 'studentEnded'].find(id => !byId(id).hidden);
    if (visible) meetingPanel?.move(visible === 'studentWorkspace' ? byId('studentNavigation') : byId(visible));
    meetingPanel?.update({ online: !!state.cloudTransport, role: 'student', meetingUrl: state.metadata?.meetingUrl || '', roomKey:state.session?.sessionId || '' });
  }

  function show(id, { scroll = true } = {}) {
    document.body.classList.toggle('exercise-console', id === 'studentWorkspace');
    const entering = byId(id).hidden;
    for (const name of ['joinPanel', 'waitingPanel', 'readyPanel', 'studentWorkspace', 'studentEnded', 'orientationGate']) byId(name).hidden = name !== id;
    if (id === 'joinPanel') byId('studentNavigation').open = true;
    if (id !== 'studentWorkspace') document.body.classList.toggle('narrow-radar', false);
    if (entering && scroll) enterWorkspace(byId(id));
    renderMeeting();
  }

  function onSessionEvent(event) {
    if (state.loggingOut) return;
    const priorMode = state.metadata?.mode, priorProfile = state.metadata?.radarProfile;
    const snapshot = event.snapshot || state.session?.snapshot();
    if (snapshot) {
      state.metadata = snapshot.publicMetadata || state.metadata;
      if (Object.hasOwn(snapshot, 'observation')) state.observation = snapshot.observation;
      state.simulationTime = Number(snapshot.simulationTime) || 0;
      byId('studentClock').textContent = clock(snapshot.simulationTime);
    }
    if (event.kind === 'admitted' || event.kind === 'rejoined') {
      meetingPanel?.resetVoice?.();
      byId('studentReady').disabled = false; byId('studentReady').textContent = state.cloudTransport ? 'Ready — open my display' : 'READY';
      show('readyPanel'); byId('readyMode').textContent = modeLabel(state.metadata.mode);
      if (event.kind === 'rejoined') setPilotAudio(false);
    } else if (event.kind === 'join-rejected') {
      show('joinPanel'); byId('joinStatus').textContent = 'Unable to join. Check the PIN and active instructor session.';
    } else if (event.kind === 'lifecycle') {
      radarSweepClock?.hold();
      renderLifecycle(snapshot.state);
    } else if (event.kind === 'public-metadata') {
      state.metadata = event.publicMetadata || snapshot?.publicMetadata || state.metadata;
      // A transfer changes the observation schema. Do not briefly paint an old
      // surveillance plot in a newly selected PAR display. A same-mode update
      // (such as the configured SRA approach speed) keeps the live picture.
      if (priorMode && (state.metadata?.mode !== priorMode || state.metadata?.radarProfile !== priorProfile)) {
        state.observation = null; state.renderedAt = null; cancelPilotAudio();
        radarSweepClock?.reset();
      }
      if (!byId('studentWorkspace').hidden) {
        renderWorkspaceMode();
        renderObservation();
      }
    } else if (event.kind === 'observation') {
      state.observation = event.observation; state.observationReceivedAt = Date.now();
      radarSweepClock?.observe({ angleDeg: event.observation.scanAngleDeg,
        simulationTime: state.simulationTime, receivedAt: state.observationReceivedAt,
        rpm: state.metadata?.scanRpm || 15, timeRate: state.metadata?.trainingTimeRate || 1,
        running: snapshot?.state === 'running' });
      renderObservation();
    } else if (event.kind === 'caption') {
      renderCaption(event.caption, event.transmissionId);
    } else if (event.kind === 'observation-rejected') {
      state.pictureError = true;
    } else if (event.kind === 'disconnected') {
      radarSweepClock?.hold();
      meetingPanel?.resetVoice?.();
      setPilotAudio(false);
      byId('connectionState').textContent = 'DISCONNECTED'; byId('studentExerciseState').textContent = 'PICTURE FROZEN';
    } else if (event.kind === 'terminated') {
      radarSweepClock?.hold();
      setPilotAudio(false);
      // A lost/closed host link is recoverable; it is not a completed attempt.
      if (['host-left', 'heartbeat-timeout'].includes(event.reason)) {
        byId('connectionState').textContent = 'DISCONNECTED'; byId('studentExerciseState').textContent = 'PICTURE FROZEN · RECONNECT';
      } else show('studentEnded');
    }
    renderFreshness(snapshot);
    renderMeeting();
  }

  async function requestJoin() {
    if (state.loggingOut || state.joining) return;
    const pin = byId('joinPin').value.replace(/\D/g, '');
    if (!/^\d{6}$/.test(pin)) { byId('joinStatus').textContent = 'Enter all six digits.'; return; }
    const generation = ++joinGeneration;
    state.joining = true; byId('joinSession').disabled = true;
    try {
    state.session?.close();
    const online = byId('exerciseConnection')?.value === 'online';
    try { sessionStorage.setItem('atc-suite-connection', online ? 'online' : 'local'); } catch (_) {}
    const cloud = online ? await globalThis.ATCSuiteCloud.prepareStudent(pin, Session, status => {
      if (generation !== joinGeneration) return;
      if (!status.connected) { meetingPanel?.resetVoice?.(); byId('connectionState').textContent = 'ONLINE LINK LOST'; byId('waitingMessage').textContent = status.error; }
    }) : null;
    if (generation !== joinGeneration) { cloud?.transport?.close(); return; }
    state.cloudTransport = cloud?.transport || null;
    state.metadata = null; renderMeeting();
    state.session = Session.createStudentSession({ pin, storage: online ? undefined : localStorage, ...(cloud || {}),
      recoveryStorage: typeof sessionStorage === 'undefined' ? undefined : sessionStorage,
      transportFactory: channelName => Session.createLocalSessionTransport({ channelName }), onEvent: onSessionEvent });
    try { sessionStorage.setItem('reds.atc-suite.last-pin', pin); } catch (_) {}
    show('waitingPanel'); byId('waitingMessage').textContent = `Session ${pin.slice(0, 3)} ${pin.slice(3)} · waiting for admission.`;
    if (state.session.requestJoin()) { /* Admission events determine the next panel. */ }
    else { show('joinPanel'); byId('joinStatus').textContent = 'No active session matches that PIN. Check the selected connection mode.'; }
    state.cloudTransport?.start();
    } catch (error) { if (generation === joinGeneration) { state.cloudTransport?.close(); state.cloudTransport = null; show('joinPanel'); byId('joinStatus').textContent = error.message; } }
    finally { if (generation === joinGeneration) { state.joining = false; byId('joinSession').disabled = false; } }
  }

  function logout() {
    ++joinGeneration; state.loggingOut = true; state.joining = false;
    const snapshot = state.session?.snapshot?.(), pin = byId('joinPin').value.replace(/\D/g, '');
    cancelPilotAudio(); meetingPanel?.resetVoice?.();
    if (typeof clearInterval === 'function') { clearInterval(state.heartbeat); clearInterval(state.freshnessTimer); }
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.animationFrame);
    const drag = state.scopeDrag;
    if (drag) studentScopeCanvas().releasePointerCapture?.(drag.id);
    state.scopeDrag = null; state.radarDrag = null;
    state.plotting?.onPointerCancel?.({pointerId:drag?.id});
    state.session?.close(); state.cloudTransport?.close(); state.session = null; state.cloudTransport = null;
    state.metadata = null; state.observation = null; state.plotting = null;
    try {
      const savedPin = sessionStorage.getItem('reds.atc-suite.last-pin');
      if (/^\d{6}$/.test(savedPin || '')) sessionStorage.removeItem(`reds.atc-suite.seat.${savedPin}`);
      if (/^\d{6}$/.test(pin)) sessionStorage.removeItem(`reds.atc-suite.seat.${pin}`);
      sessionStorage.removeItem('reds.atc-suite.last-pin'); sessionStorage.removeItem('atc-suite-student-auth');
      if (snapshot?.sessionId && snapshot?.clientId) localStorage.removeItem(`ats-simbox-student-estimates-v1:${encodeURIComponent(`${snapshot.sessionId}:${snapshot.clientId}`)}`);
    } catch (_) { /* Session transport is closed even when storage is unavailable. */ }
  }

  function ready() {
    if (!state.session?.ready(byId('studentAudio').checked ? 'audio' : 'captions')) return;
    byId('studentReady').disabled = true; byId('studentReady').textContent = 'READY · WAITING FOR START';
  }

  function renderLifecycle(lifecycle) {
    if (['ready', 'running', 'paused'].includes(lifecycle)) {
      const alreadyVisible = !byId('studentWorkspace').hidden;
      const collapseNavigation = ['running', 'paused'].includes(lifecycle) && byId('studentNavigation').open;
      show('studentWorkspace', { scroll: false });
      document.body.classList.add?.('exercise-console');
      if (lifecycle === 'running' || lifecycle === 'paused') byId('studentNavigation').open = false;
      byId('studentExerciseState').textContent = lifecycle.toUpperCase(); byId('connectionState').textContent = 'CONNECTED';
      renderWorkspaceMode(); refreshAudioAvailability(); renderObservation();
      if (!alreadyVisible || collapseNavigation) enterWorkspace(byId('studentWorkspace'));
    } else if (lifecycle === 'terminated' || lifecycle === 'disconnected') {
      setPilotAudio(false);
    }
  }

  function renderWorkspaceMode() {
    if (!state.metadata) return;
    byId('studentModeKicker').textContent = modeLabel(state.metadata.mode);
    byId('studentModeTitle').textContent = ({ qgh: 'Direction finding console', surveillance: 'Surveillance console', sra: 'SRA radar console', par: 'Precision approach console' })[state.metadata.mode] || 'Controller console';
    chooseMode(state.metadata.mode);
  }

  function chooseMode(mode) {
    byId('qghStudentView').hidden = !['qgh', 'surveillance', 'sra'].includes(mode);
    byId('studentEstimateScopePanel').hidden = mode !== 'qgh';
    byId('radarStudentView').hidden = !['surveillance', 'sra'].includes(mode);
    byId('parStudentView').hidden = mode !== 'par';
    if (!['surveillance', 'sra'].includes(mode)) closeRadarInspection();
    byId('radarTitle').textContent = mode === 'sra' ? 'SURVEILLANCE RADAR APPROACH' : 'SURVEILLANCE DISPLAY';
    const narrow = !byId('studentWorkspace').hidden && mode === 'par' && matchMedia('(orientation: portrait) and (max-width: 700px)').matches;
    document.body.classList.toggle('narrow-radar', narrow);
    byId('orientationGate').hidden = !narrow || byId('studentWorkspace').hidden;
  }

  function renderCaption(caption, transmissionId) {
    const box = byId('studentCaption'); box.querySelector('strong').textContent = caption;
    cancelPilotAudio();
    const voice = localVoice();
    if (byId('studentAudio').checked && voice) {
      const generation = state.audioGeneration;
      state.activeTransmission = transmissionId || null;
      const notify = phase => {
        if (generation !== state.audioGeneration || !state.activeTransmission) return;
        state.session?.pilotPlayback?.(state.activeTransmission, phase);
        if (phase !== 'started') state.activeTransmission = null;
      };
      const utterance = new SpeechSynthesisUtterance(caption); utterance.rate = 1.15; utterance.pitch = .9;
      utterance.voice = voice;
      utterance.onstart = () => notify('started');
      utterance.onend = () => notify('ended');
      utterance.onerror = () => { notify('unavailable'); byId('audioAvailability').textContent = 'Device audio unavailable. Continue with pilot captions.'; };
      try { speechSynthesis.speak(utterance); } catch (_) { notify('unavailable'); }
    } else if (transmissionId) state.session?.pilotPlayback?.(transmissionId, 'unavailable');
  }

  function localVoice() {
    if (!('speechSynthesis' in globalThis)) return null;
    const voices = speechSynthesis.getVoices().filter(voice => voice.localService === true);
    return voices.find(voice => /^en/i.test(voice.lang)) || voices[0] || null;
  }

  function refreshAudioAvailability() {
    const available = Boolean(localVoice());
    byId('studentAudio').disabled = !available;
    if (!available) byId('studentAudio').checked = false;
    byId('audioAvailability').textContent = available ? 'Installed device voice · pilot captions remain authoritative.' : 'No installed device voice available. Pilot captions are active.';
    const enabled = available && byId('studentAudio').checked, control = byId('togglePilotAudio');
    control.disabled = !available;
    control.setAttribute('aria-pressed', String(enabled));
    control.setAttribute('aria-label', available ? `${enabled ? 'Mute' : 'Enable'} pilot audio using an installed device voice` : 'Pilot audio unavailable: no installed device voice');
    control.textContent = `PILOT AUDIO · ${!available ? 'UNAVAILABLE' : enabled ? 'ON' : 'MUTED'}`;
    if (!available) cancelPilotAudio();
  }

  function cancelPilotAudio() {
    const transmissionId = state.activeTransmission;
    state.activeTransmission = null; state.audioGeneration += 1;
    if ('speechSynthesis' in globalThis) speechSynthesis.cancel();
    if (transmissionId) state.session?.pilotPlayback?.(transmissionId, 'unavailable');
  }

  function setPilotAudio(enabled) {
    byId('studentAudio').checked = Boolean(enabled && localVoice());
    if (!byId('studentAudio').checked) cancelPilotAudio();
    refreshAudioAvailability();
    state.session?.preferences({ captions: true, audioEnabled: byId('studentAudio').checked });
  }

  function renderObservation() {
    if (!state.metadata) return;
    try {
      if (state.metadata.mode === 'qgh') renderDf();
      else if (state.metadata.mode === 'par') renderPar();
      else { renderRadar(); renderDf(); }
      state.renderedAt = Date.now(); state.pictureError = false;
    } catch (_) { state.pictureError = true; }
    renderFreshness();
  }

  function renderFreshness(snapshot = state.session?.snapshot()) {
    if (!snapshot) return;
    if (state.cloudTransport && !state.cloudTransport.connected) {
      if (state.observation) { state.observation = null; cancelPilotAudio(); if (state.metadata?.mode === 'qgh') renderDf(); else if (state.metadata?.mode === 'par') renderPar(); else renderRadar(); }
      byId('pictureFreshness').textContent = 'ONLINE LINK LOST · WAIT FOR RECONNECT';
      byId('connectionState').textContent = 'DISCONNECTED'; return;
    }
    const now = Date.now(), running = snapshot.state === 'running';
    const stale = value => value != null && now - value > 6500;
    let label = 'AWAITING PICTURE';
    if (snapshot.state === 'disconnected') label = 'PICTURE FROZEN · RECONNECT';
    else if (state.pictureError) label = 'PICTURE ERROR · RECONNECT';
    else if (snapshot.state === 'paused') label = 'PAUSED · PICTURE HELD';
    else if (running && stale(snapshot.lastProgressAt)) label = 'SIMULATION STALLED';
    else if (running && (stale(snapshot.lastObservationAt) || stale(state.renderedAt))) label = 'PICTURE STALE';
    else if (state.observation) label = state.metadata?.mode === 'qgh'
      ? (state.observation.status === 'idle' ? 'NO SIGNAL · READY' : 'D/F PICTURE CURRENT')
      : (state.metadata?.mode === 'par' ? (state.observation.timestamp == null ? 'AWAITING PAR SAMPLE' : 'PAR PICTURE CURRENT')
        : (currentRadarPlots().length ? 'RADAR PICTURE CURRENT' : 'AWAITING SCAN · NO RETURNS'));
    byId('pictureFreshness').textContent = label;
    if (snapshot.state !== 'disconnected' && snapshot.lastHostSeenAt != null) {
      byId('connectionState').textContent = stale(snapshot.lastHostSeenAt) ? 'LINK DELAYED' : 'CONNECTED';
    }
  }

  function renderDf() {
    if (state.metadata?.mode === 'qgh') renderEstimateScope();
    const observation = (state.metadata?.mode === 'qgh' ? state.observation : state.observation?.homing) || {};
    const status = String(observation.status || 'idle').toUpperCase();
    byId('dfSignalState').textContent = status === 'IDLE' ? 'NO SIGNAL' : `SIGNAL ${status}`;
    let bearing = observation.bearingDeg;
    if (bearing != null && observation.bearingType !== state.displayBearing) bearing = (bearing + 180) % 360;
    byId('dfBearing').textContent = bearing == null ? '---' : `${pad(bearing)}°`;
    drawHomingDial(bearing);
    byId('dfModeLabel').textContent = state.displayBearing === 'qdm' ? 'QDM · HOMING' : 'QTE · TRUE BEARING';
    byId('dfCallsign').textContent = `${observation.callsign || 'AIRCRAFT'} · ${observation.transmissionState === 'pilot' ? 'SIGNAL LIVE' : observation.transmissionState === 'held' ? 'SIGNAL HELD' : 'NO TRANSMISSION'}`;
  }

  function drawHomingDial(bearing) {
    const canvas = byId('studentHomingDial');
    if (!canvas?.getContext) return;
    const ctx = canvas.getContext('2d'), cx = canvas.width / 2, cy = canvas.height / 2, radius = Math.min(cx, cy) - 13;
    ctx.clearRect(0, 0, canvas.width, canvas.height);ctx.strokeStyle = '#527d84';ctx.fillStyle = '#bbcad3';ctx.lineWidth = 1;
    ctx.font = '10px Arial';ctx.textAlign = 'center';ctx.textBaseline = 'middle';
    for (let degree = 0; degree < 360; degree += 30) {
      const angle = degree * Math.PI / 180, inner = radius - 5;
      ctx.beginPath();ctx.moveTo(cx + Math.sin(angle) * inner, cy - Math.cos(angle) * inner);ctx.lineTo(cx + Math.sin(angle) * radius, cy - Math.cos(angle) * radius);ctx.stroke();
      if (degree % 90 === 0) ctx.fillText(String(degree).padStart(3, '0'), cx + Math.sin(angle) * (radius + 10), cy - Math.cos(angle) * (radius + 10));
    }
    // The needle is a radio observation, never a continuously tracked target.
    if (Number.isFinite(bearing)) {
      const angle = bearing * Math.PI / 180;
      ctx.strokeStyle = '#ffdf94';ctx.lineWidth = 2;ctx.beginPath();ctx.moveTo(cx, cy);ctx.lineTo(cx + Math.sin(angle) * (radius - 4), cy - Math.cos(angle) * (radius - 4));ctx.stroke();
      ctx.fillStyle = '#ffdf94';ctx.beginPath();ctx.arc(cx, cy, 3, 0, Math.PI * 2);ctx.fill();
    }
  }

  function radarTransform(canvas, rangeNm, azimuthDeg) {
    const radius = Math.min(canvas.width, canvas.height) * .44 * rangeNm / selectedRadarRange(), radians = azimuthDeg * Math.PI / 180;
    return { x: canvas.width / 2 + state.scopePan.x + Math.sin(radians) * radius, y: canvas.height / 2 + state.scopePan.y - Math.cos(radians) * radius };
  }

  function renderRadar() {
    const canvas = byId('radarScope'), context = canvas.getContext('2d'), observation = state.observation || {};
    sizeStudentCanvas(canvas);
    const width = canvas.width, height = canvas.height, cx = width / 2 + state.scopePan.x, cy = height / 2 + state.scopePan.y, radius = Math.min(width, height) * .44, range = selectedRadarRange();
    const rangeLabel = `${range} NM`, rangeReadout = byId('studentRadarRangeReadout');
    if (rangeReadout.textContent !== rangeLabel) rangeReadout.textContent = rangeLabel;
    byId('studentRadarZoomIn').disabled = range <= 5;
    byId('studentRadarZoomOut').disabled = range >= 100;
    context.clearRect(0, 0, width, height); context.fillStyle = '#0e1319'; context.fillRect(0, 0, width, height);
    context.strokeStyle = '#24504d'; context.lineWidth = 1; context.fillStyle = '#92b6ad'; context.font = '14px IBM Plex Mono';
    const ringLabelBoxes = drawStudentRangeRings(context, canvas, range, radius, cx, cy, 'radarRingSpacing');
    context.beginPath(); context.moveTo(cx, cy - radius); context.lineTo(cx, cy + radius); context.moveTo(cx - radius, cy); context.lineTo(cx + radius, cy); context.stroke();
    for (let degree = 0; degree < 360; degree += 10) {
      const theta = degree * Math.PI / 180, inner = radius - (degree % 30 === 0 ? 13 : 6);
      context.beginPath(); context.moveTo(cx + Math.sin(theta) * inner, cy - Math.cos(theta) * inner); context.lineTo(cx + Math.sin(theta) * radius, cy - Math.cos(theta) * radius); context.stroke();
    }
    context.textAlign = 'center'; context.fillStyle = '#c0d5c9'; context.font = '16px IBM Plex Mono';
    [['N · 000', cx, cy - radius - 23], ['E · 090', cx + radius + 49, cy + 5], ['S · 180', cx, cy + radius + 30], ['W · 270', cx - radius - 49, cy + 5]].forEach(([label, x, y]) => context.fillText(label, x, Math.max(18, Math.min(height - 12, y))));
    context.textAlign = 'left';
    const environment = radarEnvironment();
    drawRunway(context, canvas, environment);
    const scopePresentation = updateRadarScopeControls(environment);
    const chartLabels = drawRadarEnvironment(context, canvas, environment, scopePresentation.extendedCentreline, scopePresentation.lfa, ringLabelBoxes);
    if (state.metadata.mode === 'sra' && observation.overlays) drawSraReferences(context, canvas, observation.overlays, radius, environment, scopePresentation.descent, chartLabels);
    if (!reducedMotion() && Number.isFinite(observation.scanAngleDeg)) {
      const running = state.session?.snapshot().state === 'running' && (!state.cloudTransport || state.cloudTransport.connected);
      globalThis.ATCSuiteDisplay?.drawRadarSweep(context, { cx, cy, radius,
        angleDeg: radarSweepClock?.angle(Date.now(), running) ?? observation.scanAngleDeg });
    }
    // Only the sensor's transmitted samples are used. No target extrapolation occurs here.
    const plots = currentRadarPlots();
    selectedHistory(observation.history || [], Number(byId('radarHistory').value), plots).forEach(plot => drawPlot(context, canvas, plot, .35, false));
    plots.forEach(plot => drawPlot(context, canvas, plot, 1, true));
    drawRadarLabels(context, canvas, plots);
    state.plotting?.draw(context);
    updateRadarInspection(plots);
    byId('scanRate').textContent = `${state.metadata.scanRpm || 15} RPM · ${state.metadata.revisitSeconds || 4} SIM SEC REVISIT · ${state.metadata.trainingTimeRate || 1}×`;
    const hasSecondary = correlatedRadarProfile() && plots.some(plot => plot.surveillance?.secondary === true);
    byId('radarProfileStatus').textContent = correlatedRadarProfile()
      ? `CORRELATED TRAINING · + PRIMARY · □ SSR${hasSecondary ? '' : ' · NO SSR RETURN'}`
      : 'PRIMARY ONLY · + PLOT';
    const visible = plots.filter(plot => validPlot(plot) && plot.rangeNm <= range).length;
    const latest = plots.reduce((time, plot) => Math.max(time, Number.isFinite(plot.timestamp) ? plot.timestamp : -Infinity), -Infinity);
    byId('lastPlot').textContent = `${visible} / ${plots.length} RETURNS · ${range} NM${Number.isFinite(latest) ? ` · AGE ${Math.max(0, state.simulationTime - latest).toFixed(1)} S` : ' · AWAITING SCAN'}`;
    byId('radarGuideNote').textContent = radarGuideNote(environment, state.metadata.mode === 'sra', scopePresentation);
  }

  function selectedRadarRange() { return Number(byId('radarRange').value) || 40; }

  function drawStudentRangeRings(context, canvas, range, radius, cx, cy, spacingId) {
    const labelBoxes = [];
    const spacingNm = Number(byId(spacingId)?.value) === 5 ? 5 : 10;
    const visuals = globalThis.ATCScopeVisuals;
    if (visuals?.drawRangeRings) {
      visuals.drawRangeRings(context, { rangeNm: range, spacingNm, scale: radius / range, cx, cy,
        width: canvas.width, height: canvas.height, strokeStyle: '#1d5551', fillStyle: '#79aaa4', font: '11px IBM Plex Mono', labelBoxes,
        obstacles: document.querySelectorAll ? visuals.overlayObstacles(canvas, { document, width: canvas.width, height: canvas.height }) : [] });
    } else {
      for (let distance = spacingNm; distance <= range + spacingNm; distance += spacingNm) {
        const nm = Math.min(distance, range), r = radius * nm / range;
        context.beginPath(); context.arc(cx, cy, r, 0, Math.PI * 2); context.stroke(); context.fillText(`${nm} NM`, cx + 7, cy - r + 14);
        labelBoxes.push({ x: cx + 7, y: cy - r + 2, width: context.measureText?.(`${nm} NM`)?.width || 40, height: 14 });
        if (nm === range) break;
      }
    }
    return labelBoxes;
  }

  function studentScopeCanvas() { return byId(state.metadata?.mode === 'qgh' ? 'studentEstimateScope' : 'radarScope'); }
  function studentScopeRange() { return state.metadata?.mode === 'qgh' ? Number(byId('studentScopeRange').value) || 40 : selectedRadarRange(); }
  function sizeStudentCanvas(canvas) {
    const bounds = canvas.getBoundingClientRect?.();
    if (bounds?.width > 0 && bounds?.height > 0) { canvas.width = Math.round(bounds.width); canvas.height = Math.round(bounds.height); }
  }
  function projectStudentPoint(xNm, yNm) {
    const canvas = studentScopeCanvas(), scale = Math.min(canvas.width, canvas.height) * .44 / studentScopeRange();
    return [canvas.width / 2 + state.scopePan.x + xNm * scale, canvas.height / 2 + state.scopePan.y - yNm * scale];
  }
  function inverseStudentPoint(event) {
    const canvas = studentScopeCanvas(), bounds = canvas.getBoundingClientRect(), scale = Math.min(canvas.width, canvas.height) * .44 / studentScopeRange();
    return { xNm: ((event.clientX - bounds.left) * canvas.width / bounds.width - canvas.width / 2 - state.scopePan.x) / scale,
      yNm: -((event.clientY - bounds.top) * canvas.height / bounds.height - canvas.height / 2 - state.scopePan.y) / scale };
  }
  function renderEstimateScope() {
    const canvas = byId('studentEstimateScope'), ctx = canvas.getContext('2d'); sizeStudentCanvas(canvas);
    const cx = canvas.width / 2 + state.scopePan.x, cy = canvas.height / 2 + state.scopePan.y, radius = Math.min(canvas.width, canvas.height) * .44, range = studentScopeRange();
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#0e1319'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#354954'; ctx.fillStyle = '#8eb0b7'; ctx.font = '12px IBM Plex Mono';
    drawStudentRangeRings(ctx, canvas, range, radius, cx, cy, 'studentRingSpacing');
    ctx.beginPath(); ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy); ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius); ctx.stroke();
    globalThis.ATCScopeVisuals?.drawRunwayStrip(ctx, { runwayHeadingDeg: Number(state.metadata?.runwayOrientation) || 0 }, (x, y) => [cx + x * radius / range, cy - y * radius / range], radius / range);
    ctx.fillStyle = '#b8d1ca'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill(); ctx.fillText('ARP / D/F', cx + 8, cy - 9);
    const observation = state.observation;
    if (Number.isFinite(observation?.bearingDeg) && ['live', 'held'].includes(observation.status)) {
      const bearing = observation.bearingType === 'qdm' ? (observation.bearingDeg + 180) % 360 : observation.bearingDeg, angle = bearing * Math.PI / 180;
      ctx.strokeStyle = '#e2cc7c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(angle) * radius, cy - Math.cos(angle) * radius); ctx.stroke();
    }
    state.plotting?.draw(ctx);
  }
  function studentScopePointerDown(event) {
    if (state.plotting?.onPointerDown(event)) return;
    if (event.button != null && event.button !== 0 && event.pointerType !== 'touch') return;
    if (state.metadata?.mode !== 'qgh' && selectRadarPlot(event)) return;
    const canvas = studentScopeCanvas();
    state.scopeDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, pan: { ...state.scopePan } }; canvas.setPointerCapture?.(event.pointerId);
  }
  function studentScopePointerMove(event) {
    if (state.plotting?.onPointerMove(event)) return;
    const drag = state.scopeDrag; if (!drag || drag.id !== event.pointerId) return;
    const canvas = studentScopeCanvas(), bounds = canvas.getBoundingClientRect();
    state.scopePan = { x: drag.pan.x + (event.clientX - drag.x) * canvas.width / bounds.width, y: drag.pan.y + (event.clientY - drag.y) * canvas.height / bounds.height };
    event.preventDefault(); renderObservation();
  }
  function studentScopePointerUp(event) {
    if (state.plotting?.onPointerUp(event)) return;
    if (state.scopeDrag?.id !== event.pointerId) return;
    studentScopeCanvas().releasePointerCapture?.(event.pointerId); state.scopeDrag = null;
  }

  async function initialiseStudentPlotting() {
    try {
      const { createStudentPlotting } = await import('./student-plotting.js');
      if (state.loggingOut) return;
      state.plotting = createStudentPlotting({ get canvas() { return studentScopeCanvas(); }, screenToPoint: inverseStudentPoint,
        projectPoint: projectStudentPoint, requestDraw: renderObservation, sessionKey: () => {
          const snapshot = state.session?.snapshot(); return snapshot?.sessionId && snapshot?.clientId ? `${snapshot.sessionId}:${snapshot.clientId}` : '';
        } });
      state.plotting.mount(byId('studentPlotTools')); renderObservation();
    } catch (_) { byId('studentPlotTools').textContent = 'Estimate plotting unavailable · reload the current release.'; }
  }
  function validPlot(plot) { return Number.isFinite(plot.rangeNm) && plot.rangeNm >= 0 && Number.isFinite(plot.azimuthDeg); }
  function correlatedRadarProfile() { return state.metadata?.radarProfile === 'correlated-training'; }
  function currentRadarPlots() {
    const observation = state.observation || {};
    return Array.isArray(observation.plots) ? observation.plots : observation.plot ? [observation.plot] : [];
  }

  function nonEmptyText(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
  function displayedSquawk(plot) {
    const squawk = nonEmptyText(plot?.surveillance?.squawk);
    return squawk && /^[0-7]{4}$/.test(squawk) ? squawk : null;
  }
  function displayedHeading(plot, suffix = '°') { return Number.isFinite(plot?.headingDeg) ? `${pad(plot.headingDeg)}${suffix}` : null; }
  function displayedGroundSpeed(plot) { return Number.isFinite(plot?.groundSpeedKt) ? `${Math.round(plot.groundSpeedKt)} KT` : null; }
  function displayedLevel(plot) { return Number.isFinite(plot?.altitudeFt) ? `${Math.round(plot.altitudeFt).toLocaleString()} FT` : null; }
  function displayedBearingRange(plot) {
    return validPlot(plot) ? `BRG ${pad(plot.azimuthDeg)}° · ${plot.rangeNm.toFixed(1)} NM` : null;
  }
  function notReported(value) { return value || 'NOT REPORTED'; }

  function radarLabelPreferences() {
    return Object.fromEntries(radarLabelFields.map(([field, id]) => [field, Boolean(byId(id).checked)]));
  }

  function radarLabelTokens(plot, preferences) {
    const tokens = [];
    if (preferences.callsign) tokens.push(`CS ${notReported(nonEmptyText(plot.callsign))}`);
    if (preferences.squawk) tokens.push(`A ${notReported(displayedSquawk(plot))}`);
    if (preferences.modeS) tokens.push(plot.surveillance?.modeS === true ? 'SSR MODE S' : 'SSR MODE A');
    if (preferences.level) tokens.push(`LVL ${notReported(displayedLevel(plot))}`);
    if (preferences.groundSpeed) tokens.push(`GS ${notReported(displayedGroundSpeed(plot))}`);
    if (preferences.heading) tokens.push(`HDG ${notReported(displayedHeading(plot, ' H'))}`);
    if (preferences.bearingRange) tokens.push(notReported(displayedBearingRange(plot)));
    return tokens;
  }

  function radarLabelLines(plot, preferences) {
    const tokens = radarLabelTokens(plot, preferences);
    if (!tokens.length) return [];
    const perLine = tokens.length > 4 ? 3 : 2;
    return Array.from({ length: Math.ceil(tokens.length / perLine) }, (_, index) => tokens.slice(index * perLine, index * perLine + perLine).join(' · '));
  }

  function updateRadarScopeControls(environment) {
    const correlated = correlatedRadarProfile();
    const preferences = radarLabelPreferences();
    const labelCount = Object.values(preferences).filter(Boolean).length;
    for (const [, id] of radarLabelFields) byId(id).disabled = !correlated;
    const centrelineAvailable = environment.extendedCentreline === true;
    const descentAvailable = state.metadata?.mode === 'sra' && environment.sraDescentProfile === true;
    const lfaAvailable = environment.publishedAirspace
      ? environment.publishedAirspace.layerVisibility?.lfa !== false && environment.publishedAirspace.areas?.some(area => area.id === environment.publishedAirspace.lfaId)
      : environment.lfaBoundary.length >= 3;
    byId('radarOverlayLfa').disabled = !lfaAvailable;
    byId('radarOverlayCentreline').disabled = !centrelineAvailable;
    byId('radarOverlayDescent').disabled = !descentAvailable;
    byId('radarLabelHelp').textContent = correlated
      ? 'Labels are shown only beside cooperative square returns. Heading and ground speed are sampled track estimates. Primary + returns remain anonymous.'
      : 'Primary-only picture: labels are unavailable and every return remains anonymous.';
    byId('radarAidHelp').textContent = centrelineAvailable || descentAvailable || lfaAvailable
      ? 'Available instructor-provided aids can be hidden locally for declutter.'
      : 'No instructor-provided scope aids are available for this exercise.';
    const summary = byId('studentChartSummary');
    if (summary) {
      const lines = globalThis.ATCSuiteDisplay?.radarChartSummary?.({ environment, metadata: state.metadata,
        overlays: state.observation?.overlays, showExtendedCentreline: centrelineAvailable && byId('radarOverlayCentreline').checked,
        showLfa: lfaAvailable && byId('radarOverlayLfa').checked,
        showDescentProfile: descentAvailable && byId('radarOverlayDescent').checked }) || [];
      summary.textContent = lines.join(' · '); summary.hidden = !lines.length;
      const reference = byId('studentChartReference'), label = byId('studentChartLabel');
      if (reference) reference.hidden = !lines.length;
      if (label) {
        label.textContent = environment.publishedAirspace ? `${environment.publishedAirspace.baseName} · ${environment.publishedAirspace.lfaName}` : 'Exercise chart references';
        label.hidden = !lines.length;
      }
    }
    const visibleAids = [centrelineAvailable && byId('radarOverlayCentreline').checked, descentAvailable && byId('radarOverlayDescent').checked, lfaAvailable && byId('radarOverlayLfa').checked].filter(Boolean).length;
    byId('radarScopeControlStatus').textContent = correlated
      ? `${labelCount ? `${labelCount} LABEL${labelCount === 1 ? '' : 'S'}` : 'DECLUTTERED'}${visibleAids ? ` · ${visibleAids} AID${visibleAids === 1 ? '' : 'S'}` : ''}`
      : 'PRIMARY ONLY';
    return { preferences, extendedCentreline: centrelineAvailable && byId('radarOverlayCentreline').checked, lfa: lfaAvailable && byId('radarOverlayLfa').checked,
      descent: descentAvailable && byId('radarOverlayDescent').checked };
  }

  function selectedHistory(history, count, current = []) {
    if (!count) return [];
    const tracks = new Map();
    for (const plot of history) {
      const key = plot.trackId || 'legacy';
      if (current.some(item => (item.trackId || 'legacy') === key && item.timestamp === plot.timestamp)) continue;
      if (!tracks.has(key)) tracks.set(key, []);
      tracks.get(key).push(plot);
    }
    return [...tracks.values()].flatMap(samples => samples.sort((a, b) => a.timestamp - b.timestamp).slice(-count));
  }

  function drawPlot(context, canvas, plot, opacity, current) {
    if (!validPlot(plot) || plot.rangeNm > selectedRadarRange()) return;
    const point = radarTransform(canvas, plot.rangeNm, plot.azimuthDeg), surveillance = correlatedRadarProfile() ? plot.surveillance || {} : {};
    context.globalAlpha = opacity;
    if (surveillance.secondary === true) {
      const half = current ? 6 : 4;
      context.strokeStyle = '#eaf5d0'; context.lineWidth = current ? 1.8 : 1;
      context.beginPath(); context.moveTo(point.x - half, point.y - half); context.lineTo(point.x + half, point.y - half);
      context.lineTo(point.x + half, point.y + half); context.lineTo(point.x - half, point.y + half); context.lineTo(point.x - half, point.y - half); context.stroke();
    } else {
      const half = current ? 5 : 3;
      context.strokeStyle = '#eaf5d0'; context.lineWidth = current ? 1.6 : 1;
      context.beginPath(); context.moveTo(point.x - half, point.y); context.lineTo(point.x + half, point.y);
      context.moveTo(point.x, point.y - half); context.lineTo(point.x, point.y + half); context.stroke();
    }
    context.globalAlpha = 1;
  }

  function drawRadarLabels(context, canvas, plots) {
    // Data labels are opt-in, correlated-training only. Primary returns never
    // receive labels, even if a malformed local event includes extra fields.
    const preferences = radarLabelPreferences();
    if (!correlatedRadarProfile() || !Object.values(preferences).some(Boolean)) return;
    context.font = '13px IBM Plex Mono';
    const samples = plots.filter(selectableSurveillancePlot)
      .map(plot => ({ plot, point: radarTransform(canvas, plot.rangeNm, plot.azimuthDeg) }))
      .sort((a, b) => a.point.y - b.point.y || a.point.x - b.point.x || String(a.plot.trackId || a.plot.callsign).localeCompare(String(b.plot.trackId || b.plot.callsign)));
    const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    // Reserve sampled return symbols as well as label boxes; layout never consults aircraft truth.
    const occupied = samples.map(({ point }) => ({ x: point.x - 8, y: point.y - 8, width: 16, height: 16 }));
    if (document.querySelectorAll) occupied.push(...(globalThis.ATCScopeVisuals?.overlayObstacles(canvas, { document, width: canvas.width, height: canvas.height }) || []));
    const labels = [];
    for (const { plot, point } of samples) {
      const lines = radarLabelLines(plot, preferences);
      if (!lines.length) continue;
      const width = Math.max(...lines.map(text => context.measureText(text).width)) + 10, height = lines.length * 16 + 7, candidates = [];
      for (let row = -32; row <= 32; row += 1) {
        for (let column = -3; column <= 3; column += 1) {
          const x = column >= 0 ? point.x + 14 + column * (width + 12) : point.x - 14 + column * (width + 12) + 12;
          const y = point.y - 18 + row * 26;
          if (x < 18 || x + width > canvas.width - 18 || y < 58 || y + height > canvas.height - 42) continue;
          const box = { x, y, width, height };
          const anchorX = Math.max(x, Math.min(x + width, point.x)), anchorY = Math.max(y, Math.min(y + height, point.y));
          candidates.push({ ...box, distance: (anchorX - point.x) ** 2 + (anchorY - point.y) ** 2 });
        }
      }
      candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
      const box = candidates.find(candidate => !occupied.some(other => overlaps(candidate, other)));
      if (box) { occupied.push(box); labels.push({ lines, point, box }); }
    }
    // Leaders are painted first so no later leader crosses another label's text.
    context.strokeStyle = '#668d78'; context.lineWidth = 1;
    for (const { point, box } of labels) {
      context.beginPath(); context.moveTo(point.x, point.y);
      context.lineTo(Math.max(box.x, Math.min(box.x + box.width, point.x)), Math.max(box.y, Math.min(box.y + box.height, point.y))); context.stroke();
    }
    context.textAlign = 'left';
    for (const { lines, box } of labels) {
      context.fillStyle = '#071b1d'; context.fillRect(box.x, box.y, box.width, box.height);
      context.fillStyle = '#eaf5d0'; lines.forEach((text, index) => context.fillText(text, box.x + 5, box.y + 15 + index * 16));
    }
  }

  function selectableSurveillancePlot(plot) {
    return correlatedRadarProfile() && validPlot(plot) && plot.rangeNm <= selectedRadarRange()
      && plot.surveillance?.secondary === true;
  }

  function sameInspectedPlot(plot, selected) {
    if (!selected || !plot) return false;
    if (selected.trackId && plot.trackId) return selected.trackId === plot.trackId;
    return Boolean(selected.callsign && plot.callsign && selected.callsign === plot.callsign);
  }

  function updateRadarInspection(plots) {
    const panel = byId('radarInspection');
    const selected = state.radarInspection;
    const plot = selected && Array.isArray(plots) ? plots.find(item => selectableSurveillancePlot(item) && sameInspectedPlot(item, selected)) : null;
    if (!plot) {
      panel.hidden = true;
      state.radarInspection = null;
      return;
    }
    const surveillance = plot.surveillance || {};
    byId('inspectTrack').textContent = notReported(nonEmptyText(plot.callsign));
    byId('inspectSquawk').textContent = notReported(displayedSquawk(plot));
    byId('inspectAltitude').textContent = notReported(displayedLevel(plot));
    byId('inspectGroundSpeed').textContent = notReported(displayedGroundSpeed(plot));
    byId('inspectHeading').textContent = notReported(displayedHeading(plot));
    byId('inspectBearingRange').textContent = notReported(displayedBearingRange(plot));
    byId('inspectModeS').textContent = surveillance.modeS === true
      ? surveillance.modeSId ? `ACTIVE · ${surveillance.modeSId}` : 'ACTIVE'
      : 'NOT FITTED';
    panel.hidden = false;
  }

  function closeRadarInspection() {
    state.radarInspection = null;
    state.radarDrag = null;
    const panel = byId('radarInspection');
    if (panel) panel.hidden = true;
  }

  function selectRadarPlot(event) {
    if (!correlatedRadarProfile()) return;
    const canvas = byId('radarScope');
    const rect = canvas.getBoundingClientRect?.();
    if (!rect || !Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY) || !rect.width || !rect.height) return;
    const x = (event.clientX - rect.left) * canvas.width / rect.width;
    const y = (event.clientY - rect.top) * canvas.height / rect.height;
    const match = currentRadarPlots().filter(selectableSurveillancePlot)
      .map(plot => ({ plot, point: radarTransform(canvas, plot.rangeNm, plot.azimuthDeg) }))
      .map(candidate => ({ ...candidate, distance: Math.hypot(candidate.point.x - x, candidate.point.y - y) }))
      .filter(candidate => candidate.distance <= 22)
      .sort((left, right) => left.distance - right.distance || String(left.plot.trackId || left.plot.callsign).localeCompare(String(right.plot.trackId || right.plot.callsign)))[0];
    if (!match) return;
    state.radarInspection = {
      trackId: typeof match.plot.trackId === 'string' ? match.plot.trackId : null,
      callsign: typeof match.plot.callsign === 'string' ? match.plot.callsign : null
    };
    updateRadarInspection(currentRadarPlots());
    return true;
  }

  function beginRadarInspectionDrag(event) {
    if (event?.button != null && event.button !== 0) return;
    if (event?.target?.closest?.('button') || event?.target?.id === 'closeRadarInspection') return;
    const panel = byId('radarInspection');
    if (panel.hidden || !Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY)) return;
    const rect = panel.getBoundingClientRect?.() || { left: 0, top: 0, width: panel.offsetWidth || 270, height: panel.offsetHeight || 180 };
    state.radarDrag = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    panel.setPointerCapture?.(event.pointerId);
    event.preventDefault?.();
  }

  function moveRadarInspection(event) {
    const drag = state.radarDrag;
    if (!drag || drag.pointerId != null && event?.pointerId != null && drag.pointerId !== event.pointerId) return;
    if (!Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY)) return;
    const panel = byId('radarInspection');
    const rect = panel.getBoundingClientRect?.() || { width: panel.offsetWidth || 270, height: panel.offsetHeight || 180 };
    // On mobile Safari the layout viewport can be taller than the visible area
    // when browser chrome is expanded. Keep a dragged card inside the visible
    // viewport instead of letting it end up behind the address/home controls.
    const visibleViewport = globalThis.visualViewport;
    const viewportWidth = Number(visibleViewport?.width) || Number(globalThis.innerWidth) || 1000;
    const viewportHeight = Number(visibleViewport?.height) || Number(globalThis.innerHeight) || 800;
    const viewportLeft = Number(visibleViewport?.offsetLeft) || 0;
    const viewportTop = Number(visibleViewport?.offsetTop) || 0;
    const panelWidth = Number(panel.offsetWidth) || rect.width || 270, panelHeight = Number(panel.offsetHeight) || rect.height || 180;
    const minLeft = viewportLeft + 8, minTop = viewportTop + 8;
    const maxLeft = Math.max(minLeft, viewportLeft + viewportWidth - panelWidth - 8);
    const maxTop = Math.max(minTop, viewportTop + viewportHeight - panelHeight - 8);
    const left = Math.max(minLeft, Math.min(maxLeft, event.clientX - drag.offsetX));
    const top = Math.max(minTop, Math.min(maxTop, event.clientY - drag.offsetY));
    panel.style.left = `${Math.round(left)}px`; panel.style.top = `${Math.round(top)}px`;
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
    event.preventDefault?.();
  }

  function endRadarInspectionDrag(event) {
    const drag = state.radarDrag;
    if (!drag || drag.pointerId != null && event?.pointerId != null && drag.pointerId !== event.pointerId) return;
    byId('radarInspection').releasePointerCapture?.(drag.pointerId);
    state.radarDrag = null;
  }

  function radarEnvironment() {
    return globalThis.ATCSuiteDisplay.radarChartEnvironment(state.metadata);
  }

  function radarGuideNote(environment, sra, presentation = {}) {
    const notes = ['North up', 'sampled returns only', 'range rings in NM', 'runway symbol schematic'];
    notes.push(correlatedRadarProfile() ? '+ primary return · □ selectable SSR return' : '+ primary return');
    if (environment.extendedCentreline && presentation.extendedCentreline) notes.push('extended runway centreline is a training overlay');
    if (environment.publishedAirspace) notes.push('Published chart references are separate from the configured exercise runway and SRA final');
    else if (environment.lfaBoundary.length >= 3) notes.push('LFA boundary is a local training reference only');
    if (sra) notes.push(presentation.descent ? 'SRA corridor and descent profile are training guides, not safety limits or clearances' : 'SRA corridor is a training guide, not safety limits or clearances');
    return notes.join(' · ');
  }

  function drawRunway(context, canvas, environment) {
    const runway = environment.runwayOrientationDeg;
    const scale = Math.min(canvas.width, canvas.height) * .44 / selectedRadarRange();
    const project = (x, y) => [canvas.width / 2 + state.scopePan.x + x * scale, canvas.height / 2 + state.scopePan.y - y * scale];
    if (globalThis.ATCScopeVisuals?.drawRunwayStrip) globalThis.ATCScopeVisuals.drawRunwayStrip(context, environment, project, scale);
    else {
      const start = radarTransform(canvas, (3 / 1.852) / 2, runway), end = radarTransform(canvas, (3 / 1.852) / 2, runway + 180);
      context.strokeStyle = '#91979c'; context.lineWidth = 5; context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke();
    }
    const [cx, cy] = project(0, 0);
    context.fillStyle = '#b8d1ca'; context.font = '11px IBM Plex Mono';
    if (environment.publishedAirspace?.layerVisibility?.arp !== false) {
      context.beginPath(); context.arc(cx, cy, 3, 0, Math.PI * 2); context.fill();
      context.fillText('ARP', cx + 8, cy - 9);
    }
    context.fillText(`${environment.publishedAirspace ? 'EXERCISE ' : ''}RWY ${pad(runway)}°`, cx + 13, cy + 21);
  }

  function radarChartOptions(canvas, environment) {
    return { width: canvas.width, height: canvas.height,
      cx: canvas.width / 2 + state.scopePan.x, cy: canvas.height / 2 + state.scopePan.y,
      scale: Math.min(canvas.width, canvas.height) * .44 / selectedRadarRange(), rangeNm: selectedRadarRange(),
      environment, metadata: state.metadata, runway: globalThis.ATCScopeVisuals?.runwayGeometry(environment),
      obstacles: globalThis.ATCScopeVisuals?.overlayObstacles(canvas, { document, width: canvas.width, height: canvas.height }) || [] };
  }

  function drawRadarEnvironment(context, canvas, environment, showExtendedCentreline, showLfa = true, ringLabelBoxes = []) {
    const options = radarChartOptions(canvas, environment), Display = globalThis.ATCSuiteDisplay;
    if (!publishedBoundaryControls) publishedBoundaryControls = globalThis.ATSPublishedBoundaries?.createBoundaryControls(byId('studentChartReference'), { onChange: renderObservation });
    publishedBoundaryControls?.update(environment.publishedAirspace?.referenceBoundaries, { enabled: environment.publishedAirspace?.layerVisibility?.internationalBoundary !== false });
    const chartLabels = Display?.drawRadarEnvironment(context, { ...options, obstacles: [...options.obstacles, ...ringLabelBoxes], showExtendedCentreline, showLfa });
    Display?.drawPublishedAirspace(context, { ...options, publishedAirspace: environment.publishedAirspace,
      layerVisibility: { lfa: showLfa }, boundaryVisibleIds: publishedBoundaryControls?.visibleIds(), chartLabels });
    return chartLabels;
  }

  function drawSraReferences(context, canvas, overlays, radius, environment, showDescentProfile, chartLabels) {
    globalThis.ATCSuiteDisplay?.drawSraReferences(context, { ...radarChartOptions(canvas, environment), overlays, showDescentProfile, chartLabels });
  }

  function renderPar() {
    const observation = state.observation || {}, history = selectedHistory(observation.history || [], Number(byId('parHistory').value));
    const range = Number(byId('parRangeScale').value) || 10, glidepath = state.metadata.glidepathDeg || 3;
    const lost = !['tracking', 'tracked'].includes(observation.trackState);
    const azVisible = drawParPanel(byId('parAzimuth'), history, lost ? null : observation.azimuth?.deviationDeg, 'AZ', range, glidepath);
    const elVisible = drawParPanel(byId('parElevation'), history, lost ? null : observation.elevation?.deviationDeg, 'EL', range, glidepath);
    byId('parTrackState').textContent = `${state.metadata.approachCallsign || state.metadata.callsign || 'APPROACH'} · ${lost ? String(observation.trackState || 'NO TRACK').toUpperCase() : !azVisible || !elVisible ? 'OFF-SCALE' : 'TRACKING'}`;
    byId('parRange').textContent = `RANGE ${observation.rangeNm == null ? '—' : observation.rangeNm.toFixed(1) + ' NM'}`;
    byId('parLateral').textContent = `CENTRELINE ${deviationText(observation.azimuth?.deviationDeg, 'LEFT', 'RIGHT')}${trendText(observation.azimuth?.trend)}`;
    byId('parVertical').textContent = `GLIDEPATH ${deviationText(observation.elevation?.deviationDeg, 'LOW', 'HIGH')}${trendText(observation.elevation?.trend)}`;
    byId('parGlidepathLabel').textContent = `${glidepath.toFixed(1)}° GLIDEPATH · HEIGHT ABOVE TOUCHDOWN`;
    byId('parSampleStatus').textContent = `${state.metadata.parRefreshHz || 1} HZ TRAINING · ${range} NM${Number.isFinite(observation.timestamp) ? ` · SAMPLE AGE ${Math.max(0, state.simulationTime - observation.timestamp).toFixed(1)} S` : ' · AWAITING SAMPLE'}`;
  }

  function deviationText(value, negative, positive) { if (!Number.isFinite(value)) return '—'; if (Math.abs(value) < .05) return 'ON'; return `${Math.abs(value).toFixed(2)}° ${value < 0 ? negative : positive}`; }
  function trendText(value) { return ['closing', 'opening', 'stable'].includes(value) ? ` · ${value.toUpperCase()}` : ''; }

  function drawParPanel(canvas, history, deviation, axis, range, glidepath) {
    const context = canvas.getContext('2d'), width = canvas.width, height = canvas.height, observation = state.observation || {};
    const left = 86, right = width - 38, top = 30, bottom = height - 49, graphWidth = right - left, graphHeight = bottom - top;
    const elevation = axis === 'EL', ceilingFt = range === 10 ? 4000 : 8000, lateralNm = range === 10 ? 1 : 2;
    const xAt = distance => right - distance / range * graphWidth;
    const yAt = value => elevation ? bottom - value / ceilingFt * graphHeight : (top + bottom) / 2 - value / lateralNm * graphHeight / 2;
    const physicalValue = (distance, angle) => Math.tan((elevation ? glidepath + angle : angle) * Math.PI / 180) * distance * (elevation ? 6076.12 : 1);
    const inScale = (distance, value) => Number.isFinite(distance) && distance >= 0 && distance <= range && Number.isFinite(value) && (elevation ? value >= 0 && value <= ceilingFt : Math.abs(value) <= lateralNm);
    context.clearRect(0, 0, width, height); context.fillStyle = '#071b1d'; context.fillRect(0, 0, width, height);
    context.strokeStyle = '#24504d'; context.lineWidth = 1; context.font = '13px IBM Plex Mono'; context.fillStyle = '#a4beb2';
    for (let index = 0; index <= 5; index += 1) {
      const distance = range * index / 5, x = xAt(distance);
      context.beginPath(); context.moveTo(x, top); context.lineTo(x, bottom); context.stroke(); context.textAlign = 'center'; context.fillText(`${distance}`, x, bottom + 22);
    }
    for (let index = 0; index <= 4; index += 1) {
      const value = elevation ? ceilingFt * index / 4 : -lateralNm + lateralNm * index / 2, y = yAt(value);
      context.beginPath(); context.moveTo(left, y); context.lineTo(right, y); context.stroke(); context.textAlign = 'right';
      context.fillText(elevation ? `${Math.round(value)}` : value === 0 ? '0' : `${Math.abs(value).toFixed(1)} ${value > 0 ? 'R' : 'L'}`, left - 10, y + 4);
    }
    context.textAlign = 'left'; context.fillText(elevation ? 'FT' : 'NM', 22, 18); context.textAlign = 'center'; context.fillText('APPROACH RANGE · NM', (left + right) / 2, height - 7); context.textAlign = 'left';
    // Nominal angular training guides are display references, not safety limits.
    const guideHalfAngle = elevation ? .5 : 1;
    const lowerGuideY = yAt(physicalValue(range, -guideHalfAngle)), upperGuideY = yAt(physicalValue(range, guideHalfAngle));
    context.save(); context.beginPath(); context.rect(left, top, graphWidth, graphHeight); context.clip();
    context.fillStyle = 'rgba(103, 143, 103, .08)'; context.beginPath(); context.moveTo(left, lowerGuideY); context.lineTo(right, yAt(0)); context.lineTo(left, upperGuideY); context.closePath(); context.fill();
    context.strokeStyle = '#597966'; context.lineWidth = 1; context.setLineDash([5, 7]);
    for (const guideY of [lowerGuideY, upperGuideY]) { context.beginPath(); context.moveTo(left, guideY); context.lineTo(right, yAt(0)); context.stroke(); }
    context.setLineDash([]); context.restore();
    context.fillStyle = '#a6b99b'; context.font = '12px IBM Plex Mono'; context.textAlign = 'right'; context.fillText(`±${guideHalfAngle}° TRAINING GUIDE`, right, 18); context.textAlign = 'left';
    context.strokeStyle = '#d5bc72'; context.lineWidth = 2; context.beginPath(); context.moveTo(left, yAt(elevation ? physicalValue(range, 0) : 0)); context.lineTo(right, yAt(0)); context.stroke();
    context.fillStyle = '#d5bc72'; context.fillText(elevation ? `${glidepath.toFixed(1)}°` : 'CL', right - 32, yAt(0) - 9);
    const key = axis === 'AZ' ? 'azimuthDeviationDeg' : 'elevationDeviationDeg';
    history.forEach((point, index) => {
      if (!Number.isFinite(point[key])) return;
      const value = physicalValue(point.rangeNm, point[key]);
      if (!inScale(point.rangeNm, value)) return;
      context.globalAlpha = .2 + .35 * (index + 1) / Math.max(1, history.length); context.fillStyle = '#d2e8bc'; context.beginPath(); context.arc(xAt(point.rangeNm), yAt(value), 3, 0, Math.PI * 2); context.fill();
    });
    context.globalAlpha = 1;
    const currentValue = Number.isFinite(deviation) ? physicalValue(observation.rangeNm, deviation) : NaN;
    const visible = inScale(observation.rangeNm, currentValue);
    if (visible) { context.fillStyle = '#f1f8ca'; context.beginPath(); context.arc(xAt(observation.rangeNm), yAt(currentValue), 6, 0, Math.PI * 2); context.fill(); }
    else { context.fillStyle = '#edbb7d'; context.font = '14px IBM Plex Mono'; context.fillText(Number.isFinite(deviation) ? 'RETURN OFF-SCALE' : 'NO CURRENT RETURN', left + 16, top + 21); }
    return visible;
  }

  function changeDf(reference) {
    state.displayBearing = reference;
    byId('selectQdm').setAttribute('aria-pressed', String(reference === 'qdm'));
    byId('selectQte').setAttribute('aria-pressed', String(reference === 'qte'));
    renderDf();
  }

  // These instructor-provided aids start visible when the metadata declares
  // them. Student data labels intentionally start off for a decluttered scope.
  byId('radarOverlayCentreline').checked = true;
  byId('radarOverlayDescent').checked = true;
  byId('radarOverlayLfa').checked = true;
  byId('joinPin').addEventListener('input', event => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6); });
  byId('joinSession').addEventListener('click', requestJoin); byId('joinPin').addEventListener('keydown', event => { if (event.key === 'Enter') requestJoin(); });
  byId('reconnectStudent').addEventListener('click', () => {
    cancelPilotAudio();
    if (!state.session?.rejoin()) requestJoin();
  });
  byId('cancelJoin').addEventListener('click', () => { state.session?.close(); state.session = null; show('joinPanel'); });
  byId('studentReady').addEventListener('click', ready); byId('selectQdm').addEventListener('click', () => changeDf('qdm')); byId('selectQte').addEventListener('click', () => changeDf('qte'));
  for (const control of ['radarHistory', 'radarRange', 'parRangeScale', 'parHistory', ...radarLabelFields.map(([, id]) => id), 'radarOverlayCentreline', 'radarOverlayDescent', 'radarOverlayLfa']) byId(control).addEventListener('change', renderObservation);
  // Range changes redraw only this controller's received picture, including
  // while paused. They never request aircraft truth or change session state.
  const radarZoom = globalThis.ATCSuiteDisplay?.bindScopeZoom(byId('radarScope'), {
    getRange: selectedRadarRange,
    setRange: range => { byId('radarRange').value = String(range); renderObservation(); },
    isEnabled: () => !byId('studentWorkspace').hidden && !byId('radarStudentView').hidden
      && ['surveillance', 'sra'].includes(state.metadata?.mode)
  });
  byId('studentRadarZoomIn').addEventListener('click', () => radarZoom?.zoom('in'));
  byId('studentRadarZoomOut').addEventListener('click', () => radarZoom?.zoom('out'));
  for (const id of ['radarScope', 'studentEstimateScope']) {
    byId(id).addEventListener('pointerdown', studentScopePointerDown); byId(id).addEventListener('pointermove', studentScopePointerMove);
    byId(id).addEventListener('pointerup', studentScopePointerUp); byId(id).addEventListener('pointercancel', event => { state.plotting?.onPointerCancel(event); state.scopeDrag = null; });
  }
  byId('studentScopeRange').addEventListener('change', renderObservation);
  for (const id of ['studentRingSpacing', 'radarRingSpacing']) byId(id)?.addEventListener('change', renderObservation);
  if (typeof ResizeObserver === 'function') {
    let resizeFrame = null;
    const redrawScope = () => {
      if (resizeFrame != null || byId('studentWorkspace').hidden || !state.metadata) return;
      resizeFrame = requestAnimationFrame(() => { resizeFrame = null; renderObservation(); });
    };
    const resizeObserver = new ResizeObserver(redrawScope);
    for (const id of ['radarScope', 'studentEstimateScope']) resizeObserver.observe(byId(id));
  }
  byId('resetStudentScopePan').addEventListener('click', () => { state.scopePan = { x: 0, y: 0 }; renderObservation(); });
  byId('resetRadarScopePan').addEventListener('click', () => { state.scopePan = { x: 0, y: 0 }; renderObservation(); });
  byId('closeRadarInspection').addEventListener('click', closeRadarInspection);
  byId('radarInspectionHandle').addEventListener('pointerdown', beginRadarInspectionDrag);
  byId('studentAudio').addEventListener('change', () => setPilotAudio(byId('studentAudio').checked));
  byId('togglePilotAudio').addEventListener('click', () => setPilotAudio(!byId('studentAudio').checked));
  refreshAudioAvailability();
  if ('speechSynthesis' in globalThis) speechSynthesis.addEventListener('voiceschanged', refreshAudioAvailability);
  addEventListener('pointermove', moveRadarInspection); addEventListener('pointerup', endRadarInspectionDrag); addEventListener('pointercancel', endRadarInspectionDrag);
  addEventListener('resize', () => state.metadata && chooseMode(state.metadata.mode)); addEventListener('orientationchange', () => setTimeout(() => state.metadata && chooseMode(state.metadata.mode), 100));
  addEventListener('beforeunload', () => { cancelPilotAudio(); state.session?.close(); });
  state.heartbeat = setInterval(() => { state.session?.heartbeat(); state.session?.tick(); }, 4000);
  state.freshnessTimer = setInterval(renderFreshness, 1000);
  void initialiseStudentPlotting();
  if (typeof requestAnimationFrame === 'function') {
    let priorFrame = 0;
    const animateScan = timestamp => {
      if (state.loggingOut) return;
      state.animationFrame = requestAnimationFrame(animateScan);
      if (reducedMotion() || timestamp - priorFrame < 33 || byId('studentWorkspace').hidden || !['sra', 'surveillance'].includes(state.metadata?.mode) || state.session?.snapshot().state !== 'running') return;
      priorFrame = timestamp;
      try { renderRadar(); } catch (_) { state.pictureError = true; }
    };
    state.animationFrame = requestAnimationFrame(animateScan);
  }
  try {
    const params = new URLSearchParams(location.search);
    const selectedConnection = params.get('connection');
    byId('exerciseConnection').value = selectedConnection === 'local' || selectedConnection === 'online'
      ? selectedConnection : sessionStorage.getItem('atc-suite-connection') === 'online' ? 'online' : 'local';
    const requestedPin = params.get('pin');
    if (/^\d{6}$/.test(requestedPin || '')) {
      byId('joinPin').value = requestedPin;
      if (params.get('join') === '1') requestJoin();
      return;
    }
    const savedPin = sessionStorage.getItem('reds.atc-suite.last-pin');
    if (/^\d{6}$/.test(savedPin || '') && sessionStorage.getItem(`reds.atc-suite.seat.${savedPin}`)) {
      byId('joinPin').value = savedPin; requestJoin();
    }
  } catch (_) { /* Manual PIN entry works without session storage. */ }
})();
