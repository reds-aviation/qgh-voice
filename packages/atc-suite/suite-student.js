(function initialiseStudent() {
  'use strict';
  const Session = globalThis.ATCSuiteSession;
  if (!Session) return;
  const byId = id => document.getElementById(id);
  const state = { session: null, metadata: null, observation: null, simulationTime: 0, displayBearing: 'qdm', heartbeat: null,
    radarInspection: null, radarDrag: null, audioGeneration: 0, activeTransmission: null, renderedAt: null, pictureError: false };
  const clock = seconds => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.floor(Math.max(0, seconds)) % 60).padStart(2, '0')}`;
  const pad = value => String(Math.round(((Number(value) % 360) + 360) % 360) % 360).padStart(3, '0');
  const modeLabel = mode => ({ qgh: 'QGH / DIRECTION FINDING', surveillance: 'SURVEILLANCE VECTORING', sra: 'SURVEILLANCE RADAR APPROACH', par: 'PRECISION APPROACH RADAR' })[mode] || 'CONTROLLER POSITION';
  const radarLabelFields = [
    ['callsign', 'radarLabelCallsign'], ['squawk', 'radarLabelSquawk'], ['modeS', 'radarLabelModeS'], ['level', 'radarLabelLevel'],
    ['groundSpeed', 'radarLabelSpeed'], ['heading', 'radarLabelHeading'], ['bearingRange', 'radarLabelBearingRange']
  ];

  function show(id) {
    for (const name of ['joinPanel', 'waitingPanel', 'readyPanel', 'studentWorkspace', 'studentEnded', 'orientationGate']) byId(name).hidden = name !== id;
    if (id !== 'studentWorkspace') document.body.classList.toggle('narrow-radar', false);
  }

  function onSessionEvent(event) {
    const priorMode = state.metadata?.mode, priorProfile = state.metadata?.radarProfile;
    const snapshot = event.snapshot || state.session?.snapshot();
    if (snapshot) {
      state.metadata = snapshot.publicMetadata || state.metadata;
      if (Object.hasOwn(snapshot, 'observation')) state.observation = snapshot.observation;
      state.simulationTime = Number(snapshot.simulationTime) || 0;
      byId('studentClock').textContent = clock(snapshot.simulationTime);
    }
    if (event.kind === 'admitted' || event.kind === 'rejoined') {
      byId('studentReady').disabled = false; byId('studentReady').textContent = 'READY';
      show('readyPanel'); byId('readyMode').textContent = modeLabel(state.metadata.mode);
      if (event.kind === 'rejoined') setPilotAudio(false);
    } else if (event.kind === 'join-rejected') {
      show('joinPanel'); byId('joinStatus').textContent = 'Unable to join. Check the PIN and active instructor session.';
    } else if (event.kind === 'lifecycle') {
      renderLifecycle(snapshot.state);
    } else if (event.kind === 'public-metadata') {
      state.metadata = event.publicMetadata || snapshot?.publicMetadata || state.metadata;
      // A transfer changes the observation schema. Do not briefly paint an old
      // surveillance plot in a newly selected PAR display. A same-mode update
      // (such as the configured SRA approach speed) keeps the live picture.
      if (priorMode && (state.metadata?.mode !== priorMode || state.metadata?.radarProfile !== priorProfile)) {
        state.observation = null; state.renderedAt = null; cancelPilotAudio();
      }
      if (!byId('studentWorkspace').hidden) {
        renderWorkspaceMode();
        renderObservation();
      }
    } else if (event.kind === 'observation') {
      state.observation = event.observation; renderObservation();
    } else if (event.kind === 'caption') {
      renderCaption(event.caption, event.transmissionId);
    } else if (event.kind === 'observation-rejected') {
      state.pictureError = true;
    } else if (event.kind === 'disconnected') {
      setPilotAudio(false);
      byId('connectionState').textContent = 'DISCONNECTED'; byId('studentExerciseState').textContent = 'PICTURE FROZEN';
    } else if (event.kind === 'terminated') { setPilotAudio(false); show('studentEnded'); }
    renderFreshness(snapshot);
  }

  function requestJoin() {
    const pin = byId('joinPin').value.replace(/\D/g, '');
    if (!/^\d{6}$/.test(pin)) { byId('joinStatus').textContent = 'Enter all six digits.'; return; }
    state.session?.close();
    state.session = Session.createStudentSession({ pin, storage: localStorage,
      recoveryStorage: typeof sessionStorage === 'undefined' ? undefined : sessionStorage,
      transportFactory: channelName => Session.createLocalSessionTransport({ channelName }), onEvent: onSessionEvent });
    try { sessionStorage.setItem('reds.atc-suite.last-pin', pin); } catch (_) {}
    show('waitingPanel'); byId('waitingMessage').textContent = `Session ${pin.slice(0, 3)} ${pin.slice(3)} · waiting for admission.`;
    if (state.session.requestJoin()) { /* Admission events determine the next panel. */ }
    else { show('joinPanel'); byId('joinStatus').textContent = 'No active local session matches that PIN.'; }
  }

  function ready() {
    if (!state.session?.ready(byId('studentAudio').checked ? 'audio' : 'captions')) return;
    byId('studentReady').disabled = true; byId('studentReady').textContent = 'READY · WAITING FOR START';
  }

  function renderLifecycle(lifecycle) {
    if (['ready', 'running', 'paused'].includes(lifecycle)) {
      show('studentWorkspace');
      byId('studentExerciseState').textContent = lifecycle.toUpperCase(); byId('connectionState').textContent = 'CONNECTED';
      renderWorkspaceMode(); refreshAudioAvailability(); renderObservation();
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
    byId('qghStudentView').hidden = mode !== 'qgh';
    byId('radarStudentView').hidden = !['surveillance', 'sra'].includes(mode);
    byId('parStudentView').hidden = mode !== 'par';
    if (!['surveillance', 'sra'].includes(mode)) closeRadarInspection();
    byId('radarTitle').textContent = mode === 'sra' ? 'SURVEILLANCE RADAR APPROACH' : 'SURVEILLANCE DISPLAY';
    const narrow = !byId('studentWorkspace').hidden && mode !== 'qgh' && matchMedia('(orientation: portrait) and (max-width: 700px)').matches;
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
      else renderRadar();
      state.renderedAt = Date.now(); state.pictureError = false;
    } catch (_) { state.pictureError = true; }
    renderFreshness();
  }

  function renderFreshness(snapshot = state.session?.snapshot()) {
    if (!snapshot) return;
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
    const observation = state.observation || {};
    const status = String(observation.status || 'idle').toUpperCase();
    byId('dfSignalState').textContent = status === 'IDLE' ? 'NO SIGNAL' : `SIGNAL ${status}`;
    let bearing = observation.bearingDeg;
    if (bearing != null && observation.bearingType !== state.displayBearing) bearing = (bearing + 180) % 360;
    byId('dfBearing').textContent = bearing == null ? '---' : `${pad(bearing)}°`;
    byId('dfModeLabel').textContent = state.displayBearing === 'qdm' ? 'QDM · HOMING' : 'QTE · TRUE BEARING';
    byId('dfCallsign').textContent = `${observation.callsign || 'AIRCRAFT'} · ${observation.transmissionState === 'pilot' ? 'SIGNAL LIVE' : observation.transmissionState === 'held' ? 'SIGNAL HELD' : 'NO TRANSMISSION'}`;
  }

  function radarTransform(canvas, rangeNm, azimuthDeg) {
    const radius = Math.min(canvas.width, canvas.height) * .41 * rangeNm / selectedRadarRange(), radians = azimuthDeg * Math.PI / 180;
    return { x: canvas.width / 2 + Math.sin(radians) * radius, y: canvas.height / 2 - Math.cos(radians) * radius };
  }

  function renderRadar() {
    const canvas = byId('radarScope'), context = canvas.getContext('2d'), observation = state.observation || {};
    const width = canvas.width, height = canvas.height, cx = width / 2, cy = height / 2, radius = Math.min(width, height) * .41, range = selectedRadarRange();
    context.clearRect(0, 0, width, height); context.fillStyle = '#071b1d'; context.fillRect(0, 0, width, height);
    context.strokeStyle = '#24504d'; context.lineWidth = 1; context.fillStyle = '#92b6ad'; context.font = '14px IBM Plex Mono';
    for (let ring = 1; ring <= 4; ring += 1) { context.beginPath(); context.arc(cx, cy, radius * ring / 4, 0, Math.PI * 2); context.stroke(); context.fillText(`${range * ring / 4} NM`, cx + 9, cy - radius * ring / 4 + 18); }
    context.beginPath(); context.moveTo(cx, cy - radius); context.lineTo(cx, cy + radius); context.moveTo(cx - radius, cy); context.lineTo(cx + radius, cy); context.stroke();
    for (let degree = 0; degree < 360; degree += 10) {
      const theta = degree * Math.PI / 180, inner = radius - (degree % 30 === 0 ? 13 : 6);
      context.beginPath(); context.moveTo(cx + Math.sin(theta) * inner, cy - Math.cos(theta) * inner); context.lineTo(cx + Math.sin(theta) * radius, cy - Math.cos(theta) * radius); context.stroke();
    }
    context.textAlign = 'center'; context.fillStyle = '#c0d5c9'; context.font = '16px IBM Plex Mono';
    [['N · 000', cx, cy - radius - 23], ['E · 090', cx + radius + 49, cy + 5], ['S · 180', cx, cy + radius + 30], ['W · 270', cx - radius - 49, cy + 5]].forEach(([label, x, y]) => context.fillText(label, x, y));
    context.textAlign = 'left';
    context.fillStyle = '#9abbaf'; context.font = '14px IBM Plex Mono'; context.fillText(`RANGE ${range} NM`, 26, 32); context.fillText('NORTH UP', width - 120, 32);
    const environment = radarEnvironment();
    drawRunway(context, canvas, environment);
    const scopePresentation = updateRadarScopeControls(environment);
    drawRadarEnvironment(context, canvas, environment, scopePresentation.extendedCentreline);
    if (state.metadata.mode === 'sra' && observation.overlays) drawSraReferences(context, canvas, observation.overlays, radius, environment, scopePresentation.descent);
    // Only the sensor's transmitted samples are used. No target extrapolation occurs here.
    const plots = currentRadarPlots();
    selectedHistory(observation.history || [], Number(byId('radarHistory').value), plots).forEach(plot => drawPlot(context, canvas, plot, .35, false));
    plots.forEach(plot => drawPlot(context, canvas, plot, 1, true));
    if (Number.isFinite(observation.scanAngleDeg)) {
      const sweep = observation.scanAngleDeg * Math.PI / 180; context.strokeStyle = '#389481'; context.lineWidth = 1.5; context.beginPath(); context.moveTo(cx, cy); context.lineTo(cx + Math.sin(sweep) * radius, cy - Math.cos(sweep) * radius); context.stroke();
    }
    drawRadarLabels(context, canvas, plots);
    updateRadarInspection(plots);
    byId('scanRate').textContent = `${state.metadata.scanRpm || 12} RPM · ${state.metadata.revisitSeconds || 5} SEC REVISIT`;
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
  function displayedHeading(plot) { return Number.isFinite(plot?.headingDeg) ? `${pad(plot.headingDeg)}°` : null; }
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
    if (preferences.heading) tokens.push(`HDG ${notReported(displayedHeading(plot))}`);
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
    byId('radarOverlayCentreline').disabled = !centrelineAvailable;
    byId('radarOverlayDescent').disabled = !descentAvailable;
    byId('radarLabelHelp').textContent = correlated
      ? 'Labels are shown only beside cooperative square returns. Heading and ground speed are sampled track estimates. Primary + returns remain anonymous.'
      : 'Primary-only picture: labels are unavailable and every return remains anonymous.';
    byId('radarAidHelp').textContent = centrelineAvailable || descentAvailable
      ? 'Available instructor-provided aids can be hidden locally for declutter.'
      : 'No instructor-provided scope aids are available for this exercise.';
    const visibleAids = [centrelineAvailable && byId('radarOverlayCentreline').checked, descentAvailable && byId('radarOverlayDescent').checked].filter(Boolean).length;
    byId('radarScopeControlStatus').textContent = correlated
      ? `${labelCount ? `${labelCount} LABEL${labelCount === 1 ? '' : 'S'}` : 'DECLUTTERED'}${visibleAids ? ` · ${visibleAids} AID${visibleAids === 1 ? '' : 'S'}` : ''}`
      : 'PRIMARY ONLY';
    return { preferences, extendedCentreline: centrelineAvailable && byId('radarOverlayCentreline').checked,
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
    const source = state.metadata?.radarEnvironment || {}, fallbackRunway = Number(state.metadata?.runwayOrientation) || 0;
    const points = Array.isArray(source.lfaBoundary) ? source.lfaBoundary
      .filter(point => Number.isFinite(point?.bearingDeg) && Number.isFinite(point?.rangeNm) && point.rangeNm >= 0)
      .slice(0, 12).map(point => ({ bearingDeg: point.bearingDeg, rangeNm: point.rangeNm })) : [];
    return {
      runwayOrientationDeg: Number.isFinite(source.runwayOrientationDeg) ? source.runwayOrientationDeg : fallbackRunway,
      extendedCentreline: source.extendedCentreline === true,
      extendedCentrelineNm: Number.isFinite(source.extendedCentrelineNm) ? Math.max(0, source.extendedCentrelineNm) : 20,
      centrelineTickNm: Number.isFinite(source.centrelineTickNm) ? Math.max(.5, source.centrelineTickNm) : 2,
      lfaBoundary: points,
      // A student can only hide an instructor-provided SRA aid. Do not infer a
      // guide when the safe metadata did not declare one.
      sraDescentProfile: state.metadata?.mode === 'sra' && source.sraDescentProfile === true
    };
  }

  function radarGuideNote(environment, sra, presentation = {}) {
    const notes = ['North up', 'sampled returns only', 'range rings in NM', 'runway symbol schematic'];
    notes.push(correlatedRadarProfile() ? '+ primary return · □ selectable SSR return' : '+ primary return');
    if (environment.extendedCentreline && presentation.extendedCentreline) notes.push('extended runway centreline is a training overlay');
    if (environment.lfaBoundary.length >= 3) notes.push('LFA boundary is a local training reference only');
    if (sra) notes.push(presentation.descent ? 'SRA corridor and descent profile are training guides, not safety limits or clearances' : 'SRA corridor is a training guide, not safety limits or clearances');
    return notes.join(' · ');
  }

  function drawRunway(context, canvas, environment) {
    const runway = environment.runwayOrientationDeg;
    const start = radarTransform(canvas, .65, runway), end = radarTransform(canvas, .65, runway + 180);
    context.strokeStyle = '#d2d9bb'; context.lineWidth = 5; context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke();
    context.fillStyle = '#c7d1b5'; context.font = '12px IBM Plex Mono'; context.fillText(`RWY ${pad(runway)}°`, canvas.width / 2 + 13, canvas.height / 2 + 21);
  }

  function drawRadarEnvironment(context, canvas, environment, showExtendedCentreline) {
    const range = selectedRadarRange();
    if (showExtendedCentreline && environment.extendedCentreline && environment.extendedCentrelineNm > 0) {
      const total = Math.min(range, environment.extendedCentrelineNm), runway = environment.runwayOrientationDeg;
      context.strokeStyle = '#8f936d'; context.lineWidth = 1; context.setLineDash([9, 6]);
      for (const direction of [runway, runway + 180]) {
        const point = radarTransform(canvas, total, direction);
        context.beginPath(); context.moveTo(canvas.width / 2, canvas.height / 2); context.lineTo(point.x, point.y); context.stroke();
      }
      context.setLineDash([]); context.fillStyle = '#b6bd91'; context.font = '11px IBM Plex Mono';
      const tick = environment.centrelineTickNm;
      for (const direction of [runway, runway + 180]) {
        const theta = direction * Math.PI / 180;
        for (let distance = tick; distance <= total + 1e-9; distance += tick) {
          const point = radarTransform(canvas, distance, direction), dx = Math.cos(theta) * 5, dy = Math.sin(theta) * 5;
          context.beginPath(); context.moveTo(point.x - dx, point.y - dy); context.lineTo(point.x + dx, point.y + dy); context.stroke();
          context.fillText(`${Math.round(distance)} NM`, point.x + 7, point.y - 5);
        }
      }
      const labelY = state.metadata?.mode === 'sra' ? canvas.height - 118 : canvas.height - 28;
      context.fillText(`EXTENDED RWY CENTRELINE · ${pad(runway)}° / ${pad(runway + 180)}°`, 26, labelY);
    }
    if (environment.lfaBoundary.length >= 3) {
      const points = environment.lfaBoundary.map(point => radarTransform(canvas, point.rangeNm, point.bearingDeg));
      context.strokeStyle = '#ca8a6a'; context.lineWidth = 1.4; context.setLineDash([4, 8]); context.beginPath();
      context.moveTo(points[0].x, points[0].y); points.slice(1).forEach(point => context.lineTo(point.x, point.y)); context.lineTo(points[0].x, points[0].y); context.stroke(); context.setLineDash([]);
      const first = environment.lfaBoundary[0];
      if (first.rangeNm <= range) { context.fillStyle = '#e3aa84'; context.font = '11px IBM Plex Mono'; context.fillText('LFA · TRAINING BOUNDARY', points[0].x + 8, points[0].y - 8); }
    }
  }

  function drawSraReferences(context, canvas, overlays, radius, environment, showDescentProfile) {
    const bearing = overlays.centrelineDeg ?? ((Number(overlays.runwayOrientationDeg ?? state.metadata.runwayOrientation) + 180) % 360);
    const angle = bearing * Math.PI / 180, cx = canvas.width / 2, cy = canvas.height / 2;
    const totalWidthNm = Number.isFinite(overlays.approachCorridorWidthNm) && overlays.approachCorridorWidthNm >= 0 ? overlays.approachCorridorWidthNm : 2;
    const halfWidthPx = totalWidthNm / 2 / selectedRadarRange() * radius;
    const alongPx = Math.sqrt(Math.max(0, radius * radius - halfWidthPx * halfWidthPx));
    context.strokeStyle = '#597966'; context.lineWidth = 1; context.setLineDash([5, 7]);
    if (halfWidthPx < radius) {
      for (const side of [-1, 1]) {
        const x = cx + Math.cos(angle) * halfWidthPx * side, y = cy + Math.sin(angle) * halfWidthPx * side;
        context.beginPath(); context.moveTo(x, y); context.lineTo(x + Math.sin(angle) * alongPx, y - Math.cos(angle) * alongPx); context.stroke();
      }
    }
    context.setLineDash([]);
    const glidepathDeg = Number.isFinite(state.metadata.glidepathDeg) ? state.metadata.glidepathDeg : 3;
    const configuredSpeed = Number.isFinite(state.metadata.approachSpeedKt) ? state.metadata.approachSpeedKt : null;
    const configuredType = state.metadata.approachAircraftType ? String(state.metadata.approachAircraftType).toUpperCase() : null;
    const feetPerNm = Math.tan(glidepathDeg * Math.PI / 180) * 6076.12;
    const descentRateFpm = configuredSpeed == null ? null : Math.round((feetPerNm * configuredSpeed / 60) / 10) * 10;
    context.fillStyle = '#a6b99b'; context.font = '12px IBM Plex Mono';
    context.fillText(`SRA TRAINING CORRIDOR · ${totalWidthNm} NM TOTAL`, 26, canvas.height - (showDescentProfile ? 98 : 51));
    context.strokeStyle = '#c4af64'; context.lineWidth = 1.5; context.setLineDash([9, 8]); context.beginPath(); context.moveTo(cx, cy); context.lineTo(cx + Math.sin(angle) * radius, cy - Math.cos(angle) * radius); context.stroke(); context.setLineDash([]);
    context.font = '12px IBM Plex Mono'; context.fillStyle = '#dac981';
    // Use the same instructor-selected interval as the extended centreline so
    // range cues remain consistent across the training scope.
    const markStep = Number.isFinite(environment.centrelineTickNm) ? environment.centrelineTickNm : 2;
    for (let distance = markStep; distance < selectedRadarRange(); distance += markStep) {
      const point = radarTransform(canvas, distance, bearing), dx = Math.cos(angle) * 6, dy = Math.sin(angle) * 6;
      context.beginPath(); context.moveTo(point.x - dx, point.y - dy); context.lineTo(point.x + dx, point.y + dy); context.stroke();
      const height = Math.round((feetPerNm * distance) / 10) * 10;
      context.fillText(showDescentProfile ? `${distance} NM · ${height.toLocaleString()} FT AAL` : `${distance}`, point.x + 9, point.y + 5);
    }
    if (Number.isFinite(overlays.terminationRangeNm) && overlays.terminationRangeNm <= selectedRadarRange()) {
      const point = radarTransform(canvas, overlays.terminationRangeNm, bearing), dx = Math.cos(angle) * 13, dy = Math.sin(angle) * 13;
      context.strokeStyle = '#edbb7d'; context.lineWidth = 3; context.beginPath(); context.moveTo(point.x - dx, point.y - dy); context.lineTo(point.x + dx, point.y + dy); context.stroke();
      context.fillStyle = '#edbb7d'; context.fillText(`TERMINATION ${overlays.terminationRangeNm} NM`, 26, canvas.height - 28);
    }
    context.fillText(`FINAL ${pad(state.metadata.finalTrack ?? (bearing + 180))}°`, 26, 56);
    if (showDescentProfile) {
      context.fillStyle = '#d9c980'; context.font = '11px IBM Plex Mono';
      context.fillText(`${glidepathDeg.toFixed(1)}° DESCENT TRAINING GUIDE · INBOUND CL ${pad(bearing)}° · HEIGHTS AAL`, 26, canvas.height - 74);
      context.fillText(`${configuredType ? `${configuredType} · ` : ''}${configuredSpeed == null ? 'CONFIGURED SPEED UNAVAILABLE' : `${configuredSpeed} KT CONFIGURED · ≈ ${descentRateFpm.toLocaleString()} FT/MIN`}`, 26, canvas.height - 51);
    }
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
  byId('joinPin').addEventListener('input', event => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6); });
  byId('joinSession').addEventListener('click', requestJoin); byId('joinPin').addEventListener('keydown', event => { if (event.key === 'Enter') requestJoin(); });
  byId('reconnectStudent').addEventListener('click', () => {
    cancelPilotAudio();
    if (!state.session?.rejoin()) requestJoin();
  });
  byId('cancelJoin').addEventListener('click', () => { state.session?.close(); state.session = null; show('joinPanel'); });
  byId('studentReady').addEventListener('click', ready); byId('selectQdm').addEventListener('click', () => changeDf('qdm')); byId('selectQte').addEventListener('click', () => changeDf('qte'));
  for (const control of ['radarHistory', 'radarRange', 'parRangeScale', 'parHistory', ...radarLabelFields.map(([, id]) => id), 'radarOverlayCentreline', 'radarOverlayDescent']) byId(control).addEventListener('change', renderObservation);
  byId('radarScope').addEventListener('pointerdown', selectRadarPlot);
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
  setInterval(renderFreshness, 1000);
  try {
    const savedPin = sessionStorage.getItem('reds.atc-suite.last-pin');
    if (/^\d{6}$/.test(savedPin || '') && sessionStorage.getItem(`reds.atc-suite.seat.${savedPin}`)) {
      byId('joinPin').value = savedPin; requestJoin();
    }
  } catch (_) { /* Manual PIN entry works without session storage. */ }
})();
