/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

// Clip a displayed segment, not its published geometry. This also finds a
// label anchor when both route endpoints are outside the current viewport.
export function visibleSegment(a, b, width, height, margin = 12) {
    let start = 0, end = 1;
    const dx = b.x - a.x, dy = b.y - a.y;
    for (const [p, q] of [[-dx, a.x - margin], [dx, width - margin - a.x], [-dy, a.y - margin], [dy, height - margin - a.y]]) {
        if (p === 0) {
            if (q < 0)
                return null;
            continue;
        }
        const t = q / p;
        if (p < 0)
            start = Math.max(start, t);
        else
            end = Math.min(end, t);
        if (start > end)
            return null;
    }
    return [{ x: a.x + start * dx, y: a.y + start * dy }, { x: a.x + end * dx, y: a.y + end * dy }];
}
export function reserveLabel(anchor, textWidth, width, height, occupied, boxHeight = 16) {
    const boxWidth = textWidth + 8;
    for (const [dx, dy] of [[7, -19], [7, 5], [-boxWidth - 7, -19], [-boxWidth - 7, 5]]) {
        const box = { x: anchor.x + dx, y: anchor.y + dy, width: boxWidth, height: boxHeight };
        if (box.x < 4 || box.y < 4 || box.x + box.width > width - 4 || box.y + box.height > height - 4)
            continue;
        if (occupied.some(o => box.x < o.x + o.width + 5 && box.x + box.width + 5 > o.x && box.y < o.y + o.height + 5 && box.y + box.height + 5 > o.y))
            continue;
        occupied.push(box);
        return box;
    }
    return null;
}
export function fitNavigation(points, width, height) {
    const valid = points.filter(p => Number.isFinite(p.xNm) && Number.isFinite(p.yNm));
    if (!valid.length || width <= 60 || height <= 60)
        return null;
    const left = Math.min(...valid.map(p => p.xNm)), right = Math.max(...valid.map(p => p.xNm));
    const bottom = Math.min(...valid.map(p => p.yNm)), top = Math.max(...valid.map(p => p.yNm));
    const minimumDimension = Math.min(width, height);
    const required = Math.max((right - left) / (width - 60), (top - bottom) / (height - 60)) * minimumDimension / 2.3;
    const range = Math.max(5, Math.min(2000, Math.ceil(required * 1.08 / 5) * 5));
    const scale = minimumDimension / (range * 2.3);
    return { range, pan: { x: -(left + right) / 2 * scale, y: (bottom + top) / 2 * scale } };
}
export function approachReference(distanceNm, elevationFt, crossingHeightFt) {
    const heightFt = crossingHeightFt + distanceNm * 6076.11548556 * Math.tan(3 * Math.PI / 180);
    return { heightFt, altitudeFt: elevationFt + heightFt };
}
