/* ATS SIM BOX — Copyright (c) 2026 Balaram Reddy. CPAL-1.0; see LICENSE. */
import './published-airspace.js';
import { coordinate, project } from './chart-geometry.js';
import { mergePublishedNavigation } from './aip-navigation.js';

const aip = 'https://aim-india.aai.aero.in/eaip/eaip-v2-09-2026/eAIP/';
const geo = (latitude, longitude) => ({latitude:coordinate(latitude,'latitude'), longitude:coordinate(longitude,'longitude')});
const polar = (bearing, distance) => ({xNm: distance*Math.sin(bearing*Math.PI/180), yNm: distance*Math.cos(bearing*Math.PI/180)});
const bearing = (from,to) => (Math.atan2(to.xNm-from.xNm,to.yNm-from.yNm)*180/Math.PI+360)%360;
const move = (point, course, distance) => {
    const offset = polar(course, distance);
    return {xNm:point.xNm+offset.xNm,yNm:point.yNm+offset.yNm};
};
const interpolate = (a,b,t) => ({xNm:a.xNm+(b.xNm-a.xNm)*t,yNm:a.yNm+(b.yNm-a.yNm)*t});
const inside = (point, polygon) => polygon.reduce((hit,a,i) => {
    const b=polygon[(i+1)%polygon.length];
    return (a.yNm>point.yNm)!==(b.yNm>point.yNm) && point.xNm < a.xNm+(b.xNm-a.xNm)*(point.yNm-a.yNm)/(b.yNm-a.yNm) ? !hit : hit;
},false);

export const pilotAircraftLimit = 12;

const variants = [
    {id:'overview',title:'Mixed traffic',goal:'Build the traffic picture before issuing instructions.',inbound:[.34,.58],sectors:[29,31]},
    {id:'recovery',title:'Recovery sequence',goal:'Sequence two returning aircraft while keeping the circuit and overflights in view.',inbound:[.43,.58],sectors:[30,32]},
    {id:'circuit',title:'Busy circuit',goal:'Track four circuit aircraft with different speeds while the outside traffic continues.',inbound:[.18,.44],sectors:[28,32],circuit:[.65,.20,.60,.32]},
    {id:'sector',title:'Sector coordination',goal:'Cross-check two sector positions and anticipate convergence with the inbound stream.',inbound:[.28,.52],sectors:[32,28],sectorDirection:1},
    {id:'reciprocal',title:'Reciprocal runway',goal:'Rebuild the circuit and recovery picture for the reciprocal runway.',inbound:[.30,.56],sectors:[30,31],reciprocal:true},
];
const locations = {
    pune: {label:'Pune',icao:'VAPO',lfa:'VAR37',elevation:1943,range:60,sectorBearings:[50,130],runways:['10','28'],
        enroute:[['aip-pune-route-w28-hia-bbb-1','LUKTI','PPN',.26,28000],['aip-pune-route-w28-hia-bbb-1','LUKTI','PPN',.51,30000]],
        inbound:['aip-pune-route-w134-sg-ppn-1','MUBKU','PPN'],inboundLevels:[25000,27000]},
    bagdogra: {label:'Bagdogra',icao:'VEBD',lfa:'VER 82',elevation:414,range:100,sectorBearings:[24,80],runways:['18','36'],
        enroute:[['aip-bagdogra-w105','KHR','LOTPU',.52,13000],['aip-bagdogra-q18','VILEN','LOTPU',.52,31000]],
        inbound:['aip-bagdogra-w137-recovery','OPIMO','BGD'],inboundLevels:[10000,12000]}
};

export const publishedPilotScenarios = Object.freeze(Object.entries(locations).flatMap(([base,location]) =>
    variants.map(variant => ({
        id:base+'-'+variant.id, base, variant, runway:location.runways[variant.reciprocal?1:0],
        title:location.label+' · '+variant.title,
        goal:'Published '+location.icao+' chart · '+location.lfa+'. 4 circuit, 2 sectors about 30 NM out, 2 en route and 2 recovering. '+variant.goal
    }))));

function bagdograChart() {
    const origin = geo('264107N','0881938E');
    const aerodrome = aip+'IN-AD%202.1VEBD-en-GB.html';
    const airspace = aip+'IN-ENR%205.1-en-GB.html';
    const item = {id:'bagdogra',name:'Bagdogra',icao:'VEBD',origin,source:aerodrome,effectiveInfo:'AIP India 09/2026 dated snapshot'};
    const source = {authority:'Airports Authority of India',section:'VEBD AD 2.2 / AD 2.12',url:aerodrome,pageEffectiveDate:'27 NOV 2025'};
    const base = {id:item.id,officialName:item.name,source,runways:[{id:'18/36',widthM:45,lengthM:2744,source,ends:[
        {id:'18',threshold:geo('264137N','0881942E')},{id:'36',threshold:geo('264008N','0881939E')}
    ]}]};
    const entry = {id:'ver82',officialTitle:'VER 82 Bagdogra',status:'dated-snapshot'};
    const area = {id:'bagdogra-ver82',name:'VER 82 Bagdogra · LFA',kind:'local-flying',
        floorLabel:'GND',ceilingLabel:'5000 FT',source:'India AIP ENR 5.1',reference:airspace,effectiveInfo:'03 SEP 2026',
        points:[geo('261202N','0871851E'),geo('261402N','0875650E'),geo('253802N','0875250E'),geo('253302N','0873451E')]};
    const fixes = [
        ['KHR','253653N','0873319E'],['LOTPU','260605N','0875630E'],['BGD','264118N','0881934E'],
        ['VILEN','260041N','0872450E'],['OPIMO','263458N','0885550E']
    ].map(([name,lat,lon])=>({name,id:'aip-bagdogra-fix-'+name.toLowerCase(),...geo(lat,lon)}));
    const routes = [
        ['aip-bagdogra-w105','W105',['KHR','LOTPU','BGD'],'FL085–FL460','3.1'],
        ['aip-bagdogra-q18','Q18',['VILEN','LOTPU','BGD','OPIMO'],'FL290–FL460','3.2'],
        ['aip-bagdogra-w137-recovery','W137',['OPIMO','BGD'],'FL075–FL460','3.1'],
    ].map(([id,designator,fixNames,levelLimits,section])=>({
        id,designator,name:designator,kind:'ats',fixNames,levelLimits,source:'India AIP ENR '+section,
        reference:aip+'IN-ENR%20'+section+designator+'-en-GB.html',effectiveInfo:'23 JAN 2025',
    }));
    return {base,entry,item,areas:[area],fixes,routes,lfaId:area.id,extentNote:'Selected AIP route sections. VER 82 begins about 34 NM from the ARP; ATS transits cross its lateral footprint above the published ceiling.',
        layerVisibility:{lfa:true,arp:true,runways:true,atsRoutes:true,controlledAirspace:false,specialUse:false,internationalBoundary:false}};
}
async function publishedChart(base, loadData) {
    if (base==='bagdogra') return bagdograChart();
    const api=globalThis.ATSPublishedAirspace;
    const full=api.buildSelection(await loadData(),'pune','var37');
    const routeIds = new Set([...locations.pune.enroute.map(plan=>plan[0]),locations.pune.inbound[0]]);
    const routes=full.routes.filter(route=>routeIds.has(route.id));
    const names=new Set(routes.flatMap(route=>route.fixNames));
    return {...full,routes,fixes:full.fixes.filter(fix=>names.has(fix.name)),
        areas:full.areas.filter(area=>area.id===full.lfaId || area.kind==='control-zone'),
        layerVisibility:{...full.layerVisibility,specialUse:false}};
}

const fleet = {
    'Su-30MKI':{speed:180,wake:'medium',turn:4},
    'Tejas':{speed:160,wake:'medium',turn:4},
    'An-32':{speed:145,wake:'medium',turn:3},
    'C-130J':{speed:270,wake:'medium',turn:3},
    'C-17':{speed:340,wake:'heavy',turn:2},
    'Mi-17V-5':{speed:105,wake:'medium',turn:4},
    'ALH Dhruv':{speed:100,wake:'light',turn:4},
};
function makeAircraft(id,callsign,type,point,headingDeg,altitudeFt,routeId,routeIndex,speedKt=fleet[type].speed,altimeterReference='qnh') {
    const p=fleet[type];
    return {id,callsign,type,...point,headingDeg,targetHeadingDeg:headingDeg,speedKt,targetSpeedKt:speedKt,
        altitudeFt,targetAltitudeFt:altitudeFt,altimeterReference,turnRateDegSec:p.turn,verticalRateFpm:1500,
        wakeCategory:p.wake,mode:'route',status:'active',routeId,routeIndex,spawnTime:0,pendingClearances:[],lastFixTimes:{}};
}

export async function createPublishedPilotScenario(id, loadData=() => globalThis.ATSPublishedAirspace.loadData()) {
    const lesson=publishedPilotScenarios.find(s=>s.id===id);
    if (!lesson) throw new Error('Choose an available published traffic scenario.');
    const {base,variant,title}=lesson, site=locations[base];
    const chart=await publishedChart(base,loadData), api=globalThis.ATSPublishedAirspace;
    const published=api.publicChart(chart);
    const {fixes,routes}=mergePublishedNavigation({},chart,chart.item.origin);
    const areas=chart.areas.map(area=>{
        const geoPoints=api.vertices(area);
        const {id,name,kind,floorLabel,ceilingLabel}=area;
        return {id,name,kind,floorLabel,ceilingLabel,points:geoPoints.map(point=>project(point,chart.item.origin)),geoPoints,
            coordinateOrigin:chart.item.origin,active:true,source:area.source || 'India AIP',reference:area.reference || chart.item.source,
            effectiveInfo:area.effectiveInfo || chart.item.effectiveInfo,notes:[area.notes,area.activation].filter(Boolean).join('\n')};
    });
    const [start,end]=variant.reciprocal ? [...published.runways[0].points].reverse() : published.runways[0].points;
    const runway=lesson.runway;
    const course=bearing(start,end), centre=interpolate(start,end,.5);
    const aircraft=[], strips={};
    function add(callsign,type,from,to,fraction,altitude,route,index,note,speed,ref) {
        const id='ac'+(aircraft.length+1);
        aircraft.push(makeAircraft(id,callsign,type,interpolate(from,to,fraction),bearing(from,to),altitude,route,index,speed,ref));
        strips[id]={notes:note};
    }
    function addPattern(id,name,points,loops) {
        const corners=points.map((point,i)=>({id:id+'-'+(i+1),name:name+' '+(i+1),...point}));
        fixes.push(...corners);
        routes.push({id,name,kind:'ats',fixIds:Array.from({length:loops},()=>corners.map(f=>f.id)).flat(),
            active:true,minAltitudeFt:-1500,maxAltitudeFt:60000,source:'ATS SIM BOX training geometry'});
    }
    const near=move(start,course+180,3.1), far=move(end,course,2.7), turnSide=course+90;
    const loop=[near,far,move(far,turnSide,2.8),move(near,turnSide,2.8)];
    addPattern('training-circuit','Training circuit '+runway,loop,9);
    const circuitTypes=['Tejas','Su-30MKI','An-32','ALH Dhruv'];
    const fractions=variant.circuit || [.45,.53,.46,.58];
    for(let i=0;i<4;i++) {
        const next=(i+1)%4;
        add(String(101+i),circuitTypes[i],loop[i],loop[next],fractions[i],site.elevation+(i===3?1100:1500),
            'training-circuit',i+1,['Runway centreline leg','Crosswind','Downwind','Base'][i]+' · RWY '+runway+' · training circuit.');
    }
    site.sectorBearings.forEach((sector,i)=>{
        const point=polar(sector,variant.sectors[i]);
        const direction=(sector+90+(variant.sectorDirection ? 60 : 0))%360;
        const leg=[move(point,direction+180,1.4),move(point,direction,1.4)];
        const loop=[...leg,move(leg[1],direction+90,1.6),move(leg[0],direction+90,1.6)];
        const id='training-sector-'+(i+1);
        addPattern(id,'Training sector '+(i+1),loop,12);
        add(String(201+i),i===0?'Mi-17V-5':'Su-30MKI',...leg,.5,
            base==='bagdogra' ? (i===0?11500:9500) : (i===0?6500:9000),id,1,
            'Sector '+(i+1)+' · '+String(sector).padStart(3,'0')+'°T / '+variant.sectors[i]+' NM from ARP · training sector.');
    });
    const lfa=areas.find(area=>area.id===chart.lfaId);
    function loadLeg([routeId,fromName,toName], passThroughLfa, callsign, type, fraction, altitude, speed) {
        const route=routes.find(route=>route.id===routeId);
        const byId=new Map(fixes.map(fix=>[fix.id,fix]));
        const index=route?.fixIds.findIndex((id,i)=>i>0 && byId.get(id)?.name===toName && byId.get(route.fixIds[i-1])?.name===fromName) ?? -1;
        if (index<1) throw new Error('Published leg '+fromName+' to '+toName+' is unavailable.');
        const from=byId.get(route.fixIds[index-1]), to=byId.get(route.fixIds[index]);
        if (passThroughLfa && !inside(interpolate(from,to,fraction),lfa.points))
            throw new Error('Published leg start is outside the LFA footprint.');
        add(callsign,type,from,to,fraction,altitude,routeId,index,
            (passThroughLfa?'En route · ':'Mission recovery · ')+route.name+' · '+fromName+' to '+toName+
            (passThroughLfa && base==='bagdogra'?' · above VER 82.':'.'),speed,'standard');
    }
    site.enroute.forEach((plan,i)=>loadLeg(plan,true,String(301+i),i===0?'C-130J':'C-17',plan[3],plan[4]));
    site.inboundLevels.forEach((altitude,i)=>loadLeg(site.inbound,false,String(401+i),i===0?'Su-30MKI':'An-32',variant.inbound[i],altitude,i===0?290:200));
    return {version:1,title,mode:'aerodrome',elapsed:0,running:false,terminated:false,aircraft,fixes,routes,areas,strips,
        radio:{phase:'idle'},criteria:[],calls:[],reports:[],events:[],
        environment:{rangeNm:site.range,stationName:'ARP',stationType:'df',aerodromeName:site.label+' ('+site.icao+')',
            chartOrigin:chart.item.origin,chartReference:chart.item.source,effectiveInfo:chart.item.effectiveInfo,publishedAirspace:published,
            briefing:lesson.goal+' Selected runway '+runway+'. Callsigns, circuits and sector activity are fictional training traffic based on a dated AIP chart. No live traffic or activation data.',
            runwayHeadingDeg:course,runwayLengthNm:Math.hypot(end.xNm-start.xNm,end.yNm-start.yNm),runwayCenterXNm:centre.xNm,runwayCenterYNm:centre.yNm,
            aerodromeElevationFt:site.elevation,thresholdCrossingHeightFt:50,qnhHpa:1013.25,magneticVariationKnown:false,trainingMagneticVariationDeg:0,
            dfHoldSeconds:10,separationNm:5,separationFt:1000,separationMinutes:5,map:{widthNm:120,originXPct:50,originYPct:50,opacity:.45}},
        scopeDisplay:{hiddenRouteIds:[],hiddenAreaIds:[],routesHidden:false,areasHidden:false}};
}
