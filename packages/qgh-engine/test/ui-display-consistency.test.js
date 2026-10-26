/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../simulator-core.js');
const Tactical = require('../tactical-core.js');
const Radio = require('../radio-session.js');

function harness(tactical) {
  const nodes = new Map(), intervals = new Map(), requestedReports = [];
  let timer = 0, now = 0;
  const element = id => {
    if (!nodes.has(id)) nodes.set(id,{value:'0',textContent:'',hidden:true,attributes:{},dataset:{},
      setAttribute(key,value){this.attributes[key]=String(value);},
      classList:{add(){},remove(){},toggle(){},contains(){return true;}},
      style:{setProperty(){}},append(){},replaceChildren(){}});
    return nodes.get(id);
  };
  const context = {document:{getElementById:element,createElement:()=>element(Symbol()),createTextNode:text=>text},QGHCore:Core,QGHTacticalCore:Tactical,
    QGHRadioSession:Radio,QGHRadioWorkspace:{manualCommand:command=>requestedReports.push(command),interrupt(){},resetExercise(){}},performance:{now:()=>now},
    QGHReview:{draw(){}},QGHTacticalReview:{draw(){}},
    setInterval:callback=>{const id=++timer;intervals.set(id,callback);return id;},clearInterval:id=>intervals.delete(id),
    setTimeout(){},clearTimeout(){}};
  context.window = context;
  const source = fs.readFileSync(path.join(__dirname,'..',tactical?'tactical-simulator.js':'simulator.js'),'utf8');
  const boundary = source.lastIndexOf('  bindEvents();');
  assert.ok(boundary>0);
  vm.runInNewContext(source.slice(0,boundary)+`
    window.fixture={state,formatTime,padHeading,inputDegrees,updateClock,startClock,stopClock,resetClock,logCommand,drawReview,
      requestHeading,requestDistance,resetConsole,renderDF,transmit:${tactical?'transmitForDF':'transmit'}${tactical?',renderRail,selectAircraft,renderSelectedAircraft':''}};
  })();`,context);
  const fixture = context.fixture;
  const cfg = {runway:230,inbound:225,outbound:65,speed:240,rate:3,distance:15,type:'fighter',callsign:'430'};
  if (tactical) {
    fixture.state.exercise = Tactical.createExercise({...cfg,procedure:'normal',randomizeInitial:false,random:()=>.3,
      aircraft:[{...cfg,id:'A',level:10000},{...cfg,id:'B',callsign:'431',level:11000}]});
    fixture.state.activeAircraftId = 'A';
    const rail = element('tAircraftRail');
    for (const aircraft of fixture.state.exercise.aircraft) {
      const item = element(aircraft.id + '-item'); item.parentElement = rail;
      fixture.state.railItems.set(aircraft.id, {item,...Object.fromEntries(['select','transmit','name','level','status','role'].map(key=>[key,element(aircraft.id+'-'+key)]))});
    }
  } else {
    fixture.state.cfg = cfg;fixture.state.plane = {x:10,y:10,heading:359.6};fixture.state.path = [{...fixture.state.plane}];
  }
  return {...fixture,element,intervals,requestedReports,adapter:context.QGHRadioAdapter,tick(ms){now+=ms;for(const callback of intervals.values())callback();},
    path(){return tactical?fixture.state.exercise.aircraft[0].path:fixture.state.path;},
    truth(){return JSON.stringify(tactical?fixture.state.exercise:fixture.state.plane);}};
}

for (const tactical of [false,true]) {
  const name = tactical?'Tactical':'Single', clock = tactical?'tClock':'clock', scopeClock = tactical?'tHomingClock':'homingClock';
  test(`${name} stopwatch starts at zero and remains operator-controlled beside recorded elapsed time`,()=>{
    const h=harness(tactical),before=h.truth();
    h.updateClock();assert.equal(h.element(clock).textContent,'00:00:00');assert.equal(h.state.clockRunning,false);
    h.startClock();h.startClock();assert.equal(h.intervals.size,1,'repeated Start cannot duplicate the stopwatch');
    h.tick(1000);assert.equal(h.element(clock).textContent,'00:00:01');
    h.stopClock();h.tick(1000);assert.equal(h.element(clock).textContent,'00:00:01');
    assert.match(h.element(scopeClock).attributes['aria-label'],/^Operator stopwatch, stopped:/);
    h.startClock();h.tick(1000);assert.equal(h.element(clock).textContent,'00:00:02');
    h.resetClock();assert.equal(h.element(clock).textContent,'00:00:00');assert.equal(h.element(scopeClock).hidden,true);
    h.state.clockSeconds=2;h.updateClock();
    if(tactical)h.logCommand('A','CHECK','Recorded time',61.25);else h.logCommand('CHECK','Recorded time',61.25);
    assert.equal(h.state.commands.at(-1).time,'00:01:01');assert.equal(h.state.commands.at(-1).clockTime,'00:00:02');
    assert.equal(h.truth(),before,'formatting and stopwatch controls cannot change flight truth');
  });
  test(`${name} elapsed displays handle hour rollover and review starts at the first sample`,()=>{
    const h=harness(tactical);
    for(const [seconds,expected] of [[0,'00:00:00'],[59.9,'00:00:59'],[60,'00:01:00'],[3599,'00:59:59'],[3600,'01:00:00'],[3661,'01:01:01'],[-1,'00:00:00'],[NaN,'00:00:00'],[Infinity,'00:00:00']])assert.equal(h.formatTime(seconds),expected);
    const output=tactical?'tReplayElapsed':'replayElapsed';
    h.drawReview(1,true);assert.equal(h.element(output).textContent,'REPLAY 00:00:00');
    h.path().push(...Array.from({length:240},()=>({...h.path()[0]})));
    h.drawReview();assert.equal(h.element(output).textContent,'TRACK 00:01:00');
    const html=fs.readFileSync(path.join(__dirname,'..',tactical?'tactical.html':'single.html'),'utf8');
    assert.match(html,/>STOPWATCH<\/small>/);assert.doesNotMatch(html,/EXERCISE CLOCK|aria-label="Exercise clock"/);
    assert.match(html,/TRACK 00:00:00/);
    assert.match(html,/Command and event log/i,'automatic setup and flight events are represented honestly');
  });
  test(`${name} north headings wrap after rounding and blank heading inputs stay invalid`,()=>{
    const h=harness(tactical),before=h.truth();
    for(const [heading,expected] of [[359.4,'359'],[359.6,'000'],[360,'000'],[-.4,'000'],[-1,'359'],[720,'000']])assert.equal(h.padHeading(heading),expected);
    h.element('headingInput').value=' ';assert.throws(()=>h.inputDegrees('headingInput'),/000 to 359/);
    h.element('headingInput').value='0';assert.equal(h.inputDegrees('headingInput'),0);
    assert.equal(h.truth(),before);
  });
  test(`${name} D/F and other aircraft replies cannot populate or refresh an unrequested range`,()=>{
    const h=harness(tactical), rangeId=tactical?'tDistanceReply':'distanceReply', headingId=tactical?'tHeadingReply':'headingReply';
    h.resetConsole();
    assert.equal(h.element(rangeId).textContent,'RANGE —');
    h.transmit(tactical?'A':undefined);
    assert.equal(h.element(rangeId).textContent,'RANGE —');
    h.requestHeading(); h.renderDF();
    assert.match(h.element(headingId).textContent,/^HEADING \d{3}°M$/);
    assert.equal(h.element(rangeId).textContent,'RANGE —','a heading response is not a distance report');
    h.requestDistance();
    const report=h.element(rangeId).textContent;
    assert.match(report,/^RANGE \d+\.\d NM$/);
    assert.equal(h.requestedReports.at(-1).intent,'request-distance');
    const plane=tactical?h.state.exercise.aircraft[0].plane:h.state.plane;
    plane.x=30;plane.y=0; h.renderDF();
    assert.equal(h.element(rangeId).textContent,report,'a requested report stays sampled rather than following flight truth');
    h.transmit(tactical?'A':undefined);
    assert.equal(h.element(rangeId).textContent,tactical?'RANGE —':report,'a later transmit cannot refresh range');
    for(const event of h.state.commands.filter(item=>item.type==='TRANSMIT FOR D/F')) assert.doesNotMatch(event.detail,/\bNM\b|RANGE/);
    if(tactical){
      h.selectAircraft('B'); h.renderRail();
      assert.equal(h.element(rangeId).textContent,'RANGE —','selection cannot disclose another aircraft range');
      for(const record of h.state.railItems.values()) assert.doesNotMatch(record.status.textContent,/\bNM\b|RANGE/);
      assert.equal(h.adapter.executeRadioCommand({intent:'normal-turn-heading',aircraft:'B',side:'right',heading:90}).ok,true);
      assert.equal(h.element(rangeId).textContent,'RANGE —','a turn readback cannot reveal range');
      assert.equal(h.adapter.executeRadioCommand({intent:'request-distance',aircraft:'A'}).ok,true);
      assert.equal(h.state.activeAircraftId,'B');
      assert.equal(h.element(rangeId).textContent,'RANGE —','an addressed report must not populate the selected aircraft range');
    }
    h.resetConsole(); assert.equal(h.element(rangeId).textContent,'RANGE —','new exercise clears the report');
  });
}
