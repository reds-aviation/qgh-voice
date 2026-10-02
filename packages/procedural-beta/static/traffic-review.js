// Review uses instructor samples only. It never publishes truth to a live controller.
export function sampleTraffic(view) {
  return {t:view.elapsed, aircraft:(view.aircraft || []).filter(a=>a.status !== 'scheduled').map(a=>({id:a.id,callsign:a.callsign,x:a.xNm,y:a.yNm,z:a.altitudeFt,heading:a.headingDeg})), alerts:(view.alerts || []).map(a=>{
    const rule=(view.criteria || []).find(c=>c.id===a.criterionId);
    return {id:a.id,text:a.text,ids:a.aircraftIds || [],kind:a.kind,measured:a.measured,threshold:a.threshold,unit:a.unit,criterionId:a.criterionId,
      ...(rule?{basis:{reference:rule.reference,applicability:rule.applicability,evidence:rule.evidence,assessment:rule.assessment}}:{})};
  })};
}
export function reviewCueSeverity(cue) {
  if(['criterion-below-threshold','geometric-proximity','runway-occupancy'].includes(cue.kind))return 'warning';
  return cue.kind==='criterion-measurement'?'measurement':'assessment';
}
function cueTransitions(cues) { return JSON.stringify(cues.map(({id,ids,kind,threshold,unit,criterionId,basis})=>({id,ids,kind,threshold,unit,criterionId,basis}))); }
export function recordedCueDuration(frames,cue,time) {
  const matches=other=>cueTransitions([other])===cueTransitions([cue]);
  let index=frames.findLastIndex(f=>f.t<=time);
  if(index<0 || !frames[index].alerts.some(matches))return null;
  let first=index;while(first>0 && frames[first-1].alerts.some(matches))first--;
  let after=index+1;while(after<frames.length && frames[after].alerts.some(matches))after++;
  const start=frames[first].t,end=after<frames.length?frames[after].t:frames.at(-1).t;
  return {start,end,duration:Math.max(0,end-start),complete:after<frames.length};
}
export function recordedReviewEvents(events, next, start=0) {
  const merged=new Map(events.map(e=>[e.id,e]));
  for(const e of next || []) if(e.id && Number.isFinite(e.elapsed) && e.elapsed>=start) merged.set(e.id,{id:e.id,t:e.elapsed,kind:e.kind,text:e.text,aircraftId:e.aircraftId});
  return [...merged.values()].filter(e=>e.t>=start).sort((a,b)=>a.t-b.t).slice(-2000);
}
export function interpolateTraffic(frames, time) {
  if (!frames.length) return null;
  let index = frames.findIndex(f=>f.t > time);
  if (index < 0) return frames.at(-1);
  if (!index) return frames[0];
  const a=frames[index-1],b=frames[index],fraction=Math.max(0,Math.min(1,(time-a.t)/(b.t-a.t || 1)));
  return {...a,t:time,aircraft:a.aircraft.map(v=>{const next=b.aircraft.find(n=>n.id===v.id);return next?{...v,x:v.x+(next.x-v.x)*fraction,y:v.y+(next.y-v.y)*fraction,z:v.z+(next.z-v.z)*fraction}:v;})};
}
export function createTrafficReview(container) {
  let exercise='',frames=[],events=[],active=false,playing=false,time=0,last=0,mode='top',timer=0,selected='',selectionSignature='',timelineSignature='';
  const el=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
  const toolbar=el('div');toolbar.className='traffic-review-toolbar';
  const play=el('button','▶ Play');play.type='button';
  const viewLabel=el('label','View'),views=el('select');views.setAttribute('aria-label','Traffic replay view');
  for(const [id,name] of [['top','Top'],['side','Side · altitude'],['3d','3D schematic']]){const option=el('option',name);option.value=id;views.append(option);}
  viewLabel.append(views);
  const rateLabel=el('label','Replay'),rate=el('select');rate.setAttribute('aria-label','Replay speed');
  for(const n of [1,2,5,10]){const o=el('option',`${n}×`);o.value=String(n);rate.append(o);}
  rateLabel.append(rate);
  const scrub=el('input');scrub.type='range';scrub.min='0';scrub.step='.2';scrub.setAttribute('aria-label','Traffic replay time');
  const aircraftLabel=el('label','Aircraft'),aircraftSelect=el('select');aircraftSelect.setAttribute('aria-label','Replay aircraft');aircraftLabel.append(aircraftSelect);
  const readout=el('output','00:00');toolbar.append(play,viewLabel,aircraftLabel,rateLabel,scrub,readout);
  const markers=el('div');markers.className='traffic-review-markers';markers.setAttribute('aria-label','Recorded command and event timeline');
  const eventDetails=el('details'),eventSummary=el('summary','Commands & events'),eventList=el('div');eventList.className='traffic-review-events';eventDetails.append(eventSummary,eventList);
  const canvas=el('canvas');canvas.className='traffic-review-canvas';canvas.setAttribute('aria-label','Instructor traffic replay with altitude and configured separation cues');
  const note=el('p','Recorded instructor traffic. Red cues use the configured exercise objectives; they do not certify every Doc 4444 separation rule.');note.className='hint';
  const cues=el('div');cues.className='review-cues';cues.setAttribute('role','status');
  const download=el('button','Download replay');download.type='button';
  container.append(toolbar,markers,canvas,cues,eventDetails,note,download);
  function persist(){try{sessionStorage.setItem('ats-procedural-replay',JSON.stringify({exercise,frames,events}));}catch{ /* Quota failure leaves the in-memory replay available. */ }}
  function seek(t){time=Math.max(frames[0]?.t || 0,Math.min(frames.at(-1)?.t || 0,t));playing=false;play.textContent='▶ Play';cancelAnimationFrame(timer);draw();}
  const clock=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
  function renderTimeline(){
    const targets=[...new Map(frames.flatMap(f=>f.aircraft).map(a=>[a.id,a.callsign])).entries()];
    const signature=JSON.stringify(targets);
    if(signature!==selectionSignature){selectionSignature=signature;aircraftSelect.replaceChildren(...[['','All aircraft'],...targets].map(([id,name])=>{const o=el('option',name);o.value=id;return o;}));if(!targets.some(([id])=>id===selected))selected='';aircraftSelect.value=selected;}
    const visible=events.filter(e=>!selected || !e.aircraftId || e.aircraftId===selected).slice(-100);
    const start=frames[0]?.t || 0,end=frames.at(-1)?.t || 1;
    const timelineKey=JSON.stringify([selected,start,end,visible]);
    if(timelineSignature===timelineKey)return;
    timelineSignature=timelineKey;
    markers.replaceChildren(...visible.map(e=>{const b=el('button','•');b.type='button';b.style.left=`${Math.max(0,Math.min(100,(e.t-start)/(end-start || 1)*100))}%`;b.title=`${clock(e.t)} · ${e.kind} · ${e.text}`;b.setAttribute('aria-label',b.title);b.onclick=()=>seek(e.t);return b;}));
    eventList.replaceChildren(...visible.map(e=>{const b=el('button',`${clock(e.t)} · ${e.kind} · ${e.text}`);b.type='button';b.onclick=()=>seek(e.t);return b;}));
    if(!visible.length)eventList.append(el('p','No recorded commands or events for this selection.'));
  }
  function draw(){
    const f=interpolateTraffic(frames,time),width=canvas.clientWidth || 700,height=canvas.clientHeight || 400,dpr=Math.min(devicePixelRatio || 1,2);
    renderTimeline();
    if(canvas.width!==width*dpr || canvas.height!==height*dpr){canvas.width=width*dpr;canvas.height=height*dpr;}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#10181e';ctx.fillRect(0,0,width,height);
    if(!f){ctx.fillStyle='#b6cbd5';ctx.font='14px Plex,"IBM Plex Sans",Arial,sans-serif';ctx.fillText('Traffic is recorded when the exercise starts.',18,30);return;}
    const all=frames.flatMap(v=>v.aircraft),xs=all.map(v=>v.x),ys=all.map(v=>v.y),zs=all.map(v=>v.z);
    const minX=Math.min(...xs,0),maxX=Math.max(...xs,1),minY=Math.min(...ys,0),maxY=Math.max(...ys,1),maxZ=Math.max(...zs,1000);
    const dx=Math.max(5,maxX-minX),dy=Math.max(5,maxY-minY),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    const scale=Math.min((width-110)/dx,(height-90)/dy);
    const project=v=>mode==='side'?[55+(v.x-minX)/dx*(width-90),height-45-v.z/maxZ*(height-85)]:mode==='3d'?[width/2+((v.x-cx)-(v.y-cy)*.55)*scale*.62,height*.65-((v.x-cx)*.2+(v.y-cy)*.35)*scale*.62-v.z/maxZ*height*.36]:[width/2+(v.x-cx)*scale,height/2-(v.y-cy)*scale];
    ctx.font='12px Plex,"IBM Plex Sans",Arial,sans-serif';ctx.strokeStyle='#30444e';ctx.fillStyle='#9db3bf';ctx.lineWidth=1;
    for(let i=0;i<=4;i++) {const y=height-45-i*(height-85)/4;ctx.beginPath();ctx.moveTo(45,y);ctx.lineTo(width-20,y);ctx.stroke();if(mode!=='top')ctx.fillText(`${Math.round(maxZ*i/4)} ft`,4,y-4);}
    ctx.fillText(mode==='top'?'NORTH ↑ · NM':mode==='side'?'EAST–WEST NM · ALTITUDE FT':'3D SCHEMATIC · ALTITUDE EXAGGERATED',18,20);
    const warningIDs=new Set(f.alerts.filter(a=>reviewCueSeverity(a)==='warning').flatMap(a=>a.ids));
    for(const a of f.aircraft){
      const color=warningIDs.has(a.id)?'#ff7d7d':selected && selected!==a.id?'#617c88':'#82e5ed';
      ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();
      let started=false;for(const old of frames){if(old.t>time)break;const v=old.aircraft.find(v=>v.id===a.id);if(!v)continue;const p=project(v);started?ctx.lineTo(...p):ctx.moveTo(...p);started=true;}ctx.stroke();
      const [x,y]=project(a);ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,a.id===selected?7:5,0,Math.PI*2);ctx.fill();
      const label=`${a.callsign} · ${Math.round(a.z)} ft`;ctx.fillText(label,Math.max(4,Math.min(x+8,width-ctx.measureText(label).width-4)),Math.max(34,Math.min(y-8,height-12)));
      if(mode==='3d'){ctx.save();ctx.setLineDash([3,4]);ctx.strokeStyle='#4b6472';const [gx,gy]=project({...a,z:0});ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(gx,gy);ctx.stroke();ctx.restore();}
    }
    const shownCues=f.alerts.filter(a=>!selected || a.ids.includes(selected));
    cues.replaceChildren(...(shownCues.length?shownCues.map(a=>{
      const section=el('section');section.className=`review-cue-${reviewCueSeverity(a)}`;section.append(el('p',a.text));
      if(Number.isFinite(a.measured) && Number.isFinite(a.threshold))section.append(el('p',`Measured ${Number(a.measured.toFixed(2))} ${a.unit || ''} · configured threshold ${a.threshold} ${a.unit || ''}`));
      const span=recordedCueDuration(frames,a,time);
      if(span)section.append(el('small',`Recorded cue ${clock(span.start)}–${clock(span.end)} · ${Number(span.duration.toFixed(1))} sec${span.complete?'':' observed so far'}. Timing follows recorded samples.`));
      if(a.basis)section.append(el('small',`Source: ${a.basis.reference || 'Instructor reference not supplied'} · ${a.basis.applicability || 'Check applicability'} · ${a.basis.evidence || 'Supporting evidence not supplied'} · ${a.basis.assessment || 'Instructor assessment required'}`));
      return section;
    }):[el('p','No configured separation cue at this sample.')]));
    cues.classList.toggle('has-cue',shownCues.some(a=>reviewCueSeverity(a)==='warning'));scrub.value=String(time);readout.textContent=clock(time);
  }
  function loop(stamp){if(!active || !playing)return;time=Math.min(frames.at(-1)?.t || 0,time+Math.min(1,(stamp-last)/1000)*Number(rate.value));last=stamp;draw();if(time>=(frames.at(-1)?.t || 0)){playing=false;play.textContent='▶ Play';}else timer=requestAnimationFrame(loop);}
  play.onclick=()=>{if(!frames.length)return;cancelAnimationFrame(timer);playing=!playing;play.textContent=playing?'Ⅱ Pause':'▶ Play';if(playing){if(time>=frames.at(-1).t)time=frames[0].t;last=performance.now();timer=requestAnimationFrame(loop);}};
  scrub.oninput=()=>seek(Number(scrub.value));
  views.onchange=()=>{mode=views.value;draw();};
  aircraftSelect.onchange=()=>{selected=aircraftSelect.value;draw();};
  download.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:2,exercise,frames,events})],{type:'application/json'}));const a=el('a');a.href=url;a.download='ATS-SIMBOX-traffic-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const resize=new ResizeObserver(()=>{if(active)draw();});resize.observe(container);
  return {
    record(v){
      if(!v?.exerciseId || !v.aircraft)return;
      if(exercise!==v.exerciseId){playing=false;play.textContent='▶ Play';cancelAnimationFrame(timer);exercise=v.exerciseId;frames=[];events=[];selectionSignature='';timelineSignature='';selected='';try{const saved=JSON.parse(sessionStorage.getItem('ats-procedural-replay'));if(saved?.exercise===exercise && Array.isArray(saved.frames)){frames=saved.frames;events=Array.isArray(saved.events)?saved.events:[];}}catch{}}
      let previous=frames.at(-1);
      if(previous && v.elapsed<previous.t){playing=false;play.textContent='▶ Play';cancelAnimationFrame(timer);frames=[];events=[];previous=null;}
      const oldEvents=JSON.stringify(events);events=recordedReviewEvents(events,v.events,frames[0]?.t || 0);
      const sample=sampleTraffic(v);
      const cuesChanged=previous && cueTransitions(sample.alerts)!==cueTransitions(previous.alerts);
      const preparationChanged=previous && !v.running && JSON.stringify(sample.aircraft)!==JSON.stringify(previous.aircraft);
      if(!previous || v.elapsed-previous.t>=4 || cuesChanged || preparationChanged || v.terminated && v.elapsed!==previous.t || oldEvents!==JSON.stringify(events)){
        if(previous && v.elapsed===previous.t) frames[frames.length-1]=sample;
        else frames.push(sample);
        if(frames.length>1800)frames.shift();persist();
        if(active){time=Math.max(frames[0]?.t || 0,Math.min(frames.at(-1)?.t || 0,time));scrub.min=String(frames[0]?.t || 0);scrub.max=String(frames.at(-1)?.t || 0);draw();}
      }
    },
    open(v){active=true;this.record(v);time=frames[0]?.t || 0;scrub.min=String(time);scrub.max=String(frames.at(-1)?.t || time);draw();},
    close(){active=false;playing=false;play.textContent='▶ Play';cancelAnimationFrame(timer);},
    clear(){this.close();frames=[];events=[];exercise='';time=0;selected='';selectionSignature='';timelineSignature='';}
  };
}
