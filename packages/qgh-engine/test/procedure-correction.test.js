'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Intent = require('../procedure-intent.js');
const Procedure = require('../procedure-core.js');
const single = { single: true };
const tactical = { callsigns: [{ id: 'A', callsign: '430' }, { id: 'B', callsign: '431' }] };

test('corrections reject every complete compound prefix rather than silently dropping a field', () => {
  for (const field of [
    'visibility 6000 metres', 'frequency 123.4', 'contact tower frequency 123.4',
    'cloud broken 2000 feet', 'dew point minus five degrees celsius', 'trend improving',
    'temperature 20 degrees celsius', 'wind 230 degrees 12 knots', 'runway in use 23',
    'squawk 1234', 'qfe 995'
  ]) for (const [options, prefix] of [[single, ''], [tactical, '430 ']]) {
    const text = `${prefix}qnh 1000 ${field} correction 1005`;
    const before = Intent.parse(`${prefix}qnh 1000 ${field}`, options);
    assert.equal(before?.accepted, true, `fixture must be a supported briefing: ${text}`);
    assert.ok(before.actions.length > 1);
    assert.equal(Intent.parse(text, options)?.accepted, false, text);
  }
});

test('complete single-field corrections preserve their family and target aircraft', () => {
  for (const [phrase, type, value] of [
    ['qnh 1000 correction 1005', 'pressure', 1005],
    ['set qnh one zero zero zero correction qnh one zero zero five', 'pressure', 1005],
    ['qfe 998 hectopascals correction qfe 999 hectopascals', 'pressure', 999],
    ['squawk 1234 correction 1235', 'squawk', '1235'],
    ['squawk 8888 correction squawk 1234', 'squawk', '1234']
  ]) {
    const command = Intent.parse(`431 ${phrase}`, tactical);
    // A malformed octal original is not a full recognized field and must be repeated.
    if (phrase.includes('8888')) { assert.equal(command.accepted, false); continue; }
    assert.equal(command.accepted, true, phrase);
    assert.equal(command.aircraft, 'B');
    assert.equal(command.actions.length, 1);
    assert.equal(command.actions[0].type, type);
    assert.equal(command.actions[0].value, value);
  }
  for (const phrase of ['qnh 1000 correction qfe 999', 'qnh 1000 correction squawk 1234', 'squawk 1234 correction qnh 1005']) {
    assert.equal(Intent.parse(phrase, single).accepted, false, phrase);
  }
});

test('a complete corrected vertical instruction executes only its replacement', () => {
  const plan = Intent.parse('descend altitude 9000 feet correction descend altitude 8000 feet', single);
  assert.equal(plan.accepted, true);
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].target.value, 8000);
  const state = Procedure.create({ aircraft: [{ id: 'single', callsign: '430', level: 15000 }] });
  assert.equal(Procedure.apply(state, plan).authorization, 'AUTHORIZED');
  assert.equal(state.aircraft.single.clearedAltitudeMslFt, 8000);
  for (const phrase of [
    'descend altitude 9000 feet and turn right 230 correction descend altitude 8000 feet',
    'qnh 1000 something unknown correction 1005',
    'qnh 1000 visibility 6000 metres correction qnh 1005',
    'qnh 1000 correction 1005 correction 1010'
  ]) assert.equal(Intent.parse(phrase, single)?.accepted, false, phrase);
});
