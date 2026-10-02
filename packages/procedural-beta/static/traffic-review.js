// Review uses instructor samples only. It never publishes truth to a live controller.
export function sampleTraffic(view) {
  return {t:view.elapsed, aircraft:(view.aircraft || []).filter(a=>a.status !== 'scheduled').map(a=>({id:a.id,callsign:a.callsign,x:a.xNm,y:a.yNm,z:a.altitudeFt,heading:a.headingDeg})), alerts:(view.alerts || []).map(a=>({text:a.text,ids:a.aircraftIds || [],kind:a.kind}))};
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
  let exercise='',frames=[],active=false,playing=false,time=0,last=0,mode='top',timer=0;
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
  const readout=el('output','00:00');toolbar.append(play,viewLabel,rateLabel,scrub,readout);
  const canvas=el('canvas');canvas.className='traffic-review-canvas';canvas.setAttribute('aria-label','Instructor traffic replay with altitude and configured separation cues');
  const note=el('p','Recorded instructor traffic. Red cues use the configured exercise objectives; they do not certify every Doc 4444 separation rule.');note.className='hint';
  const cues=el('div');cues.className='review-cues';cues.setAttribute('role','status');
  const download=el('button','Download replay');download.type='button';
  container.append(toolbar,canvas,cues,note,download);
  function persist(){try{sessionStorage.setItem('ats-procedural-replay',JSON.stringify({exercise,frames}));}catch{ /* Quota failure leaves the in-memory replay available. */ }}
  function draw(){
    const f=interpolateTraffic(frames,time),width=canvas.clientWidth || 700,height=canvas.clientHeight || 400,dpr=Math.min(devicePixelRatio || 1,2);
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
    const warningIDs=new Set(f.alerts.flatMap(a=>a.ids));
    for(const a of f.aircraft){
      const color=warningIDs.has(a.id)?'#ff7d7d':'#82e5ed';
      ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();
      let started=false;for(const old of frames){if(old.t>time)break;const v=old.aircraft.find(v=>v.id===a.id);if(!v)continue;const p=project(v);started?ctx.lineTo(...p):ctx.moveTo(...p);started=true;}ctx.stroke();
      const [x,y]=project(a);ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();
      const label=`${a.callsign} · ${Math.round(a.z)} ft`;ctx.fillText(label,Math.max(4,Math.min(x+8,width-ctx.measureText(label).width-4)),Math.max(34,Math.min(y-8,height-12)));
      if(mode==='3d'){ctx.save();ctx.setLineDash([3,4]);ctx.strokeStyle='#4b6472';const [gx,gy]=project({...a,z:0});ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(gx,gy);ctx.stroke();ctx.restore();}
    }
    cues.replaceChildren(...(f.alerts.length?f.alerts.map(a=>el('p',a.text)):[el('p','No configured separation cue at this sample.')]));
    cues.classList.toggle('has-cue',f.alerts.length>0);scrub.value=String(time);readout.textContent=`${Math.floor(time/60).toString().padStart(2,'0')}:${Math.floor(time%60).toString().padStart(2,'0')}`;
  }
  function loop(stamp){if(!active || !playing)return;time=Math.min(frames.at(-1)?.t || 0,time+Math.min(1,(stamp-last)/1000)*Number(rate.value));last=stamp;draw();if(time>=(frames.at(-1)?.t || 0)){playing=false;play.textContent='▶ Play';}else timer=requestAnimationFrame(loop);}
  play.onclick=()=>{if(!frames.length)return;playing=!playing;play.textContent=playing?'Ⅱ Pause':'▶ Play';if(playing){if(time>=frames.at(-1).t)time=frames[0].t;last=performance.now();timer=requestAnimationFrame(loop);}};
  scrub.oninput=()=>{time=Number(scrub.value);playing=false;play.textContent='▶ Play';cancelAnimationFrame(timer);draw();};
  views.onchange=()=>{mode=views.value;draw();};
  download.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,exercise,frames})],{type:'application/json'}));const a=el('a');a.href=url;a.download='ATS-SIMBOX-traffic-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const resize=new ResizeObserver(()=>{if(active)draw();});resize.observe(container);
  return {
    record(v){
      if(!v?.exerciseId || !v.aircraft)return;
      if(exercise!==v.exerciseId){exercise=v.exerciseId;frames=[];try{const saved=JSON.parse(sessionStorage.getItem('ats-procedural-replay'));if(saved?.exercise===exercise && Array.isArray(saved.frames))frames=saved.frames;}catch{}}
      let previous=frames.at(-1);
      if(previous && v.elapsed<previous.t){frames=[];previous=null;}
      const sample=sampleTraffic(v);
      const cuesChanged=previous && JSON.stringify(sample.alerts)!==JSON.stringify(previous.alerts);
      const preparationChanged=previous && !v.running && JSON.stringify(sample.aircraft)!==JSON.stringify(previous.aircraft);
      if(!previous || v.elapsed-previous.t>=4 || cuesChanged || preparationChanged || v.terminated && v.elapsed!==previous.t){
        if(previous && v.elapsed===previous.t) frames[frames.length-1]=sample;
        else frames.push(sample);
        if(frames.length>1800)frames.shift();persist();
        if(active){scrub.min=String(frames[0]?.t || 0);scrub.max=String(frames.at(-1)?.t || 0);draw();}
      }
    },
    open(v){active=true;this.record(v);time=frames[0]?.t || 0;scrub.min=String(time);scrub.max=String(frames.at(-1)?.t || time);draw();},
    close(){active=false;playing=false;play.textContent='▶ Play';cancelAnimationFrame(timer);},
    clear(){this.close();frames=[];exercise='';time=0;}
  };
}
