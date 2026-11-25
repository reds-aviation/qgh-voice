/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

// Homepage illustration. Coordinates use the original 2172 × 724 artwork grid.
(() => {
  'use strict';
  const hero = document.querySelector('.suite-hero');
  const canvas = hero?.querySelector('.hero-radar');
  const toggle = hero?.querySelector('.hero-motion-toggle');
  if (!canvas || !toggle || !document.currentScript?.src) return;
  const compactArt = matchMedia('(max-width: 760px) and (max-resolution: 1.5dppx)').matches;
  const artURL = new URL(compactArt ? 'hero-airspace-760.webp' : 'hero-airspace.webp', document.currentScript.src);
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const width = 2172, height = 724, radius = 280, cx = 1433, cy = 307;
  const tau = 2 * Math.PI, sweepSeconds = 9;

  // Follow the dashed lines already on the chart. Each track includes its printed starting position.
  const tracks = [
    {origin: 1, speed: 20, points: [[1300,241],[1265,215],[1210,178],[1155,139],[1104,112],[1053,82],[1023,65]]},
    {origin: 2, speed: 15, points: [[1302,242],[1316,254],[1334,268],[1354,281]]},
    {origin: 2, speed: 30, points: [[1518,245],[1555,217],[1614,186],[1677,162],[1755,132],[1850,94],[1918,69],[1974,42],[2020,6]]},
    {origin: 3, speed: 25, points: [[1343,341],[1297,363],[1259,388],[1230,402],[1185,420],[1145,435],[1105,449],[1081,465],[1013,501],[943,540],[864,585],[820,612]]},
    {origin: 3, speed: 23, points: [[1567,672],[1542,610],[1515,544],[1495,494],[1478,454],[1463,412]]}
  ];

  function surface(w, h) {
    const result = document.createElement('canvas');
    result.width = w;
    result.height = h;
    return result;
  }

  // Recover the ink from each small silhouette. Leave the paper and lighter chart marks
  // surrounding it on the backdrop, so moving the sprite never carries a rectangular patch.
  function liftAircraft(background, x, y) {
    const half = 14, side = half * 2 + 1;
    const tile = background.getImageData(x - half, y - half, side, side);
    const pixels = tile.data;
    const sprite = surface(side, side);
    const brush = sprite.getContext('2d');
    const foreground = brush.createImageData(side, side);
    const neighbors = [-side-1,-side,-side+1,-1,1,side-1,side,side+1];
    const ink = new Set([half * side + half]);
    const queue = [...ink];
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      for (const offset of neighbors) {
        const next = p + offset;
        if (next < 0 || next >= side * side || Math.abs(next % side - p % side) > 1 || ink.has(next)) continue;
        if (pixels[4 * next] < 136) { ink.add(next); queue.push(next); }
      }
    }
    const edge = new Set();
    for (const p of ink) {
      for (const offset of neighbors) {
        const q = p + offset;
        if (q >= 0 && q < side * side && Math.abs(q % side - p % side) <= 1 && !ink.has(q)) edge.add(q);
      }
    }
    const paper = [0, 1, 2].map(channel => {
      const samples = [];
      for (let i = 0; i < side * side; i++) {
        if (!ink.has(i) && !edge.has(i)) samples.push(pixels[4 * i + channel]);
      }
      return samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)];
    });
    const inkRed = Math.min(...[...ink].map(i => pixels[4 * i]));
    for (const p of [...ink, ...edge]) {
      const offset = 4 * p;
      const alpha = Math.min(1, Math.max(0, (paper[0] - pixels[offset]) / (paper[0] - inkRed)));
      if (alpha < .045) continue;
      for (let channel = 0; channel < 3; channel++) {
        foreground.data[offset + channel] = paper[channel] + (pixels[offset + channel] - paper[channel]) / alpha;
        pixels[offset + channel] = paper[channel];
      }
      foreground.data[offset + 3] = Math.round(255 * alpha);
    }
    brush.putImageData(foreground, 0, 0);
    background.putImageData(tile, x - half, y - half);
    return sprite;
  }

  function makeTrack(config, backdrop) {
    const {points, origin, speed} = config;
    const distances = [0];
    for (let i = 1; i < points.length; i++) {
      distances.push(distances[i-1] + Math.hypot(points[i][0] - points[i-1][0], points[i][1] - points[i-1][1]));
    }
    const length = distances[distances.length - 1];
    function point(distance) {
      let i = 1;
      while (i < points.length - 1 && distance > distances[i]) i++;
      const f = (distance - distances[i-1]) / (distances[i] - distances[i-1]);
      return {x: points[i-1][0] + f * (points[i][0] - points[i-1][0]),
              y: points[i-1][1] + f * (points[i][1] - points[i-1][1])};
    }
    function heading(distance) {
      const before = point(Math.max(0, distance - 3)), after = point(Math.min(length, distance + 3));
      return Math.atan2(after.y - before.y, after.x - before.x);
    }
    const start = distances[origin], startHeading = heading(start);
    const sprite = liftAircraft(backdrop, ...points[origin]);
    const fadeDistance = Math.min(15, length * .15);
    return {
      sprite,
      at(seconds) {
        const d = (start + speed * seconds) % length;
        return {...point(d), rotation: heading(d) - startHeading, opacity: Math.min(1, d / fadeDistance, (length - d) / fadeDistance)};
      }
    };
  }

  function makeSweep() {
    const tile = surface(radius * 2 + 4, radius * 2 + 4);
    const pen = tile.getContext('2d');
    pen.translate(radius + 2, radius + 2);
    const arc = .65, slices = 64;
    for (let i = 0; i < slices; i++) {
      pen.beginPath();
      pen.moveTo(0, 0);
      pen.arc(0, 0, radius, -arc + i * arc / slices, -arc + (i + 1) * arc / slices);
      pen.closePath();
      pen.fillStyle = 'rgba(24,111,151,' + (.18 * (i + 1) / slices) + ')';
      pen.fill();
    }
    const beam = pen.createLinearGradient(0, 0, radius, 0);
    beam.addColorStop(0, 'rgba(23,99,139,.06)');
    beam.addColorStop(.68, 'rgba(23,99,139,.65)');
    beam.addColorStop(1, 'rgba(23,99,139,.44)');
    pen.strokeStyle = beam;
    pen.lineWidth = 2.5;
    pen.beginPath(); pen.moveTo(0, 0); pen.lineTo(radius, 0); pen.stroke();
    return tile;
  }

  let draw, loading = false, onScreen = true, paused = false;
  let frame = 0, lastPaint = null, elapsed = 0;
  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; lastPaint = null;
  }
  function play(timestamp) {
    if (lastPaint === null) lastPaint = timestamp;
    const delta = timestamp - lastPaint;
    if (delta >= 1000 / 30 - 1) {
      elapsed += Math.min(delta, 150) / 1000;
      draw(elapsed); lastPaint = timestamp;
    }
    frame = requestAnimationFrame(play);
  }
  function update() {
    const enabled = !!draw && !motionPreference.matches;
    hero.classList.toggle('hero-radar-ready', enabled);
    toggle.hidden = !enabled;
    if (enabled && onScreen && !document.hidden && !paused) {
      if (!frame) frame = requestAnimationFrame(play);
    } else stop();
    if (!draw && !loading && !motionPreference.matches) loadArt();
  }
  function loadArt() {
    loading = true;
    const art = new Image();
    art.onload = () => {
      if (Math.abs(art.naturalHeight - art.naturalWidth * height / width) > 1) return;
      const background = surface(width, height), backdrop = background.getContext('2d', {willReadFrequently: true});
      const pen = canvas.getContext('2d');
      if (!pen || !backdrop) return;
      /* Match the original grid even when the browser loads a smaller artwork file. */
      backdrop.drawImage(art, 0, 0, width, height);
      const aircraft = tracks.map(config => makeTrack(config, backdrop));
      const sweep = makeSweep(), padding = radius + 3;
      canvas.width = width; canvas.height = height;
      pen.drawImage(background, 0, 0);
      let previous = [];
      draw = seconds => {
        // Only the sweep disc and the small former aircraft positions need repainting.
        pen.drawImage(background, cx-padding, cy-padding, padding*2, padding*2, cx-padding, cy-padding, padding*2, padding*2);
        for (const pos of previous) {
          const x = Math.floor(pos.x) - 23, y = Math.floor(pos.y) - 23;
          pen.drawImage(background, x, y, 46, 46, x, y, 46, 46);
        }
        pen.save();
        pen.translate(cx, cy);
        pen.rotate(-Math.PI / 2 + seconds * tau / sweepSeconds);
        pen.drawImage(sweep, -sweep.width / 2, -sweep.height / 2);
        pen.restore();
        previous = aircraft.map(plane => {
          const pos = plane.at(seconds);
          pen.save();
          pen.translate(pos.x + .5, pos.y + .5); pen.rotate(pos.rotation);
          pen.globalAlpha = pos.opacity;
          pen.drawImage(plane.sprite, -plane.sprite.width / 2, -plane.sprite.height / 2);
          pen.restore();
          return pos;
        });
      };
      draw(0);
      update();
    };
    art.src = artURL.href;
  }

  toggle.addEventListener('click', () => {
    paused = !paused;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Resume radar animation' : 'Pause radar animation');
    update();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); }).observe(hero);
  }
  motionPreference.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  update();
})();
