/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {domHarness} from './testing/dom-harness.mjs';

const require = createRequire(import.meta.url);
const suiteSource = name => readFileSync(new URL('../atc-suite/' + name, import.meta.url), 'utf8');

const storageKey = 'atc-suite.saved-exercises.v1';
async function harness() {
  const h = domHarness(suiteSource('instructor.html'), '/qgh-voice/instructor-led/');
  const blobs = [];
  Object.assign(h.context, {
    ATCSuiteCore: require('../atc-suite/suite-core.js'), ATCSuiteSensors: require('../atc-suite/suite-sensors.js'), ATCSuiteSession: require('../atc-suite/suite-session.js'),
    structuredClone, confirm: () => true,
    URL: {createObjectURL(blob) {blobs.push(blob); return 'blob:test';}, revokeObjectURL(){}},
  });
  let code = suiteSource('suite-instructor.js');
  code = code.slice(0, code.indexOf("  byId('copyPin').addEventListener")) +
    '\n globalThis.api={state,saveCurrentSetup,savePresetAsNew,savePreset,duplicatePreset,renamePreset,removePreset,loadPreset,exportPreset,importPreset,captureSetup,restoreSetup,syncRoster};syncRoster();})();';
  vm.runInContext(code, h.context);
  const node = id => h.document.getElementById(id);
  return {...h, ...h.context.api, blobs, node,
    stored: () => JSON.parse(h.context.localStorage.getItem(storageKey) || '[]'),
    value: (setup,id) => setup.find(item => item.id === id)?.value,
  };
}

test('Save as new, Duplicate and Rename preserve exact starting fields while Update selected affects only its chosen record', async () => {
  const h = await harness();
  h.node('callsign').value = '432'; h.node('initialHeading').value = '127'; h.node('savedExerciseName').value = 'Assessment';
  h.savePresetAsNew(); assert.equal(h.stored().length, 1);
  const original = h.stored()[0]; assert.equal(h.value(original.setup,'callsign'),'432'); assert.equal(h.value(original.setup,'initialHeading'),'127');
  h.node('callsign').value = '999'; h.node('initialHeading').value = '88';
  h.duplicatePreset(); assert.equal(h.stored().length, 2);
  const copy = h.stored()[1]; assert.notEqual(copy.id,original.id); assert.equal(copy.name,'Assessment copy');
  assert.deepEqual(copy.setup,original.setup,'Duplicate uses stored starting traffic, not the currently edited form');
  h.node('savedExerciseName').value = 'Renamed assessment'; h.renamePreset();
  assert.equal(h.stored()[1].id,copy.id); assert.equal(h.stored()[1].name,'Renamed assessment'); assert.deepEqual(h.stored()[1].setup,original.setup);
  h.savePreset(); assert.equal(h.value(h.stored()[1].setup,'callsign'),'999'); assert.equal(h.value(h.stored()[0].setup,'callsign'),'432');
  h.node('savedExerciseName').value = 'Assessment'; h.savePresetAsNew();
  assert.equal(h.stored().length,2); assert.match(h.node('presetStatus').textContent,/already used/);
});

test('storage failure never claims a successful update, rename or duplicate and never changes the persisted record', async () => {
  const h = await harness(); h.node('savedExerciseName').value='Keep'; h.savePresetAsNew();
  const before = h.context.localStorage.getItem(storageKey);
  h.context.localStorage.setItem = () => {throw new Error('Storage quota exceeded');};
  h.node('initialHeading').value='88'; h.savePreset(); assert.match(h.node('presetStatus').textContent,/Not saved.*quota/);
  h.node('savedExerciseName').value='Changed'; h.renamePreset(); assert.match(h.node('presetStatus').textContent,/Not renamed.*quota/);
  h.duplicatePreset(); assert.match(h.node('presetStatus').textContent,/Not duplicated.*quota/);
  assert.equal(h.context.localStorage.getItem(storageKey),before);
});

test('legacy QGH presets exceeding two targets are kept and exportable, but Load or Import cannot silently drop their traffic', async () => {
  const h = await harness(), setup = h.captureSetup();
  setup.find(item => item.id==='aircraftCount').value='24';
  const legacy={id:'legacy-record',name:'Historical QGH',version:1,setup};
  const stored=JSON.stringify([legacy]); h.context.localStorage.setItem(storageKey,stored);
  h.node('savedExercise').append(new h.context.Option(legacy.name,legacy.id)); h.node('savedExercise').value=legacy.id;
  const before=h.node('aircraftCount').value; h.node('savedExercise').dispatchEvent(new h.Event('change'));
  assert.equal(h.node('aircraftCount').value,before); assert.match(h.node('presetStatus').textContent,/24.*1–2.*unchanged/);
  assert.equal(h.context.localStorage.getItem(storageKey),stored);
  h.exportPreset(); const exported=JSON.parse(await h.blobs[0].text()); assert.equal(h.value(exported.setup,'aircraftCount'),'24');
  const event={target:{files:[{size:100,text:async()=>JSON.stringify({format:'ats-simbox-instructor-exercise',version:1,name:legacy.name,setup})}],value:'file'}};
  await h.importPreset(event);
  assert.match(h.node('presetStatus').textContent,/Not imported.*1–2/); assert.equal(h.node('aircraftCount').value,before);
  assert.equal(h.context.localStorage.getItem(storageKey),stored);
});

test('importing an existing name creates an independent record and quota failure restores the current form', async () => {
  const h=await harness(); h.node('savedExerciseName').value='Assessment'; h.savePresetAsNew();
  const setup=h.captureSetup(); setup.find(item=>item.id==='callsign').value='765';
  const file={size:100,text:async()=>JSON.stringify({format:'ats-simbox-instructor-exercise',version:1,name:'Assessment',setup})};
  await h.importPreset({target:{files:[file],value:'file'}});
  assert.equal(h.stored().length,2); assert.equal(h.stored()[1].name,'Assessment imported 2'); assert.equal(h.value(h.stored()[1].setup,'callsign'),'765');
  assert.notEqual(h.stored()[1].id,h.stored()[0].id); assert.notEqual(h.value(h.stored()[0].setup,'callsign'),'765');
  h.node('callsign').value='987'; h.node('savedExerciseName').value='Draft not saved';
  h.context.localStorage.setItem=()=>{throw new Error('Storage quota exceeded');};
  await h.importPreset({target:{files:[file],value:'file'}});
  assert.equal(h.node('callsign').value,'987'); assert.equal(h.node('savedExerciseName').value,'Draft not saved');
  assert.match(h.node('presetStatus').textContent,/Not imported.*quota/); assert.equal(h.stored().length,2);
});

test('invalid flight values cannot be saved or imported as a reusable exercise', async () => {
  const h=await harness(); h.node('savedExerciseName').value='Invalid'; h.node('initialSpeed').value='900'; h.savePresetAsNew();
  assert.equal(h.stored().length,0); assert.match(h.node('presetStatus').textContent,/Not saved.*speed/i);
  h.node('initialSpeed').value='240'; const setup=h.captureSetup(); setup.find(item=>item.id==='turnRate').value='100';
  await h.importPreset({target:{files:[{size:100,text:async()=>JSON.stringify({format:'ats-simbox-instructor-exercise',version:1,name:'Invalid import',setup})}],value:'file'}});
  assert.equal(h.stored().length,0); assert.equal(h.node('turnRate').value,'3'); assert.match(h.node('presetStatus').textContent,/Not imported.*turn/i);
});

test('collapsed Saved exercises restores a selected setup directly without a separate Load button', async () => {
  const h = await harness();
  const library = h.node('qghSavedExercises'), management = h.document.querySelector('.preset-management');
  assert.equal(library.hasAttribute('open'), false);
  assert.equal(management.hasAttribute('open'), false);
  for (const id of ['savedExercise', 'savedExerciseName', 'saveExercisePreset', 'exportExercisePreset', 'importExercisePreset']) assert.equal(h.node(id).closest('details'), library);
  assert.equal(h.node('loadExercisePreset'), null);
  for (const id of ['renameExercisePreset', 'removeExercisePreset']) assert.equal(h.node(id).closest('details'), management);
  assert.equal(h.node('saveExercisePresetAs'), null); assert.equal(h.node('duplicateExercisePreset'), null);
  assert.equal(h.node('saveExercisePreset').textContent, 'Save'); assert.equal(h.node('exportExercisePreset').textContent, 'Download');
  h.node('savedExerciseName').value = 'QGH briefing'; h.node('initialHeading').value = '127'; h.node('initialSpeed').value = '250';
  h.saveCurrentSetup(); assert.equal(h.stored().length, 1);
  const id = h.stored()[0].id;
  h.node('initialHeading').value = '88'; h.saveCurrentSetup();
  assert.equal(h.stored().length, 1); assert.equal(h.stored()[0].id, id);
  assert.equal(h.value(h.stored()[0].setup, 'initialHeading'), '88');
  h.node('initialHeading').value = '300'; h.node('initialSpeed').value = '400';
  h.node('savedExercise').dispatchEvent(new h.Event('change'));
  assert.equal(h.node('initialHeading').value, '88'); assert.equal(h.node('initialSpeed').value, '250');
  assert.match(h.node('presetStatus').textContent, /Create a session when ready/);
  assert.equal(h.state.session, null); assert.equal(h.state.simulation, null);
  h.node('savedExercise').value = ''; h.node('savedExercise').dispatchEvent(new h.Event('change'));
  assert.equal(h.node('initialHeading').value, '88'); assert.equal(h.node('savedExerciseName').value, '');
  h.node('savedExerciseName').value = 'Another briefing'; h.saveCurrentSetup();
  assert.equal(h.stored().length, 2); assert.notEqual(h.stored()[1].id, id);
});
