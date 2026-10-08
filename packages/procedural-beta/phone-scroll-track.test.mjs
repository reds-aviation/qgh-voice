import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { domHarness } from './testing/dom-harness.mjs';

const source = readFileSync(new URL('./static/workspace-shell.js', import.meta.url), 'utf8');
function setup(page, rootId, width = 390) {
  const h = domHarness(readFileSync(new URL(page, import.meta.url), 'utf8'), '/', width);
  const resizes = [], windowEvents = new Map();
  h.context.ResizeObserver = class {
    constructor(callback) { this.callback = callback; }
    observe(target) { resizes.push({ target, callback: this.callback }); }
  };
  h.window.addEventListener = (name, callback) => windowEvents.set(name, callback);
  const phone = h.window.matchMedia('(max-width: 700px)'), changes = [];
  phone.addEventListener = (name, callback) => { if (name === 'change') changes.push(callback); };
  vm.runInContext(source, h.context);
  const get = id => h.document.getElementById(id), root = get(rootId);
  h.context.ATCSuiteWorkspace.bindShell({ root, scope: get(rootId === 'desk' ? 'scope' : 'instructorScope'),
    shelf: get(rootId === 'desk' ? 'instructor-control-shelf' : 'instructorControlShelf'),
    actions: get(rootId === 'desk' ? 'clock-controls' : 'instructorRunActions') });
  return { ...h, get, root, resizes, phone, changePhone(matches) { phone.matches = matches; changes.forEach(fn => fn()); },
    resize(target) { resizes.find(item => item.target === target)?.callback(); } };
}
function dimensions(scroller, width = 390, total = 1200) {
  const metrics = { width, total, left: 0, writes: 0 };
  Object.defineProperties(scroller, {
    clientWidth: { configurable: true, get: () => metrics.width },
    scrollWidth: { configurable: true, get: () => metrics.total },
    scrollLeft: { configurable: true, get: () => metrics.left, set: value => { metrics.left = value; metrics.writes++; } }
  });
  return metrics;
}
const trackFor = scroller => scroller.parentElement.querySelector('input.ats-scroll-track');

test('Phone track controls only scroll position, mirrors swipes and clamps its displayed end after resize', async () => {
  const h = setup('../atc-suite/instructor.html', 'activeWorkspace');
  const scroller = h.get('aircraftRosterTabs'), metrics = dimensions(scroller);
  const selected = h.document.createElement('button'); selected.textContent = '101'; selected.setAttribute('aria-pressed', 'true');
  let aircraftActions = 0; selected.addEventListener('click', () => aircraftActions++); scroller.append(selected);
  h.get('quickHeading').value = '233';
  await Promise.resolve();
  const track = trackFor(scroller);
  assert.equal(track.hidden, false); assert.equal(track.max, '810');
  assert.equal(track.getAttribute('aria-label'), 'Scroll aircraft list horizontally');
  assert.equal(track.getAttribute('aria-controls'), 'aircraftRosterTabs');
  track.value = '315'; track.dispatchEvent(new h.Event('input', { bubbles: true }));
  assert.equal(metrics.left, 315); assert.equal(metrics.writes, 1);
  metrics.left = 600; scroller.dispatchEvent(new h.Event('scroll'));
  assert.equal(track.value, '600'); assert.equal(metrics.writes, 1, 'A scroll notification cannot write scrollLeft and trigger a feedback loop');
  metrics.width = 600; metrics.total = 700; h.resize(scroller);
  assert.equal(track.max, '100'); assert.equal(track.value, '100');
  metrics.total = 590; h.resize(scroller); assert.equal(track.hidden, true);
  assert.equal(aircraftActions, 0); assert.equal(selected.getAttribute('aria-pressed'), 'true');
  assert.equal(h.get('quickHeading').value, '233', 'Scroll does not change an aircraft instruction');
});

test('Track visibility follows phone media changes, content growth and the two QGH rows', async () => {
  const h = setup('../atc-suite/instructor.html', 'activeWorkspace', 1200);
  const aircraft = h.get('aircraftRosterTabs'), tools = h.get('instructorTools');
  const a = dimensions(aircraft, 390, 390), t = dimensions(tools, 390, 800);
  await Promise.resolve();
  assert.equal(trackFor(aircraft).hidden, true); assert.equal(trackFor(tools).hidden, true);
  h.changePhone(true); assert.equal(trackFor(aircraft).hidden, true); assert.equal(trackFor(tools).hidden, false);
  a.total = 900; const button = h.document.createElement('button'); button.textContent = '106'; aircraft.append(button);
  await new Promise(setImmediate);
  assert.equal(trackFor(aircraft).hidden, false); assert.equal(trackFor(aircraft).max, '510');
  h.changePhone(false); assert.equal(trackFor(aircraft).hidden, true); assert.equal(trackFor(tools).hidden, true);
  trackFor(tools).value = '300'; trackFor(tools).dispatchEvent(new h.Event('input'));
  assert.equal(t.writes, 0, 'Hidden desktop tracks do not scroll the list');
});

test('Procedural tracks attach after fleet relocation and remain below aircraft, tools and legend content', async () => {
  const h = setup('./static/procedural.html', 'desk');
  const fleet = h.get('fleet'), tools = h.get('edge-actions'), legend = h.root.querySelector('.scope-airspace-key');
  dimensions(fleet, 390, 800); dimensions(tools, 390, 900); dimensions(legend, 390, 1200);
  const bar = h.document.createElement('div'); bar.id = 'scope-traffic-bar'; bar.append(fleet);
  h.root.querySelector('.scope-toolbar').after(bar);
  await Promise.resolve();
  assert.equal(fleet.parentElement.parentElement, bar);
  for (const scroller of [fleet, tools, legend]) {
    const track = trackFor(scroller); assert.ok(track); assert.equal(track.hidden, false);
    assert.equal(scroller.nextElementSibling, track, 'The track occupies its own row below content');
    assert.equal(scroller.contains(track), false, 'The content observer cannot observe its own track updates');
  }
  assert.equal(h.root.querySelectorAll('input.ats-scroll-track').length, 3);
  h.context.ATCSuiteWorkspace.bindShell({ root: h.root });
  await Promise.resolve();
  assert.equal(h.root.querySelectorAll('input.ats-scroll-track').length, 3, 'Rebinding does not duplicate tracks');
});

test('Missing observers do not prevent a phone track from working', async () => {
  const h = domHarness(readFileSync(new URL('../atc-suite/instructor.html', import.meta.url), 'utf8'));
  h.context.ResizeObserver = undefined; h.context.MutationObserver = undefined;
  vm.runInContext(source, h.context);
  const root = h.document.getElementById('activeWorkspace'), scroller = h.document.getElementById('aircraftRosterTabs');
  const metrics = dimensions(scroller);
  h.context.ATCSuiteWorkspace.bindShell({ root }); await Promise.resolve();
  const track = trackFor(scroller); assert.equal(track.hidden, false);
  track.value = '100'; track.dispatchEvent(new h.Event('input')); assert.equal(metrics.left, 100);
});
