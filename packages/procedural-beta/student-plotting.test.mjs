import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { domHarness } from './testing/dom-harness.mjs';
const source = readFileSync(new URL('./static/student-plotting.js', import.meta.url), 'utf8');
const uri = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const { validateStudentPlots } = await import(uri(source));

test('student plots persist only callsign and local estimate coordinates, reject malformed data', () => {
    const sanitized = validateStudentPlots([{ id: 'p1', callsign: ' 101 ', xNm: 2, yNm: -4, altitudeFt: 5000, actualAircraftId: 'a1', token: 'private' }]);
    assert.deepEqual(sanitized, [{ id: 'p1', callsign: '101', xNm: 2, yNm: -4 }]);
    for (const data of [null, [{ id: 'p1', callsign: '', xNm: 0, yNm: 0 }], [{ id: 'p1', callsign: '101', xNm: NaN, yNm: 0 }], [{ id: 'p1', callsign: '101', xNm: 2001, yNm: 0 }], [...sanitized, { ...sanitized[0], id: 'p2' }], Array.from({ length: 25 }, (_, i) => ({ id: String(i), callsign: String(i), xNm: 0, yNm: 0 }))]) assert.throws(() => validateStudentPlots(data));
});
test('student can add, touch-drag, rename, delete dots without consuming background panning', () => {
    const h = domHarness('<html><body><canvas id="scope"></canvas><div id="tools"></div></body></html>');
    const canvas = h.document.getElementById('scope'); let session = 'exercise-1:Student A', draws = 0;
    Object.assign(h.context, { host: { canvas, sessionKey: () => session, screenToPoint: e => ({ x: (e.clientX - 100) / 10, y: (100 - e.clientY) / 10 }), projectPoint: (x, y) => [100 + x * 10, 100 - y * 10], requestDraw: () => draws++ }, confirm: () => true });
    vm.runInContext(source.replace(/export /g, '') + ';globalThis.plotter=createStudentPlotting(host);plotter.mount(document.getElementById("tools"));', h.context);
    const pointer = (x, y, id = 1, type = 'mouse') => ({ clientX: x, clientY: y, button: 0, pointerId: id, pointerType: type, preventDefault() {} });
    assert.equal(h.context.plotter.onPointerDown(pointer(250, 250)), false, 'background continues to pan');
    h.document.getElementById('estimate-add').click(); assert.equal(h.context.plotter.isPlacing(), true);
    assert.equal(h.context.plotter.onPointerDown(pointer(120, 90)), true);
    let dots = h.context.plotter.estimates(); assert.equal(dots.length, 1); assert.equal(dots[0].callsign, '101'); assert.equal(dots[0].xNm, 2); assert.equal(dots[0].yNm, 1);
    assert.equal(h.context.plotter.onPointerDown(pointer(139, 90, 2, 'touch')), true, 'touch can select within 25px');
    assert.equal(h.context.plotter.onPointerMove(pointer(170, 60, 2, 'touch')), true); assert.equal(h.context.plotter.onPointerUp(pointer(170, 60, 2, 'touch')), true);
    dots = h.context.plotter.estimates(); assert.equal(dots[0].xNm, 7); assert.equal(dots[0].yNm, 4);
    h.document.getElementById('estimate-callsign').value = '202'; h.document.getElementById('estimate-rename').click(); assert.equal(h.context.plotter.estimates()[0].callsign, '202');
    const saved = h.context.localStorage.getItem('ats-simbox-student-estimates-v1:' + encodeURIComponent(session)); assert.equal(JSON.parse(saved)[0].callsign, '202'); assert.ok(!saved.includes('actualAircraftId'));
    session = 'exercise-1:Student B'; h.context.plotter.draw(canvas.getContext('2d')); assert.equal(h.context.plotter.estimates().length, 0, 'another student gets independent estimates');
    session = 'exercise-1:Student A'; h.context.plotter.draw(canvas.getContext('2d')); assert.equal(h.context.plotter.estimates()[0].callsign, '202', 'same student estimates restore');
    const select = h.document.getElementById('estimate-select'); select.value = h.context.plotter.estimates()[0].id; select.dispatchEvent(new h.Event('change')); h.document.getElementById('estimate-delete').click(); assert.equal(h.context.plotter.estimates().length, 0);
    h.context.plotter.setEnabled(false); assert.equal(h.document.getElementById('student-plotting').hidden, true); assert.equal(h.context.plotter.onPointerDown(pointer(100, 100)), false); assert.ok(draws > 3);
});
test('student can place and move estimates by coordinates and keyboard without dragging', () => {
    const h = domHarness('<html><body><canvas id="scope"></canvas><div id="tools"></div></body></html>');
    const canvas = h.document.getElementById('scope'); let captured = null;
    canvas.setPointerCapture = id => { captured = id; }; canvas.hasPointerCapture = id => captured === id; canvas.releasePointerCapture = () => { captured = null; };
    Object.assign(h.context, { host: { canvas, sessionKey: 'keyboard-student', screenToPoint: e => ({ xNm: e.clientX, yNm: e.clientY }), projectPoint: (x, y) => [x, y], requestDraw() {} }, confirm: () => true });
    vm.runInContext(source.replace(/export /g, '') + ';globalThis.plotter=createStudentPlotting(host);plotter.mount(document.getElementById("tools"));', h.context);
    const east = h.document.getElementById('estimate-east'), north = h.document.getElementById('estimate-north'), move = h.document.getElementById('estimate-coordinate-move');
    assert.equal(h.document.getElementById('estimate-coordinate-entry').open, undefined, 'coordinate controls start collapsed');
    assert.equal(move.disabled, true, 'choose Add estimate before coordinate placement');
    h.document.getElementById('estimate-add').click(); east.value = '-12.5'; north.value = '6.25'; move.click();
    assert.equal(h.context.plotter.estimates()[0].xNm, -12.5); assert.equal(h.context.plotter.estimates()[0].yNm, 6.25); assert.equal(h.context.plotter.isPlacing(), false);
    east.value = '15'; north.value = '-3'; const enter = new h.Event('keydown', { bubbles: true, cancelable: true }); enter.key = 'Enter'; north.dispatchEvent(enter);
    assert.equal(h.context.plotter.estimates()[0].xNm, 15); assert.equal(h.context.plotter.estimates()[0].yNm, -3); assert.equal(enter.defaultPrevented, true);
    for (const value of ['', 'NaN', '2001']) { east.value = value; move.click(); assert.equal(h.context.plotter.estimates()[0].xNm, 15, 'invalid coordinates preserve the dot'); }
    const pointer = { pointerId: 3, button: 0, pointerType: 'mouse', clientX: 15, clientY: -3, preventDefault() {} };
    h.context.plotter.onPointerDown(pointer); assert.equal(captured, 3); h.context.plotter.setEnabled(false); assert.equal(captured, null, 'closing a student session releases pointer capture');
    const saved = h.context.localStorage.getItem('ats-simbox-student-estimates-v1:keyboard-student');
    assert.deepEqual(Object.keys(JSON.parse(saved)[0]).sort(), ['callsign', 'id', 'xNm', 'yNm']);
});
