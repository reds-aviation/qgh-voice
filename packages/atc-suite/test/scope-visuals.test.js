'use strict';
const test=require('node:test'), assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),{join}=require('node:path');
const Core=require('../suite-core.js'),Sensors=require('../suite-sensors.js'),Session=require('../suite-session.js'),Display=require('../suite-display.js');
const Visuals=require('../../qgh-engine/scope-visuals.js');

function consoleHarness(useHelper=true) {
  const nodes=new Map(), calls=[], labels=[], rings=[], glyphs=[],captions=[];
  const ctx=new Proxy({measureText:text=>({width:String(text).length*7})},{get:(target,key)=>target[key]??((...args)=>calls.push([key,...args]))});
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{id,value:id==='scopeRange'?'40':id==='ringSpacing'?'10':id==='truthLabelMode'?'selected':id==='truthTrailCount'?'8':'0',checked:true,
      children:[],textContent:'',hidden:false,open:true,dataset:{},clientWidth:900,clientHeight:700,width:900,height:700,
      classList:{add(){},remove(){},toggle(){}},getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:900,height:700}),
      addEventListener(){},setAttribute(){},closest:()=>null,replaceChildren(...items){this.children=items;},append(...items){this.children.push(...items);},prepend(item){this.children.unshift(item);},scrollIntoView(){},setPointerCapture(){},releasePointerCapture(){}});
    return nodes.get(id);
  };
  const storage={getItem:()=>null,setItem(){},removeItem(){}};
  const context={document:{body:{classList:{add(){},remove(){}}},getElementById:node,querySelectorAll:()=>[],createElement:()=>node(`created-${nodes.size}`)},
    structuredClone,sessionStorage:storage,localStorage:storage,devicePixelRatio:2,ATCSuiteCore:Core,ATCSuiteSensors:Sensors,ATCSuiteSession:Session,ATCSuiteDisplay:Display,
    ATCSuiteCommandReference:require('../suite-command-reference.js'),setTimeout:()=>1,clearTimeout(){},performance:{now:()=>0},Date,console};
  if(useHelper)context.ATCScopeVisuals={...Visuals,
    drawRangeRings(ctx,options){rings.push(options);return Visuals.drawRangeRings(ctx,options);},
    drawAircraftGlyph(ctx,options){glyphs.push(options);return Visuals.drawAircraftGlyph(ctx,options);},
    drawAircraftLabels(ctx,items){labels.push(items);return Visuals.drawAircraftLabels(ctx,items);}};
  let source=readFileSync(join(__dirname,'../suite-instructor.js'),'utf8');
  source=source.slice(0,source.indexOf("  family.addEventListener('change'"))+'\n globalThis.fixture={state,drawTruth,headingCommand,speedCommand,updateAll,performInstructorAction,shortcutActionForKey,executeKeyboardCommand};})();';
  vm.runInNewContext(source,context);
  const state=context.fixture.state;
  state.simulation=Core.createState({exerciseFamily:'qgh',runwayOrientationDeg:230,finalTrackDeg:230,aircraft:[
    {aircraftId:'a1',callsign:'101',initialQteDeg:30,initialRangeNm:20,initialHeadingDeg:30,altitudeFt:10000,speedKt:240,rateDegPerSecond:3},
    {aircraftId:'a2',callsign:'102',initialQteDeg:32,initialRangeNm:20,initialHeadingDeg:210,altitudeFt:11000,speedKt:260,rateDegPerSecond:3}]});
  state.sensor=Sensors.createDfSensor();
  state.review=Sensors.createReviewTimeline();state.session={publishObservation(){},publishCaption:text=>captions.push(text)};
  return {...context.fixture,node,calls,labels,rings,glyphs,captions,draw(){context.fixture.drawTruth(node('instructorScope'),state.simulation,null);}};
}

test('instructor truth shares fixed rings, constant CSS glyphs and selected-only details without changing flight state',()=>{
  const h=consoleHarness(),before=JSON.stringify(h.state.simulation);h.draw();
  assert.equal(h.node('instructorScope').width,1800);assert.equal(h.node('instructorScope').height,1400);
  assert.equal(h.state.scopeTransform.width,900);assert.equal(h.state.scopeTransform.height,700);
  assert.equal(h.rings.at(-1).spacingNm,10);assert.equal(h.rings.at(-1).rangeNm,40);assert.equal(h.glyphs.length,2);
  const tag=h.labels.at(-1);assert.equal(tag.length,2);assert.deepEqual(tag.map(item=>item.lines.length).sort(),[1,3]);
  assert.equal(Visuals.overlaps(tag[0].box,tag[1].box,4),false);
  h.node('ringSpacing').value='5';h.node('truthLabelMode').value='all';h.draw();
  assert.equal(h.rings.at(-1).spacingNm,5);assert.deepEqual(h.labels.at(-1).map(item=>item.lines.length),[3,3]);
  h.node('truthLabelMode').value='off';h.draw();assert.equal(h.labels.at(-1).length,0);
  assert.equal(JSON.stringify(h.state.simulation),before);
});

test('instructor remains usable at high DPR with fixed outer ring and selected details if shared helper fails to load',()=>{
  const h=consoleHarness(false),before=JSON.stringify(h.state.simulation);h.node('scopeRange').value='auto';h.draw();
  assert.equal(h.node('instructorScope').width,1800);assert.equal(h.state.scopeTransform.width,900);
  assert.ok(h.calls.some(call=>call[0]==='fillText'&&call[1]==='30 NM'));
  const details=h.calls.filter(call=>call[0]==='fillText'&&/FT · .*KT/.test(call[1]));assert.equal(details.length,1);
  assert.equal(JSON.stringify(h.state.simulation),before);
});

test('instructor heading buttons reject blank and invalid numbers without a turn or radio message',()=>{
  const h=consoleHarness();h.state.simulation=Core.setLifecycle(h.state.simulation,'running');
  for(const id of ['quickHeading','turnHeadingInput'])for(const value of ['', ' ', '-1','360','1.5','NaN']){
    h.node(id).value=value;const before=h.state.simulation;
    h.headingCommand('quickHeadingLeft',id,'left');assert.equal(h.state.simulation,before,value);assert.equal(h.captions.length,0,value);
  }
  h.node('quickHeading').value='0';h.headingCommand('quickHeadingRight','quickHeading','right');
  assert.equal(h.state.simulation.aircraft.turn.targetHeadingDeg,0);assert.equal(h.captions.length,1);
});

test('instructor speed controls obey displayed 60..600 knot, 5 knot increments and browser input validity',()=>{
  const h=consoleHarness();h.state.simulation=Core.setLifecycle(h.state.simulation,'running');
  for(const value of ['', '30','700','241','240.5']){
    h.node('liveSpeed').value=value;const before=h.state.simulation;h.speedCommand();
    assert.equal(h.state.simulation,before,value);assert.equal(h.captions.length,0,value);
  }
  h.node('liveSpeed').value='300';h.node('liveSpeed').reportValidity=()=>false;h.speedCommand();assert.equal(h.captions.length,0);
  h.node('liveSpeed').reportValidity=()=>true;h.speedCommand();assert.equal(h.state.simulation.aircraft.speedKt,300);assert.equal(h.captions.length,1);
});

test('QGH scope tag shows 030 H while heading controls and other readouts retain their reference',()=>{
  const h=consoleHarness();h.updateAll();
  assert.ok(h.labels.at(-1).some(item=>item.lines.includes('030 H')));
  assert.match(h.node('quickAircraftStatus').textContent,/030°M/);assert.equal(h.node('truthHeading').textContent,'030°');
  assert.equal(h.node('quickHeading').value,'0','display formatting does not modify target controls');
});

test('instructor keyboard actions that depend on the heading field reject a cleared field instead of assigning north',()=>{
  const h=consoleHarness();h.state.simulation=Core.setLifecycle(h.state.simulation,'running');h.node('turnHeadingInput').value='';const before=h.state.simulation;
  for(const key of ['a','d'])assert.equal(h.performInstructorAction(h.shortcutActionForKey(key)).accepted,false);
  assert.equal(h.executeKeyboardCommand('CONTINUE').accepted,false);assert.equal(h.state.simulation,before);assert.equal(h.captions.length,0);
});
