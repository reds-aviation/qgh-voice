/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

(function exposePublishedBoundaries(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ATSPublishedBoundaries = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function createPublishedBoundaries() {
  'use strict';
  const MAX_FEATURES = 16, MAX_PARTS = 64, MAX_VERTICES = 1024;
  const KINDS = Object.freeze({ IB: 'International Boundary', LoC: 'Line of Control', OTHER: 'Other published boundary' });
  const RED = '#ff334f';
  const plain = value => value != null && typeof value === 'object' && !Array.isArray(value);
  function text(value, name, max = 240) {
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`Boundary ${name} is missing or invalid.`);
    return value.trim();
  }
  function date(value, name) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error(`Boundary ${name} must be a valid YYYY-MM-DD date.`);
    return value;
  }
  function normalizeBoundary(value, budget = { vertices: 0 }) {
    if (!plain(value) || !plain(value.source) || !plain(value.verification) || !plain(value.geometry)) throw new Error('Boundary geometry and its source/verification records are required.');
    const id = text(value.id, 'identifier', 80), name = text(value.name, 'name', 160);
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)) throw new Error('Boundary identifier is invalid.');
    if (!Object.hasOwn(KINDS, value.kind)) throw new Error('Boundary kind must be IB, LoC or OTHER; these are not interchangeable.');
    const kind = value.kind, label = text(value.label, 'label', 32);
    if (kind !== 'OTHER' ? label !== kind : /^(ib|loc|international boundary|line of control)$/i.test(label)) throw new Error('Boundary label must match its verified kind.');
    const inputSource = value.source;
    if (!['EPSG:4326', 'OGC:CRS84'].includes(inputSource.crs) || inputSource.coordinateOrder !== 'longitude-latitude') throw new Error('Boundary CRS or coordinate order is unsupported. Supply verified geographic longitude/latitude data with its original CRS.');
    const source = { authority: text(inputSource.authority, 'source authority'), title: text(inputSource.title, 'source title'), section: text(inputSource.section, 'source section'),
      crs: inputSource.crs, coordinateOrder: inputSource.coordinateOrder, effectiveDate: date(inputSource.effectiveDate, 'effective date') };
    if (inputSource.url != null && inputSource.url !== '') {
      const url = text(inputSource.url, 'source URL', 2048);
      let parsed; try { parsed = new URL(url); } catch { throw new Error('Boundary source URL is invalid.'); }
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Boundary source URL must use HTTPS without credentials.');
      source.url = url;
    }
    if (value.verification.status !== 'verified') throw new Error('Unverified boundary coordinates cannot be drawn.');
    const verification = { status: 'verified', verifiedBy: text(value.verification.verifiedBy, 'verifier', 160), verifiedAt: date(value.verification.verifiedAt, 'verification date'), approvalReference: text(value.verification.approvalReference, 'approval/source authorization reference') };
    if (value.geometry.type !== 'MultiLineString' || !Array.isArray(value.geometry.coordinates) || !value.geometry.coordinates.length || value.geometry.coordinates.length > MAX_PARTS) throw new Error('Boundary geometry must contain one to 64 open line parts.');
    const coordinates = value.geometry.coordinates.map(part => {
      if (!Array.isArray(part) || part.length < 2) throw new Error('Each boundary part needs at least two coordinates.');
      return part.map(point => {
        if (++budget.vertices > MAX_VERTICES) throw new Error('Boundary geometry exceeds the 1,024-vertex transport limit. Supply an authorized regional dataset; geometry is never simplified automatically.');
        if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 85) throw new Error('Boundary coordinates must be finite [longitude, latitude] pairs within 85 degrees of the equator.');
        return [point[0], point[1]];
      });
    });
    return { id, name, kind, label, geometry: { type: 'MultiLineString', coordinates }, source, verification };
  }
  function normalizeBoundaries(values) {
    if (values == null) return [];
    if (!Array.isArray(values) || values.length > MAX_FEATURES) throw new Error('At most 16 verified reference boundaries may be loaded.');
    const budget = { vertices: 0 }, ids = new Set();
    return values.map(value => { const feature = normalizeBoundary(value, budget); if (ids.has(feature.id)) throw new Error('Boundary identifiers must be unique.'); ids.add(feature.id); return feature; });
  }
  function availability(values, { asOf = new Date().toISOString().slice(0, 10) } = {}) {
    let features;
    try { features = normalizeBoundaries(values); } catch (error) { return { status: 'unavailable', features: [], issues: [error.message] }; }
    if (!features.length) return { status: 'unavailable', features: [], issues: ['Verified International Boundary / LoC coordinates are unavailable for this selection. Required: authorized geometry, exact boundary kind, CRS, source, effective date and verification record.'] };
    const available = [], issues = [];
    for (const feature of features) {
      if (feature.source.effectiveDate > asOf || feature.verification.verifiedAt > asOf) issues.push(`${feature.label} · ${feature.name}: the effective or verification date is in the future; not drawn.`);
      else available.push(feature);
    }
    return { status: available.length ? issues.length ? 'partial' : 'available' : 'unavailable', features: available, issues };
  }
  function projectGeographic(longitude, latitude, origin) {
    if (!Number.isFinite(origin?.latitude) || !Number.isFinite(origin?.longitude) || Math.abs(origin.latitude) > 85 || Math.abs(origin.longitude) > 180) throw new Error('A verified chart origin is required to display geographic boundaries.');
    const rad = Math.PI / 180, p = latitude * rad, o = origin.latitude * rad, dl = (longitude - origin.longitude) * rad;
    const h = Math.sin((p - o) / 2) ** 2 + Math.cos(o) * Math.cos(p) * Math.sin(dl / 2) ** 2;
    const distance = 2 * 3440.065 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
    const bearing = Math.atan2(Math.sin(dl) * Math.cos(p), Math.cos(o) * Math.sin(p) - Math.sin(o) * Math.cos(p) * Math.cos(dl));
    return { xNm: distance * Math.sin(bearing), yNm: distance * Math.cos(bearing) };
  }
  // Liang–Barsky clipping changes only screen endpoints, never source vertices.
  function clipSegment(first, last, viewport) {
    const dx = last[0] - first[0], dy = last[1] - first[1];
    let low = 0, high = 1;
    const p = [-dx, dx, -dy, dy], q = [first[0] - viewport.x, viewport.x + viewport.width - first[0], first[1] - viewport.y, viewport.y + viewport.height - first[1]];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return null; continue; }
      const ratio = q[i] / p[i];
      if (p[i] < 0) low = Math.max(low, ratio); else high = Math.min(high, ratio);
      if (low > high) return null;
    }
    return [[first[0] + low * dx, first[1] + low * dy], [first[0] + high * dx, first[1] + high * dy]];
  }
  const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  function drawBoundaries(context, { features, project, viewport, visibleIds, obstacles = [], asOf, labelSpacingPx = 160 } = {}) {
    const available = availability(features, { asOf }), result = { ...available, segments: [], labels: [] };
    if (typeof project !== 'function' || !viewport || ![viewport.x, viewport.y, viewport.width, viewport.height].every(Number.isFinite) || viewport.width <= 0 || viewport.height <= 0) return { ...result, status: 'unavailable', issues: [...result.issues, 'A valid chart projection and viewport are required.'] };
    const visible = visibleIds == null ? null : new Set(visibleIds), occupied = [...obstacles];
    const spacing = Math.max(90, Math.min(280, Number(labelSpacingPx) || 160));
    context.save(); context.font = 'bold 12px Arial'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.lineJoin = 'round'; context.lineCap = 'round';
    for (const feature of available.features) {
      if (visible && !visible.has(feature.id)) continue;
      const segments = [];
      for (const part of feature.geometry.coordinates) {
        let projected;
        try { projected = part.map(([longitude, latitude]) => project(longitude, latitude)); }
        catch { result.issues.push(`${feature.label}: chart projection unavailable; part not drawn.`); continue; }
        if (projected.some(point => !Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite))) { result.issues.push(`${feature.label}: invalid chart projection; part not drawn.`); continue; }
        for (let i = 1; i < projected.length; i++) { const segment = clipSegment(projected[i - 1], projected[i], viewport); if (segment) segments.push(segment); }
      }
      const dash = feature.kind === 'IB' ? [] : feature.kind === 'LoC' ? [10, 5, 2, 5] : [5, 5];
      context.setLineDash(dash);
      for (const [color, width] of [['#07131d', 8], ['#f4f8fc', 5], [RED, 2.6]]) {
        context.strokeStyle = color; context.lineWidth = width; context.beginPath();
        for (const [first, last] of segments) { context.moveTo(...first); context.lineTo(...last); }
        context.stroke();
      }
      let untilLabel = Math.min(45, spacing / 2);
      for (const segment of segments) {
        result.segments.push({ id: feature.id, kind: feature.kind, points: segment });
        const [a, b] = segment, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length < .01) continue;
        for (let at = untilLabel; at <= length; at += spacing) {
          const x = a[0] + (b[0] - a[0]) * at / length, y = a[1] + (b[1] - a[1]) * at / length;
          const width = context.measureText(feature.label).width + 12, box = { x: x - width / 2, y: y - 11, width, height: 22 };
          if (box.x < viewport.x + 3 || box.y < viewport.y + 3 || box.x + box.width > viewport.x + viewport.width - 3 || box.y + box.height > viewport.y + viewport.height - 3 || occupied.some(other => overlaps(box, other))) continue;
          context.setLineDash([]); context.fillStyle = '#07131d'; context.fillRect(box.x, box.y, box.width, box.height);
          context.fillStyle = '#fff4f5'; context.fillText(feature.label, x, y);
          context.strokeStyle = RED; context.lineWidth = 1; context.strokeRect(box.x, box.y, box.width, box.height);
          occupied.push(box); result.labels.push({ id: feature.id, kind: feature.kind, label: feature.label, ...box });
        }
        untilLabel = ((untilLabel - length) % spacing + spacing) % spacing;
      }
    }
    context.restore(); return result;
  }
  function describeBoundary(feature) {
    return [`${KINDS[feature.kind]} · ${feature.name}`, `Source: ${feature.source.authority} · ${feature.source.title} · ${feature.source.section}`,
      `CRS: ${feature.source.crs}; longitude, latitude`, `Source effective date: ${feature.source.effectiveDate}`,
      `Verification: ${feature.verification.verifiedBy} · ${feature.verification.verifiedAt} · ${feature.verification.approvalReference}`,
      'Dated reference data; no live operational boundary or activation updates.'];
  }
  function createBoundaryControls(container, { onChange = () => {}, asOf } = {}) {
    if (!container?.ownerDocument) return null;
    const document = container.ownerDocument, hidden = new Set(); let snapshot = '', available = { features: [] }, enabled = true;
    const make = (tag, content) => { const element = document.createElement(tag); if (content != null) element.textContent = content; return element; };
    const section = make('section'), heading = make('h3', 'International Boundary / LoC'), status = make('p'), rows = make('div');
    section.className = 'published-boundary-controls'; status.className = 'hint'; status.setAttribute('role', 'status'); section.append(heading, status, rows); container.append(section);
    return Object.freeze({
      visibleIds() { return enabled ? available.features.filter(feature => !hidden.has(feature.id)).map(feature => feature.id) : []; },
      update(features, options = {}) {
        const next = JSON.stringify([features || [], options.enabled !== false]); if (next === snapshot) return; snapshot = next; enabled = options.enabled !== false;
        available = availability(features, { asOf }); rows.replaceChildren();
        status.textContent = available.features.length ? 'Verified reference geometry. Visibility affects this scope only.' : available.issues.join(' ');
        if (available.features.length && !enabled) status.textContent = 'Boundary layer is hidden in the exercise chart. Change it in Prepare airspace.';
        if (available.features.length && available.issues.length) status.textContent += ' ' + available.issues.join(' ');
        for (const feature of available.features) {
          const row = make('div'), label = make('label'), input = make('input'), swatch = make('span');
          input.type = 'checkbox'; input.checked = enabled && !hidden.has(feature.id); input.disabled = !enabled; input.setAttribute('aria-label', `Show ${feature.label} · ${feature.name}`);
          swatch.setAttribute('aria-hidden', 'true'); swatch.style.display = 'inline-block'; swatch.style.width = '24px'; swatch.style.borderTop = `3px ${feature.kind === 'IB' ? 'solid' : 'dashed'} ${RED}`; swatch.style.boxShadow = '0 0 0 1px #f4f8fc'; swatch.style.margin = '0 8px';
          input.addEventListener('change', () => { if (input.checked) hidden.delete(feature.id); else hidden.add(feature.id); onChange(); });
          label.append(input, swatch, document.createTextNode(`${feature.label} · ${feature.name}`));
          const details = make('details'), summary = make('summary', 'Source and boundary details'); details.append(summary);
          for (const line of describeBoundary(feature)) details.append(make('p', line));
          if (feature.source.url) { const link = make('a', 'Open source document'); link.href = feature.source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; details.append(link); }
          row.append(label, details); rows.append(row);
        }
      }
    });
  }
  return Object.freeze({ MAX_FEATURES, MAX_PARTS, MAX_VERTICES, normalizeBoundary, normalizeBoundaries, availability,
    projectGeographic, clipSegment, drawBoundaries, describeBoundary, createBoundaryControls });
});
