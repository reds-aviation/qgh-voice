/* ATS SIM BOX — Copyright (c) 2026 Balaram Reddy. CPAL-1.0; see LICENSE. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { harness } from './testing/worker-harness.mjs';
import { createPublishedPilotScenario, pilotAircraftLimit, publishedPilotScenarios } from './static/pilot-scenarios.js';

const readChart = name => JSON.parse(readFileSync(new URL('./static/'+name+'.json',import.meta.url)));
const loadData = () => ({catalogue:readChart('india-airbase-lfa-catalogue'),
    airspace:readChart('india-airspace'),enroute:readChart('india-aip-enroute')});

test('five published exercises per airfield create a running ten-aircraft mixed picture', async () => {
    assert.equal(pilotAircraftLimit,12);
    assert.deepEqual(['pune','bagdogra'].map(base=>publishedPilotScenarios.filter(s=>s.base===base).length),[5,5]);
    const host=await harness(), instructor=host.port();
    const auth=(await instructor.request('session',{role:'instructor'})).body;
    const state = async () => (await instructor.request('state',undefined,auth)).body;
    const command = (exerciseId,type,payload) => instructor.request('command',{id:crypto.randomUUID(),exerciseId,type,payload},auth);
    const chart=loadData();
    for (const lesson of publishedPilotScenarios) {
        const model=await createPublishedPilotScenario(lesson.id,()=>chart);
        assert.equal(model.aircraft.length,10,lesson.id);
        assert.equal(new Set(model.aircraft.map(a=>a.callsign)).size,10);
        assert.equal(model.aircraft.filter(a=>a.routeId==='training-circuit').length,4);
        const sectors=model.aircraft.slice(4,6);
        assert.ok(sectors.every(a=>Math.abs(Math.hypot(a.xNm,a.yNm)-30)<3));
        assert.notEqual(sectors[0].routeId,sectors[1].routeId);
        assert.notEqual(model.aircraft[6].routeId,model.aircraft[8].routeId);
        assert.equal(model.aircraft[8].routeId,model.aircraft[9].routeId);
        assert.deepEqual(model.aircraft.map(a=>a.type),['Tejas','Su-30MKI','An-32','ALH Dhruv','Mi-17V-5','Su-30MKI','C-130J','C-17','Su-30MKI','An-32']);
        assert.equal(model.environment.publishedAirspace.baseId,lesson.base);
        assert.equal(model.environment.publishedAirspace.runways[0].name.includes(lesson.runway),true);
        const before=await state();
        const loaded=await command(before.exerciseId,'import',{scenario:model,expectedRevision:before.revision});
        assert.equal(loaded.status,200,JSON.stringify(loaded.body));
        const start=await state();
        assert.equal(start.elapsed,0);
        assert.equal(start.running,false);
        assert.equal(start.roster.length,10);
        const step=await command(start.exerciseId,'clock',{action:'step',seconds:60});
        assert.equal(step.status,200,JSON.stringify(step.body));
        const after=await state();
        assert.equal(after.elapsed,60);
        assert.ok(after.aircraft.every((a,index)=>a.mode==='route' && a.status==='active' && Math.hypot(a.xNm-start.aircraft[index].xNm,a.yNm-start.aircraft[index].yNm)>0.5),lesson.id);
    }
});
