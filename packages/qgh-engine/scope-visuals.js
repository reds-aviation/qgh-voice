(function exposeScopeVisuals(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ATCScopeVisuals = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function createScopeVisuals() {
  'use strict';
  const GLYPH_SIZE = 12;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const overlaps = (a, b, gap = 0) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x
    && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;

  function canvasMetrics(canvas, pixelRatio = 1) {
    const bounds = canvas.getBoundingClientRect?.();
    const previousRatio = number(canvas.dataset?.scopePixelRatio, 1) || 1;
    const width = Math.max(1, number(canvas.clientWidth || bounds?.width || canvas.width / previousRatio, 900));
    const height = Math.max(1, number(canvas.clientHeight || bounds?.height || canvas.height / previousRatio, 700));
    const ratio = Math.max(1, number(pixelRatio, 1));
    if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
    if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio);
    if (canvas.dataset) canvas.dataset.scopePixelRatio = String(ratio);
    const context = canvas.getContext('2d');
    context.setTransform?.(ratio, 0, 0, ratio, 0, 0);
    return { context, width, height, pixelRatio: ratio };
  }

  function rangeRings(options = {}) {
    const range = Math.max(0, number(options.rangeNm, 0)), spacing = Number(options.spacingNm) === 5 ? 5 : 10;
    const scale = Math.max(0, number(options.scale, 1)), cx = number(options.cx, 0), cy = number(options.cy, 0);
    const width = Math.max(0, number(options.width, Infinity)), height = Math.max(0, number(options.height, Infinity));
    const labelEvery = Math.max(1, Math.ceil(number(options.labelSpacingPx, 34) / Math.max(.001, spacing * scale)));
    const distances = [];
    for (let distance = spacing; distance <= range + 1e-9; distance += spacing) distances.push(distance);
    if (range > 0 && (!distances.length || Math.abs(distances.at(-1) - range) > 1e-9)) distances.push(range);
    const nearest = Math.hypot(cx - clamp(cx, 0, width), cy - clamp(cy, 0, height));
    const farthest = Math.max(...[[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
    return distances.map((distance, index) => {
      const radius = distance * scale;
      return { distanceNm: distance, radius, cx, cy, boundary: Math.abs(distance - range) <= 1e-9,
        visible: radius >= nearest - 1 && radius <= farthest + 1,
        label: index % labelEvery === 0 || Math.abs(distance - range) <= 1e-9 };
    });
  }

  function drawRangeRings(context, options) {
    const rings = rangeRings(options), width = options.width, height = options.height;
    context.save(); context.lineWidth = 1; context.textAlign = 'left'; context.textBaseline = 'alphabetic';
    if (options.strokeStyle) context.strokeStyle = options.strokeStyle;
    if (options.fillStyle) context.fillStyle = options.fillStyle;
    if (options.font) context.font = options.font;
    for (const ring of rings) {
      if (!ring.visible) continue;
      context.beginPath(); context.arc(ring.cx, ring.cy, ring.radius, 0, Math.PI * 2); context.stroke();
      if (!ring.label || options.labels === false) continue;
      const text = `${Math.round(ring.distanceNm * 10) / 10} NM`;
      const textWidth = context.measureText?.(text)?.width || text.length * 7;
      for (const degrees of [-90, -45, -135, 0, 180, 45, 135, 90]) {
        const angle = degrees * Math.PI / 180;
        const x = ring.cx + Math.cos(angle) * ring.radius + 5;
        const y = ring.cy + Math.sin(angle) * ring.radius + 12;
        const box = { x, y: y - 12, width: textWidth, height: 14 };
        if (box.x >= 3 && box.y >= 3 && box.x + box.width <= width - 3 && box.y + box.height <= height - 3
          && !(options.obstacles || []).some(obstacle => overlaps(box, obstacle, 3))) {
          context.fillText(text, x, y); break;
        }
      }
    }
    context.restore();
    return rings;
  }

  function drawAircraftGlyph(context, options) {
    const x = number(options.x, 0), y = number(options.y, 0), size = Math.max(1, number(options.size, GLYPH_SIZE));
    const scale = size / GLYPH_SIZE, color = options.color || '#7ee8fa';
    context.save(); context.translate(x, y); context.rotate(number(options.headingDeg, 0) * Math.PI / 180);
    context.fillStyle = color; context.strokeStyle = options.outline || color; context.lineWidth = .75 * scale;
    context.beginPath();
    [[0, -6], [1.2, -1.5], [6, 1.7], [6, 3], [1.1, 1.1], [1.1, 4.7], [3, 5.8], [3, 6.5],
      [0, 5.7], [-3, 6.5], [-3, 5.8], [-1.1, 4.7], [-1.1, 1.1], [-6, 3], [-6, 1.7], [-1.2, -1.5]]
      .forEach(([px, py], index) => index ? context.lineTo(px * scale, py * scale) : context.moveTo(px * scale, py * scale));
    context.closePath(); context.fill(); context.stroke(); context.restore();
    if (options.selected) {
      context.save(); context.strokeStyle = options.selectionColor || color; context.lineWidth = 1;
      context.beginPath(); context.arc(x, y, 10 * scale, 0, Math.PI * 2); context.stroke(); context.restore();
    }
    return { x: x - 10 * scale, y: y - 10 * scale, width: 20 * scale, height: 20 * scale };
  }

  function overlayObstacles(canvas, options = {}) {
    const document = options.document || canvas.ownerDocument;
    const canvasBounds = canvas.getBoundingClientRect?.();
    if (!document?.querySelectorAll || !canvasBounds?.width || !canvasBounds?.height) return [];
    const width = options.width || canvas.clientWidth || canvasBounds.width;
    const height = options.height || canvas.clientHeight || canvasBounds.height;
    const selectors = options.selectors || '.ats-aircraft-shelf > *, .ats-tool-rail > *, .scope-edge-actions > *, .console-control-rail > *, #homing, #pilot-readback, #scope-manual-dock';
    const result = [];
    for (const element of document.querySelectorAll(selectors)) {
      if (element.hidden || element.closest?.('[hidden]') || element.getClientRects?.().length === 0) continue;
      const style = document.defaultView?.getComputedStyle?.(element);
      if (style?.display === 'none' || style?.visibility === 'hidden') continue;
      const bounds = element.getBoundingClientRect?.();
      if (!bounds?.width || !bounds?.height) continue;
      const x = (bounds.left - canvasBounds.left) * width / canvasBounds.width;
      const y = (bounds.top - canvasBounds.top) * height / canvasBounds.height;
      const right = Math.min(width, x + bounds.width * width / canvasBounds.width);
      const bottom = Math.min(height, y + bounds.height * height / canvasBounds.height);
      const left = Math.max(0, x), top = Math.max(0, y);
      if (right > left && bottom > top) result.push({ x: left, y: top, width: right - left, height: bottom - top });
    }
    return result;
  }

  function labelMode(value) { return ['selected', 'all', 'off'].includes(value) ? value : 'selected'; }

  // Current velocity extrapolated for one minute, in NM (east/north).
  // This display vector does not predict a commanded turn or acceleration.
  function minuteVectorNm(options = {}) {
    const heading = number(options.headingDeg, 0) * Math.PI / 180;
    const speed = Math.max(0, number(options.speedKt, 0)) / 60;
    const windAngle = (number(options.windDirectionDeg, 0) + 180) * Math.PI / 180;
    const wind = options.airborne === false ? 0 : Math.max(0, number(options.windSpeedKt, 0)) / 60;
    return { xNm: Math.sin(heading) * speed + Math.sin(windAngle) * wind,
      yNm: Math.cos(heading) * speed + Math.cos(windAngle) * wind };
  }

  function aircraftLabels(aircraft, options = {}) {
    const mode = labelMode(options.mode), measure = options.measure || (text => text.length * 7);
    if (mode === 'off') return [];
    return aircraft.map(item => {
      const full = item.selected || mode === 'all';
      const lines = [String(item.callsign || item.id || ''), ...(full ? item.details || [] : [])];
      return { ...item, lines, full, width: Math.max(...lines.map(line => number(measure(line), line.length * 7))) + 10,
        height: lines.length * 14 + 8 };
    });
  }

  function placeAircraftLabels(items, options = {}) {
    const width = Math.max(1, number(options.width, 900)), height = Math.max(1, number(options.height, 700));
    const padding = number(options.padding, 5), gap = number(options.gap, 4);
    const symbols = (options.aircraft || items).map(item => ({ x: item.x - 11, y: item.y - 11, width: 22, height: 22 }));
    const occupied = [...(options.obstacles || []), ...symbols], result = [];
    for (const item of items.slice().sort((a, b) => Number(b.selected) - Number(a.selected))) {
      if (item.x < 0 || item.y < 0 || item.x > width || item.y > height) continue;
      const w = Math.min(item.width, width - padding * 2), h = item.height;
      if (w <= 0 || h > height - padding * 2) continue;
      const candidates = [], seen = new Set();
      const add = (x, y) => {
        const box = { x: clamp(x, padding, width - padding - w), y: clamp(y, padding, height - padding - h), width: w, height: h };
        const key = `${Math.round(box.x)}:${Math.round(box.y)}`;
        if (!seen.has(key)) { candidates.push(box); seen.add(key); }
      };
      for (const distance of [15, 32, 64, 100, 150, 220, 320]) {
        add(item.x + distance, item.y - h / 2); add(item.x - w - distance, item.y - h / 2);
        add(item.x - w / 2, item.y - h - distance); add(item.x - w / 2, item.y + distance);
        for (const dx of [-1, 1]) for (const dy of [-1, 1]) add(item.x + (dx > 0 ? distance : -w - distance), item.y + (dy > 0 ? distance : -h - distance));
      }
      let box = candidates.find(candidate => !occupied.some(obstacle => overlaps(candidate, obstacle, gap)));
      if (!box) {
        let nearest = Infinity;
        for (let y = padding; y + h <= height - padding; y += 16) for (let x = padding; x + w <= width - padding; x += 16) {
          const candidate = { x, y, width: w, height: h };
          const distance = Math.hypot(x + w / 2 - item.x, y + h / 2 - item.y);
          if (distance < nearest && !occupied.some(obstacle => overlaps(candidate, obstacle, gap))) { box = candidate; nearest = distance; }
        }
      }
      if (!box) continue;
      occupied.push(box);
      const end = { x: clamp(item.x, box.x, box.x + box.width), y: clamp(item.y, box.y, box.y + box.height) };
      const distance = Math.hypot(end.x - item.x, end.y - item.y);
      const leader = distance > 12 ? { x1: item.x + (end.x - item.x) * 10 / distance, y1: item.y + (end.y - item.y) * 10 / distance, x2: end.x, y2: end.y } : null;
      result.push({ ...item, box, leader });
    }
    return result;
  }

  function drawAircraftLabels(context, placements, options = {}) {
    context.save(); context.font = options.font || '11px IBM Plex Mono, monospace'; context.textAlign = 'left'; context.textBaseline = 'alphabetic';
    for (const item of placements) {
      const color = item.color || (item.selected ? '#ffd66e' : '#7ee8fa');
      if (item.leader) {
        context.strokeStyle = color; context.lineWidth = .65; context.globalAlpha = .65;
        context.beginPath(); context.moveTo(item.leader.x1, item.leader.y1); context.lineTo(item.leader.x2, item.leader.y2); context.stroke();
      }
      context.globalAlpha = .94; context.fillStyle = options.background || '#12191e';
      context.fillRect(item.box.x, item.box.y, item.box.width, item.box.height);
      context.globalAlpha = 1; context.fillStyle = color;
      item.lines.forEach((text, index) => context.fillText(text, item.box.x + 5, item.box.y + 14 + index * 14, item.box.width - 10));
    }
    context.restore();
  }

  return Object.freeze({ GLYPH_SIZE, canvasMetrics, rangeRings, drawRangeRings, drawAircraftGlyph,
    overlayObstacles, labelMode, minuteVectorNm, aircraftLabels, placeAircraftLabels, drawAircraftLabels, overlaps });
});
