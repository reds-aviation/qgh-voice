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
    let steps=[], index=0, target;
    const visible=el=>!!el && el.getClientRects().length>0 && !el.closest('[hidden]');
    const running=()=>document.body.classList.contains('exercise-running') || ['exerciseState','studentExerciseState'].some(id=>document.getElementById(id)?.textContent.trim()==='RUNNING') || visible(document.querySelector('#console.active, #tConsole.active'));
    function clearTarget(){target?.classList.remove('suite-tour-target');target=null;}
    function finish(restore=true){panel.hidden=true;clearTarget();if(restore && !running())button.focus();}
    function show(){
      clearTarget(); const step=steps[index]; target=document.querySelector(step.selector);
      target?.classList.add('suite-tour-target'); target?.scrollIntoView({block:'center',behavior:'auto'});
      title.textContent=step.title;description.textContent=step.text;progress.textContent=`${index+1} / ${steps.length} · ${globalThis.ATCGuideKnowledge.revision}`;
      back.disabled=index===0;next.textContent=index===steps.length-1?'Finish':'Next';
      // Keep the highlighted control outside the help panel on short screens.
      requestAnimationFrame(()=>{
        panel.classList.toggle('suite-tour-top',!!target && target.getBoundingClientRect().top>innerHeight/2);
      });
    }
    button.onclick=()=>{
      if(running())return;
      steps=(globalThis.ATCGuideKnowledge?.tours || []).filter(step=>step.pages.includes(page)&&visible(document.querySelector(step.selector)));
      if(!steps.length)return;index=0;panel.hidden=false;show();next.focus();
    };
    back.onclick=()=>{index=Math.max(0,index-1);show();};
    next.onclick=()=>{if(index===steps.length-1)finish();else{index++;show();}};
    close.onclick=()=>finish();document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();finish();}});
    function update(){
      const live=running();if(button.hidden!==live)button.hidden=live;button.disabled=live;
      if(live&&!panel.hidden)finish(false);
      const dock=document.querySelector(document.body.classList.contains('desk-open')?'#edge-actions .edge-group:last-child':'.topbar nav');
      if(page==='procedural'&&dock&&button.parentElement!==dock)dock.append(button);
    }
    new MutationObserver(update).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
    update();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
