(function (root) {
  'use strict';
  const P = root.QGHProcedure, I = root.QGHProcedureIntent, adapter = root.QGHRadioAdapter;
  if (!P || !I || !adapter) return;
  const $ = id => document.getElementById(id);
  const tactical = Boolean($('tSetup'));
  let domain = null, pendingConflict = null;
  const history = [];
  const node = (tag, text, attrs = {}) => {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    return element;
  };
  function field(parent, label, id, value, min, max, step = 1) {
    const wrap = node('label', label, { class: 'procedure-field', for: id });
    const input = node('input', null, { id, type: typeof value === 'string' ? 'text' : 'number', value,
      ...(typeof value === 'number' ? { min, max, step, inputmode: 'decimal' } : {}) });
    wrap.append(input); parent.append(wrap); return input;
  }
  const setup = node('details', null, { class: 'procedure-setup' });
  setup.append(node('summary', 'AIRFIELD & VERTICAL TRAINING'));
  const grid = node('div', null, { class: 'procedure-grid' }); setup.append(grid);
  field(grid, 'RUNWAY DESIGNATOR', 'procedureRunway', tactical ? '23' : '15');
  field(grid, 'AERODROME ELEVATION · FT MSL', 'procedureElevation', 0, 0, 15000, 100);
  field(grid, 'QNH · hPa', 'procedureQnh', 1013, 850, 1100);
  field(grid, 'QFE · hPa', 'procedureQfe', 1013, 850, 1100);
  field(grid, 'TRAINING VERTICAL RATE · FT/MIN', 'procedureRate', 1000, 100, 6000, 100);
  field(grid, 'TRANSITION ALTITUDE · FT', 'procedureTransition', 10000, 1000, 25000, 1000);
  field(grid, 'TRANSITION LEVEL', 'procedureTransitionLevel', 120, 30, 300);
  field(grid, 'VISIBILITY · M', 'procedureVisibility', 10000, 0, 100000, 100);
  field(grid, 'VISUAL RANGE GATE · NM', 'procedureVisualRange', 2, .1, 10, .1);
  field(grid, 'VISUAL ALTITUDE GATE · FT AAL', 'procedureVisualAltitude', 3000, 100, 10000, 100);
  setup.append(node('p', 'Generic training rates and visual gates. Pressure conversion uses an approximate 27 ft/hPa.', { class: 'procedure-note' }));
  $('setupPilotReadbacks').before(setup);
  if (!tactical) {
    const initial = node('div', null, { class: 'field wide procedure-initial' });
    field(initial, 'INITIAL ALTITUDE · FT MSL', 'procedureInitialLevel', 15000, 1000, 45000, 1000);
    const random = node('button', 'RANDOMISE 9,000–19,000 FT', { type: 'button', id: 'procedureRandomLevel' });
    random.addEventListener('click', () => { const values = new Uint32Array(1); root.crypto.getRandomValues(values); $('procedureInitialLevel').value = 9000 + values[0] % 11 * 1000; });
    initial.append(random); document.querySelector('#setup .fields').append(initial);
  }
  const controls = node('details', null, { class: 'procedure-controls', id: 'procedureControls' });
  controls.append(node('summary', 'LEVEL & RADIO'));
  const live = node('div', null, { class: 'procedure-grid' }); controls.append(live);
  const value = field(live, 'CLEARED LEVEL', 'procedureTarget', 12000, 0, 45000, 100);
  const datumLabel = node('label', 'REFERENCE', { class: 'procedure-field', for: 'procedureDatum' });
  const datum = node('select', null, { id: 'procedureDatum' });
  for (const [code, label] of [['QNH', 'ALTITUDE · FT MSL'], ['QFE', 'HEIGHT · FT AAL'], ['STANDARD', 'FLIGHT LEVEL']]) datum.append(node('option', label, { value: code }));
  datumLabel.append(datum); live.append(datumLabel);
  datum.addEventListener('change', () => { value.max = datum.value === 'STANDARD' ? 450 : 45000; value.step = datum.value === 'STANDARD' ? 1 : 100; value.value = datum.value === 'STANDARD' ? 120 : 12000; });
  const buttons = node('div', null, { class: 'procedure-buttons' }); controls.append(buttons);
  function manual(actions, control) {
    const id = adapter.snapshot()?.source;
    if (!id) return;
    const result = execute({ accepted: true, intent: 'procedure-command', aircraft: id, actions });
    if (result.ok) { control?.classList.add('voice-affected'); root.setTimeout(() => control?.classList.remove('voice-affected'), 1600); }
    const ack = $(tactical ? 'tVoiceCommandAck' : 'voiceCommandAck');
    if (ack) { ack.hidden = false; ack.textContent = result.message; }
  }
  for (const [id, label, action] of [
    ['procedureClimb', 'CLIMB', () => [{ type: 'vertical', direction: 'CLIMB', target: { datum: datum.value, value: Number(value.value) } }]],
    ['procedureDescend', 'DESCEND', () => [{ type: 'vertical', direction: 'DESCENT', target: { datum: datum.value, value: Number(value.value) } }]],
    ['procedureMaintain', 'MAINTAIN LEVEL', () => [{ type: 'stop-vertical' }]],
    ['procedureReportLevel', 'REPORT LEVEL', () => [{ type: 'report-level' }]],
    ['procedureReportPassing', 'REPORT PASSING LEVEL', () => [{ type: 'arm-level', kind: 'passing', target: { datum: datum.value, value: Number(value.value) } }]],
    ['procedureReportReaching', 'REPORT REACHING', () => [{ type: 'arm-level', kind: 'reaching' }]],
    ['procedureReportVisual', 'REPORT RUNWAY VISUAL', () => [{ type: 'report-visual', kind: 'runway' }]]
  ]) { const button = node('button', label, { type: 'button', id }); button.addEventListener('click', () => manual(action(), button)); buttons.append(button); }
  const overrideLabel = node('label', 'VISUAL TRAINING OVERRIDE', { class: 'procedure-field', for: 'procedureVisualOverride' });
  const override = node('select', null, { id: 'procedureVisualOverride' });
  for (const [code, label] of [['', 'SCENARIO GATES'], ['NOT_VISUAL', 'FORCE NOT VISUAL'], ['VISUAL', 'FORCE VISUAL']]) override.append(node('option', label, { value: code }));
  overrideLabel.append(override); controls.append(overrideLabel);
  override.addEventListener('change', () => {
    const a = domain?.aircraft[adapter.snapshot()?.source]; if (a) a.visualOverride = override.value || null;
  });
  const readout = node('output', '', { class: 'procedure-readout', id: 'procedureReadout', 'aria-live': 'polite' }); controls.append(readout);
  $(tactical ? 'tControls' : 'controls').append(controls);
  const conflict = node('div', null, { class: 'procedure-conflict', hidden: '', role: 'status' });
  const warning = node('p', ''); conflict.append(warning);
  const confirm = node('button', 'CONFIRM LEVEL CONFLICT', { type: 'button' });
  const cancel = node('button', 'CANCEL', { type: 'button' }); conflict.append(confirm, cancel); controls.append(conflict);
  confirm.addEventListener('click', () => { const plan = pendingConflict; pendingConflict = null; conflict.hidden = true; if (plan) execute(plan, true); });
  cancel.addEventListener('click', () => { pendingConflict = null; conflict.hidden = true; });
  function environmentInput() {
    return { runway: $('procedureRunway').value.trim().toUpperCase(), aerodromeElevationFt: Number($('procedureElevation').value),
      qnhHpa: Number($('procedureQnh').value), qfeHpa: Number($('procedureQfe').value),
      transitionAltitudeFt: Number($('procedureTransition').value), transitionLevel: Number($('procedureTransitionLevel').value),
      weather: { visibilityM: Number($('procedureVisibility').value) },
      visualRangeNm: Number($('procedureVisualRange').value), visualAltitudeAalFt: Number($('procedureVisualAltitude').value) };
  }
  function initialize(fleet) {
    domain = P.create({ environment: environmentInput(), aircraft: fleet.map(a => ({ ...a,
      level: tactical ? a.level : Number($('procedureInitialLevel').value), verticalRateFpm: Number($('procedureRate').value) })) });
    pendingConflict = null; conflict.hidden = true; override.value = ''; history.length = 0;
    updateReadout(); return domain;
  }
  function updateReadout() {
    const a = domain?.aircraft[adapter.snapshot()?.source];
    if (!a) return;
    readout.textContent = `${P.levelReport(a, domain.environment)} · ${a.pressureReference} · SQUAWK ${a.squawk}`;
    override.value = a.visualOverride || '';
  }
  function execute(plan, confirmSeparation = false) {
    if (!domain || !adapter.active()) return { ok: false, message: 'START AN EXERCISE FIRST' };
    const source = tactical ? plan.aircraft : 'single';
    const context = adapter.procedureContext?.(source) || {};
    const result = P.apply(domain, { ...plan, aircraft: source }, { ...context, confirmSeparation });
    if (result.requiresSeparationConfirmation) {
      pendingConflict = plan; controls.open = true; conflict.hidden = false; warning.textContent = result.response.text;
      return { ok: false, message: result.response.text };
    }
    if (result.detach) adapter.detachFollower?.(source);
    const a = domain.aircraft[source];
    const labels = { APPLIED: 'EXECUTED', RECEIVED: 'INFORMATION RECEIVED', ARMED: 'REPORT ARMED', DEFERRED: 'STANDING BY — NO EXECUTION', NOT_APPLIED: 'NOT SIMULATED' };
    const label = result.authorization === 'REJECTED' ? 'NOT RECOGNISED' : labels[result.executionStatus];
    const message = `${result.response.text} · ${a?.callsign || ''}`;
    adapter.reportEvent?.(source, `${label} · ${result.response.text}`);
    root.QGHRadioWorkspace?.enqueueOutcome(result);
    adapter.highlightRadioTarget?.(source);
    const action = plan.actions?.[0];
    const id = action?.type === 'vertical' ? action.direction === 'CLIMB' ? 'procedureClimb' : 'procedureDescend'
      : action?.type === 'report-level' ? 'procedureReportLevel' : 'procedureControls';
    $(id)?.classList.add('voice-affected'); root.setTimeout(() => $(id)?.classList.remove('voice-affected'), 1800);
    if (action?.target) { datum.value = action.target.datum; value.value = action.target.value; }
    updateReadout();
    return { ok: result.authorization === 'AUTHORIZED', message, procedureOutcome: result };
  }
  function advance(duration) {
    if (!domain) return;
    const following = adapter.followingMap?.() || {};
    for (const report of P.step(domain, duration, following)) {
      adapter.reportEvent?.(report.source, report.text);
      root.QGHRadioWorkspace?.enqueueProcedureReport(report);
    }
    for (const a of Object.values(domain.aircraft)) {
      adapter.setActualLevel?.(a.id, a.actualAltitudeMslFt);
      const sample = adapter.snapshot(a.id);
      if (sample?.range > domain.environment.overheadRangeNm) { a.overheadObservations = []; a.lastOverheadBearing = null; }
    }
    history.push({ time: domain.simulationSeconds, levels: Object.fromEntries(Object.values(domain.aircraft).map(a => [a.id, a.actualAltitudeMslFt])) });
    updateReadout();
  }
  function endTransmission(source, token, snapshot) {
    if (domain && P.observeOverhead(domain, source, snapshot, token)) {
      const report = { source, timestamp: domain.simulationSeconds, text: 'OVERHEAD CONFIRMED' };
      adapter.reportEvent?.(source, report.text); root.QGHRadioWorkspace?.enqueueProcedureReport(report);
    }
  }
  root.QGHProcedureWorkspace = Object.freeze({ initialize, advance, execute, endTransmission, updateReadout,
    state: () => domain, history: () => history.slice(), snapshot: id => domain?.aircraft[id] || null });
})(typeof globalThis === 'undefined' ? this : globalThis);
