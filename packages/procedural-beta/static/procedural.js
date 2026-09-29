import { createMapWorkshop } from './map-workshop.js';
import { alignmentBriefing } from './chart-calibration.js';
import { createAircraftGestures, nearestAircraft } from './scope-interaction.js';
import { createRadarSweep } from './radar-sweep.js';
import { recordTrail, trailDots } from './scope-history.js';
import { createTrafficSetup } from './traffic-setup.js';
import { createChartWorkshop, drawAreas, routeWindowOpen } from './chart-workshop.js';
import { visibleSegment, reserveLabel, fitNavigation, approachReference } from './scope-navigation.js';
import { resolveRouteFixIds } from './aip-navigation.js';
const $ = (id) => document.getElementById(id);
const field = (form, name) => $(form).elements.namedItem(name);
const val = (form, name) => field(form, name).value.trim();
const num = (form, name) => Number(val(form, name));
const text = (id, value) => { $(id).textContent = String(value ?? ''); };
const norm = (v) => (v % 360 + 360) % 360;
const sizeDeskToViewport = () => document.documentElement.style.setProperty('--usable-height', `${window.visualViewport?.height || window.innerHeight || 700}px`);
window.visualViewport?.addEventListener('resize', sizeDeskToViewport);
window.addEventListener('resize', sizeDeskToViewport);
sizeDeskToViewport();
const pad = (v) => String(Math.round(norm(v)) % 360).padStart(3, '0');
const clock = (n) => new Date((36000 + n) * 1000).toISOString().slice(11, 19);
const elapsed = (n) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
const make = (tag, content, className) => {
    const e = document.createElement(tag);
    if (content)
        e.textContent = content;
    if (className)
        e.className = className;
    return e;
};
const key = 'qgh-procedural-browser-session-v1';
let stage = 'entry';
let room = null;
let drawerReturn = null;
let session = null, view = null, selected = '', generation = 0, pollTimer = 0, loginBusy = false, commandBusy = false;
let range = 60, showMap = false, mapId = '', mapURL = '', mapImage = null, mapLoading = '', mapGeneration = 0, receivedAt = 0, lastAudio = '', messageTimer = 0;
let settingsLoaded = false, chartIdentity = '';
const environmentDirty = new Set();
function syncEnvironmentInputs() {
    if (!view)
        return;
    for (const form of ['environment-form', 'threshold-form'])
        $(form).querySelectorAll('input[name]').forEach(input => {
            if (view?.environment[input.name] == null)
                return;
            if (environmentDirty.has(input.name) && input.value.trim() !== '' && Number.isFinite(Number(input.value)) && Number(input.value) === view.environment[input.name])
                environmentDirty.delete(input.name);
            if (!environmentDirty.has(input.name))
                input.value = String(view.environment[input.name]);
        });
}
let lastElapsed = -1, trailHistory = new Map(), drafts = new Map(), stripRevision = 0;
let pan = { x: 0, y: 0 }, ruler = [], pointer = null;
const display = { areas: true, rings: true, routes: true, labels: true, areaLabels: false, routeLabels: true, fixLabels: true, trails: true, vectors: false, runway: true, approach: false, ruler: false, fullscreen: false, sweep: !window.matchMedia('(prefers-reduced-motion: reduce)').matches, sweepRpm: 12 };
const hiddenAreas = new Set(), hiddenRoutes = new Set();
let conditionAircraft = '';
const conditionDirty = new Set();
const dfSettingsDirty = new Set();
const signatures = new Map();
function message(value, error = false) { clearTimeout(messageTimer); text('message', value); $('message').classList.toggle('error', error); messageTimer = window.setTimeout(() => text('message', ''), error ? 12000 : 5000); }
function clearAudio() {
    window.speechSynthesis?.cancel();
    lastAudio = '';
}
async function request(path, body, method) {
    const s = session, headers = {};
    if (s) {
        headers.Authorization = `Bearer ${s.token}`;
        headers['X-CSRF-Token'] = s.csrf;
    }
    const binary = body instanceof Blob;
    if (body !== undefined && !binary)
        headers['Content-Type'] = 'application/json';
    const response = await fetch(path, { method: method ?? (body === undefined ? 'GET' : 'POST'), headers, body: body === undefined ? undefined : binary ? body : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (response.status === 401 && !['/api/session', '/api/procedural/session'].includes(path) && s === session) {
        leave();
        message('Session ended. Reopen your desk.', true);
        throw new Error('Session ended. Reopen your desk.');
    }
    if (!response.ok) {
        let reason = `Request failed (${response.status})`;
        try {
            reason = (await response.json()).error || reason;
        }
        catch { }
        throw new Error(reason);
    }
    return response.json();
}
async function command(type, payload = {}, aircraftId, expectedExerciseId = view?.exerciseId) {
    if (!session)
        throw new Error('Open a session first.');
    if (expectedExerciseId && view?.exerciseId !== expectedExerciseId)
        throw new Error('The exercise changed. Re-enter this instruction.');
    if (commandBusy)
        throw new Error('Wait for the current instruction to finish.');
    commandBusy = true;
    pendingClock = type === 'clock' ? String(payload.action || '') : '';
    renderClockControls();
    const stamp = generation, auth = session;
    const cmd = { id: crypto.randomUUID(), exerciseId: expectedExerciseId, type, payload, ...(aircraftId ? { aircraftId } : {}) };
    try {
        // One retry retains the same identifier. A lost acknowledgement never duplicates the clearance.
        let result;
        try {
            result = await request('/api/procedural/command', cmd);
        }
        catch (e) {
            if (e instanceof TypeError || e instanceof DOMException) {
                if (stamp !== generation || session !== auth)
                    throw e;
                result = await request('/api/procedural/command', cmd);
            }
            else
                throw e;
        }
        if (stamp !== generation || session !== auth)
            throw new Error('Session changed; reopen the instruction.');
        try {
            await refresh(stamp, true);
        }
        catch {
            if (stamp === generation) {
                text('connection', 'RECONNECTING');
                $('scope-wrap').classList.add('stale');
                message('Instruction accepted. Reconnecting to the exercise.');
            }
        }
        if (stamp !== generation)
            throw new Error('Session changed.');
        return result;
    }
    finally {
        if (stamp === generation) {
            commandBusy = false;
            pendingClock = '';
            renderClockControls();
        }
    }
}
function safe(action) {
    return async () => {
        try {
            await action();
        }
        catch (e) {
            message(e.message, true);
        }
    };
}
function bindForm(id, action) {
    $(id).addEventListener('submit', e => {
        e.preventDefault();
        const button = $(id).querySelector('button[type=submit],button:not([type])');
        if (button)
            button.disabled = true;
        void safe(action)().finally(() => {
            if (button)
                button.disabled = false;
        });
    });
}
function getDraft() { return { estimate: val('strip-form', 'estimate'), clearance: val('strip-form', 'clearance'), notes: val('strip-form', 'notes') }; }
function storeDraft() {
    if (selected) {
        drafts.set(selected, getDraft());
        try {
            sessionStorage.setItem('reds-procedural-drafts', JSON.stringify([...drafts]));
            sessionStorage.setItem('reds-procedural-draft-exercise', view?.exerciseId || '');
        }
        catch { }
    }
}
function loadStrip() {
    const s = drafts.get(selected) || view?.strips?.[selected] || { estimate: '', clearance: '', notes: '' };
    for (const k of ['estimate', 'clearance', 'notes'])
        field('strip-form', k).value = s[k] || '';
    text('strip-status', drafts.has(selected) ? 'Unsaved draft' : 'Saved working record');
}
function choose(id) { storeDraftIfDirty(); if (selected !== id) { gestures.reset(); $('quick-heading').value = ''; } selected = id; loadStrip(); renderSelection(); renderFleet(); draw(); }
function storeDraftIfDirty() {
    if (selected && drafts.has(selected))
        storeDraft();
}
function tab(name, open = true) {
    document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    document.querySelectorAll('.tab-content').forEach(p => p.hidden = p.id !== `tab-${name}`);
    text('drawer-title', { strip: 'Flight strips', pilot: 'Aircraft controls', build: 'Airspace workshop', airspace: 'Chart briefing', approach: '3° approach reference', separation: 'Separation', debrief: 'Exercise review', session: 'Session', layers: session?.role === 'student' ? 'Instructor-set chart layers' : 'Declutter scope' }[name] || name);
    $('work-panel').hidden = !open;
    document.body.classList.toggle('drawer-open', open);
    if (open) {
        drawerReturn = document.activeElement;
        $('drawer-close').focus({ preventScroll: true });
    }
}
function closeDrawer() { $('work-panel').hidden = true; document.body.classList.remove('drawer-open'); drawerReturn?.focus(); }
function setStage(next) {
    stage = next;
    for (const id of ['entry', 'setup', 'waiting', 'desk'])
        $(id).hidden = id !== next;
    document.body.classList.toggle('desk-open', next === 'desk');
    document.body.classList.toggle('setup-open', next === 'setup');
    document.body.classList.toggle('exercise-running', next === 'desk' && !!view?.running);
    document.body.classList.toggle('instructor-desk', session?.role === 'instructor');
    document.body.classList.toggle('student-desk', session?.role === 'student');
    arrangeControls();
    if (next !== 'desk')
        document.body.classList.remove('drawer-open');
    $('back-flow').hidden = !session || next === 'entry';
    $('return-desk').hidden = !session || next !== 'entry';
}
function leave() {
    gestures.reset();
    ++generation;
    commandBusy = false;
    pendingClock = '';
    clearTimeout(pollTimer);
    session = null;
    view = null;
    selected = '';
    signatures.clear();
    trailHistory.clear();
    drafts.clear();
    lastElapsed = -1;
    clearAudio();
    mapGeneration++;
    mapLoading = '';
    mapId = '';
    mapImage = null;
    if (mapURL)
        URL.revokeObjectURL(mapURL);
    mapURL = '';
    room = null;
    conditionAircraft = '';
    trafficSetup.close();
    $('work-panel').hidden = true;
    sessionStorage.removeItem(key);
    setStage('entry');
    $('signout').hidden = true;
    for (const id of ['fleet', 'events', 'alerts', 'calls', 'reports', 'criteria', 'truth-readout'])
        $(id).replaceChildren();
    draw();
}
function enter(s, startPolling = true) {
    session = s;
    generation++;
    layerSaving = false;
    commandBusy = false;
    pendingClock = '';
    signatures.clear();
    view = null;
    selected = '';
    settingsLoaded = false;
    environmentDirty.clear();
    sessionStorage.setItem(key, JSON.stringify(s));
    room = null;
    conditionAircraft = '';
    setStage(s.role === 'instructor' ? 'desk' : 'waiting');
    $('signout').hidden = false;
    const instructor = s.role === 'instructor';
    $('session-mode').value = s.cloud ? 'online' : 'local';
    $('open-student').href = `procedural.html?position=student${s.cloud ? '&connection=online' : ''}`;
    $('open-student').rel = 'noopener';
    $('open-student').previousElementSibling.textContent = s.cloud
        ? 'On the other device, open Procedural, choose Online room and enter this PIN. Admit the controller here, then ask them to press Ready. Keep this instructor tab open.'
        : 'Open the controller in a new browser tab. Use an extended display: move the student tab to the second monitor, then select full screen.';
    document.querySelectorAll('[data-tab="layers"]').forEach(el => { el.textContent = instructor ? 'Declutter' : 'Chart layers'; });
    text('layer-heading-title', instructor ? 'Show what you need.' : 'Instructor-set chart layers');
    text('edge-pin', instructor ? '······' : '');
    text('role', instructor ? 'INSTRUCTOR / PSEUDO-PILOT' : 'STUDENT / PROCEDURAL CONTROLLER');
    text('scope-title', instructor ? 'INSTRUCTOR TRUTH · CONTINUOUS TRAFFIC' : 'PROCEDURAL PICTURE · D/F ONLY');
    text('scope-caption', instructor ? 'Click aircraft: transmit · double left/right click: turn · drag: pan · Ctrl + scroll: zoom' : 'Drag or scroll to pan · Ctrl + scroll to zoom · transmission bearings only');
    $('clock-controls').hidden = !instructor;
    $('scope-manual-dock').hidden = !instructor;
    $('scope-flight-controls').hidden = !instructor;
    $('student-instrument-note').hidden = instructor;
    for (const name of ['pilot', 'build', 'debrief']) {
        document.querySelectorAll(`[data-tab="${name}"]`).forEach(el => el.hidden = !instructor);
    }
    $('traffic-setup').hidden = !instructor;
    $('instructor-room').hidden = !instructor;
    document.querySelectorAll('[data-instructor-tool]').forEach(el => el.hidden = !instructor);
    $('criterion-form').hidden = !instructor;
    $('alert-controls').hidden = !instructor;
    $('scope-options').hidden = false;
    tab(instructor ? 'pilot' : 'strip', false);
    if (startPolling)
        void poll(generation);
}
async function openSession(role, resumeRoom = false) {
    if (role === 'instructor' && session?.role === role) {
        await showTrafficSetup();
        return;
    }
    if (loginBusy)
        return;
    loginBusy = true;
    const stamp = ++generation;
    commandBusy = false;
    pendingClock = '';
    document.querySelectorAll('#entry button').forEach(b => b.disabled = true);
    try {
        const connection = $('session-mode').value;
        const payload = role === 'instructor' ? { role, resumeRoom, connection } : { role, connection, pin: $('student-pin').value.trim(), name: $('student-name').value.trim() };
        const s = await request('/api/procedural/session', payload);
        if (stamp === generation) {
            enter(s, false);
            const current = generation;
            try {
                await refresh(current);
                if (current === generation && role === 'instructor' && !resumeRoom)
                    await showTrafficSetup();
            }
            finally {
                if (current === generation)
                    void poll(current);
            }
        }
    }
    catch (error) {
        // Back keeps the current desk. A failed replacement login must keep that desk connected.
        if (stamp === generation && session) {
            clearTimeout(pollTimer);
            void poll(stamp);
        }
        throw error;
    }
    finally {
        loginBusy = false;
        document.querySelectorAll('#entry button').forEach(b => b.disabled = false);
    }
}
let refreshPending = null;
async function refresh(stamp, afterCommand = false) {
    if (!session || stamp !== generation)
        return;
    const pending = refreshPending;
    if (pending?.stamp === stamp) {
        if (!afterCommand)
            return pending.promise;
        try {
            await pending.promise;
        }
        catch { /* The command acknowledgement still needs a fresh view. */ }
    }
    if (!session || stamp !== generation)
        return;
    const job = { stamp, promise: refreshState(stamp) };
    refreshPending = job;
    try {
        await job.promise;
    }
    finally {
        if (refreshPending === job)
            refreshPending = null;
    }
}
async function refreshState(stamp) {
    if (!session)
        return;
    const nextRoom = await request('/api/procedural/room');
    if (stamp !== generation || !session)
        return;
    room = nextRoom;
    renderRoom();
    if (session.role === 'student' && room?.status !== 'ready') {
        view = null;
        clearAudio();
        setStage('waiting');
        draw();
        return;
    }
    const next = await request('/api/procedural/state');
    if (stamp !== generation)
        return;
    view = next;
    receivedAt = performance.now();
    text('connection', next.available ? 'LIVE CONNECTION' : 'HOST UNAVAILABLE');
    $('scope-wrap').classList.toggle('stale', !next.available);
    render();
    if (session?.role === 'student' && stage === 'waiting')
        setStage('desk');
}
async function poll(stamp) {
    if (stamp !== generation || !session)
        return;
    try {
        await refresh(stamp);
    }
    catch (e) {
        if (stamp === generation) {
            text('connection', 'RECONNECTING');
            $('scope-wrap').classList.add('stale');
            clearAudio();
        }
    }
    finally {
        if (stamp === generation && session)
            pollTimer = window.setTimeout(() => void poll(stamp), 250);
    }
}
function changeList(id, items, renderItems) {
    const signature = JSON.stringify(items);
    if (signatures.get(id) === signature)
        return;
    signatures.set(id, signature);
    $(id).replaceChildren(...renderItems());
}
function record(title, body, meta = '', warning = false) {
    const e = make('article', undefined, `record${warning ? ' warning' : ''}`);
    e.append(make('strong', title), make('div', body));
    if (meta)
        e.append(make('small', meta));
    return e;
}
function empty(value) { return make('p', value, 'empty'); }
function actionButton(label, action) { const b = make('button', label); b.type = 'button'; b.onclick = safe(action); return b; }
function renderRoom() {
    if (!room || !session)
        return;
    if (session.role === 'instructor') {
        const students = room.students || [];
        const waiting = students.filter((s) => s.status === 'waiting').length;
        text('session-pin', room.pin);
        text('edge-pin', `${room.pin}${waiting ? ` · ${waiting} waiting` : ''}`);
        changeList('room-students', students, () => students.length ? students.map((s) => {
            const item = record(s.name, s.status.toUpperCase());
            if (s.status === 'waiting')
                item.append(actionButton('Admit', () => roomAction('admit', s.id)));
            if (s.status !== 'rejected')
                item.append(actionButton(s.status === 'waiting' ? 'Decline' : 'Remove controller', () => roomAction('reject', s.id)));
            return item;
        }) : [empty('Share the PIN. Join requests appear here.')]);
    }
    else {
        text('join-title', room.status === 'admitted' ? 'You are admitted' : room.status === 'rejected' ? 'This join request has ended' : 'Waiting for the instructor');
        text('join-status', room.status === 'admitted' ? 'Press Ready to open your controller scope.' : room.status === 'rejected' ? 'Return to entry and request the current session PIN.' : 'Your request has been sent. The instructor will admit you.');
        $('student-ready').hidden = room.status !== 'admitted';
        text('student-room-status', `${room.name || session.name || 'Controller'} · ${room.status}`);
    }
    renderClockControls();
}
let pendingClock = '';
function renderClockControls() {
    const instructor = session?.role === 'instructor', ended = !!view?.terminated, running = !!view?.running;
    const waiting = room?.students?.filter((s) => s.status === 'admitted').length || 0;
    const unavailable = !view?.available, busy = commandBusy;
    $('resume').disabled = unavailable || busy || ended || running || waiting > 0;
    $('pause').disabled = unavailable || busy || ended || !running;
    $('step').disabled = unavailable || busy || ended || running;
    for (const id of ['terminate', 'terminate-quick']) {
        $(id).disabled = !instructor || unavailable || busy || ended;
        $(id).setAttribute('aria-pressed', String(ended || $('terminate-confirm').open));
        $(id).classList.toggle('is-terminated', ended);
        $(id).textContent = ended ? '■ Exercise terminated' : '■ Terminate exercise';
    }
    for (const id of ['reopen-exercise', 'review-reopen']) {
        $(id).hidden = !instructor || !ended;
        $(id).disabled = unavailable || busy;
    }
    text('resume', pendingClock === 'resume' ? 'Starting…' : '▶ Run');
    text('pause', pendingClock === 'pause' ? 'Pausing…' : 'Ⅱ Pause');
    $('clock-controls').setAttribute('aria-busy', String(!!pendingClock));
    const blocked = !running && waiting > 0 && instructor;
    $('exercise-notice').hidden = !ended && !blocked;
    const notice = $('exercise-notice'), studentEnd = ended && !instructor;
    if (studentEnd && !notice.classList.contains('student-termination')) { closeDrawer(); clearAudio(); }
    notice.classList.toggle('student-termination', studentEnd);
    notice.setAttribute('role', studentEnd ? 'alert' : 'status');
    const noticeText = ended ? (instructor ? 'Exercise terminated. Reopen to continue with the same traffic.' : 'EXERCISE TERMINATED · The instructor has ended this exercise. Await further instructions.') : `${waiting} controller${waiting === 1 ? '' : 's'} must press Ready before Run. Manage the session to remove an absent controller.`;
    if ($('exercise-notice-text').textContent !== noticeText) text('exercise-notice-text', noticeText);
    if (ended) gestures.reset();
    $('notice-session').hidden = ended || !blocked;
    $('notice-review').hidden = !ended || !instructor;
    $('resume').title = ended ? 'Reopen the ended exercise first' : waiting ? 'Waiting for admitted controllers to press Ready' : running ? 'Exercise is already running' : 'Start traffic';
    $('pause').title = ended ? 'Exercise has ended' : running ? 'Freeze traffic and the exercise clock' : 'Exercise is already paused';
}
async function roomAction(action, studentId) {
    const stamp = generation;
    await request('/api/procedural/room', { action, ...(studentId ? { studentId } : {}) });
    if (stamp === generation)
        await refresh(stamp);
}
async function startExercise() {
    if (room?.students?.some((s) => s.status === 'admitted'))
        throw new Error('Wait for the admitted controller to press Ready.');
    return command('clock', { action: 'resume' });
}
async function showTrafficSetup() {
    if (session?.role !== 'instructor')
        return;
    const stamp = generation;
    if (view?.running)
        await command('clock', { action: 'pause' });
    if (stamp !== generation)
        return;
    closeDrawer();
    setStage('setup');
    trafficSetup.open();
}
let layerSaving = false;
const areaKindNames = { prohibited: 'P · Prohibited', restricted: 'R · Restricted', danger: 'D · Danger', 'local-flying': 'LFA · Local flying area', 'control-zone': 'CTR · Control zone' };
function layerItems(group) {
    const fixes = new Map(view?.fixes.map(f => [f.id, f.name]) || []);
    const rows = group === 'route' ? view?.routes || [] : view?.areas || [];
    return rows.map(r => ({
        id: r.id, name: r.name, kind: r.kind,
        detail: group === 'route' ? `${r.kind === 'conditional' ? 'Conditional' : 'ATS'} · ${('fixIds' in r ? r.fixIds : []).map(id => fixes.get(id) || id).join(' → ')}` : `${areaKindNames[r.kind] || r.kind} · ${r.floorLabel || 'GND'}–${r.ceilingLabel || 'Limit not set'}`
    })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
function matchingLayers(group) {
    const query = $(`${group}-search`).value.trim().toLowerCase();
    const kind = $(`${group}-kind`).value;
    const terms = query.split(/\s+/).filter(Boolean);
    return layerItems(group).filter(r => (!kind || r.kind === kind || (group === 'area' && kind === 'local-flying' && /\bLFA\b/i.test(r.name))) && terms.every(term => `${r.name} ${r.detail}`.toLowerCase().includes(term)));
}
async function saveScopeDisplay(patch) {
    if (session?.role !== 'instructor' || layerSaving)
        return;
    const stamp = generation;
    layerSaving = true;
    renderLayerLists();
    try {
        await command('scope-display', patch);
    }
    finally {
        if (stamp === generation) {
            layerSaving = false;
            renderLayerLists();
            draw();
        }
    }
}
async function selectLayers(group, action) {
    if (!view || session?.role !== 'instructor')
        return;
    const matches = new Set(matchingLayers(group).map(r => r.id));
    if (!matches.size)
        return;
    const hidden = new Set(group === 'route' ? hiddenRoutes : hiddenAreas);
    for (const r of layerItems(group)) {
        if (matches.has(r.id))
            action === 'hide' ? hidden.add(r.id) : hidden.delete(r.id);
        else if (action === 'only')
            hidden.add(r.id);
    }
    await saveScopeDisplay({ [group === 'route' ? 'hiddenRouteIds' : 'hiddenAreaIds']: [...hidden], ...(action !== 'hide' ? { [`${group === 'route' ? 'routes' : 'areas'}Hidden`]: false } : {}) });
}
function renderLayerLists() {
    if (!view)
        return;
    const shared = view.scopeDisplay;
    hiddenRoutes.clear();
    (shared?.hiddenRouteIds || []).forEach(id => hiddenRoutes.add(id));
    hiddenAreas.clear();
    (shared?.hiddenAreaIds || []).forEach(id => hiddenAreas.add(id));
    display.routes = !shared?.routesHidden;
    display.areas = !shared?.areasHidden;
    const readonly = session?.role !== 'instructor';
    text('layer-sync-status', layerSaving ? 'Updating both consoles…' : readonly ? 'Chart selection follows the instructor.' : 'Selections update both consoles.');
    document.querySelectorAll('[data-layer="routes"],[data-layer="areas"]').forEach(c => {
        c.checked = display[c.dataset.layer];
        c.disabled = readonly || layerSaving;
    });
    for (const group of ['route', 'area']) {
        const id = `${group}-layer-controls`, rows = layerItems(group), matches = matchingLayers(group);
        const hidden = group === 'route' ? hiddenRoutes : hiddenAreas;
        const enabled = display[group === 'route' ? 'routes' : 'areas'];
        const selectedCount = rows.filter(r => !hidden.has(r.id)).length;
        const filtered = !!($(`${group}-search`).value.trim() || $(`${group}-kind`).value);
        text(`${group}-count`, enabled ? `${selectedCount} of ${rows.length} shown${filtered ? ` · ${matches.length} match` : ''}` : `Layer off · ${selectedCount} of ${rows.length} selected`);
        for (const action of ['show', 'hide', 'only']) {
            const button = $(`${group}-${action}`);
            button.hidden = readonly;
            button.disabled = layerSaving || !matches.length || (action === 'only' && !filtered);
            if (action !== 'only')
                button.textContent = `${action === 'show' ? 'Show' : 'Hide'} ${filtered ? 'matches' : 'all'}`;
        }
        // Polling and checkbox changes must not replace focused controls or reset list scroll.
        changeList(id, matches, () => matches.length ? matches.map(r => {
            const label = make('label', undefined, `check layer-item layer-item--${group}`), input = document.createElement('input');
            input.type = 'checkbox';
            input.dataset.chartItem = r.id;
            input.setAttribute('aria-label', `${r.name} · ${r.detail}`);
            input.onchange = safe(async () => {
                const next = new Set(group === 'route' ? hiddenRoutes : hiddenAreas), checked = input.checked;
                checked ? next.delete(r.id) : next.add(r.id);
                await saveScopeDisplay({ [group === 'route' ? 'hiddenRouteIds' : 'hiddenAreaIds']: [...next], ...(checked ? { [`${group === 'route' ? 'routes' : 'areas'}Hidden`]: false } : {}) });
            });
            const caption = make('span');
            caption.append(make('strong', r.name), make('small', r.detail));
            label.append(input, caption);
            return label;
        }) : [empty(rows.length ? 'No matches. Change the search or type filter.' : 'No chart items loaded.')]);
        $(id).querySelectorAll('input[data-chart-item]').forEach(c => { c.checked = !hidden.has(c.dataset.chartItem); c.disabled = readonly || layerSaving; });
    }
}
function aircraftName(id) { return view?.roster.find(a => a.id === id)?.callsign || id; }
function renderFleet() {
    if (!view)
        return;
    changeList('fleet', [view.roster, selected], () => view.roster.map(a => { const b = make('button', undefined, a.id === selected ? 'selected' : ''); b.setAttribute('aria-pressed', String(a.id === selected)); b.append(make('b', a.callsign), make('small', `${a.type} · ${a.status}`)); b.onclick = () => choose(a.id); return b; }));
}
function options(selector, rows) {
    const signature = JSON.stringify(rows);
    document.querySelectorAll(selector).forEach(s => {
        const saved = s.value;
        if (s.dataset.options === signature)
            return;
        s.dataset.options = signature;
        const result = [];
        if (s.dataset.empty) {
            const o = new Option(s.dataset.empty, '');
            result.push(o);
        }
        rows.forEach(r => result.push(new Option(r.name, r.id)));
        s.replaceChildren(...result);
        if (result.some(o => o.value === saved))
            s.value = saved;
    });
}
function renderSelection() {
    if (!view)
        return;
    const row = view.roster.find(a => a.id === selected);
    text('strip-callsign', row?.callsign || 'Select aircraft');
    text('scope-selected', row?.callsign || 'Select aircraft');
    text('scope-station-name', `${view.environment.stationName || 'NAV0'} · ${(view.environment.stationType || 'df').toUpperCase()}`);
    text('pilot-callsign', row ? `${row.callsign} · pilot` : 'Aircraft controls');
    text('strip-route', row ? `${row.type} · ${view.routes.find(r => r.id === row.routeId)?.name || 'Direct / heading assigned'}` : '');
    const a = view.aircraft?.find(a => a.id === selected);
    $('aircraft-quick-controls').hidden = session?.role !== 'instructor' || !a || a.status === 'scheduled';
    text('quick-aircraft-info', a ? `${a.callsign} · ${pad(a.headingDeg)}°T · ${Math.round(a.altitudeFt)} FT · ${Math.round(a.speedKt)} KT` : '');
    $('aircraft-quick-controls').querySelectorAll('button').forEach(b => b.disabled = !a || !!view.terminated || commandBusy);
    $('quick-heading-form').querySelectorAll('input,button').forEach(el => el.disabled = !a || !!a.compassUnserviceable || !!view.terminated || commandBusy);
    $('quick-heading').title = a?.compassUnserviceable ? 'Heading assignments unavailable with an unserviceable compass; use Left now / Right now.' : 'Target true heading, 000 to 360 degrees';
    text('scope-selected-truth', a ? `${pad(a.headingDeg)}°T · ${Math.round(a.speedKt)} KT · ${Math.round(a.altitudeFt)} FT MSL${a.compassUnserviceable ? ' · COMPASS U/S' : ''}` : '');
    document.querySelectorAll('#scope-manual-dock button,#scope-flight-controls button,#clearance-form button,#transmit-form button').forEach(b => b.disabled = !a || !!view?.terminated);
    document.querySelectorAll('#scope-heading-form button,#heading-report').forEach(b => b.disabled = !a || !!a.compassUnserviceable || !!view?.terminated);
    text('turn-left', a?.compassUnserviceable ? 'LEFT NOW' : 'TURN LEFT');
    text('turn-right', a?.compassUnserviceable ? 'RIGHT NOW' : 'TURN RIGHT');
    if (a) {
        const identity = `${view.exerciseId}:${a.id}`;
        if (conditionAircraft !== identity) {
            conditionAircraft = identity;
            conditionDirty.clear();
        }
        if (!conditionDirty.has('compassUnserviceable'))
            field('aircraft-condition', 'compassUnserviceable').checked = !!a.compassUnserviceable;
        if (!conditionDirty.has('turnRateDegSec'))
            field('aircraft-condition', 'turnRateDegSec').value = String(a.turnRateDegSec || 3);
        if (!conditionDirty.has('verticalRateFpm'))
            field('aircraft-condition', 'verticalRateFpm').value = String(a.verticalRateFpm || 1000);
    }
    if (a)
        text('truth-readout', `HDG ${pad(a.headingDeg)}°T   ${a.speedKt.toFixed(0)} KT\nALT ${Math.round(a.altitudeFt).toLocaleString()} → ${Math.round(a.targetAltitudeFt).toLocaleString()} FT MSL\nQTE ${pad(Math.atan2(a.xNm - (view.environment.stationXNm || 0), a.yNm - (view.environment.stationYNm || 0)) * 180 / Math.PI)}°  RANGE ${Math.hypot(a.xNm - (view.environment.stationXNm || 0), a.yNm - (view.environment.stationYNm || 0)).toFixed(1)} NM\n${a.mode.toUpperCase()} · ${a.status}${a.pendingClearances?.length ? ' · CONDITION ARMED' : ''}`);
    else
        text('truth-readout', '');
    for (const id of ['strip-form', 'call-form', 'clearance-form', 'transmit-form'])
        $(id).querySelectorAll('button').forEach(b => b.disabled = !row);
}
function render() {
    if (!view)
        return;
    const v = view;
    if (sessionStorage.getItem('reds-procedural-draft-exercise') !== v.exerciseId) {
        drafts.clear();
        sessionStorage.removeItem('reds-procedural-drafts');
        sessionStorage.setItem('reds-procedural-draft-exercise', v.exerciseId);
        for (const formId of ['route-form', 'criterion-form', 'clearance-form', 'transmit-form']) {
            const f = $(formId);
            f.reset();
            delete f.dataset.editId;
            delete f.dataset.exerciseId;
        }
        clearanceFields();
        trailHistory.clear();
        lastElapsed = -1;
        selected = '';
        conditionAircraft = '';
        conditionDirty.clear();
        dfSettingsDirty.clear();
        environmentDirty.clear();
        settingsLoaded = false;
        hiddenAreas.clear();
        hiddenRoutes.clear();
        signatures.delete('area-layer-controls');
        signatures.delete('route-layer-controls');
    }
    v.roster = v.roster || [];
    v.routes = v.routes || [];
    v.fixes = v.fixes || [];
    text('exercise-title', v.title);
    text('clock', clock(v.elapsed));
    text('clock-state', v.terminated ? 'ENDED' : v.running ? 'RUNNING' : 'PAUSED');
    $('clock-state').classList.toggle('live', v.running);
    document.body.classList.toggle('exercise-running', v.running);
    text('mode-label', 'PROCEDURAL STUDIO');
    renderApproachReference();
    text('fleet-count', `${v.roster.length} / 24`);
    renderClockControls();
    const nextChart = JSON.stringify([v.environment.aerodromeName, v.environment.chartOrigin]);
    if (nextChart !== chartIdentity) {
        chartIdentity = nextChart;
        settingsLoaded = false;
        environmentDirty.clear();
        pan = { x: 0, y: 0 };
        display.routes = true;
        hiddenRoutes.clear();
        document.querySelectorAll('[data-layer="routes"]').forEach(c => c.checked = true);
    }
    if (!settingsLoaded) {
        settingsLoaded = true;
        range = v.environment.rangeNm;
        syncRange();
        for (const k of ['widthNm', 'originXPct', 'originYPct', 'rotationDeg', 'opacity'])
            field('map-form', k).value = String(v.environment.map[k]);
        field('preset-form', 'mode').value = v.mode;
    }
    syncEnvironmentInputs();
    if (!v.roster.some(a => a.id === selected)) {
        selected = v.roster[0]?.id || '';
        loadStrip();
    }
    renderFleet();
    renderSelection();
    options('.fix-select', v.fixes);
    options('.route-select', v.routes.map(r => ({ id: r.id, name: r.name })));
    options('.aircraft-select', v.roster.map(a => ({ id: a.id, name: a.callsign })));
    const rs = (v.reports || []).filter(r => !selected || r.aircraftId === selected).slice(-40).reverse();
    changeList('reports', rs, () => rs.length ? rs.map(r => record(r.callsign, r.text, `${clock(r.elapsed)} · ${r.source || 'PILOT REPORT'}`)) : [empty('No delivered report for this aircraft.')]);
    const calls = (v.calls || []).slice(-40).reverse();
    changeList('calls', calls, () => calls.length ? calls.map(c => {
        const e = record(`${aircraftName(c.aircraftId)} · ${c.status}`, c.text, clock(c.elapsed));
        if (c.status === 'pending')
            e.append(actionButton('Select & handle', async () => { choose(c.aircraftId); tab('pilot'); }), actionButton('Mark handled', () => command('call-handled', { id: c.id })));
        return e;
    }) : [empty('No controller calls awaiting the pilot.')]);
    changeList('route-list', [v.routes, v.fixes, v.routes.map(r => routeWindowOpen(r, v.elapsed))], () => v.routes.map(r => {
        const e = record(r.name, `${r.kind.toUpperCase()} · ${r.fixIds.map((id) => v.fixes.find(f => f.id === id)?.name || id).join(' → ')}`, `${routeWindowOpen(r, v.elapsed) ? 'WINDOW OPEN' : 'UNAVAILABLE'} · ${r.kind === 'conditional' ? `elapsed ${r.availableFrom}–${r.availableUntil || 'unlimited'} sec · ` : ''}${r.minAltitudeFt}–${r.maxAltitudeFt} ft`);
        e.append(actionButton(r.active ? 'Close' : 'Open', () => command('route-upsert', { ...r, active: !r.active })), actionButton('Edit', async () => {
            for (const k of ['name', 'kind', 'availableFrom', 'availableUntil', 'minAltitudeFt', 'maxAltitudeFt', 'source', 'reference', 'levelLimits', 'effectiveInfo'])
                field('route-form', k).value = String(r[k] ?? '');
            field('route-form', 'fixNames').value = r.fixIds.map((id) => v.fixes.find(f => f.id === id)?.name || id).join(', ');
            field('route-form', 'active').checked = r.active;
            $('route-form').dataset.editId = r.id;
            $('route-form').dataset.exerciseId = v.exerciseId;
        }), actionButton('Delete', async () => {
            if (confirm(`Delete route ${r.name}?`))
                await command('route-delete', { id: r.id });
        }));
        return e;
    }));
    const criteria = v.criteria || [];
    changeList('criteria', criteria, () => criteria.length ? criteria.map(c => {
        const e = record(`${aircraftName(c.aircraftA)} / ${aircraftName(c.aircraftB)} · ${c.kind}`, `${c.minimum} ${c.unit} · ${c.assessment}\n${c.reference}\n${c.applicability}\nEvidence: ${c.evidence}`, c.notes);
        if (session?.role === 'instructor')
            e.append(actionButton('Edit assessment', async () => {
                for (const k of ['kind', 'aircraftA', 'aircraftB', 'minimum', 'unit', 'reference', 'applicability', 'evidence', 'assessment', 'notes', 'expiresAt'])
                    field('criterion-form', k).value = String(c[k] ?? '');
                $('criterion-form').dataset.editId = c.id;
                $('criterion-form').dataset.exerciseId = v.exerciseId;
            }), actionButton('Remove', () => command('criterion-delete', { id: c.id })));
        return e;
    }) : [empty('The instructor can define separation objectives for this exercise.')]);
    const alerts = v.alerts || [];
    changeList('alerts', alerts, () => alerts.length ? alerts.map(a => record(a.kind, a.text, 'Instructor measurement cue', true)) : [empty('No configured proximity cue is currently triggered.')]);
    const events = (v.events || []).slice(-120).reverse();
    changeList('events', events, () => events.map(e => record(e.kind, e.text, clock(e.elapsed))));
    if (v.elapsed < lastElapsed) {
        trailHistory.clear();
        ruler = [];
    }
    if (v.elapsed !== lastElapsed && v.aircraft) {
        for (const a of v.aircraft) {
            if (a.status === 'scheduled')
                continue;
            const trail = trailHistory.get(a.id) || [];
            trailHistory.set(a.id, recordTrail(trail, { x: a.xNm, y: a.yNm, t: v.elapsed }));
        }
    }
    lastElapsed = v.elapsed;
    const trainingReference = v.environment.magneticVariationKnown === false;
    text('mag-reference-note', trainingReference ? `TRAINING REF ${v.environment.trainingMagneticVariationDeg ?? 0}°E` : `MAG REF ${v.environment.magneticVariationDeg || 0}°E`);
    if (!dfSettingsDirty.has('dfHoldSeconds'))
        field('df-settings', 'dfHoldSeconds').value = String(v.environment.dfHoldSeconds || 2);
    if (!dfSettingsDirty.has('trainingMagneticVariationDeg'))
        field('df-settings', 'trainingMagneticVariationDeg').value = String(v.environment.trainingMagneticVariationDeg ?? 0);
    text('fleet-station', `${v.environment.stationName || 'NAV0'} · reference station`);
    text('reference-note', `True north map · MSL altitude · ${v.environment.magneticVariationKnown === false ? 'magnetic reference not set' : `training variation ${v.environment.magneticVariationDeg}°E`}`);
    void updateMap(v.environment.map?.imageId || '');
    chartWorkshop.render();
    mapWorkshop.render();
    renderLayerLists();
    renderRadio();
    draw();
}
function currentDF() {
    if (!view?.df)
        return null;
    const age = performance.now() - receivedAt;
    return age > view.df.remainingMs ? null : view.df;
}
function renderRadio() {
    if (!view)
        return;
    const r = view.radio || {};
    const valid = (performance.now() - receivedAt) < (Number(r.remainingMs) || 0);
    const phase = valid ? r.phase : 'idle';
    text('radio-state', (phase || 'idle').toUpperCase());
    text('radio-caption', r.text || 'Awaiting an aircraft transmission.');
    if (phase === 'transmitting' && r.id && r.id !== lastAudio) {
        lastAudio = r.id;
        if ($('audio-enable').checked)
            speak(String(r.text), Math.max(1, Number(r.remainingMs) / 1000));
    }
    if (phase !== 'transmitting' && window.speechSynthesis?.speaking)
        window.speechSynthesis.cancel();
}
function localVoice() { return window.speechSynthesis?.getVoices().find(v => v.localService && /^en[-_]/i.test(v.lang)); }
function speak(caption, duration = 6) {
    if (document.hidden || !('speechSynthesis' in window))
        return;
    window.speechSynthesis.cancel();
    const voice = localVoice();
    if (!voice) {
        text('audio-status', 'No installed English voice is available. Pilot captions remain active.');
        return;
    }
    const utterance = new SpeechSynthesisUtterance(caption);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = Math.min(1.5, Math.max(.85, caption.split(/\s+/).length / (duration * 2.6)));
    utterance.onerror = () => text('audio-status', 'Audio unavailable; pilot captions and D/F continue.');
    window.speechSynthesis.speak(utterance);
    text('audio-status', `Installed voice · ${voice.name}`);
}
async function updateMap(id) {
    if ((!mapLoading && mapId === id && (!id || mapImage)) || (id && mapLoading === id))
        return;
    const stamp = ++mapGeneration;
    mapLoading = id;
    mapImage = null;
    if (!id) {
        mapId = '';
        mapLoading = '';
        if (mapURL)
            URL.revokeObjectURL(mapURL);
        mapURL = '';
        text('map-state', 'No map overlay.');
        draw();
        return;
    }
    const auth = session;
    if (!auth)
        return;
    try {
        const res = await fetch(`/api/procedural/map/${id}`, { headers: { Authorization: `Bearer ${auth.token}` } });
        if (!res.ok)
            throw new Error('Map image could not be loaded.');
        const blob = await res.blob();
        if (stamp !== mapGeneration || auth !== session)
            return;
        const url = URL.createObjectURL(blob), img = new Image();
        img.src = url;
        await img.decode();
        if (stamp !== mapGeneration || auth !== session) {
            URL.revokeObjectURL(url);
            return;
        }
        if (mapURL)
            URL.revokeObjectURL(mapURL);
        mapURL = url;
        mapImage = img;
        mapId = id;
        mapLoading = '';
        text('map-state', `Local map loaded · ${img.naturalWidth} × ${img.naturalHeight}`);
        draw();
    }
    catch (e) {
        if (stamp === mapGeneration) {
            mapLoading = '';
            text('map-state', e.message);
        }
    }
}
const canvas = $('scope'), ctx = canvas.getContext('2d');
function geometry() { const width = canvas.clientWidth || 600, height = canvas.clientHeight || 500; return { width, height, scale: Math.min(width, height) / (range * 2.3), cx: width / 2 + pan.x, cy: height / 2 + pan.y }; }
const sweep = createRadarSweep($('scope-plot'), () => ({ visible: stage === 'desk' && !!view, enabled: display.sweep, running: !!view?.running, rpm: display.sweepRpm, range, exerciseId: view?.exerciseId, xNm: view?.environment.stationXNm, yNm: view?.environment.stationYNm }), geometry);
function draw() {
    sweep.update();
    $('approach-marks').setAttribute('aria-pressed', String(display.approach));
    text('approach-marks', display.approach ? 'Hide approach marks' : 'Show approach marks');
    const g = geometry(), ratio = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(g.width * ratio) || canvas.height !== Math.round(g.height * ratio)) {
        canvas.width = Math.round(g.width * ratio);
        canvas.height = Math.round(g.height * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#111416';
    ctx.fillRect(0, 0, g.width, g.height);
    if (!view) {
        drawHoming(null);
        return;
    }
    const p = (x, y) => [g.cx + x * g.scale, g.cy - y * g.scale];
    const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    const env = view.environment;
    const [stationX, stationY] = p(env.stationXNm || 0, env.stationYNm || 0);
    if (showMap && mapImage) {
        const m = env.map, w = m.widthNm * g.scale, h = w * mapImage.naturalHeight / mapImage.naturalWidth;
        ctx.save();
        ctx.translate(g.cx, g.cy);
        ctx.rotate(m.rotationDeg * Math.PI / 180);
        ctx.globalAlpha = m.opacity;
        ctx.drawImage(mapImage, -w * m.originXPct / 100, -h * m.originYPct / 100, w, h);
        ctx.restore();
    }
    ctx.font = '12px PlexMono,monospace';
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#363c40';
    ctx.fillStyle = '#8c969e';
    if (display.rings) {
        for (let i = 1; i <= 4; i++) {
            const rad = range * g.scale * i / 4;
            ctx.beginPath();
            ctx.arc(stationX, stationY, rad, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillText(`${range * i / 4} NM`, stationX + 6, stationY - rad + 12);
        }
        ctx.strokeStyle = '#252a2e';
        line(stationX, 0, stationX, g.height);
        line(0, stationY, g.width, stationY);
        for (let a = 0; a < 360; a += 10) {
            const rad = a * Math.PI / 180, r = range * g.scale;
            ctx.strokeStyle = '#50585e';
            line(stationX + Math.sin(rad) * r, stationY - Math.cos(rad) * r, stationX + Math.sin(rad) * (r - (a % 30 === 0 ? 9 : 4)), stationY - Math.cos(rad) * (r - (a % 30 === 0 ? 9 : 4)));
            if (a % 30 === 0) {
                ctx.fillStyle = '#8c969e';
                ctx.textAlign = 'center';
                ctx.fillText(pad(a), stationX + Math.sin(rad) * (r + 14), stationY - Math.cos(rad) * (r + 14) + 3);
            }
        }
        ctx.textAlign = 'left';
    }
    if (display.areas)
        drawAreas(ctx, (view.areas || []).filter(a => !hiddenAreas.has(a.id)), p, display.areaLabels ? (range > 100 ? 'name' : 'full') : false);
    const stationLabel = (env.stationName || 'NAV0').split(' ')[0];
    const navigationLabels = [{ x: stationX + 5, y: stationY - 22, width: ctx.measureText(stationLabel).width + 8, height: 18 }];
    if (display.routes) {
        const labelledRoutes = new Set();
        const fixesById = new Map(view.fixes.map(f => [f.id, f]));
        const routeFixIds = new Set(view.routes.flatMap(r => r.fixIds));
        const shownFixes = new Set();
        const label = (text, x, y, color) => {
            const box = reserveLabel({ x, y }, ctx.measureText(text).width, g.width, g.height, navigationLabels);
            if (!box)
                return false;
            ctx.fillStyle = '#111416';
            ctx.fillRect(box.x, box.y, box.width, box.height);
            ctx.fillStyle = color;
            ctx.fillText(text, box.x + 4, box.y + 12);
            return true;
        };
        for (const route of view.routes) {
            if (hiddenRoutes.has(route.id))
                continue;
            ctx.save();
            const open = routeWindowOpen(route, view.elapsed);
            ctx.strokeStyle = open ? '#568a67' : '#555e59';
            ctx.setLineDash(!open ? [2, 7] : route.kind === 'conditional' ? [7, 6] : []);
            ctx.lineWidth = 1;
            const fixes = route.fixIds.map((id) => fixesById.get(id)).filter(Boolean);
            fixes.forEach(f => shownFixes.add(f.id));
            ctx.beginPath();
            fixes.forEach((f, i) => {
                const [x, y] = p(f.xNm, f.yNm);
                if (i === 0)
                    ctx.moveTo(x, y);
                else
                    ctx.lineTo(x, y);
            });
            ctx.stroke();
            if (display.routeLabels && fixes.length > 1) {
                const name = route.id.startsWith('aip-') ? route.name.split(' ')[0] : route.name;
                if (!labelledRoutes.has(name)) {
                    const segments = fixes.slice(1).map((f, i) => {
                        const [ax, ay] = p(fixes[i].xNm, fixes[i].yNm), [bx, by] = p(f.xNm, f.yNm);
                        return visibleSegment({ x: ax, y: ay }, { x: bx, y: by }, g.width, g.height);
                    }).filter((s) => !!s).sort((a, b) => Math.hypot(b[1].x - b[0].x, b[1].y - b[0].y) - Math.hypot(a[1].x - a[0].x, a[1].y - a[0].y));
                    for (const segment of segments) {
                        if (Math.hypot(segment[1].x - segment[0].x, segment[1].y - segment[0].y) < 42)
                            continue;
                        if (label(name, (segment[0].x + segment[1].x) / 2, (segment[0].y + segment[1].y) / 2, open ? '#a5c4ac' : '#8e9691')) {
                            labelledRoutes.add(name);
                            break;
                        }
                    }
                }
            }
            ctx.restore();
        }
        for (const f of view.fixes) {
            if ((f.id.startsWith('aip-') || routeFixIds.has(f.id)) && !shownFixes.has(f.id))
                continue;
            const [x, y] = p(f.xNm, f.yNm);
            if (x < -5 || y < -5 || x > g.width + 5 || y > g.height + 5)
                continue;
            ctx.strokeStyle = '#80b4bd';
            ctx.beginPath();
            ctx.moveTo(x, y - 4);
            ctx.lineTo(x + 4, y + 3);
            ctx.lineTo(x - 4, y + 3);
            ctx.closePath();
            ctx.stroke();
            if (display.fixLabels && range <= 60)
                label(f.name, x, y, '#a9c5ca');
        }
    }
    if (display.runway) {
        const rad = env.runwayHeadingDeg * Math.PI / 180, dx = Math.sin(rad) * env.runwayLengthNm / 2, dy = Math.cos(rad) * env.runwayLengthNm / 2;
        const [a, b] = p(-dx, -dy), [c, d] = p(dx, dy);
        ctx.strokeStyle = '#ddc88f';
        ctx.lineWidth = 4;
        line(a, b, c, d);
        ctx.lineWidth = 1;
        ctx.save();
        ctx.setLineDash([4, 5]);
        const [e, f] = p(-Math.sin(rad) * 12, -Math.cos(rad) * 12);
        line(a, b, e, f);
        ctx.restore();
    }
    if (display.approach)
        drawApproachReference(p, g.scale, navigationLabels);
    ctx.fillStyle = '#bce0b9';
    ctx.beginPath();
    ctx.arc(stationX, stationY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(stationLabel, stationX + 8, stationY - 8);
    if (session?.role === 'instructor') {
        const labels = [];
        for (const a of view.aircraft || []) {
            if (a.status === 'scheduled')
                continue;
            const [x, y] = p(a.xNm, a.yNm), active = a.id === selected, color = active ? '#ffd66e' : '#7ee8fa';
            if (display.trails) {
                const dots = trailDots(trailHistory.get(a.id) || [], { x: a.xNm, y: a.yNm, t: view.elapsed }, Math.max(.2, 7 / g.scale));
                dots.forEach((dot, i) => {
                    const [tx, ty] = p(dot.x, dot.y);
                    ctx.fillStyle = color;
                    ctx.globalAlpha = .8 - i * .12;
                    ctx.beginPath();
                    ctx.arc(tx, ty, 2, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.globalAlpha = 1;
            }
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = active ? 1.8 : 1.2;
            ctx.beginPath();
            ctx.rect(x - 3, y - 3, 6, 6);
            ctx.stroke();
            if (active) {
                ctx.beginPath();
                ctx.arc(x, y, 9, 0, Math.PI * 2);
                ctx.stroke();
            }
            const rad = a.headingDeg * Math.PI / 180;
            if (display.vectors) {
                const length = Math.max(12, a.speedKt / 60 * g.scale);
                line(x, y, x + Math.sin(rad) * length, y - Math.cos(rad) * length);
            }
            if (display.labels)
                labels.push({ a, x, y, active, color });
        }
        drawTrafficLabels(labels, g.width, g.height);
    }
    const df = currentDF();
    if (df?.valid && df.qteDeg != null) {
        const rad = df.qteDeg * Math.PI / 180;
        ctx.strokeStyle = df.phase === 'hold' ? '#b88c40' : '#f7ca72';
        ctx.lineWidth = 2;
        line(stationX, stationY, stationX + Math.sin(rad) * Math.max(g.width, g.height) * 3, stationY - Math.cos(rad) * Math.max(g.width, g.height) * 3);
        text('station-radial', `${env.stationName || 'NAV0'} ${env.stationType === 'vor' ? 'RADIAL' : 'BEARING'} ${pad(df.qdmDeg == null ? df.qteDeg : df.qdmDeg + 180)}°${df.qdmDeg == null ? 'T' : 'M'}${df.magneticReference === 'training' ? ' TRAINING' : ''} · ${df.phase.toUpperCase()}`);
    }
    if (ruler.length) {
        ctx.strokeStyle = '#e4d6a0';
        ctx.fillStyle = '#e4d6a0';
        const [a, b] = p(ruler[0].x, ruler[0].y);
        ctx.beginPath();
        ctx.arc(a, b, 4, 0, Math.PI * 2);
        ctx.stroke();
        if (ruler.length === 2) {
            const [c, d] = p(ruler[1].x, ruler[1].y), dx = ruler[1].x - ruler[0].x, dy = ruler[1].y - ruler[0].y;
            ctx.setLineDash([4, 4]);
            line(a, b, c, d);
            ctx.setLineDash([]);
            ctx.fillText(`${pad(Math.atan2(dx, dy) * 180 / Math.PI)}°T / ${Math.hypot(dx, dy).toFixed(1)} NM`, (a + c) / 2 + 8, (b + d) / 2 - 8);
        }
    }
    if (!df?.valid)
        text('station-radial', 'No transmission');
    drawHoming(df);
}
function approachPoints() {
    if (!view)
        return [];
    const heading = view.environment.runwayHeadingDeg * Math.PI / 180, halfRunway = view.environment.runwayLengthNm / 2;
    return Array.from({ length: 11 }, (_, nm) => ({ nm, xNm: -Math.sin(heading) * (halfRunway + nm), yNm: -Math.cos(heading) * (halfRunway + nm) }));
}
function drawApproachReference(p, scale, occupied) {
    if (!view)
        return;
    const env = view.environment, heading = env.runwayHeadingDeg * Math.PI / 180, points = approachPoints();
    ctx.save();
    ctx.strokeStyle = '#c0cbd3';
    ctx.fillStyle = '#d7e2e8';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    points.forEach((point, i) => { const [x, y] = p(point.xNm, point.yNm); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.setLineDash([]);
    for (const point of points) {
        const [x, y] = p(point.xNm, point.yNm), width = canvas.clientWidth, height = canvas.clientHeight;
        if (x < 0 || y < 0 || x > width || y > height)
            continue;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(heading) * 5, y - Math.sin(heading) * 5);
        ctx.lineTo(x + Math.cos(heading) * 5, y + Math.sin(heading) * 5);
        ctx.stroke();
        if (point.nm && scale < 25 && point.nm % 2)
            continue;
        const reference = approachReference(point.nm, env.aerodromeElevationFt, env.thresholdCrossingHeightFt || 0);
        const caption = point.nm ? `${point.nm} NM / ${Math.round(reference.altitudeFt / 10) * 10} FT` : 'THR';
        const box = reserveLabel({ x, y }, ctx.measureText(caption).width, width, height, occupied);
        if (box) {
            ctx.fillStyle = '#111416';
            ctx.fillRect(box.x, box.y, box.width, box.height);
            ctx.fillStyle = '#d7e2e8';
            ctx.fillText(caption, box.x + 4, box.y + 12);
        }
    }
    ctx.restore();
}
function renderApproachReference() {
    if (!view)
        return;
    const env = view.environment, tl = env.transitionLevel ? `FL ${String(Math.round(env.transitionLevel)).padStart(3, '0')}` : '—', ta = env.transitionAltitudeFt ? `${env.transitionAltitudeFt} FT` : '—';
    text('operational-reference', `QNH ${env.qnhHpa} hPa · TL ${tl} · TA ${ta}`);
    const signature = JSON.stringify([env.qnhHpa, env.transitionLevel, env.transitionAltitudeFt, env.aerodromeElevationFt, env.thresholdCrossingHeightFt, env.runwayHeadingDeg]);
    if (signatures.get('approach-reference') === signature)
        return;
    signatures.set('approach-reference', signature);
    text('approach-reference-settings', `QNH ${env.qnhHpa} hPa · elevation ${env.aerodromeElevationFt} FT · threshold crossing height ${env.thresholdCrossingHeightFt || 0} FT\nTL ${tl} · TA ${ta} · inbound ${pad(env.runwayHeadingDeg)}°T`);
    $('approach-reference-rows').replaceChildren(...Array.from({ length: 11 }, (_, i) => {
        const nm = 10 - i, values = approachReference(nm, env.aerodromeElevationFt, env.thresholdCrossingHeightFt || 0), row = document.createElement('tr');
        for (const value of [nm === 0 ? 'THR' : `${nm} NM`, `${Math.round(values.altitudeFt / 10) * 10}`, `${Math.round(values.heightFt / 10) * 10}`])
            row.append(make('td', value));
        return row;
    }));
}
function drawTrafficLabels(labels, width, height) {
    const occupied = [];
    const scopeBounds = canvas.getBoundingClientRect(), homingBounds = $('homing').getBoundingClientRect();
    occupied.push({ x: homingBounds.left - scopeBounds.left, y: homingBounds.top - scopeBounds.top, width: homingBounds.width, height: homingBounds.height });
    for (const { a, x, y, active, color } of labels.sort((a, b) => Number(b.active) - Number(a.active))) {
        if (x < 0 || y < 0 || x > width || y > height)
            continue;
        const lines = [a.callsign];
        if (active)
            lines.push(Math.round(a.altitudeFt) + ' FT  ' + Math.round(a.speedKt) + ' KT', pad(a.headingDeg) + '°T ' + a.mode.toUpperCase());
        const w = Math.max(...lines.map(t => ctx.measureText(t).width)) + 10, h = lines.length * 15 + 5;
        let box;
        for (const dy of [-18, 25, -55, 60, -92, 98])
            for (const dx of [14, -w - 14, 45, -w - 45]) {
                if (box)
                    break;
                const candidate = { x: x + dx, y: y + dy, width: w, height: h };
                if (candidate.x < 5 || candidate.y < 5 || candidate.x + w > width - 5 || candidate.y + h > height - 5)
                    continue;
                if (!occupied.some(o => candidate.x < o.x + o.width + 4 && candidate.x + w + 4 > o.x && candidate.y < o.y + o.height + 4 && candidate.y + h + 4 > o.y))
                    box = candidate;
            }
        if (!box)
            box = { x: Math.max(5, Math.min(width - w - 5, x + 14)), y: Math.max(5, Math.min(height - h - 5, y - 18)), width: w, height: h };
        occupied.push(box);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = .7;
        ctx.globalAlpha = .6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(box.x + (box.x < x ? w : 0), box.y + h / 2);
        ctx.stroke();
        ctx.globalAlpha = .9;
        ctx.fillStyle = '#171c20';
        ctx.fillRect(box.x, box.y, w, h);
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        lines.forEach((t, i) => ctx.fillText(t, box.x + 5, box.y + 13 + i * 15));
        ctx.restore();
    }
}
function drawHoming(df) {
    const c = $('homing-dial'), d = c.getContext('2d'), w = c.width, h = c.height, cx = w / 2, cy = h / 2 + 8, r = 52;
    d.clearRect(0, 0, w, h);
    d.strokeStyle = '#345846';
    d.fillStyle = '#84a17c';
    d.lineWidth = 1;
    d.font = '8px PlexMono,monospace';
    for (let deg = 0; deg < 360; deg += 10) {
        const a = deg * Math.PI / 180;
        d.beginPath();
        d.moveTo(cx + Math.sin(a) * r, cy - Math.cos(a) * r);
        d.lineTo(cx + Math.sin(a) * (r - (deg % 30 ? 3 : 7)), cy - Math.cos(a) * (r - (deg % 30 ? 3 : 7)));
        d.stroke();
    }
    d.textAlign = 'center';
    d.fillText('N', cx, cy - r - 4);
    d.fillText('E', cx + r + 8, cy + 3);
    d.fillText('W', cx - r - 8, cy + 3);
    const mode = $('bearing-type').value;
    const value = df ? (mode === 'qdm' ? df.qdmDeg : df.qteDeg) : null;
    if (df && df.magneticVariationDeg != null)
        text('mag-reference-note', `${df.magneticReference === 'training' ? 'TRAINING' : 'MAG'} REF ${df.magneticVariationDeg}°E${df.phase === 'hold' ? ' · HELD' : ''}`);
    if (df?.valid && value != null) {
        const a = value * Math.PI / 180;
        d.strokeStyle = '#d1e9ab';
        d.lineWidth = 2;
        d.beginPath();
        d.moveTo(cx - Math.sin(a) * r * .8, cy + Math.cos(a) * r * .8);
        d.lineTo(cx + Math.sin(a) * r * .8, cy - Math.cos(a) * r * .8);
        d.stroke();
        text('bearing', pad(value));
        text('df-source', `${df.callsign} · ${df.phase.toUpperCase()}`);
    }
    else {
        text('bearing', '–––');
        text('df-source', df?.valid && mode === 'qdm' ? 'MAG REF NOT SET' : df ? 'NO VALID BEARING' : 'NO TRANSMISSION');
    }
}
// Scope tools change only the local display, never the exercise state.
const toolsPanel = make('div', undefined, 'scope-options');
toolsPanel.id = 'scope-options';
const toolsBody = make('div', undefined, 'scope-options-body');
for (const [id, label] of Object.entries({ areas: 'Airspace boundaries', areaLabels: 'Boundary names & limits', rings: 'Range rings', routes: 'Routes & fixes', routeLabels: 'Route names · spaced', fixLabels: 'Fix names · local zoom', labels: 'Aircraft callsigns', trails: 'Truth trails', vectors: '1-minute vectors', runway: 'Runway / final', approach: '3° approach marks · NM / altitude' })) {
    const l = make('label', undefined, 'check');
    if (['labels', 'trails', 'vectors'].includes(id))
        l.dataset.instructorTool = '';
    const c = document.createElement('input');
    c.type = 'checkbox';
    c.dataset.layer = id;
    c.checked = display[id];
    c.addEventListener('change', safe(async () => {
        if (id === 'routes' || id === 'areas')
            await saveScopeDisplay({ [`${id}Hidden`]: !c.checked });
        else {
            display[id] = c.checked;
            draw();
        }
    }));
    l.append(c, document.createTextNode(label));
    toolsBody.append(l);
}
const fitTraffic = actionButton('Fit all traffic', async () => {
    if (!view?.aircraft)
        return;
    range = Math.max(10, Math.ceil(Math.max(...view.aircraft.map(a => Math.hypot(a.xNm, a.yNm)), 10) / 10) * 10);
    pan = { x: 0, y: 0 };
    syncRange();
    draw();
});
fitTraffic.dataset.instructorTool = '';
const rulerButton = actionButton('Bearing / range ruler', async () => { display.ruler = !display.ruler; ruler = []; message(display.ruler ? 'Click two scope points to measure.' : 'Ruler off.'); draw(); });
toolsBody.append(fitTraffic, rulerButton);
const sweepRow = make('label', undefined, 'check');
const sweepToggle = document.createElement('input'); sweepToggle.type = 'checkbox'; sweepToggle.checked = display.sweep;
sweepToggle.id = 'sweep-enabled'; sweepRow.append(sweepToggle, document.createTextNode('360° radar sweep'));
const rpmLabel = make('label', 'Sweep speed · RPM');
const rpmInput = document.createElement('input'); rpmInput.id = 'sweep-rpm'; rpmInput.type = 'number'; rpmInput.min = '1'; rpmInput.max = '60'; rpmInput.step = '1'; rpmInput.value = '12';
rpmLabel.append(rpmInput);
sweepToggle.onchange = () => { display.sweep = sweepToggle.checked; sweep.update(); };
rpmInput.onchange = () => { if (rpmInput.value && rpmInput.reportValidity()) { display.sweepRpm = Number(rpmInput.value); sweep.update(); } };
toolsBody.append(sweepRow, rpmLabel, make('small', 'One revolution = 60 ÷ RPM seconds. Display sweep only.'));
toolsPanel.append(toolsBody);
$('layer-controls').append(toolsPanel);
for (const group of ['route', 'area']) {
    $(`${group}-search`).addEventListener('input', renderLayerLists);
    $(`${group}-kind`).addEventListener('change', renderLayerLists);
    for (const action of ['show', 'hide', 'only'])
        $(`${group}-${action}`).onclick = safe(() => selectLayers(group, action));
}
const trafficBar = make('div', undefined, 'scope-traffic-bar');
trafficBar.id = 'scope-traffic-bar';
trafficBar.append($('fleet-count'), $('fleet'));
document.querySelector('.scope-toolbar').after(trafficBar);
function syncRange() {
    const s = $('range');
    const ranges = [...new Set([5, 10, 20, 40, 60, 100, 200, 500, 1000, 2000, range])].sort((a, b) => a - b);
    s.replaceChildren(...ranges.map(r => new Option(`${r} NM`, String(r))));
    s.value = String(range);
}
function position(e) { const b = canvas.getBoundingClientRect(), g = geometry(); return { x: (e.clientX - b.left - g.cx) / g.scale, y: -(e.clientY - b.top - g.cy) / g.scale }; }
const gestures = createAircraftGestures({onTransmit: id => { void safe(() => transmitAircraft(id))(); }});
function hitAircraft(e) {
    return session?.role === 'instructor' && !display.ruler
        ? nearestAircraft(view?.aircraft, position(e), geometry().scale, e.pointerType === 'touch' ? 30 : 24) : null;
}
function hideAircraftHover() { $('aircraft-hover').hidden = true; }
async function immediateTurn(action, id = selected) {
    if (session?.role !== 'instructor' || !id || view?.terminated) return;
    gestures.reset();
    return command('clearance', { action }, id);
}
async function transmitAircraft(id = selected) {
    if (session?.role !== 'instructor' || stage !== 'desk' || !id || id !== selected || view?.terminated || !view?.aircraft?.some(a => a.id === id && a.status !== 'scheduled')) return;
    return command('transmit', { mode: 'df', durationSeconds: 8 }, id);
}
async function quickHeadingTurn(direction) {
    const a = view?.aircraft?.find(a => a.id === selected), input = $('quick-heading');
    if (session?.role !== 'instructor' || !a || a.compassUnserviceable || view?.terminated) return;
    if (!input.value.trim() || !Number.isInteger(Number(input.value)) || Number(input.value) < 0 || Number(input.value) > 360) {
        input.reportValidity(); message('Enter a whole heading from 000 to 360, then choose Turn left or Turn right.', true); return;
    }
    gestures.reset();
    return command('clearance', { action: 'heading', direction, value: norm(Number(input.value)) }, a.id);
}
canvas.addEventListener('contextmenu', e => { if (session?.role === 'instructor') e.preventDefault(); });
canvas.addEventListener('pointerdown', e => {
    if (!session || !e.isPrimary || ![0, 2].includes(e.button)) return;
    if (e.button === 2 && session.role !== 'instructor') return;
    e.preventDefault(); hideAircraftHover();
    canvas.focus({ preventScroll: true }); canvas.setPointerCapture(e.pointerId);
    pointer = { id: e.pointerId, button: e.button, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, dragging: false };
});
canvas.addEventListener('pointermove', e => {
    if (!pointer) {
        const a = e.pointerType === 'mouse' ? hitAircraft(e) : null;
        const tooltip = $('aircraft-hover'); tooltip.hidden = !a;
        canvas.style.cursor = a ? 'pointer' : 'grab';
        if (a) {
            tooltip.textContent = `${a.callsign} · ${a.type}\n${pad(a.headingDeg)}°T · ${Math.round(a.altitudeFt)} FT MSL · ${Math.round(a.speedKt)} KT\n${a.mode} · ${a.status}`;
            const bounds = canvas.getBoundingClientRect();
            tooltip.style.left = `${Math.max(4, Math.min(e.clientX - bounds.left + 14, bounds.width - tooltip.offsetWidth - 6))}px`;
            tooltip.style.top = `${Math.max(4, Math.min(e.clientY - bounds.top + 16, bounds.height - tooltip.offsetHeight - 6))}px`;
        }
        return;
    }
    if (pointer.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) > 5) { pointer.dragging = true; gestures.reset(); }
    if (pointer.dragging && pointer.button === 0) {
        pan = { x: pointer.panX + e.clientX - pointer.startX, y: pointer.panY + e.clientY - pointer.startY }; draw();
    }
});
canvas.addEventListener('pointerup', e => {
    if (!pointer || pointer.id !== e.pointerId || !view) return;
    const pressed = pointer; pointer = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (pressed.dragging) return;
    const p = position(e);
    if (display.ruler) {
        gestures.reset();
        if (pressed.button !== 0) return;
        if (ruler.length === 2) ruler = [];
        ruler.push(p); draw(); return;
    }
    if (session?.role !== 'instructor') return;
    const a = hitAircraft(e);
    if (a) {
        choose(a.id);
        const direction = gestures.press({ id: a.id, button: pressed.button, pointerType: e.pointerType, time: e.timeStamp, x: e.clientX, y: e.clientY });
        if (direction) void safe(() => immediateTurn(direction, a.id))();
    } else {
        gestures.reset();
        if (pressed.button !== 0) return;
        field('fix-form', 'xNm').value = p.x.toFixed(2); field('fix-form', 'yNm').value = p.y.toFixed(2);
    }
});
canvas.addEventListener('pointerleave', hideAircraftHover);
for (const event of ['pointercancel', 'lostpointercapture'])
    canvas.addEventListener(event, () => { if (pointer) gestures.reset(); pointer = null; hideAircraftHover(); });
for (const direction of ['left', 'right']) $('quick-' + direction).onclick = safe(() => immediateTurn(direction));
$('quick-stop').onclick = safe(() => immediateTurn('stop-turn'));
$('quick-transmit').onclick = safe(() => { gestures.reset(); return transmitAircraft(); });
$('quick-more').onclick = () => tab('pilot');
for (const direction of ['left', 'right']) $('quick-heading-' + direction).onclick = safe(() => quickHeadingTurn(direction));
$('quick-heading-form').onsubmit = e => { e.preventDefault(); $('quick-heading-left').focus(); };
function zoomScope(factor, clientX, clientY) {
    const before = geometry(), bounds = canvas.getBoundingClientRect();
    const x = clientX == null ? before.width / 2 : clientX - bounds.left, y = clientY == null ? before.height / 2 : clientY - bounds.top;
    const worldX = (x - before.cx) / before.scale, worldY = (y - before.cy) / before.scale;
    range = Math.max(5, Math.min(2000, Math.round(range * factor)));
    const after = geometry();
    pan = { x: x - after.width / 2 - worldX * after.scale, y: y - after.height / 2 - worldY * after.scale };
    syncRange();
    draw();
}
canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey)
        zoomScope(e.deltaY > 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY);
    else {
        const units = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
        pan.x -= (e.shiftKey ? e.deltaY : e.deltaX) * units;
        pan.y -= (e.shiftKey ? 0 : e.deltaY) * units;
        draw();
    }
}, { passive: false });
$('zoom-in').onclick = () => zoomScope(1 / 1.2);
$('zoom-out').onclick = () => zoomScope(1.2);
document.querySelectorAll('[data-pan]').forEach(button => button.onclick = () => {
    const direction = button.dataset.pan;
    pan.x += direction === 'left' ? -70 : direction === 'right' ? 70 : 0;
    pan.y += direction === 'up' ? -70 : direction === 'down' ? 70 : 0;
    draw();
});
$('toggle-controls').onclick = () => {
    const collapsed = document.body.classList.toggle('controls-collapsed');
    $('toggle-controls').setAttribute('aria-pressed', String(collapsed));
    text('toggle-controls', collapsed ? 'Show controls' : 'Hide controls');
    closeDrawer();
    draw();
};
new ResizeObserver(() => draw()).observe($('scope-wrap'));
new ResizeObserver(() => draw()).observe($('scope-plot'));
$('range').addEventListener('change', () => { range = Number($('range').value); draw(); });
$('corner').onclick = () => { $('homing').classList.toggle('right'); $('instrument-dock').classList.toggle('right'); document.querySelector('.scope-panel').classList.toggle('homing-right'); };
$('map-toggle').onclick = () => { showMap = !showMap; $('map-toggle').setAttribute('aria-pressed', String(showMap)); draw(); };
$('bearing-type').onchange = () => draw();
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => tab(b.dataset.tab));
bindForm('student-join', () => openSession('student'));
bindForm('instructor-login', () => openSession('instructor'));
$('resume-local-exercise').onclick = safe(() => openSession('instructor', true));
$('signout').onclick = leave;
$('resume').onclick = safe(startExercise);
$('pause').onclick = safe(() => command('clock', { action: 'pause' }));
$('step').onclick = safe(() => command('clock', { action: 'step', seconds: 60 }));
const quickControls = make('div', undefined, 'quick-controls');
async function turnSelected(direction) {
    const a = view?.aircraft?.find(a => a.id === selected);
    if (!a?.compassUnserviceable && !$('scope-heading-form').reportValidity())
        return;
    return command('clearance', a?.compassUnserviceable ? { action: direction } : { action: 'heading', direction, value: num('scope-heading-form', 'value') }, selected);
}
for (const direction of ['left', 'right']) {
    const button = actionButton(`TURN ${direction.toUpperCase()}`, () => turnSelected(direction));
    button.id = `turn-${direction}`;
    quickControls.append(button);
}
const stopTurn = actionButton('STOP TURN', () => command('clearance', { action: 'stop-turn' }, selected));
stopTurn.id = 'stop-turn';
quickControls.append(stopTurn);
quickControls.append(actionButton('Continue heading', () => command('clearance', { action: 'continue' }, selected)));
const transmitDF = actionButton('TRANSMIT D/F · T', () => command('transmit', { mode: 'df', durationSeconds: 8 }, selected));
transmitDF.id = 'transmit-df';
quickControls.prepend(transmitDF);
for (const direction of ['left', 'right']) {
    const button = actionButton(`ORBIT ${direction.toUpperCase()}`, () => command('clearance', { action: `orbit-${direction}` }, selected));
    button.id = `orbit-${direction}`;
    quickControls.append(button);
}
const resumeOrbit = actionButton('LEAVE ORBIT / HOLD', () => command('clearance', { action: 'resume' }, selected));
resumeOrbit.id = 'resume-flight';
quickControls.append(resumeOrbit);
const headingReport = actionButton('Heading report · H', () => command('transmit', { mode: 'heading', durationSeconds: 6 }, selected));
headingReport.id = 'heading-report';
quickControls.append(headingReport, actionButton('Position report · P', () => command('transmit', { mode: 'position', durationSeconds: 6 }, selected)));
$('scope-manual-dock').append(quickControls);
quickControls.append(actionButton('Release transmission', () => command('interrupt')));
// Keep one set of controls and their bindings, with a scrollable home on smaller displays.
const compactControls = window.matchMedia('(max-height: 740px), (max-width: 1000px)');
const instrumentHome = document.createComment('student instrument dock');
$('instrument-dock').before(instrumentHome);
const controlHomes = ['manual', 'flight'].map(kind => {
    const control = $(kind === 'manual' ? 'scope-manual-dock' : 'scope-flight-controls');
    const home = document.createComment(`${kind} controls`);
    control.before(home);
    return { control, home, slot: $(`compact-${kind}-slot`) };
});
function arrangeControls() {
    const instructor = session?.role === 'instructor';
    if (instructor) $('instructor-control-shelf').append($('instrument-dock'));
    else instrumentHome.after($('instrument-dock'));
    document.body.classList.toggle('compact-controls', compactControls.matches);
    for (const { control, home, slot } of controlHomes) {
        if (compactControls.matches || instructor)
            slot.append(control);
        else
            home.after(control);
    }
    draw();
}
compactControls.addEventListener('change', arrangeControls);
arrangeControls();
bindForm('scope-heading-form', () => command('clearance', { action: 'heading', value: num('scope-heading-form', 'value'), direction: val('scope-heading-form', 'direction') }, selected));
bindForm('scope-speed-form', () => command('clearance', { action: 'speed', value: num('scope-speed-form', 'value') }, selected));
bindForm('scope-level-form', () => command('clearance', { action: 'altitude', value: num('scope-level-form', 'value'), reference: val('scope-level-form', 'reference') }, selected));
for (const action of ['climb', 'descend'])
    $(`${action}-to`).onclick = safe(async () => {
        if (!$('scope-level-form').reportValidity())
            return;
        await command('clearance', { action, value: num('scope-level-form', 'value'), reference: val('scope-level-form', 'reference') }, selected);
    });
$('df-settings').addEventListener('input', e => dfSettingsDirty.add(e.target.name));
bindForm('df-settings', async () => {
    const stamp = generation, exercise = view?.exerciseId, payload = {};
    for (const name of dfSettingsDirty)
        payload[name] = num('df-settings', name);
    if (!Object.keys(payload).length)
        return;
    await command('environment', payload);
    if (stamp !== generation || view?.exerciseId !== exercise)
        return;
    for (const [name, value] of Object.entries(payload))
        if (num('df-settings', name) === value)
            dfSettingsDirty.delete(name);
    message('Bearing hold and training reference saved.');
});
$('strip-form').addEventListener('input', () => { stripRevision++; storeDraft(); text('strip-status', 'Unsaved draft'); });
bindForm('strip-form', async () => {
    const id = selected, rev = stripRevision, payload = getDraft();
    await command('strip', payload, id);
    if (selected === id && stripRevision === rev) {
        drafts.delete(id);
        text('strip-status', 'Saved');
        sessionStorage.setItem('reds-procedural-drafts', JSON.stringify([...drafts]));
    }
    message('Strip saved.');
});
bindForm('call-form', async () => {
    const input = val('call-form', 'text');
    await command('controller-call', { text: input }, selected);
    if (val('call-form', 'text') === input)
        field('call-form', 'text').value = '';
    message('Controller call delivered to instructor.');
});
bindForm('clearance-form', async () => {
    const action = val('clearance-form', 'action'), payload = { action };
    if (['heading', 'altitude', 'speed'].includes(action))
        payload.value = num('clearance-form', 'value');
    if (action === 'altitude')
        payload.reference = val('clearance-form', 'reference');
    if (['heading', 'hold'].includes(action))
        payload.direction = val('clearance-form', 'direction');
    if (['direct', 'hold'].includes(action))
        payload.fixId = val('clearance-form', 'fixId');
    if (action === 'route')
        payload.routeId = val('clearance-form', 'routeId');
    if (action === 'hold') {
        payload.inboundCourseDeg = num('clearance-form', 'inboundCourseDeg');
        payload.legSeconds = num('clearance-form', 'legSeconds');
    }
    const kind = val('clearance-form', 'conditionKind');
    if (kind)
        payload.condition = kind === 'time' ? { kind, at: num('clearance-form', 'conditionAt') } : { kind, fixId: val('clearance-form', 'conditionFixId') };
    await command('clearance', payload, selected);
    message(kind ? 'Conditional clearance armed.' : 'Clearance applied; pilot readback transmitting.');
});
bindForm('transmit-form', () => {
    const mode = val('transmit-form', 'mode');
    return command('transmit', { ...(mode === 'custom' ? { text: val('transmit-form', 'text') } : { mode }), durationSeconds: num('transmit-form', 'durationSeconds') }, selected);
});
$('aircraft-condition').addEventListener('input', e => conditionDirty.add(e.target.name));
bindForm('aircraft-condition', async () => {
    const identity = conditionAircraft;
    const payload = {};
    for (const name of conditionDirty)
        payload[name] = name === 'compassUnserviceable' ? field('aircraft-condition', name).checked : num('aircraft-condition', name);
    if (!Object.keys(payload).length)
        return;
    await command('aircraft-condition', payload, selected);
    if (identity === conditionAircraft) {
        for (const [name, value] of Object.entries(payload)) {
            const current = name === 'compassUnserviceable' ? field('aircraft-condition', name).checked : num('aircraft-condition', name);
            if (current === value)
                conditionDirty.delete(name);
        }
        renderSelection();
    }
});
$('interrupt').onclick = safe(() => command('interrupt'));
bindForm('preset-form', async () => {
    if (!confirm('Replace the current exercise? Download it first if you want to keep this attempt.'))
        return;
    await command('preset', { mode: val('preset-form', 'mode') });
    drafts.clear();
    sessionStorage.removeItem('reds-procedural-drafts');
    trailHistory.clear();
    selected = '';
    settingsLoaded = false;
    signatures.clear();
    pan = { x: 0, y: 0 };
    render();
    message('Training exercise loaded, paused.');
});
bindForm('aircraft-form', async () => {
    const p = {};
    for (const k of ['callsign', 'type', 'routeId', 'wakeCategory'])
        p[k] = val('aircraft-form', k);
    for (const k of ['qteDeg', 'rangeNm', 'headingDeg', 'speedKt', 'altitudeFt', 'turnRateDegSec', 'verticalRateFpm'])
        p[k] = num('aircraft-form', k);
    p.spawnTime = (view?.elapsed || 0) + num('aircraft-form', 'spawnDelay');
    await command('aircraft-add', p);
    message('Aircraft added.');
});
bindForm('generate-form', async () => {
    if (!view)
        return;
    const count = num('generate-form', 'count'), interval = num('generate-form', 'interval');
    if (count < 1 || count > 24 || !Number.isInteger(count))
        throw new Error('Choose 1–24 aircraft.');
    if (view.roster.length + count > 24)
        throw new Error(`Only ${24 - view.roster.length} aircraft places remain.`);
    const route = view.routes.find(r => r.id === val('generate-form', 'routeId'));
    if (!route)
        throw new Error('Choose a route first.');
    const fix = view.fixes.find(f => f.id === route.fixIds[0]);
    if (!fix)
        throw new Error('Route start is missing.');
    const start = view.elapsed, exerciseId = view.exerciseId;
    for (let i = 0; i < count; i++) {
        await command('aircraft-add', { type: val('aircraft-form', 'type') || 'TRAINER', xNm: fix.xNm, yNm: fix.yNm, headingDeg: num('aircraft-form', 'headingDeg'), speedKt: num('aircraft-form', 'speedKt'), altitudeFt: num('aircraft-form', 'altitudeFt'), routeId: route.id, spawnTime: start + i * interval }, undefined, exerciseId);
    }
    message(`${count} aircraft generated.`);
});
$('remove-aircraft').onclick = safe(async () => {
    if (selected && confirm(`Remove ${aircraftName(selected)}?`))
        await command('aircraft-remove', { id: selected });
});
bindForm('fix-form', async () => { const name = val('fix-form', 'name').toUpperCase(), matches = view?.fixes.filter(f => f.name.toUpperCase() === name) || []; if (matches.length > 1)
    throw new Error(`Several retained fixes use ${name}. Use a new, unique fix name.`); const existing = matches[0]; await command('fix-upsert', { ...(existing ? { id: existing.id } : {}), name, xNm: num('fix-form', 'xNm'), yNm: num('fix-form', 'yNm') }); message('Reporting fix saved.'); });
bindForm('route-form', async () => {
    const names = val('route-form', 'fixNames').split(/[\s,>→]+/).map(n => n.trim().toUpperCase()).filter(Boolean);
    const original = view?.routes.find(r => r.id === $('route-form').dataset.editId);
    const fixIds = resolveRouteFixIds(names, view?.fixes || [], original);
    const p = { name: val('route-form', 'name'), kind: val('route-form', 'kind'), fixIds, active: field('route-form', 'active').checked };
    for (const k of ['source', 'reference', 'levelLimits', 'effectiveInfo'])
        p[k] = val('route-form', k);
    for (const k of ['availableFrom', 'availableUntil', 'minAltitudeFt', 'maxAltitudeFt'])
        p[k] = num('route-form', k);
    if ($('route-form').dataset.editId)
        p.id = $('route-form').dataset.editId;
    await command('route-upsert', p, undefined, $('route-form').dataset.exerciseId || view?.exerciseId);
    delete $('route-form').dataset.editId;
    delete $('route-form').dataset.exerciseId;
    message('Route saved.');
});
for (const form of ['environment-form', 'threshold-form']) {
    $(form).addEventListener('input', event => {
        const input = event.target;
        if (input.name)
            environmentDirty.add(input.name);
    });
    bindForm(form, async () => {
        const payload = {}, snapshot = new Map();
        $(form).querySelectorAll('input[name]').forEach(input => {
            if (environmentDirty.has(input.name)) {
                payload[input.name] = Number(input.value);
                snapshot.set(input.name, input.value);
            }
        });
        if (!snapshot.size) {
            message('No settings changed.');
            return;
        }
        const exerciseId = view?.exerciseId, stamp = generation;
        await command('environment', payload, undefined, exerciseId);
        if (stamp !== generation || exerciseId !== view?.exerciseId)
            return;
        const confirmed = [...snapshot].every(([name, value]) => view?.environment[name] === Number(value));
        snapshot.forEach((value, name) => { if (field(form, name).value === value && view?.environment[name] === Number(value))
            environmentDirty.delete(name); });
        syncEnvironmentInputs();
        message(confirmed ? 'Exercise settings saved.' : 'Settings accepted. Waiting for the refreshed exercise; your entries are kept.');
    });
}
bindForm('map-form', async () => {
    if (!view?.environment.map.imageId) throw new Error('Choose an image and complete guided alignment first.');
    const map = { imageId: view.environment.map.imageId };
    for (const k of ['widthNm', 'originXPct', 'originYPct', 'rotationDeg', 'opacity'])
        map[k] = num('map-form', k);
    await command('environment', { map, briefing: alignmentBriefing(view.environment.briefing, 'Overlay manually adjusted. Recheck alignment against known chart points.') });
    message('Manual map calibration saved. Verify known points again.');
});
$('remove-map').onclick = safe(() => command('environment', { map: { ...view?.environment.map, imageId: '' } }));
bindForm('criterion-form', async () => {
    const p = {};
    for (const k of ['kind', 'aircraftA', 'aircraftB', 'unit', 'reference', 'applicability', 'evidence', 'assessment', 'notes'])
        p[k] = val('criterion-form', k);
    p.unit = String(p.unit).toLowerCase();
    p.minimum = num('criterion-form', 'minimum');
    p.expiresAt = num('criterion-form', 'expiresAt');
    if ($('criterion-form').dataset.editId)
        p.id = $('criterion-form').dataset.editId;
    await command('criterion-upsert', p, undefined, $('criterion-form').dataset.exerciseId || view?.exerciseId);
    delete $('criterion-form').dataset.editId;
    delete $('criterion-form').dataset.exerciseId;
    message('Separation objective saved.');
});
function download(name, data) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
$('export').onclick = safe(async () => download('reds-procedural-scenario.json', await request('/api/procedural/export')));
$('import').addEventListener('change', () => void safe(async () => {
    const exerciseId = view?.exerciseId, stamp = generation, auth = session, input = $('import'), file = input.files?.[0];
    if (!file || !auth)
        return;
    if (file.size > 20 * 1024 * 1024)
        throw new Error('Scenario file is too large.');
    const bundle = JSON.parse(await file.text());
    if (stamp !== generation || auth !== session)
        return;
    if (exerciseId !== view?.exerciseId)
        throw new Error('The exercise changed. Choose the file again.');
    if (bundle.version !== 1 || !bundle.scenario)
        throw new Error('Unsupported scenario version.');
    if (!confirm('Restore this scenario and replace the current exercise? It will open paused.'))
        return;
    if (bundle.mapAsset) {
        const bytes = Uint8Array.from(atob(bundle.mapAsset.data), c => c.charCodeAt(0));
        const uploaded = await request('/api/procedural/map', new Blob([bytes], { type: bundle.mapAsset.mime }));
        if (stamp !== generation || auth !== session)
            return;
        if (uploaded.imageId !== bundle.mapAsset.id)
            throw new Error('Map checksum does not match.');
    }
    if (exerciseId !== view?.exerciseId)
        throw new Error('The exercise changed. Choose the file again.');
    await command('import', { scenario: bundle.scenario }, undefined, exerciseId);
    if (stamp !== generation || auth !== session)
        return;
    drafts.clear();
    sessionStorage.removeItem('reds-procedural-drafts');
    trailHistory.clear();
    selected = '';
    settingsLoaded = false;
    signatures.clear();
    render();
    input.value = '';
    message('Scenario restored, paused.');
})());
$('audio-enable').addEventListener('change', () => {
    const enabled = $('audio-enable').checked;
    if (enabled)
        speak('Pilot readbacks enabled.');
    else {
        clearAudio();
        text('audio-status', 'Captions and D/F work with sound off.');
    }
});
document.addEventListener('keydown', e => {
    if (e.target.closest('input,textarea,select,[contenteditable=true]') || !session || stage !== 'desk')
        return;
    if (e.key === 'Escape')
        closeDrawer();
    if (e.target === canvas && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'Home')
            $('centre-scope').click();
        else {
            pan.x += e.key === 'ArrowLeft' ? -70 : e.key === 'ArrowRight' ? 70 : 0;
            pan.y += e.key === 'ArrowUp' ? -70 : e.key === 'ArrowDown' ? 70 : 0;
            draw();
        }
        return;
    }
    if (e.key === 'Escape' && display.fullscreen) {
        display.fullscreen = false;
        document.body.classList.remove('scope-expanded');
        draw();
    }
    if (e.target.closest('button,summary,a,[role=tab],[role=button]'))
        return;
    if (session.role !== 'instructor' || e.ctrlKey || e.metaKey || e.altKey)
        return;
    if (e.code === 'Space') {
        e.preventDefault();
        void safe(() => view?.running ? command('clock', { action: 'pause' }) : startExercise())();
    }
    if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        void safe(() => command('transmit', { mode: 'df', durationSeconds: 8 }, selected))();
    }
    if (e.key.toLowerCase() === 'g' && !view?.running) {
        e.preventDefault();
        void safe(() => command('clock', { action: 'step', seconds: 60 }))();
    }
    const shortcut = e.key.toLowerCase();
    if (['a', 'd', 'x'].includes(shortcut)) {
        e.preventDefault();
        void safe(() => shortcut === 'x' ? command('clearance', { action: 'stop-turn' }, selected) : turnSelected(shortcut === 'a' ? 'left' : 'right'))();
    }
    if (['h', 'p'].includes(shortcut)) {
        e.preventDefault();
        void safe(() => command('transmit', { mode: shortcut === 'h' ? 'heading' : 'position', durationSeconds: 6 }, selected))();
    }
    if (['[', ']'].includes(shortcut) && view?.roster.length) {
        e.preventDefault();
        const index = view.roster.findIndex(a => a.id === selected);
        choose(view.roster[(index + (shortcut === ']' ? 1 : -1) + view.roster.length) % view.roster.length].id);
    }
});
const trafficSetup = createTrafficSetup({
    container: $('setup'), view: () => view,
    submit: async (payload, isCurrent) => {
        const stamp = generation;
        if (!confirm('Create this exercise and replace the current traffic? The session will open paused with a new PIN.'))
            throw new Error('Creation cancelled. Your traffic entries are still available.');
        await command('scenario-setup', payload);
        if (stamp !== generation)
            return;
        if (!isCurrent())
            return;
        trafficSetup.close();
        setStage('desk');
        tab('session');
        message('Exercise created. Share the PIN and admit your controller.');
    },
    cancel: () => { trafficSetup.close(); setStage('desk'); },
    airspace: () => { trafficSetup.close(); setStage('desk'); tab('build'); }
});
$('traffic-setup').onclick = safe(showTrafficSetup);
$('drawer-close').onclick = closeDrawer;
$('waiting-leave').onclick = leave;
$('student-ready').onclick = safe(() => roomAction('ready'));
$('reset-room').onclick = safe(async () => { if (confirm('Create a new PIN and close current student admissions?'))
    await roomAction('reset'); });
$('copy-pin').onclick = safe(async () => { await navigator.clipboard.writeText(String(room?.pin || '')); message('Session PIN copied.'); });
for (const id of ['terminate', 'terminate-quick']) $(id).onclick = () => {
    if (session?.role !== 'instructor' || view?.terminated || commandBusy) return;
    $('terminate-confirm').returnValue = ''; $('terminate-confirm').showModal(); renderClockControls();
};
$('terminate-confirm').addEventListener('close', safe(async () => {
    renderClockControls();
    if ($('terminate-confirm').returnValue !== 'terminate' || session?.role !== 'instructor' || view?.terminated) return;
    await command('clock', { action: 'terminate' });
    clearAudio(); tab('debrief'); renderClockControls();
}));
for (const id of ['reopen-exercise', 'review-reopen'])
    $(id).onclick = safe(async () => {
        await command('clock', { action: 'reopen' });
        closeDrawer();
        message('Exercise reopened and paused. Select Run to continue.');
    });
$('notice-session').onclick = () => tab('session');
$('notice-review').onclick = () => tab('debrief');
$('back-flow').onclick = safe(async () => {
    if (!$('work-panel').hidden) {
        closeDrawer();
        return;
    }
    if (stage === 'desk' && session?.role === 'instructor') {
        await showTrafficSetup();
        return;
    }
    trafficSetup.close();
    setStage('entry');
});
$('return-desk').onclick = () => { setStage(session?.role === 'student' && room?.status !== 'ready' ? 'waiting' : 'desk'); draw(); };
$('restart-setup').onclick = safe(showTrafficSetup);
$('centre-scope').onclick = () => { const g = geometry(); pan = { x: -(view?.environment.stationXNm || 0) * g.scale, y: (view?.environment.stationYNm || 0) * g.scale }; draw(); };
function fitScope(points) {
    const fitted = fitNavigation(points, canvas.clientWidth, canvas.clientHeight);
    if (!fitted)
        return;
    range = fitted.range;
    pan = fitted.pan;
    syncRange();
    draw();
}
$('fit-routes').onclick = () => {
    if (!view)
        return;
    const ids = new Set(view.routes.filter(r => !hiddenRoutes.has(r.id)).flatMap(r => r.fixIds));
    const fixes = view.fixes.filter(f => ids.has(f.id));
    if (!fixes.length) {
        message('Load an aerodrome or select a route in Declutter first.');
        return;
    }
    if (!display.routes) {
        message('Routes are hidden for both consoles. The instructor can enable Routes & fixes in Declutter.');
        return;
    }
    fitScope([...fixes, { xNm: view.environment.stationXNm || 0, yNm: view.environment.stationYNm || 0 }]);
};
$('local-view').onclick = () => { if (!view)
    return; range = view.environment.rangeNm; syncRange(); $('centre-scope').click(); };
$('approach-view').onclick = () => { display.approach = true; document.querySelectorAll('[data-layer="approach"]').forEach(c => c.checked = true); fitScope(approachPoints()); closeDrawer(); };
$('approach-marks').onclick = () => { display.approach = !display.approach; document.querySelectorAll('[data-layer="approach"]').forEach(c => c.checked = display.approach); draw(); };
$('browser-fullscreen').onclick = safe(async () => { if (document.fullscreenElement)
    await document.exitFullscreen();
else
    await document.documentElement.requestFullscreen(); });
$('declutter').onclick = () => {
    Object.assign(display, { rings: true, labels: true, areaLabels: false, routeLabels: true, fixLabels: true, trails: true, vectors: false, runway: true, approach: false, ruler: false });
    showMap = false;
    ruler = [];
    $('map-toggle').setAttribute('aria-pressed', 'false');
    document.querySelectorAll('[data-layer]').forEach(c => c.checked = display[c.dataset.layer]);
    signatures.delete('area-layer-controls');
    signatures.delete('route-layer-controls');
    renderLayerLists();
    draw();
};
const mapWorkshop = createMapWorkshop({ view: () => view, generation: () => generation, command, request, message, showMap: () => { showMap = true; $('map-toggle').setAttribute('aria-pressed', 'true'); draw(); } });
const chartWorkshop = createChartWorkshop({ view: () => view, generation: () => generation, command, request, message, changed: () => { settingsLoaded = false; signatures.clear(); trailHistory.clear(); render(); } });
function clearanceFields() {
    const action = val('clearance-form', 'action');
    text('clearance-value-name', action === 'heading' ? 'Heading °T' : action === 'speed' ? 'Speed kt' : val('clearance-form', 'reference') === 'standard' ? 'Flight level' : 'Altitude ft QNH');
    field('clearance-form', 'value').max = action === 'heading' ? '359' : action === 'speed' ? '600' : val('clearance-form', 'reference') === 'standard' ? '600' : '60000';
    field('clearance-form', 'value').required = ['heading', 'altitude', 'speed'].includes(action);
    for (const [name, show] of Object.entries({ value: ['heading', 'altitude', 'speed'].includes(action), direction: ['heading', 'hold'].includes(action), reference: action === 'altitude', fixId: ['direct', 'hold'].includes(action), routeId: action === 'route' })) {
        field('clearance-form', name).closest('label').hidden = !show;
        field('clearance-form', name).disabled = !show;
    }
    field('clearance-form', 'inboundCourseDeg').closest('details').hidden = action !== 'hold';
    field('clearance-form', 'inboundCourseDeg').closest('details').querySelectorAll('input,select').forEach(input => input.disabled = action !== 'hold');
}
field('clearance-form', 'action').addEventListener('change', clearanceFields);
field('clearance-form', 'reference').addEventListener('change', clearanceFields);
clearanceFields();
window.addEventListener('pageshow', e => {
    if (e.persisted && session) {
        clearTimeout(pollTimer);
        void poll(generation);
    }
});
window.addEventListener('pagehide', () => { clearTimeout(pollTimer); clearAudio(); });
document.addEventListener('visibilitychange', () => {
    if (document.hidden)
        clearAudio();
});
setInterval(() => {
    if (session) {
        renderRadio();
        draw();
    }
}, 200);
try {
    const saved = sessionStorage.getItem(key);
    if (saved) {
        const s = JSON.parse(saved);
        const studentEntry = new URLSearchParams(location.search).get('position') === 'student';
        if (studentEntry && s.role !== 'student') {
            sessionStorage.removeItem(key);
            sessionStorage.removeItem('reds-procedural-drafts');
            sessionStorage.removeItem('reds-procedural-draft-exercise');
        }
        else if (s.token && s.csrf && s.workspace === 'procedural' && ['student', 'instructor'].includes(s.role)) {
            const d = sessionStorage.getItem('reds-procedural-drafts');
            if (d)
                drafts = new Map(JSON.parse(d));
            enter(s);
        }
    }
}
catch {
    sessionStorage.removeItem(key);
}
