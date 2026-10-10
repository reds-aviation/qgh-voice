'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');

test('QGH instructor boots with traffic first and collapsed preparation and saved exercise tools',async()=>{
  const {domHarness}=await import('../../procedural-beta/testing/dom-harness.mjs');
  const h=domHarness(readFileSync(join(__dirname,'../instructor.html'),'utf8'),'/qgh-voice/instructor-led/');
  Object.assign(h.context,{
    ATCSuiteCore:require('../suite-core.js'),ATCSuiteSensors:require('../suite-sensors.js'),ATCSuiteSession:require('../suite-session.js'),
    ATCSuiteDisplay:require('../suite-display.js'),ATCSuiteCommandReference:require('../suite-command-reference.js'),
    ATCSuiteWorkspace:{bindShell(){}},structuredClone,confirm:()=>true,setInterval:()=>1,requestAnimationFrame:()=>1,
  });
  vm.runInContext(readFileSync(join(__dirname,'../suite-instructor.js'),'utf8'),h.context);
  await new Promise(resolve=>setImmediate(resolve));
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
