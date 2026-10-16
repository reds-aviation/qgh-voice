/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

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
export function parseRoutePoints(text, mode, origin) {
    if (mode === 'geographic' && !origin) throw new Error('Save the ARP before entering latitude and longitude.');
    const rows = String(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (rows.length < 2 || rows.length > 50) throw new Error('Use 2–50 ordered route points.');
    const names = new Set();
    const fixes = [], geoPoints = [];
    rows.forEach((line, index) => {
        const fields = line.split(',').map(value => value.trim());
        if (fields.length !== 3 || fields.some(value => !value)) throw new Error(`Route point ${index + 1}: enter name, first coordinate, second coordinate.`);
        const name = fields[0].toUpperCase();
        if (name.length > 32 || names.has(name)) throw new Error(`Route point ${index + 1}: use a unique name of up to 32 characters.`);
        names.add(name);
        const geo = mode === 'geographic' ? { latitude: coordinate(fields[1], 'latitude'), longitude: coordinate(fields[2], 'longitude') } : null;
        const point = geo ? project(geo, origin) : { xNm: Number(fields[1]), yNm: Number(fields[2]) };
        if (![point.xNm, point.yNm].every(value => Number.isFinite(value) && Math.abs(value) <= 2000)) throw new Error(`Route point ${index + 1}: coordinates must be within ±2,000 NM.`);
        if (fixes.some(fix => Math.hypot(fix.xNm - point.xNm, fix.yNm - point.yNm) < 1e-8)) throw new Error(`Route point ${index + 1}: use a different position from the other route points.`);
        fixes.push({ name, ...point }); if (origin) geoPoints.push(geo || localToGeographic(point, origin));
    });
    return { fixes, ...(origin ? { coordinateOrigin: { ...origin }, geoPoints } : {}) };
}
export function routeDesignator(value, existingName = '') {
    const name = String(value).trim();
    if (existingName && name === existingName) return name;
    const normalized = name.toUpperCase(), match = normalized.match(/^[A-Z]*(\d{1,3})[A-Z]*$/);
    if (normalized.length > 6 || !match || Number(match[1]) < 1 || Number(match[1]) > 999) throw new Error('Route name: use up to 6 letters / numbers with one number from 1–999, e.g. A1 or UL123.');
    return normalized;
}
export function parseRouteFlightLevels(minimum, maximum) {
    const lower = Number(minimum), upper = Number(maximum);
    if (!String(minimum).trim() || !String(maximum).trim() || ![lower, upper].every(value => Number.isInteger(value) && value >= 0 && value <= 600) || upper < lower) throw new Error('Flight level limits: use whole numbers from 0–600, with the upper limit at or above the lower limit.');
    return { minAltitudeFt: lower * 100, maxAltitudeFt: upper * 100, levelLimits: `FL${lower}/FL${upper}` };
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
function input(label, name, value = '', tag = 'input') { const wrap = element('label', label); const e = element(tag); e.name = name; e.value = value; if (tag === 'select') e.setAttribute('aria-label', label); wrap.append(e); return [wrap, e]; }
function button(text, action) { const e = element('button', text); e.type = 'button'; e.addEventListener('click', action); return e; }
export function createAirspacePreparation(host) {
    async function ask(prompt, confirmLabel = 'Confirm') {
        const exerciseId = host.view()?.exerciseId, stamp = host.generation?.();
        const approved = await (globalThis.ATCSuiteWorkspace?.confirmAction?.(prompt, {confirmLabel}) ?? confirm(prompt));
        return approved && exerciseId === host.view()?.exerciseId && stamp === host.generation?.();
    }
    const container = host.container || document.getElementById('tab-build');
    const section = element('section', '', 'airspace-preparation'); section.id = 'airspace-preparation';
    if (host.showHeading !== false) section.append(element('h2', 'Airspace editor'));
    const methodHint = element('p', '', 'airspace-method-hint'); methodHint.id = 'airspace-method-hint';
    const [featureWrap, feature] = input('Add or edit', 'featureKind', '', 'select'); feature.id = 'airspace-feature-kind';
    for (const [value, label] of [['area', 'Area boundary · LFA / P / R / D / control zone'], ['route', 'ATS route · ordered reporting points']]) { const option = element('option', label); option.value = value; feature.append(option); }
    feature.value = 'area';
    featureWrap.hidden = true;
    const featureChoices = element('div', '', 'airspace-feature-choices'); featureChoices.id = 'airspace-feature-choices'; featureChoices.setAttribute('aria-label', 'Choose what to draw');
    for (const [choice, label] of [...kinds, ['route', 'ATS route']]) {
        const control = button(label, () => void chooseFeature(choice)); control.dataset.feature = choice; control.setAttribute('aria-pressed', String(choice === 'local-flying')); featureChoices.append(control);
    }
    const arpForm = element('form', '', 'airspace-arp-form'); arpForm.id = 'custom-arp-form';
    const arpFields = {};
    const arpGrid = element('div', '', 'airspace-preparation-grid');
    for (const [label, name, placeholder] of [['ARP latitude', 'latitude', '26.25 or 261500N'], ['ARP longitude', 'longitude', '73.05 or 0730300E']]) {
        const [wrap, e] = input(label, name); e.placeholder = placeholder; e.required = true; arpFields[name] = e; arpGrid.append(wrap);
    }
    const [nameWrap, arpName] = input('Aerodrome name', 'aerodromeName'); arpName.maxLength = 100;
    const [refWrap, reference] = input('Chart reference (optional)', 'reference'); reference.maxLength = 240; reference.placeholder = 'Chart, AIP page or instructor exercise';
    const [dateWrap, date] = input('Edition / date (optional)', 'effectiveInfo'); date.maxLength = 240;
    const sourceDetails = element('details'); sourceDetails.append(element('summary', 'Chart source (optional)'), refWrap, dateWrap);
    const saveArp = element('button', 'Save ARP'); arpForm.append(arpGrid, nameWrap, sourceDetails, saveArp);
    const boundaryForm = element('form', '', 'airspace-boundary-form'); boundaryForm.id = 'custom-boundary-form';
    const [boundaryWrap, boundaryName] = input('Boundary name', 'name'); boundaryName.maxLength = 80; boundaryName.required = true;
    const [kindWrap, kind] = input('Area type', 'kind', '', 'select'); kinds.forEach(([value, label]) => { const o = element('option', label); o.value = value; kind.append(o); });
    kindWrap.hidden = true;
    const grid = element('div', '', 'airspace-preparation-grid'); grid.append(boundaryWrap, kindWrap);
    const [floorWrap, floor] = input('Lower limit', 'floorLabel', 'GND'); floor.maxLength = 80;
    const [ceilingWrap, ceiling] = input('Upper limit', 'ceilingLabel'); ceiling.maxLength = 80; ceiling.placeholder = 'FL 100'; grid.append(floorWrap, ceilingWrap);
    const [modeWrap, mode] = input('Point format', 'mode', '', 'select'); [['geographic', 'Latitude, longitude'], ['local', 'East NM, north NM']].forEach(([value, label]) => { const o = element('option', label); o.value = value; mode.append(o); });
    mode.value = 'geographic';
    const [pointsWrap, pointsInput] = input('Boundary points · one pair per line', 'points', '', 'textarea'); pointsInput.rows = 4; pointsInput.placeholder = '261500N, 0730300E\n261800N, 0731200E\n260900N, 0731500E'; pointsInput.required = true;
    const routeForm = element('form', '', 'airspace-route-form'); routeForm.id = 'custom-route-form'; routeForm.hidden = true;
    const [routeNameWrap, routeName] = input('ATS route name · up to 6 letters / numbers', 'name'); routeName.id = 'custom-route-name'; routeName.maxLength = 6; routeName.required = true; routeName.placeholder = 'A1 or UL123';
    const [directionWrap, routeDirection] = input('Route direction', 'chartDirection', '', 'select'); routeDirection.id = 'custom-route-direction';
    const chooseDirection = element('option', 'Choose route direction…'); chooseDirection.value = ''; chooseDirection.disabled = true; routeDirection.append(chooseDirection);
    for (const [value, label] of [['forward', 'Unidirectional · first → last'], ['both', 'Bidirectional · both directions']]) { const option = element('option', label); option.value = value; routeDirection.append(option); } routeDirection.value = 'forward';
    const routeGrid = element('div', '', 'airspace-preparation-grid'); routeGrid.append(routeNameWrap, directionWrap);
    const [minWrap, minAltitude] = input('Minimum flight level', 'minFlightLevel', '0'), [maxWrap, maxAltitude] = input('Maximum flight level', 'maxFlightLevel', '600');
    minAltitude.id = 'custom-route-min-fl'; maxAltitude.id = 'custom-route-max-fl';
    for (const value of [minAltitude, maxAltitude]) { value.type = 'number'; value.min = '0'; value.max = '600'; value.step = '1'; value.required = true; }
    routeGrid.append(minWrap, maxWrap);
    const [levelsWrap, levelLimits] = input('Existing chart label', 'levelLimits'); levelLimits.maxLength = 240; levelsWrap.hidden = true;
    const levelHint = element('p', 'Enter 260 and 460 for FL260/FL460.', 'hint');
    const [routeModeWrap, routeMode] = input('Route point format', 'mode', '', 'select');
    for (const [value, label] of [['geographic', 'Name, latitude, longitude'], ['local', 'Name, east NM, north NM']]) { const option = element('option', label); option.value = value; routeMode.append(option); }
    routeMode.value = 'geographic';
    const [routePointsWrap, routePoints] = input('Ordered route points · one named point per line', 'points', '', 'textarea'); routePoints.rows = 5; routePoints.required = true; routePoints.placeholder = 'ENTRY, 261500N, 0730300E\nEXIT, 261800N, 0731200E';
    const pointNames = element('div', '', 'airspace-route-point-names'); pointNames.id = 'route-drawing-point-names';
    const routeActions = element('div', '', 'airspace-preparation-actions'); const saveRoute = element('button', 'Save route'); saveRoute.id = 'custom-route-save';
    routeActions.append(saveRoute);
    routeForm.append(element('h3', 'Route name and direction'), element('p', 'Unidirectional follows your drawing order. Bidirectional shows arrows both ways.', 'hint'), routeGrid, levelsWrap, levelHint, routeModeWrap, routePointsWrap, pointNames, routeActions);
    const sketch = element('details', '', 'airspace-sketch'); sketch.id = 'boundary-sketch';
    const sketchSummary = element('summary', 'Draw area on the radar scope or preview'); sketch.append(sketchSummary); sketch.open = true;
    const tools = element('div', '', 'airspace-preparation-actions');
    let draft = [], routePointNames = [], routeGeneratedText = '', closed = false, active = false, placingARP = false, placementBusy = false, drag = -1, selectedVertex = -1, dragPointer = null, dragCanvas = null, gestureBefore = null, previewDragScale = null, scopeTransform = null, lastExercise = '', dirtyARP = false, editingOrigin = null, editingRoute = null, drawingError = '', featureKind = 'area', method = 'draw';
    const canvas = element('canvas'); canvas.id = 'boundary-sketch-canvas'; canvas.width = 720; canvas.height = 380; canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Boundary editor. Click to add points. Drag a point to move it. Close boundary when complete.');
    const hint = element('p', 'Click points in order. Select or drag a vertex to edit it. Coordinates stay in NM or latitude / longitude.', 'hint'); const status = element('p', '', 'airspace-preparation-status'); status.id = 'custom-airspace-status'; status.setAttribute('role', 'status');
    const drawingStatus = element('p', '', 'boundary-drawing-status'); drawingStatus.id = 'boundary-drawing-status'; drawingStatus.setAttribute('role', 'status');
    canvas.setAttribute('aria-describedby', drawingStatus.id);
    const goARP = button('Set / save ARP', () => { arpForm.scrollIntoView?.({ block: 'start' }); arpFields.latitude.focus?.({ preventScroll: true }); }); goARP.id = 'boundary-go-arp';
    const drawingActions = element('div', '', 'airspace-preparation-actions'); drawingActions.append(goARP);
    const arpPlacement = element('div', '', 'airspace-arp-placement'); arpPlacement.id = 'drawn-arp-placement';
    const arpPlacementHint = element('p', 'Place the ARP dot with your mouse. No latitude or longitude is needed.', 'hint');
    const placePreviewARP = button('Place ARP on preview', () => startARPPlacement(false)); placePreviewARP.id = 'drawn-arp-preview';
    const placeScopeARP = host.scope ? button('Place ARP on radar scope', () => startARPPlacement(true)) : null;
    if (placeScopeARP) placeScopeARP.id = 'drawn-arp-scope';
    const arpPlacementActions = element('div', '', 'airspace-preparation-actions'); arpPlacementActions.append(placePreviewARP); if (placeScopeARP) arpPlacementActions.append(placeScopeARP);
    arpPlacement.append(arpPlacementHint, arpPlacementActions); arpForm.append(arpPlacement);
    const closeButtons = [], draftButtons = [];
    const vertexLabel = element('label', 'Selected vertex'), vertexSelect = element('select'); vertexSelect.id = 'boundary-vertex-select'; vertexLabel.append(vertexSelect);
    const deleteVertex = button('Delete selected vertex', () => { if (selectedVertex < 0) return; draft.splice(selectedVertex, 1); routePointNames.splice(selectedVertex, 1); selectedVertex = Math.min(selectedVertex, draft.length - 1); closed = closed && draft.length >= (featureKind === 'route' ? 2 : 3); syncPoints(); drawPreview(); host.scope?.drawChanged?.(); }); deleteVertex.id = 'boundary-vertex-delete';
    const scopeDeleteVertex = button('Delete vertex', () => deleteVertex.click()); scopeDeleteVertex.id = 'boundary-scope-delete';
    vertexSelect.addEventListener('change', () => { selectedVertex = Number(vertexSelect.value); refreshVertices(); drawPreview(); host.scope?.drawChanged?.(); });
    const scopeTools = element('div', '', 'boundary-scope-tools'); scopeTools.id = 'boundary-scope-tools'; scopeTools.hidden = true; scopeTools.setAttribute('aria-label', 'Boundary drawing controls');
    const closeRing = () => {
        try {
            const wasActive = active;
            releasePointer();
            if (featureKind === 'route') parseRoutePoints(routePoints.value, routeMode.value, requireOrigin(routeMode.value));
            else draft = validateBoundary(draft);
            closed = true; cancelSketch(); syncPoints(); drawPreview(); host.scope?.drawChanged?.();
            status.textContent = featureKind === 'route' ? 'Route drawn. Enter its name, choose Unidirectional or Bidirectional, then Save route.' : 'Boundary closed. Save boundary to share it.';
            if (wasActive) document.querySelector('[data-tab="build"]')?.click();
            if (featureKind === 'route') {
                routeForm.scrollIntoView?.({ block: 'start' });
                routeName.focus?.({ preventScroll: true });
            }
        } catch (e) { showDrawingError(e); }
    };
    const undo = button('Undo point', () => { draft.pop(); routePointNames.pop(); selectedVertex = Math.min(selectedVertex, draft.length - 1); closed = false; syncPoints(); drawPreview(); host.scope?.drawChanged?.(); });
    const closePreview = button('Close boundary', closeRing); closeButtons.push(closePreview);
    const clear = button('Clear points', () => { draft = []; routePointNames = []; selectedVertex = -1; closed = false; syncPoints(); drawPreview(); host.scope?.drawChanged?.(); }); draftButtons.push(undo, clear);
    tools.append(undo, closePreview, clear, deleteVertex);
    let drawScope;
    if (host.scope) {
        const finish = button('Close boundary', closeRing); finish.id = 'boundary-scope-close';
        closeButtons.push(finish);
        const scopeUndo = button('Undo', () => { draft.pop(); routePointNames.pop(); selectedVertex = Math.min(selectedVertex, draft.length - 1); closed = false; syncPoints(); drawPreview(); host.scope.drawChanged?.(); }); draftButtons.push(scopeUndo);
        scopeTools.append(element('strong', 'DRAW / EDIT BOUNDARY'), scopeUndo, scopeDeleteVertex, finish, button('Cancel drawing', () => { cancelSketch(); host.scope.drawChanged?.(); document.querySelector('[data-tab="build"]')?.click(); }));
        const scopeStatus = element('span', '', 'boundary-scope-status'); scopeStatus.id = 'boundary-scope-status'; scopeStatus.setAttribute('role', 'status'); scopeTools.append(scopeStatus);
        host.scope.canvas?.parentElement?.append(scopeTools);
        drawScope = button('Draw / edit on radar scope', () => { try { const reason = drawingReason(); if (reason) throw new Error(reason); cancelSketch(); active = true; scopeTools.hidden = false; updateDrawingStatus(); host.scope.openScope?.(); host.scope.drawChanged?.(); host.message?.(featureKind === 'route' ? 'Drawing route: click points in order; drag to edit. Finish route, then enter a route name, choose its direction and Save route.' : 'Drawing boundary: click to add points; drag a vertex to edit. Close boundary, then Save boundary.'); } catch (e) { showDrawingError(e); } }); drawScope.id = 'boundary-scope-edit'; drawingActions.prepend(drawScope);
    }
    sketch.append(hint, drawingStatus, drawingActions, canvas, vertexLabel, tools);
    const hasFeatureDraft = () => !!boundaryName.value.trim() || !!pointsInput.value.trim() || !!routeName.value.trim() || !!routePoints.value.trim();
    const hasDraft = () => dirtyARP || hasFeatureDraft();
    const clearBoundary = () => { cancelSketch(); editingOrigin = null; editingRoute = null; boundaryName.value = ''; routeName.value = ''; routeName.maxLength = 6; minAltitude.value = '0'; maxAltitude.value = '600'; minAltitude.step = maxAltitude.step = '1'; levelLimits.value = ''; levelsWrap.hidden = true; pointsInput.value = ''; routePoints.value = ''; draft = []; routePointNames = []; selectedVertex = -1; closed = false; delete boundaryForm.dataset.editId; delete boundaryForm.dataset.active; for (const key of ['editId', 'routeKind', 'availableFrom', 'availableUntil', 'active']) delete routeForm.dataset[key]; if (!['forward', 'both'].includes(routeDirection.value)) routeDirection.value = 'forward'; syncPoints(); drawPreview(); };
    const discardDraft = () => { dirtyARP = false; clearBoundary(); };
    const discard = button('Discard unsaved airspace entries', async () => { if (hasDraft() && !await ask('Discard unsaved ARP and boundary entries? Saved airspace is kept.', 'Discard entries')) return; discardDraft(); render(); }); discard.id = 'custom-airspace-discard'; discard.hidden = host.showDiscard === false;
    const saveBoundary = element('button', 'Save boundary'); const newBoundary = button('+ New area', () => void startNewFeature('area')); newBoundary.id = 'custom-boundary-new';
    const boundaryActions = element('div', '', 'airspace-preparation-actions'); boundaryActions.append(saveBoundary, newBoundary);
    const list = element('div', '', 'airspace-boundary-list'); list.id = 'custom-boundary-list';
    const routeList = element('div', '', 'airspace-route-list'); routeList.id = 'custom-route-list';
    const existingFeatures = element('section', '', 'airspace-existing-features'); existingFeatures.id = 'custom-airspace-features';
    const existingSummary = element('h3', 'Routes and areas · 0'), existingRecords = element('div', '', 'airspace-feature-records');
    const existingHeader = element('div', '', 'airspace-preparation-actions');
    const addRoute = button('+ New route', () => void startNewFeature('route')); addRoute.id = 'airspace-add-route';
    const addArea = button('+ New area', () => void startNewFeature('area')); addArea.id = 'airspace-add-area';
    existingHeader.append(existingSummary,addRoute,addArea); existingRecords.append(routeList, list); existingFeatures.append(existingHeader, existingRecords);
    const newRoute = button('+ New route', () => void startNewFeature('route')); newRoute.id = 'custom-route-new'; routeActions.append(newRoute);
    boundaryForm.append(grid, modeWrap, pointsWrap, boundaryActions);
    boundaryForm.setAttribute('aria-describedby', status.id); routeForm.setAttribute('aria-describedby', status.id);
    const featureForms = element('div', '', 'airspace-feature-forms'); featureForms.append(boundaryForm, routeForm);
    section.append(arpForm, status, methodHint, featureWrap, featureChoices, featureForms, sketch, discard); (host.recordsContainer || section).append(existingFeatures); container.prepend(section);
    function setMethod(value) {
        if (!['draw', 'coordinates'].includes(value)) throw new Error('Choose drawing or coordinate entry.');
        if (method !== value) cancelSketch();
        method = value; section.dataset.method = value;
        methodHint.textContent = value === 'draw' ? '1 · Place the ARP dot. 2 · Draw route or area points. 3 · Set names / limits, then Save.' : '1 · Save the ARP for latitude / longitude. 2 · Choose route or area and enter ordered coordinates. 3 · Set names / limits, then Save.';
        arpGrid.hidden = value === 'draw'; sourceDetails.hidden = value === 'draw'; saveArp.hidden = value === 'draw'; arpPlacement.hidden = value !== 'draw';
        for (const field of Object.values(arpFields)) field.required = value !== 'draw';
        if (value === 'draw' && (mode.value !== 'local' || routeMode.value !== 'local')) { mode.value = 'local'; routeMode.value = 'local'; syncPoints(); }
        sketch.hidden = value !== 'draw'; modeWrap.hidden = value !== 'coordinates'; pointsWrap.hidden = value !== 'coordinates';
        routeModeWrap.hidden = value !== 'coordinates'; routePointsWrap.hidden = value !== 'coordinates'; pointNames.hidden = value !== 'draw';
        boundaryForm.hidden = featureKind !== 'area'; routeForm.hidden = featureKind !== 'route';
        featureChoices.querySelectorAll('button').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.feature === (featureKind === 'route' ? 'route' : kind.value))));
        sketchSummary.textContent = featureKind === 'route' ? 'Draw ATS route points on the radar scope or preview' : 'Draw area on the radar scope or preview';
        hint.textContent = featureKind === 'route' ? 'Click route points in order. Select or drag a point to edit. Finish route, then enter a route name, choose its direction and Save route.' : 'Click boundary points in order. Select or drag a vertex to edit. Close boundary, then Save boundary.';
        for (const control of closeButtons) control.textContent = featureKind === 'route' ? 'Finish route' : 'Close boundary';
        const scopeHeading = scopeTools.querySelector('strong'); if (scopeHeading) scopeHeading.textContent = featureKind === 'route' ? 'DRAW / EDIT ATS ROUTE' : 'DRAW / EDIT BOUNDARY';
        canvas.setAttribute('aria-label', featureKind === 'route' ? 'ATS route editor. Click ordered route points, drag a point to move it, then Finish route.' : 'Boundary editor. Click to add points. Drag a point to move it. Close boundary when complete.');
        updateDrawingStatus();
    }
    async function chooseFeature(choice) {
        const next = choice === 'route' ? 'route' : 'area', areaKind = choice === 'area' ? kind.value : choice;
        if (next !== 'route' && !kinds.some(([value]) => value === areaKind)) return;
        if (next === featureKind && (next === 'route' || kind.value === areaKind)) return;
        if (hasFeatureDraft() && !await ask('Discard unsaved points before choosing another route or area?', 'Discard points')) { feature.value = featureKind; return; }
        clearBoundary(); featureKind = next; feature.value = next; if (next === 'area') kind.value = areaKind; setMethod(method); syncPoints();
    }
    async function startNewFeature(next) {
        if (hasFeatureDraft() && !await ask(`Discard unsaved points and start a new ${next === 'route' ? 'route' : 'area'}?`, 'Discard points')) return;
        clearBoundary(); featureKind = next; feature.value = next; setMethod(method); syncPoints(); sketch.open = true; host.openEditor?.(method);
        const form = next === 'route' ? routeForm : boundaryForm, firstInput = next === 'route' ? routeName : boundaryName;
        form.scrollIntoView?.({ block: 'start' }); firstInput.focus?.({ preventScroll: true });
    }
    feature.addEventListener('change', () => void chooseFeature(feature.value));
    function requireOrigin(pointMode = 'geographic') {
        const origin = host.view()?.environment.chartOrigin || (pointMode === 'local' ? editingOrigin : null);
        if (pointMode === 'geographic' && !origin) throw new Error('Save the ARP first for latitude / longitude.');
        if (dirtyARP) throw new Error('Save your ARP changes before adding a route or area.');
        return origin;
    }
    function drawingReason() {
        const state = host.view();
        if (!state || state.role !== 'instructor') return 'Open the instructor desk to prepare airspace.';
        if (state.terminated) return 'Reopen the exercise before drawing or editing airspace.';
        if (state.running) return 'Pause the exercise before drawing or editing airspace.';
        if (method === 'draw' && !state.environment.drawnARP && !state.environment.chartOrigin) return 'Place the ARP dot first: select Place ARP on preview or radar scope, then click its position.';
        if (method === 'coordinates' && !state.environment.chartOrigin) return 'Save the ARP first for coordinate entry.';
        if (dirtyARP) return method === 'draw' ? 'Place the ARP dot again to apply your name change before drawing.' : 'Save your ARP changes before adding a route or boundary.';
        return '';
    }
    function updateDrawingStatus() {
        host.draftChanged?.();
        const reason = drawingReason(), count = `${draft.length} ${draft.length === 1 ? 'point' : 'points'}`;
        const minimum = featureKind === 'route' ? 2 : 3;
        const progress = featureKind === 'route' ? `${count} · ${closed ? 'Route points finished. Name the route, choose Unidirectional or Bidirectional, and Save route.' : `Click route points in order; drag to move. ${draft.length < minimum ? 'Add at least 2 points, then Finish route.' : 'Finish route, then Save route.'}`}` : closed ? `${count} · Boundary closed. Save boundary to apply it to the exercise.` : `${count} · Click to add points; drag a vertex to move it. ${draft.length < 3 ? 'Add at least 3 points, then Close boundary.' : 'Close boundary, then Save boundary.'}`;
        const placementReason = placementBlockReason(), ready = placingARP ? !placementReason && !placementBusy : !reason;
        const instruction = placingARP ? 'Click the ARP position. The dot sets the range-ring centre and D/F station.' : progress;
        drawingStatus.textContent = drawingError || (placingARP ? placementReason : reason) || instruction;
        drawingStatus.dataset.ready = String(ready);
        canvas.setAttribute('aria-disabled', String(!ready));
        canvas.style.cursor = ready ? 'crosshair' : 'not-allowed';
        goARP.hidden = method === 'draw' || !!host.view()?.environment.chartOrigin && !dirtyARP;
        arpPlacementHint.textContent = host.view()?.environment.drawnARP ? 'ARP placed on the chart. Use either button to move it; saved traffic and chart points stay in place.' : 'Place the ARP dot with your mouse. No latitude or longitude is needed.';
        placePreviewARP.disabled = !!placementReason || placementBusy;
        if (placeScopeARP) placeScopeARP.disabled = !!placementReason || placementBusy;
        if (drawScope) drawScope.disabled = !!reason;
        for (const control of closeButtons) control.disabled = placingARP || !!reason || draft.length < minimum || closed;
        for (const control of draftButtons) control.disabled = placingARP || !!reason || !draft.length;
        deleteVertex.disabled = placingARP || !!reason || selectedVertex < 0 || selectedVertex >= draft.length;
        scopeDeleteVertex.disabled = deleteVertex.disabled;
        for (const child of scopeTools.children) if (child.tagName === 'BUTTON' && !child.textContent.includes('Cancel')) child.hidden = placingARP;
        const heading = scopeTools.querySelector('strong'); if (heading) heading.textContent = placingARP ? 'PLACE ARP' : featureKind === 'route' ? 'DRAW / EDIT ATS ROUTE' : 'DRAW / EDIT BOUNDARY';
        const scopeStatus = scopeTools.querySelector('#boundary-scope-status'); if (scopeStatus) scopeStatus.textContent = instruction;
    }
    function placementBlockReason() {
        const state = host.view();
        if (!state || state.role !== 'instructor') return 'Open the instructor desk to place the ARP.';
        if (state.terminated) return 'Reopen the exercise before placing the ARP.';
        if (state.running) return 'Pause the exercise before placing the ARP.';
        return '';
    }
    function startARPPlacement(onScope) {
        const reason = placementBlockReason(); if (reason) { showDrawingError(new Error(reason)); return; }
        cancelSketch(); placingARP = true; active = onScope; scopeTools.hidden = !onScope; drawingError = ''; sketch.open = true;
        updateDrawingStatus(); drawPreview();
        if (onScope) { host.scope.openScope?.(); host.scope.drawChanged?.(); }
        else canvas.scrollIntoView?.({ block: 'center' });
        host.message?.('Click where the ARP dot belongs. No coordinate entry is needed.');
    }
    async function placeARP(point, onScope) {
        if (placementBusy) return;
        placementBusy = true; updateDrawingStatus();
        try {
            const state = host.view(), exerciseId = state?.exerciseId;
            const reason = placementBlockReason(); if (reason) throw new Error(reason);
            if (!point || ![point.xNm, point.yNm].every(value => Number.isFinite(value) && Math.abs(value) <= 2000)) throw new Error('Place the ARP within ±2,000 NM.');
            if ((state.environment.chartOrigin || state.environment.drawnARP || hasFeatureDraft()) && !await ask('Place the ARP here? Range rings and D/F will use this dot. Traffic and saved chart geometry stay in place. Unsaved route / area points and the geographic ARP reference are cleared.', 'Place ARP')) return;
            await host.command('environment', { drawnARP: true, chartOrigin: null, stationXNm: point.xNm, stationYNm: point.yNm, stationName: 'ARP', stationType: 'df', aerodromeName: arpName.value.trim() || 'Custom airspace', chartReference: 'Instructor-drawn chart', effectiveInfo: 'Instructor-defined local NM geometry' }, undefined, exerciseId);
            dirtyARP = false; clearBoundary(); status.textContent = 'ARP placed. Choose a route or area and draw its points.'; host.changed?.(); drawPreview(); host.scope?.drawChanged?.();
            if (onScope) document.querySelector('[data-tab="build"]')?.click();
        } catch (error) { showDrawingError(error); }
        finally { placementBusy = false; updateDrawingStatus(); }
    }
    function showDrawingError(error) { drawingError = error.message; status.textContent = error.message; drawingStatus.textContent = error.message; host.message?.(error.message, true); }
    function syncPoints() {
        drawingError = '';
        const origin = host.view()?.environment.chartOrigin;
        if (featureKind === 'route') {
            const used = new Set([...(host.view()?.fixes || []).map(fix => fix.name.toUpperCase()), ...routePointNames.map(point => point?.name).filter(Boolean)]);
            draft.forEach((point, index) => { if (!routePointNames[index]) { let suffix = 1; while (used.has(`PT${String(suffix).padStart(2, '0')}`)) suffix++; const name = `PT${String(suffix).padStart(2, '0')}`; used.add(name); routePointNames[index] = { name }; } });
            routePointNames.length = draft.length;
            routePoints.value = draft.map((point, index) => { const p = routeMode.value === 'geographic' && origin ? localToGeographic(point, origin) : point; return `${routePointNames[index].name}, ${routeMode.value === 'geographic' && origin ? `${p.latitude.toFixed(7)}, ${p.longitude.toFixed(7)}` : `${p.xNm.toFixed(4)}, ${p.yNm.toFixed(4)}`}`; }).join('\n');
            routeGeneratedText = routePoints.value;
            renderPointNames();
        } else pointsInput.value = draft.map(p => mode.value === 'geographic' && origin ? localToGeographic(p, origin) : p).map(p => mode.value === 'geographic' && origin ? `${p.latitude.toFixed(7)}, ${p.longitude.toFixed(7)}` : `${p.xNm.toFixed(4)}, ${p.yNm.toFixed(4)}`).join('\n');
        refreshVertices();
        updateDrawingStatus();
    }
    function renderPointNames() {
        const activeInput = document.activeElement, activeIndex = activeInput?.dataset?.pointIndex;
        pointNames.replaceChildren(...draft.map((point, index) => { const [wrap, value] = input(`Point ${index + 1} name · ${point.xNm.toFixed(2)} E / ${point.yNm.toFixed(2)} N NM`, `pointName${index}`, routePointNames[index].name); value.maxLength = 32; value.required = true; value.dataset.pointIndex = String(index); value.addEventListener('input', () => { routePointNames[index].name = value.value.trim().toUpperCase(); const origin = host.view()?.environment.chartOrigin; const rows = draft.map((p, i) => { const geo = routeMode.value === 'geographic' && origin ? localToGeographic(p, origin) : p; return `${routePointNames[i].name}, ${routeMode.value === 'geographic' && origin ? `${geo.latitude.toFixed(7)}, ${geo.longitude.toFixed(7)}` : `${p.xNm.toFixed(4)}, ${p.yNm.toFixed(4)}`}`; }); routePoints.value = rows.join('\n'); routeGeneratedText = routePoints.value; }); wrap.append(element('small', routePointNames[index].id ? 'Existing route point retained' : 'New reporting point')); return wrap; }));
        if (activeIndex !== undefined) pointNames.querySelector(`[data-point-index="${activeIndex}"]`)?.focus?.({ preventScroll: true });
    }
    function refreshVertices() { vertexSelect.replaceChildren(new Option('Choose vertex…', '-1'), ...draft.map((p, i) => new Option(`${i + 1} · ${p.xNm.toFixed(2)} E / ${p.yNm.toFixed(2)} N NM`, String(i)))); vertexSelect.value = String(selectedVertex); deleteVertex.disabled = selectedVertex < 0 || selectedVertex >= draft.length; scopeDeleteVertex.disabled = deleteVertex.disabled; }
    const scale = () => previewDragScale ?? Math.max(10, host.view()?.environment.rangeNm || 60, Math.hypot(host.view()?.environment.stationXNm || 0, host.view()?.environment.stationYNm || 0), ...draft.map(p => Math.hypot(p.xNm, p.yNm)));
    function drawDraft(ctx, transform, pixelScale = 1) {
        if (!draft.length) return;
        ctx.save(); ctx.strokeStyle = '#ffc86a'; ctx.fillStyle = '#ffc86a'; ctx.lineWidth = 2 * pixelScale; ctx.setLineDash([]); ctx.beginPath();
        draft.forEach((p, i) => { const [x, y] = transform(p.xNm, p.yNm); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        if (closed && featureKind === 'area') ctx.closePath(); ctx.stroke();
        draft.forEach((p, i) => { const [x, y] = transform(p.xNm, p.yNm); ctx.fillStyle = i === selectedVertex ? '#9bf0e7' : '#ffc86a'; ctx.beginPath(); ctx.arc(x, y, (i === selectedVertex ? 8 : 5) * pixelScale, 0, Math.PI * 2); ctx.fill(); ctx.font = `${12 * pixelScale}px sans-serif`; ctx.fillText(String(i + 1), x + 9 * pixelScale, y - 7 * pixelScale); }); ctx.restore();
    }
    function drawPreview() {
        updateDrawingStatus();
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const width = canvas.width, height = canvas.height, factor = Math.min(width, height) * .44 / scale(), pixelScale = width / (canvas.getBoundingClientRect().width || width);
        const transform = (x, y) => [width / 2 + x * factor, height / 2 - y * factor];
        ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#0e151b'; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = '#294653'; ctx.lineWidth = 1;
        const environment = host.view()?.environment || {}, [arpX, arpY] = transform(environment.stationXNm || 0, environment.stationYNm || 0);
        for (const fraction of [.25, .5, .75, 1]) { ctx.beginPath(); ctx.arc(arpX, arpY, scale() * factor * fraction, 0, Math.PI * 2); ctx.stroke(); }
        for (const area of host.view()?.areas || []) { if (!area.points?.length) continue; ctx.strokeStyle = '#b6737c'; ctx.beginPath(); area.points.forEach((p, i) => { const [x, y] = transform(p.xNm, p.yNm); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke(); }
        const fixes = new Map((host.view()?.fixes || []).map(fix => [fix.id, fix]));
        for (const route of host.view()?.routes || []) { const points = (route.fixIds || []).map(id => fixes.get(id)).filter(Boolean); if (points.length < 2) continue; ctx.strokeStyle = '#72b8d0'; ctx.beginPath(); points.forEach((point, index) => { const [x, y] = transform(point.xNm, point.yNm); if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); }
        ctx.fillStyle = '#83c8d5'; ctx.font = `${13 * pixelScale}px sans-serif`;
        if (environment.drawnARP || environment.chartOrigin) { ctx.beginPath(); ctx.arc(arpX, arpY, 4 * pixelScale, 0, Math.PI * 2); ctx.fill(); ctx.fillText('ARP', arpX + 7 * pixelScale, arpY - 7 * pixelScale); }
        ctx.fillText(`${scale().toFixed(0)} NM`, 12 * pixelScale, height - 14 * pixelScale); ctx.fillText('N ↑', 12 * pixelScale, 23 * pixelScale); drawDraft(ctx, transform, pixelScale);
    }
    function previewPoint(e) { const r = canvas.getBoundingClientRect(), factor = Math.min(canvas.width, canvas.height) * .44 / scale(); return { xNm: ((e.clientX - r.left) * canvas.width / r.width - canvas.width / 2) / factor, yNm: (canvas.height / 2 - (e.clientY - r.top) * canvas.height / r.height) / factor }; }
    function releasePointer(commit = true) { const surface = dragCanvas, id = dragPointer, before = gestureBefore; gestureBefore = null; drag = -1; dragPointer = null; dragCanvas = null; previewDragScale = null; if (!commit && before) { draft = before.points; routePointNames = before.routePointNames; closed = before.closed; selectedVertex = before.selectedVertex; syncPoints(); } if (surface?.hasPointerCapture?.(id)) surface.releasePointerCapture?.(id); }
    function cancelSketch() { active = false; placingARP = false; scopeTools.hidden = true; releasePointer(false); updateDrawingStatus(); }
    function screenHit(e, surface, transform) { if (!transform) return -1; const r = surface.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, radius = e.pointerType === 'touch' ? 26 : 15; let nearest = -1, distance = radius; draft.forEach((p, i) => { const [px, py] = transform(p.xNm, p.yNm); const d = Math.hypot(px - x, py - y); if (d < distance) { nearest = i; distance = d; } }); return nearest; }
    function beginPointer(e, surface, point, transform) {
        if (e.isPrimary === false || e.button !== 0 && e.pointerType !== 'touch') return false;
        if (dragPointer !== null) return true;
        const reason = drawingReason(); if (reason) throw new Error(reason);
        if (!point || ![point.xNm, point.yNm].every(v => Number.isFinite(v) && Math.abs(v) <= 2000)) throw new Error('Point must be within ±2,000 NM.');
        e.preventDefault(); const hit = screenHit(e, surface, transform);
        if (hit < 0 && draft.length >= (featureKind === 'route' ? 50 : 200)) throw new Error(featureKind === 'route' ? 'Maximum 50 route points.' : 'Maximum 200 boundary points.');
        gestureBefore = { points: draft.map(p => ({ ...p })), routePointNames: routePointNames.map(point => ({ ...point })), closed, selectedVertex }; drag = hit;
        if (drag < 0) { draft.push(point); drag = draft.length - 1; closed = false; }
        selectedVertex = drag; dragPointer = e.pointerId; dragCanvas = surface; surface.focus?.({ preventScroll: true }); surface.setPointerCapture?.(e.pointerId); syncPoints(); drawPreview(); host.scope?.drawChanged?.(); return true;
    }
    function movePointer(e, surface, point) { if (dragCanvas !== surface || dragPointer !== e.pointerId || drag < 0) return false; e.preventDefault(); if (point && [point.xNm, point.yNm].every(v => Number.isFinite(v) && Math.abs(v) <= 2000)) { draft[drag] = point; syncPoints(); drawPreview(); host.scope?.drawChanged?.(); } return true; }
    function finishPointer(e, commit = true) { if (dragPointer !== e.pointerId) return false; releasePointer(commit); drawPreview(); host.scope?.drawChanged?.(); return true; }
    const previewTransform = () => { const r = canvas.getBoundingClientRect(), factor = Math.min(canvas.width, canvas.height) * .44 / scale(); return (x, y) => [(canvas.width / 2 + x * factor) * r.width / canvas.width, (canvas.height / 2 - y * factor) * r.height / canvas.height]; };
    canvas.addEventListener('pointerdown', e => { try { if (dragPointer !== null) return; if (placingARP) { if (e.isPrimary !== false && (e.button === 0 || e.pointerType === 'touch')) { e.preventDefault(); void placeARP(previewPoint(e), false); } return; } previewDragScale = scale(); if (!beginPointer(e, canvas, previewPoint(e), previewTransform())) previewDragScale = null; } catch (error) { releasePointer(false); showDrawingError(error); } });
    canvas.addEventListener('pointermove', e => movePointer(e, canvas, previewPoint(e)));
    canvas.addEventListener('pointerup', e => finishPointer(e));
    for (const event of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(event, e => finishPointer(e, false));
    document.addEventListener('keydown', e => { if ((!active && e.target !== canvas) || e.target?.closest?.('input,textarea,select,button')) return; if (e.key === 'Enter') { e.preventDefault(); if (!closePreview.disabled) closeRing(); } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteVertex.click(); } else if (e.key === 'Escape') { cancelSketch(); drawPreview(); host.scope?.drawChanged?.(); } });
    arpForm.addEventListener('input', () => { dirtyARP = true; drawingError = ''; updateDrawingStatus(); });
    mode.addEventListener('change', syncPoints);
    routeMode.addEventListener('change', syncPoints);
    pointsInput.addEventListener('input', () => { try { const parsed = parseBoundary(pointsInput.value, mode.value, host.view()?.environment.chartOrigin); draft = parsed.points; selectedVertex = Math.min(selectedVertex, draft.length - 1); closed = true; drawingError = ''; pointsInput.removeAttribute('aria-invalid'); refreshVertices(); drawPreview(); host.scope?.drawChanged?.(); } catch (error) { closed = false; pointsInput.setAttribute('aria-invalid', 'true'); showDrawingError(error); } });
    routePoints.addEventListener('input', () => { routeGeneratedText = ''; try { const parsed = parseRoutePoints(routePoints.value, routeMode.value, host.view()?.environment.chartOrigin); const previous = routePointNames; draft = parsed.fixes.map(point => ({ xNm: point.xNm, yNm: point.yNm })); routePointNames = parsed.fixes.map((point, index) => ({ name: point.name, ...(previous[index]?.name === point.name && previous[index].id ? { id: previous[index].id } : {}) })); selectedVertex = Math.min(selectedVertex, draft.length - 1); closed = true; drawingError = ''; routePoints.removeAttribute('aria-invalid'); renderPointNames(); refreshVertices(); drawPreview(); host.scope?.drawChanged?.(); } catch (error) { closed = false; routePoints.setAttribute('aria-invalid', 'true'); showDrawingError(error); } });
    async function perform(action, control) { if (control.disabled) return; control.disabled = true; drawingError = ''; try { await action(); } catch (e) { showDrawingError(e); } finally { control.disabled = false; } }
    arpForm.addEventListener('submit', e => { e.preventDefault(); if (method === 'draw') { startARPPlacement(false); return; } void perform(async () => {
        const state = host.view(); if (!state || state.role !== 'instructor') throw new Error('Open the instructor desk first.');
        if (state.running) throw new Error('Pause before changing the ARP.');
        const origin = { latitude: coordinate(arpFields.latitude.value, 'latitude'), longitude: coordinate(arpFields.longitude.value, 'longitude') };
        if (Math.abs(origin.latitude) > 85) throw new Error('The exercise ARP supports latitudes from 85°S to 85°N.');
        const changed = state.environment.drawnARP === true || JSON.stringify(origin) !== JSON.stringify(state.environment.chartOrigin || null);
        if (changed && hasFeatureDraft() && !await ask('Changing the ARP discards the unsaved route or boundary entries. Continue?', 'Discard points')) return;
        if (changed && (state.environment.chartOrigin || state.environment.drawnARP) && !await ask('Change the ARP? Existing traffic and chart points keep their local positions. The aligned image is removed.', 'Change ARP')) return;
        await host.command('environment', { drawnARP: false, chartOrigin: origin, stationXNm: 0, stationYNm: 0, stationName: 'ARP', aerodromeName: arpName.value.trim() || 'Custom airspace', chartReference: reference.value.trim() || 'Instructor-defined custom coordinates', effectiveInfo: date.value.trim() || 'Instructor-defined training geometry', ...(changed ? { map: { ...state.environment.map, imageId: '' } } : {}) }, undefined, state.exerciseId);
        dirtyARP = false; if (changed) clearBoundary(); status.textContent = 'ARP saved. Add routes or areas below.'; host.changed?.(); drawPreview();
    }, saveArp); });
    boundaryForm.addEventListener('submit', e => { e.preventDefault(); void perform(async () => {
        const state = host.view(); if (!state || state.role !== 'instructor') throw new Error('Instructor controls only.');
        if (state.running) throw new Error('Pause before editing airspace.');
        if (featureKind !== 'area') throw new Error('Select Area boundary before saving a boundary.');
        const origin = requireOrigin(mode.value); const geometry = parseBoundary(pointsInput.value, mode.value, origin);
        const reason = drawingReason(); if (reason) throw new Error(reason);
        if (!boundaryName.value.trim()) throw new Error('Name the boundary.');
        await host.command('area-upsert', { ...(boundaryForm.dataset.editId ? { id: boundaryForm.dataset.editId } : {}), name: boundaryName.value.trim(), kind: kind.value, floorLabel: floor.value.trim(), ceilingLabel: ceiling.value.trim(), source: 'Instructor chart', reference: reference.value.trim(), effectiveInfo: date.value.trim(), notes: 'Custom coordinate boundary. Instructor-defined exercise activation.', active: boundaryForm.dataset.active !== 'false', ...geometry }, undefined, state.exerciseId);
        clearBoundary(); status.textContent = 'Boundary saved on both desks. Add another area or return to the scope.'; host.changed?.(); drawPreview();
    }, saveBoundary); });
    routeForm.addEventListener('submit', event => { event.preventDefault(); void perform(async () => {
        const state = host.view(); if (!state || state.role !== 'instructor') throw new Error('Instructor controls only.');
        if (state.running) throw new Error('Pause before editing an ATS route.');
        if (featureKind !== 'route') throw new Error('Select ATS route before saving a route.');
        const origin = requireOrigin(routeMode.value), geometry = parseRoutePoints(routePoints.value, routeMode.value, origin);
        const reason = drawingReason(); if (reason) throw new Error(reason);
        const name = routeDesignator(routeName.value, editingRoute?.name);
        const unchangedLimits = editingRoute && minAltitude.value === String(editingRoute.minAltitudeFt / 100) && maxAltitude.value === String(editingRoute.maxAltitudeFt / 100);
        const limits = unchangedLimits ? { minAltitudeFt: editingRoute.minAltitudeFt, maxAltitudeFt: editingRoute.maxAltitudeFt, levelLimits: levelLimits.value.trim() } : parseRouteFlightLevels(minAltitude.value, maxAltitude.value);
        if (!['forward', 'both'].includes(routeDirection.value)) throw new Error('Choose unidirectional or bidirectional route direction.');
        const generated = routeGeneratedText && routePoints.value === routeGeneratedText;
        const fixes = geometry.fixes.map((fix, index) => ({ ...fix, ...(generated ? draft[index] : {}), ...(routePointNames[index]?.name === fix.name && routePointNames[index].id ? { id: routePointNames[index].id } : {}) }));
        const geoPoints = origin ? generated ? fixes.map(point => localToGeographic(point, origin)) : geometry.geoPoints : undefined;
        await host.command('route-geometry-upsert', { ...(routeForm.dataset.editId ? { id: routeForm.dataset.editId } : {}), name, kind: routeForm.dataset.routeKind || 'ats', active: routeForm.dataset.active !== 'false', availableFrom: Number(routeForm.dataset.availableFrom || 0), availableUntil: Number(routeForm.dataset.availableUntil || 0), ...limits, chartDirection: routeDirection.value, fixes, ...(origin ? { coordinateOrigin: geometry.coordinateOrigin, geoPoints } : {}), source: 'Instructor chart', reference: reference.value.trim(), effectiveInfo: date.value.trim() }, undefined, state.exerciseId);
        clearBoundary(); status.textContent = 'ATS route saved on both desks. The listed point order is retained.'; host.changed?.(); drawPreview();
    }, saveRoute); });
    function render() {
        const state = host.view(); if (!state) return;
        if (state.running) cancelSketch();
        if (lastExercise !== state.exerciseId || state.role !== 'instructor') { lastExercise = state.exerciseId; discardDraft(); }
        if (!dirtyARP) { arpFields.latitude.value = String(state.environment.chartOrigin?.latitude ?? ''); arpFields.longitude.value = String(state.environment.chartOrigin?.longitude ?? ''); arpName.value = state.environment.aerodromeName || ''; reference.value = state.environment.chartReference || ''; date.value = state.environment.effectiveInfo || ''; }
        const count = (state.routes || []).length + (state.areas || []).length;
        existingSummary.textContent = `Routes and areas · ${count}`;
        list.replaceChildren(...(state.areas || []).map(area => {
            const row = element('div', '', 'airspace-boundary-row'); row.append(element('strong', `${area.name} · ${kinds.find(k => k[0] === area.kind)?.[1] || area.kind}`), element('span', `${area.floorLabel || 'GND'} / ${area.ceilingLabel || '—'}`, 'airspace-feature-limits'));
            const edit = button('Edit area', () => void perform(async () => {
                requireEditing(state);
                if (hasDraft() && !await ask('Discard unsaved entries and edit this area?', 'Edit area')) return;
                discardDraft(); render(); featureKind = 'area'; feature.value = 'area'; boundaryForm.dataset.editId = area.id; boundaryForm.dataset.active = String(area.active); editingOrigin = area.coordinateOrigin || null;
                boundaryName.value = area.name; kind.value = area.kind; floor.value = area.floorLabel || 'GND'; ceiling.value = area.ceilingLabel || ''; draft = area.points.map(p => ({ ...p })); selectedVertex = -1; closed = true; mode.value = state.environment.chartOrigin ? 'geographic' : 'local';
                openEditedForm(boundaryForm, boundaryName);
            }, edit));
            const remove = button('Remove area', () => void perform(async () => { requireEditing(state); if (await ask(`Remove ${area.name}?`, 'Remove boundary')) { await host.command('area-delete', { id: area.id }, undefined, state.exerciseId); if (host.view()?.exerciseId === state.exerciseId && boundaryForm.dataset.editId === area.id) clearBoundary(); host.changed?.(); } }, remove));
            row.append(edit, remove); return row;
        }));
        routeList.replaceChildren(...(state.routes || []).map(route => {
            const row = element('div', '', 'airspace-boundary-row'); row.append(element('strong', `${route.name} · ${route.chartDirection === 'both' ? 'Bidirectional' : route.chartDirection === 'forward' ? 'Unidirectional' : 'Chart direction not specified'}`), element('span', route.levelLimits || `FL${route.minAltitudeFt / 100}/FL${route.maxAltitudeFt / 100}`, 'airspace-feature-limits'));
            const edit = button('Edit route', () => void perform(async () => {
                requireEditing(state);
                const fixes = (route.fixIds || []).map(id => (state.fixes || []).find(fix => fix.id === id));
                if (fixes.length < 2 || fixes.some(fix => !fix)) throw new Error('A route point is unavailable. Reload the airspace before editing.');
                if (hasDraft() && !await ask('Discard unsaved entries and edit this route?', 'Edit route')) return;
                discardDraft(); render(); featureKind = 'route'; feature.value = 'route'; routeForm.dataset.editId = route.id; editingRoute = route; editingOrigin = route.coordinateOrigin || null;
                routeForm.dataset.routeKind = route.kind; routeForm.dataset.active = String(route.active); routeForm.dataset.availableFrom = String(route.availableFrom || 0); routeForm.dataset.availableUntil = String(route.availableUntil || 0);
                routeName.maxLength = Math.max(6, route.name.length); routeName.value = route.name; routeDirection.value = route.chartDirection || ''; minAltitude.value = String(route.minAltitudeFt / 100); maxAltitude.value = String(route.maxAltitudeFt / 100); minAltitude.step = maxAltitude.step = 'any'; levelLimits.value = route.levelLimits || ''; levelsWrap.hidden = false;
                draft = fixes.map(fix => ({ xNm: fix.xNm, yNm: fix.yNm })); routePointNames = fixes.map(fix => ({ id: fix.id, name: fix.name })); selectedVertex = -1; closed = true; routeMode.value = state.environment.chartOrigin ? 'geographic' : 'local';
                openEditedForm(routeForm, routeName);
            }, edit));
            const remove = button('Remove route', () => void perform(async () => { requireEditing(state); if (await ask(`Remove ${route.name}?`, 'Remove route')) { await host.command('route-delete', { id: route.id }, undefined, state.exerciseId); if (host.view()?.exerciseId === state.exerciseId && routeForm.dataset.editId === route.id) clearBoundary(); host.changed?.(); } }, remove));
            row.append(edit, remove); return row;
        }));
        drawPreview();
    }
    function requireEditing(state) {
        const current = host.view();
        if (current?.exerciseId !== state.exerciseId || current?.role !== 'instructor') throw new Error('The exercise changed. Open its airspace again.');
        if (current.terminated) throw new Error('Reopen the exercise before editing airspace.');
        if (current.running) throw new Error('Pause the exercise before editing airspace.');
    }
    function openEditedForm(form, firstInput) {
        setMethod(method); syncPoints(); sketch.open = true; host.openEditor?.(method); drawPreview();
        form.scrollIntoView?.({ block: 'start' }); firstInput.focus?.({ preventScroll: true });
    }
    function scopePoint(e) { const p = host.scope?.screenToPoint?.(e); return Array.isArray(p) ? { xNm: p[0], yNm: p[1] } : { xNm: p?.xNm ?? p?.x, yNm: p?.yNm ?? p?.y }; }
    setMethod(method);
    return { render, setMethod, hasDraft, discardDraft, cancelSketch, isSketching: () => active, draw: (ctx, transform) => { scopeTransform = transform; if (active && !placingARP) drawDraft(ctx, transform); }, onPointer(e) { if (!active) return false; try { if (placingARP) { if (e.isPrimary !== false && (e.button === 0 || e.pointerType === 'touch')) { e.preventDefault(); void placeARP(scopePoint(e), true); } } else beginPointer(e, host.scope.canvas, scopePoint(e), scopeTransform); } catch (error) { releasePointer(false); showDrawingError(error); } return true; }, onPointerMove(e) { return movePointer(e, host.scope?.canvas, scopePoint(e)); }, onPointerUp: e => finishPointer(e), onPointerCancel: e => finishPointer(e, false) };
}
