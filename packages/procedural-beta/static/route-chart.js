/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

import { project } from './chart-geometry.js';
import { visibleSegment } from './scope-navigation.js';

export const CHART_ENVIRONMENT_KEYS = Object.freeze(['chartOrigin', 'drawnARP', 'rangeNm', 'stationName', 'stationType', 'stationXNm', 'stationYNm', 'stationFrequency', 'aerodromeName', 'chartReference', 'effectiveInfo', 'briefing', 'magneticVariationDeg', 'magneticVariationKnown', 'trainingMagneticVariationDeg', 'map', 'runwayHeadingDeg', 'runwayLengthNm', 'runwayOffsetNm', 'runwayCenterXNm', 'runwayCenterYNm', 'aerodromeElevationFt', 'thresholdCrossingHeightFt']);
export function chartEnvironment(environment) {
    return JSON.parse(JSON.stringify(Object.fromEntries(CHART_ENVIRONMENT_KEYS.filter(key => Object.hasOwn(environment || {}, key)).map(key => [key, environment[key]]))));
}
export const filterChartEnvironment = chartEnvironment;
const textLimits = { source: 100, reference: 500, levelLimits: 240, effectiveInfo: 500, designator: 32, publishedLimitsHeading: 500, trackDistance: 500, lateralLimits: 240, oddLevels: 80, evenLevels: 80, notes: 2000 };
const byteLength = value => new TextEncoder().encode(value).length;
const validGeo = value => value && typeof value.latitude === 'number' && typeof value.longitude === 'number' && Number.isFinite(value.latitude) && Number.isFinite(value.longitude) && Math.abs(value.latitude) < 90 && Math.abs(value.longitude) <= 180;
function validateText(value, limits) {
    for (const [key, maximum] of Object.entries(limits)) if (value[key] !== undefined && (typeof value[key] !== 'string' || value[key].includes('\0') || byteLength(value[key]) > maximum)) throw new Error(`Invalid route ${key}.`);
}
// Shared offline-file validation mirrors the engine's chart metadata contract.
// Published labels are preserved as text, never parsed into numerical limits.
export function validateRouteChartMetadata(route, fixes) {
    if (!['', 'forward', 'both'].includes(route.chartDirection || '') || (route.chartDirection !== undefined && typeof route.chartDirection !== 'string')) throw new Error('Route chart direction must be forward or both.');
    validateText(route, textLimits);
    if (route.limitsVaryBySegment !== undefined && typeof route.limitsVaryBySegment !== 'boolean') throw new Error('Invalid per-leg limits flag.');
    if (route.coordinateOrigin != null || route.geoPoints?.length) {
        if (!validGeo(route.coordinateOrigin) || !Array.isArray(route.geoPoints) || route.geoPoints.length !== route.fixIds.length) throw new Error('Geographic route needs an ARP and one coordinate per ordered fix.');
        const byId = new Map(fixes.map(f => [f.id, f]));
        route.geoPoints.forEach((point, i) => {
            if (!validGeo(point)) throw new Error('Invalid route latitude/longitude.');
            const expected = project(point, route.coordinateOrigin), actual = byId.get(route.fixIds[i]);
            if (!actual || Math.hypot(expected.xNm - actual.xNm, expected.yNm - actual.yNm) > .01) throw new Error('Geographic route does not match its projected fixes and ARP.');
        });
    } else if (route.geoPoints !== undefined && !Array.isArray(route.geoPoints)) throw new Error('Invalid route geographic points.');
    if (route.publishedSegments !== undefined) {
        if (!Array.isArray(route.publishedSegments) || (route.publishedSegments.length && route.publishedSegments.length !== route.fixIds.length - 1)) throw new Error('Published route needs one source segment per ordered leg.');
        route.publishedSegments.forEach((leg, i, all) => {
            if (!leg || !Number.isInteger(leg.sourceSequence) || leg.sourceSequence < 0 || leg.sourceSequence > 1000000 || typeof leg.from !== 'string' || !leg.from.trim() || typeof leg.to !== 'string' || !leg.to.trim()) throw new Error('Invalid published route leg.');
            validateText(leg, { ...textLimits, from: 32, to: 32, fromPublishedCoordinates: 80, toPublishedCoordinates: 80 });
            if (leg.sha256 !== undefined && leg.sha256 !== '' && !/^[a-f0-9]{64}$/.test(leg.sha256)) throw new Error('Invalid published route source hash.');
            if (i && all[i - 1].to !== leg.from) throw new Error('Published route source segments must be consecutive.');
        });
    }
    return true;
}

export function routePointLabels(route, fixes) {
    const byId = new Map(fixes.map(f => [f.id, f]));
    return new Map((route.fixIds || []).map((id, i) => {
        const fix = byId.get(id), geo = route.geoPoints?.[i];
        const text = validGeo(geo) ? `${Math.abs(geo.latitude).toFixed(4)}°${geo.latitude < 0 ? 'S' : 'N'} ${Math.abs(geo.longitude).toFixed(4)}°${geo.longitude < 0 ? 'W' : 'E'}` : fix ? `${Math.abs(fix.xNm).toFixed(2)} ${fix.xNm < 0 ? 'W' : 'E'} / ${Math.abs(fix.yNm).toFixed(2)} ${fix.yNm < 0 ? 'S' : 'N'} NM` : '';
        return [id, text];
    }));
}
export function routeLevelLabel(route, leg) {
    if (leg?.levelLimits) return leg.levelLimits;
    if (route.levelLimits) return route.levelLimits;
    // Legacy generic bounds are not a published FL label.
    return Number.isFinite(route.minAltitudeFt) && Number.isFinite(route.maxAltitudeFt) ? `${route.minAltitudeFt}–${route.maxAltitudeFt} ft MSL` : '';
}

// Returned arrows are CSS-pixel geometry; direction depends on ordered fixes,
// never canvas backing size, magnetic variation, aircraft heading or pan.
export function routeChartLegs(route, fixes, pointToScreen, width, height) {
    const byId = new Map(fixes.map(f => [f.id, f])), ids = route.fixIds || [];
    return ids.slice(1).flatMap((id, i) => {
        const first = byId.get(ids[i]), last = byId.get(id);
        if (!first || !last) return [];
        const [ax, ay] = pointToScreen(first.xNm, first.yNm), [bx, by] = pointToScreen(last.xNm, last.yNm);
        if (![ax, ay, bx, by].every(Number.isFinite)) return [];
        const visible = visibleSegment({ x: ax, y: ay }, { x: bx, y: by }, width, height, 18);
        if (!visible) return [];
        const [a, b] = visible, length = Math.hypot(b.x - a.x, b.y - a.y);
        if (length < 28) return [{ a, b, arrows: [], level: '', legIndex: i }];
        const dx = (b.x - a.x) / length, dy = (b.y - a.y) / length;
        const arrows = [];
        const add = (direction, label = '', offset = 0) => arrows.push({ x: (a.x + b.x) / 2 - dy * offset, y: (a.y + b.y) / 2 + dx * offset, dx: dx * direction, dy: dy * direction, label });
        if (route.chartDirection === 'forward') add(1);
        else if (route.chartDirection === 'both') { add(1, '', -5); add(-1, '', 5); }
        const leg = route.publishedSegments?.[i];
        // ↑/↓ refer to table-row order, not an unconditional one-way airway.
        for (const [key, label, offset] of [['oddLevels', 'Odd', -11], ['evenLevels', 'Even', 11]]) {
            if (leg?.[key] === '↑') add(-1, label, offset);
            if (leg?.[key] === '↓') add(1, label, offset);
        }
        return [{ a, b, arrows, level: routeLevelLabel(route, leg), legIndex: i }];
    });
}

// Draw full route polyline + annotations. The caller owns visibility, colour,
// dashes, collision reservation and reporting-point symbols. A route name and
// its level limits are one label, keeping the limits directly underneath.
export function drawRouteChart(ctx, route, fixes, pointToScreen, { width, height, label, showLabels = true, color = '#a5c4ac' }) {
    const byId = new Map(fixes.map(f => [f.id, f]));
    ctx.beginPath();
    let connected = false;
    for (const id of route.fixIds || []) {
        const fix = byId.get(id);
        if (!fix) { connected = false; continue; }
        const [x, y] = pointToScreen(fix.xNm, fix.yNm);
        if (connected) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        connected = true;
    }
    ctx.stroke();
    const legs = routeChartLegs(route, fixes, pointToScreen, width, height);
    ctx.save(); ctx.setLineDash([]);
    for (const leg of legs) {
        for (const arrow of leg.arrows) {
            const { x, y, dx, dy } = arrow;
            ctx.beginPath(); ctx.moveTo(x - dx * 7 - dy * 4, y - dy * 7 + dx * 4); ctx.lineTo(x + dx * 7, y + dy * 7); ctx.lineTo(x - dx * 7 + dy * 4, y - dy * 7 - dx * 4); ctx.stroke();
            if (showLabels && arrow.label) label?.(arrow.label, x + dy * 8, y - dx * 8, color);
        }
    }
    const labelled = new Set(), name = route.id?.startsWith('aip-') ? route.name.split(' ')[0] : route.name;
    for (const leg of [...legs].sort((a, b) => Math.hypot(b.b.x - b.a.x, b.b.y - b.a.y) - Math.hypot(a.b.x - a.a.x, a.b.y - a.a.y))) {
        const text = [name, leg.level].filter(Boolean).join('\n');
        if (!showLabels || !text || labelled.has(text) || Math.hypot(leg.b.x - leg.a.x, leg.b.y - leg.a.y) < 42) continue;
        if (label?.(text, (leg.a.x + leg.b.x) / 2, (leg.a.y + leg.b.y) / 2, color) !== false) labelled.add(text);
    }
    ctx.restore();
    return legs;
}
