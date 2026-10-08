'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const Visuals = require('../scope-visuals.js');

function drawingContext() {
  const calls = [];
  return new Proxy({calls, measureText: text => ({width: String(text).length * 7})}, {
    get: (target, key) => target[key] ?? ((...args) => calls.push([key, ...args]))
  });
}

test('range rings repeat fixed 5/10 NM intervals and preserve the exact outer boundary', () => {
  for (const [rangeNm, spacingNm, expected] of [[40,10,[10,20,30,40]], [40,5,[5,10,15,20,25,30,35,40]], [35,10,[10,20,30,35]], [5,10,[5]]]) {
    const rings = Visuals.rangeRings({rangeNm,spacingNm,cx:200,cy:200,scale:2,width:400,height:400});
    assert.deepEqual(rings.map(ring => ring.distanceNm), expected);
    assert.equal(rings.at(-1).boundary, true);
    assert.equal(rings.at(-1).label, true);
    assert.equal(rings.at(-1).radius, rangeNm * 2);
  }
});

test('large scopes draw every visible requested ring while spacing out their captions', () => {
  for (const rangeNm of [500,2000]) {
    const ctx = drawingContext();
    const rings = Visuals.drawRangeRings(ctx,{rangeNm,spacingNm:5,cx:450,cy:450,scale:400/rangeNm,width:900,height:900});
    assert.equal(rings.length, rangeNm / 5);
    assert.equal(ctx.calls.filter(call => call[0] === 'arc').length, rangeNm / 5);
    assert.ok(ctx.calls.filter(call => call[0] === 'fillText').length <= 15, 'captions stay sparse even with 400 rings');
  }
});

test('panned and zoomed rings remain station centred and omit circles outside the viewport', () => {
  const rings = Visuals.rangeRings({rangeNm:100,spacingNm:10,cx:-100,cy:200,scale:5,width:400,height:400});
  assert.ok(rings.every(ring => ring.cx === -100 && ring.cy === 200));
  assert.equal(rings[0].visible, false);
  assert.equal(rings[1].visible, true);
  const zoomed = Visuals.rangeRings({rangeNm:100,spacingNm:10,cx:200,cy:200,scale:10,width:400,height:400});
  assert.deepEqual(zoomed.filter(ring => ring.visible).map(ring => ring.distanceNm), [10,20]);
});

test('canvas backing uses DPR while drawing coordinates remain CSS pixels across redraws', () => {
  const ctx=drawingContext(), canvas={clientWidth:600,clientHeight:400,width:600,height:400,dataset:{},getContext:()=>ctx};
  for (const ratio of [2,2,3,1]) {
    const metrics=Visuals.canvasMetrics(canvas,ratio);
    assert.equal(metrics.width,600); assert.equal(metrics.height,400);
    assert.equal(canvas.width,600*ratio); assert.equal(canvas.height,400*ratio);
    assert.deepEqual(ctx.calls.at(-1),['setTransform',ratio,0,0,ratio,0,0]);
  }
});

test('shared aircraft glyph has a constant CSS footprint with heading rotation', () => {
  for (const headingDeg of [0,90,180,270]) {
    const ctx=drawingContext(), footprint=Visuals.drawAircraftGlyph(ctx,{x:250,y:200,headingDeg,selected:true});
    assert.deepEqual(footprint,{x:240,y:190,width:20,height:20});
    assert.equal(Math.max(...ctx.calls.filter(call => ['moveTo','lineTo'].includes(call[0])).flatMap(call => call.slice(1).map(Math.abs))),6.5);
    assert.ok(ctx.calls.some(call => call[0]==='rotate' && call[1]===headingDeg*Math.PI/180));
    assert.ok(ctx.calls.some(call => call[0]==='arc' && call[3]===10));
  }
});

test('Selected mode shows full details only for selected aircraft; All/Off work explicitly', () => {
  const aircraft=[{id:'a',callsign:'101',selected:false,details:['10000 FT 240 KT','090°M']},{id:'b',callsign:'102',selected:true,details:['11000 FT 260 KT','180°M']}];
  assert.deepEqual(Visuals.aircraftLabels(aircraft).map(item=>item.lines.length),[1,3]);
  assert.deepEqual(Visuals.aircraftLabels(aircraft,{mode:'all'}).map(item=>item.lines.length),[3,3]);
  assert.deepEqual(Visuals.aircraftLabels(aircraft,{mode:'off'}),[]);
});

test('one minute vectors preserve knot/NM correspondence at every scope scale and include airborne steady wind',()=>{
  for(const scale of [.1,1,100]){
    const vector=Visuals.minuteVectorNm({headingDeg:90,speedKt:240,windSpeedKt:0});
    assert.ok(Math.abs(vector.xNm-4)<1e-12);assert.ok(Math.abs(vector.yNm)<1e-12);
    assert.ok(Math.abs(vector.xNm*scale/scale-4)<1e-12);
  }
  const wind=Visuals.minuteVectorNm({headingDeg:90,speedKt:240,windDirectionDeg:0,windSpeedKt:60});
  assert.ok(Math.abs(wind.xNm-4)<1e-12);assert.ok(Math.abs(wind.yNm+1)<1e-12);
  const ground=Visuals.minuteVectorNm({headingDeg:90,speedKt:240,windDirectionDeg:0,windSpeedKt:60,airborne:false});
  assert.ok(Math.abs(ground.xNm-4)<1e-12);assert.ok(Math.abs(ground.yNm)<1e-12);
});

test('crowded aircraft tags avoid all symbols, each other, viewport edges and overlay controls', () => {
  const aircraft=Array.from({length:9},(_,i)=>({id:String(i),callsign:`10${i}`,x:190+i%3*18,y:160+Math.floor(i/3)*20,selected:i===4,details:['10000 FT 240 KT','090°M']}));
  const obstacles=[{x:0,y:280,width:500,height:70},{x:410,y:0,width:90,height:280}];
  const placements=Visuals.placeAircraftLabels(Visuals.aircraftLabels(aircraft),{width:500,height:350,aircraft,obstacles});
  assert.equal(placements.length,aircraft.length); assert.equal(placements[0].id,'4');
  for (const [index,item] of placements.entries()) {
    assert.ok(item.box.x>=5&&item.box.y>=5&&item.box.x+item.box.width<=495&&item.box.y+item.box.height<=345);
    assert.ok(item.leader,'offset labels have leader lines');
    for (const obstacle of obstacles) assert.equal(Visuals.overlaps(item.box,obstacle,4),false);
    for (const plane of aircraft) assert.equal(Visuals.overlaps(item.box,{x:plane.x-11,y:plane.y-11,width:22,height:22},4),false);
    for (const earlier of placements.slice(0,index)) assert.equal(Visuals.overlaps(item.box,earlier.box,4),false);
  }
});

test('edge aircraft tags fit the viewport and fully blocked tags are omitted rather than overlapping', () => {
  const aircraft=[{id:'a',callsign:'101',x:3,y:3,selected:true,details:['10000 FT 240 KT']},{id:'b',callsign:'102',x:295,y:195}];
  const items=Visuals.aircraftLabels(aircraft), placed=Visuals.placeAircraftLabels(items,{width:300,height:200});
  assert.equal(placed.length,2);
  assert.deepEqual(Visuals.placeAircraftLabels(items,{width:300,height:200,obstacles:[{x:0,y:0,width:300,height:200}]}),[]);
});

test('overlay rectangles convert screen pixels to canvas CSS coordinates and ignore hidden/outside tools', () => {
  const element=(bounds,hidden=false)=>({hidden,getBoundingClientRect:()=>bounds,getClientRects:()=>[bounds]});
  const document={querySelectorAll:()=>[element({left:350,top:350,width:100,height:80}),element({left:10,top:10,width:20,height:20}),element({left:200,top:200,width:100,height:100},true)]};
  const canvas={getBoundingClientRect:()=>({left:100,top:100,width:400,height:300})};
  assert.deepEqual(Visuals.overlayObstacles(canvas,{document,width:800,height:600}),[{x:500,y:500,width:200,height:100}]);
});

function reviewHarness(filename, useHelper=true) {
  const ctx=drawingContext(), handlers=new Map(), captured=[];
  const plot={classList:{add(){},remove(){},toggle(){}},addEventListener:(type,fn)=>handlers.set(type,fn)};
  const canvas={clientWidth:800,clientHeight:600,width:800,height:600,style:{},parentElement:plot,getContext:()=>ctx,addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})};
  const helper={...Visuals,drawAircraftGlyph(context,options){captured.push({kind:'glyph',...options});return Visuals.drawAircraftGlyph(context,options);},drawRangeRings(context,options){captured.push({kind:'rings',...options});return Visuals.drawRangeRings(context,options);}};
  const window={devicePixelRatio:2,QGHCore:{normalize:n=>(n+360)%360,radians:n=>n*Math.PI/180}};
  if(useHelper)window.ATCScopeVisuals=helper;
  vm.runInNewContext(readFileSync(join(__dirname,'..',filename),'utf8'),{window,document:{getElementById:()=>canvas,querySelectorAll:()=>[]}});
  return {window,canvas,ctx,handlers,captured};
}

for(const [filename,api] of [['workspace.js','QGHReview'],['tactical-workspace.js','QGHTacticalReview']]) {
  test(`${filename} rounded north review labels stay within 000 to 359 degrees`,()=>{
    const h=reviewHarness(filename),cfg={distance:20,inbound:359.6,outbound:359.6,runway:359.6},path=[{x:10,y:10,heading:359.6}];
    const model=api==='QGHReview'?{cfg,path,maxRange:35}:{cfg,canvas:h.canvas,aircraft:[{id:'a',callsign:'101',cfg:{speed:240},level:10000,path}],maxRange:35,labelMode:'all'};
    const before=JSON.stringify(api==='QGHReview'?model:{...model,canvas:undefined});
    h.window[api].draw(model);
    const labels=h.ctx.calls.filter(call=>call[0]==='fillText').map(call=>call[1]);
    assert.ok(labels.some(label=>label==='RWY 000°M'));
    assert.ok(labels.some(label=>label==='OUTBOUND 000°M'));
    assert.ok(labels.every(label=>!label.includes('360°')));
    if(api==='QGHTacticalReview')assert.ok(labels.includes('000 H'),'scope aircraft heading uses H while runway and bearings retain magnetic notation');
    assert.equal(JSON.stringify(api==='QGHReview'?model:{...model,canvas:undefined}),before,'display normalization keeps flight data unchanged');
    cfg.inbound=179.6;h.ctx.calls.length=0;h.window[api].draw(model);
    assert.ok(h.ctx.calls.some(call=>call[0]==='fillText'&&call[1]==='QDR 000°M · RADIAL FROM VDF'),'reciprocal radial also wraps after rounding');
  });
  test(`${filename} zoom changes world scale while retaining small glyphs and flight data`,()=>{
    const h=reviewHarness(filename), cfg={distance:20,inbound:230,outbound:45,runway:230};
    const path=[{x:10,y:10,heading:90},{x:11,y:10,heading:90}];
    const model=api==='QGHReview'?{cfg,path,maxRange:35}:{cfg,canvas:h.canvas,aircraft:[{id:'a',callsign:'101',cfg:{speed:240},level:10000,path}],maxRange:35};
    const before=JSON.stringify(api==='QGHReview'?model:{...model,canvas:undefined});
    h.window[api].draw(model);h.window[api].setZoomEnabled(true);
    const scale=h.captured.find(call=>call.kind==='rings').scale;
    h.handlers.get('wheel')({deltaY:-1,preventDefault(){}});
    const rings=h.captured.filter(call=>call.kind==='rings').at(-1);
    assert.ok(Math.abs(rings.scale/scale-1.14)<1e-9); assert.equal(rings.spacingNm,10);
    assert.equal(h.canvas.style.transform,''); assert.equal(h.canvas.width,1600);assert.equal(h.canvas.height,1200);
    assert.ok(h.captured.filter(call=>call.kind==='glyph').every(call=>call.size===undefined||call.size===12));
    assert.equal(JSON.stringify(api==='QGHReview'?model:{...model,canvas:undefined}),before);
  });
  test(`${filename} still draws aircraft and fixed rings when the shared helper is unavailable`,()=>{
    const h=reviewHarness(filename,false),cfg={distance:20,inbound:230,outbound:45,runway:230},path=[{x:10,y:10,heading:90}];
    h.window[api].draw(api==='QGHReview'?{cfg,path,maxRange:35}:{cfg,canvas:h.canvas,aircraft:[{id:'a',callsign:'101',path}],maxRange:35});
    assert.deepEqual(h.ctx.calls.filter(call=>call[0]==='fillText'&&/ NM$/.test(call[1])).map(call=>call[1]),['10 NM','20 NM','30 NM','35 NM']);
    assert.ok(h.ctx.calls.some(call=>call[0]==='moveTo'&&call[1]===0&&call[2]===-6));
  });
}

test('Tactical review speed tags use the replay segment ground speed, including formation, rather than final configured speed',()=>{
  const h=reviewHarness('tactical-workspace.js'),cfg={distance:20,inbound:230,outbound:45,runway:230};
  const leader={id:'lead',callsign:'101',formationRole:'LEAD',cfg:{speed:600},level:10000,
    path:[{x:10,y:10,heading:90},{x:10+240/3600*.25,y:10,heading:90},{x:10+(240+360)/3600*.25,y:10,heading:90}]};
  const wing={...leader,id:'wing',callsign:'102',formationRole:'FORMATION',cfg:{speed:300},level:11000,
    path:[{x:11,y:11,heading:90},{x:11+260/3600*.25,y:11,heading:90},{x:11+(260+380)/3600*.25,y:11,heading:90}]};
  const model={cfg,canvas:h.canvas,aircraft:[leader,wing],maxRange:35,labelMode:'all',count:2};
  const labels=()=>h.ctx.calls.filter(call=>call[0]==='fillText').map(call=>call[1]);
  h.window.QGHTacticalReview.draw(model);assert.ok(labels().includes('10000 FT  240 KT GS'));assert.ok(labels().includes('11000 FT  260 KT GS'));
  h.ctx.calls.length=0;model.count=3;h.window.QGHTacticalReview.draw(model);assert.ok(labels().includes('10000 FT  360 KT GS'));assert.ok(labels().includes('11000 FT  380 KT GS'));
  h.ctx.calls.length=0;model.count=1;h.window.QGHTacticalReview.draw(model);assert.ok(labels().includes('10000 FT  GS —'));assert.ok(labels().every(label=>!label.includes('600 KT')));
});
