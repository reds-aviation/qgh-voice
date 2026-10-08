'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../simulator-core.js');
const Tactical = require('../tactical-core.js');

function harness(tactical) {
  const nodes = new Map(), intervals = new Map();
  let timer = 0, now = 0;
  const element = id => {
    if (!nodes.has(id)) nodes.set(id,{value:'0',textContent:'',hidden:true,attributes:{},dataset:{},
      setAttribute(key,value){this.attributes[key]=String(value);},
      classList:{add(){},remove(){},contains(){return true;}}});
    return nodes.get(id);
  };
  const context = {document:{getElementById:element},QGHCore:Core,QGHTacticalCore:Tactical,
    QGHRadioSession:{createReceiver:()=>({})},performance:{now:()=>now},
    QGHReview:{draw(){}},QGHTacticalReview:{draw(){}},
    setInterval:callback=>{const id=++timer;intervals.set(id,callback);return id;},clearInterval:id=>intervals.delete(id),
    setTimeout(){},clearTimeout(){}};
  context.window = context;
  const source = fs.readFileSync(path.join(__dirname,'..',tactical?'tactical-simulator.js':'simulator.js'),'utf8');
  const boundary = source.lastIndexOf('  bindEvents();');
  assert.ok(boundary>0);
  vm.runInNewContext(source.slice(0,boundary)+`
    window.fixture={state,formatTime,padHeading,inputDegrees,updateClock,startClock,stopClock,resetClock,logCommand,drawReview};
  })();`,context);
  const fixture = context.fixture;
  const cfg = {runway:230,inbound:225,outbound:65,speed:240,rate:3,distance:15,type:'fighter',callsign:'430'};
  if (tactical) {
    fixture.state.exercise = Tactical.createExercise({...cfg,procedure:'normal',randomizeInitial:false,random:()=>.3,
      aircraft:[{...cfg,id:'A',level:10000},{...cfg,id:'B',callsign:'431',level:11000}]});
    fixture.state.activeAircraftId = 'A';
  } else {
    fixture.state.cfg = cfg;fixture.state.plane = {x:10,y:10,heading:359.6};fixture.state.path = [{...fixture.state.plane}];
  }
  return {...fixture,element,intervals,tick(ms){now+=ms;for(const callback of intervals.values())callback();},
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
}
