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
export function prepareExerciseTemplate(bundle, name, id = '', createdAt = '') {
    const source = bundle?.scenario;
    if (bundle?.version !== 1 || !source || source.version !== 1 || !source.environment || !Array.isArray(source.aircraft)) throw new Error('Choose a version-one simulator scenario.');
    if (source.elapsed !== 0) throw new Error('Save a template before Run, at elapsed 00:00. Create a fresh exercise to save its starting traffic.');
    const label = String(name || '').trim();
    if (!label || label.length > 80 || label.includes('\0')) throw new Error('Name the exercise using 1–80 characters.');
    if (!['area', 'approach', 'aerodrome'].includes(source.mode) || source.aircraft.length > 24 || (source.fixes?.length || 0) > 200 || (source.routes?.length || 0) > 100 || (source.areas?.length || 0) > 80) throw new Error('Exercise settings exceed simulator capacity.');
    const scenario = {};
    for (const key of stateKeys) if (key in source) scenario[key] = cloneSafe(source[key]);
    Object.assign(scenario, { exerciseId: 'saved-template', revision: 0, sequence: 0, elapsed: 0, running: false, terminated: false, title: label, calls: [], reports: [], events: [], radio: { id: '', aircraftId: '', callsign: '', text: '', phase: 'idle', remainingMs: 0 } });
    const callsigns = new Set(), aircraftIds = new Set();
    for (const aircraft of scenario.aircraft) {
        if (!aircraft.id || !aircraft.callsign || aircraftIds.has(aircraft.id) || callsigns.has(String(aircraft.callsign).toUpperCase()) || ![aircraft.xNm, aircraft.yNm, aircraft.headingDeg, aircraft.speedKt, aircraft.altitudeFt].every(Number.isFinite)) throw new Error('Starting aircraft must have unique identities and valid positions, headings, speeds and altitudes.');
        aircraftIds.add(aircraft.id); callsigns.add(String(aircraft.callsign).toUpperCase());
    }
    const mapAsset = validAsset(bundle.mapAsset, scenario);
    return { format: 'ats-simbox-exercise-template', version: 1, id: id || globalThis.crypto.randomUUID(), name: label, createdAt: createdAt || new Date().toISOString(), bundle: { version: 1, scenario, ...(mapAsset ? { mapAsset } : {}) } };
}
export function parseExerciseTemplate(text) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > 20 * 1024 * 1024) throw new Error('Exercise file must be smaller than 20 MB.');
    const data = JSON.parse(text);
    if (data?.format === 'ats-simbox-exercise-template' && data.version === 1) return prepareExerciseTemplate(data.bundle, data.name, data.id, data.createdAt);
    return prepareExerciseTemplate(data, data?.scenario?.title || 'Imported exercise');
}
function element(tag, text = '', className = '') { const e = document.createElement(tag); e.textContent = text; e.className = className; return e; }
function button(text, action) { const e = element('button', text); e.type = 'button'; e.addEventListener('click', action); return e; }
export function createScenarioLibrary(host) {
    const container = host.container || document.getElementById('tab-build');
    const section = element('section', '', 'scenario-library'); section.id = 'scenario-library';
    section.append(element('h2', 'Saved exercises'), element('p', 'Save the starting setup. Reuse the same traffic and airspace.', 'hint'));
    const nameLabel = element('label', 'Exercise name'), name = element('input'); name.id = 'template-name'; name.maxLength = 80; name.placeholder = 'e.g. Crossing traffic · assessment 1'; nameLabel.append(name);
    const selectLabel = element('label', 'Choose saved exercise'), select = element('select'); select.id = 'template-select'; selectLabel.append(select);
    const status = element('p', '', 'scenario-library-status'); status.id = 'scenario-library-status'; status.setAttribute('role', 'status');
    const actions = element('div', '', 'scenario-library-actions');
    let templates = [], pending = false, openRequested = false;
    function read() { try { const data = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (!Array.isArray(data) || data.length > 50) throw new Error('Saved exercise list is invalid.'); templates = data.map(t => parseExerciseTemplate(JSON.stringify(t))); } catch (e) { templates = []; status.textContent = 'Saved exercise storage could not be read. Import a downloaded exercise to restore it.'; } }
    function update() { const chosen = select.value; select.replaceChildren(new Option(templates.length ? 'Select exercise…' : 'No exercises saved on this device', ''), ...templates.map(t => new Option(`${t.name} · ${t.bundle.scenario.aircraft.length} aircraft`, t.id))); if (templates.some(t => t.id === chosen)) select.value = chosen; }
    function persist() { try { localStorage.setItem(storageKey, JSON.stringify(templates)); } catch { throw new Error('Device storage is full or unavailable. Download the exercise file to keep it.'); } update(); }
    async function perform(control, action) { if (pending) return; pending = true; section.setAttribute('aria-busy', 'true'); section.querySelectorAll('button,input,select').forEach(e => { e.disabled = true; }); try { await action(); } catch (e) { status.textContent = e.message; host.message?.(e.message, true); } finally { pending = false; section.removeAttribute('aria-busy'); section.querySelectorAll('button,input,select').forEach(e => { e.disabled = false; }); } }
    const selected = () => { const t = templates.find(t => t.id === select.value); if (!t) throw new Error('Select a saved exercise.'); return t; };
    const save = button('Save starting setup', () => void perform(save, async () => {
        const state = host.view(); if (!state || state.role !== 'instructor') throw new Error('Open instructor setup first.');
        if (state.running || state.elapsed !== 0) throw new Error('Save before Run, while the starting exercise is paused at 00:00.');
        const stamp = host.generation(), exerciseId = state.exerciseId, bundle = await host.request('/api/procedural/export');
        if (stamp !== host.generation() || exerciseId !== host.view()?.exerciseId) throw new Error('The exercise changed. Save again.');
        if (bundle.scenario.exerciseId !== exerciseId) throw new Error('The exported exercise changed. Save again.');
        const old = templates.find(t => t.name.toLowerCase() === name.value.trim().toLowerCase());
        if (old && !confirm(`Replace saved exercise ${old.name}?`)) return;
        const template = prepareExerciseTemplate(bundle, name.value, old?.id, old?.createdAt);
        if (templates.length >= 50 && !old) throw new Error('Up to 50 exercises can be kept on this device. Download and remove one first.');
        templates = [...templates.filter(t => t.id !== template.id), template];
        try { persist(); } catch { update(); select.value = template.id; status.textContent = 'Device storage is full. This setup is kept for this page only. Use Download selected to keep the exercise file.'; return; }
        select.value = template.id; status.textContent = 'Starting setup saved on this device. Download it to share or back it up.';
    })); save.id = 'template-save';
    const load = button('Use selected exercise', () => void perform(load, async () => {
        const state = host.view(); if (!state || state.role !== 'instructor') throw new Error('Open the instructor desk first.');
        const template = selected();
        if (!confirm(`Replace current traffic with ${template.name}? The saved setup opens paused at 00:00. Current progress will be replaced.`)) return;
        const exerciseId = state.exerciseId, stamp = host.generation(), current = () => stamp === host.generation() && exerciseId === host.view()?.exerciseId;
        if (state.running) await host.command('clock', { action: 'pause' }, undefined, exerciseId);
        if (!current()) throw new Error('The exercise changed. Select the template again.');
        const bundle = template.bundle;
        if (bundle.mapAsset) { const asset = bundle.mapAsset; const bytes = Uint8Array.from(atob(asset.data), c => c.charCodeAt(0)); const uploaded = await host.request('/api/procedural/map', new Blob([bytes], { type: asset.mime })); if (!current()) throw new Error('The exercise changed during map upload.'); if (uploaded.imageId !== asset.id) throw new Error('Saved map checksum does not match.'); }
        if (!current()) throw new Error('The exercise changed. Select the template again.');
        await host.command('import', { scenario: bundle.scenario, expectedRevision: host.view()?.revision }, undefined, exerciseId); host.changed?.(); status.textContent = `${template.name} loaded with its original starting traffic. Exercise paused.`; host.loaded?.();
    })); load.id = 'template-load';
    const download = button('Download selected', () => { try { const t = selected(); const url = URL.createObjectURL(new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' })); const a = element('a'); a.href = url; a.download = `${t.name.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60) || 'exercise'}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); } catch (e) { status.textContent = e.message; } }); download.id = 'template-download';
    const remove = button('Remove selected', () => { try { const t = selected(); if (!confirm(`Remove ${t.name} from this device? Downloaded files are unaffected.`)) return; const before = templates; templates = templates.filter(x => x.id !== t.id); try { persist(); } catch (e) { templates = before; throw e; } status.textContent = 'Saved exercise removed.'; } catch (e) { status.textContent = e.message; } });
    const fileLabel = element('label', 'Import exercise file'), file = element('input'); file.id = 'template-import'; file.type = 'file'; file.accept = '.json,application/json'; fileLabel.append(file);
    file.addEventListener('change', () => void perform(file, async () => { const chosen = file.files?.[0]; if (!chosen) return; if (chosen.size > 20 * 1024 * 1024) throw new Error('Exercise file must be smaller than 20 MB.'); const t = parseExerciseTemplate(await chosen.text()); const duplicate = templates.find(x => x.id === t.id); if (templates.length >= 50 && !duplicate) throw new Error('Remove one saved exercise before importing.'); if (duplicate && !confirm(`Replace the stored copy of ${t.name}?`)) return; const previous = templates; templates = [...templates.filter(x => x.id !== t.id), t]; try { persist(); } catch (e) { templates = previous; throw e; } select.value = t.id; name.value = t.name; status.textContent = 'Imported into your library. Use selected exercise applies it to the scope.'; file.value = ''; }));
    actions.append(save, load, download, remove); section.append(nameLabel, selectLabel, actions, fileLabel, status); container.prepend(section); read(); update();
    function open() { openRequested = true; section.scrollIntoView({ block: 'start' }); name.focus(); }
    return { open, render() { if (!name.value && host.view()?.elapsed === 0) name.value = host.view().title || ''; if (openRequested) { section.scrollIntoView({ block: 'start' }); openRequested = false; } } };
}
