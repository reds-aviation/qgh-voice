'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const requireDom = createRequire(path.resolve(__dirname,'../../procedural-beta/package.json'));
const {parseHTML} = requireDom('linkedom');
const player = require('../tutorial-player.js');
const html = fs.readFileSync(path.resolve(__dirname,'../training-centre.html'),'utf8');
const sourceConfiguration = JSON.parse(fs.readFileSync(path.resolve(__dirname,'../tutorial-video.json'),'utf8'));
const pending = {...sourceConfiguration,status:'pending',youtubeId:null,durationSeconds:null,chapters:sourceConfiguration.chapters.map(chapter=>({...chapter,startSeconds:null}))};
// Test fixture only; never used as a production YouTube identity or requested.
const ready = {version:'1.0.0',status:'ready',youtubeId:'abcdefghijk',title:'Example course',durationSeconds:180,chapterCount:2,chapters:[{id:'start',title:'Start',startSeconds:0},{id:'controls',title:'Controls',startSeconds:90}]};
function harness() {
  const {document}=parseHTML(html), listeners=new Map(),focusCalls=[];
  Object.defineProperty(document,'hidden',{value:false,writable:true});
  Object.defineProperty(document,'activeElement',{value:null,writable:true});
  const createElement=document.createElement.bind(document);
  const focus=(element,options)=>{document.activeElement=element;focusCalls.push({element,options,connected:element.isConnected});};
  document.createElement=tag=>{const element=createElement(tag);if(tag==='iframe')element.focus=options=>focus(element,options);return element;};
  const select=document.getElementById('suiteTutorialChapter');select.focus=options=>focus(select,options);
  const launch=document.getElementById('suiteTutorialLaunch');launch.focus=options=>focus(launch,options);
  const win={location:new URL('https://simulator.test/qgh-voice/training-centre.html'),navigator:{onLine:true},addEventListener:(name,fn)=>listeners.set(name,fn)};
  const video=document.createElement('video');let pauses=0;video.pause=()=>pauses++;document.body.append(video);
  return {document,win,video,listeners,pauses:()=>pauses,select,focusCalls};
}

test('pending publication and invalid identities/timings create no remote player',()=>{
  assert.equal(pending.youtubeId,null);assert.equal(pending.status,'pending');
  assert.equal(pending.chapters.length,18);assert.ok(pending.chapters.every(chapter=>chapter.startSeconds===null));
  for(const value of [pending,{...ready,version:'0.9.0'},{...ready,youtubeId:'https://evil.test'},{...ready,chapters:[{title:'Bad',startSeconds:-1}]},{...ready,chapters:[{title:'Outside',startSeconds:180}]}]){
    const h=harness();player.mount(h.document,h.win,player.configuration(value,'1.0.0'));
    assert.equal(h.document.getElementById('suiteTutorial').hidden,true);
    assert.equal(h.document.querySelector('iframe'),null);
  }
});

test('Load moves focus to the inserted player without scrolling, while chapter changes retain select focus',()=>{
  const h=harness();player.mount(h.document,h.win,player.configuration(ready,'1.0.0'));
  const launch=h.document.getElementById('suiteTutorialLaunch');launch.focus();launch.click();
  const initialFrame=h.document.querySelector('iframe');
  assert.equal(h.document.activeElement,initialFrame);
  assert.deepEqual(h.focusCalls.at(-1).options,{preventScroll:true});
  assert.equal(h.focusCalls.at(-1).connected,true,'focus is applied after insertion into the visible player');
  h.select.focus();const count=h.focusCalls.length;
  h.select.querySelectorAll('option').forEach(option=>{option.selected=option.value==='90';});
  h.select.dispatchEvent(new h.document.defaultView.Event('change'));
  assert.notEqual(h.document.querySelector('iframe'),initialFrame,'the selected chapter replaces the old player');
  assert.equal(h.document.activeElement,h.select,'chapter keyboard focus is preserved');
  assert.equal(h.focusCalls.length,count,'chapter navigation never refocuses the iframe');
});

test('ready publication preserves every declared chapter and rejects incomplete or inconsistent metadata',()=>{
  const complete=player.configuration(ready,'1.0.0');
  assert.deepEqual(complete.chapters,ready.chapters,'a complete two-chapter course works without a hardcoded course count');
  const invalid=[
    {...ready,chapters:undefined},
    {...ready,chapterCount:0},
    {...ready,chapterCount:3},
    {...ready,chapters:[]},
    {...ready,chapters:[ready.chapters[0]]},
    {...ready,chapters:[{...ready.chapters[0],startSeconds:1},ready.chapters[1]]},
    ...[null,undefined,1.5,180].map(startSeconds=>({...ready,chapters:[ready.chapters[0],{...ready.chapters[1],startSeconds}]})),
    {...ready,chapters:[ready.chapters[0],null]},
    {...ready,chapters:[ready.chapters[0],{...ready.chapters[1],title:' '}]},
    {...ready,chapters:[ready.chapters[0],{...ready.chapters[1],id:undefined}]},
    {...ready,chapters:[ready.chapters[0],{...ready.chapters[1],id:'start'}]},
    {...ready,chapters:[ready.chapters[0],{...ready.chapters[1],startSeconds:0}]}
  ];
  for(const value of invalid){
    const h=harness();assert.equal(player.configuration(value,'1.0.0'),null);
    player.mount(h.document,h.win,player.configuration(value,'1.0.0'));
    assert.equal(h.document.getElementById('suiteTutorial').hidden,true);
    assert.equal(h.document.querySelector('iframe'),null);
  }
  assert.equal(sourceConfiguration.chapters.length,sourceConfiguration.chapterCount,'production metadata declares the complete chapter count');
});

test('ready tutorial loads only on user action and uses a titled responsive no-autoplay iframe',()=>{
  const h=harness();player.mount(h.document,h.win,player.configuration(ready,'1.0.0'));
  assert.equal(h.document.getElementById('suiteTutorial').hidden,false);
  assert.equal(h.document.querySelector('iframe'),null,'configuration never requests YouTube');
  h.document.getElementById('suiteTutorialLaunch').click();
  const frame=h.document.querySelector('iframe'),url=new URL(frame.getAttribute('src'));
  assert.equal(url.origin,'https://www.youtube-nocookie.com');assert.equal(url.searchParams.get('autoplay'),'0');
  assert.equal(frame.title,'Example course');assert.equal(frame.getAttribute('referrerpolicy'),'strict-origin-when-cross-origin');
  assert.ok(frame.hasAttribute('allowfullscreen'));assert.equal(h.pauses(),1,'local clips paused before remote player');
  const css=fs.readFileSync(path.resolve(__dirname,'../training-centre.css'),'utf8');
  assert.match(css,/\.suite-tutorial-player\{[^}]*width:100%;aspect-ratio:16\/9/);
});

test('keyboard-compatible chapter select changes the genuine start and fallback URL without autoplay',()=>{
  const h=harness();player.mount(h.document,h.win,player.configuration(ready,'1.0.0'));
  h.select.querySelectorAll('option').forEach(option=>{option.selected=option.value==='90';});
  h.select.dispatchEvent(new h.document.defaultView.Event('change'));
  const frame=h.document.querySelector('iframe'),url=new URL(frame.getAttribute('src'));
  assert.equal(url.searchParams.get('start'),'90');assert.equal(url.searchParams.get('autoplay'),'0');
  const fallback=new URL(h.document.getElementById('suiteTutorialYouTube').href);
  assert.equal(fallback.searchParams.get('t'),'90');assert.equal(h.select.querySelectorAll('option').length,3);
});

test('stop/visibility/pagehide/local playback/offline remove the player, and offline load stays local',()=>{
  for(const action of ['stop','hidden','pagehide','local','offline']){
    const h=harness();player.mount(h.document,h.win,player.configuration(ready,'1.0.0'));
    const launch=h.document.getElementById('suiteTutorialLaunch');launch.focus=()=>{};launch.click();
    if(action==='stop')h.document.getElementById('suiteTutorialStop').click();
    if(action==='hidden'){h.document.hidden=true;h.document.dispatchEvent(new h.document.defaultView.Event('visibilitychange'));}
    if(action==='pagehide')h.listeners.get('pagehide')();
    if(action==='local')h.video.dispatchEvent(new h.document.defaultView.Event('play',{bubbles:true}));
    if(action==='offline')h.listeners.get('offline')();
    assert.equal(h.document.querySelector('iframe'),null,action);assert.equal(launch.hidden,false,action);
  }
  const h=harness();h.win.navigator.onLine=false;player.mount(h.document,h.win,player.configuration(ready,'1.0.0'));
  h.document.getElementById('suiteTutorialLaunch').click();assert.equal(h.document.querySelector('iframe'),null);
  assert.match(h.document.getElementById('suiteTutorialStatus').textContent,/internet connection/);
});

test('failed configuration loading preserves written/offline content and leaves tutorial hidden',async()=>{
  const h=harness();h.win.fetch=async()=>{throw new Error('offline');};await player.load(h.document,h.win);
  assert.equal(h.document.getElementById('suiteTutorial').hidden,true);
  assert.equal(h.document.querySelector('iframe'),null);assert.ok(h.document.getElementById('calls'));
});
