import { coordinate, project, destination } from './chart-geometry.js';

const kinds = [['local-flying', 'LFA'], ['prohibited', 'Prohibited'], ['restricted', 'Restricted'], ['danger', 'Danger'], ['control-zone', 'Control zone']];
const cross = (a, b, c) => (b.xNm - a.xNm) * (c.yNm - a.yNm) - (b.yNm - a.yNm) * (c.xNm - a.xNm);
const on = (a, b, p) => p.xNm >= Math.min(a.xNm, b.xNm) - 1e-9 && p.xNm <= Math.max(a.xNm, b.xNm) + 1e-9 && p.yNm >= Math.min(a.yNm, b.yNm) - 1e-9 && p.yNm <= Math.max(a.yNm, b.yNm) + 1e-9;
function intersects(a, b, c, d) {
    const x = cross(a, b, c), y = cross(a, b, d), z = cross(c, d, a), w = cross(c, d, b);
    return x * y < 0 && z * w < 0 || Math.abs(x) < 1e-9 && on(a, b, c) || Math.abs(y) < 1e-9 && on(a, b, d) || Math.abs(z) < 1e-9 && on(c, d, a) || Math.abs(w) < 1e-9 && on(c, d, b);
}
export function validateBoundary(points) {
    const ring = points.map(p => ({ xNm: Number(p.xNm), yNm: Number(p.yNm) }));
    if (ring.length > 3 && ring[0].xNm === ring.at(-1).xNm && ring[0].yNm === ring.at(-1).yNm) ring.pop();
    if (ring.length < 3 || ring.length > 200) throw new Error('Use 3–200 boundary points.');
    let area = 0;
    const seen = new Set();
    ring.forEach((p, i) => {
        if (![p.xNm, p.yNm].every(v => Number.isFinite(v) && Math.abs(v) <= 2000)) throw new Error('Boundary points must be within ±2,000 NM.');
        const key = `${p.xNm},${p.yNm}`;
        if (seen.has(key)) throw new Error('Remove repeated boundary points.');
        seen.add(key);
        const q = ring[(i + 1) % ring.length]; area += p.xNm * q.yNm - p.yNm * q.xNm;
        for (let j = i + 2; j < ring.length; j++) {
            if (i === 0 && j === ring.length - 1) continue;
            if (intersects(p, q, ring[j], ring[(j + 1) % ring.length])) throw new Error('Boundary edges must not cross or touch each other.');
        }
    });
    if (Math.abs(area) < 1e-8) throw new Error('Boundary must enclose an area.');
    return ring;
}
export function localToGeographic(point, origin) {
    return destination(origin, Math.atan2(point.xNm, point.yNm) * 180 / Math.PI, Math.hypot(point.xNm, point.yNm));
}
export function parseBoundary(text, mode, origin) {
    if (mode === 'geographic' && !origin) throw new Error('Save the ARP before entering latitude and longitude.');
    let coordinates = String(text).split(/\r?\n/).map(s => s.trim()).filter(Boolean).map((line, i) => {
        const pair = line.split(',').map(s => s.trim());
        if (pair.length !== 2 || pair.some(s => !s)) throw new Error(`Point ${i + 1}: use two coordinates separated by a comma.`);
        return mode === 'geographic' ? { latitude: coordinate(pair[0], 'latitude'), longitude: coordinate(pair[1], 'longitude') } : { xNm: Number(pair[0]), yNm: Number(pair[1]) };
    });
    if (coordinates.length > 3 && JSON.stringify(coordinates[0]) === JSON.stringify(coordinates.at(-1))) coordinates.pop();
    const points = validateBoundary(mode === 'geographic' ? coordinates.map(p => project(p, origin)) : coordinates);
    return { points, ...(origin ? { coordinateOrigin: { ...origin }, geoPoints: mode === 'geographic' ? coordinates : points.map(p => localToGeographic(p, origin)) } : {}) };
}
// A selection is explicit; an empty selection loads only the ARP/station.
export function selectPublishedCatalogue(item, published, routeIds, areaIds) {
    const wantedRoutes = new Set(routeIds), wantedAreas = new Set(areaIds);
    const allAreas = [...item.areas, ...published.areas].map((area, i) => ({ ...area, id: area.id || `${item.id.toLowerCase()}-${i + 1}` }));
    if ([...wantedRoutes].some(id => !published.routes.some(r => r.id === id)) || [...wantedAreas].some(id => !allAreas.some(a => a.id === id))) throw new Error('The selected chart items changed. Select them again.');
    const routes = published.routes.filter(r => wantedRoutes.has(r.id));
    const names = new Set(routes.flatMap(r => r.fixNames));
    const fixes = published.fixes.filter(f => names.has(f.name));
    for (const name of names) if (!fixes.some(f => f.name === name)) throw new Error(`Published coordinate missing for ${name}.`);
    return { ...published, routes, fixes, areas: allAreas.filter(a => wantedAreas.has(a.id)) };
}
function element(tag, text = '', className = '') { const e = document.createElement(tag); e.textContent = text; e.className = className; return e; }
function input(label, name, value = '', tag = 'input') { const wrap = element('label', label); const e = element(tag); e.name = name; e.value = value; wrap.append(e); return [wrap, e]; }
function button(text, action) { const e = element('button', text); e.type = 'button'; e.addEventListener('click', action); return e; }
export function createAirspacePreparation(host) {
    const container = host.container || document.getElementById('tab-build');
    const section = element('section', '', 'airspace-preparation'); section.id = 'airspace-preparation';
    section.append(element('h2', 'Custom airspace'));
    const arpForm = element('form', '', 'airspace-arp-form'); arpForm.id = 'custom-arp-form';
    const arpFields = {};
    const arpGrid = element('div', '', 'airspace-preparation-grid');
    for (const [label, name, placeholder] of [['ARP latitude', 'latitude', '26.25 or 261500N'], ['ARP longitude', 'longitude', '73.05 or 0730300E']]) {
        const [wrap, e] = input(label, name); e.placeholder = placeholder; e.required = true; arpFields[name] = e; arpGrid.append(wrap);
    }
    const [nameWrap, arpName] = input('Aerodrome / LFA name', 'aerodromeName'); arpName.maxLength = 100;
    const [refWrap, reference] = input('Chart reference (optional)', 'reference'); reference.maxLength = 240; reference.placeholder = 'Chart, AIP page or instructor exercise';
    const [dateWrap, date] = input('Edition / date (optional)', 'effectiveInfo'); date.maxLength = 240;
    const sourceDetails = element('details'); sourceDetails.append(element('summary', 'Chart source (optional)'), refWrap, dateWrap);
    const saveArp = element('button', 'Save ARP'); arpForm.append(arpGrid, nameWrap, sourceDetails, saveArp);
    const boundaryForm = element('form', '', 'airspace-boundary-form'); boundaryForm.id = 'custom-boundary-form';
    const [boundaryWrap, boundaryName] = input('Boundary name', 'name'); boundaryName.maxLength = 80; boundaryName.required = true;
    const [kindWrap, kind] = input('Area type', 'kind', '', 'select'); kinds.forEach(([value, label]) => { const o = element('option', label); o.value = value; kind.append(o); });
    const grid = element('div', '', 'airspace-preparation-grid'); grid.append(boundaryWrap, kindWrap);
    const [floorWrap, floor] = input('Lower limit', 'floorLabel', 'GND'); floor.maxLength = 80;
    const [ceilingWrap, ceiling] = input('Upper limit', 'ceilingLabel'); ceiling.maxLength = 80; ceiling.placeholder = 'FL 100'; grid.append(floorWrap, ceilingWrap);
    const [modeWrap, mode] = input('Point format', 'mode', '', 'select'); [['geographic', 'Latitude, longitude'], ['local', 'East NM, north NM']].forEach(([value, label]) => { const o = element('option', label); o.value = value; mode.append(o); });
    const [pointsWrap, pointsInput] = input('Boundary points · one pair per line', 'points', '', 'textarea'); pointsInput.rows = 4; pointsInput.placeholder = '261500N, 0730300E\n261800N, 0731200E\n260900N, 0731500E'; pointsInput.required = true;
    const sketch = element('details', '', 'airspace-sketch'); sketch.id = 'boundary-sketch';
    sketch.append(element('summary', 'Draw boundary with mouse / touch'));
    const tools = element('div', '', 'airspace-preparation-actions');
    let draft = [], closed = false, active = false, drag = -1, lastExercise = '', dirtyARP = false;
    const canvas = element('canvas'); canvas.id = 'boundary-sketch-canvas'; canvas.width = 720; canvas.height = 380; canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Boundary editor. Click to add points. Drag a point to move it. Close boundary when complete.');
    const hint = element('p', 'Click points in order. Drag a point to move it.', 'hint'); const status = element('p', '', 'airspace-preparation-status'); status.id = 'custom-airspace-status'; status.setAttribute('role', 'status');
    const scopeTools = element('div', '', 'boundary-scope-tools'); scopeTools.id = 'boundary-scope-tools'; scopeTools.hidden = true; scopeTools.setAttribute('aria-label', 'Boundary drawing controls');
    const closeRing = () => { try { const wasActive = active; draft = validateBoundary(draft); closed = true; active = false; scopeTools.hidden = true; syncPoints(); drawPreview(); host.scope?.drawChanged?.(); status.textContent = 'Boundary closed. Save boundary to share it.'; if (wasActive) document.querySelector('[data-tab="build"]')?.click(); } catch (e) { status.textContent = e.message; host.message?.(e.message, true); } };
    tools.append(button('Undo point', () => { draft.pop(); closed = false; syncPoints(); drawPreview(); }), button('Close boundary', closeRing), button('Clear points', () => { draft = []; closed = false; syncPoints(); drawPreview(); }));
    if (host.scope) {
        const finish = button('Close boundary', closeRing); finish.id = 'boundary-scope-close';
        scopeTools.append(element('strong', 'DRAW BOUNDARY'), button('Undo', () => { draft.pop(); syncPoints(); drawPreview(); host.scope.drawChanged?.(); }), finish, button('Cancel drawing', () => { active = false; scopeTools.hidden = true; host.scope.drawChanged?.(); document.querySelector('[data-tab="build"]')?.click(); }));
        host.scope.canvas?.parentElement?.append(scopeTools);
        tools.append(button('Draw on radar scope', () => { try { requireOrigin(); if (host.view()?.running) throw new Error('Pause before drawing airspace.'); active = true; closed = false; scopeTools.hidden = false; host.scope.openScope?.(); host.scope.drawChanged?.(); host.message?.('Click boundary points. Use Close boundary or Enter when done.'); } catch (e) { status.textContent = e.message; } }));
    }
    sketch.append(hint, canvas, tools);
    const saveBoundary = element('button', 'Save boundary'); const newBoundary = button('New boundary', () => { boundaryName.value = ''; draft = []; closed = false; delete boundaryForm.dataset.editId; pointsInput.value = ''; drawPreview(); });
    const boundaryActions = element('div', '', 'airspace-preparation-actions'); boundaryActions.append(saveBoundary, newBoundary);
    const list = element('div', '', 'airspace-boundary-list'); list.id = 'custom-boundary-list';
    boundaryForm.append(grid, modeWrap, pointsWrap, sketch, boundaryActions); section.append(arpForm, boundaryForm, status, list); container.prepend(section);
    function requireOrigin() {
        const origin = host.view()?.environment.chartOrigin;
        if (!origin) throw new Error('Save the ARP first.');
        if (dirtyARP) throw new Error('Save your ARP changes before drawing a boundary.');
        return origin;
    }
    function syncPoints() {
        const origin = host.view()?.environment.chartOrigin;
        pointsInput.value = draft.map(p => mode.value === 'geographic' && origin ? localToGeographic(p, origin) : p).map(p => mode.value === 'geographic' && origin ? `${p.latitude.toFixed(7)}, ${p.longitude.toFixed(7)}` : `${p.xNm.toFixed(4)}, ${p.yNm.toFixed(4)}`).join('\n');
    }
    const scale = () => Math.max(10, host.view()?.environment.rangeNm || 60, ...draft.map(p => Math.hypot(p.xNm, p.yNm)));
    function drawDraft(ctx, transform) {
        if (!draft.length) return;
        ctx.save(); ctx.strokeStyle = '#ffc86a'; ctx.fillStyle = '#ffc86a'; ctx.lineWidth = 2; ctx.setLineDash([]); ctx.beginPath();
        draft.forEach((p, i) => { const [x, y] = transform(p.xNm, p.yNm); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        if (closed) ctx.closePath(); ctx.stroke();
        draft.forEach((p, i) => { const [x, y] = transform(p.xNm, p.yNm); ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.font = '12px sans-serif'; ctx.fillText(String(i + 1), x + 9, y - 7); }); ctx.restore();
    }
    function drawPreview() {
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const width = canvas.width, height = canvas.height, factor = Math.min(width, height) * .44 / scale();
        const transform = (x, y) => [width / 2 + x * factor, height / 2 - y * factor];
        ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#0e151b'; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = '#294653'; ctx.lineWidth = 1;
        for (const fraction of [.25, .5, .75, 1]) { ctx.beginPath(); ctx.arc(width / 2, height / 2, scale() * factor * fraction, 0, Math.PI * 2); ctx.stroke(); }
        for (const area of host.view()?.areas || []) { if (!area.points?.length) continue; ctx.strokeStyle = '#b6737c'; ctx.beginPath(); area.points.forEach((p, i) => { const [x, y] = transform(p.xNm, p.yNm); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke(); }
        ctx.fillStyle = '#83c8d5'; ctx.font = '13px sans-serif'; ctx.fillText('ARP +', width / 2 + 7, height / 2 - 7); ctx.fillText(`${scale().toFixed(0)} NM`, 12, height - 14); ctx.fillText('N ↑', 12, 23); drawDraft(ctx, transform);
    }
    function previewPoint(e) { const r = canvas.getBoundingClientRect(), factor = Math.min(canvas.width, canvas.height) * .44 / scale(); return { xNm: ((e.clientX - r.left) * canvas.width / r.width - canvas.width / 2) / factor, yNm: (canvas.height / 2 - (e.clientY - r.top) * canvas.height / r.height) / factor }; }
    canvas.addEventListener('pointerdown', e => { if (e.button !== 0 && e.pointerType !== 'touch') return; try { requireOrigin(); e.preventDefault(); canvas.setPointerCapture?.(e.pointerId); const p = previewPoint(e); const threshold = scale() / 22; drag = draft.findIndex(a => Math.hypot(a.xNm - p.xNm, a.yNm - p.yNm) < threshold); if (drag < 0) { if (draft.length >= 200) throw new Error('Maximum 200 points.'); draft.push(p); drag = draft.length - 1; } closed = false; syncPoints(); drawPreview(); } catch (error) { status.textContent = error.message; } });
    canvas.addEventListener('pointermove', e => { if (drag < 0) return; draft[drag] = previewPoint(e); syncPoints(); drawPreview(); });
    for (const name of ['pointerup', 'pointercancel']) canvas.addEventListener(name, () => { drag = -1; });
    document.addEventListener('keydown', e => { if (!active) return; if (e.key === 'Enter') { e.preventDefault(); closeRing(); } else if (e.key === 'Escape') { active = false; scopeTools.hidden = true; host.scope?.drawChanged?.(); } });
    arpForm.addEventListener('input', () => { dirtyARP = true; });
    mode.addEventListener('change', syncPoints);
    pointsInput.addEventListener('input', () => { try { const parsed = parseBoundary(pointsInput.value, mode.value, host.view()?.environment.chartOrigin); draft = parsed.points; closed = true; drawPreview(); } catch { closed = false; } });
    async function perform(action, control) { if (control.disabled) return; control.disabled = true; try { await action(); } catch (e) { status.textContent = e.message; host.message?.(e.message, true); } finally { control.disabled = false; } }
    arpForm.addEventListener('submit', e => { e.preventDefault(); void perform(async () => {
        const state = host.view(); if (!state || state.role !== 'instructor') throw new Error('Open the instructor desk first.');
        if (state.running) throw new Error('Pause before changing the ARP.');
        const origin = { latitude: coordinate(arpFields.latitude.value, 'latitude'), longitude: coordinate(arpFields.longitude.value, 'longitude') };
        if (Math.abs(origin.latitude) > 85) throw new Error('The exercise ARP supports latitudes from 85°S to 85°N.');
        const changed = JSON.stringify(origin) !== JSON.stringify(state.environment.chartOrigin || null);
        if (changed && state.environment.chartOrigin && !confirm('Change the ARP? Existing traffic and chart points keep their local positions. The aligned image is removed.')) return;
        await host.command('environment', { chartOrigin: origin, aerodromeName: arpName.value.trim() || 'Custom airspace', chartReference: reference.value.trim() || 'Instructor-defined custom coordinates', effectiveInfo: date.value.trim() || 'Instructor-defined training geometry', ...(changed ? { map: { ...state.environment.map, imageId: '' } } : {}) }, undefined, state.exerciseId);
        dirtyARP = false; draft = []; pointsInput.value = ''; closed = false; status.textContent = 'ARP saved. Add one or more boundaries below.'; host.changed?.(); drawPreview();
    }, saveArp); });
    boundaryForm.addEventListener('submit', e => { e.preventDefault(); void perform(async () => {
        const state = host.view(); if (!state || state.role !== 'instructor') throw new Error('Instructor controls only.');
        if (state.running) throw new Error('Pause before editing airspace.');
        const origin = requireOrigin(); const geometry = parseBoundary(pointsInput.value, mode.value, origin);
        if (!boundaryName.value.trim()) throw new Error('Name the boundary.');
        await host.command('area-upsert', { ...(boundaryForm.dataset.editId ? { id: boundaryForm.dataset.editId } : {}), name: boundaryName.value.trim(), kind: kind.value, floorLabel: floor.value.trim(), ceilingLabel: ceiling.value.trim(), source: 'Instructor chart', reference: reference.value.trim(), effectiveInfo: date.value.trim(), notes: 'Custom coordinate boundary. Instructor-defined exercise activation.', active: true, ...geometry }, undefined, state.exerciseId);
        delete boundaryForm.dataset.editId; boundaryName.value = ''; draft = []; pointsInput.value = ''; closed = false; status.textContent = 'Boundary saved on both desks. Add another area or return to the scope.'; host.changed?.(); drawPreview();
    }, saveBoundary); });
    function render() {
        const state = host.view(); if (!state) return;
        if (lastExercise !== state.exerciseId) { lastExercise = state.exerciseId; dirtyARP = false; draft = []; closed = false; active = false; scopeTools.hidden = true; delete boundaryForm.dataset.editId; pointsInput.value = ''; }
        if (!dirtyARP) { arpFields.latitude.value = String(state.environment.chartOrigin?.latitude ?? ''); arpFields.longitude.value = String(state.environment.chartOrigin?.longitude ?? ''); arpName.value = state.environment.aerodromeName || ''; reference.value = state.environment.chartReference || ''; date.value = state.environment.effectiveInfo || ''; }
        list.replaceChildren(...(state.areas || []).map(area => { const row = element('div', '', 'airspace-boundary-row'); row.append(element('strong', `${area.name} · ${kinds.find(k => k[0] === area.kind)?.[1] || area.kind}`)); row.append(button('Edit', () => { boundaryForm.dataset.editId = area.id; boundaryName.value = area.name; kind.value = area.kind; floor.value = area.floorLabel; ceiling.value = area.ceilingLabel; draft = area.points.map(p => ({ ...p })); closed = true; mode.value = state.environment.chartOrigin ? 'geographic' : 'local'; syncPoints(); sketch.open = true; drawPreview(); }), button('Remove', () => void perform(async () => { if (confirm(`Remove ${area.name}?`)) { await host.command('area-delete', { id: area.id }, undefined, state.exerciseId); host.changed?.(); } }, row.querySelector('button:last-child')))); return row; }));
        drawPreview();
    }
    return { render, isSketching: () => active, draw: (ctx, transform) => { if (active) drawDraft(ctx, transform); }, onPointer(e) { if (!active) return false; if (e.button !== 0) return true; const result = host.scope?.screenToPoint?.(e); const p = Array.isArray(result) ? { xNm: result[0], yNm: result[1] } : { xNm: result?.xNm ?? result?.x, yNm: result?.yNm ?? result?.y }; if (p && Number.isFinite(p.xNm) && Number.isFinite(p.yNm) && draft.length < 200) { draft.push({ xNm: p.xNm, yNm: p.yNm }); syncPoints(); drawPreview(); host.scope.drawChanged?.(); } return true; } };
}
