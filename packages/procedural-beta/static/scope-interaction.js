/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

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

// Keep the dedicated Stop gesture separate from delayed single-click D/F and
// double-click turning. The caller supplies current selection and authority.
export function bindMiddleMouseStop(element, { isAllowed = () => false, getTargetId = () => null,
    onReset = () => {}, onStop = () => {} } = {}) {
    if (!element?.addEventListener) return null;
    let pressed = null;
    const preventDefault = event => { if (event.button === 1) event.preventDefault(); };
    function cancel(event) {
        if (event && pressed && event.pointerId !== pressed.pointerId) return;
        const pointerId = pressed?.pointerId; pressed = null;
        if (pointerId != null && element.hasPointerCapture?.(pointerId)) element.releasePointerCapture?.(pointerId);
    }
    function down(event) {
        if (event.button !== 1) return;
        event.preventDefault(); cancel();
        if (event.isPrimary === false || event.pointerType && event.pointerType !== 'mouse' || !isAllowed()) return;
        onReset();
        const id = getTargetId(event);
        if (!id || !isAllowed(id)) return;
        pressed = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
        if (event.pointerId != null) element.setPointerCapture?.(event.pointerId);
    }
    function move(event) {
        if (pressed && pressed.pointerId === event.pointerId
            && Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 5) cancel();
    }
    function up(event) {
        if (event.button !== 1) return;
        event.preventDefault();
        if (!pressed || pressed.pointerId !== event.pointerId) return;
        const action = pressed; cancel();
        if (isAllowed(action.id) && Math.hypot(event.clientX - action.x, event.clientY - action.y) <= 5) onStop(action.id);
    }
    const listeners = { pointerdown: down, pointermove: move, pointerup: up,
        pointercancel: cancel, lostpointercapture: cancel, mousedown: preventDefault, auxclick: preventDefault };
    for (const [type, listener] of Object.entries(listeners)) element.addEventListener(type, listener);
    return Object.freeze({ cancel, close() { cancel(); for (const [type, listener] of Object.entries(listeners)) element.removeEventListener?.(type, listener); } });
}
