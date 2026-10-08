import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {domHarness} from './testing/dom-harness.mjs';

test('instructor tool rail opens one drawer, closes with Escape and restores keyboard focus',()=>{
 const h=domHarness(readFileSync(new URL('../atc-suite/instructor.html',import.meta.url),'utf8'));
 vm.runInContext(readFileSync(new URL('./static/workspace-shell.js',import.meta.url),'utf8'),h.context);
 const get=id=>h.document.getElementById(id),root=get('activeWorkspace');
 h.context.ATCSuiteWorkspace.bindShell({root,scope:get('instructorScope'),shelf:get('instructorControlShelf'),actions:get('instructorRunActions')});
 const buttons=[...get('instructorTools').querySelectorAll('button')],sessionButton=buttons.find(b=>b.getAttribute('aria-controls')==='sessionDrawer'),aircraftButton=buttons.find(b=>b.getAttribute('aria-controls')==='aircraftControlDrawer');
 sessionButton.focus();sessionButton.click();assert.equal(get('sessionDrawer').open,true);assert.equal(sessionButton.getAttribute('aria-expanded'),'true');
 aircraftButton.focus();aircraftButton.click();assert.equal(get('sessionDrawer').open,false);assert.equal(get('aircraftControlDrawer').open,true);assert.equal(get('moreAircraftControls').getAttribute('aria-expanded'),'true');
 const escape=new h.Event('keydown',{bubbles:true});escape.key='Escape';h.document.dispatchEvent(escape);
 assert.equal(get('aircraftControlDrawer').open,false);assert.equal(h.document.activeElement,aircraftButton);assert.equal(aircraftButton.getAttribute('aria-expanded'),'false');
 assert.equal(get('instructorScope').getAttribute('tabindex'),'0');
 assert.equal(get('quickTransmit').parentElement.classList.contains('quick-turn-row'),true);
 assert.equal(get('instructorRunActions').parentElement.classList.contains('workspace-head'),true);
});

test('a phone drawer keeps Tab focus inside its visible controls',()=>{
 const h=domHarness(readFileSync(new URL('../atc-suite/instructor.html',import.meta.url),'utf8'));
 vm.runInContext(readFileSync(new URL('./static/workspace-shell.js',import.meta.url),'utf8'),h.context);
 const get=id=>h.document.getElementById(id),root=get('activeWorkspace');
 root.hidden=false;h.document.body.classList.add('exercise-console');
 h.context.ATCSuiteWorkspace.bindShell({root,scope:get('instructorScope'),shelf:get('instructorControlShelf'),actions:get('instructorRunActions')});
 const button=get('instructorTools').querySelector('[aria-controls="sessionDrawer"]');button.click();
 const drawer=get('sessionDrawer'),nodes=[...drawer.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(el=>!el.closest('[hidden]'));
 nodes.at(-1).focus();const forward=new h.Event('keydown',{bubbles:true});forward.key='Tab';h.document.dispatchEvent(forward);assert.equal(h.document.activeElement,nodes[0]);
 const backward=new h.Event('keydown',{bubbles:true});backward.key='Tab';backward.shiftKey=true;h.document.dispatchEvent(backward);assert.equal(h.document.activeElement,nodes.at(-1));
});

test('same-screen confirmation waits for a choice and Cancel preserves the caller state',async()=>{
 const h=domHarness('<html><body><button id="trigger">Load</button></body></html>');
 vm.runInContext(readFileSync(new URL('./static/workspace-shell.js',import.meta.url),'utf8'),h.context);
 const trigger=h.document.getElementById('trigger');trigger.focus();
 let applied=false;const choice=h.context.ATCSuiteWorkspace.confirmAction('Replace this exercise?',{confirmLabel:'Replace exercise'}).then(value=>{applied=value;return value;});
 assert.equal(applied,false);assert.equal(h.document.querySelectorAll('dialog').length,1);
 assert.equal(await h.context.ATCSuiteWorkspace.confirmAction('A second operation'),false);
 h.document.querySelector('dialog .ats-confirm-cancel').click();
 assert.equal(await choice,false);assert.equal(applied,false);assert.equal(h.document.querySelector('dialog'),null);assert.equal(h.document.activeElement===trigger,true);
 const accepted=h.context.ATCSuiteWorkspace.confirmAction('Replace this exercise?',{confirmLabel:'Replace exercise'});
 h.document.querySelector('dialog .ats-confirm-accept').click();assert.equal(await accepted,true);
 const escaped=h.context.ATCSuiteWorkspace.confirmAction('Discard entries?');h.document.querySelector('dialog').dispatchEvent(new h.Event('cancel',{cancelable:true}));assert.equal(await escaped,false);
});

test('persistent Logout confirms once, preserves progress on Cancel and waits for cleanup before Home',async()=>{
 const h=domHarness('<html><body><main id="desk" hidden></main><section id="review" hidden></section></body></html>');
 vm.runInContext(readFileSync(new URL('./static/workspace-shell.js',import.meta.url),'utf8'),h.context);
 const navigations=[];h.context.location.assign=url=>navigations.push(url);
 let cleanup=0,finish;const root=h.document.getElementById('desk');
 h.context.ATCSuiteWorkspace.bindShell({root,onLogout:()=>{cleanup++;return new Promise(resolve=>{finish=resolve;});}});
 const button=h.document.getElementById('workspaceLogout');
 assert.equal(button.textContent,'Logout');assert.equal(button.closest('[hidden]'),null,'Logout is outside changing setup/live/review containers');
 button.focus();button.click();button.click();assert.equal(h.document.querySelectorAll('dialog').length,1);
 assert.match(h.document.querySelector('dialog p').textContent,/Log out and return to ATS suite Home\? Current exercise progress will be lost\./);
 assert.equal(h.document.querySelector('.ats-confirm-accept').textContent,'Log out');
 h.document.querySelector('.ats-confirm-cancel').click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(cleanup,0);assert.equal(navigations.length,0);assert.equal(button.disabled,false);assert.equal(h.document.activeElement,button);
 button.click();h.document.querySelector('.ats-confirm-accept').click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(cleanup,1);assert.equal(navigations.length,0,'Home waits for actual session cleanup');assert.equal(button.disabled,true);
 button.click();assert.equal(h.document.querySelector('dialog'),null,'pending cleanup cannot open a second confirmation');
 finish();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(navigations,['https://example.test/qgh-voice/index.html']);assert.equal(button.disabled,false);
});

test('Logout cleanup failure keeps the current page and exposes an accessible retryable error',async()=>{
 const h=domHarness('<html><body><main id="studentWorkspace"></main></body></html>');
 vm.runInContext(readFileSync(new URL('./static/workspace-shell.js',import.meta.url),'utf8'),h.context);
 const navigations=[];h.context.location.assign=url=>navigations.push(url);
 h.context.ATCSuiteWorkspace.bindShell({root:h.document.getElementById('studentWorkspace'),onLogout:async()=>{throw new Error('Session could not close');}});
 const button=h.document.getElementById('workspaceLogout');button.click();h.document.querySelector('.ats-confirm-accept').click();await new Promise(resolve=>setImmediate(resolve));
 const status=h.document.querySelector('.ats-logout-status');assert.equal(status.hidden,false);assert.equal(status.getAttribute('role'),'alert');assert.match(status.textContent,/Session could not close/);
 assert.equal(navigations.length,0);assert.equal(button.disabled,false);
});

test('a phone confirmation keeps Tab inside the modal instead of the underlying drawer',async()=>{
 const h=domHarness('<html><body><main id="desk"><div class="exercisebar"></div><div id="instructor-control-shelf"></div><nav id="edge-actions"></nav></main><aside id="work-panel"><button id="drawer-close">Close</button><input></aside></body></html>');
 vm.runInContext(readFileSync(new URL('./static/workspace-shell.js',import.meta.url),'utf8'),h.context);
 const get=id=>h.document.getElementById(id);
 h.context.ATCSuiteWorkspace.bindShell({root:get('desk'),shelf:get('instructor-control-shelf')});
 const choice=h.context.ATCSuiteWorkspace.confirmAction('Create this exercise?',{confirmLabel:'Create exercise'});
 const dialog=h.document.querySelector('dialog'),cancel=dialog.querySelector('.ats-confirm-cancel'),accept=dialog.querySelector('.ats-confirm-accept');
 // Native showModal takes care of moving between its buttons; the shared
 // drawer trap must leave both directions untouched so that can happen.
 for(const [button,shiftKey] of [[cancel,false],[accept,true]]){
   button.focus();const event=new h.Event('keydown',{bubbles:true,cancelable:true});event.key='Tab';event.shiftKey=shiftKey;button.dispatchEvent(event);
   assert.equal(event.defaultPrevented,false);assert.equal(h.document.activeElement,button);
 }
 accept.click();assert.equal(await choice,true);
 // With the modal gone, the existing phone drawer containment still works.
 get('work-panel').querySelector('input').focus();const outside=new h.Event('keydown',{bubbles:true,cancelable:true});outside.key='Tab';get('work-panel').querySelector('input').dispatchEvent(outside);
 assert.equal(outside.defaultPrevented,true);assert.equal(h.document.activeElement===get('work-panel').querySelector('button'),true);
});

test('instructor Options changes display only and preserves selected aircraft controls',()=>{
 const h=domHarness(readFileSync(new URL('../atc-suite/instructor.html',import.meta.url),'utf8'));
 vm.runInContext(readFileSync(new URL('./static/workspace-shell.js',import.meta.url),'utf8'),h.context);
 const get=id=>h.document.getElementById(id),root=get('activeWorkspace');
 h.context.ATCSuiteWorkspace.bindShell({root,scope:get('instructorScope'),shelf:get('instructorControlShelf'),actions:get('instructorRunActions')});
 get('quickHeading').value='233';
 const options=get('workspaceOptionsToggle');options.click();assert.equal(root.classList.contains('ats-focus-mode'),true);assert.equal(options.getAttribute('aria-expanded'),'false');
 options.click();assert.equal(root.classList.contains('ats-focus-mode'),false);assert.equal(options.getAttribute('aria-expanded'),'true');assert.equal(get('scopeSettings').open,true);
 assert.equal(get('quickHeading').value,'233');
});

test('edge Controls hides and restores instruments without changing heading or lifecycle controls',async()=>{
 const h=domHarness(readFileSync(new URL('../atc-suite/instructor.html',import.meta.url),'utf8'));
 vm.runInContext(readFileSync(new URL('./static/workspace-shell.js',import.meta.url),'utf8'),h.context);
 const get=id=>h.document.getElementById(id),root=get('activeWorkspace');
 h.context.ATCSuiteWorkspace.bindShell({root,scope:get('instructorScope'),shelf:get('instructorControlShelf'),actions:get('instructorRunActions')});
 await Promise.resolve();
 get('quickHeading').value='233';
 const toggle=get('scopeControlsToggle');
 assert.equal(toggle.getAttribute('aria-controls'),'instructorControlShelf');
 toggle.click();assert.equal(root.classList.contains('ats-instruments-hidden'),true);assert.equal(toggle.getAttribute('aria-expanded'),'false');
 toggle.click();assert.equal(root.classList.contains('ats-instruments-hidden'),false);assert.equal(toggle.getAttribute('aria-expanded'),'true');
 assert.equal(get('quickHeading').value,'233');
 assert.equal(get('instructorRunActions').parentElement.classList.contains('workspace-head'),true);
});

test('Clock keeps its accessible summary while rate fields move into a separate popover',()=>{
 const h=domHarness(readFileSync(new URL('../atc-suite/instructor.html',import.meta.url),'utf8'));
 vm.runInContext(readFileSync(new URL('./static/workspace-shell.js',import.meta.url),'utf8'),h.context);
 const get=id=>h.document.getElementById(id),root=get('activeWorkspace');
 h.context.ATCSuiteWorkspace.bindShell({root,scope:get('instructorScope'),shelf:get('instructorControlShelf'),actions:get('instructorRunActions')});
 assert.equal(get('trainingTimeRate').closest('.ats-clock-popover').parentElement,get('clockSettings'));
 assert.equal(get('trainingRateStatus').parentElement.classList.contains('ats-clock-popover'),true);
 get('trainingTimeRate').value='1';get('trainingTimeRate').dispatchEvent(new h.Event('change'));
 assert.equal(get('clockSettings').querySelector('summary').textContent,'Clock · 1×');
});

test('only aircraft/radio instruments move into the left box; the vertical tools keep their original right home',async()=>{
 const h=domHarness(readFileSync(new URL('../atc-suite/instructor.html',import.meta.url),'utf8'));
 let desktop=true;const handlers=[];
 h.context.window.matchMedia=query=>({get matches(){return query.includes('min-width')?desktop:!desktop;},addEventListener(event,handler){if(query.includes('min-width'))handlers.push(handler);}});
 vm.runInContext(readFileSync(new URL('./static/workspace-shell.js',import.meta.url),'utf8'),h.context);
 const get=id=>h.document.getElementById(id),shelf=get('instructorControlShelf'),original=shelf.parentElement;
 get('quickHeading').value='233';let commands=0;get('quickStopTurn').addEventListener('click',()=>commands++);
 h.context.ATCSuiteWorkspace.bindShell({root:get('activeWorkspace'),scope:get('instructorScope'),shelf,actions:get('instructorRunActions')});await Promise.resolve();
 const dock=h.document.querySelector('.ats-instrument-box'),tools=get('instructorTools'),toolHome=tools.closest('.ats-scroll-wrap--tools').parentElement;
 assert.equal(shelf.parentElement,dock);assert.equal(tools.closest('.ats-instrument-box'),null);
 assert.equal(toolHome,h.document.querySelector('.instructor-console'));
 assert.equal(tools.querySelector('.ats-instruments-toggle').textContent,'Controls');
 const collapse=dock.querySelector('.ats-overlay-collapse');collapse.click();assert.equal(dock.classList.contains('ats-overlay-collapsed'),true);assert.equal(collapse.getAttribute('aria-expanded'),'false');
 collapse.click();assert.equal(dock.classList.contains('ats-overlay-collapsed'),false);
 get('quickStopTurn').click();assert.equal(commands,1);assert.equal(get('quickHeading').value,'233');
 desktop=false;for(const handler of handlers)handler();
 assert.equal(dock.hidden,true);assert.equal(shelf.parentElement,original);assert.equal(tools.closest('.ats-instrument-box'),null);assert.equal(tools.closest('.ats-scroll-wrap--tools').parentElement,toolHome);
 desktop=true;for(const handler of handlers)handler();assert.equal(shelf.parentElement,dock);assert.equal(dock.hidden,false);
 assert.equal(h.document.querySelectorAll('#instructorControlShelf').length,1);assert.equal(get('quickHeading').value,'233');
});

test('Procedural moves existing ring and label selectors beside Range without replacing state or listeners',async()=>{
 const h=domHarness('<html><body><main id="desk"><div class="exercisebar"></div><div class="scope-toolbar"><div><button id="zoom-out"></button></div></div><div id="instructor-control-shelf"></div><nav id="edge-actions"><div class="edge-group"></div></nav></main><aside><label>Ring spacing<select id="ring-spacing"><option value="5">5 NM</option><option value="10">10 NM</option></select></label><label>Labels<select id="aircraft-labels"><option value="selected">Selected</option></select></label></aside></body></html>');
 vm.runInContext(readFileSync(new URL('./static/workspace-shell.js',import.meta.url),'utf8'),h.context);
 const get=id=>h.document.getElementById(id),ring=get('ring-spacing');let changes=0;
 ring.value='5';ring.addEventListener('change',()=>changes++);
 h.context.ATCSuiteWorkspace.bindShell({root:get('desk'),shelf:get('instructor-control-shelf')});await Promise.resolve();
 assert.equal(ring.closest('label').parentElement,h.document.querySelector('.scope-toolbar > div'));
 assert.equal(get('aircraft-labels').closest('label').parentElement,ring.closest('label').parentElement);
 assert.equal(get('ring-spacing'),ring);assert.equal(ring.value,'5');ring.dispatchEvent(new h.Event('change'));assert.equal(changes,1);
 assert.equal(h.document.querySelectorAll('#ring-spacing').length,1);
});

test('Procedural student plotting retains its original tool and instrument homes',async()=>{
 const h=domHarness('<html><body class="student-desk"><main id="desk"><div class="exercisebar"></div><section class="scope-panel"><canvas id="scope"></canvas><div id="instructor-control-shelf"></div><nav id="edge-actions"><div class="edge-group"></div></nav></section></main></body></html>');
 h.context.window.matchMedia=query=>({matches:query.includes('min-width'),addEventListener(){}});
 const get=id=>h.document.getElementById(id),shelf=get('instructor-control-shelf'),tools=get('edge-actions'),home=shelf.parentElement;
 vm.runInContext(readFileSync(new URL('./static/workspace-shell.js',import.meta.url),'utf8'),h.context);
 h.context.ATCSuiteWorkspace.bindShell({root:get('desk'),scope:get('scope'),shelf});await Promise.resolve();
 assert.equal(h.document.querySelector('.ats-instrument-box').hidden,true);
 assert.equal(shelf.parentElement===home,true);assert.equal(tools.closest('.ats-scroll-wrap--tools').parentElement===home,true);
});

test('desktop right rail uses the scope/legend boundary independently of the left instruments',async()=>{
 const h=domHarness('<html><body class="instructor-desk controls-collapsed"><main id="desk"><div class="exercisebar"></div><section class="scope-panel"><canvas id="scope"></canvas><div id="instructor-control-shelf"></div><nav id="edge-actions"><div class="edge-group"></div></nav><button id="toggle-controls" aria-pressed="true">Show controls</button></section></main></body></html>');
 h.context.window.matchMedia=query=>({matches:query.includes('min-width'),addEventListener(){}});
 const get=id=>h.document.getElementById(id),panel=h.document.querySelector('.scope-panel');
 panel.getBoundingClientRect=()=>({top:56,bottom:500,height:444});
 get('scope').getBoundingClientRect=()=>({top:100,bottom:480,height:380});
 get('instructor-control-shelf').getBoundingClientRect=()=>({top:400,bottom:474,height:74});
 vm.runInContext(readFileSync(new URL('./static/workspace-shell.js',import.meta.url),'utf8'),h.context);
 h.context.ATCSuiteWorkspace.bindShell({root:get('desk'),scope:get('scope'),shelf:get('instructor-control-shelf')});await Promise.resolve();
 assert.equal(panel.style.getPropertyValue('--ats-plot-top'),'44px');
 assert.equal(panel.style.getPropertyValue('--ats-rail-bottom'),'28px');
 assert.equal(h.document.body.classList.contains('controls-collapsed'),false);
 assert.equal(get('toggle-controls').getAttribute('aria-pressed'),'false');
});

function pointer(h,target,type,x,y,id=7){
 const event=new h.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{button:0,pointerId:id,clientX:x,clientY:y});target.dispatchEvent(event);return event;
}
function key(h,target,name,shiftKey=false){const event=new h.Event('keydown',{bubbles:true,cancelable:true});event.key=name;event.shiftKey=shiftKey;target.dispatchEvent(event);return event;}
async function floatingHarness(){
 const h=domHarness(readFileSync(new URL('../atc-suite/instructor.html',import.meta.url),'utf8'),'/instructor-led/instructor.html',1280),resize=[];
 h.window.innerHeight=720;h.window.addEventListener=(type,fn)=>{if(type==='resize')resize.push(fn);};h.window.matchMedia=query=>({matches:query.includes('min-width'),addEventListener(){}});
 vm.runInContext(readFileSync(new URL('./static/workspace-shell.js',import.meta.url),'utf8'),h.context);
 const get=id=>h.document.getElementById(id);get('activeWorkspace').hidden=false;h.document.body.classList.add('exercise-console');
 h.context.ATCSuiteWorkspace.bindShell({root:get('activeWorkspace'),scope:get('instructorScope'),shelf:get('instructorControlShelf'),actions:get('instructorRunActions')});await Promise.resolve();
 const box=get('instructorFloatingControls');box.getBoundingClientRect=()=>({left:parseFloat(box.style.left)||6,top:parseFloat(box.style.top)||104,width:260,height:360});
 return {...h,get,box,resize,handle:box.querySelector('.ats-overlay-move')};
}
test('dragging the dedicated box handle is isolated from flight controls, and pointer cancel restores its position',async()=>{
 const h=await floatingHarness();let leaked=0,commands=0;
 h.document.addEventListener('pointerdown',()=>leaked++);h.document.addEventListener('pointermove',()=>leaked++);
 h.get('quickStopTurn').addEventListener('click',()=>commands++);h.get('quickHeading').value='233';
 assert.equal(pointer(h,h.handle,'pointerdown',10,110).defaultPrevented,true);
 pointer(h,h.handle,'pointermove',80,180);assert.equal(h.box.style.left,'76px');assert.equal(h.box.style.top,'174px');
 pointer(h,h.handle,'pointercancel',80,180);assert.equal(h.box.style.left,undefined);assert.equal(h.box.classList.contains('ats-overlay-positioned'),false);
 assert.equal(leaked,0);assert.equal(commands,0);assert.equal(h.get('quickHeading').value,'233');
 h.get('quickStopTurn').click();assert.equal(commands,1);
 // Interacting with a live control does not start an overlay drag.
 pointer(h,h.get('quickHeading'),'pointerdown',20,20);pointer(h,h.get('quickHeading'),'pointermove',200,200);assert.equal(h.box.classList.contains('ats-overlay-positioned'),false);
});
test('keyboard movement and drag clamp to the viewport after resize, and Reset/Home restore the default corner',async()=>{
 const h=await floatingHarness();
 pointer(h,h.handle,'pointerdown',10,110);pointer(h,h.handle,'pointermove',2010,2110);pointer(h,h.handle,'pointerup',2010,2110);
 assert.equal(h.box.style.left,'1012px');assert.equal(h.box.style.top,'352px');
 h.window.innerWidth=900;h.window.innerHeight=600;for(const sync of h.resize)sync();
 assert.equal(h.box.style.left,'632px');assert.equal(h.box.style.top,'232px');
 assert.equal(key(h,h.handle,'ArrowLeft').defaultPrevented,true);assert.equal(h.box.style.left,'622px');
 key(h,h.handle,'ArrowLeft',true);assert.equal(h.box.style.left,'621px');
 key(h,h.handle,'Home');assert.equal(h.box.classList.contains('ats-overlay-positioned'),false);
 key(h,h.handle,'ArrowRight');assert.equal(h.box.style.left,'16px');h.box.querySelector('.ats-overlay-reset').click();assert.equal(h.box.classList.contains('ats-overlay-positioned'),false);
});
test('modal Move/Reset never chooses an answer, and Escape leaves the underlying drawer open',async()=>{
 const h=await floatingHarness(),sessionButton=h.get('instructorTools').querySelector('[aria-controls="sessionDrawer"]');sessionButton.click();
 let settled=false;const choice=h.context.ATCSuiteWorkspace.confirmAction('Replace exercise?').then(value=>{settled=true;return value;});
 const dialog=h.document.querySelector('dialog'),move=dialog.querySelector('.ats-overlay-move');dialog.getBoundingClientRect=()=>({left:400,top:200,width:360,height:220});
 pointer(h,move,'pointerdown',420,220);pointer(h,move,'pointermove',470,250);pointer(h,move,'pointerup',470,250);
 dialog.querySelector('.ats-overlay-reset').click();await Promise.resolve();assert.equal(settled,false);
 const cancel=dialog.querySelector('.ats-confirm-cancel');cancel.focus();key(h,cancel,'Escape');assert.equal(h.get('sessionDrawer').open,true);
 dialog.dispatchEvent(new h.Event('cancel',{cancelable:true}));assert.equal(await choice,false);assert.equal(h.get('sessionDrawer').open,true);
});
test('drawer, clock, help and guided-tour panels use dedicated move handles while their controls remain the same nodes',async()=>{
 const h=await floatingHarness();
 for(const id of ['sessionDrawer','aircraftControlDrawer','eventDrawer','consoleNavigation'])assert.ok(h.get(id).querySelector('.ats-overlay-move'));
 assert.ok(h.document.querySelector('.ats-clock-popover .ats-overlay-move'));assert.equal(h.get('trainingTimeRate').value,'5');
 for(const [id,tag]of [['suite-guide-chat-panel','header'],['suite-tour','h2'],['boundary-scope-tools','strong']]){
   const panel=h.document.createElement('section');panel.id=id;panel.append(h.document.createElement(tag));h.document.body.append(panel);
 }
 await new Promise(resolve=>setTimeout(resolve,0));
 for(const id of ['suite-guide-chat-panel','suite-tour','boundary-scope-tools'])assert.ok(h.get(id).querySelector('.ats-overlay-move'));
});

test('a moved drawer keeps its height through close/reopen and fits the visual viewport without losing its preferred size',async()=>{
 const h=await floatingHarness(),drawer=h.get('sessionDrawer');drawer.open=true;
 drawer.getBoundingClientRect=()=>drawer.open?{left:parseFloat(drawer.style.left)||700,top:parseFloat(drawer.style.top)||56,width:360,height:parseFloat(drawer.style.height)||600}:{left:0,top:0,width:0,height:0};
 const handle=drawer.querySelector('.ats-overlay-move');key(h,handle,'ArrowLeft');assert.equal(drawer.style.height,'600px');
 drawer.open=false;for(const sync of h.resize)sync();assert.equal(drawer.style.height,'600px');
 drawer.open=true;for(const sync of h.resize)sync();assert.equal(drawer.style.height,'600px');
 // Pinch zoom or the phone keyboard can make the visible viewport smaller.
 h.window.visualViewport={width:420,height:340,offsetLeft:30,offsetTop:50};for(const sync of h.resize)sync();
 assert.equal(drawer.style.height,'324px');assert.equal(drawer.style.top,'58px');assert.equal(parseFloat(drawer.style.left)>=38,true);
 h.window.visualViewport={width:1280,height:720,offsetLeft:0,offsetTop:0};for(const sync of h.resize)sync();assert.equal(drawer.style.height,'600px');
 drawer.querySelector('.ats-overlay-reset').click();assert.equal(drawer.classList.contains('ats-overlay-positioned'),false);
});

test('both instructor reviews provide an ATS suite Home destination only within their review context',()=>{
 for(const [page,id,reviewId]of [['../atc-suite/instructor.html','reviewSuiteHome','reviewScreen'],['./static/procedural.html','review-suite-home','tab-debrief']]){
   const h=domHarness(readFileSync(new URL(page,import.meta.url),'utf8')),link=h.document.getElementById(id),review=h.document.getElementById(reviewId);
   assert.ok(link);assert.equal(link.textContent,'ATS suite Home');assert.equal(link.getAttribute('href'),'../index.html');
   assert.equal(new URL(link.getAttribute('href'),'https://example.test/ats/instructor-led/instructor.html').href,'https://example.test/ats/index.html');
   assert.equal(review.contains(link),true);assert.equal(review.hidden,true);assert.ok(link.closest('[hidden]'));
   for(let parent=link.parentElement;parent;parent=parent.parentElement)parent.hidden=false;
   assert.equal(link.closest('[hidden]'),null);
   review.hidden=true;assert.equal(link.closest('[hidden]')===review,true);
 }
});
