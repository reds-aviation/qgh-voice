import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {webcrypto} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {renderCurrentGuide} from '../../scripts/build-suite-guides.mjs';
import {domHarness} from './testing/dom-harness.mjs';
const require=createRequire(import.meta.url);
const {matchGuideQuestion,topicForPage}=require('./static/suite-guide-chat.js');
const knowledge=require('./static/guide-knowledge.js');
const source=name=>readFileSync(new URL('./static/'+name,import.meta.url),'utf8');
const loadModule=async name=>import('data:text/javascript;base64,'+Buffer.from(source(name)).toString('base64'));
const {createAircraftGestures,nearestAircraft}=await loadModule('scope-interaction.js');
const {advanceSweep}=await loadModule('radar-sweep.js');

test('mouse turns need the same aircraft, same button, two clicks; touch and drags cannot turn',()=>{
  const g=createAircraftGestures();
  const press=(override={})=>g.press({id:'a',button:0,pointerType:'mouse',time:100,x:10,y:10,...override});
  assert.equal(press(),null);assert.equal(press({time:400}),'left');assert.equal(press({time:420}),null);
  g.reset();assert.equal(press({button:2}),null);assert.equal(press({time:300,button:2}),'right');
  g.reset();press();assert.equal(press({time:200,id:'b'}),null);assert.equal(press({time:260,button:2,id:'b'}),null);
  g.reset();press();assert.equal(press({time:800}),null);g.reset();press();assert.equal(press({time:200,x:99}),null);
  g.reset();assert.equal(press({pointerType:'touch'}),null);assert.equal(press({pointerType:'touch',time:200}),null);
  g.reset();press();g.reset();assert.equal(press({time:200}),null);
  assert.equal(nearestAircraft([{id:'scheduled',status:'scheduled',xNm:0,yNm:0},{id:'visible',status:'airborne',xNm:1,yNm:0}],{x:0,y:0},10).id,'visible');
  assert.equal(nearestAircraft(undefined,{x:0,y:0},10),null);
});

test('sweep turns clockwise in real milliseconds and freezes while paused',()=>{
  assert.equal(advanceSweep(0,1250,12),90);
  assert.equal(advanceSweep(0,5000,12),0);
  assert.equal(advanceSweep(0,1000,6),36);
  assert.equal(advanceSweep(350,500,12),26);
  assert.equal(advanceSweep(32,60000,12,false),32);
  assert.equal(advanceSweep(32,NaN,12),32);
});

test('Gyani recognises all deployed page paths and ordinary control questions',()=>{
  for(const path of ['/qgh-voice/procedural-beta/','/qgh-voice/procedural-beta/index.html','/procedural.html','/procedural-guide.html']) assert.equal(topicForPage(path),'procedural');
  for(const path of ['/qgh-voice/qgh.html','/qgh-voice/single.html','/qgh-voice/tactical.html']) assert.equal(topicForPage(path),'qgh-individual');
  assert.equal(topicForPage('/qgh-voice/'),'suite');
  assert.equal(topicForPage('/qgh-voice/instructor-led/instructor.html','#par'),'par');
  for(const q of ['How to turn right','how do I trun rigth?','left turn please','stop turning','how to orbit','change speed','how do I climb','what is QDM','set radar RPM','how do I scroll callsigns on phone','how do I join','show the guide','hello']) {
    const answer=matchGuideQuestion(q,'procedural'); assert.equal(answer.matched,true,q); assert.ok(answer.text.length>20,q);
  }
  assert.match(matchGuideQuestion('How to turn right','procedural').text,/double-click the right mouse button/i);
  assert.match(matchGuideQuestion('and left','procedural','turn').text,/Stop turn/);
  assert.match(matchGuideQuestion('how to turn right','qgh-individual').text,/Normal QGH/);
  const unknown=matchGuideQuestion('What is the weather tomorrow in Delhi?','procedural');
  assert.equal(unknown.matched,false);assert.ok(unknown.text.includes(knowledge.learning));assert.equal(unknown.links.length,3);
  assert.match(unknown.escalation,/Contact the creator/);
});

test('generated guides and Gyani use the same control explanations',()=>{
  for(const topic of ['procedural','qgh-individual','qgh-instructor']) {
    const html=renderCurrentGuide(topic,'../'); const {document}=parseHTML(html);
    for(const entry of knowledge.entries.filter(item=>item.topics.includes(topic))) assert.ok(document.textContent===null ? html.includes(entry.title) : document.textContent.includes(entry.title));
    assert.equal(document.querySelectorAll('#current-flow').length,1);
    assert.ok(html.includes(knowledge.learning));
  }
  const {document}=parseHTML(readFileSync(new URL('../site-landing/index.html',import.meta.url),'utf8'));
  assert.equal(document.querySelector('.procedural-card').tagName,'A');
  assert.equal(document.querySelector('.procedural-card').getAttribute('href'),'procedural-beta/');
  assert.equal(document.querySelector('.procedural-card a'),null,'no nested links');
  const procedural=source('procedural.html');assert.ok(!procedural.includes('tab-feedback'));assert.ok(!source('procedural.js').includes('feedback-form'));
});

test('local room registry allocates collision-free PINs and expires closed rooms',async()=>{
  const context=vm.createContext({indexedDB:new IDBFactory(),crypto:webcrypto,Date,Uint32Array});
  vm.runInContext(source('browser-room-registry.js'),context);
  const directory=context.ProceduralRooms;
  const rooms=await Promise.all(Array.from({length:32},()=>directory.register(webcrypto.randomUUID(),true)));
  assert.equal(new Set(rooms.map(room=>room.pin)).size,32);
  for(const room of rooms) assert.equal(await directory.find(room.pin),room.id);
  const room=rooms[0], rotated=await directory.register(room.id,true,true);
  assert.notEqual(rotated.pin,room.pin);assert.equal(await directory.find(room.pin),null);
  await directory.register(room.id,false);assert.equal(await directory.find(rotated.pin),null);
  assert.equal(await directory.find('bad'),null);
});

test('Gyani mounts in the tool rail, answers the reported question and collapses',async()=>{
  const h=domHarness('<html><body class="desk-open"><nav id="edge-actions"></nav></body></html>');
  vm.runInContext(source('guide-knowledge.js'),h.context);
  vm.runInContext(source('suite-guide-chat.js'),h.context);
  const root=h.document.getElementById('suite-guide-chat');
  assert.equal(root.parentElement.id,'edge-actions');
  assert.ok(root.querySelector('img').src.endsWith('/gyani-fox.png'));
  root.querySelector('.suite-guide-chat__launcher').click();
  const input=root.querySelector('textarea');input.value='How to turn right';
  root.querySelector('form').dispatchEvent(new h.Event('submit',{bubbles:true,cancelable:true}));
  assert.match(root.querySelector('.suite-guide-chat__history').textContent,/double-click the right mouse button/i);
  root.querySelector('.suite-guide-chat__close').click();assert.equal(root.querySelector('[role="dialog"]').hidden,true);
  h.document.body.classList.add('exercise-running');
  await new Promise(resolve=>setImmediate(resolve));assert.equal(root.hidden,true);
});

test('procedural console boots after feedback removal; mouse/touch controls preserve roles',async()=>{
  const h=domHarness(source('procedural.html'));
  Object.assign(h.context,{createAircraftGestures,nearestAircraft,
    createRadarSweep:()=>({update(){}}),recordTrail(){},trailDots:()=>[],createTrafficSetup:()=>({close(){},open(){}}),
    createChartWorkshop:()=>({}),drawAreas(){},routeWindowOpen:()=>true,visibleSegment:()=>true,reserveLabel:()=>null,fitNavigation(){},approachReference:()=>[],resolveRouteFixIds:()=>[],
  });
  vm.runInContext(source('procedural.js').replace(/^import .*;\r?\n/gm,'')+`
    globalThis.commands=[]; command=async (...args)=>commands.push(args);
    globalThis.prepare=(role)=>{
      session={role}; stage='desk';
      const a={id:'a1',callsign:'101',type:'TRAINER',status:'airborne',mode:'heading',headingDeg:90,speedKt:240,altitudeFt:10000,targetAltitudeFt:10000,xNm:0,yNm:0};
      view={exerciseId:'example',environment:{rangeNm:60,stationName:'NAV0'},roster:[a],aircraft:[a],routes:[],fixes:[],areas:[],elapsed:0};
      choose(a.id);
    };
  `,h.context);
  h.context.prepare('instructor');
  const canvas=h.document.getElementById('scope');
  const emit=(type,button,time,pointerType='mouse')=>{const e=new h.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{isPrimary:true,pointerId:1,pointerType,button,clientX:300,clientY:250,timeStamp:time});canvas.dispatchEvent(e);};
  emit('pointerdown',0,10);emit('pointerup',0,30);emit('pointerdown',0,100);emit('pointerup',0,130);
  assert.equal(h.context.commands.length,1);assert.equal(h.context.commands[0][1].action,'left');
  emit('pointerdown',2,300);emit('pointerup',2,330);emit('pointerdown',2,400);emit('pointerup',2,430);
  assert.equal(h.context.commands.length,2);assert.equal(h.context.commands[1][1].action,'right');
  emit('pointerdown',0,500,'touch');emit('pointerup',0,530,'touch');emit('pointerdown',0,600,'touch');emit('pointerup',0,630,'touch');
  assert.equal(h.context.commands.length,2,'touch selection never makes an accidental turn');
  h.document.getElementById('quick-right').click();assert.equal(h.context.commands[2][1].action,'right');
  h.context.prepare('student');assert.equal(h.document.getElementById('aircraft-quick-controls').hidden,true);
  emit('pointerdown',2,800);emit('pointerup',2,830);assert.equal(h.context.commands.length,3);
});

test('phone roster keeps 24 editable cards and retains callsigns while changing the count',async()=>{
  const h=domHarness('<html><body><section id="setup"></section></body></html>');
  let submitted;
  h.context.rosterHost={container:h.document.getElementById('setup'),view:()=>({title:'Phone exercise',mode:'area',environment:{}}),submit:async value=>{submitted=value;},airspace(){},cancel(){}};
  vm.runInContext(source('traffic-setup.js').replace('export function createTrafficSetup','function createTrafficSetup')+';createTrafficSetup(rosterHost).open();',h.context);
  const count=h.document.querySelector('[name="aircraftCount"]');
  const setCount=n=>{count.value=String(n);count.dispatchEvent(new h.Event('input',{bubbles:true}));};
  setCount(24);
  assert.ok(h.document.querySelector('.roster-editor--cards'));
  const callsigns=[...h.document.querySelectorAll('[data-field="callsign"]')];
  assert.equal(callsigns.length,24);
  callsigns[23].value='224';setCount(2);setCount(24);
  assert.equal(callsigns[23].value,'224');
  const jump=h.document.querySelector('.roster-navigator select');jump.value='23';jump.onchange();
  assert.equal(h.document.activeElement,callsigns[23]);
  h.document.querySelector('form').dispatchEvent(new h.Event('submit',{bubbles:true,cancelable:true}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(submitted.aircraft.length,24);assert.equal(submitted.aircraft[23].callsign,'224');
});
