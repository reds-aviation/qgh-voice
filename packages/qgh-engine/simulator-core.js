/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

(function exposeQghCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QGHCore = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function createQghCore() {
  const EPSILON = 1e-9;

  function normalize(angle) {
    return ((angle % 360) + 360) % 360;
  }

  function radians(angle) {
    return angle * Math.PI / 180;
  }

  function turnRadiusNm(speedKt, rateDegPerSecond) {
    const speed = Math.abs(Number(speedKt));
    const rateRadians = Math.abs(Number(rateDegPerSecond)) * Math.PI / 180;
    if (!Number.isFinite(speed) || !Number.isFinite(rateRadians) || rateRadians < EPSILON) {
      return Infinity;
    }
    return speed / 3600 / rateRadians;
  }

  function createOrbit(side, heading) {
    if (side !== 'left' && side !== 'right') throw new Error('Orbit direction must be left or right.');
    if (!Number.isFinite(heading)) throw new Error('Orbit entry heading must be finite.');
    return { side, entryHeading: normalize(heading), degrees: 0, laps: 0 };
  }

  function advanceOrbit(orbit, signedDelta) {
    if (!orbit || !['left', 'right'].includes(orbit.side) || !Number.isFinite(signedDelta)) {
      throw new Error('Orbit state and heading change must be valid.');
    }
    const progress = signedDelta * (orbit.side === 'left' ? -1 : 1);
    if (progress <= 0) return 0;
    orbit.degrees += progress;
    const laps = Math.floor((orbit.degrees + EPSILON) / 360);
    const completed = laps - orbit.laps;
    orbit.laps = laps;
    return completed;
  }

  function orbitAtEntry(orbit) {
    return Math.abs(orbit.degrees - Math.round(orbit.degrees / 360) * 360) <= EPSILON;
  }

  function resumeOrbit(orbit) {
    if (!orbit || !['left', 'right'].includes(orbit.side)) throw new Error('Orbit is not active.');
    orbit.exitRequested = true;
    return orbitAtEntry(orbit);
  }

  function advanceOrbitMotion(plane, speed, rate, duration, orbit) {
    if (!orbit || !['left', 'right'].includes(orbit.side)
      || ![speed, rate, duration].every(Number.isFinite) || speed < 0 || rate <= 0 || duration < 0) {
      throw new Error('Orbit motion needs a valid orbit, speed, positive turn rate and duration.');
    }
    const direction = orbit.side === 'left' ? -1 : 1;
    const remaining = orbit.exitRequested
      ? orbitAtEntry(orbit) ? 0 : 360 - normalize(orbit.degrees)
      : Infinity;
    const turnSeconds = Math.min(duration, remaining / rate);
    const turning = advanceArc(plane, plane.heading, speed, direction * rate, turnSeconds);
    const completedLaps = advanceOrbit(orbit, direction * rate * turnSeconds);
    const exited = Boolean(orbit.exitRequested && remaining <= rate * duration + EPSILON);
    if (!exited) return { ...turning, completedLaps, exited: false };
    // Complete the circle at the selected rate, then fly the remainder straight.
    // Spreading a smaller heading delta over the full step would change the radius.
    const straight = advanceArc(turning, orbit.entryHeading, speed, 0, Math.max(0, duration - turnSeconds));
    return { ...straight, distanceNm: turning.distanceNm + straight.distanceNm, completedLaps, exited: true };
  }

  function advanceArc(point, headingDeg, speedKt, signedRateDegPerSecond, durationSeconds) {
    const x = Number(point && point.x);
    const y = Number(point && point.y);
    const speed = Number(speedKt);
    const duration = Number(durationSeconds);
    const signedRate = Number(signedRateDegPerSecond);
    const rawHeading = Number(headingDeg);
    if (![x, y, speed, duration, signedRate, rawHeading].every(Number.isFinite)) {
      throw new Error('Arc inputs must be finite numbers.');
    }
    const heading = normalize(rawHeading);
    const distanceNm = speed * duration / 3600;
    const deltaDeg = signedRate * duration;
    const startRadians = radians(heading);

    if (Math.abs(deltaDeg) < EPSILON) {
      return {
        x: x + Math.sin(startRadians) * distanceNm,
        y: y - Math.cos(startRadians) * distanceNm,
        heading,
        distanceNm
      };
    }

    const deltaRadians = radians(deltaDeg);
    const endRadians = startRadians + deltaRadians;
    const scale = distanceNm / deltaRadians;

    return {
      x: x + scale * (Math.cos(startRadians) - Math.cos(endRadians)),
      y: y + scale * (Math.sin(startRadians) - Math.sin(endRadians)),
      heading: normalize(heading + deltaDeg),
      distanceNm
    };
  }

  // A heading target may be reached part way through a flight step. Keep the
  // selected turn rate until that instant, then fly the leftover time straight.
  function advanceHeadingMotion(point, heading, speed, rate, duration, signedDelta) {
    if (![heading, speed, rate, duration, signedDelta].every(Number.isFinite)
      || speed < 0 || rate <= 0 || duration < 0 || Math.abs(signedDelta) > rate * duration + EPSILON) {
      throw new Error('Heading motion needs finite speed, positive rate and a bounded heading change.');
    }
    const turnSeconds = Math.min(duration, Math.abs(signedDelta) / rate);
    const turning = advanceArc(point, heading, speed, Math.sign(signedDelta) * rate, turnSeconds);
    const straight = advanceArc(turning, turning.heading, speed, 0, Math.max(0, duration - turnSeconds));
    return { ...straight, distanceNm: turning.distanceNm + straight.distanceNm };
  }

  function closestApproachToOverhead(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared < EPSILON ? 0 : Math.max(0, Math.min(1, -(start.x * dx + start.y * dy) / lengthSquared));
    const x = start.x + dx * t;
    const y = start.y + dy * t;
    return { x, y, t, rangeNm: Math.hypot(x, y) };
  }

  // Browser callback count is not elapsed time. Keep fixed recorded samples,
  // carry the fractional remainder, and refuse long silent catch-up intervals.
  function createFlightClock(stepSeconds = .25, maximumGapSeconds = 2) {
    if (![stepSeconds, maximumGapSeconds].every(Number.isFinite) || stepSeconds <= 0 || maximumGapSeconds < stepSeconds) {
      throw new Error('Flight clock needs a positive step and bounded processing gap.');
    }
    let previous = null, accumulator = 0;
    function reset(timestampMs) {
      if (!Number.isFinite(timestampMs)) throw new Error('Flight clock timestamp must be finite.');
      previous = timestampMs; accumulator = 0;
    }
    function consume(timestampMs) {
      if (!Number.isFinite(timestampMs)) throw new Error('Flight clock timestamp must be finite.');
      if (previous == null) { reset(timestampMs); return { steps: 0, suspended: false }; }
      const elapsed = Math.max(0, (timestampMs - previous) / 1000);
      previous = timestampMs;
      if (elapsed > maximumGapSeconds) { accumulator = 0; return { steps: 0, suspended: true }; }
      accumulator += elapsed;
      const steps = Math.floor((accumulator + EPSILON) / stepSeconds);
      accumulator = Math.max(0, accumulator - steps * stepSeconds);
      return { steps, suspended: false };
    }
    return Object.freeze({ reset, consume });
  }

  return { normalize, radians, turnRadiusNm, advanceArc, advanceHeadingMotion, closestApproachToOverhead,
    createOrbit, advanceOrbit, resumeOrbit, advanceOrbitMotion, createFlightClock };
});
