'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');

async function instructorHarness(){
  const {domHarness}=await import('../../procedural-beta/testing/dom-harness.mjs');
  const h=domHarness(readFileSync(join(__dirname,'../instructor.html'),'utf8'),'/qgh-voice/instructor-led/');
  const Session=require('../suite-session.js'),Core=require('../suite-core.js'),hub=Session.createFakeTransportHub();
  Object.assign(h.context,{
    ATCSuiteCore:{...Core,createState:input=>Core.createState(JSON.parse(JSON.stringify(input)))},ATCSuiteSensors:require('../suite-sensors.js'),ATCSuiteSession:{...Session,
      createInstructorSession:options=>Session.createInstructorSession({...options,publicMetadata:JSON.parse(JSON.stringify(options.publicMetadata))}),
      createLocalSessionTransport:({channelName})=>hub.createTransport(channelName)},
    ATCSuiteDisplay:require('../suite-display.js'),ATCSuiteCommandReference:require('../suite-command-reference.js'),
    ATCSuiteWorkspace:{bindShell(){}},structuredClone,confirm:()=>true,setInterval:()=>1,requestAnimationFrame:()=>1,
  });
  const source=readFileSync(join(__dirname,'../suite-instructor.js'),'utf8').replace(/\}\)\(\);\s*$/, 'globalThis.fixture={state,setTrainingTimeRate,createSession,retryScenario,checkpoint,restoreAttempt,importPreset};})();');
  vm.runInContext(source,h.context);
  await new Promise(resolve=>setImmediate(resolve));
  return {...h,...h.context.fixture,get:id=>h.document.getElementById(id)};
}

test('QGH instructor boots with traffic first and collapsed preparation and saved exercise tools',async()=>{
  const h=await instructorHarness();
  const get=id=>h.document.getElementById(id),environment=get('setupEnvironment'),library=get('qghSavedExercises');
  assert.equal(environment.hasAttribute('open'),false);assert.equal(library.hasAttribute('open'),false);
  assert.equal(get('scenarioForm').nextElementSibling,library,'traffic precedes the saved library');
  for(const id of ['callsign','initialBearing','initialRange','initialHeading','initialAltitude','initialSpeed'])assert.equal(get(id).closest('details'),null);
  for(const id of ['runwayOrientation','finalTrack','radarProfile','extendedCentreline','localLfaEnabled'])assert.equal(get(id).closest('details'),environment);
  for(const id of ['turnRate','verticalRate'])assert.equal(get(id).closest('details').hasAttribute('open'),false);
  assert.equal(get('aircraftCount').max,'2');assert.equal(get('returnToExercise').hidden,true);
  assert.equal(get('saveExercisePresetAs'),null);assert.equal(get('duplicateExercisePreset'),null);
  assert.equal(get('squawk').closest('label').hidden,true);assert.equal(get('radarReturn').closest('label').hidden,true);
  get('squawk').value='4312';get('radarReturn').value='mode-a';get('radarReturn').dataset.radarReturnAuto='false';
  for(const family of ['sra','surveillance','qgh']){
    get('exerciseFamily').value=family;get('exerciseFamily').dispatchEvent(new h.Event('change'));
    assert.equal(get('squawk').closest('label').hidden,family==='qgh');assert.equal(get('radarReturn').closest('label').hidden,family==='qgh');
    assert.equal(get('squawk').value,'4312');assert.equal(get('radarReturn').value,'mode-a','switching families retains the saved return choice');
  }
});

test('changing the draft exercise family cannot change the retained exercise clock rate',async()=>{
  const h=await instructorHarness(),{state,setTrainingTimeRate,get}=h;
  state.simulation=h.context.ATCSuiteCore.setLifecycle(h.context.ATCSuiteCore.createState({exerciseFamily:'qgh',callsign:'101',initialQteDeg:65,initialRangeNm:25,initialHeadingDeg:225,altitudeFt:12000,speedKt:240,rateDegPerSecond:3,runwayOrientationDeg:230,finalTrackDeg:230}),'paused');
  setTrainingTimeRate(10);
  get('exerciseFamily').value='sra';get('exerciseFamily').dispatchEvent(new h.Event('change'));
  assert.equal(state.trainingTimeRate,10,'draft family selection must not slow the retained QGH exercise from 10× to 1×');
  assert.equal(get('trainingTimeRate').value,'10');
  state.simulation=null;
  get('exerciseFamily').value='surveillance';get('exerciseFamily').dispatchEvent(new h.Event('change'));
  assert.equal(state.trainingTimeRate,1,'a fresh setup still receives its family default');
});

test('Restart restores the original aircraft and airspace after a different draft was edited during the exercise',async()=>{
  const h=await instructorHarness(),{get,state}=h;
  get('callsign').value='ORIGINAL';get('initialSpeed').value='250';get('runwayOrientation').value='230';
  await h.createSession({preventDefault(){}});
  assert.ok(state.session,get('setupPreview').textContent);
  get('callsign').value='NEXT';get('initialSpeed').value='400';get('runwayOrientation').value='90';
  h.retryScenario();
  assert.equal(get('callsign').value,'ORIGINAL');assert.equal(get('initialSpeed').value,'250');
  assert.equal(get('runwayOrientation').value,'230');assert.equal(state.simulation,null);
});

test('review download imports the original fleet and radar references, including older recovered attempts',async()=>{
  for(const legacy of [false,true]){
    const h=await instructorHarness(),{get,state}=h,blobs=[];
    h.context.URL={createObjectURL:blob=>{blobs.push(blob);return 'blob:exercise';},revokeObjectURL(){}};
    get('exerciseFamily').value='sra';get('exerciseFamily').dispatchEvent(new h.Event('change'));
    get('aircraftCount').value='3';get('aircraftCount').dispatchEvent(new h.Event('input',{bubbles:true}));
    get('callsign-3').value='303';get('initialSpeed-3').value='300';get('radarReturn-3').value='mode-s';get('radarReturn-3').dataset.radarReturnAuto='false';
    get('runwayOrientation').value='150';get('finalTrack').value='150';get('localLfaEnabled').checked=true;get('localLfaRadius').value='18';
    await h.createSession({preventDefault(){}});assert.ok(state.session,get('setupPreview').textContent);
    const original=JSON.stringify(state.initialScenario);
    get('callsign-3').value='DRAFT';get('initialSpeed-3').value='400';get('finalTrack').value='90';
    h.checkpoint();
    const recovery=JSON.parse(h.context.sessionStorage.getItem('atc-suite.instructor-attempt.v1'));
    assert.equal(recovery.initialSetup.find(item=>item.id==='callsign-3').value,'303');
    if(legacy)state.initialSetup=null;
    state.simulation=h.context.ATCSuiteCore.setLifecycle(state.simulation,'running');
    state.simulation=h.context.ATCSuiteCore.advance(state.simulation,60);
    state.simulation=h.context.ATCSuiteCore.setLifecycle(state.simulation,'review');
    get('downloadReviewSetup').click();assert.equal(blobs.length,1,get('reviewSetupStatus').textContent);
    const exported=JSON.parse(await blobs[0].text()),value=id=>exported.setup.find(item=>item.id===id)?.value;
    assert.equal(value('callsign-3'),'303');assert.equal(value('initialSpeed-3'),'300');assert.equal(value('initialRange-3'),'27');
    assert.equal(value('finalTrack'),'150');assert.equal(value('localLfaRadius'),'18');
    assert.equal(JSON.stringify(state.initialScenario),original);assert.equal(get('callsign-3').value,'DRAFT');
    assert.doesNotMatch(JSON.stringify(exported),/seatToken|roomToken|sessionId/);
    const imported=await instructorHarness();
    await imported.importPreset({target:{files:[{size:100,text:async()=>JSON.stringify(exported)}],value:'exercise.json'}});
    assert.match(imported.get('presetStatus').textContent,/Imported as an independent saved exercise/);
    assert.equal(imported.get('exerciseFamily').value,'sra');assert.equal(imported.get('callsign-3').value,'303');
    assert.equal(imported.get('radarReturn-3').value,'mode-s');assert.equal(imported.get('finalTrack').value,'150');
    state.session.close();
  }
});
