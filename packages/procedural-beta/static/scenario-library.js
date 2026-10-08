import { validateBoundary } from './airspace-preparation.js';
import { project } from './chart-geometry.js';

const storageKey = 'ats-simbox-exercise-templates-v1';
const stateKeys = ['version', 'exerciseId', 'revision', 'elapsed', 'running', 'terminated', 'mode', 'title', 'environment', 'fixes', 'routes', 'areas', 'scopeDisplay', 'aircraft', 'strips', 'calls', 'reports', 'events', 'criteria', 'radio', 'sequence'];
const forbidden = /^(?:pin|token|password|secret|authorization|auth|session|sessionId|instructorToken|studentToken|room|roomId|accessToken|refreshToken|service_role|serviceRole|anonKey|apiKey|__proto__|constructor|prototype)$/i;
function cloneSafe(value) {
    if (Array.isArray(value)) return value.map(cloneSafe);
    if (value && typeof value === 'object') { const result = Object.create(null); for (const [key, data] of Object.entries(value)) if (!forbidden.test(key)) result[key] = cloneSafe(data); return result; }
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Exercise contains an invalid number.');
    return value;
}
function validAsset(asset, scenario) {
    if (!asset) { if (scenario.environment.map?.imageId) throw new Error('This exercise has an image overlay but no image file. Export the scenario with its map first.'); return undefined; }
    if (!/^[a-f0-9]{64}$/.test(asset.id || '') || !['image/png', 'image/jpeg', 'image/webp'].includes(asset.mime) || typeof asset.data !== 'string' || asset.data.length > 27 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(asset.data) || scenario.environment.map?.imageId !== asset.id) throw new Error('The saved map is invalid or does not match the exercise.');
    return { id: asset.id, mime: asset.mime, data: asset.data };
}
const validID = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
const validGeo = p => p && [p.latitude, p.longitude].every(v => typeof v === 'number' && Number.isFinite(v)) && Math.abs(p.latitude) < 90 && Math.abs(p.longitude) <= 180;
function validateGeometry(scenario) {
    const maps = {};
    for (const [key, capacity] of [['fixes', 200], ['routes', 100], ['areas', 80], ['criteria', 100]]) {
        const records = scenario[key] || [];
        if (!Array.isArray(records) || records.length > capacity) throw new Error(`Invalid exercise ${key}.`);
        const ids = new Set();
        records.forEach(record => { if (!record || !validID(record.id) || ids.has(record.id)) throw new Error(`Exercise ${key} need unique valid identifiers.`); ids.add(record.id); }); maps[key] = ids;
    }
    for (const fix of scenario.fixes || []) if (!fix.name || ![fix.xNm, fix.yNm].every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 2000)) throw new Error('Exercise fixes need valid names and NM coordinates.');
    for (const route of scenario.routes || []) if (!route.name || !['ats', 'conditional'].includes(route.kind) || !Array.isArray(route.fixIds) || route.fixIds.length < 2 || route.fixIds.length > 50 || route.fixIds.some(id => !maps.fixes.has(id))) throw new Error('Exercise route references must match its saved fixes.');
    for (const area of scenario.areas || []) {
        if (!area.name || !['local-flying', 'control-zone', 'prohibited', 'restricted', 'danger'].includes(area.kind) || !Array.isArray(area.points)) throw new Error('Exercise areas need named polygon boundaries.');
        if (validateBoundary(area.points).length !== area.points.length) throw new Error('Saved boundary must not repeat its closing vertex.');
        if (area.coordinateOrigin || area.geoPoints?.length) {
            if (!validGeo(area.coordinateOrigin) || !Array.isArray(area.geoPoints) || area.geoPoints.length !== area.points.length) throw new Error('Saved geographic boundary metadata is incomplete.');
            area.geoPoints.forEach((p, i) => { if (!validGeo(p)) throw new Error('Saved boundary coordinate is invalid.'); const projected = project(p, area.coordinateOrigin); if (Math.hypot(projected.xNm - area.points[i].xNm, projected.yNm - area.points[i].yNm) > .01) throw new Error('Saved geographic boundary does not match its NM geometry.'); });
        }
    }
    for (const aircraft of scenario.aircraft) if (aircraft.routeId && !maps.routes.has(aircraft.routeId) || aircraft.directFixId && !maps.fixes.has(aircraft.directFixId)) throw new Error('Starting aircraft navigation references must match the saved routes and fixes.');
    for (const [key, ids] of [['hiddenRouteIds', maps.routes], ['hiddenAreaIds', maps.areas]]) { const hidden = scenario.scopeDisplay?.[key] || []; if (!Array.isArray(hidden) || hidden.some(id => !ids.has(id))) throw new Error('Saved chart selections reference missing routes or areas.'); }
}
export function prepareExerciseTemplate(bundle, name, id = '', createdAt = '', options = {}) {
    const source = bundle?.scenario;
    if (bundle?.version !== 1 || !source || source.version !== 1 || !source.environment || !Array.isArray(source.aircraft)) throw new Error('Choose a version-one simulator scenario.');
    if (source.elapsed !== 0 || source.running) throw new Error('Save a template before Run, paused at elapsed 00:00. Create a fresh exercise to save its starting traffic.');
    const label = String(name || '').trim();
    if (!label || label.length > 80 || label.includes('\0')) throw new Error('Name the exercise using 1–80 characters.');
    const limit = options.allowLegacy24 ? 24 : 20;
    if (!['area', 'approach', 'aerodrome'].includes(source.mode) || source.aircraft.length > limit) throw new Error(`New Procedural templates support up to ${limit} aircraft.`);
    if (id && !validID(id)) throw new Error('Saved exercise identifier is invalid.');
    if (createdAt && (typeof createdAt !== 'string' || createdAt.length > 40 || !Number.isFinite(Date.parse(createdAt)))) throw new Error('Saved exercise date is invalid.');
    const scenario = {};
    for (const key of stateKeys) if (key in source) scenario[key] = cloneSafe(source[key]);
    Object.assign(scenario, { exerciseId: 'saved-template', revision: 0, sequence: 0, elapsed: 0, running: false, terminated: false, title: label, calls: [], reports: [], events: [], radio: { id: '', aircraftId: '', callsign: '', text: '', phase: 'idle', remainingMs: 0 } });
    const callsigns = new Set(), aircraftIds = new Set();
    for (const aircraft of scenario.aircraft) {
        if (!validID(aircraft.id) || typeof aircraft.callsign !== 'string' || !aircraft.callsign.trim() || aircraft.callsign.length > 24 || aircraftIds.has(aircraft.id) || callsigns.has(String(aircraft.callsign).toUpperCase()) || ![aircraft.xNm, aircraft.yNm, aircraft.headingDeg, aircraft.speedKt, aircraft.altitudeFt].every(Number.isFinite) || Math.abs(aircraft.xNm) > 2000 || Math.abs(aircraft.yNm) > 2000 || aircraft.headingDeg < 0 || aircraft.headingDeg > 360 || aircraft.speedKt < 0 || aircraft.speedKt > 700 || aircraft.altitudeFt < -1500 || aircraft.altitudeFt > 60000) throw new Error('Starting aircraft must have unique identities and valid positions, headings, speeds and altitudes.');
        aircraftIds.add(aircraft.id); callsigns.add(String(aircraft.callsign).toUpperCase());
    }
    validateGeometry(scenario);
    const mapAsset = validAsset(bundle.mapAsset, scenario);
    const template = { format: 'ats-simbox-exercise-template', version: 1, id: id || globalThis.crypto.randomUUID(), name: label, createdAt: createdAt || new Date().toISOString(), bundle: { version: 1, scenario, ...(mapAsset ? { mapAsset } : {}) } };
    if (new TextEncoder().encode(JSON.stringify(template, null, 2)).length > 20 * 1024 * 1024) throw new Error('Exercise file with its map must be smaller than 20 MB. Use a smaller image.');
    return template;
}
export function parseExerciseTemplate(text, options = {}) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > 20 * 1024 * 1024) throw new Error('Exercise file must be smaller than 20 MB.');
    const data = JSON.parse(text);
    if (data?.format === 'ats-simbox-exercise-template' && data.version === 1) return prepareExerciseTemplate(data.bundle, data.name, data.id, data.createdAt, options);
    return prepareExerciseTemplate(data, data?.scenario?.title || 'Imported exercise', '', '', options);
}
function element(tag, text = '', className = '') { const e = document.createElement(tag); e.textContent = text; e.className = className; return e; }
function button(text, action) { const e = element('button', text); e.type = 'button'; e.addEventListener('click', action); return e; }
export function createScenarioLibrary(host) {
    const container = host.container || document.getElementById('tab-build');
    const section = element('section', '', 'scenario-library'); section.id = 'scenario-library';
    section.append(element('p', 'Save the paused starting setup on this device, or load a saved airspace and traffic setup.', 'hint'));
    const nameLabel = element('label', 'Exercise name'), name = element('input'); name.id = 'template-name'; name.maxLength = 80; name.placeholder = 'e.g. Crossing traffic · assessment 1'; nameLabel.append(name);
    const selectLabel = element('label', 'Load saved exercise'), select = element('select'); select.id = 'template-select'; selectLabel.append(select);
    const status = element('p', '', 'scenario-library-status'); status.id = 'scenario-library-status'; status.setAttribute('role', 'status');
    const actions = element('div', '', 'scenario-library-actions');
    let templates = [], pending = false, openRequested = false, nameEdited = false;
    name.addEventListener('input', () => { nameEdited = true; });
    function read() { try { const data = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (!Array.isArray(data) || data.length > 50) throw new Error('Saved exercise list is invalid.'); templates = data.map(t => parseExerciseTemplate(JSON.stringify(t), { allowLegacy24: true })); if (new Set(templates.map(t => t.id)).size !== templates.length) throw new Error('Saved exercise identities are duplicated.'); } catch (e) { templates = []; status.textContent = 'Saved exercise storage could not be read. Import a downloaded exercise to restore it.'; } }
    function update() { const chosen = select.value; select.replaceChildren(new Option(templates.length ? 'Select exercise…' : 'No exercises saved on this device', ''), ...templates.map(t => new Option(`${t.name} · ${t.bundle.scenario.aircraft.length} aircraft`, t.id))); if (templates.some(t => t.id === chosen)) select.value = chosen; }
    function persist() { try { localStorage.setItem(storageKey, JSON.stringify(templates)); } catch { throw new Error('Device storage is full or unavailable. Download the exercise file to keep it.'); } update(); }
    async function perform(control, action) { if (pending) return; pending = true; section.setAttribute('aria-busy', 'true'); section.querySelectorAll('button,input,select').forEach(e => { e.disabled = true; }); try { await action(); } catch (e) { status.textContent = e.message; host.message?.(e.message, true); } finally { pending = false; section.removeAttribute('aria-busy'); section.querySelectorAll('button,input,select').forEach(e => { e.disabled = false; }); } }
    const selected = () => { const t = templates.find(t => t.id === select.value); if (!t) throw new Error('Select a saved exercise.'); return t; };
    async function saveStarting(asNew = false) {
        const state = host.view(); if (!state || state.role !== 'instructor') throw new Error('Open instructor setup first.');
        if (host.hasDraft?.()) throw new Error('Apply your airspace changes and create the traffic before saving the starting setup. Your entries are kept.');
        if (state.running || state.elapsed !== 0) throw new Error('Save before Run, while the starting exercise is paused at 00:00:00.');
        const stamp = host.generation(), exerciseId = state.exerciseId, bundle = await host.request('/api/procedural/export');
        if (stamp !== host.generation() || exerciseId !== host.view()?.exerciseId) throw new Error('The exercise changed. Save again.');
        if (bundle.scenario.exerciseId !== exerciseId) throw new Error('The exported exercise changed. Save again.');
        if (Number.isSafeInteger(host.view()?.revision) && bundle.scenario.revision !== host.view().revision) throw new Error('The exercise changed while saving. Save again.');
        const old = !asNew ? templates.find(t => t.id === select.value) : undefined;
        if (asNew && templates.some(t => t.name.toLowerCase() === name.value.trim().toLowerCase())) throw new Error('Use a different name for Save as new. Rename or replace the existing exercise instead.');
        uniqueName(name.value.trim(), old?.id);
        if (old && !await (globalThis.ATCSuiteWorkspace?.confirmAction?.(`Replace saved exercise ${old.name}?`, {confirmLabel:'Replace saved exercise'}) ?? confirm(`Replace saved exercise ${old.name}?`))) return;
        if (stamp !== host.generation() || exerciseId !== host.view()?.exerciseId || state.running !== host.view()?.running || host.view()?.elapsed !== 0 || host.hasDraft?.()) throw new Error('The exercise changed. Save again.');
        if (Number.isSafeInteger(host.view()?.revision) && bundle.scenario.revision !== host.view().revision) throw new Error('The exercise changed while confirming. Save again.');
        const template = prepareExerciseTemplate(bundle, name.value, old?.id, old?.createdAt);
        if (templates.length >= 50 && !old) throw new Error('Up to 50 exercises can be kept on this device. Download and remove one first.');
        templates = [...templates.filter(t => t.id !== template.id), template];
        try { persist(); } catch { update(); select.value = template.id; status.textContent = 'Device storage is full. This setup is kept for this page only. Use Export selected to keep the exercise file.'; return; }
        select.value = template.id; status.textContent = 'Starting setup saved on this device. Export it to share or back it up.';
    }
    const save = button('Save current setup', () => void perform(save, () => saveStarting())); save.id = 'template-save';
    const saveAs = button('Save as new', () => void perform(saveAs, () => saveStarting(true))); saveAs.id = 'template-save-as';
    function uniqueName(label, exceptID = '') { if (templates.some(t => t.id !== exceptID && t.name.toLowerCase() === label.trim().toLowerCase())) throw new Error('That exercise name is already used. Choose another name.'); }
    const duplicate = button('Duplicate selected', () => void perform(duplicate, async () => {
        const source = selected(); let label = name.value.trim();
        if (!label || label === source.name) { const base = source.name.slice(0, 70); label = `${base} copy`; let count = 2; while (templates.some(t => t.name.toLowerCase() === label.toLowerCase())) label = `${base} copy ${count++}`; }
        uniqueName(label); const copy = prepareExerciseTemplate(source.bundle, label);
        if (templates.length >= 50) throw new Error('Up to 50 exercises can be kept on this device. Export and remove one first.');
        templates = [...templates, copy]; name.value = copy.name;
        try { persist(); } catch { update(); select.value = copy.id; status.textContent = 'Device storage is unavailable. This copy is kept for this page only. Use Export selected to keep it.'; return; }
        select.value = copy.id; status.textContent = 'Independent exercise copy saved on this device.';
    })); duplicate.id = 'template-duplicate';
    const rename = button('Rename selected', () => void perform(rename, async () => {
        const source = selected(), label = name.value.trim(); uniqueName(label, source.id);
        const renamed = prepareExerciseTemplate(source.bundle, label, source.id, source.createdAt, { allowLegacy24: true }); const previous = templates;
        templates = templates.map(t => t.id === source.id ? renamed : t); try { persist(); } catch (error) { templates = previous; update(); select.value = source.id; throw error; }
        select.value = source.id; status.textContent = 'Saved exercise renamed. Starting traffic and chart selections are unchanged.';
    })); rename.id = 'template-rename';
    const load = button('Load', () => void perform(load, async () => {
        const state = host.view(); if (!state || state.role !== 'instructor') throw new Error('Open the instructor desk first.');
        const template = selected();
        const exerciseId = state.exerciseId, stamp = host.generation(), current = () => stamp === host.generation() && exerciseId === host.view()?.exerciseId;
        const prompt = `Load ${template.name} and replace the current exercise? It opens paused at 00:00:00. Current progress${host.hasDraft?.() ? ' and unsaved airspace / traffic entries' : ''} will be replaced.`;
        if (!await (globalThis.ATCSuiteWorkspace?.confirmAction?.(prompt, {confirmLabel:'Load exercise'}) ?? confirm(prompt))) return;
        if (!current()) throw new Error('The exercise changed. Select the template again.');
        if (state.running) await host.command('clock', { action: 'pause' }, undefined, exerciseId);
        if (!current()) throw new Error('The exercise changed. Select the template again.');
        const bundle = template.bundle;
        if (bundle.mapAsset) { const asset = bundle.mapAsset; const bytes = Uint8Array.from(atob(asset.data), c => c.charCodeAt(0)); const uploaded = await host.request('/api/procedural/map', new Blob([bytes], { type: asset.mime })); if (!current()) throw new Error('The exercise changed during map upload.'); if (uploaded.imageId !== asset.id) throw new Error('Saved map checksum does not match.'); }
        if (!current()) throw new Error('The exercise changed. Select the template again.');
        await host.command('import', { scenario: bundle.scenario, expectedRevision: host.view()?.revision }, undefined, exerciseId); host.changed?.(); status.textContent = `${template.name} loaded with its original starting traffic. Exercise paused.`; host.loaded?.(bundle.scenario);
    })); load.id = 'template-load';
    const download = button('Export selected', () => { try { const t = selected(); const url = URL.createObjectURL(new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' })); const a = element('a'); a.href = url; a.download = `${t.name.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60) || 'exercise'}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); } catch (e) { status.textContent = e.message; } }); download.id = 'template-download';
    const remove = button('Remove selected', async () => { try { const t = selected(); if (!await (globalThis.ATCSuiteWorkspace?.confirmAction?.(`Remove ${t.name} from this device? Downloaded files are unaffected.`, {confirmLabel:'Remove saved exercise'}) ?? confirm(`Remove ${t.name} from this device? Downloaded files are unaffected.`))) return; const before = templates; templates = templates.filter(x => x.id !== t.id); try { persist(); } catch (e) { templates = before; throw e; } status.textContent = 'Saved exercise removed.'; } catch (e) { status.textContent = e.message; } });
    const fileLabel = element('label', 'Import exercise file'), file = element('input'); file.id = 'template-import'; file.type = 'file'; file.accept = '.json,application/json'; fileLabel.append(file);
    file.addEventListener('change', () => void perform(file, async () => { const chosen = file.files?.[0]; if (!chosen) return; if (chosen.size > 20 * 1024 * 1024) throw new Error('Exercise file must be smaller than 20 MB.'); const t = parseExerciseTemplate(await chosen.text()); const duplicate = templates.find(x => x.id === t.id); if (templates.length >= 50 && !duplicate) throw new Error('Remove one saved exercise before importing.'); uniqueName(t.name, t.id); if (duplicate && !await (globalThis.ATCSuiteWorkspace?.confirmAction?.(`Replace the stored copy of ${t.name}?`, {confirmLabel:'Replace saved copy'}) ?? confirm(`Replace the stored copy of ${t.name}?`))) return; const previous = templates; templates = [...templates.filter(x => x.id !== t.id), t]; try { persist(); } catch (e) { templates = previous; update(); throw e; } select.value = t.id; name.value = t.name; status.textContent = 'Imported into your library. Select Load to apply the saved exercise.'; file.value = ''; }));
    select.addEventListener('change', () => { const t = templates.find(t => t.id === select.value); if (t) { name.value = t.name; nameEdited = false; } });
    const loadRow = element('div', '', 'scenario-library-actions'); loadRow.append(selectLabel, load);
    const saveRow = element('div', '', 'scenario-library-actions'); saveRow.append(nameLabel, save);
    const manage = element('details'); manage.id = 'template-manage'; manage.append(element('summary', 'Manage exercises & files'));
    actions.append(saveAs, duplicate, rename, download, remove); manage.append(actions,fileLabel);
    section.append(loadRow,saveRow,manage,status); container.prepend(section); read(); update();
    function open() { openRequested = true; section.scrollIntoView({ block: 'start' }); select.focus({preventScroll:true}); }
    return { open, render() { if (!select.value && !nameEdited && host.view()?.elapsed === 0) name.value = host.view().title || ''; if (openRequested) { section.scrollIntoView({ block: 'start' }); openRequested = false; } } };
}
