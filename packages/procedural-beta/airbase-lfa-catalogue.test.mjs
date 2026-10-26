import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=name=>JSON.parse(readFileSync(new URL(`./static/${name}`,import.meta.url),'utf8'));
const catalogue=read('india-airbase-lfa-catalogue.json');
const geometry=read('india-airspace.json');

test('published catalogue links intact source geometry and never substitutes an unverified base origin',()=>{
  for(const file of catalogue.dataFiles){
    const bytes=readFileSync(new URL(`./static/${file.path}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,`${file.path} requires catalogue revalidation after a source change`);
  }
  for(const base of catalogue.airbases){
    const stored=geometry.find(item=>item.id===base.id);
    assert.equal(base.selectable,!!stored,base.id);
    if(!base.selectable){assert.equal(base.arp,null);assert.equal(base.layers.arp.status,'unavailable');}
    else {
      assert.ok(Math.abs(base.arp.latitude-stored.origin.latitude)<1e-7,base.id);
      assert.ok(Math.abs(base.arp.longitude-stored.origin.longitude)<1e-7,base.id);
      assert.match(base.officialTitle,new RegExp(`^${base.icao} - `));
    }
    for(const feature of base.lfaEntries){
      assert.match(feature.publishedRestrictions,/local flying area/i,feature.officialTitle);
      if(!feature.geometryRef){assert.equal(feature.selectable,false);assert.ok(feature.gaps.length);continue;}
      const ref=feature.geometryRef,area=geometry.find(item=>item.id===ref.baseId)?.areas[ref.areaIndex];
      assert.equal(area?.name,ref.areaName,feature.id);
      assert.equal(area.floorLabel,feature.floorLabel,feature.id);
      assert.equal(area.ceilingLabel,feature.ceilingLabel,feature.id);
    }
  }
});

test('source edition and partial-layer status remain explicit rather than promising complete current airspace',()=>{
  assert.equal(catalogue.source.editionPath,'eaip-v2-09-2026');
  assert.equal(catalogue.source.pageAmendment,'AMDT 08-26');
  assert.equal(catalogue.source.pageEffectiveDate,'03 SEP 2026');
  assert.equal(catalogue.source.retrievedDate,'2026-10-25');
  for(const base of catalogue.airbases){
    assert.equal(base.layers.atsRoutes.completeness,base.selectable?'partial':'none');
    assert.ok(base.layers.specialUse.gaps.some(gap=>/TRA\/TSA/.test(gap)));
    assert.equal(base.layers.internationalBoundary.status,'unavailable');
    assert.ok(base.layers.internationalBoundary.gaps.length);
    for(const feature of base.lfaEntries)assert.equal(feature.activation.status,'not-live');
  }
});

test('seed verification preserves exclusions and distinguishes local, low, hill, route and test areas',()=>{
  assert.equal(catalogue.verificationSeeds.length,43);
  for(const name of ['Sirsa','Jamnagar']){
    assert.equal(catalogue.verificationSeeds.find(seed=>seed.name===name).status,'excluded-by-project-policy');
    assert.ok(!catalogue.airbases.some(base=>base.id===name.toLowerCase()));
  }
  for(const name of ['Betul','Nagpur','Adampur'])assert.equal(catalogue.verificationSeeds.find(seed=>seed.name===name).status,'not-verified-as-airbase-local-flying-area');
  assert.equal(catalogue.nonLfaFeatures.find(feature=>feature.id==='var32').featureType,'route-named-restricted-area');
  assert.equal(catalogue.nonLfaFeatures.find(feature=>feature.id==='vir141b').featureType,'hill-flying-area');
  assert.equal(catalogue.nonLfaFeatures.find(feature=>feature.id==='var34').featureType,'test-flying-area');
  assert.ok(catalogue.nonLfaFeatures.every(feature=>feature.selectableAsLfa===false));
  assert.equal(new Set(catalogue.airbases.flatMap(base=>base.lfaEntries.map(feature=>feature.id))).size,84);
});

test('arc and geographic boundary definitions cannot silently become closing straight lines',()=>{
  const hindan=catalogue.airbases.find(base=>base.id==='hindan');
  const arc=hindan.lfaEntries.find(feature=>feature.id==='vir91a');
  assert.equal(arc.boundaryDefinition.arcs[0].direction,'counterclockwise');
  assert.equal(arc.boundaryDefinition.arcs[0].radiusNm,25);
  assert.equal(arc.boundaryDefinition.arcs[0].centre.publishedCoordinates,'284300N 0772155E');
  assert.match(arc.geometryNotes,/Display approximation/);
  const river=hindan.lfaEntries.find(feature=>feature.id==='vir155a');
  assert.equal(river.geometryRef,null);assert.equal(river.selectable,false);
  assert.match(river.boundaryDefinition.publishedText,/east bank of River Yamuna/);
  for(const id of ['bathinda','suratgarh','hashimara','guwahati','tezpur']){
    const base=catalogue.airbases.find(item=>item.id===id);
    assert.equal(base.layers.internationalBoundary.publishedBoundaryMentionsBorder,true,id);
    assert.ok(base.lfaEntries.filter(feature=>feature.boundaryDefinition.kind==='geographic-trace').every(feature=>feature.geometryRef===null));
  }
});

test('Pune runway reference uses published thresholds without selecting a runway in use',()=>{
  const pune=catalogue.airbases.find(base=>base.id==='pune'),runway=pune.runways[0];
  assert.equal(pune.arp.publishedCoordinates,'183500N 0735510E');
  assert.deepEqual([runway.lengthM,runway.widthM],[2540,46]);
  assert.equal(runway.activeRunway,null);
  assert.deepEqual(runway.ends.map(end=>[end.designator,end.trueBearingDeg,end.threshold.publishedCoordinates]),[
    ['10',94,'183459.09N 0735423.15E'],['28',274,'183453.72N 0735549.60E']
  ]);
  assert.deepEqual(runway.ends[0].end,runway.ends[1].threshold);
  assert.deepEqual(runway.ends[1].end,runway.ends[0].threshold);
  assert.equal(runway.source.section,'AD 2.12');
  assert.equal(runway.source.pageEffectiveDate,'19 MAR 2026');
});
