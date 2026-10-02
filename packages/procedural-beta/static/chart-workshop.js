import { circle, coordinate, destination, project, readPoint } from './chart-geometry.js';
import { mergePublishedNavigation } from './aip-navigation.js';
import { parseARP, alignmentBriefing } from './chart-calibration.js';
import { drawAirspacePreview } from './airspace-preview.js';
import { createAirspacePreparation, selectPublishedCatalogue } from './airspace-preparation.js';
import { createScenarioLibrary } from './scenario-library.js';
const $ = (id) => document.getElementById(id);
const form = (id) => $(id);
const field = (id, name) => form(id).elements.namedItem(name);
const value = (id, name) => field(id, name).value.trim();
const categories = {
    prohibited: { label: 'PROHIBITED', short: 'P', color: '#ff6572', dash: [] },
    restricted: { label: 'RESTRICTED', short: 'R', color: '#dc8b8b', dash: [7, 5] },
    danger: { label: 'DANGER', short: 'D', color: '#ef7873', dash: [2, 5] },
    'local-flying': { label: 'LOCAL FLYING AREA', short: 'LFA', color: '#e77b81', dash: [12, 5] },
    'control-zone': { label: 'CONTROL ZONE', short: 'CTR', color: '#74bdd1', dash: [12, 4, 2, 4] }
};
export function routeWindowOpen(route, elapsed) { return route.active && (route.kind !== 'conditional' || (elapsed >= route.availableFrom && (!route.availableUntil || elapsed < route.availableUntil))); }
export function drawAreas(ctx, areas, projectPoint, labels = true) {
    for (const area of areas) {
        if (area.points.length < 3)
            continue;
        const style = categories[area.kind] || categories['local-flying'];
        const points = area.points.map(p => projectPoint(p.xNm, p.yNm));
        ctx.save();
        ctx.strokeStyle = style.color;
        ctx.fillStyle = style.color;
        ctx.lineWidth = area.active ? 1.1 : .8;
        ctx.globalAlpha = area.active ? .8 : .38;
        // Inactive boundaries keep their type's line pattern as well as its label.
        ctx.setLineDash(style.dash);
        ctx.beginPath();
        points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.closePath();
        ctx.save();
        ctx.globalAlpha = area.active ? .018 : .008;
        ctx.fill();
        ctx.restore();
        ctx.stroke();
        if (area.kind === 'prohibited') {
            ctx.save();
            ctx.clip();
            ctx.globalAlpha = area.active ? .09 : .035;
            ctx.lineWidth = .6;
            ctx.setLineDash([]);
            const left = Math.max(-100, Math.min(...points.map(p => p[0]))), right = Math.min(ctx.canvas.clientWidth + 100, Math.max(...points.map(p => p[0])));
            const top = Math.max(-100, Math.min(...points.map(p => p[1]))), bottom = Math.min(ctx.canvas.clientHeight + 100, Math.max(...points.map(p => p[1]))), height = bottom - top;
            for (let x = left - height; x < right + height; x += 28) {
                ctx.beginPath();
                ctx.moveTo(x, top);
                ctx.lineTo(x + height, bottom);
                ctx.moveTo(x, bottom);
                ctx.lineTo(x + height, top);
                ctx.stroke();
            }
            ctx.restore();
        }
        if (labels) {
            const x = points.reduce((a, p) => a + p[0], 0) / points.length, y = points.reduce((a, p) => a + p[1], 0) / points.length;
            ctx.globalAlpha = 1;
            ctx.font = '11px PlexMono,monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            const lines = [`${style.short} · ${area.name}${area.active ? '' : ' · INACTIVE'}`];
            if (labels !== 'name')
                lines.push(`${area.floorLabel} / ${area.ceilingLabel}`);
            const width = Math.max(...lines.map(s => ctx.measureText(s).width));
            ctx.fillStyle = '#111416eb';
            ctx.fillRect(x - width / 2 - 4, y - 11, width + 8, lines.length * 14 + 2);
            ctx.fillStyle = style.color;
            ctx.globalAlpha = area.active ? 1 : .65;
            lines.forEach((s, i) => ctx.fillText(s, x, y + i * 14));
        }
        ctx.restore();
    }
}
export function createChartWorkshop(context) {
    let catalogue = [], signature = '', formExercise = '';
    let enroute;
    for (const href of ['airspace-preparation.css', 'scenario-library.css']) {
        if (!document.querySelector(`link[href="${href}"]`)) {
            const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; document.head.append(link);
        }
    }
    const preparation = createAirspacePreparation(context);
    const library = createScenarioLibrary(context);
    const legacyBoundary = $('area-form')?.closest('details');
    if (legacyBoundary) legacyBoundary.hidden = true;
    const oldChartDetails = $('chart-form')?.closest('details');
    if (oldChartDetails) oldChartDetails.querySelector('summary').textContent = 'Advanced station / chart settings';
    const selection = document.createElement('div'); selection.id = 'aerodrome-selection'; selection.className = 'aerodrome-selection';
    $('aerodrome-preview').after(selection);
    const dirtyFields = new Set();
    $('arp-file').addEventListener('change', async () => {
        const file = $('arp-file').files?.[0], exercise = context.view()?.exerciseId, generation = context.generation();
        if (!file) return;
        try {
            if (file.size > 65536) throw new Error('ARP records must be smaller than 64 KB.');
            const record = parseARP(await file.text());
            if (exercise !== context.view()?.exerciseId || generation !== context.generation()) throw new Error('The exercise changed. Choose the ARP file again.');
            for (const [name, data] of Object.entries(record)) { field('chart-form', name).value = String(data); dirtyFields.add(name); }
            $('arp-import-status').textContent = `Review ARP ${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)} and its source below, then Save shared chart settings. Nothing applied yet.`;
        } catch (e) { $('arp-import-status').textContent = e.message; context.message(e.message, true); }
        finally { $('arp-file').value = ''; }
    });
    $('arp-template').onclick = () => {
        const base = catalogue.find(a => a.id === value('aerodrome-form', 'aerodrome'));
        const record = base ? { aerodromeName: base.name + (base.icao ? ` (${base.icao})` : ''), ...base.origin, chartReference: base.source, effectiveInfo: base.effectiveInfo } : { aerodromeName: 'REPLACE with aerodrome name', latitude: 'REPLACE with latitude', longitude: 'REPLACE with longitude', chartReference: 'REPLACE with public chart / AIP reference', effectiveInfo: 'REPLACE with edition and effective date' };
        const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
        const a = element('a', 'ARP record'); a.href = url; a.download = base ? `${base.id}-arp.json` : 'arp-template.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        $('arp-import-status').textContent = base ? `Downloaded ${base.name} ARP with AIP source. CSV may use the same five field names as its header.` : 'Replace all template values with your ARP and source. CSV may use the same five field names as its header.';
    };
    form('chart-form').addEventListener('input', e => {
        const input = e.target;
        if (input.name)
            dirtyFields.add(input.name);
    });
    form('chart-form').addEventListener('change', e => {
        const input = e.target;
        if (input.name)
            dirtyFields.add(input.name);
    });
    const run = (action) => async () => {
        try {
            await action();
        }
        catch (e) {
            context.message(e.message, true);
        }
    };
    function bind(id, action) { form(id).addEventListener('submit', e => { e.preventDefault(); const button = form(id).querySelector('button'); button.disabled = true; void run(action)().finally(() => button.disabled = false); }); }
    function element(tag, text) { const e = document.createElement(tag); e.textContent = text; return e; }
    function record(title, body, reference = '') {
        const article = element('article', '');
        article.className = 'record';
        article.append(element('strong', title), element('div', body));
        if (reference) {
            try {
                const url = new URL(reference);
                if (url.protocol === 'https:') {
                    const a = element('a', 'Published chart reference ↗');
                    a.href = url.href;
                    a.target = '_blank';
                    a.rel = 'noopener';
                    article.append(a);
                }
                else
                    article.append(element('small', reference));
            }
            catch {
                article.append(element('small', reference));
            }
        }
        return article;
    }
    function button(label, action) { const b = element('button', label); b.type = 'button'; b.onclick = run(action); return b; }
    function setFields(id, data, names) {
        for (const name of names)
            field(id, name).value = String(data[name] ?? '');
    }
    function editArea(area) {
        setFields('area-form', area, ['name', 'kind', 'floorLabel', 'ceilingLabel', 'source', 'reference', 'effectiveInfo', 'notes']);
        field('area-form', 'active').checked = area.active;
        field('area-form', 'shape').value = 'polygon';
        field('area-form', 'mode').value = 'local';
        field('area-form', 'points').value = area.points.map(p => `${p.xNm}, ${p.yNm}`).join('\n');
        form('area-form').dataset.editId = area.id;
        form('area-form').dataset.exerciseId = context.view()?.exerciseId;
        $('area-radius-label').hidden = true;
        form('area-form').scrollIntoView({ block: 'nearest' });
    }
    function rows(input, columns) {
        const result = input.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map((line, i) => {
            const cells = line.split(',').map(s => s.trim());
            if (cells.length !== columns || cells.some(s => !s))
                throw new Error(`Line ${i + 1}: enter ${columns} comma-separated values.`);
            return cells;
        });
        if (!result.length)
            throw new Error('Enter at least one line.');
        return result;
    }
    bind('chart-form', async () => {
        const payload = {}, names = [...dirtyFields], snapshot = new Map(names.map(name => [name, field('chart-form', name).type === 'checkbox' ? String(field('chart-form', name).checked) : value('chart-form', name)]));
        for (const key of ['aerodromeName', 'stationName', 'stationType', 'stationFrequency', 'chartReference', 'effectiveInfo', 'briefing'])
            if (dirtyFields.has(key))
                payload[key] = value('chart-form', key);
        if (dirtyFields.has('magneticVariationKnown'))
            payload.magneticVariationKnown = field('chart-form', 'magneticVariationKnown').checked;
        for (const key of ['stationXNm', 'stationYNm', 'magneticVariationDeg'])
            if (dirtyFields.has(key))
                payload[key] = Number(value('chart-form', key));
        if (dirtyFields.has('latitude') || dirtyFields.has('longitude')) {
            const latitude = value('chart-form', 'latitude'), longitude = value('chart-form', 'longitude');
            if (Boolean(latitude) !== Boolean(longitude))
                throw new Error('Enter both origin coordinates.');
            payload.chartOrigin = latitude ? { latitude: coordinate(latitude, 'latitude'), longitude: coordinate(longitude, 'longitude') } : null;
        }
        if (!Object.keys(payload).length) {
            context.message('No chart changes to save.');
            return;
        }
        const oldOrigin = context.view()?.environment.chartOrigin;
        if (payload.chartOrigin !== undefined && JSON.stringify(payload.chartOrigin) !== JSON.stringify(oldOrigin || null)) {
            if (context.view()?.running) throw new Error('Pause before changing the ARP.');
            if (!value('chart-form', 'chartReference') || !value('chart-form', 'effectiveInfo')) throw new Error('Enter the ARP source reference and edition / effective date.');
            if (oldOrigin && !confirm('Change the ARP? Existing traffic, routes, boundaries and station offsets keep their local positions; they are NOT reprojected. The current image will be removed. Reload the published aerodrome to restore its sourced geography, or enter your custom coordinates after this change.')) return;
            payload.map = { ...context.view().environment.map, imageId: '' };
            payload.briefing = alignmentBriefing(payload.briefing ?? context.view().environment.briefing, 'ARP changed; any previous image alignment is invalid. Calibrate a new image for this origin.');
        }
        await context.command('environment', payload);
        for (const name of names) {
            const input = field('chart-form', name), current = input.type === 'checkbox' ? String(input.checked) : value('chart-form', name);
            if (current === snapshot.get(name))
                dirtyFields.delete(name);
        }
        context.message('Chart reference and briefing shared with both desks.');
        $('arp-import-status').textContent = 'ARP and chart settings saved and shared with both desks.';
    });
    bind('chart-fixes-form', async () => {
        const state = context.view();
        if (!state)
            return;
        const exerciseId = state.exerciseId;
        const fixes = rows(value('chart-fixes-form', 'rows'), 3).map(([name, a, b]) => ({ name: name.toUpperCase(), ...readPoint(a, b, value('chart-fixes-form', 'mode'), state.environment.chartOrigin) }));
        if (fixes.some(f => f.name.length > 20) || new Set(fixes.map(f => f.name)).size !== fixes.length)
            throw new Error('Fix names must be unique and no longer than 20 characters.');
        const existing = new Map(state.fixes.map(f => [f.name.toUpperCase(), f.id]));
        if (state.fixes.length + fixes.filter(f => !existing.has(f.name)).length > 200)
            throw new Error('An exercise supports at most 200 fixes.');
        let saved = 0;
        try {
            for (const fix of fixes) {
                await context.command('fix-upsert', { ...fix, ...(existing.has(fix.name) ? { id: existing.get(fix.name) } : {}) }, undefined, exerciseId);
                saved++;
            }
        }
        catch (e) {
            throw new Error(`${saved} of ${fixes.length} fixes saved. ${e.message}`);
        }
        context.message(`${saved} chart fixes saved. Type their names into the ATS route below.`);
    });
    bind('area-form', async () => {
        const state = context.view();
        if (!state)
            return;
        const vertices = rows(value('area-form', 'points'), 2).map(([a, b]) => readPoint(a, b, value('area-form', 'mode'), state.environment.chartOrigin));
        const shape = value('area-form', 'shape');
        if (shape === 'circle' && vertices.length !== 1)
            throw new Error('A circle needs one centre coordinate pair.');
        const points = shape === 'circle' ? circle(vertices[0], Number(value('area-form', 'radius'))) : vertices;
        const payload = { points, active: field('area-form', 'active').checked };
        for (const key of ['name', 'kind', 'floorLabel', 'ceilingLabel', 'source', 'reference', 'effectiveInfo', 'notes'])
            payload[key] = value('area-form', key);
        if (form('area-form').dataset.editId)
            payload.id = form('area-form').dataset.editId;
        await context.command('area-upsert', payload, undefined, form('area-form').dataset.exerciseId || state.exerciseId);
        delete form('area-form').dataset.editId;
        delete form('area-form').dataset.exerciseId;
        context.message('Airspace boundary updated on both desks.');
    });
    field('area-form', 'shape').addEventListener('change', () => $('area-radius-label').hidden = value('area-form', 'shape') !== 'circle');
    $('area-new').onclick = () => { form('area-form').reset(); delete form('area-form').dataset.editId; $('area-radius-label').hidden = true; };
    function chosenPublished(item, extra) {
        return selectPublishedCatalogue(item, extra,
            [...selection.querySelectorAll('input[data-route-id]:checked')].map(c => c.dataset.routeId),
            [...selection.querySelectorAll('input[data-area-id]:checked')].map(c => c.dataset.areaId));
    }
    const preview = () => {
        const item = catalogue.find(a => a.id === value('aerodrome-form', 'aerodrome')), extra = item && enroute?.aerodromes[item.id];
        $('aerodrome-preview').textContent = item && extra ? 'Choose only the routes and areas needed. Nothing is selected automatically.' : '';
        selection.replaceChildren();
        $('aerodrome-layout').hidden = !item;
        if (item && extra) {
            const count = element('p', ''); count.className = 'aerodrome-selection-count'; count.id = 'aerodrome-selection-count';
            const updatePreview = () => {
                const chosen = chosenPublished(item, extra);
                count.textContent = `${chosen.routes.length} routes · ${chosen.areas.length} areas selected`;
                drawAirspacePreview($('aerodrome-layout-svg'), { ...item, areas: chosen.areas }, { ...chosen, areas: [] });
            };
            const allAreas = [...item.areas, ...extra.areas].map((area, i) => ({ ...area, id: area.id || `${item.id.toLowerCase()}-${i + 1}` }));
            for (const [kind, title, records] of [['route', 'ATS routes', extra.routes], ['area', 'LFA / prohibited / restricted / danger', allAreas]]) {
                const details = element('details', ''), summary = element('summary', `${title} · ${records.length}`); details.append(summary);
                const list = element('div', ''); list.className = 'aerodrome-selection-list';
                for (const record of records) {
                    const label = element('label', ''), checkbox = element('input', ''); checkbox.type = 'checkbox'; checkbox.dataset[kind === 'route' ? 'routeId' : 'areaId'] = record.id;
                    const text = element('span', record.name); text.append(element('small', kind === 'route' ? record.fixNames.join(' → ') : `${record.floorLabel} / ${record.ceilingLabel}`));
                    checkbox.addEventListener('change', updatePreview); label.append(checkbox, text); list.append(label);
                }
                details.append(button('Select all', async () => { list.querySelectorAll('input').forEach(c => c.checked = true); updatePreview(); }), button('Clear selection', async () => { list.querySelectorAll('input').forEach(c => c.checked = false); updatePreview(); }), list); selection.append(details);
            }
            selection.append(count); updatePreview();
        }
        else drawAirspacePreview($('aerodrome-layout-svg'), item, extra);
        const list = $('aerodrome-source-list'); list.replaceChildren();
        if (!item || !extra) return;
        list.append(record(`${item.name} · ARP`, `${item.origin.latitude.toFixed(6)}, ${item.origin.longitude.toFixed(6)} · WGS-84\nDated public AIP sample.`, item.source));
        item.areas.forEach((area, i) => list.append(record(`${i + 1}. ${area.name}`, `${area.floorLabel} / ${area.ceilingLabel}\n${area.notes || ''}`, area.reference || item.source)));
        const routes = element('details', ''); routes.append(element('summary', `${extra.routes.length} real published ATS route sections`));
        for (const route of extra.routes) routes.append(record(route.name, route.fixNames.join(' → '), route.reference));
        list.append(routes);
        for (const chart of extra.charts || []) list.append(record(chart.title, `Official chart · edition effective ${chart.editionEffectiveDate}`, chart.url));
    };
    field('aerodrome-form', 'aerodrome').addEventListener('change', preview);
    bind('aerodrome-form', async () => {
        const item = catalogue.find(a => a.id === value('aerodrome-form', 'aerodrome'));
        if (!item)
            throw new Error('Select an aerodrome.');
        const extra = enroute?.aerodromes[item.id];
        if (!extra)
            throw new Error('Published route and airspace catalogue is unavailable.');
        const chosen = chosenPublished(item, extra);
        if (!confirm(`Load ${item.name} with ${chosen.routes.length} routes and ${chosen.areas.length} areas? Existing custom / assigned navigation and traffic keep their local positions. The image is removed and the exercise pauses.${context.view()?.terminated ? ' This reopens the ended exercise while paused.' : ''}`))
            return;
        const exerciseId = context.view()?.exerciseId, generation = context.generation();
        if (!exerciseId)
            throw new Error('Wait for the exercise to connect.');
        if (context.view()?.running)
            await context.command('clock', { action: 'pause' }, undefined, exerciseId);
        if (context.generation() !== generation || context.view()?.exerciseId !== exerciseId)
            throw new Error('The session changed. Select the chart again.');
        const bundle = await context.request('/api/procedural/export'), scenario = bundle.scenario;
        if (context.generation() !== generation || context.view()?.exerciseId !== exerciseId)
            throw new Error('The session changed. Select the chart again.');
        if (scenario.exerciseId !== exerciseId)
            throw new Error('The exercise changed while preparing the chart. Select it again.');
        const station = item.station, offset = station ? project(station, item.origin) : { xNm: 0, yNm: 0 };
        const areas = chosen.areas.map((area, i) => {
            const geoPoints = area.circle ? Array.from({ length: 72 }, (_, j) => destination(area.circle, j * 5, area.circle.radiusNm)) : area.points || [];
            return { id: area.id, name: area.name, kind: area.kind, points: geoPoints.map(p => project(p, item.origin)), coordinateOrigin: item.origin, geoPoints: geoPoints.map(p => ({ latitude: p.latitude, longitude: p.longitude })), floorLabel: area.floorLabel, ceilingLabel: area.ceilingLabel, source: area.source || 'India AIP', reference: area.reference || item.source, effectiveInfo: area.effectiveInfo || item.effectiveInfo, notes: [area.notes, area.activation].filter(Boolean).join('\n'), active: true };
        });
        const extent = Math.max(60, ...areas.flatMap(a => a.points.map(p => Math.hypot(p.xNm, p.yNm))));
        const navigation = mergePublishedNavigation(scenario, chosen, item.origin);
        scenario.environment = { ...scenario.environment, chartOrigin: item.origin, stationName: station?.name || `${item.id} REF`, stationType: station?.type || 'df', stationFrequency: station?.frequency || '', stationXNm: offset.xNm, stationYNm: offset.yNm, magneticVariationDeg: station?.magneticVariationDeg ?? 0, magneticVariationKnown: station?.magneticVariationDeg != null, trainingMagneticVariationDeg: scenario.environment.trainingMagneticVariationDeg ?? 0, dfHoldSeconds: scenario.environment.dfHoldSeconds || 10, aerodromeName: item.name + (item.icao ? ` (${item.icao})` : ''), chartReference: item.source, effectiveInfo: enroute.effectiveInfo, briefing: `Approximate published LFA / control-zone and P/R/D outlines; selected nearby ATS segments. Exercise activation is instructor-set, not live NOTAM status. ${station ? 'QDM uses the labelled training magnetic reference unless a chart reference is configured.' : 'D/F uses the chart reference point; no VOR configured.'}\nSet runway, QNH, wind, transition altitude, frequencies and coordination instructions before starting.\n${extra.omissions.length} catalogue omissions are listed in the aerodrome preview; use the cited AIP for complete boundaries and routes.`, rangeNm: Math.min(2000, Math.ceil(extent / 10) * 10), map: { ...scenario.environment.map, imageId: '' } };
        scenario.areas = areas;
        scenario.fixes = navigation.fixes;
        scenario.routes = navigation.routes;
        // A different chart must not inherit hidden IDs from the previous base.
        scenario.scopeDisplay = { hiddenRouteIds: [], hiddenAreaIds: [], routesHidden: false, areasHidden: false };
        await context.command('import', { scenario, expectedRevision: scenario.revision }, undefined, exerciseId);
        context.changed();
        context.message(`${item.name}: ${chosen.routes.length} selected routes and ${areas.length} areas shared. Exercise paused.`);
    });
    void Promise.all(['india-airspace.json', 'india-aip-enroute.json'].map(async (path) => {
        const r = await fetch(path);
        if (!r.ok)
            throw new Error('Published aerodrome catalogue is unavailable.');
        return r.json();
    })).then(([data, routes]) => {
        enroute = routes;
        catalogue = Array.isArray(data) ? data : data.aerodromes;
        signature = '';
        const select = $('aerodrome-select');
        select.replaceChildren(new Option('Select published aerodrome…', ''), ...catalogue.map(a => new Option(a.name + (a.icao ? ` · ${a.icao}` : ''), a.id)));
        preview();
    }).catch(e => $('aerodrome-preview').textContent = e.message);
    return {
        isSketching: preparation.isSketching,
        onPointer: preparation.onPointer,
        draw: preparation.draw,
        openLibrary: library.open,
        render() {
            const state = context.view();
            if (!state) {
                signature = '';
                formExercise = '';
                dirtyFields.clear();
                return;
            }
            preparation.render(); library.render();
            const env = state.environment, areas = state.areas || [], next = JSON.stringify([env, areas, state.fixes, state.routes, state.routes.map(r => routeWindowOpen(r, state.elapsed)), state.role, state.exerciseId]);
            if (next === signature)
                return;
            signature = next;
            $('chart-name').textContent = env.aerodromeName || 'Custom airspace';
            $('chart-info').replaceChildren(record(`${env.stationName || 'NAV0'} · ${(env.stationType || 'df').toUpperCase()} ${env.stationFrequency || ''}`, `QNH ${env.qnhHpa} hPa · wind ${env.windDirectionDeg}°T / ${env.windSpeedKt} kt\n${env.magneticVariationKnown === false ? `Training magnetic reference ${env.trainingMagneticVariationDeg ?? 0}°E · exercise assumption` : `Configured magnetic reference ${env.magneticVariationDeg}°E`}\n${env.effectiveInfo || 'Instructor-defined exercise'}\n${env.briefing || 'Instructor briefing not yet entered.'}`, env.chartReference));
            const base = catalogue.find(a => env.aerodromeName === a.name + (a.icao ? ` (${a.icao})` : '') && env.chartOrigin && Math.abs(a.origin.latitude - env.chartOrigin.latitude) < 1e-8 && Math.abs(a.origin.longitude - env.chartOrigin.longitude) < 1e-8);
            const published = base && enroute?.aerodromes[base.id];
            $('enroute-chart-links').replaceChildren(...(published?.charts || []).map(chart => record(chart.title, `AAI ENR 6 · edition effective ${chart.editionEffectiveDate} · PDF opens separately`, chart.url)));
            const list = areas.map(a => record(`${categories[a.kind]?.label || a.kind} · ${a.name}`, `${a.floorLabel} / ${a.ceilingLabel}\n${a.active ? 'ACTIVE IN EXERCISE' : 'INACTIVE IN EXERCISE'} · ${a.source}\n${a.effectiveInfo}\n${a.notes || ''}`, a.reference));
            $('shared-areas').replaceChildren(...(list.length ? list : [element('p', 'No chart areas loaded.')]));
            const publishedRoutes = new Map((published?.routes || []).map(r => [r.id, r]));
            const currentFixes = new Map(state.fixes.map(f => [f.id, f]));
            $('shared-routes').replaceChildren(...state.routes.map(r => {
                const article = record(`${r.name} · ${routeWindowOpen(r, state.elapsed) ? 'WINDOW OPEN' : 'UNAVAILABLE'}`, `${r.fixIds.map((id) => currentFixes.get(id)?.name || id).join(' → ')}\n${r.levelLimits || `${r.minAltitudeFt}–${r.maxAltitudeFt} ft MSL`}\n${r.kind === 'conditional' ? `Elapsed window ${r.availableFrom}–${r.availableUntil || 'unlimited'} sec · ${r.active ? 'enabled' : 'disabled'}\n` : ''}${r.source || 'Instructor exercise'} · ${r.effectiveInfo || ''}`, r.reference);
                const source = publishedRoutes.get(r.id);
                const unchanged = source && source.reference === r.reference && source.fixNames.length === r.fixIds.length && source.fixNames.every((name, i) => {
                    const f = currentFixes.get(r.fixIds[i]), original = published.fixes.find(p => p.name === name);
                    if (!f || !original || f.name !== name)
                        return false;
                    const point = project(original, base.origin);
                    return Math.hypot(f.xNm - point.xNm, f.yNm - point.yNm) < 1e-6;
                });
                if (unchanged && source.publishedSegments?.length) {
                    const detail = element('details', '');
                    detail.append(element('summary', `Published leg limits (${source.publishedSegments.length})`));
                    for (const leg of source.publishedSegments)
                        detail.append(record(`${leg.from} → ${leg.to}`, `${leg.publishedLimitsHeading}\n${leg.levelLimits}\nTrack / distance: ${leg.trackDistance || 'See source'} · lateral limits: ${leg.lateralLimits || 'See source'}\nPublished cruising-level arrows: odd ${leg.oddLevels || '—'} · even ${leg.evenLevels || '—'}`));
                    article.append(detail);
                }
                return article;
            }));
            $('area-list').replaceChildren(...(state.role === 'instructor' ? areas.map(a => {
                const r = record(`${categories[a.kind]?.short} · ${a.name}`, `${a.floorLabel} / ${a.ceilingLabel} · ${a.active ? 'ACTIVE' : 'INACTIVE'}`);
                r.append(button('Edit', async () => editArea(a)), button(a.active ? 'Deactivate' : 'Activate', async () => { await context.command('area-upsert', { ...a, active: !a.active }); }), button('Delete', async () => {
                    if (confirm(`Delete boundary ${a.name}?`))
                        await context.command('area-delete', { id: a.id });
                }));
                return r;
            }) : []));
            if (formExercise !== state.exerciseId) {
                dirtyFields.clear();
                form('area-form').reset();
                delete form('area-form').dataset.editId;
                delete form('area-form').dataset.exerciseId;
                form('chart-fixes-form').reset();
                $('area-radius-label').hidden = true;
                formExercise = state.exerciseId;
            }
            const formValues = { ...env, latitude: env.chartOrigin?.latitude ?? '', longitude: env.chartOrigin?.longitude ?? '' };
            for (const name of ['aerodromeName', 'stationName', 'stationType', 'stationFrequency', 'stationXNm', 'stationYNm', 'magneticVariationDeg', 'chartReference', 'effectiveInfo', 'briefing', 'latitude', 'longitude'])
                if (!dirtyFields.has(name))
                    field('chart-form', name).value = String(formValues[name] ?? '');
            if (!dirtyFields.has('magneticVariationKnown'))
                field('chart-form', 'magneticVariationKnown').checked = env.magneticVariationKnown !== false;
        }
    };
}
