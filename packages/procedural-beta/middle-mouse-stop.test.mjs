import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Display from '../atc-suite/suite-display.js';
const Scope = await import('data:text/javascript;base64,' + Buffer.from(readFileSync(new URL('./static/scope-interaction.js', import.meta.url), 'utf8')).toString('base64'));

for (const [name, bind] of [['QGH', Display.bindMiddleMouseStop], ['Procedural', Scope.bindMiddleMouseStop]]) {
  function harness() {
    const element = new EventTarget(), captures = new Set(), actions = [], jobs = new Map(), transmissions = [];
    let next = 0, selected = 'ac1', role = 'instructor', phase = 'running';
    element.setPointerCapture = id => captures.add(id);
    element.hasPointerCapture = id => captures.has(id);
    element.releasePointerCapture = id => { captures.delete(id); emit('lostpointercapture', { pointerId: id }); };
    const gestures = Scope.createAircraftGestures({ onTransmit: id => transmissions.push(id),
      schedule: callback => { jobs.set(++next, callback); return next; }, cancel: id => jobs.delete(id) });
    const binding = bind(element, { isAllowed: id => role === 'instructor' && ['running', 'paused'].includes(phase) && (!id || ['ac1', 'ac2'].includes(id)),
      getTargetId: event => event.hitId || selected, onReset: () => gestures.reset(),
      onStop: id => { selected = id; actions.push({ type: 'stop-turn', id }); } });
    function emit(type, overrides = {}) {
      const event = new Event(type, { cancelable: true });
      Object.assign(event, { button: 1, pointerId: 1, isPrimary: true, pointerType: 'mouse', clientX: 50, clientY: 50, ...overrides });
      element.dispatchEvent(event); return event;
    }
    return { element, binding, emit, actions, jobs, transmissions, gestures,
      get selected() { return selected; }, setSelected(value) { selected = value; }, setRole(value) { role = value; }, setPhase(value) { phase = value; },
      flush() { const pending = [...jobs.values()]; jobs.clear(); pending.forEach(fn => fn()); } };
  }
  test(`${name}: middle background click stops selected once and prevents mousedown/auxclick autoscroll`, () => {
    const h = harness();
    h.gestures.press({ id: 'ac1', button: 0, pointerType: 'mouse', time: 0, x: 50, y: 50 });
    assert.equal(h.jobs.size, 1);
    assert.equal(h.emit('pointerdown').defaultPrevented, true); assert.equal(h.actions.length, 0);
    assert.equal(h.emit('mousedown').defaultPrevented, true);
    assert.equal(h.emit('pointerup').defaultPrevented, true);
    assert.equal(h.emit('auxclick').defaultPrevented, true);
    h.emit('pointerup'); h.flush();
    assert.deepEqual(h.actions, [{ type: 'stop-turn', id: 'ac1' }]);
    assert.deepEqual(h.transmissions, [], 'Middle Stop cancels a pending single-click D/F instead of adding a second transmission');
  });
  test(`${name}: hit aircraft takes priority over selected aircraft and updates selection once`, () => {
    const h = harness(); h.emit('pointerdown', { hitId: 'ac2' }); h.emit('pointerup', { hitId: 'ac2' }); h.emit('auxclick', { hitId: 'ac2' });
    assert.equal(h.selected, 'ac2'); assert.deepEqual(h.actions, [{ type: 'stop-turn', id: 'ac2' }]);
  });
  test(`${name}: cancel, drag, wrong pointer, no selection, ended exercise and student authority cannot stop traffic`, () => {
    for (const interruption of ['cancel', 'lost', 'drag', 'wrong-pointer', 'student', 'ended', 'no-selection']) {
      const h = harness(); if (interruption === 'no-selection') h.setSelected('');
      h.emit('pointerdown');
      if (interruption === 'cancel') h.emit('pointercancel');
      if (interruption === 'lost') h.emit('lostpointercapture');
      if (interruption === 'drag') h.emit('pointermove', { clientX: 80 });
      if (interruption === 'student') h.setRole('student');
      if (interruption === 'ended') h.setPhase('ended');
      h.emit('pointerup', interruption === 'wrong-pointer' ? { pointerId: 2 } : {});
      h.emit('auxclick'); assert.deepEqual(h.actions, [], interruption);
    }
    const h = harness(); h.setRole('student'); h.emit('pointerdown'); h.emit('pointerup'); assert.equal(h.actions.length, 0);
  });
  test(`${name}: paused instructor can stop; other buttons remain available for existing controls`, () => {
    const h = harness(); h.setPhase('paused'); h.emit('pointerdown'); h.emit('pointerup'); assert.equal(h.actions.length, 1);
    for (const button of [0, 2]) {
      assert.equal(h.emit('pointerdown', { button }).defaultPrevented, false);
      assert.equal(h.emit('mousedown', { button }).defaultPrevented, false);
      assert.equal(h.emit('pointerup', { button }).defaultPrevented, false);
      assert.equal(h.emit('auxclick', { button }).defaultPrevented, false);
    }
    assert.equal(h.actions.length, 1); h.binding.close(); h.emit('pointerdown'); h.emit('pointerup'); assert.equal(h.actions.length, 1);
  });
}
