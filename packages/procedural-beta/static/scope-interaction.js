// A gesture selects a target first; only a deliberate pair of mouse presses
// on the same target and button can issue a turn. Touch uses explicit buttons.
export function createAircraftGestures() {
    let previous = null;
    return {
        reset() { previous = null; },
        press({ id, button, pointerType, time, x, y }) {
            if (!id || pointerType !== 'mouse' || ![0, 2].includes(button)) { previous = null; return null; }
            const paired = previous && previous.id === id && previous.button === button
                && time >= previous.time && time - previous.time <= 500
                && Math.hypot(x - previous.x, y - previous.y) <= 24;
            previous = paired ? null : { id, button, time, x, y };
            return paired ? (button === 2 ? 'right' : 'left') : null;
        },
    };
}

export function nearestAircraft(aircraft, point, scale, radius = 24) {
    let nearest = null, distance = radius;
    for (const candidate of aircraft || []) {
        if (candidate.status === 'scheduled') continue;
        const d = Math.hypot(candidate.xNm - point.x, candidate.yNm - point.y) * scale;
        if (d < distance) { nearest = candidate; distance = d; }
    }
    return nearest;
}
