/* ATS SIM BOX · Copyright 2026 Balaram Reddy. CPAL-1.0. */
(() => {
  'use strict';
  const surfaces = {
    qgh: ['.entry-intro', 'homing'], single: ['#singleSetupFields .setup-intro', 'homing'],
    tactical: ['#tSetup .tactical-setup-intro', 'formation'],
    instructor: ['#entry .entry-copy', 'radar'], 'host-setup': ['#setupPanel > .section-title', 'radar'],
    join: ['#joinPanel .entry-copy', 'radar'], procedural: ['#entry .entry-copy', 'routes']
  };
  const config = surfaces[document.body.dataset.suiteSurface];
  const hero = config && document.querySelector(config[0]);
  if (!hero) return;
  const mode = config[1];
  const canvas = document.createElement('canvas');
  canvas.className = 'exercise-motion-art';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  hero.append(canvas);
  hero.classList.add('exercise-motion-host');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let ink, quiet, blue, sky, signal, green, grid, ring;
  function readPalette() {
    const theme = getComputedStyle(hero);
    const tone = name => theme.getPropertyValue('--iaf-' + name).trim();
    ink = tone('ink'); quiet = tone('header-edge'); blue = tone('blue-dark');
    sky = tone('sky'); signal = tone('saffron'); green = tone('green');
    const dark = document.documentElement.dataset.theme === 'dark';
    grid = dark ? 'rgba(143,193,220,.16)' : 'rgba(55,99,126,.10)';
    ring = dark ? 'rgba(143,193,220,.62)' : 'rgba(55,99,126,.53)';
  }
  readPalette();
  const duration = 4600;
  let frame = 0, last = -1, elapsed = 0, width = 0, height = 0, visible = false;
  function line(points, color, pen = 1, dash = []) {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = pen; ctx.setLineDash(dash);
    points.forEach(([x,y], i) => { if (i) ctx.lineTo(x,y); else ctx.moveTo(x,y); });
    ctx.stroke(); ctx.setLineDash([]);
  }
  function circle(x,y,r,color,fill=false) {
    ctx.beginPath(); ctx.arc(x,y,r,0,2*Math.PI); ctx.lineWidth=1;
    if (fill) { ctx.fillStyle=color; ctx.fill(); } else { ctx.strokeStyle=color; ctx.stroke(); }
  }
  function label(x,y,words,color=ink) {
    ctx.font='600 9px "Consolas", monospace'; ctx.lineJoin='round';
    ctx.strokeStyle=sky; ctx.lineWidth=2.6; ctx.strokeText(words,x,y);
    ctx.fillStyle=color; ctx.fillText(words,x,y);
  }
  // Upright nose, swept wing, tailplane and a small contrasting canopy.
  function jet(x,y,angle,color,scale=1) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.scale(scale,scale);
    const outline=[[0,-11],[1.6,-8],[2,-2],[10,4],[10,5],[2.2,3],[1.4,7],[4.5,10],[4,11],[0,9],[-4,11],[-4.5,10],[-1.4,7],[-2.2,3],[-10,5],[-10,4],[-2,-2],[-1.6,-8]];
    ctx.beginPath(); outline.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b)); ctx.closePath();
    ctx.strokeStyle=sky; ctx.lineWidth=1.8; ctx.stroke(); ctx.fillStyle=color; ctx.fill(); ctx.fillStyle=sky; ctx.fillRect(-.65,-5,1.3,4);
    if (mode==='formation') {
      circle(5,3.35,1.35,signal,true);circle(5,3.35,.88,'#fff',true);circle(5,3.35,.48,green,true);
    }
    ctx.restore();
  }
  function fix(x,y,name) { line([[x,y-4],[x+4,y+3],[x-4,y+3],[x,y-4]],blue,1.2); label(x+7,y+13,name); }
  function target(x,y) { circle(x,y,4,ink); circle(x,y,2,signal,true); }
  function paint(t) {
    if (!width || !height) return;
    const scale=Math.min(width/314,height/145);
    ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0); ctx.clearRect(0,0,width,height);
    ctx.translate(width/2,height/2);ctx.scale(scale,scale);ctx.translate(-157,-72.5);
    for(let x=0;x<315;x+=24)line([[x,0],[x,145]],grid);
    for(let y=0;y<146;y+=24)line([[0,y],[314,y]],grid);
    if (mode==='routes') {
      const west=[22,112], cross=[157,66], east=[293,31], north=[106,12], south=[224,132];
      line([west,cross,east],blue,1.6); line([north,cross,south],quiet,1.3,[4,3]);
      fix(...west,''); fix(...cross,'FIX'); fix(...east,''); fix(...north,''); fix(...south,'');
      const x=39+83*t,y=112-(x-22)*46/135;
      jet(x,y,1.24,ink,.83); label(x+9,y+14,'101',ink);
      const p=.07+t*.53; jet(106+51*p,12+54*p,2.39,ink,.72);
      label(188,39,'A1'); label(223,111,'B2',quiet);
    } else if (mode==='radar') {
      const cx=158,cy=77;
      [21,42,63].forEach(r=>circle(cx,cy,r,ring));
      line([[cx-77,cy],[cx+77,cy]],quiet,.65);line([[cx,cy-70],[cx,cy+66]],quiet,.65);
      const a=-Math.PI*.8+t*Math.PI*1.7;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,63,a-.44,a);ctx.closePath();ctx.fillStyle='rgba(100,180,230,.30)';ctx.fill();
      line([[cx,cy],[cx+63*Math.cos(a),cy+63*Math.sin(a)]],blue,1.4);
      target(cx-30+t*11,cy-36+t*6); label(cx-65,cy-43,'101');
      target(cx+37-t*8,cy+17-t*9); label(cx+47,cy+20,'102');
      line([[201,35],[123,111]],quiet,.9,[3,4]);line([[cx-6,cy+6],[cx+6,cy-6]],ink,3);
    } else {
      const sx=72,sy=101, x=252-76*t,y=29+30*t;
      [19,38,57].forEach(r=>circle(sx,sy,r,ring));
      line([[sx,sy],[x,y]],quiet,1,[4,3]);line([[sx-16,sy+6],[sx+15,sy-7]],ink,3);
      circle(sx,sy,6,blue); label(sx-9,sy+19,'D/F');
      jet(x,y,4.31,ink,1.12);label(x+9,y+18,'101',ink);
      if(mode==='formation'){jet(x+15,y-14,4.31,blue,.72);jet(x+23,y+10,4.31,blue,.72);}
      else label(146,91,'QDM',quiet);
    }
  }
  function stop(){cancelAnimationFrame(frame);frame=0;last=-1;}
  function tick(now) {
    if (last>=0) elapsed=Math.min(duration,elapsed+now-last);
    last=now;paint(elapsed/duration);
    frame=elapsed<duration?requestAnimationFrame(tick):0;
  }
  function refresh(){
    stop();paint(reduced.matches?1:elapsed/duration);
    if(visible && !document.hidden && !reduced.matches && elapsed<duration) frame=requestAnimationFrame(tick);
  }
  function resize(){
    hero.classList.toggle('exercise-motion-stacked',hero.clientWidth<670);
    const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;
    const dpr=Math.min(devicePixelRatio||1,2);
    if (width && height){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
    refresh();
  }
  new ResizeObserver(resize).observe(hero);
  new MutationObserver(() => { readPalette(); refresh(); }).observe(document.documentElement,
    { attributes:true, attributeFilter:['data-theme'] });
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;refresh();}).observe(canvas);
  document.addEventListener('visibilitychange',refresh);reduced.addEventListener('change',refresh);resize();
})();
