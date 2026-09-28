// Keep five simulated minutes regardless of the browser's polling frequency.
export function recordTrail(history, point) {
    const last = history.at(-1);
    if (last && point.t < last.t)
        return [point];
    const recent = history.filter(p => point.t - p.t < 300);
    if (!last || point.t - last.t >= 1)
        recent.push(point);
    return recent;
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
