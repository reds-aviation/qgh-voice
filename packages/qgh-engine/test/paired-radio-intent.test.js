/* ATS SIM BOX · Copyright 2026 Balaram Reddy. Common Public Attribution License 1.0. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {interpretHeading} = require('../voice-control.js');
const {classify} = require('../rt-intent-model.js');
const traffic = ['101', 'AIC102', 'RAVEN 21', 'RAVEN 22'];

test('browser model and guard resolve complete calls to exact configured aircraft', () => {
  for (const [text, callsign, side, heading] of [
    ['one zero one, turn right heading two six zero','101','right',260],
    ['one zero one turn right heading to six zero','101','right',260],
    ['AIC one zero two turn left heading 030','AIC102','left',30],
    ['raven two one turn left to heading tree fife niner','RAVEN 21','left',359],
    ['raven twenty two turn right 360','RAVEN 22','right',360],
  ]) assert.deepEqual(interpretHeading(text, traffic), {callsign, side, heading});
});
test('reject incomplete, ambiguous, conditional, duplicate and unaddressed instructions', () => {
  for (const text of [
    'turn right heading 260','Raven turn right heading 260','101 turn right heading 260?',
    '104 turn right heading 260','101 do not turn right heading 260','101 turn right heading 260 if able',
    '101 stand by to turn right heading 260','can 101 turn right heading 260','101 turn left heading 240 then descend',
    '101 turn right heading -260','101 turn right heading 2.60','101 turn right heading 361','101 turn right heading two six',
    '101 turn right heading 260 101 turn right heading 260','101 turn right heading 260 [unk]',
    '101 turn right to six zero','101 turn left heading to six','101 turn right heading to six later',
    '101 turn left 200 correction 260','101 say range','101 turn right heading 260 tomorrow',
  ]) assert.equal(interpretHeading(text, traffic), null, text);
  assert.equal(interpretHeading('101 turn right heading 260',['101','101']),null);
});
test('model interprets report topics independently of permission to execute', () => {
  assert.equal(classify('report range').intent,'range-report');
  assert.equal(classify('say current heading').intent,'heading-report');
  assert.equal(classify('transmit for direction finding').intent,'df-transmission');
  assert.equal(classify('stand by').intent,'standby');
  assert.equal(classify('zxvq') ,null);
});
test('paired interpreter fails closed if the model is unavailable to a web desk or worker', () => {
  const browser = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../voice-control.js'),'utf8'), browser);
  assert.equal(browser.ATSControllerVoice.interpretHeading('101 turn right heading 260',traffic),null);
});

test('open dictation homophones are resolved only in a complete three-digit roster address', () => {
  const {interpretHeading,interpretRequest} = require('../voice-control.js');
  const roster = ['101','102','104'];
  assert.equal(interpretHeading('one zero to turn right heading to six zero', roster)?.callsign,'102');
  assert.equal(interpretRequest('one zero for report heading',roster)?.callsign,'104');
  assert.equal(interpretHeading('one zero to do not turn right heading two six zero',roster),null);
  assert.equal(interpretHeading('to turn right heading two six zero',roster),null);
  assert.equal(interpretHeading('one zero to turn right heading two six zero',['102','102']),null);
});
