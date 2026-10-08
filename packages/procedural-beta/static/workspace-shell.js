(function () {
  'use strict';
  // One UI shell for the existing simulator adapters. It never owns flight state.
  function enter(element, options = {}) {
    if (!element) return;
    element.scrollIntoView?.({block:options.block || 'start', behavior:'auto'});
    const target = options.focusTarget;
    if (target) { if (!target.hasAttribute?.('tabindex')) target.setAttribute?.('tabindex','-1'); target.focus?.({preventScroll:true}); }
  }
  function bindShell({root,scope,shelf,actions,onLogout}) {
    root?.classList.add('ats-workspace-shell');
    scope?.classList.add('ats-scope-surface');
    shelf?.classList.add('ats-aircraft-shelf');
    actions?.classList.add('ats-workspace-actions');
    if (typeof onLogout === 'function') bindLogout({root,onLogout});
    if (root?.ownerDocument?.createElement && root.id === 'activeWorkspace') installInstructorConsole({root,scope,shelf,actions});
    if (root?.ownerDocument?.createElement && root.id === 'desk') installProceduralConsole(root);
    // Procedural moves its existing fleet into the toolbar later in the same
    // module. Attach after that move so the track keeps the correct home.
    if (root?.ownerDocument?.createElement) Promise.resolve().then(()=>{
      installInstrumentToggle(root,shelf);
      installScopeSelectors(root);
      installScopeRailAnchor(root,scope,shelf);
      installPhoneScrollTracks(root);
      installFloatingInstruments(root,shelf);
      installOverlaySurfaces(root);
    });
  }
  function installFloatingInstruments(root,shelf) {
    const parent=root.querySelector('.instructor-console, .scope-panel');
    const desktop=window.matchMedia?.('(min-width: 701px)');
    if(!parent||!shelf||!desktop)return;
    // Only the original bottom shelf moves. The tools stay on the right, and
    // the same shelf nodes return to their original phone/student location.
    const doc=root.ownerDocument,box=doc.createElement('aside'),anchor=doc.createElement('span');
    box.id=root.id==='activeWorkspace'?'instructorFloatingControls':'proceduralFloatingControls';
    box.className='ats-instrument-box';box.setAttribute('aria-label','Aircraft quick controls, homing and pilot transmission');
    anchor.hidden=true;anchor.className='ats-instrument-anchor';shelf.before(anchor);
    const header=doc.createElement('header');header.className='ats-overlay-header';
    const title=doc.createElement('strong');title.textContent='Aircraft & radio';header.append(title);
    const collapse=doc.createElement('button');collapse.type='button';collapse.className='ats-overlay-collapse';collapse.textContent='Collapse';
    collapse.setAttribute('aria-controls',shelf.id);collapse.setAttribute('aria-expanded','true');
    collapse.addEventListener('click',()=>{const closed=box.classList.toggle('ats-overlay-collapsed');collapse.textContent=closed?'Expand':'Collapse';collapse.setAttribute('aria-expanded',String(!closed));});
    header.append(collapse);box.append(header);parent.append(box);
    installMovableOverlay(box,{header,label:'Aircraft quick controls',desktopOnly:true});
    let current=null;
    const sync=()=>{
      const enabled=desktop.matches&&(root.id==='activeWorkspace'||root.ownerDocument.body.classList.contains('instructor-desk'));
      if(enabled===current)return;
      current=enabled;
      box.hidden=!enabled;
      if(enabled)box.append(shelf);else anchor.after(shelf);
    };
    desktop.addEventListener?.('change',sync);
    if(typeof MutationObserver==='function')new MutationObserver(sync).observe(root.ownerDocument.body,{attributes:true,attributeFilter:['class']});
    sync();
  }
  const movableOverlays=new WeakMap();
  function installMovableOverlay(element,{header,label='Panel',desktopOnly=false,preserveHeight=false}={}) {
    if(!element||movableOverlays.has(element))return;
    const doc=element.ownerDocument,desktop=window.matchMedia?.('(min-width: 701px)');
    if(!header){header=doc.createElement('header');header.className='ats-overlay-header';element.prepend(header);}
    const controls=doc.createElement('span');controls.className='ats-overlay-tools';
    const handle=doc.createElement('button');handle.type='button';handle.className='ats-overlay-move';handle.textContent='Move';
    handle.setAttribute('aria-label',`Move ${label}. Drag, or use arrow keys. Home resets position.`);
    handle.setAttribute('aria-keyshortcuts','ArrowUp ArrowDown ArrowLeft ArrowRight Home');
    handle.title='Drag to move · arrow keys move · Shift makes small moves · Home resets';
    const reset=doc.createElement('button');reset.type='button';reset.className='ats-overlay-reset';reset.textContent='Reset';reset.title='Reset position';reset.setAttribute('aria-label',`Reset ${label} position`);
    controls.append(handle,reset);header.append(controls);element.classList.add('ats-movable-overlay');
    if(desktopOnly)controls.classList.add('ats-overlay-desktop');
    const properties=['position','left','top','right','bottom','margin','transform','height','max-height','max-width'];
    const original=new Map(properties.map(name=>[name,element.style.getPropertyValue(name)]));
    let position=null,drag=null,preferredHeight=null;
    const enabled=()=>!desktopOnly||Boolean(desktop?.matches);
    const clear=()=>{for(const [name,value]of original){if(value)element.style.setProperty(name,value);else element.style.removeProperty(name);}element.classList.remove('ats-overlay-positioned');};
    const viewport=()=>({width:window.visualViewport?.width||window.innerWidth||doc.documentElement?.clientWidth||1280,height:window.visualViewport?.height||window.innerHeight||doc.documentElement?.clientHeight||800,left:window.visualViewport?.offsetLeft||0,top:window.visualViewport?.offsetTop||0});
    const bounds=()=>{const r=element.getBoundingClientRect();return {left:Number(r.left)||0,top:Number(r.top)||0,width:Number(r.width)||element.offsetWidth||200,height:Number(r.height)||element.offsetHeight||80};};
    const rendered=()=>{
      if(element.hidden||element.closest('[hidden]')||(element.tagName==='DETAILS'&&!element.open))return false;
      const r=element.getBoundingClientRect();return r.width>0&&r.height>0;
    };
    function place(x,y) {
      if(!enabled()||!rendered())return;
      const area=viewport(),r=bounds(),edge=8;
      if(preserveHeight&&preferredHeight==null)preferredHeight=r.height;
      const width=Math.min(r.width,Math.max(1,area.width-edge*2)),height=Math.min(preferredHeight??r.height,Math.max(1,area.height-edge*2));
      position={x:Math.max(area.left+edge,Math.min(x,area.left+area.width-width-edge)),y:Math.max(area.top+edge,Math.min(y,area.top+area.height-height-edge))};
      element.classList.add('ats-overlay-positioned');
      for(const [name,value]of Object.entries({position:'fixed',left:`${position.x}px`,top:`${position.y}px`,right:'auto',bottom:'auto',margin:'0',transform:'none','max-width':`${area.width-edge*2}px`,'max-height':`${area.height-edge*2}px`}))element.style.setProperty(name,value);
      if(preserveHeight)element.style.setProperty('height',`${height}px`);
    }
    const resetPosition=()=>{position=null;preferredHeight=null;clear();};
    const sync=()=>{if(!enabled())clear();else if(position&&rendered())place(position.x,position.y);};
    const stop=event=>{event.preventDefault();event.stopPropagation();};
    handle.addEventListener('click',stop);
    reset.addEventListener('click',event=>{stop(event);resetPosition();});
    handle.addEventListener('keydown',event=>{
      if(!enabled())return;
      if(event.key==='Home'){stop(event);resetPosition();return;}
      const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
      if(!direction)return;stop(event);const r=bounds(),step=event.shiftKey?1:10;
      place((position?.x??r.left)+direction[0]*step,(position?.y??r.top)+direction[1]*step);
    });
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0||!enabled())return;
      stop(event);handle.focus?.({preventScroll:true});const r=bounds();
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:r.left,top:r.top,position:position&&{...position},moved:false};
      handle.setPointerCapture?.(event.pointerId);
    });
    handle.addEventListener('pointermove',event=>{
      if(!drag||drag.id!==event.pointerId)return;stop(event);
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.moved ||= Math.hypot(dx,dy)>3;
      if(drag.moved){element.classList.add('ats-overlay-dragging');place(drag.left+dx,drag.top+dy);}
    });
    function finish(event,cancel=false) {
      if(!drag||drag.id!==event.pointerId)return;stop(event);const previous=drag;drag=null;
      element.classList.remove('ats-overlay-dragging');
      if(cancel&&previous.moved){if(previous.position)place(previous.position.x,previous.position.y);else resetPosition();}
      if(handle.hasPointerCapture?.(event.pointerId))handle.releasePointerCapture?.(event.pointerId);
    }
    handle.addEventListener('pointerup',event=>finish(event));handle.addEventListener('pointercancel',event=>finish(event,true));handle.addEventListener('lostpointercapture',event=>finish(event,true));
    window.addEventListener?.('resize',sync);desktop?.addEventListener?.('change',sync);
    window.visualViewport?.addEventListener?.('resize',sync);window.visualViewport?.addEventListener?.('scroll',sync);
    if(typeof ResizeObserver==='function')new ResizeObserver(sync).observe(element);
    const adapter={sync,reset:resetPosition};movableOverlays.set(element,adapter);return adapter;
  }
  let overlayWatchInstalled=false;
  function installOverlaySurfaces(root) {
    const doc=root.ownerDocument;
    function wire() {
      const rail=root.querySelector('.ats-tool-rail, #edge-actions');
      installMovableOverlay(rail,{label:'Scope tools',desktopOnly:true});
      for(const panel of doc.querySelectorAll('.ats-console-drawer'))installMovableOverlay(panel,{header:panel.querySelector('summary'),label:'Exercise panel',preserveHeight:true});
      const work=doc.getElementById('work-panel');installMovableOverlay(work,{header:work?.querySelector('.drawer-head'),label:'Exercise tools',preserveHeight:true});
      const popover=doc.querySelector('.ats-clock-popover');installMovableOverlay(popover,{label:'Clock settings'});
      const help=doc.getElementById('suite-guide-chat-panel');installMovableOverlay(help,{header:help?.querySelector('header'),label:'Gyani help'});
      const tour=doc.getElementById('suite-tour');installMovableOverlay(tour,{header:tour?.querySelector('h2'),label:'Guided tour'});
      const notice=doc.getElementById('exercise-notice');installMovableOverlay(notice,{label:'Exercise notice'});
      const boundary=doc.getElementById('boundary-scope-tools');installMovableOverlay(boundary,{label:'Boundary drawing controls'});
      for(const dialog of doc.querySelectorAll('dialog'))installMovableOverlay(dialog,{header:dialog.querySelector('h2'),label:'Confirmation'});
    }
    wire();
    if(!overlayWatchInstalled&&typeof MutationObserver==='function'){
      overlayWatchInstalled=true;new MutationObserver(wire).observe(doc.body,{childList:true,subtree:true});
    }
  }
  function installScopeRailAnchor(root,scope,shelf) {
    const parent=root.querySelector('.instructor-console, .scope-panel');
    if(!parent||!scope?.getBoundingClientRect)return;
    const desktop=window.matchMedia?.('(min-width: 701px)');
    const sync=()=>{
      // The phone's older collapse button has a different layout. Restore the
      // desktop edge tools when crossing that breakpoint.
      const body=root.ownerDocument.body;
      if(root.id==='desk'&&desktop?.matches&&body.classList.contains('instructor-desk')&&body.classList.contains('controls-collapsed')){
        body.classList.remove('controls-collapsed');
        const legacy=root.ownerDocument.getElementById('toggle-controls');
        if(legacy){legacy.setAttribute('aria-pressed','false');legacy.textContent='Hide controls';}
      }
      const bounds=scope.getBoundingClientRect(),container=parent.getBoundingClientRect();
      parent.style.setProperty('--ats-plot-top',`${Math.max(0,bounds.top-container.top)}px`);
      const instruments=shelf?.getBoundingClientRect();
      const reserve=desktop?.matches?container.bottom-bounds.bottom:instruments?.height>0?container.bottom-instruments.top:container.bottom-bounds.bottom;
      parent.style.setProperty('--ats-rail-bottom',`${Math.max(8,reserve+8)}px`);
    };
    if(typeof ResizeObserver==='function')new ResizeObserver(sync).observe(scope);
    if(typeof ResizeObserver==='function'&&shelf)new ResizeObserver(sync).observe(shelf);
    if(typeof MutationObserver==='function')for(const element of [root,root.ownerDocument.body])new MutationObserver(sync).observe(element,{attributes:true,attributeFilter:['class']});
    root.querySelector('#workspaceOptionsToggle, #workspace-options-toggle')?.addEventListener('click',()=>Promise.resolve().then(sync));
    window.addEventListener?.('resize',sync);sync();
  }
  function installScopeSelectors(root) {
    if(root.id!=='desk')return;
    const toolbar=root.querySelector('.scope-toolbar > div'),before=root.querySelector('#zoom-out');
    if(!toolbar)return;
    for(const id of ['ring-spacing','aircraft-labels']){
      const label=root.ownerDocument.getElementById(id)?.closest('label');
      if(label)toolbar.insertBefore(label,before);
    }
  }
  function installInstrumentToggle(root,shelf) {
    const rail=root.querySelector('.ats-core-tools, .ats-tool-rail');
    if(!rail||!shelf||rail.querySelector('.ats-instruments-toggle'))return;
    if(!shelf.id)shelf.id='instructorControlShelf';
    const button=root.ownerDocument.createElement('button');
    button.type='button';button.className='ats-tool-button ats-instruments-toggle';
    if(root.id==='desk')button.id='scope-controls-toggle';
    else button.id='scopeControlsToggle';
    if(root.id==='desk')button.setAttribute('data-instructor-tool','');
    button.textContent='Controls';button.title='Hide or restore aircraft controls, homing and calls';
    button.setAttribute('aria-controls',shelf.id);button.setAttribute('aria-expanded','true');
    button.addEventListener('click',()=>{
      const hidden=root.classList.toggle('ats-instruments-hidden');
      button.setAttribute('aria-expanded',String(!hidden));
    });
    rail.append(button);
  }
  const phoneScrollTracks=new WeakMap();
  function installPhoneScrollTrack(scroller,label,kind,root) {
    if(!scroller||phoneScrollTracks.has(scroller))return;
    const doc=scroller.ownerDocument,phone=window.matchMedia?.('(max-width: 700px)');
    if(!phone)return;
    const wrapper=doc.createElement('div');wrapper.className=`ats-scroll-wrap ats-scroll-wrap--${kind}`;
    const track=doc.createElement('input');track.type='range';track.className='ats-scroll-track ats-phone-scroll-track';
    track.min='0';track.max='0';track.step='1';track.value='0';track.hidden=true;
    track.setAttribute('aria-label',`Scroll ${label} horizontally`);
    if(scroller.id)track.setAttribute('aria-controls',scroller.id);
    scroller.before(wrapper);wrapper.append(scroller,track);
    function sync() {
      const maximum=Math.max(0,(scroller.scrollWidth||0)-(scroller.clientWidth||0));
      const position=Math.min(maximum,Math.max(0,scroller.scrollLeft||0));
      track.hidden=!phone.matches||maximum<=1||!(scroller.clientWidth>0);
      track.max=String(Math.ceil(maximum));track.value=String(Math.round(position));
      track.setAttribute('aria-valuetext',`${maximum?Math.round(position/maximum*100):0}% across ${label}`);
    }
    track.addEventListener('input',()=>{
      if(track.hidden||!phone.matches)return;
      scroller.scrollLeft=Math.max(0,Math.min(Number(track.max),Number(track.value)||0));sync();
    });
    scroller.addEventListener('scroll',sync,{passive:true});
    phone.addEventListener?.('change',sync);window.addEventListener?.('resize',sync);
    root.querySelector('#workspaceOptionsToggle, #workspace-options-toggle')?.addEventListener('click',sync);
    if(typeof ResizeObserver==='function')new ResizeObserver(sync).observe(scroller);
    // The control is a sibling, so its own value/ARIA/hidden updates cannot
    // retrigger this observer. Labels and replacement aircraft buttons can.
    if(typeof MutationObserver==='function')new MutationObserver(sync).observe(scroller,{childList:true,subtree:true});
    phoneScrollTracks.set(scroller,track);sync();
  }
  function installPhoneScrollTracks(root) {
    if(root.id==='activeWorkspace') {
      installPhoneScrollTrack(root.querySelector('.aircraft-tabs'),'aircraft list','aircraft',root);
      installPhoneScrollTrack(root.querySelector('.ats-tool-rail'),'scope tools','tools',root);
    } else if(root.id==='desk') {
      installPhoneScrollTrack(root.querySelector('.fleet'),'aircraft list','aircraft',root);
      installPhoneScrollTrack(root.querySelector('#edge-actions'),'scope tools','tools',root);
      installPhoneScrollTrack(root.querySelector('.scope-airspace-key'),'airspace legend','legend',root);
    }
  }
  function containPhoneDrawerFocus(event,drawer) {
    if(event.key!=='Tab'||!drawer||!window.matchMedia?.('(max-width: 700px)')?.matches)return;
    const doc=drawer.ownerDocument;
    // A modal owns its own focus loop. The underlying drawer is inert while
    // showModal is open, so trapping its Tab would block the confirmation.
    if(event.target?.closest?.('dialog[open]')||doc.activeElement?.closest?.('dialog[open]'))return;
    const nodes=[...drawer.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(el=>!el.closest('[hidden]')&&(!el.getClientRects||el.getClientRects().length));
    const first=nodes[0],last=nodes[nodes.length-1];
    if(first&&(!drawer.contains(doc.activeElement)||(event.shiftKey&&doc.activeElement===first)||(!event.shiftKey&&doc.activeElement===last))){event.preventDefault();(event.shiftKey?last:first).focus?.();}
  }
  function installInstructorConsole({root,scope,shelf,actions}) {
    if (root.dataset.atsLayout) return;
    root.dataset.atsLayout='instructor';
    const doc=root.ownerDocument, byId=id=>doc.getElementById(id);
    const make=(tag,text,className)=>{const el=doc.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;};
    scope?.setAttribute('tabindex','0');
    if (!doc.querySelector('.ats-skip')) {const skip=make('a','Skip to workspace','ats-skip');skip.href='#setupPanel';doc.body.prepend(skip);}
    const head=root.querySelector('.workspace-head');
    const elapsed=byId('instructorClock');
    if(elapsed){const label=make('span','Exercise time','ats-clock-label');elapsed.before(label);elapsed.title='Elapsed simulated exercise time, starting at 00:00:00';}
    const rate=byId('trainingTimeRate'),clockSummary=byId('clockSettings')?.querySelector('summary');
    if(rate&&clockSummary){
      const popover=make('div',null,'ats-clock-popover');
      byId('clockSettings').append(popover);popover.append(rate.closest('label'),byId('trainingRateStatus'));
      const syncRate=()=>{clockSummary.textContent=`Clock · ${Number(rate.value)||1}×`;};
      rate.addEventListener('change',syncRate);syncRate();
      if(typeof MutationObserver==='function'&&byId('trainingRateStatus'))new MutationObserver(syncRate).observe(byId('trainingRateStatus'),{childList:true,characterData:true,subtree:true});
    }
    const options=make('button','Options','ats-options-toggle');options.id='workspaceOptionsToggle';options.type='button';
    options.setAttribute('aria-expanded',String(!root.classList.contains('ats-focus-mode')));
    head?.append(options);if(actions)head?.append(actions);
    const advance=byId('advanceMinute');
    if(actions&&advance){
      const quickAdvance=make('button','+1 min');quickAdvance.id='quickAdvanceMinute';quickAdvance.type='button';quickAdvance.title='Advance one simulated minute using the existing aircraft controls';
      quickAdvance.addEventListener('click',()=>advance.click());actions.insertBefore(quickAdvance,byId('terminateExercise'));
      const syncAdvance=()=>{quickAdvance.disabled=advance.disabled;};syncAdvance();
      if(typeof MutationObserver==='function')new MutationObserver(syncAdvance).observe(advance,{attributes:true,attributeFilter:['disabled']});
    }
    const toolRail=make('nav',null,'ats-tool-rail');toolRail.id='instructorTools';toolRail.setAttribute('aria-label','Scope tools');
    root.querySelector('.instructor-console')?.append(toolRail);
    const drawers=['sessionDrawer','aircraftControlDrawer','eventDrawer','consoleNavigation'].map(byId).filter(Boolean);
    let active=null,returnFocus=null;
    const triggers=new Map();
    function update() {
      root.classList.toggle('ats-drawer-open',Boolean(active?.open));
      for(const [drawer,button] of triggers)button.setAttribute('aria-expanded',String(Boolean(drawer.open)));
      byId('moreAircraftControls')?.setAttribute('aria-expanded',String(Boolean(byId('aircraftControlDrawer')?.open)));
    }
    function close() {if(active)active.open=false;active=null;update();returnFocus?.focus?.({preventScroll:true});}
    function open(drawer,trigger=doc.activeElement) {
      returnFocus=trigger;for(const other of drawers)if(other!==drawer)other.open=false;
      drawer.open=true;active=drawer;update();drawer.querySelector('.ats-drawer-close')?.focus?.({preventScroll:true});
    }
    for(const drawer of drawers) {
      drawer.classList.add('ats-console-drawer');
      const summary=drawer.querySelector('summary');
      const closeButton=make('button','Close','ats-drawer-close');closeButton.type='button';closeButton.setAttribute('aria-label','Close panel');
      closeButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();close();});summary?.append(closeButton);
      drawer.addEventListener('toggle',()=>{if(!doc.body.classList.contains('exercise-console'))return;if(drawer.open&&active!==drawer)open(drawer);else if(active===drawer&&!drawer.open){active=null;update();}});
    }
    for(const [label,id] of [['Session','sessionDrawer'],['Aircraft controls','aircraftControlDrawer'],['Review','eventDrawer'],['Navigation & help','consoleNavigation']]) {
      const drawer=byId(id);if(!drawer)continue;
      const button=make('button',label,'ats-tool-button');button.type='button';button.setAttribute('aria-controls',id);button.setAttribute('aria-expanded','false');
      if(id==='sessionDrawer'){const pin=make('span','—');pin.id='toolSessionPin';button.append(pin);}
      button.addEventListener('click',()=>{if(active===drawer&&drawer.open)close();else open(drawer,button);});triggers.set(drawer,button);toolRail.append(button);
    }
    const scopeButton=make('button','Scope settings','ats-tool-button');scopeButton.type='button';scopeButton.setAttribute('aria-controls','scopeSettings');
    const updateScope=()=>scopeButton.setAttribute('aria-expanded',String(Boolean(byId('scopeSettings').open)));
    updateScope();byId('scopeSettings').addEventListener('toggle',updateScope);
    scopeButton.addEventListener('click',()=>{root.classList.remove('ats-focus-mode');byId('scopeSettings').open=!byId('scopeSettings').open;options.setAttribute('aria-expanded','true');updateScope();});toolRail.append(scopeButton);
    options.addEventListener('click',()=>{const expanded=root.classList.contains('ats-focus-mode');root.classList.toggle('ats-focus-mode',!expanded);byId('scopeSettings').open=expanded;options.setAttribute('aria-expanded',String(expanded));updateScope();});
    if(typeof MutationObserver==='function')new MutationObserver(()=>options.setAttribute('aria-expanded',String(!root.classList.contains('ats-focus-mode')))).observe(root,{attributes:true,attributeFilter:['class']});
    doc.addEventListener('keydown',event=>{
      if(event.target?.closest?.('dialog[open]')||doc.activeElement?.closest?.('dialog[open]'))return;
      if(!active?.open)return;
      if(event.key==='Escape'){event.preventDefault();close();return;}
      containPhoneDrawerFocus(event,active);
    });
    const review=byId('eventDrawer');
    if(review){const note=make('p','Pause to discuss the current picture. Terminate the exercise to open the full replay and debrief.','ats-review-help');review.querySelector('.event-card')?.prepend(note);}
    const transmit=byId('quickTransmit'),quickRow=shelf?.querySelector('.quick-turn-row');
    if(transmit&&quickRow)quickRow.insertBefore(transmit,byId('moreAircraftControls'));
    if(quickRow)quickRow.classList.add('ats-quick-turn-row');
    // Pin text is presentation only; session admission remains in its adapter.
    const compact=byId('compactPin');
    if(compact&&typeof MutationObserver==='function')new MutationObserver(()=>{byId('toolSessionPin').textContent=compact.textContent;}).observe(compact,{childList:true,characterData:true,subtree:true});
    for(const drawer of drawers)drawer.open=false;
    function syncStage(){
      const exercising=doc.body.classList.contains('exercise-console');
      if(!exercising){active=null;byId('consoleNavigation').open=true;}
      else if(byId('activeWorkspace').hidden){for(const drawer of drawers)drawer.open=false;active=null;}
      else if(active!==byId('consoleNavigation'))byId('consoleNavigation').open=false;
      const skip=doc.querySelector('.ats-skip');if(skip)skip.href=exercising?(byId('reviewScreen')?.hidden?'#activeWorkspace':'#reviewScreen'):'#setupPanel';
      update();
    }
    if(typeof MutationObserver==='function'){
      new MutationObserver(syncStage).observe(doc.body,{attributes:true,attributeFilter:['class']});
      if(byId('reviewScreen'))new MutationObserver(syncStage).observe(byId('reviewScreen'),{attributes:true,attributeFilter:['hidden']});
    }
    syncStage();
    update();
  }
  function installProceduralConsole(root) {
    root.dataset.atsLayout='instructor';
    const doc=root.ownerDocument,actions=doc.getElementById('clock-controls'),end=doc.getElementById('terminate-quick');
    if(actions&&end)actions.append(end);
    const review=actions?.querySelector('[data-tab="debrief"]');if(review)review.hidden=true;
    const title=doc.getElementById('exercise-title');if(title)title.title=title.textContent;
    const bar=root.querySelector('.exercisebar'),clock=bar?.querySelector('.clockblock'),options=doc.getElementById('workspace-options-toggle');
    const time=doc.getElementById('clock');
    if(time){const label=doc.createElement('span');label.className='ats-clock-label';label.textContent='Exercise time';time.before(label);time.title='Elapsed exercise time, starting at 00:00:00; advances while running and stops when paused';}
    if(clock&&options)bar.insertBefore(clock,options);
    const rail=doc.getElementById('edge-actions');
    if(rail&&!rail.querySelector('.ats-core-tools')){
      for(const group of rail.querySelectorAll('.edge-group'))group.classList.add('ats-optional-tools');
      const core=doc.createElement('div');core.className='edge-group ats-core-tools';
      for(const selector of ['[data-tab="session"]','#pilot-controls-open','[data-tab="debrief"]']){const button=rail.querySelector(selector);if(button)core.append(button);}
      rail.prepend(core);
    }
    doc.addEventListener('keydown',event=>{const drawer=doc.getElementById('work-panel');if(drawer&&!drawer.hidden)containPhoneDrawerFocus(event,drawer);});
  }
  function createFocusMode({root,panels=[],toggle,onChange=()=>{}}) {
    let phase='prepare',expanded=true;
    function setExpanded(value) {
      expanded=Boolean(value); root?.classList.toggle('ats-focus-mode',!expanded);
      for (const panel of panels) if (panel && (panel.tagName==='DETAILS' || 'open' in panel)) { panel.open=expanded; panel.toggleAttribute?.('open',expanded); }
      toggle?.setAttribute('aria-expanded',String(expanded));onChange(expanded);
    }
    return {setExpanded,enterRun(){setExpanded(false);},setPhase(next){if(next==='running' && phase!=='running' && phase!=='paused')setExpanded(false);phase=next;},isExpanded:()=>expanded};
  }
  const logoutBindings=new WeakMap();
  function bindLogout({root,onLogout,homeHref='../index.html'}) {
    const doc=root?.ownerDocument || document;
    if(typeof onLogout!=='function'||!doc?.createElement)return null;
    const existing=logoutBindings.get(doc);
    if(existing){existing.onLogout=onLogout;existing.homeHref=homeHref;return existing.button;}
    const slot=doc.createElement('div');slot.className='ats-logout-slot';
    const button=doc.createElement('button');button.type='button';button.id='workspaceLogout';button.className='ats-logout-button';button.textContent='Logout';
    const status=doc.createElement('p');status.className='ats-logout-status';status.hidden=true;status.setAttribute('role','alert');
    slot.append(button,status);doc.body.append(slot);doc.body.classList.add('ats-has-logout');
    const binding={button,onLogout,homeHref,busy:false};logoutBindings.set(doc,binding);
    button.addEventListener('click',async()=>{
      if(binding.busy)return;
      binding.busy=true;button.disabled=true;status.hidden=true;
      try{
        if(!await confirmAction('Log out and return to ATS suite Home? Current exercise progress will be lost.',{confirmLabel:'Log out',title:'Log out'}))return;
        await binding.onLogout();
        const location=globalThis.location || window.location,target=new URL(binding.homeHref,location.href).href;
        if(typeof location.assign==='function')location.assign(target);else location.href=target;
      }catch(error){status.textContent=`Unable to log out: ${error?.message || 'please try again.'}`;status.hidden=false;}
      finally{binding.busy=false;button.disabled=false;}
    });
    return button;
  }
  let pendingConfirmation=null;
  function confirmAction(message,{confirmLabel='Confirm',title:heading='Confirm exercise change'}={}) {
    // The HTML dialog stays in the exercise screen and does not block the
    // browser thread. Only the caller applies the confirmed state change.
    if(pendingConfirmation)return Promise.resolve(false);
    const prior=document.activeElement,dialog=document.createElement('dialog');
    dialog.className='ats-confirm-dialog';dialog.setAttribute('aria-label',heading);
    const title=document.createElement('h2');title.textContent=heading;
    const detail=document.createElement('p');detail.textContent=message;
    const row=document.createElement('div');row.className='ats-confirm-actions';
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.className='ats-confirm-cancel';
    const accept=document.createElement('button');accept.type='button';accept.textContent=confirmLabel;accept.className='ats-confirm-accept';
    row.append(cancel,accept);dialog.append(title,detail,row);document.body.append(dialog);
    return new Promise(resolve=>{
      pendingConfirmation=dialog;
      const finish=value=>{if(pendingConfirmation!==dialog)return;pendingConfirmation=null;dialog.close?.();dialog.remove();prior?.focus?.({preventScroll:true});resolve(value);};
      cancel.addEventListener('click',()=>finish(false));accept.addEventListener('click',()=>finish(true));
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
      dialog.addEventListener('close',()=>finish(false));
      installMovableOverlay(dialog,{header:title,label:'Confirmation'});
      if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
      cancel.focus?.({preventScroll:true});
    });
  }
  globalThis.ATCSuiteWorkspace=Object.freeze({enter,bindShell,bindLogout,createFocusMode,confirmAction});
})();
