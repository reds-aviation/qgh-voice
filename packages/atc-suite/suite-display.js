/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

(function exposeAtcSuiteDisplay(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ATCSuiteDisplay = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function createDisplayModule(root) {
  'use strict';

  const STUDENT_WINDOW_NAME = 'reds-atc-student-display';
  const DEFAULT_WINDOW_FEATURES = Object.freeze({ width: 1280, height: 800, left: 48, top: 48 });

  const SCOPE_RANGES_NM = Object.freeze([5, 10, 20, 40, 60, 100]);
  function zoomRange(current, direction) {
    const range = Number.isFinite(Number(current)) ? Number(current) : 40;
    if (direction === 'in') return [...SCOPE_RANGES_NM].reverse().find(value => value < range) ?? 5;
    if (direction === 'out') return SCOPE_RANGES_NM.find(value => value > range) ?? range;
    return range;
  }

  // Both desks zoom their own display, without issuing an aircraft command.
  function bindScopeZoom(canvas, { getRange, setRange, isEnabled = () => true }) {
    function zoom(direction) {
      if (!isEnabled()) return;
      const before = getRange(), next = zoomRange(before, direction);
      if (next !== before) setRange(next);
    }
    function wheel(event) {
      if (!isEnabled() || !Number.isFinite(event.deltaY) || event.deltaY === 0
        || Math.abs(event.deltaX || 0) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      zoom(event.deltaY < 0 ? 'in' : 'out');
    }
    canvas.addEventListener('wheel', wheel, { passive: false });
    return { zoom, destroy() { canvas.removeEventListener('wheel', wheel); } };
  }

  // Animation may bridge the normal interval between sensor messages, but must
  // never imply that a stalled link is still delivering a live radar picture.
  const MAX_SWEEP_EXTRAPOLATION_SECONDS = .35;
  function radarSweepAngle({ angleDeg, elapsedSeconds = 0, rpm = 15, timeRate = 1, running = false } = {}) {
    if (!Number.isFinite(angleDeg)) return null;
    const scanRpm = [10, 12, 15].includes(Number(rpm)) ? Number(rpm) : 15;
    const rate = [1, 5, 10].includes(Number(timeRate)) ? Number(timeRate) : 1;
    const elapsed = running && Number.isFinite(elapsedSeconds)
      ? Math.min(MAX_SWEEP_EXTRAPOLATION_SECONDS, Math.max(0, elapsedSeconds)) : 0;
    return ((angleDeg + elapsed * scanRpm * 6 * rate) % 360 + 360) % 360;
  }

  function createRadarSweepClock() {
    let sample = null;
    let held = true;
    return Object.freeze({
      observe({ angleDeg, simulationTime, receivedAt, rpm = 15, timeRate = 1, running = false } = {}) {
        if (![angleDeg, simulationTime, receivedAt].every(Number.isFinite)) return;
        // The host sends repeated snapshots between physical simulation steps.
        // Resetting the anchor for those copies makes the beam jump backwards.
        if (held || !sample || sample.simulationTime !== simulationTime || sample.angleDeg !== angleDeg
          || sample.rpm !== rpm || sample.timeRate !== timeRate) {
          sample = { angleDeg, simulationTime, receivedAt, rpm, timeRate };
        }
        held = !running;
      },
      hold() { held = true; },
      reset() { sample = null; held = true; },
      angle(now, running = false) {
        return sample ? radarSweepAngle({ ...sample, running: running && !held,
          elapsedSeconds: (now - sample.receivedAt) / 1000 }) : null;
      }
    });
  }

  function drawRadarSweep(context, { cx, cy, radius, angleDeg } = {}) {
    if (![cx, cy, radius, angleDeg].every(Number.isFinite) || radius <= 0) return;
    const leading = (angleDeg - 90) * Math.PI / 180;
    context.save();
    // A short, low-contrast persistence fan follows the clockwise beam. Draw
    // this below targets and labels; it is a cue, not an opaque scope overlay.
    for (let segment = 0; segment < 9; segment += 1) {
      const end = leading - segment * 2 * Math.PI / 180;
      context.fillStyle = `rgba(56,148,129,${(.12 * (1 - segment / 9)).toFixed(3)})`;
      context.beginPath(); context.moveTo(cx, cy);
      context.arc(cx, cy, radius, end - 2 * Math.PI / 180, end);
      context.closePath(); context.fill();
    }
    context.strokeStyle = '#389481'; context.lineWidth = 1.25;
    context.beginPath(); context.moveTo(cx, cy);
    context.lineTo(cx + Math.cos(leading) * radius, cy + Math.sin(leading) * radius);
    context.stroke(); context.restore();
  }

  const bearingLabel = value => String(Math.round(((Number(value) % 360) + 360) % 360) % 360).padStart(3, '0');

  function radarChartEnvironment(metadata = {}) {
    const source = metadata?.radarEnvironment || {}, fallbackRunway = Number(metadata?.runwayOrientation) || 0;
    const points = Array.isArray(source.lfaBoundary) ? source.lfaBoundary
      .filter(point => Number.isFinite(point?.bearingDeg) && Number.isFinite(point?.rangeNm) && point.rangeNm >= 0)
      .slice(0, 12).map(point => ({ bearingDeg: point.bearingDeg, rangeNm: point.rangeNm })) : [];
    return {
      runwayOrientationDeg: Number.isFinite(source.runwayOrientationDeg) ? source.runwayOrientationDeg : fallbackRunway,
      extendedCentreline: source.extendedCentreline === true,
      extendedCentrelineNm: Number.isFinite(source.extendedCentrelineNm) ? Math.max(0, source.extendedCentrelineNm) : 20,
      centrelineTickNm: Number.isFinite(source.centrelineTickNm) ? Math.max(.5, source.centrelineTickNm) : 2,
      lfaBoundary: points,
      publishedAirspace: source.publishedAirspace || null,
      // A student can only hide an instructor-provided SRA aid. Do not infer a
      // guide when the safe metadata did not declare one.
      sraDescentProfile: metadata?.mode === 'sra' && source.sraDescentProfile === true
    };
  }

  function radarChartSummary({ environment, metadata = {}, overlays = {}, showExtendedCentreline = true, showLfa = true, showDescentProfile = false } = {}) {
    if (!environment) return [];
    const notes = [];
    if (environment.publishedAirspace) {
      const published = environment.publishedAirspace;
      notes.push(`${published.baseName} · ${published.lfaName}: dated published chart`);
      notes.push('Published runway strips are chart references; SRA final and threshold use the configured exercise runway');
      if (published.effectiveInfo) notes.push(published.effectiveInfo);
      if (published.gaps?.length) notes.push(published.gaps.join('; '));
    }
    if (showExtendedCentreline && environment.extendedCentreline) notes.push(`Extended runway centreline ${bearingLabel(environment.runwayOrientationDeg)}° / ${bearingLabel(environment.runwayOrientationDeg + 180)}°`);
    if (showLfa && environment.lfaBoundary.length >= 3) notes.push('LFA boundary: training reference');
    if (metadata.mode !== 'sra') return notes;
    const corridor = Number.isFinite(overlays.approachCorridorWidthNm) ? overlays.approachCorridorWidthNm : 2;
    notes.push(`Final ${bearingLabel(metadata.finalTrack ?? environment.runwayOrientationDeg)}°; SRA training corridor ${corridor} NM total`);
    notes.push(`Distances from landing threshold; termination ${Number.isFinite(overlays.terminationRangeNm) ? overlays.terminationRangeNm : .5} NM`);
    if (showDescentProfile && environment.sraDescentProfile) {
      const glidepath = Number.isFinite(metadata.glidepathDeg) ? metadata.glidepathDeg : 3;
      notes.push(`${glidepath.toFixed(1)}° descent training guide; heights AAL`);
      if (Number.isFinite(metadata.approachSpeedKt)) {
        const rate = Math.round(Math.tan(glidepath * Math.PI / 180) * 6076.12 * metadata.approachSpeedKt / 600) * 10;
        notes.push(`${metadata.approachAircraftType ? String(metadata.approachAircraftType).toUpperCase() + ' · ' : ''}${metadata.approachSpeedKt} KT configured; ≈ ${rate.toLocaleString()} FT/MIN`);
      }
    }
    return notes;
  }

  function chartLabelLayout({ width, height, cx, cy, obstacles = [], publishedAirspace }) {
    return { width, height, occupied: [...obstacles,
      // Preserve the runway/ARP identifiers already painted by the base scope.
      { x: cx - 12, y: cy - 27, width: publishedAirspace ? 240 : 116, height: 58 }] };
  }

  function placeChartLabel(context, layout, lines, point, normal = { x: 1, y: 0 }) {
    const lineHeight = 16, textWidth = Math.max(...lines.map(line => context.measureText(line).width));
    const textHeight = lineHeight * lines.length;
    for (const side of [1, -1]) {
      const nx = normal.x * side, ny = normal.y * side;
      const x = point.x + nx * 15 - (nx < -.1 ? textWidth : nx > .1 ? 0 : textWidth / 2);
      const y = point.y + ny * 15 - textHeight / 2;
      const box = { x: x - 6, y: y - 5, width: textWidth + 12, height: textHeight + 10 };
      if (box.x < 10 || box.y < 10 || box.x + box.width > layout.width - 10 || box.y + box.height > layout.height - 10) continue;
      if (layout.occupied.some(other => box.x < other.x + other.width && box.x + box.width > other.x && box.y < other.y + other.height && box.y + box.height > other.y)) continue;
      layout.occupied.push(box);
      lines.forEach((line, index) => context.fillText(line, x, y + 11 + index * lineHeight));
      return true;
    }
    return false;
  }

  function chartLabelStep(scale, angle, textWidth, lineCount, minimum = 1) {
    // Along-track separation follows the actual pixel footprint of the label.
    // Diagonal tracks can use vertical space; near-horizontal tracks need width.
    const pixels = Math.max(48, Math.min((textWidth + 24) / Math.max(.01, Math.abs(Math.sin(angle))),
      (lineCount * 16 + 24) / Math.max(.01, Math.abs(Math.cos(angle)))));
    const required = Math.max(minimum, pixels / scale);
    return [.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].find(step => step >= required) || Math.ceil(required / 100) * 100;
  }

  function drawRadarEnvironment(context, { width, height, cx: originX, cy: originY, scale, rangeNm, environment, metadata = {}, runway, showExtendedCentreline = true, showLfa = true, obstacles = [], chartLabels }) {
    const labels = chartLabels || chartLabelLayout({ width, height, cx: originX, cy: originY, obstacles, publishedAirspace: environment.publishedAirspace });
    const polarPoint = (distance, bearing) => ({ x: originX + Math.sin(bearing * Math.PI / 180) * distance * scale, y: originY - Math.cos(bearing * Math.PI / 180) * distance * scale });
    if (showExtendedCentreline && environment.extendedCentreline && environment.extendedCentrelineNm > 0) {
      const total = Math.min(rangeNm, environment.extendedCentrelineNm), heading = environment.runwayOrientationDeg;
      const centre = runway?.centre || { xNm: 0, yNm: 0 };
      const cx = originX + centre.xNm * scale, cy = originY - centre.yNm * scale;
      context.strokeStyle = '#8f936d'; context.lineWidth = 1; context.setLineDash([9, 6]);
      for (const direction of [heading, heading + 180]) {
        const point = polarPoint(total, direction);
        context.beginPath(); context.moveTo(cx, cy); context.lineTo(point.x + centre.xNm * scale, point.y - centre.yNm * scale); context.stroke();
      }
      context.setLineDash([]); context.fillStyle = '#b6bd91'; context.font = '11px IBM Plex Mono';
      // SRA has a separate threshold-based scale below. A second scale from
      // the runway centre would both clutter the approach and imply a wrong datum.
      if (metadata.mode !== 'sra') for (const direction of [heading, heading + 180]) {
        const angle = direction * Math.PI / 180, tick = environment.centrelineTickNm;
        const step = chartLabelStep(scale, angle, context.measureText(`${total} NM`).width, 1, tick);
        for (let distance = tick; distance <= total + 1e-9; distance += tick) {
          const point = polarPoint(distance, direction), dx = Math.cos(angle) * 5, dy = Math.sin(angle) * 5;
          point.x += centre.xNm * scale; point.y -= centre.yNm * scale;
          context.beginPath(); context.moveTo(point.x - dx, point.y - dy); context.lineTo(point.x + dx, point.y + dy); context.stroke();
        }
        for (let distance = step; distance <= total + 1e-9; distance += step) {
          const point = polarPoint(distance, direction); point.x += centre.xNm * scale; point.y -= centre.yNm * scale;
          placeChartLabel(context, labels, [`${distance} NM`], point, { x: Math.cos(angle), y: Math.sin(angle) });
        }
      }
    }
    if (showLfa && !environment.publishedAirspace && environment.lfaBoundary.length >= 3) {
      const points = environment.lfaBoundary.map(point => polarPoint(point.rangeNm, point.bearingDeg));
      context.strokeStyle = '#ca8a6a'; context.lineWidth = 1.4; context.setLineDash([4, 8]); context.beginPath();
      context.moveTo(points[0].x, points[0].y); points.slice(1).forEach(point => context.lineTo(point.x, point.y)); context.lineTo(points[0].x, points[0].y); context.stroke(); context.setLineDash([]);
      context.fillStyle = '#e3aa84'; context.font = '11px IBM Plex Mono';
      for (const point of points) if (placeChartLabel(context, labels, ['LFA'], point)) break;
    }
    return labels;
  }

  // Published chart geometry is public reference data in east/north NM about
  // its declared ARP. It is never derived from aircraft truth or radar plots.
  function drawPublishedAirspace(context, { publishedAirspace, cx, cy, scale, width, height,
    obstacles = [], layerVisibility = {}, boundaryVisibleIds, chartLabels } = {}) {
    const labels = chartLabels || chartLabelLayout({ width, height, cx, cy, obstacles, publishedAirspace });
    if (!publishedAirspace || !Number.isFinite(scale) || scale <= 0) return labels;
    const visible = Object.fromEntries([...new Set([...Object.keys(publishedAirspace.layerVisibility || {}), ...Object.keys(layerVisibility)])]
      .map(key => [key, publishedAirspace.layerVisibility?.[key] !== false && layerVisibility[key] !== false]));
    const compactLabels = height < 440 || width < 700;
    const point = value => ({ x: cx + value.xNm * scale, y: cy - value.yNm * scale });
    const validPoints = values => Array.isArray(values) && values.every(value => Number.isFinite(value?.xNm) && Number.isFinite(value?.yNm));
    const path = (points, closed) => {
      context.beginPath(); const first = point(points[0]); context.moveTo(first.x, first.y);
      for (const value of points.slice(1)) { const next = point(value); context.lineTo(next.x, next.y); }
      if (closed) context.closePath();
    };
    const labelNear = (lines, points, normals = [{ x: 1, y: 0 }]) => {
      // Try actual vertices and segment midpoints. Geometry stays unchanged
      // when no readable label position fits the current viewport.
      const candidates = [];
      for (let i = 1; i < points.length; i++) candidates.push({ xNm: (points[i - 1].xNm + points[i].xNm) / 2, yNm: (points[i - 1].yNm + points[i].yNm) / 2 });
      for (const candidate of [...candidates, ...points]) for (const normal of normals) if (placeChartLabel(context, labels, lines.filter(Boolean), point(candidate), normal)) return;
    };
    context.save();
    context.beginPath(); context.rect(0, 0, width, height); context.clip();
    context.font = '11px IBM Plex Mono'; context.textAlign = 'left'; context.textBaseline = 'alphabetic';
    for (const area of publishedAirspace.areas || []) {
      if (!validPoints(area.points) || area.points.length < 3) continue;
      const lfa = area.id === publishedAirspace.lfaId;
      const controlled = /control|ctr|tma/i.test(area.kind);
      if (visible[lfa ? 'lfa' : controlled ? 'controlledAirspace' : 'specialUse'] === false) continue;
      const colour = lfa ? '#e5a67d' : controlled ? '#66ccdf' : '#f27b86';
      context.strokeStyle = colour; context.fillStyle = colour; context.lineWidth = lfa ? 1.8 : 1.2; context.setLineDash(lfa ? [6, 6] : []);
      path(area.points, true); context.stroke(); context.setLineDash([]);
      labelNear([area.name, compactLabels ? '' : [area.floorLabel, area.ceilingLabel].filter(Boolean).join(' / ')], area.points);
    }
    if (visible.atsRoutes !== false) for (const route of publishedAirspace.routes || []) {
      if (!validPoints(route.points) || route.points.length < 2) continue;
      context.strokeStyle = '#8abfa0'; context.fillStyle = '#b5d5bf'; context.lineWidth = 1.2; context.setLineDash([]);
      path(route.points, false); context.stroke(); labelNear([compactLabels ? route.name.split(' ')[0] : route.name, compactLabels ? '' : route.levelLimits], route.points);
    }
    if (visible.atsRoutes !== false) for (const fix of publishedAirspace.fixes || []) {
      if (!validPoints([fix])) continue;
      const at = point(fix); if (at.x < 0 || at.x > width || at.y < 0 || at.y > height) continue;
      context.strokeStyle = '#85bac7'; context.fillStyle = '#bdd5db'; context.lineWidth = 1;
      context.beginPath(); context.moveTo(at.x, at.y - 4); context.lineTo(at.x + 4, at.y + 3); context.lineTo(at.x - 4, at.y + 3); context.closePath(); context.stroke();
      placeChartLabel(context, labels, [fix.name], at);
    }
    if (visible.runways !== false) for (const runway of publishedAirspace.runways || []) {
      if (!validPoints(runway.points) || runway.points.length < 2) continue;
      context.strokeStyle = '#a8adb2'; context.fillStyle = '#d3d8dc'; context.lineWidth = Math.max(2, Math.min(20, (Number(runway.widthNm) || .025) * scale)); context.setLineDash([]);
      path(runway.points, false); context.stroke(); labelNear([`PUBLISHED RWY ${runway.name}`], runway.points, [{ x: 1, y: 0 }, { x: 0, y: 4 }]);
    }
    if (visible.arp !== false) {
      context.fillStyle = '#d9e3c5'; context.beginPath(); context.arc(cx, cy, 3.5, 0, Math.PI * 2); context.fill();
    }
    context.restore();
    const boundaries = root.ATSPublishedBoundaries || (typeof require === 'function' ? require('../qgh-engine/published-boundaries.js') : null);
    if (boundaries && visible.internationalBoundary !== false) {
      labels.boundaries = boundaries.drawBoundaries(context, { features: publishedAirspace.referenceBoundaries,
        project(longitude, latitude) { const local = boundaries.projectGeographic(longitude, latitude, publishedAirspace.origin); const screen = point(local); return [screen.x, screen.y]; },
        viewport: { x: 0, y: 0, width, height }, visibleIds: boundaryVisibleIds, obstacles: labels.occupied });
      labels.occupied.push(...labels.boundaries.labels);
    }
    return labels;
  }

  function drawSraReferences(context, { width, height, cx: originX, cy: originY, scale, rangeNm, environment, metadata = {}, runway, overlays = {}, showDescentProfile = false, obstacles = [], chartLabels }) {
    const labels = chartLabels || chartLabelLayout({ width, height, cx: originX, cy: originY, obstacles });
    const radius = scale * rangeNm;
    const bearing = overlays.centrelineDeg ?? ((Number(overlays.runwayOrientationDeg ?? metadata.runwayOrientation) + 180) % 360);
    const threshold = runway?.threshold || { xNm: 0, yNm: 0 };
    const angle = bearing * Math.PI / 180, cx = originX + threshold.xNm * scale, cy = originY - threshold.yNm * scale;
    const fromThreshold = distance => ({ x: cx + Math.sin(angle) * distance * scale, y: cy - Math.cos(angle) * distance * scale });
    const normal = { x: Math.cos(angle), y: Math.sin(angle) };
    const totalWidthNm = Number.isFinite(overlays.approachCorridorWidthNm) && overlays.approachCorridorWidthNm >= 0 ? overlays.approachCorridorWidthNm : 2;
    const halfWidthPx = totalWidthNm / 2 * scale;
    const alongPx = Math.sqrt(Math.max(0, radius * radius - halfWidthPx * halfWidthPx));
    context.strokeStyle = '#597966'; context.lineWidth = 1; context.setLineDash([5, 7]);
    if (halfWidthPx < radius) for (const side of [-1, 1]) {
      const x = cx + normal.x * halfWidthPx * side, y = cy + normal.y * halfWidthPx * side;
      context.beginPath(); context.moveTo(x, y); context.lineTo(x + Math.sin(angle) * alongPx, y - Math.cos(angle) * alongPx); context.stroke();
    }
    context.setLineDash([]);
    const glidepathDeg = Number.isFinite(metadata.glidepathDeg) ? metadata.glidepathDeg : 3;
    const feetPerNm = Math.tan(glidepathDeg * Math.PI / 180) * 6076.12;
    context.strokeStyle = '#c4af64'; context.lineWidth = 1.5; context.setLineDash([9, 8]); context.beginPath(); context.moveTo(cx, cy); context.lineTo(cx + Math.sin(angle) * radius, cy - Math.cos(angle) * radius); context.stroke(); context.setLineDash([]);
    context.font = '11px IBM Plex Mono'; context.fillStyle = '#dac981';
    const markStep = Number.isFinite(environment.centrelineTickNm) ? environment.centrelineTickNm : 2;
    const marks = [];
    for (let distance = .5; distance <= Math.min(5, rangeNm); distance += .5) marks.push(distance);
    for (let distance = markStep; distance <= rangeNm; distance += markStep) if (distance > 5) marks.push(distance);
    for (const distance of marks) {
      const point = fromThreshold(distance), dx = normal.x * 6, dy = normal.y * 6;
      context.beginPath(); context.moveTo(point.x - dx, point.y - dy); context.lineTo(point.x + dx, point.y + dy); context.stroke();
    }
    if (Number.isFinite(overlays.terminationRangeNm) && overlays.terminationRangeNm <= rangeNm) {
      const point = fromThreshold(overlays.terminationRangeNm), dx = normal.x * 13, dy = normal.y * 13;
      context.strokeStyle = '#edbb7d'; context.lineWidth = 3; context.beginPath(); context.moveTo(point.x - dx, point.y - dy); context.lineTo(point.x + dx, point.y + dy); context.stroke();
      context.fillStyle = '#edbb7d';
      placeChartLabel(context, labels, [`TERM ${overlays.terminationRangeNm} NM`], point, normal);
    }
    context.fillStyle = '#dac981';
    const widthAtRange = context.measureText(showDescentProfile ? `${Math.round(feetPerNm * rangeNm).toLocaleString()} FT AAL` : `${rangeNm} NM`).width;
    const step = chartLabelStep(scale, angle, widthAtRange, showDescentProfile ? 2 : 1, Math.min(1, markStep));
    for (let distance = step; distance <= rangeNm; distance += step) {
      const lines = [`${distance} NM`];
      if (showDescentProfile) lines.push(`${(Math.round(feetPerNm * distance / 10) * 10).toLocaleString()} FT AAL`);
      placeChartLabel(context, labels, lines, fromThreshold(distance), normal);
    }
    const finalPoint = fromThreshold(Math.min(rangeNm, Math.max(rangeNm * .88, 1)));
    placeChartLabel(context, labels, [`FINAL ${bearingLabel(metadata.finalTrack ?? (bearing + 180))}°`], finalPoint, { x: -normal.x, y: -normal.y });
    return labels;
  }

  // Middle click is a Stop control, including empty scope beside a selected
  // aircraft. Its own release path never enters single/double-click radio RT.
  function bindMiddleMouseStop(element, { isAllowed = () => false, getTargetId = () => null,
    onReset = () => {}, onStop = () => {} } = {}) {
    if (!element?.addEventListener) return null;
    let pressed = null;
    const preventDefault = event => { if (event.button === 1) event.preventDefault(); };
    function cancel(event) {
      if (event && pressed && event.pointerId !== pressed.pointerId) return;
      const pointerId = pressed?.pointerId; pressed = null;
      if (pointerId != null && element.hasPointerCapture?.(pointerId)) element.releasePointerCapture?.(pointerId);
    }
    function down(event) {
      if (event.button !== 1) return;
      event.preventDefault(); cancel();
      if (event.isPrimary === false || event.pointerType && event.pointerType !== 'mouse' || !isAllowed()) return;
      onReset();
      const id = getTargetId(event);
      if (!id || !isAllowed(id)) return;
      pressed = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      if (event.pointerId != null) element.setPointerCapture?.(event.pointerId);
    }
    function move(event) {
      if (pressed && pressed.pointerId === event.pointerId
        && Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 5) cancel();
    }
    function up(event) {
      if (event.button !== 1) return;
      event.preventDefault();
      if (!pressed || pressed.pointerId !== event.pointerId) return;
      const action = pressed; cancel();
      if (isAllowed(action.id) && Math.hypot(event.clientX - action.x, event.clientY - action.y) <= 5) onStop(action.id);
    }
    const listeners = { pointerdown: down, pointermove: move, pointerup: up,
      pointercancel: cancel, lostpointercapture: cancel, mousedown: preventDefault, auxclick: preventDefault };
    for (const [type, listener] of Object.entries(listeners)) element.addEventListener(type, listener);
    return Object.freeze({ cancel, close() { cancel(); for (const [type, listener] of Object.entries(listeners)) element.removeEventListener?.(type, listener); } });
  }

  function finite(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function screenBounds(screen, fallback = DEFAULT_WINDOW_FEATURES) {
    if (!screen) return { ...fallback };
    return {
      left: finite(screen.availLeft, finite(screen.left, fallback.left)),
      top: finite(screen.availTop, finite(screen.top, fallback.top)),
      width: Math.max(640, finite(screen.availWidth, finite(screen.width, fallback.width))),
      height: Math.max(560, finite(screen.availHeight, finite(screen.height, fallback.height)))
    };
  }

  function windowFeatures(bounds = DEFAULT_WINDOW_FEATURES) {
    const safe = screenBounds(bounds);
    return `popup=yes,resizable=yes,scrollbars=yes,left=${Math.round(safe.left)},top=${Math.round(safe.top)},width=${Math.round(safe.width)},height=${Math.round(safe.height)}`;
  }

  function sameScreen(first, second) {
    if (!first || !second) return false;
    const a = screenBounds(first);
    const b = screenBounds(second);
    return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
  }

  function chooseExternalScreen(details) {
    const screens = Array.isArray(details?.screens) ? details.screens : [];
    if (!screens.length) return null;
    const current = details.currentScreen || screens.find(screen => screen.isPrimary) || screens[0];
    return screens.find(screen => !sameScreen(screen, current)) || null;
  }

  function openStudentWindow(options = {}) {
    const openWindow = options.openWindow || (typeof root.open === 'function' ? root.open.bind(root) : null);
    if (!openWindow) return { ok: false, reason: 'unsupported', window: null };
    const child = openWindow(
      '',
      options.name || STUDENT_WINDOW_NAME,
      windowFeatures(options.bounds)
    );
    if (!child) return { ok: false, reason: 'popup-blocked', window: null };
    try {
      child.opener = null;
      if (child.opener !== null) throw new Error('Unable to isolate student display');
      if (typeof child.location?.replace === 'function') child.location.replace(options.url || 'student.html');
      else child.location = options.url || 'student.html';
    } catch (_) {
      try { child.close(); } catch (_) { /* The browser may already have closed it. */ }
      return { ok: false, reason: 'isolation-failed', window: null };
    }
    try { child.focus(); } catch (_) { /* A browser may refuse programmatic focus. */ }
    return { ok: true, reason: 'opened', window: child };
  }

  function placeWindowOnScreen(child, screen) {
    if (!child || child.closed || !screen) return false;
    const bounds = screenBounds(screen);
    try {
      child.moveTo(bounds.left, bounds.top);
      child.resizeTo(bounds.width, bounds.height);
      child.focus();
      return true;
    } catch (_) {
      return false;
    }
  }

  async function placeOnExternalScreen(child, options = {}) {
    if (!child || child.closed) return { ok: false, reason: 'window-closed', placedExternal: false };
    const getScreenDetails = options.getScreenDetails
      || (typeof root.getScreenDetails === 'function' ? root.getScreenDetails.bind(root) : null);
    if (!getScreenDetails) {
      return { ok: true, reason: 'manual-placement', placedExternal: false, screenCount: 1 };
    }
    try {
      const details = await getScreenDetails();
      const screenCount = Array.isArray(details?.screens) ? details.screens.length : 0;
      const target = chooseExternalScreen(details);
      if (!target) return { ok: true, reason: 'single-display', placedExternal: false, screenCount };
      const placed = placeWindowOnScreen(child, target);
      return {
        ok: true,
        reason: placed ? 'external-display' : 'manual-placement',
        placedExternal: placed,
        screenCount,
        label: typeof target.label === 'string' ? target.label.trim() : ''
      };
    } catch (error) {
      const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
      return { ok: true, reason: denied ? 'permission-needed' : 'manual-placement', placedExternal: false, screenCount: 0 };
    }
  }

  return Object.freeze({
    STUDENT_WINDOW_NAME,
    zoomRange,
    bindScopeZoom,
    MAX_SWEEP_EXTRAPOLATION_SECONDS,
    radarSweepAngle,
    createRadarSweepClock,
    drawRadarSweep,
    radarChartEnvironment,
    radarChartSummary,
    drawRadarEnvironment,
    drawPublishedAirspace,
    drawSraReferences,
    bindMiddleMouseStop,
    chooseExternalScreen,
    openStudentWindow,
    placeOnExternalScreen,
    placeWindowOnScreen,
    screenBounds,
    sameScreen,
    windowFeatures
  });
});
