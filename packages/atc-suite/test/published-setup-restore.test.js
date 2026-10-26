/* ATS SIM BOX — Copyright (c) 2026 Balaram Reddy. CPAL-1.0; see LICENSE. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const Published = require('../../procedural-beta/static/published-airspace.js');
const directory = join(__dirname, '../../procedural-beta/static');
const json = name => JSON.parse(readFileSync(join(directory, name), 'utf8'));
const data = {catalogue: json('india-airbase-lfa-catalogue.json'), airspace: json('india-airspace.json'), enroute: json('india-aip-enroute.json')};
const base = data.catalogue.airbases.find(base => base.selectable);
const entry = base.lfaEntries.find(entry => entry.geometryRef);
const chart = Published.publicChart(Published.buildSelection(data, base.id, entry.id));

function restoreHarness() {
  const source = readFileSync(join(__dirname, '../suite-instructor.js'), 'utf8');
  // Exercise the production import/recovery functions with only the form and
  // catalogue transport replaced. Source snapshot reconstruction is observable.
  const restore = source.slice(source.indexOf('  function restoreSetup('), source.indexOf('  function saveSetup('));
  const picker = source.slice(source.indexOf('  function publishedInput('), source.indexOf('  function applyPublishedToExercise('));
  const nodes = new Map(), saved = [];
  const node = id => { if (!nodes.has(id)) nodes.set(id, {value:'',checked:false,disabled:false,hidden:false,textContent:'',dataset:{},closest:()=>({})}); return nodes.get(id); };
  let rebuilds = 0;
  const context = vm.createContext({
    byId:node, family:node('exerciseFamily'), state:{}, console,
    maxNewAircraft:()=>20, syncRoster(){}, configureFields(){},
    saveSetup(){saved.push(node('publishedAirspaceData').value);},
    Published:{...Published,loadData:async()=>data,
      createPicker:(_element,{onChange})=>({set(baseId,lfaId,visibility){onChange(baseId ? Published.buildSelection(data,baseId,lfaId,visibility) : null);}}),
      publicChart(selected){rebuilds++;return Published.publicChart(selected);}}
  });
  vm.runInContext('let publishedPicker=null, restoringPublishedPicker=false;'+restore+picker+';globalThis.actions={restoreSetup,initialisePublishedPicker};',context);
  return {node,saved,actions:context.actions,rebuilds:()=>rebuilds};
}

test('restoring an offline published exercise keeps its exact saved source snapshot', async () => {
  const h = restoreHarness(), savedChart = {...chart, effectiveInfo:'Saved edition retained for this exercise', gaps:[...chart.gaps,'Saved source note']};
  const serialized = JSON.stringify(savedChart);
  h.node('publishedAirspaceData').value = serialized;
  await h.actions.initialisePublishedPicker();
  assert.equal(h.node('publishedAirspaceData').value, serialized);
  assert.equal(h.rebuilds(), 0, 'Initializing the picker must not silently replace imported provenance');
  h.actions.restoreSetup([{id:'publishedAirspaceData',value:serialized}]);
  assert.equal(h.node('publishedAirspaceData').value, serialized);
  assert.equal(h.saved.at(-1), serialized);
  assert.equal(h.rebuilds(), 0);
  assert.match(h.node('suitePublishedStatus').textContent,/Saved chart retained/);
});

test('importing a legacy setup removes a previously selected published chart', async () => {
  const h = restoreHarness(); h.node('publishedAirspaceData').value = JSON.stringify(chart);
  await h.actions.initialisePublishedPicker();
  h.actions.restoreSetup([{id:'exerciseFamily',value:'sra'}]);
  assert.equal(h.node('publishedAirspaceData').value,'');
  assert.equal(h.saved.at(-1),'');
  assert.equal(h.rebuilds(),0);
});
