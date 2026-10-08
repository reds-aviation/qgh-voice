import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {domHarness} from './testing/dom-harness.mjs';
const require=createRequire(import.meta.url),Visuals=require('../qgh-engine/scope-visuals.js');
const source=name=>readFileSync(new URL('./static/'+name,import.meta.url),'utf8');
const gestures=await import('data:text/javascript;base64,'+Buffer.from(source('scope-interaction.js')).toString('base64'));

function consoleHarness(useHelper=true) {
  const h=domHarness(source('procedural.html')),rings=[],glyphs=[],tags=[],vectors=[],drawCalls=[];
  const drawing=new Proxy({measureText:text=>({width:String(text).length*7})},{get:(target,key)=>target[key]??((...args)=>drawCalls.push([key,...args]))});
  h.document.getElementById('scope').getContext=()=>drawing;
  Object.assign(h.context,{
    createAircraftGestures:gestures.createAircraftGestures,nearestAircraft:gestures.nearestAircraft,bindMiddleMouseStop:gestures.bindMiddleMouseStop,
    createRadarSweep:()=>({update(){}}),recordTrail(){},trailDots:()=>[],trailSpacing:()=>1,
    createTrafficReview:()=>({record(){},open(){},close(){},clear(){}}),createTrafficSetup:()=>({open(){},close(){}}),
    createStudentPlotting:()=>({mount(){},setEnabled(){},draw(){},onPointerDown(){},onPointerMove(){},onPointerUp(){},onPointerCancel(){}}),
    createMapWorkshop:()=>({}),alignmentBriefing:()=>'',createChartWorkshop:()=>({}),drawAreas(){},routeWindowOpen:()=>true,
    visibleSegment:()=>true,reserveLabel:()=>null,fitNavigation(){},approachReference:()=>[],resolveRouteFixIds:()=>[],
  });
  if(useHelper)h.context.ATCScopeVisuals={...Visuals,overlayObstacles:()=>[],
    drawRangeRings(ctx,options){rings.push(options);return Visuals.drawRangeRings(ctx,options);},
    drawAircraftGlyph(ctx,options){glyphs.push(options);return Visuals.drawAircraftGlyph(ctx,options);},
    minuteVectorNm(options){const vector=Visuals.minuteVectorNm(options);vectors.push({options,vector});return vector;},
    aircraftLabels(aircraft,options){const items=Visuals.aircraftLabels(aircraft,options);tags.push(items);return items;}};
  vm.runInContext(source('meeting-room.js'),h.context);
  vm.runInContext(source('procedural.js').replace(/^import .*;\r?\n/gm,'')+`
    globalThis.commands=[];command=async (...args)=>commands.push(args);
    globalThis.prepare=role=>{
      enter({role},false);stage='desk';range=500;
      const a={id:'a1',callsign:'101',type:'TRAINER',status:'airborne',mode:'heading',headingDeg:128,targetHeadingDeg:128,speedKt:360,targetSpeedKt:360,altitudeFt:12000,targetAltitudeFt:12000,xNm:2,yNm:3};
      const b={...a,id:'a2',callsign:'102',speedKt:240,targetSpeedKt:240,altitudeFt:14000,targetAltitudeFt:14000,headingDeg:95,targetHeadingDeg:95,xNm:8,yNm:10};
      view={exerciseId:'graphics-test',available:true,environment:{rangeNm:500,stationName:'NAV0',stationXNm:20,stationYNm:15,qnhHpa:1000,aerodromeElevationFt:0},roster:[a,b],aircraft:[a,b],routes:[],fixes:[],areas:[],elapsed:0};
      choose(a.id);setStage('desk');
    };
    globalThis.paint=draw;globalThis.flightData=()=>JSON.stringify(view);globalThis.metrics=geometry;
    globalThis.refreshTargets=renderSelection;globalThis.chooseTarget=choose;
    globalThis.updateAircraft=(id,values)=>Object.assign(view.aircraft.find(a=>a.id===id),values);
    globalThis.configureVector=(environment,aircraft)=>{range=2000;display.vectors=true;Object.assign(view.environment,environment);Object.assign(view.aircraft[0],aircraft);view.aircraft=[view.aircraft[0]];draw();};
  `,h.context);
  return {...h,rings,glyphs,tags,vectors,drawCalls,node:id=>h.document.getElementById(id)};
}

test('Procedural controls draw the same fixed intervals and selected details without changing flight data',()=>{
  const h=consoleHarness();h.context.prepare('instructor');
  const before=h.context.flightData();h.context.paint();const g=h.context.metrics();
  assert.equal(h.rings.at(-1).rangeNm,500);assert.equal(h.rings.at(-1).spacingNm,10);
  assert.equal(h.rings.at(-1).cx,g.cx+20*g.scale);assert.equal(h.rings.at(-1).cy,g.cy-15*g.scale);
  assert.deepEqual(Array.from(h.tags.at(-1),item=>item.lines.length),[3,1]);
  h.node('ring-spacing').value='5';h.node('ring-spacing').onchange();assert.equal(h.rings.at(-1).spacingNm,5);
  h.node('aircraft-labels').value='all';h.node('aircraft-labels').onchange();assert.deepEqual(Array.from(h.tags.at(-1),item=>item.lines.length),[3,3]);
  h.node('aircraft-labels').value='off';h.node('aircraft-labels').onchange();assert.equal(h.tags.at(-1).length,0);
  assert.equal(h.context.flightData(),before);assert.equal(h.context.commands.length,0);
});

test('Procedural student drawing never invokes truth glyphs or aircraft labels',()=>{
  const h=consoleHarness();h.context.prepare('student');h.glyphs.length=0;h.tags.length=0;h.context.paint();
  assert.equal(h.glyphs.length,0);assert.equal(h.tags.length,0);assert.equal(h.node('aircraft-labels').closest('label').hidden,true);
});

test('Procedural console boots and paints instructor/student views when the shared helper is unavailable',()=>{
  const h=consoleHarness(false);h.context.prepare('instructor');h.node('ring-spacing').value='5';h.node('ring-spacing').onchange();
  h.node('aircraft-labels').value='all';h.node('aircraft-labels').onchange();h.context.paint();
  h.context.prepare('student');h.context.paint();assert.equal(h.context.commands.length,0);
});

test('Procedural targets initialize from selected aircraft, preserve edited drafts on polling and restore drafts per aircraft',()=>{
  const h=consoleHarness();h.context.prepare('instructor');
  const input=(form,name='value')=>h.node(form).querySelector(`[name="${name}"]`);
  assert.equal(input('scope-speed-form').value,'360');assert.equal(input('scope-level-form').value,'12000');assert.equal(input('scope-heading-form').value,'128');
  const speed=input('scope-speed-form');speed.value='280';speed.dispatchEvent(new h.Event('input',{bubbles:true}));
  h.context.updateAircraft('a1',{speedKt:330,targetSpeedKt:330,altitudeFt:12500,targetAltitudeFt:12500});h.context.refreshTargets();
  assert.equal(speed.value,'280');assert.equal(input('scope-level-form').value,'12500');
  h.context.chooseTarget('a2');assert.equal(speed.value,'240');assert.equal(input('scope-heading-form').value,'95');
  h.context.chooseTarget('a1');assert.equal(speed.value,'280');assert.equal(h.context.commands.length,0);
});

test('Procedural Flight level target uses QNH conversion and reference limits, preserving edited values across reference changes',()=>{
  const h=consoleHarness();h.context.prepare('instructor');
  const form=h.node('scope-level-form'),input=form.querySelector('[name="value"]'),reference=form.querySelector('[name="reference"]');
  reference.value='standard';reference.dispatchEvent(new h.Event('change',{bubbles:true}));
  assert.equal(input.value,'124');assert.equal(input.max,'600');assert.equal(input.min,'0');
  input.value='130';input.dispatchEvent(new h.Event('input',{bubbles:true}));
  reference.value='qnh';reference.dispatchEvent(new h.Event('change',{bubbles:true}));assert.equal(input.value,'12000');assert.equal(input.max,'60000');
  reference.value='standard';reference.dispatchEvent(new h.Event('change',{bubbles:true}));assert.equal(input.value,'130');
  const clearance=h.node('clearance-form');clearance.querySelector('[name="action"]').value='altitude';
  clearance.querySelector('[name="action"]').dispatchEvent(new h.Event('change',{bubbles:true}));
  clearance.querySelector('[name="reference"]').value='standard';clearance.querySelector('[name="reference"]').dispatchEvent(new h.Event('change',{bubbles:true}));
  assert.equal(clearance.querySelector('[name="value"]').value,'124');assert.equal(clearance.querySelector('[name="value"]').max,'600');
  assert.equal(h.context.commands.length,0);
});

test('Procedural clearance draft follows selected aircraft and preserves a typed target across polling and selection changes',()=>{
  const h=consoleHarness();h.context.prepare('instructor');const input=h.node('clearance-form').querySelector('[name="value"]');
  assert.equal(input.value,'128');input.value='270';input.dispatchEvent(new h.Event('input',{bubbles:true}));
  h.context.refreshTargets();assert.equal(input.value,'270');h.context.chooseTarget('a2');assert.equal(input.value,'95');
  h.context.chooseTarget('a1');assert.equal(input.value,'270');assert.equal(h.context.commands.length,0);
});

test('Procedural high-range one-minute vector is a physical ground velocity vector without minimum-pixel exaggeration',()=>{
  for(const useHelper of [true,false]){
    const h=consoleHarness(useHelper);h.context.prepare('instructor');h.drawCalls.length=0;
    h.context.configureVector({windDirectionDeg:0,windSpeedKt:60},{headingDeg:90,speedKt:240,mode:'heading',status:'active'});
    const g=h.context.metrics(),end={x:g.cx+(2+4)*g.scale,y:g.cy-(3-1)*g.scale};
    assert.ok(h.drawCalls.some(call=>call[0]==='lineTo'&&Math.abs(call[1]-end.x)<1e-9&&Math.abs(call[2]-end.y)<1e-9));
    if(useHelper){assert.ok(Math.abs(h.vectors.at(-1).vector.xNm-4)<1e-9);assert.ok(Math.abs(h.vectors.at(-1).vector.yNm+1)<1e-9);}
    h.context.configureVector({windDirectionDeg:0,windSpeedKt:60},{headingDeg:90,speedKt:15,mode:'taxi',status:'taxi'});
    if(useHelper){assert.equal(h.vectors.at(-1).options.airborne,false);assert.ok(Math.abs(h.vectors.at(-1).vector.xNm-.25)<1e-9);}
    assert.equal(h.context.commands.length,0);
  }
});

test('Procedural H notation applies only to the scope aircraft tag, preserving true heading fields and non-scope telemetry',()=>{
  const h=consoleHarness();h.context.prepare('instructor');h.context.updateAircraft('a1',{headingDeg:30,targetHeadingDeg:30});h.context.refreshTargets();h.context.paint();
  assert.ok(Array.from(h.tags.at(-1)[0].lines).includes('030 H HEADING'));
  assert.match(h.node('quick-aircraft-info').textContent,/030°T/);assert.match(h.node('truth-readout').textContent,/HDG 030°T/);
  assert.match(h.node('scope-heading-form').querySelector('label:nth-child(2)').textContent,/Target heading °T/);
});
