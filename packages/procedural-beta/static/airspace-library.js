import { prepareExerciseTemplate } from './scenario-library.js';
import { CHART_ENVIRONMENT_KEYS, chartEnvironment, validateRouteChartMetadata } from './route-chart.js';

const storageKey = 'ats-simbox-airspaces-v1';
const maximumBytes = 20 * 1024 * 1024;
export const AIRSPACE_ENVIRONMENT_KEYS = CHART_ENVIRONMENT_KEYS;
export const filterChartEnvironment = chartEnvironment;
const routeKeys = ['id', 'name', 'kind', 'fixIds', 'active', 'availableFrom', 'availableUntil',
    'minAltitudeFt', 'maxAltitudeFt', 'source', 'reference', 'levelLimits', 'effectiveInfo',
    'chartDirection', 'coordinateOrigin', 'geoPoints', 'publishedLimitsHeading', 'publishedSegments',
    'limitsVaryBySegment', 'trackDistance', 'lateralLimits', 'oddLevels', 'evenLevels', 'notes', 'designator'];
const segmentKeys = ['sourceSequence', 'from', 'to', 'fromPublishedCoordinates', 'toPublishedCoordinates',
    'levelLimits', 'publishedLimitsHeading', 'trackDistance', 'lateralLimits', 'oddLevels', 'evenLevels',
    'source', 'reference', 'effectiveInfo', 'sha256'];
const areaKeys = ['id', 'name', 'kind', 'points', 'coordinateOrigin', 'geoPoints', 'floorLabel',
    'ceilingLabel', 'source', 'reference', 'effectiveInfo', 'notes', 'active'];
const pick = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(value || {}, key)).map(key => [key, value[key]]));
const geo = value => value == null ? value : pick(value, ['latitude', 'longitude']);
const local = value => pick(value, ['xNm', 'yNm']);
const bytes = value => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).length;
const clone = value => JSON.parse(JSON.stringify(value));

function validatedEnvironment(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Airspace needs chart settings.');
    const result = chartEnvironment(source);
    // An absent geographic origin means a local chart. Send an explicit null
    // on load so an unrelated published origin cannot survive the merge.
    result.chartOrigin = geo(result.chartOrigin ?? null);
    if ('map' in result) result.map = pick(result.map, ['imageId', 'widthNm', 'originXPct', 'originYPct', 'rotationDeg', 'opacity']);
    const bounds = { rangeNm: [1, 2000], stationXNm: [-2000, 2000], stationYNm: [-2000, 2000],
        magneticVariationDeg: [-180, 180], trainingMagneticVariationDeg: [-180, 180], runwayHeadingDeg: [0, 360],
        runwayLengthNm: [.3, 5], aerodromeElevationFt: [-1500, 15000], thresholdCrossingHeightFt: [0, 1000] };
    for (const [key, [minimum, maximum]] of Object.entries(bounds)) {
        if (key in result && (typeof result[key] !== 'number' || !Number.isFinite(result[key]) || result[key] < minimum || result[key] > maximum)) throw new Error(`Invalid airspace ${key}.`);
    }
    if (result.chartOrigin && (![result.chartOrigin.latitude, result.chartOrigin.longitude].every(Number.isFinite) || Math.abs(result.chartOrigin.latitude) > 85 || Math.abs(result.chartOrigin.longitude) > 180)) throw new Error('Invalid airspace ARP coordinates.');
    if ('drawnARP' in result && typeof result.drawnARP !== 'boolean') throw new Error('Invalid mouse-drawn ARP setting.');
    if (result.drawnARP && result.chartOrigin) throw new Error('A mouse-drawn ARP uses local NM geometry, not geographic coordinates.');
    // Older saved charts predate mouse placement; loading them must not inherit
    // a current exercise's local ARP marker through a partial environment merge.
    if (!('drawnARP' in result)) result.drawnARP = false;
    if ('magneticVariationKnown' in result && typeof result.magneticVariationKnown !== 'boolean') throw new Error('Invalid magnetic reference setting.');
    if ('stationType' in result && !['df', 'vor'].includes(result.stationType)) throw new Error('Invalid station type.');
    for (const [key, limit] of Object.entries({ stationName: 40, stationFrequency: 20, aerodromeName: 100, chartReference: 240, effectiveInfo: 240, briefing: 2000 })) {
        if (key in result && (typeof result[key] !== 'string' || result[key].includes('\0') || bytes(result[key]) > limit)) throw new Error(`Invalid airspace ${key}.`);
    }
    if (result.map) {
        for (const [key, [minimum, maximum]] of Object.entries({ widthNm: [1, 2000], originXPct: [0, 100], originYPct: [0, 100], rotationDeg: [-360, 360], opacity: [0, 1] })) {
            if (key in result.map && (typeof result.map[key] !== 'number' || !Number.isFinite(result.map[key]) || result.map[key] < minimum || result.map[key] > maximum)) throw new Error('Invalid airspace image calibration.');
        }
    }
    return result;
}

// The existing exercise validator checks polygon geometry, capacities, references
// and portable map assets. Its synthetic empty roster is never stored or sent.
export function prepareAirspaceTemplate(bundle, name, id = '', createdAt = '') {
    const source = bundle?.scenario;
    if (bundle?.version !== 1 || !source || source.version !== 1) throw new Error('Choose a version-one airspace export.');
    for (const key of ['fixes', 'routes', 'areas']) if (source[key] != null && !Array.isArray(source[key])) throw new Error(`Airspace ${key} must be a list.`);
    const fixes = (source.fixes || []).map(fix => pick(fix, ['id', 'name', 'xNm', 'yNm']));
    const routes = (source.routes || []).map(route => {
        const result = pick(route, routeKeys);
        if ('coordinateOrigin' in result) result.coordinateOrigin = geo(result.coordinateOrigin);
        if ('geoPoints' in result) result.geoPoints = result.geoPoints?.map(geo);
        if ('publishedSegments' in result) result.publishedSegments = result.publishedSegments?.map(segment => pick(segment, segmentKeys));
        return result;
    });
    const areas = (source.areas || []).map(area => {
        const result = pick(area, areaKeys);
        if ('points' in result) result.points = result.points?.map(local);
        if ('coordinateOrigin' in result) result.coordinateOrigin = geo(result.coordinateOrigin);
        if ('geoPoints' in result) result.geoPoints = result.geoPoints?.map(geo);
        return result;
    });
    const environment = validatedEnvironment(source.environment);
    const scopeDisplay = pick(source.scopeDisplay, ['hiddenRouteIds', 'hiddenAreaIds', 'routesHidden', 'areasHidden']);
    const checked = prepareExerciseTemplate({ version: 1, scenario: { version: 1, elapsed: 0, running: false,
        mode: 'area', environment, aircraft: [], fixes, routes, areas, scopeDisplay }, mapAsset: bundle.mapAsset }, name, id, createdAt);
    const byID = new Map(fixes.map(fix => [fix.id, fix]));
    for (const route of routes) {
        validateRouteChartMetadata(route, fixes);
        if (route.publishedSegments?.length) {
            if (route.publishedSegments.length !== route.fixIds.length - 1) throw new Error('Saved published route legs do not match its fixes.');
            route.publishedSegments.forEach((segment, index) => {
                if (segment.from !== byID.get(route.fixIds[index]).name || segment.to !== byID.get(route.fixIds[index + 1]).name) throw new Error('Saved published route leg order does not match its fixes.');
            });
        }
    }
    for (const key of ['routesHidden', 'areasHidden']) if (key in scopeDisplay && typeof scopeDisplay[key] !== 'boolean') throw new Error('Invalid saved chart visibility.');
    const validated = checked.bundle.scenario;
    const result = { format: 'ats-simbox-airspace', version: 1, id: checked.id, name: checked.name, createdAt: checked.createdAt,
        environment: validated.environment, fixes: validated.fixes, routes: validated.routes, areas: validated.areas, scopeDisplay: validated.scopeDisplay,
        ...(checked.bundle.mapAsset ? { mapAsset: checked.bundle.mapAsset } : {}) };
    if (bytes(JSON.stringify(result, null, 2)) > maximumBytes) throw new Error('Airspace file with its image must be smaller than 20 MB.');
    return result;
}

export function parseAirspaceTemplate(text) {
    if (typeof text !== 'string' || bytes(text) > maximumBytes) throw new Error('Airspace file must be smaller than 20 MB.');
    const data = JSON.parse(text);
    if (data?.format !== 'ats-simbox-airspace' || data.version !== 1) throw new Error('Choose an ATS SIM BOX version-one airspace file, rather than a full exercise file.');
    return prepareAirspaceTemplate({ version: 1, scenario: { version: 1, environment: data.environment,
        fixes: data.fixes, routes: data.routes, areas: data.areas, scopeDisplay: data.scopeDisplay }, mapAsset: data.mapAsset }, data.name, data.id, data.createdAt);
}

function element(tag, text = '', className = '') { const node = document.createElement(tag); node.textContent = text; node.className = className; return node; }
function button(text, id, action) { const node = element('button', text); node.type = 'button'; node.id = id; node.addEventListener('click', action); return node; }

export function createAirspaceLibrary(host) {
    const section = element('section', '', 'scenario-library'); section.id = 'airspace-library';
    section.append(element('h3', 'Saved airspace'), element('p', 'Keep reusable chart settings on this browser and device. Loading airspace keeps aircraft, exercise time and controller records.', 'hint'));
    const nameLabel = element('label', 'Airspace name'), name = element('input'); name.id = 'airspace-name'; name.maxLength = 80; nameLabel.append(name);
    const selectLabel = element('label', 'Load saved airspace'), select = element('select'); select.id = 'airspace-select'; selectLabel.append(select);
    const status = element('p', '', 'scenario-library-status'); status.id = 'airspace-library-status'; status.setAttribute('role', 'status');
    let templates = [], pending = false, nameEdited = false, storageRead = null, unsavedBackup = null, storageReadable = true;
    const state = () => host.view();
    const requireInstructor = () => { if (state()?.role !== 'instructor') throw new Error('Open the instructor desk to manage saved airspace.'); };
    const snapshot = () => ({ generation: host.generation(), exerciseId: state()?.exerciseId, revision: state()?.revision });
    const current = saved => saved.generation === host.generation() && saved.exerciseId === state()?.exerciseId && saved.revision === state()?.revision && state()?.role === 'instructor';
    const ask = (prompt, confirmLabel) => globalThis.ATCSuiteWorkspace?.confirmAction?.(prompt, { confirmLabel }) ?? confirm(prompt);
    function update() {
        const selected = select.value;
        select.replaceChildren(new Option(templates.length ? 'Select airspace…' : 'No airspace saved on this device', ''), ...templates.map(template => new Option(template.name, template.id)));
        if (templates.some(template => template.id === selected)) select.value = selected;
    }
    function read() {
        storageReadable = true;
        try {
            storageRead = localStorage.getItem(storageKey);
            const data = JSON.parse(storageRead || '[]');
            if (!Array.isArray(data) || data.length > 50) throw new Error('Invalid saved airspace list.');
            templates = data.map(template => parseAirspaceTemplate(JSON.stringify(template)));
            if (new Set(templates.map(template => template.id)).size !== templates.length) throw new Error('Duplicated saved airspace identity.');
        } catch { templates = []; storageReadable = false; status.textContent = 'Saved airspace storage could not be read. Keep downloaded JSON backups before repairing device storage.'; }
        update();
    }
    function commit(next) {
        if (localStorage.getItem(storageKey) !== storageRead) { read(); throw new Error('Saved airspace changed in another window. Select it again.'); }
        if (!storageReadable) throw new Error('Airspace was not saved: the existing device library could not be read.');
        const raw = JSON.stringify(next);
        try { localStorage.setItem(storageKey, raw); }
        catch { throw new Error('Airspace was not saved: device storage is full or unavailable.'); }
        templates = next; storageRead = raw; update();
    }
    function selected() { const template = templates.find(item => item.id === select.value); if (!template) throw new Error('Select saved airspace.'); return template; }
    function controls() {
        section.hidden = state()?.role !== 'instructor';
        section.querySelectorAll('button,input,select').forEach(control => control.disabled = pending || section.hidden);
        backup.hidden = !unsavedBackup;
    }
    async function perform(action) {
        if (pending) return;
        pending = true; section.setAttribute('aria-busy', 'true'); controls();
        try { requireInstructor(); await action(); }
        catch (error) { status.textContent = error.message; host.message?.(error.message, true); }
        finally { pending = false; section.removeAttribute('aria-busy'); controls(); }
    }
    function download(template) {
        const url = URL.createObjectURL(new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' }));
        const link = element('a'); link.href = url; link.download = `${template.name.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60) || 'airspace'}.json`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    const save = button('Save airspace', 'airspace-save', () => void perform(async () => {
        if (state().running) throw new Error('Pause before saving airspace.');
        if (host.hasDraft?.()) throw new Error('Apply or discard unsaved chart entries before saving airspace. Traffic entries are kept.');
        const saved = snapshot(), label = name.value.trim(), old = templates.find(template => template.id === select.value);
        const bundle = await (host.export ? host.export() : host.request('/api/procedural/export'));
        if (!current(saved) || bundle.scenario?.exerciseId !== saved.exerciseId || bundle.scenario?.revision !== saved.revision) throw new Error('The exercise changed while saving. Save airspace again.');
        const template = prepareAirspaceTemplate(bundle, label, old?.id, old?.createdAt);
        if (templates.some(item => item.id !== template.id && item.name.toLowerCase() === template.name.toLowerCase())) throw new Error('That airspace name is already used. Choose another name.');
        if (old && !await ask(`Replace saved airspace ${old.name}? Traffic and exercise records are not stored in this library.`, 'Replace saved airspace')) return;
        if (!current(saved) || state().running || host.hasDraft?.()) throw new Error('The exercise or chart entries changed. Save airspace again.');
        if (templates.length >= 50 && !old) throw new Error('Up to 50 airspaces can be saved on this device. Export and delete one first.');
        try { commit([...templates.filter(item => item.id !== template.id), template]); }
        catch (error) { unsavedBackup = template; status.textContent = `${error.message} Files → Download unsaved airspace keeps this snapshot; the saved list is unchanged.`; return; }
        select.value = template.id; unsavedBackup = null; nameEdited = false;
        status.textContent = 'Airspace saved on this browser and device. Export a JSON backup to share or keep it.';
    }));
    const load = button('Load', 'airspace-load', () => void perform(async () => {
        if (state().running) throw new Error('Pause before loading airspace.');
        if (state().terminated) throw new Error('Reopen the exercise before loading airspace.');
        const template = clone(selected()), saved = snapshot();
        if (!await ask(`Load ${template.name} and replace only the current airspace? Aircraft, exercise time, PIN and controller records are kept.${host.hasDraft?.() ? ' Unsaved chart entries will be discarded.' : ''} Referenced routes or fixes must remain unchanged.`, 'Load airspace')) return;
        if (!current(saved) || state().running || state().terminated) throw new Error('The exercise changed. Select the airspace again.');
        if (template.mapAsset) {
            const asset = template.mapAsset, decoded = Uint8Array.from(atob(asset.data), character => character.charCodeAt(0));
            const uploaded = await host.request('/api/procedural/map', new Blob([decoded], { type: asset.mime }));
            if (!current(saved) || state().running || uploaded.imageId !== asset.id) throw new Error('The exercise changed or saved image checksum does not match.');
        }
        await host.command('airspace-replace', { expectedRevision: saved.revision, environment: template.environment,
            fixes: template.fixes, routes: template.routes, areas: template.areas, scopeDisplay: template.scopeDisplay }, undefined, saved.exerciseId);
        if (saved.generation !== host.generation() || saved.exerciseId !== state()?.exerciseId || state()?.role !== 'instructor') return;
        host.changed?.(); status.textContent = `${template.name} loaded. Aircraft, exercise time and controller records are kept.`;
    }));
    const exported = button('Download file', 'airspace-export', () => void perform(async () => download(selected())));
    const backup = button('Download unsaved airspace', 'airspace-backup', () => void perform(async () => { if (unsavedBackup) download(unsavedBackup); })); backup.hidden = true;
    const deleted = button('Delete selected', 'airspace-delete', () => void perform(async () => {
        const template = selected(), saved = snapshot();
        if (!await ask(`Delete ${template.name} from this device? The current exercise and downloaded backups are kept.`, 'Delete saved airspace')) return;
        if (!current(saved)) throw new Error('The exercise changed. Select the airspace again.');
        commit(templates.filter(item => item.id !== template.id)); status.textContent = 'Saved airspace deleted. The current exercise is unchanged.';
    }));
    const fileLabel = element('label', 'Import airspace file'), file = element('input'); file.id = 'airspace-import'; file.type = 'file'; file.accept = '.json,application/json'; fileLabel.append(file);
    file.addEventListener('change', () => void perform(async () => {
        const chosen = file.files?.[0], saved = snapshot(); if (!chosen) return;
        if (chosen.size > maximumBytes) throw new Error('Airspace file must be smaller than 20 MB.');
        const template = parseAirspaceTemplate(await chosen.text());
        if (!current(saved)) throw new Error('The exercise changed while reading the airspace file. Choose it again.');
        const old = templates.find(item => item.id === template.id);
        if (templates.some(item => item.id !== template.id && item.name.toLowerCase() === template.name.toLowerCase())) throw new Error('That airspace name is already used.');
        if (templates.length >= 50 && !old) throw new Error('Delete one saved airspace before importing.');
        if (old && !await ask(`Replace the stored copy of ${old.name}? The current exercise is unchanged.`, 'Replace saved airspace')) return;
        if (!current(saved)) throw new Error('The exercise changed. Choose the airspace file again.');
        commit([...templates.filter(item => item.id !== template.id), template]); select.value = template.id; name.value = template.name; nameEdited = false;
        status.textContent = 'Airspace imported into this device library. Select Load to apply it.'; file.value = '';
    }));
    select.addEventListener('change', () => { const template = templates.find(item => item.id === select.value); if (template) { name.value = template.name; nameEdited = false; } });
    name.addEventListener('input', () => { nameEdited = true; });
    const loadRow = element('div', '', 'scenario-library-actions'); loadRow.append(selectLabel, load);
    const saveRow = element('div', '', 'scenario-library-actions'); saveRow.append(nameLabel, save);
    const files = element('details'); files.id = 'airspace-files'; files.append(element('summary', 'Files'), exported, backup, fileLabel);
    const remove = element('details'); remove.id = 'airspace-remove'; remove.append(element('summary', 'Remove saved airspace'), deleted);
    section.append(loadRow, saveRow, files, remove, status); host.container.prepend(section); read(); controls();
    return { open() { section.scrollIntoView({ block: 'start' }); select.focus({ preventScroll: true }); }, render() {
        if (!pending) {
            try { if (localStorage.getItem(storageKey) !== storageRead) read(); }
            catch { storageReadable = false; status.textContent = 'Saved airspace storage is unavailable. Use a downloaded JSON backup when browser storage is available.'; }
        }
        if (!select.value && !nameEdited) name.value = state()?.environment?.aerodromeName || '';
        controls();
    } };
}
