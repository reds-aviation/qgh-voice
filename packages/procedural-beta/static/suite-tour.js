(function () {
  'use strict';
  const path = location.pathname;
  const page = /procedural-beta|procedural\.html/.test(path) ? 'procedural' : /instructor\.html/.test(path) ? 'instructor' : /student\.html/.test(path) ? 'student' : /single\.html/.test(path) ? 'single' : /tactical\.html/.test(path) ? 'tactical' : '';
  if (!page) return;
  const mount = () => {
    if (document.getElementById('suite-tour-open')) return;
    const make = (tag, text, id) => { const el=document.createElement(tag); if(text) el.textContent=text; if(id) el.id=id; return el; };
    const button=make('button','Guided tour','suite-tour-open'); button.type='button'; button.setAttribute('aria-haspopup','dialog');
    const rail=document.querySelector('#edge-actions .edge-group:last-child, .header-left, .topbar nav, .mode-links, .tactical-header-links, header');
    (rail || document.body).append(button);
    const panel=make('section',null,'suite-tour'); panel.hidden=true; panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','false'); panel.setAttribute('aria-labelledby','suite-tour-title');
    const progress=make('small'), title=make('h2',null,'suite-tour-title'), description=make('p'), actions=make('div');
    const back=make('button','Back'), next=make('button','Next'), close=make('button','Close tour');
    for(const b of [back,next,close]) b.type='button';
    actions.append(back,next,close); panel.append(progress,title,description,actions); document.body.append(panel);
    const startHint=make('aside',null,'suite-start-hint');startHint.hidden=true;startHint.setAttribute('role','status');
    const hintText=make('span'),hintClose=make('button','Got it');hintClose.type='button';hintClose.setAttribute('aria-label','Dismiss aircraft mouse controls');startHint.append(hintText,hintClose);document.body.append(startHint);
    let hasRun=false,exerciseStarted=false,hintTimer=0;
    const hintKey=`atc-mouse-hint-${page}-${globalThis.ATCGuideKnowledge?.revision}`;
    const dismissHint=()=>{startHint.hidden=true;clearTimeout(hintTimer);};hintClose.onclick=dismissHint;
    function showStartHint(){
      if(!['procedural','instructor'].includes(page)||sessionStorage.getItem(hintKey))return;
      if(page==='procedural'&&document.getElementById('student-login-state')?.textContent)return;
      const shelf=document.querySelector('#aircraft-quick-controls, .quick-aircraft-controls');
      if(!shelf||!visible(shelf))return;
      sessionStorage.setItem(hintKey,'1');
      shelf.append(startHint);hintText.textContent=globalThis.ATCGuideKnowledge?.startHint?.text||'';startHint.hidden=false;
      hintTimer=setTimeout(dismissHint,12000);
    }
    let steps=[], index=0, target, firstUseHandled=false, tourMode='full';
    const firstUseKey=`atc-first-tour-${page}-${globalThis.ATCGuideKnowledge?.revision}`;
    const visible=el=>!!el && el.getClientRects().length>0 && !el.closest('[hidden]');
    // Status text remains authoritative when compact layouts hide its label.
    // An initial RUNNING label inside a hidden student workspace is not live.
    const phase=id=>{const el=document.getElementById(id);return el&&!el.closest('[hidden]')?el.textContent.trim().toUpperCase():'';};
    const running=()=>document.body.classList.contains('exercise-running') || ['exerciseState','studentExerciseState'].some(id=>phase(id)==='RUNNING') || visible(document.querySelector('#console.active, #tConsole.active'));
    const alreadyStarted=()=>['exerciseState','studentExerciseState'].some(id=>/^(?:PAUSED|ENDED|TERMINATED|REVIEW|PICTURE FROZEN)/.test(phase(id)))
      || visible(document.getElementById('studentEnded')) || phase('clock-state')==='ENDED'
      || (phase('clock-state')==='PAUSED' && !!document.getElementById('clock')?.textContent && document.getElementById('clock').textContent.trim()!=='10:00:00');
    const workspaceReady=()=>page==='procedural'?visible(document.getElementById('desk')):page==='instructor'?visible(document.getElementById('activeWorkspace')):page==='student'?visible(document.getElementById('readyPanel')):page==='single'?visible(document.querySelector('#setup.active')):visible(document.querySelector('#tSetup.active'));
    const rememberFirstUse=()=>{firstUseHandled=true;try{localStorage.setItem(firstUseKey,'1');}catch{}};
    function clearTarget(){target?.classList.remove('suite-tour-target');target=null;}
    function finish(restore=true){panel.hidden=true;clearTarget();if(restore && !running())button.focus();}
    function show(){
      clearTarget(); const step=steps[index]; target=document.querySelector(step.selector);
      target?.classList.add('suite-tour-target'); target?.scrollIntoView({block:'center',behavior:'auto'});
      title.textContent=step.title;description.textContent=step.text;progress.textContent=`${tourMode==='first'?'Quick introduction · ':''}${index+1} / ${steps.length} · ${globalThis.ATCGuideKnowledge.revision}`;
      back.disabled=index===0;next.textContent=index===steps.length-1?'Finish':'Next';
      // Keep the highlighted control outside the help panel on short screens.
      requestAnimationFrame(()=>{
        panel.classList.toggle('suite-tour-top',!!target && target.getBoundingClientRect().top>innerHeight/2);
      });
    }
    function openTour(mode='full'){
      if(running())return;
      const source=mode==='first'?globalThis.ATCGuideKnowledge?.firstUse:globalThis.ATCGuideKnowledge?.tours;
      steps=(source || []).filter(step=>step.pages.includes(page)&&visible(document.querySelector(step.selector)));
      if(!steps.length)return;rememberFirstUse();tourMode=mode;index=0;close.textContent=mode==='first'?'Skip tour':'Close tour';panel.hidden=false;show();next.focus();
    }
    button.onclick=()=>openTour();
    back.onclick=()=>{index=Math.max(0,index-1);show();};
    next.onclick=()=>{if(index===steps.length-1)finish();else{index++;show();}};
    close.onclick=()=>finish();document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();finish();}});
    // Close before the exercise start handler runs. The tour never changes the clock.
    document.addEventListener('click',event=>{if(event.target.closest?.('#resume,#startExercise,#tStart,#studentReady,#student-ready')){rememberFirstUse();if(!panel.hidden)finish(false);}},true);
    function update(){
      const live=running();if(live&&!hasRun)showStartHint();hasRun=live;
      // Automatic onboarding is finished once traffic has run. A later Pause,
      // reconnect, or delayed workspace reveal must never reopen it.
      if(live||alreadyStarted()){exerciseStarted=true;if(!firstUseHandled)rememberFirstUse();}
      if(!live&&!startHint.hidden)dismissHint();
      if(button.hidden!==live)button.hidden=live;button.disabled=live;
      if(live&&!panel.hidden)finish(false);
      if(!live&&!exerciseStarted&&!firstUseHandled&&workspaceReady()){
        try{firstUseHandled=localStorage.getItem(firstUseKey)==='1';}catch{}
        if(!firstUseHandled)openTour('first');
      }
      const dock=document.querySelector(document.body.classList.contains('desk-open')?'#edge-actions .edge-group:last-child':'.topbar nav');
      if(page==='procedural'&&dock&&button.parentElement!==dock)dock.append(button);
    }
    new MutationObserver(update).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden']});
    update();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
