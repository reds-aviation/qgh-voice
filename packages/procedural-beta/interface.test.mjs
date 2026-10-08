import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {webcrypto} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {renderCurrentGuide,renderCommonGuide} from '../../scripts/build-suite-guides.mjs';
import {domHarness} from './testing/dom-harness.mjs';
const require=createRequire(import.meta.url);
const {matchGuideQuestion,topicForPage}=require('./static/suite-guide-chat.js');
const knowledge=require('./static/guide-knowledge.js');
const source=name=>readFileSync(new URL('./static/'+name,import.meta.url),'utf8');
const loadModule=async name=>import('data:text/javascript;base64,'+Buffer.from(source(name)).toString('base64'));
const {createAircraftGestures,nearestAircraft,bindMiddleMouseStop}=await loadModule('scope-interaction.js');
const {advanceSweep}=await loadModule('radar-sweep.js');

test('offline update requires an explicit choice outside the active exercise',async()=>{
  const h=domHarness('<html><body><header class="topbar"><nav></nav></header></body></html>');
  const events=new Map(), messages=[];
  let reloaded=0,registered;
  h.context.location.protocol='https:'; h.context.location.reload=()=>reloaded++;
  h.document.currentScript.src='https://example.test/qgh-voice/suite-landing-register.js?release=example';
  h.window.addEventListener=(name,fn)=>events.set('window:'+name,fn);
  const registration={waiting:{postMessage:message=>messages.push(message)},addEventListener(){},update:async()=>{}};
  h.context.navigator={serviceWorker:{controller:{},addEventListener:(name,fn)=>events.set(name,fn),register:async(...args)=>{registered=args;return registration;}}};
  vm.runInContext(readFileSync(new URL('../site-landing/suite-landing-register.js',import.meta.url),'utf8'),h.context);
  await events.get('window:load')();
  assert.equal(registered[0],'https://example.test/qgh-voice/service-worker.js');
  assert.equal(registered[1].scope,'/qgh-voice/');
  const button=h.document.querySelector('.suite-update');assert.equal(button.hidden,false);
  events.get('controllerchange')();assert.equal(reloaded,0,'another tab updating never reloads this desk');
  h.context.sessionStorage.setItem('qgh-procedural-browser-session-v1','active');
  h.document.body.classList.add('desk-open');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(button.hidden,true);button.click();assert.equal(messages.length,0);
  h.context.sessionStorage.removeItem('qgh-procedural-browser-session-v1');
  h.document.body.classList.remove('desk-open');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(button.hidden,false);button.click();assert.equal(messages[0].type,'SKIP_WAITING');
  events.get('controllerchange')();assert.equal(reloaded,1);
});

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

test('single aircraft click transmits once; double clicks and drag cancellation do not transmit',()=>{
  const tasks=new Map(),sent=[];let next=0;
  const g=createAircraftGestures({onTransmit:id=>sent.push(id),schedule:fn=>{tasks.set(++next,fn);return next;},cancel:id=>tasks.delete(id)});
  const click=(button,time,id='a',pointerType='mouse')=>g.press({id,button,time,pointerType,x:10,y:10});
  const flush=()=>{const due=[...tasks.values()];tasks.clear();due.forEach(fn=>fn());};
  click(0,0);assert.equal(sent.length,0);flush();assert.deepEqual(sent,['a']);
  click(0,1000);assert.equal(click(0,1200),'left');flush();assert.equal(sent.length,1);
  click(2,2000);assert.equal(click(2,2200),'right');flush();assert.equal(sent.length,1);
  click(0,3000);g.reset();flush();assert.equal(sent.length,1,'drag/termination cancels pending transmission');
  click(0,4000);click(0,4200,'b');flush();assert.deepEqual(sent,['a','b'],'switching aircraft cancels the pending old source');
  click(0,5000,'b','touch');assert.deepEqual(sent,['a','b','b'],'one tap transmits immediately without a turn');
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
  assert.match(matchGuideQuestion('How to turn right','procedural').text,/Double-right-click/i);
  assert.match(matchGuideQuestion('and left','procedural','turn').text,/Stop turn/);
  assert.match(matchGuideQuestion('how to turn right','qgh-individual').text,/Normal QGH/);
  const unknown=matchGuideQuestion('What is the weather tomorrow in Delhi?','procedural');
  assert.equal(unknown.matched,false);assert.ok(unknown.text.includes(knowledge.learning));assert.equal(unknown.links.length,1);assert.match(unknown.links[0].href,/user-guide\.html/);
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

test('Version 1 entry pages and common guide use ATS SIM BOX branding without beta labels',()=>{
 for(const path of ['../site-landing/index.html','../atc-suite/index.html','../atc-suite/instructor.html','../atc-suite/student.html','../qgh-engine/index.html','../qgh-engine/single.html','../qgh-engine/tactical.html','../qgh-engine/training-centre.html','./static/procedural.html']){
   const{document}=parseHTML(readFileSync(new URL(path,import.meta.url),'utf8'));
   assert.match(document.querySelector('title').textContent,/ATS SIM BOX · Version 1/,path);
   assert.match(document.body.textContent,/ATS SIM BOX/,path);assert.match(document.body.textContent,/Version 1/,path);
   assert.doesNotMatch(document.body.textContent,/\bBETA\b|UNDER DEVELOPMENT|USER TRIALS|ATC TRAINING SUITE|Reds QGH Simulator/i,path);
 }
 const{document}=parseHTML(renderCommonGuide());assert.match(document.querySelector('title').textContent,/ATS SIM BOX · Version 1/);assert.match(document.body.textContent,/Version 1/);
 assert.ok(knowledge.entries.every(entry=>!(/\bbeta\b/i.test(entry.text))),'Gyani retains training limitations without a beta release label');
 assert.equal(document.querySelector('#current-flow').getAttribute('data-guide-revision'),knowledge.revision,'display branding never replaces the release identity used for cache/guide compatibility');
});

test('drawing help distinguishes saved ARP, staged points, closing and applying a boundary',()=>{
  const entry=knowledge.entries.find(item=>item.id==='custom-polygons');
  for(const id of ['boundary-drawing-status','boundary-go-arp','boundary-scope-edit','boundary-scope-tools','custom-boundary-form']) assert.ok(entry.controls.includes(id));
  assert.match(entry.text,/Save ARP before drawing/);
  assert.match(entry.text,/readiness message.*point count/);
  assert.match(entry.text,/Close boundary.*then Save boundary applies/);
  assert.match(entry.text,/Closing alone does not save/);
  assert.match(entry.text,/Cancel drawing.*keeps the unsaved points/);
  assert.match(entry.text,/aircraft turns, transmissions, panning and exercise shortcuts are isolated/);
  assert.match(entry.text,/Move handle.*Home or Reset/);
  for(const question of ['Why is mouse drawing unavailable?','Does Close boundary save the polygon?','Does Cancel drawing keep my points?','How do I move the boundary drawing toolbar?']) {
    assert.equal(matchGuideQuestion(question,'procedural').intent,'custom-polygons');
  }
  assert.equal(matchGuideQuestion('What is exercise time?','procedural').intent,'exercise-time');
  assert.equal(matchGuideQuestion('How do I save an exercise that contains a boundary?','procedural').intent,'saved-exercises');
  assert.equal(matchGuideQuestion('Can I drag and rename a dot?','procedural').intent,'student-estimates');
  assert.equal(matchGuideQuestion('How do I rename a saved exercise?','procedural').intent,'saved-exercises');
  const html=renderCurrentGuide('procedural','../');
  assert.ok(html.includes('Closing alone does not save.'));
  assert.ok(knowledge.tours.some(step=>step.selector==='#boundary-drawing-status'&&step.entry==='custom-polygons'));
});

test('review Home guidance names the suite destination and retains Restart and Replay',()=>{
  const entry=knowledge.entries.find(item=>item.id==='review-controls');
  assert.match(entry.text,/ATS suite Home in the review screen returns to the ATS Simulator Suite home page/);
  assert.match(entry.text,/Use Restart.*Replay/);
  for(const topic of ['qgh-instructor','procedural']) assert.equal(matchGuideQuestion('Where is Home after termination?',topic).intent,'review-controls');
  for(const id of ['reviewSuiteHome','review-suite-home']) {
    assert.ok(entry.controls.includes(id));
    assert.ok(knowledge.tours.some(step=>step.selector==='#'+id&&step.entry==='review-controls'));
  }
});

test('Logout help explains the current-position discard and Cancel preservation for instructor and student flows',()=>{
  const entry=knowledge.entries.find(item=>item.id==='logout-position');
  assert.match(entry.text,/top right/);
  assert.match(entry.text,/Log out and return to ATS suite Home\? Current exercise progress will be lost\./);
  assert.match(entry.text,/Cancel or Escape.*preserves the current attempt/);
  assert.match(entry.text,/Log out discards this tab.*progress and recovery/);
  assert.match(entry.text,/Saved starting exercises.*are retained/);
  assert.ok(entry.controls.includes('workspaceLogout'));
  assert.ok(knowledge.tours.some(step=>step.selector==='#workspaceLogout'&&step.entry==='logout-position'));
  for(const topic of ['qgh-instructor','sra','procedural']) for(const question of entry.questions) {
    assert.equal(matchGuideQuestion(question,topic).intent,'logout-position');
  }
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
  assert.match(root.querySelector('.suite-guide-chat__history').textContent,/Double-right-click/i);
  root.querySelector('.suite-guide-chat__close').click();assert.equal(root.querySelector('[role="dialog"]').hidden,true);
  h.document.body.classList.add('exercise-running');
  await new Promise(resolve=>setImmediate(resolve));assert.equal(root.hidden,true);
});

test('procedural console boots after feedback removal; mouse/touch controls preserve roles',async()=>{
  const h=domHarness(source('procedural.html'));
  const timers=new Map();let timerId=0;
  Object.assign(h.context,{createAircraftGestures:opts=>createAircraftGestures({...opts,schedule:fn=>{timers.set(++timerId,fn);return timerId;},cancel:id=>timers.delete(id)}),nearestAircraft,bindMiddleMouseStop,
    createRadarSweep:()=>({update(){}}),recordTrail(){},trailDots:()=>[],trailSpacing:()=>1,createTrafficReview:()=>({record(){},open(){},close(){},clear(){}}),createTrafficSetup:()=>({close(){},open(){}}),
    createStudentPlotting:()=>({mount(){},setEnabled(){},draw(){},onPointerDown(){},onPointerMove(){},onPointerUp(){},onPointerCancel(){}}),
    createMapWorkshop:()=>({}),alignmentBriefing:()=>'',createChartWorkshop:()=>({}),drawAreas(){},routeWindowOpen:()=>true,visibleSegment:()=>true,reserveLabel:()=>null,fitNavigation(){},approachReference:()=>[],resolveRouteFixIds:()=>[],
  });
  vm.runInContext(source('meeting-room.js'),h.context);
  vm.runInContext(source('procedural.js').replace(/^import .*;\r?\n/gm,'')+`
    globalThis.commands=[]; command=async (...args)=>commands.push(args);
    globalThis.prepare=(role)=>{
      session={role}; stage='desk';
      const a={id:'a1',callsign:'101',type:'TRAINER',status:'airborne',mode:'heading',headingDeg:90,speedKt:240,altitudeFt:10000,targetAltitudeFt:10000,xNm:0,yNm:0};
      view={exerciseId:'example',available:true,environment:{rangeNm:60,stationName:'NAV0'},roster:[a],aircraft:[a],routes:[],fixes:[],areas:[],elapsed:0};
      choose(a.id); setStage('desk');
    };
    globalThis.setEnded=(ended)=>{view.terminated=ended;renderClockControls();renderSelection();};
    globalThis.setCompass=(unserviceable)=>{view.aircraft[0].compassUnserviceable=unserviceable;renderSelection();};
  `,h.context);
  h.context.prepare('instructor');
  assert.equal(h.document.getElementById('instrument-dock').parentElement.id,'instructor-control-shelf');
  assert.equal(h.document.getElementById('scope-manual-dock').parentElement.id,'compact-manual-slot');
  const canvas=h.document.getElementById('scope');
  const emit=(type,button,time,pointerType='mouse')=>{const e=new h.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{isPrimary:true,pointerId:1,pointerType,button,clientX:300,clientY:250,timeStamp:time});canvas.dispatchEvent(e);};
  emit('pointerdown',0,10);emit('pointerup',0,30);emit('pointerdown',0,100);emit('pointerup',0,130);
  assert.equal(h.context.commands.length,1);assert.equal(h.context.commands[0][1].action,'left');
  emit('pointerdown',2,300);emit('pointerup',2,330);emit('pointerdown',2,400);emit('pointerup',2,430);
  assert.equal(h.context.commands.length,2);assert.equal(h.context.commands[1][1].action,'right');
  emit('pointerdown',1,450);emit('pointerup',1,460);
  assert.equal(h.context.commands.at(-1)[1].action,'stop-turn');
  h.context.commands.pop();
  emit('pointerdown',0,500,'touch');emit('pointerup',0,530,'touch');emit('pointerdown',0,600,'touch');emit('pointerup',0,630,'touch');
  assert.equal(h.context.commands.length,4,'touch selection transmits without turning');
  assert.equal(h.context.commands[2][0],'transmit');assert.equal(h.context.commands[3][0],'transmit');
  h.document.getElementById('quick-right').click();assert.equal(h.context.commands[4][1].action,'right');
  emit('pointerdown',0,1000);emit('pointerup',0,1030);for(const fn of timers.values())fn();timers.clear();
  assert.equal(h.context.commands[5][0],'transmit');assert.equal(h.context.commands[5][2],'a1');
  const heading=h.document.getElementById('quick-heading');heading.value='270';
  h.document.getElementById('quick-heading-left').click();assert.equal(h.context.commands[6][1].action,'heading');assert.equal(h.context.commands[6][1].value,270);assert.equal(h.context.commands[6][1].direction,'left');
  heading.value='360';h.document.getElementById('quick-heading-right').click();assert.equal(h.context.commands[7][1].value,0);assert.equal(h.context.commands[7][1].direction,'right');
  for(const invalid of ['', '-1','361','12.5']) {heading.value=invalid;h.document.getElementById('quick-heading-left').click();}
  assert.equal(h.context.commands.length,8,'invalid headings never issue a clearance');
  h.context.setCompass(true);assert.equal(heading.disabled,true);heading.value='180';h.document.getElementById('quick-heading-left').click();assert.equal(h.context.commands.length,8);
  h.context.setCompass(false);h.document.getElementById('quick-more').click();assert.equal(h.document.getElementById('tab-pilot').hidden,false);
  h.context.prepare('student');assert.equal(h.document.getElementById('aircraft-quick-controls').hidden,true);
  assert.ok(h.document.getElementById('instrument-dock').parentElement.classList.contains('scope-panel'));
  assert.equal(h.document.getElementById('audio-enable').closest('label').parentElement.parentElement.id,'pilot-readback');
  assert.equal(h.document.querySelectorAll('#homing').length,1,'role changes preserve one live homing instrument');
  emit('pointerdown',2,1800);emit('pointerup',2,1830);assert.equal(h.context.commands.length,8);
  h.context.setEnded(true);const notice=h.document.getElementById('exercise-notice');
  assert.equal(notice.hidden,false);assert.equal(notice.getAttribute('role'),'alert');assert.equal(notice.classList.contains('student-termination'),true);
  assert.match(notice.textContent,/EXERCISE TERMINATED/);assert.equal(h.document.getElementById('work-panel').hidden,true);assert.equal(h.document.getElementById('reopen-exercise').hidden,true);
  h.context.setEnded(false);assert.equal(notice.hidden,true);assert.equal(notice.classList.contains('student-termination'),false);
  const end=h.document.getElementById('terminate-quick'),dialog=h.document.getElementById('terminate-confirm');
  dialog.showModal=()=>{dialog.open=true;};
  end.click();assert.ok(!dialog.open,'student cannot open termination confirmation');
  h.context.prepare('instructor');end.click();assert.equal(dialog.open,true);
  assert.equal(end.getAttribute('aria-pressed'),'true');
  dialog.open=false;dialog.returnValue='cancel';dialog.dispatchEvent(new h.Event('close'));
  await new Promise(resolve=>setImmediate(resolve));assert.equal(h.context.commands.length,8,'cancel never ends the exercise');
  end.click();assert.equal(dialog.returnValue,'','previous confirmation cannot leak into Escape');
  dialog.open=false;dialog.returnValue='terminate';dialog.dispatchEvent(new h.Event('close'));
  await new Promise(resolve=>setImmediate(resolve));assert.equal(h.context.commands.length,9);
  assert.equal(h.context.commands[8][0],'clock');assert.equal(h.context.commands[8][1].action,'terminate');
});

test('phone roster keeps 20 editable cards and retains callsigns while changing the count',async()=>{
  const h=domHarness('<html><body><section id="setup"></section></body></html>');
  let submitted;
  h.context.rosterHost={container:h.document.getElementById('setup'),view:()=>({title:'Phone exercise',mode:'area',environment:{}}),submit:async value=>{submitted=value;},airspace(){},cancel(){}};
  vm.runInContext(source('traffic-setup.js').replace('export function createTrafficSetup','function createTrafficSetup')+';createTrafficSetup(rosterHost).open();',h.context);
  const count=h.document.querySelector('[name="aircraftCount"]');
  const setCount=n=>{count.value=String(n);count.dispatchEvent(new h.Event('input',{bubbles:true}));};
  setCount(20);
  assert.ok(h.document.querySelector('.roster-editor--cards'));
  const callsigns=[...h.document.querySelectorAll('[data-field="callsign"]')];
  assert.equal(callsigns.length,20);
  callsigns[19].value='224';setCount(2);setCount(20);
  assert.equal(callsigns[19].value,'224');
  const jump=h.document.querySelector('.roster-navigator select');jump.value='19';jump.onchange();
  assert.equal(h.document.activeElement,callsigns[19]);
  h.document.querySelector('form').dispatchEvent(new h.Event('submit',{bubbles:true,cancelable:true}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(submitted.aircraft.length,20);assert.equal(submitted.aircraft[19].callsign,'224');
});
