/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

// Keep ten simulated minutes regardless of the browser's polling frequency.
export function recordTrail(history, point) {
    const last = history.at(-1);
    if (last && point.t < last.t)
        return [point];
    const recent = history.filter(p => point.t - p.t < 600);
    if (!last || point.t - last.t >= 1)
        recent.push(point);
    return recent;
}
// Keep dots legible at the selected range, including recently spawned traffic.
export function trailSpacing(scale, speedKt = 240) {
    return Math.max(0.02, Math.min(9 / Math.max(scale, 0.001), Math.max(0.02, speedKt / 3600 * 15)));
}
// Sample the flown path backwards by distance, not browser polling frequency.
// Never include the aircraft symbol or invent history before its first sample.
export function trailDots(history, current, spacing, count = 5) {
    if (!Number.isFinite(spacing) || spacing <= 0)
        return [];
    const dots = [];
    let from = current, travelled = 0, next = spacing;
    for (let i = history.length - 1; i >= 0 && dots.length < count; i--) {
        const to = history[i];
        if (to.t > current.t)
            continue;
        const distance = Math.hypot(to.x - from.x, to.y - from.y);
        if (distance > 0) {
            while (travelled + distance >= next && dots.length < count) {
                const fraction = (next - travelled) / distance;
                dots.push({ x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction, t: from.t + (to.t - from.t) * fraction });
                next += spacing;
            }
            travelled += distance;
        }
        from = to;
    }
    return dots;
}
