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
export function reserveLabel(anchor, textWidth, width, height, occupied) {
    const boxWidth = textWidth + 8, boxHeight = 16;
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
