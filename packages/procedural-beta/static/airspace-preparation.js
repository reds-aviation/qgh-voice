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
    async function ask(prompt, confirmLabel = 'Confirm') {
        const exerciseId = host.view()?.exerciseId, stamp = host.generation?.();
        const approved = await (globalThis.ATCSuiteWorkspace?.confirmAction?.(prompt, {confirmLabel}) ?? confirm(prompt));
        return approved && exerciseId === host.view()?.exerciseId && stamp === host.generation?.();
    }
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
    let draft = [], closed = false, active = false, drag = -1, selectedVertex = -1, dragPointer = null, dragCanvas = null, gestureBefore = null, previewDragScale = null, scopeTransform = null, lastExercise = '', dirtyARP = false, drawingError = '';
    const canvas = element('canvas'); canvas.id = 'boundary-sketch-canvas'; canvas.width = 720; canvas.height = 380; canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Boundary editor. Click to add points. Drag a point to move it. Close boundary when complete.');
    const hint = element('p', 'Click points in order. Select or drag a vertex to edit it. Coordinates stay in NM or latitude / longitude.', 'hint'); const status = element('p', '', 'airspace-preparation-status'); status.id = 'custom-airspace-status'; status.setAttribute('role', 'status');
    const drawingStatus = element('p', '', 'boundary-drawing-status'); drawingStatus.id = 'boundary-drawing-status'; drawingStatus.setAttribute('role', 'status');
    canvas.setAttribute('aria-describedby', drawingStatus.id);
    const goARP = button('Set / save ARP', () => { arpForm.scrollIntoView?.({ block: 'start' }); arpFields.latitude.focus?.({ preventScroll: true }); }); goARP.id = 'boundary-go-arp';
    const drawingActions = element('div', '', 'airspace-preparation-actions'); drawingActions.append(goARP);
    const closeButtons = [], draftButtons = [];
    const vertexLabel = element('label', 'Selected vertex'), vertexSelect = element('select'); vertexSelect.id = 'boundary-vertex-select'; vertexLabel.append(vertexSelect);
    const deleteVertex = button('Delete selected vertex', () => { if (selectedVertex < 0) return; draft.splice(selectedVertex, 1); selectedVertex = Math.min(selectedVertex, draft.length - 1); closed = closed && draft.length >= 3; syncPoints(); drawPreview(); host.scope?.drawChanged?.(); }); deleteVertex.id = 'boundary-vertex-delete';
    const scopeDeleteVertex = button('Delete vertex', () => deleteVertex.click()); scopeDeleteVertex.id = 'boundary-scope-delete';
    vertexSelect.addEventListener('change', () => { selectedVertex = Number(vertexSelect.value); refreshVertices(); drawPreview(); host.scope?.drawChanged?.(); });
    const scopeTools = element('div', '', 'boundary-scope-tools'); scopeTools.id = 'boundary-scope-tools'; scopeTools.hidden = true; scopeTools.setAttribute('aria-label', 'Boundary drawing controls');
    const closeRing = () => { try { const wasActive = active; releasePointer(); draft = validateBoundary(draft); closed = true; cancelSketch(); syncPoints(); drawPreview(); host.scope?.drawChanged?.(); status.textContent = 'Boundary closed. Save boundary to share it.'; if (wasActive) document.querySelector('[data-tab="build"]')?.click(); } catch (e) { showDrawingError(e); } };
    const undo = button('Undo point', () => { draft.pop(); selectedVertex = Math.min(selectedVertex, draft.length - 1); closed = false; syncPoints(); drawPreview(); host.scope?.drawChanged?.(); });
    const closePreview = button('Close boundary', closeRing); closeButtons.push(closePreview);
    const clear = button('Clear points', () => { draft = []; selectedVertex = -1; closed = false; syncPoints(); drawPreview(); host.scope?.drawChanged?.(); }); draftButtons.push(undo, clear);
    tools.append(undo, closePreview, clear, deleteVertex);
    let drawScope;
    if (host.scope) {
        const finish = button('Close boundary', closeRing); finish.id = 'boundary-scope-close';
        closeButtons.push(finish);
        const scopeUndo = button('Undo', () => { draft.pop(); selectedVertex = Math.min(selectedVertex, draft.length - 1); closed = false; syncPoints(); drawPreview(); host.scope.drawChanged?.(); }); draftButtons.push(scopeUndo);
        scopeTools.append(element('strong', 'DRAW / EDIT BOUNDARY'), scopeUndo, scopeDeleteVertex, finish, button('Cancel drawing', () => { cancelSketch(); host.scope.drawChanged?.(); document.querySelector('[data-tab="build"]')?.click(); }));
        const scopeStatus = element('span', '', 'boundary-scope-status'); scopeStatus.id = 'boundary-scope-status'; scopeStatus.setAttribute('role', 'status'); scopeTools.append(scopeStatus);
        host.scope.canvas?.parentElement?.append(scopeTools);
        drawScope = button('Draw / edit on radar scope', () => { try { const reason = drawingReason(); if (reason) throw new Error(reason); active = true; scopeTools.hidden = false; updateDrawingStatus(); host.scope.openScope?.(); host.scope.drawChanged?.(); host.message?.('Drawing boundary: click to add points; drag a vertex to edit. Close boundary, then Save boundary.'); } catch (e) { showDrawingError(e); } }); drawScope.id = 'boundary-scope-edit'; drawingActions.prepend(drawScope);
    }
    sketch.append(hint, drawingStatus, drawingActions, canvas, vertexLabel, tools);
    const hasDraft = () => dirtyARP || !!boundaryName.value.trim() || !!pointsInput.value.trim();
    const clearBoundary = () => { cancelSketch(); boundaryName.value = ''; draft = []; selectedVertex = -1; closed = false; delete boundaryForm.dataset.editId; syncPoints(); drawPreview(); };
    const discardDraft = () => { dirtyARP = false; clearBoundary(); };
    const discard = button('Discard unsaved airspace entries', async () => { if (hasDraft() && !await ask('Discard unsaved ARP and boundary entries? Saved airspace is kept.', 'Discard entries')) return; discardDraft(); render(); }); discard.id = 'custom-airspace-discard'; discard.hidden = host.showDiscard === false;
    const saveBoundary = element('button', 'Save boundary'); const newBoundary = button('New boundary', async () => { if ((boundaryName.value.trim() || pointsInput.value.trim()) && !await ask('Discard the unsaved boundary points and start another boundary?', 'Discard boundary')) return; clearBoundary(); render(); });
    const boundaryActions = element('div', '', 'airspace-preparation-actions'); boundaryActions.append(saveBoundary, newBoundary);
    const list = element('div', '', 'airspace-boundary-list'); list.id = 'custom-boundary-list';
    boundaryForm.append(grid, modeWrap, pointsWrap, sketch, boundaryActions); section.append(arpForm, boundaryForm, discard, status, list); container.prepend(section);
    function requireOrigin() {
        const origin = host.view()?.environment.chartOrigin;
        if (!origin) throw new Error('Save the ARP first.');
        if (dirtyARP) throw new Error('Save your ARP changes before drawing a boundary.');
        return origin;
    }
    function drawingReason() {
        const state = host.view();
        if (!state || state.role !== 'instructor') return 'Open the instructor desk to draw a boundary.';
        if (state.running) return 'Pause the exercise before drawing or editing a boundary.';
        if (!state.environment.chartOrigin) return 'Save the ARP first, then click points to draw your boundary.';
        if (dirtyARP) return 'Save your ARP changes before drawing a boundary.';
        return '';
    }
    function updateDrawingStatus() {
        const reason = drawingReason(), count = `${draft.length} ${draft.length === 1 ? 'point' : 'points'}`;
        const progress = closed ? `${count} · Boundary closed. Save boundary to apply it to the exercise.` : `${count} · Click to add points; drag a vertex to move it. ${draft.length < 3 ? 'Add at least 3 points, then Close boundary.' : 'Close boundary, then Save boundary.'}`;
        drawingStatus.textContent = drawingError || reason || progress;
        drawingStatus.dataset.ready = String(!reason);
        canvas.setAttribute('aria-disabled', String(!!reason));
        canvas.style.cursor = reason ? 'not-allowed' : 'crosshair';
        goARP.hidden = !!host.view()?.environment.chartOrigin && !dirtyARP;
        if (drawScope) drawScope.disabled = !!reason;
        for (const control of closeButtons) control.disabled = !!reason || draft.length < 3 || closed;
        for (const control of draftButtons) control.disabled = !!reason || !draft.length;
        deleteVertex.disabled = !!reason || selectedVertex < 0 || selectedVertex >= draft.length;
        scopeDeleteVertex.disabled = deleteVertex.disabled;
        const scopeStatus = scopeTools.querySelector('#boundary-scope-status'); if (scopeStatus) scopeStatus.textContent = progress;
    }
    function showDrawingError(error) { drawingError = error.message; status.textContent = error.message; drawingStatus.textContent = error.message; host.message?.(error.message, true); }
    function syncPoints() {
        drawingError = '';
        const origin = host.view()?.environment.chartOrigin;
        pointsInput.value = draft.map(p => mode.value === 'geographic' && origin ? localToGeographic(p, origin) : p).map(p => mode.value === 'geographic' && origin ? `${p.latitude.toFixed(7)}, ${p.longitude.toFixed(7)}` : `${p.xNm.toFixed(4)}, ${p.yNm.toFixed(4)}`).join('\n');
        refreshVertices();
        updateDrawingStatus();
    }
    function refreshVertices() { vertexSelect.replaceChildren(new Option('Choose vertex…', '-1'), ...draft.map((p, i) => new Option(`${i + 1} · ${p.xNm.toFixed(2)} E / ${p.yNm.toFixed(2)} N NM`, String(i)))); vertexSelect.value = String(selectedVertex); deleteVertex.disabled = selectedVertex < 0 || selectedVertex >= draft.length; scopeDeleteVertex.disabled = deleteVertex.disabled; }
    const scale = () => previewDragScale ?? Math.max(10, host.view()?.environment.rangeNm || 60, ...draft.map(p => Math.hypot(p.xNm, p.yNm)));
    function drawDraft(ctx, transform, pixelScale = 1) {
        if (!draft.length) return;
        ctx.save(); ctx.strokeStyle = '#ffc86a'; ctx.fillStyle = '#ffc86a'; ctx.lineWidth = 2 * pixelScale; ctx.setLineDash([]); ctx.beginPath();
        draft.forEach((p, i) => { const [x, y] = transform(p.xNm, p.yNm); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        if (closed) ctx.closePath(); ctx.stroke();
        draft.forEach((p, i) => { const [x, y] = transform(p.xNm, p.yNm); ctx.fillStyle = i === selectedVertex ? '#9bf0e7' : '#ffc86a'; ctx.beginPath(); ctx.arc(x, y, (i === selectedVertex ? 8 : 5) * pixelScale, 0, Math.PI * 2); ctx.fill(); ctx.font = `${12 * pixelScale}px sans-serif`; ctx.fillText(String(i + 1), x + 9 * pixelScale, y - 7 * pixelScale); }); ctx.restore();
    }
    function drawPreview() {
        updateDrawingStatus();
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const width = canvas.width, height = canvas.height, factor = Math.min(width, height) * .44 / scale(), pixelScale = width / (canvas.getBoundingClientRect().width || width);
        const transform = (x, y) => [width / 2 + x * factor, height / 2 - y * factor];
        ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#0e151b'; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = '#294653'; ctx.lineWidth = 1;
        for (const fraction of [.25, .5, .75, 1]) { ctx.beginPath(); ctx.arc(width / 2, height / 2, scale() * factor * fraction, 0, Math.PI * 2); ctx.stroke(); }
        for (const area of host.view()?.areas || []) { if (!area.points?.length) continue; ctx.strokeStyle = '#b6737c'; ctx.beginPath(); area.points.forEach((p, i) => { const [x, y] = transform(p.xNm, p.yNm); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke(); }
        ctx.fillStyle = '#83c8d5'; ctx.font = `${13 * pixelScale}px sans-serif`; ctx.fillText('ARP +', width / 2 + 7 * pixelScale, height / 2 - 7 * pixelScale); ctx.fillText(`${scale().toFixed(0)} NM`, 12 * pixelScale, height - 14 * pixelScale); ctx.fillText('N ↑', 12 * pixelScale, 23 * pixelScale); drawDraft(ctx, transform, pixelScale);
    }
    function previewPoint(e) { const r = canvas.getBoundingClientRect(), factor = Math.min(canvas.width, canvas.height) * .44 / scale(); return { xNm: ((e.clientX - r.left) * canvas.width / r.width - canvas.width / 2) / factor, yNm: (canvas.height / 2 - (e.clientY - r.top) * canvas.height / r.height) / factor }; }
    function releasePointer(commit = true) { const surface = dragCanvas, id = dragPointer, before = gestureBefore; gestureBefore = null; drag = -1; dragPointer = null; dragCanvas = null; previewDragScale = null; if (!commit && before) { draft = before.points; closed = before.closed; selectedVertex = before.selectedVertex; syncPoints(); } if (surface?.hasPointerCapture?.(id)) surface.releasePointerCapture?.(id); }
    function cancelSketch() { active = false; scopeTools.hidden = true; releasePointer(false); updateDrawingStatus(); }
    function screenHit(e, surface, transform) { if (!transform) return -1; const r = surface.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, radius = e.pointerType === 'touch' ? 26 : 15; let nearest = -1, distance = radius; draft.forEach((p, i) => { const [px, py] = transform(p.xNm, p.yNm); const d = Math.hypot(px - x, py - y); if (d < distance) { nearest = i; distance = d; } }); return nearest; }
    function beginPointer(e, surface, point, transform) {
        if (e.isPrimary === false || e.button !== 0 && e.pointerType !== 'touch') return false;
        if (dragPointer !== null) return true;
        const reason = drawingReason(); if (reason) throw new Error(reason);
        if (!point || ![point.xNm, point.yNm].every(v => Number.isFinite(v) && Math.abs(v) <= 2000)) throw new Error('Boundary point must be within ±2,000 NM.');
        e.preventDefault(); const hit = screenHit(e, surface, transform);
        if (hit < 0 && draft.length >= 200) throw new Error('Maximum 200 points.');
        gestureBefore = { points: draft.map(p => ({ ...p })), closed, selectedVertex }; drag = hit;
        if (drag < 0) { draft.push(point); drag = draft.length - 1; closed = false; }
        selectedVertex = drag; dragPointer = e.pointerId; dragCanvas = surface; surface.focus?.({ preventScroll: true }); surface.setPointerCapture?.(e.pointerId); syncPoints(); drawPreview(); host.scope?.drawChanged?.(); return true;
    }
    function movePointer(e, surface, point) { if (dragCanvas !== surface || dragPointer !== e.pointerId || drag < 0) return false; e.preventDefault(); if (point && [point.xNm, point.yNm].every(v => Number.isFinite(v) && Math.abs(v) <= 2000)) { draft[drag] = point; syncPoints(); drawPreview(); host.scope?.drawChanged?.(); } return true; }
    function finishPointer(e, commit = true) { if (dragPointer !== e.pointerId) return false; releasePointer(commit); drawPreview(); host.scope?.drawChanged?.(); return true; }
    const previewTransform = () => { const r = canvas.getBoundingClientRect(), factor = Math.min(canvas.width, canvas.height) * .44 / scale(); return (x, y) => [(canvas.width / 2 + x * factor) * r.width / canvas.width, (canvas.height / 2 - y * factor) * r.height / canvas.height]; };
    canvas.addEventListener('pointerdown', e => { try { if (dragPointer !== null) return; previewDragScale = scale(); if (!beginPointer(e, canvas, previewPoint(e), previewTransform())) previewDragScale = null; } catch (error) { releasePointer(false); showDrawingError(error); } });
    canvas.addEventListener('pointermove', e => movePointer(e, canvas, previewPoint(e)));
    canvas.addEventListener('pointerup', e => finishPointer(e));
    for (const event of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(event, e => finishPointer(e, false));
    document.addEventListener('keydown', e => { if ((!active && e.target !== canvas) || e.target?.closest?.('input,textarea,select,button')) return; if (e.key === 'Enter') { e.preventDefault(); if (!closePreview.disabled) closeRing(); } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteVertex.click(); } else if (e.key === 'Escape') { cancelSketch(); drawPreview(); host.scope?.drawChanged?.(); } });
    arpForm.addEventListener('input', () => { dirtyARP = true; drawingError = ''; updateDrawingStatus(); });
    mode.addEventListener('change', syncPoints);
    pointsInput.addEventListener('input', () => { try { const parsed = parseBoundary(pointsInput.value, mode.value, host.view()?.environment.chartOrigin); draft = parsed.points; selectedVertex = Math.min(selectedVertex, draft.length - 1); closed = true; refreshVertices(); drawPreview(); host.scope?.drawChanged?.(); } catch { closed = false; } });
    async function perform(action, control) { if (control.disabled) return; control.disabled = true; drawingError = ''; try { await action(); } catch (e) { showDrawingError(e); } finally { control.disabled = false; } }
    arpForm.addEventListener('submit', e => { e.preventDefault(); void perform(async () => {
        const state = host.view(); if (!state || state.role !== 'instructor') throw new Error('Open the instructor desk first.');
        if (state.running) throw new Error('Pause before changing the ARP.');
        const origin = { latitude: coordinate(arpFields.latitude.value, 'latitude'), longitude: coordinate(arpFields.longitude.value, 'longitude') };
        if (Math.abs(origin.latitude) > 85) throw new Error('The exercise ARP supports latitudes from 85°S to 85°N.');
        const changed = JSON.stringify(origin) !== JSON.stringify(state.environment.chartOrigin || null);
        if (changed && (boundaryName.value.trim() || pointsInput.value.trim()) && !await ask('Changing the ARP discards the unsaved boundary entries. Continue?', 'Discard boundary')) return;
        if (changed && state.environment.chartOrigin && !await ask('Change the ARP? Existing traffic and chart points keep their local positions. The aligned image is removed.', 'Change ARP')) return;
        await host.command('environment', { chartOrigin: origin, aerodromeName: arpName.value.trim() || 'Custom airspace', chartReference: reference.value.trim() || 'Instructor-defined custom coordinates', effectiveInfo: date.value.trim() || 'Instructor-defined training geometry', ...(changed ? { map: { ...state.environment.map, imageId: '' } } : {}) }, undefined, state.exerciseId);
        dirtyARP = false; if (changed) clearBoundary(); status.textContent = 'ARP saved. Add one or more boundaries below.'; host.changed?.(); drawPreview();
    }, saveArp); });
    boundaryForm.addEventListener('submit', e => { e.preventDefault(); void perform(async () => {
        const state = host.view(); if (!state || state.role !== 'instructor') throw new Error('Instructor controls only.');
        if (state.running) throw new Error('Pause before editing airspace.');
        const origin = requireOrigin(); const geometry = parseBoundary(pointsInput.value, mode.value, origin);
        if (!boundaryName.value.trim()) throw new Error('Name the boundary.');
        await host.command('area-upsert', { ...(boundaryForm.dataset.editId ? { id: boundaryForm.dataset.editId } : {}), name: boundaryName.value.trim(), kind: kind.value, floorLabel: floor.value.trim(), ceilingLabel: ceiling.value.trim(), source: 'Instructor chart', reference: reference.value.trim(), effectiveInfo: date.value.trim(), notes: 'Custom coordinate boundary. Instructor-defined exercise activation.', active: true, ...geometry }, undefined, state.exerciseId);
        cancelSketch(); delete boundaryForm.dataset.editId; boundaryName.value = ''; draft = []; selectedVertex = -1; syncPoints(); closed = false; status.textContent = 'Boundary saved on both desks. Add another area or return to the scope.'; host.changed?.(); drawPreview();
    }, saveBoundary); });
    function render() {
        const state = host.view(); if (!state) return;
        if (state.running) cancelSketch();
        if (lastExercise !== state.exerciseId || state.role !== 'instructor') { lastExercise = state.exerciseId; discardDraft(); }
        if (!dirtyARP) { arpFields.latitude.value = String(state.environment.chartOrigin?.latitude ?? ''); arpFields.longitude.value = String(state.environment.chartOrigin?.longitude ?? ''); arpName.value = state.environment.aerodromeName || ''; reference.value = state.environment.chartReference || ''; date.value = state.environment.effectiveInfo || ''; }
        list.replaceChildren(...(state.areas || []).map(area => { const row = element('div', '', 'airspace-boundary-row'); row.append(element('strong', `${area.name} · ${kinds.find(k => k[0] === area.kind)?.[1] || area.kind}`)); row.append(button('Edit', () => { cancelSketch(); boundaryForm.dataset.editId = area.id; boundaryName.value = area.name; kind.value = area.kind; floor.value = area.floorLabel; ceiling.value = area.ceilingLabel; draft = area.points.map(p => ({ ...p })); selectedVertex = -1; closed = true; mode.value = state.environment.chartOrigin ? 'geographic' : 'local'; syncPoints(); sketch.open = true; drawPreview(); }), button('Remove', () => void perform(async () => { if (await ask(`Remove ${area.name}?`, 'Remove boundary')) { await host.command('area-delete', { id: area.id }, undefined, state.exerciseId); host.changed?.(); } }, row.querySelector('button:last-child')))); return row; }));
        drawPreview();
    }
    function scopePoint(e) { const p = host.scope?.screenToPoint?.(e); return Array.isArray(p) ? { xNm: p[0], yNm: p[1] } : { xNm: p?.xNm ?? p?.x, yNm: p?.yNm ?? p?.y }; }
    return { render, hasDraft, discardDraft, cancelSketch, isSketching: () => active, draw: (ctx, transform) => { scopeTransform = transform; if (active) drawDraft(ctx, transform); }, onPointer(e) { if (!active) return false; try { beginPointer(e, host.scope.canvas, scopePoint(e), scopeTransform); } catch (error) { releasePointer(false); showDrawingError(error); } return true; }, onPointerMove(e) { return movePointer(e, host.scope?.canvas, scopePoint(e)); }, onPointerUp: e => finishPointer(e), onPointerCancel: e => finishPointer(e, false) };
}
