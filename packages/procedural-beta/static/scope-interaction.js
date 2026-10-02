// Delay a single mouse transmission until the double-click window closes.
// A double click turns once without sending a separate D/F transmission.
// Touch taps transmit; touch turns use the explicit controls.
export function createAircraftGestures({ onTransmit = () => {}, schedule = setTimeout, cancel = clearTimeout } = {}) {
    let previous = null, singleTimer = null;
    function reset() { if (singleTimer !== null) cancel(singleTimer); singleTimer = null; previous = null; }
    return {
        reset,
        press({ id, button, pointerType, time, x, y }) {
            if (!id || ![0, 1, 2].includes(button)) { reset(); return null; }
            if (pointerType === 'mouse' && button === 1) { reset(); return 'stop-turn'; }
            if (pointerType !== 'mouse') { reset(); if (button === 0) onTransmit(id); return null; }
            const paired = previous && previous.id === id && previous.button === button
                && time >= previous.time && time - previous.time <= 500
                && Math.hypot(x - previous.x, y - previous.y) <= 24;
            if (singleTimer !== null) cancel(singleTimer);
            singleTimer = null;
            previous = paired ? null : { id, button, time, x, y };
            if (!paired && button === 0) singleTimer = schedule(() => { singleTimer = null; previous = null; onTransmit(id); }, 500);
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
