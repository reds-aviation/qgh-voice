'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

function entry(search = '') {
  const nodes = new Map(), navigations = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: id === 'exerciseConnection' ? 'local' : '', valid: true,
      events: {}, addEventListener(type, fn) { this.events[type] = fn; }, reportValidity() { return this.valid; } });
    return nodes.get(id);
  };
  vm.runInNewContext(readFileSync(join(__dirname, '../suite-entry.js'), 'utf8'), {
    document: { getElementById: node }, URL, URLSearchParams,
    location: { href: 'https://example.test/instructor-led/index.html' + search, search, assign: url => navigations.push(url) }
  });
  return { node, navigations };
}

test('entry keeps connection selection on both direct role links, including a late change', () => {
  const h = entry();
  for (const mode of ['online', 'local']) {
    h.node('exerciseConnection').value = mode;
    h.node('exerciseConnection').events.change();
    for (const [id, path] of [['openInstructorSetup', 'instructor.html']]) {
      const url = new URL(h.node(id).href);
      assert.equal(url.pathname, `/instructor-led/${path}`);
      assert.equal(url.searchParams.get('connection'), mode);
      assert.equal(url.searchParams.has('join'), false, 'opening the controller manually must not request admission');
    }
    assert.equal(h.node('openControllerPosition').href,'#entryJoinPin');
  }
  h.node('exerciseConnection').value = 'online';
  h.node('openInstructorSetup').events.click();
  assert.equal(new URL(h.node('openInstructorSetup').href).searchParams.get('connection'), 'online');
  for(const event of ['contextmenu','auxclick']){
    h.node('exerciseConnection').value='local';
    h.node('openControllerPosition').events[event]();
    assert.equal(h.node('openControllerPosition').href,'#entryJoinPin');
    h.node('exerciseConnection').value='online';
    h.node('openInstructorSetup').events[event]();
    assert.equal(new URL(h.node('openInstructorSetup').href).searchParams.get('connection'),'online');
  }
});

test('entry inline join carries the validated PIN and current connection through the established student page', () => {
  const h = entry();
  h.node('entryJoinPin').value = '12x34567';
  h.node('entryJoinPin').events.input();
  assert.equal(h.node('entryJoinPin').value, '123456');
  h.node('exerciseConnection').value = 'online';
  let prevented = false;
  h.node('entryJoinForm').events.submit({ preventDefault() { prevented = true; } });
  const url = new URL(h.navigations[0]);
  assert.equal(prevented, true);
  assert.equal(url.pathname, '/instructor-led/student.html');
  assert.equal(url.searchParams.get('pin'), '123456');
  assert.equal(url.searchParams.get('connection'), 'online');
  assert.equal(url.searchParams.get('join'), '1');
  h.node('entryJoinForm').valid = false;
  h.node('entryJoinForm').events.submit({ preventDefault() {} });
  assert.equal(h.navigations.length, 1, 'invalid forms stay at entry');
});

function student(search, saved = {}, overrides = {}) {
  const nodes = new Map(), requests = [], remotePins = [], redirects = [];
  let shellOptions;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', hidden: id !== 'joinPanel', checked: false,
      events: {}, addEventListener(type, fn) { this.events[type] = fn; }, setAttribute() {}, querySelector() {},
      getBoundingClientRect: () => ({ width: 1000, height: 800 }), getContext: () => new Proxy({}, { get: () => () => {} }) });
    return nodes.get(id);
  };
  const values = new Map(Object.entries(saved));
  vm.runInNewContext(readFileSync(join(__dirname, '../suite-student.js'), 'utf8'), {
    document: { getElementById: node, body: { classList: { toggle() {} } } }, URLSearchParams, URL,
    location: { search, href: 'https://example.test/instructor-led/student.html' + search, replace: url => redirects.push(url) }, localStorage: {}, sessionStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),removeItem:key=>values.delete(key) },
    addEventListener() {}, setInterval() {}, setTimeout() {},
    ATCSuiteWorkspace:{bindShell(options){shellOptions=options;}},
    ATCSuiteCloud: { async prepareStudent(pin) { remotePins.push(pin); return { transport: { start() {}, close() {} } }; } },
    ATCSuiteSession: { createStudentSession(options) { requests.push(options); return { requestJoin: () => true }; } },...overrides
  });
  return { node, requests, remotePins, redirects,values,get shellOptions(){return shellOptions;} };
}

test('explicit local entry overrides a saved online preference and uses normal waiting-for-admission flow', () => {
  const h = student('?connection=local&pin=654321&join=1', { 'atc-suite-connection': 'online' });
  assert.equal(h.node('exerciseConnection').value, 'local');
  assert.equal(h.node('joinPin').value, '654321');
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].pin, '654321');
  assert.equal(h.remotePins.length, 0);
  assert.equal(h.node('waitingPanel').hidden, false);
  assert.equal(h.node('studentWorkspace').hidden, true, 'PIN navigation cannot bypass instructor admission');
});

test('online entry routes the PIN through cloud preparation and plain PIN links only prefill', async () => {
  const h = student('?connection=online&pin=654321&join=1');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.remotePins, ['654321']);
  assert.equal(h.requests.length, 1);
  assert.equal(h.node('waitingPanel').hidden, false);
  const manual = student('?connection=local&pin=654321');
  assert.equal(new URL(manual.redirects[0]).searchParams.get('pin'),'654321');
  assert.equal(manual.requests.length, 0);
});

test('shared portal prefills an explicit window PIN without requesting or navigating',()=>{
  const h=entry('?connection=online&pin=654321');
  assert.equal(h.node('exerciseConnection').value,'online');
  assert.equal(h.node('entryJoinPin').value,'654321');
  assert.equal(h.navigations.length,0);
});

test('direct controller route returns to paired entry with mode, while saved-seat refresh still rejoins',()=>{
  for(const [search,saved,mode] of [['',{},'local'],['?connection=online',{},'online'],['?connection=local',{'atc-suite-connection':'online'},'local']]){
    const h=student(search,saved),url=new URL(h.redirects[0]);
    assert.equal(url.pathname,'/instructor-led/index.html');
    assert.equal(url.hash,'#controllerposition');
    assert.equal(url.searchParams.get('connection'),mode);
    assert.equal(h.requests.length,0);
  }
  const recovered=student('',{'reds.atc-suite.last-pin':'654321','reds.atc-suite.seat.654321':JSON.stringify({sessionId:'session_12345678',clientId:'student_12345678',seatToken:'saved-token',revision:1})});
  assert.equal(recovered.redirects.length,0);
  assert.equal(recovered.requests.length,1,'existing protocol validates recovered admission');
  assert.equal(recovered.requests[0].pin,'654321');
});

test('malformed recovery or a different PIN/connection returns to entry without a join request',()=>{
  const valid=JSON.stringify({sessionId:'session_12345678',clientId:'student_12345678',seatToken:'saved-token',revision:1});
  for(const [search,seat] of [['','null'],['','{bad'],['','{}'],['',JSON.stringify({sessionId:'',clientId:'student_12345678',seatToken:'saved-token',revision:1})],['?pin=123456',valid],['?connection=local',valid]]){
    const h=student(search,{'reds.atc-suite.last-pin':'654321','reds.atc-suite.seat.654321':seat,'atc-suite-connection':'online'});
    assert.equal(h.requests.length,0);
    assert.equal(h.redirects.length,1);
    if(search.includes('pin='))assert.equal(new URL(h.redirects[0]).searchParams.get('pin'),'123456');
  }
});

test('student Logout closes live transports, stops timers and removes this tab seat recovery and estimate dots',()=>{
 const closed=[],cancelled=[],local=new Map([['ats-simbox-student-estimates-v1:session_12345678%3Astudent_12345678','dots']]);
 const h=student('?connection=local&pin=654321&join=1',{'reds.atc-suite.last-pin':'654321','reds.atc-suite.seat.654321':'seat','atc-suite-student-auth':'auth','atc-suite.saved-exercises.v1':'library'},
 {localStorage:{removeItem:key=>local.delete(key)},setInterval:(()=>{let next=0;return()=>++next;})(),clearInterval:id=>cancelled.push(id),
 ATCSuiteSession:{createStudentSession(){return {requestJoin:()=>true,snapshot:()=>({sessionId:'session_12345678',clientId:'student_12345678'}),close(){closed.push('session');}};}}});
 assert.equal(typeof h.shellOptions.onLogout,'function');h.shellOptions.onLogout();
 assert.deepEqual(closed,['session']);assert.deepEqual(cancelled,[1,2]);assert.equal(local.size,0);
 for(const key of ['reds.atc-suite.last-pin','reds.atc-suite.seat.654321','atc-suite-student-auth'])assert.equal(h.values.has(key),false,key);
 assert.equal(h.values.get('atc-suite.saved-exercises.v1'),'library');
 const refreshed=student('',Object.fromEntries(h.values));assert.equal(refreshed.redirects.length,1);assert.equal(refreshed.requests.length,0,'logging out cannot silently rejoin through a saved seat');
});

test('student Logout invalidates a pending online join and closes its late transport without requesting admission',async()=>{
 let finish,closed=0;const requested=[];
 const h=student('?connection=online&pin=654321&join=1',{},
 {ATCSuiteCloud:{prepareStudent:()=>new Promise(resolve=>{finish=resolve;})},ATCSuiteSession:{createStudentSession(options){requested.push(options);return {requestJoin:()=>true};}}});
 assert.equal(typeof finish,'function');h.shellOptions.onLogout();
 finish({transport:{close(){closed++;},start(){assert.fail('late logged-out transport started');}}});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(closed,1);assert.equal(requested.length,0);assert.equal(h.values.has('reds.atc-suite.last-pin'),false);
});
