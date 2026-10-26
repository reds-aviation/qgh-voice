/* ATS SIM BOX — Copyright (c) 2026 Balaram Reddy. CPAL-1.0; see LICENSE. */
(function exposePublishedAirspace(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ATSPublishedAirspace = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function createPublishedAirspace(root) {
  'use strict';
  const EXCLUDED = new Set(['sirsa', 'jamnagar']);
  const LAYERS = Object.freeze({lfa:'Selected LFA',arp:'ARP',runways:'Published runway / thresholds',atsRoutes:'ATS routes & points',controlledAirspace:'Controlled airspace',specialUse:'P / R / D / TRA / TSA',internationalBoundary:'International Boundary (IB)'});
  const MAX_BYTES = 52 * 1024;
  const rad = Math.PI / 180, earthNm = 3440.065;
  const text = (value, length = 2000) => typeof value === 'string' && !value.includes('\0') && value.length <= length ? value : '';
  const sourceText = source => typeof source === 'string' ? source : [source?.authority,source?.title,source?.section,source?.effectiveDate||source?.pageEffectiveDate].filter(Boolean).join(' · ');
  const sourceURL = source => typeof source === 'string' && /^https:\/\//.test(source) ? source : source?.url || '';
  function geo(value) {
    if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || Math.abs(value.latitude) > 85 || Math.abs(value.longitude) > 180) throw new Error('Published chart has invalid geographic coordinates.');
    return {latitude:value.latitude,longitude:value.longitude};
  }
  function project(point, origin) {
    point = geo(point); origin = geo(origin);
    const p = point.latitude * rad, o = origin.latitude * rad, dl = (point.longitude-origin.longitude)*rad;
    const h = Math.sin((p-o)/2)**2 + Math.cos(o)*Math.cos(p)*Math.sin(dl/2)**2;
    const distance = 2*earthNm*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
    const bearing = Math.atan2(Math.sin(dl)*Math.cos(p),Math.cos(o)*Math.sin(p)-Math.sin(o)*Math.cos(p)*Math.cos(dl));
    return {xNm:distance*Math.sin(bearing),yNm:distance*Math.cos(bearing)};
  }
  function vertices(area) {
    if (!area.circle) return (area.points || []).map(geo);
    const c = geo(area.circle), d = area.circle.radiusNm/earthNm;
    if (!Number.isFinite(d) || d <= 0 || d > 1000/earthNm) throw new Error('Invalid published circle radius.');
    // A sampled display of the published circle definition, not an inferred boundary.
    return Array.from({length:72},(_,i)=>{
      const p=c.latitude*rad,l=c.longitude*rad,b=i*5*rad;
      const latitude=Math.asin(Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(b));
      const longitude=l+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(latitude));
      return {latitude:latitude/rad,longitude:((longitude/rad+540)%360)-180};
    });
  }
  const extent = points => ({minX:Math.min(...points.map(p=>p.xNm)),maxX:Math.max(...points.map(p=>p.xNm)),minY:Math.min(...points.map(p=>p.yNm)),maxY:Math.max(...points.map(p=>p.yNm))});
  const overlaps = (a,b) => a.minX<=b.maxX && a.maxX>=b.minX && a.minY<=b.maxY && a.maxY>=b.minY;
  const layerForArea = (area,lfaId) => area.id===lfaId ? 'lfa' : area.kind==='control-zone' ? 'controlledAirspace' : 'specialUse';
  function bases(data) { return (data.catalogue?.airbases || []).filter(b=>!EXCLUDED.has(String(b.id).toLowerCase())); }
  function buildSelection(data, baseId, lfaId, visibility = {}) {
    const base = bases(data).find(b=>b.id===baseId);
    if (!base) throw new Error('Select an available airbase.');
    const entry = (base.lfaEntries || []).find(l=>l.id===lfaId);
    if (!entry) throw new Error('Select an LFA associated with this airbase.');
    const ref=entry.geometryRef;
    const item=(data.airspace?.aerodromes || data.airspace || []).find(b=>b.id===(ref?.baseId || base.id));
    if (!ref || !item || !Number.isInteger(ref.areaIndex) || !item.areas?.[ref.areaIndex]) throw new Error('This published LFA is listed, but usable boundary / ARP geometry is unavailable. See the source and gaps.');
    const rawLfa=item.areas[ref.areaIndex], lfaID=rawLfa.id || `${item.id.toLowerCase()}-${ref.areaIndex+1}`;
    const localLfa=vertices(rawLfa).map(p=>project(p,item.origin)), box=extent(localLfa);
    const nearby={minX:box.minX-20,maxX:box.maxX+20,minY:box.minY-20,maxY:box.maxY+20};
    const allAreas=[...item.areas,...(data.enroute?.aerodromes?.[item.id]?.areas || [])].map((a,i)=>({...a,id:a.id || `${item.id.toLowerCase()}-${i+1}`}));
    const otherLfas=new Set((base.lfaEntries || []).filter(e=>e.id!==entry.id && e.geometryRef?.baseId===item.id).map(e=>item.areas[e.geometryRef.areaIndex]?.id || `${item.id.toLowerCase()}-${e.geometryRef.areaIndex+1}`));
    const areas=allAreas.filter(a=>!otherLfas.has(a.id) && (a.id===lfaID || overlaps(extent(vertices(a).map(p=>project(p,item.origin))),nearby)));
    const extra=data.enroute?.aerodromes?.[item.id] || {routes:[],fixes:[],areas:[],omissions:[]};
    const fixByName=new Map(extra.fixes.map(f=>[f.name,f]));
    const routes=extra.routes.filter(r=>{
      const points=r.fixNames.map(name=>fixByName.get(name));
      if (points.some(p=>!p)) return false;
      return points.slice(1).some((p,i)=>overlaps(extent([project(points[i],item.origin),project(p,item.origin)]),nearby));
    });
    const fixNames=new Set(routes.flatMap(r=>r.fixNames)), fixes=extra.fixes.filter(f=>fixNames.has(f.name));
    const available={lfa:true,arp:true,runways:!!base.runways?.length,atsRoutes:!!routes.length,controlledAirspace:areas.some(a=>a.kind==='control-zone'),specialUse:areas.some(a=>a.id!==lfaID && a.kind!=='control-zone'),internationalBoundary:!!base.referenceBoundaries?.length};
    const layerVisibility=Object.fromEntries(Object.keys(LAYERS).map(key=>[key,available[key] && visibility[key]!==false]));
    return {base,entry,item,extra:{...extra,routes,fixes,areas:[]},areas,routes,fixes,lfaId:lfaID,available,layerVisibility,
      extentNote:'Nearby selection: the selected LFA envelope plus 20 NM. Complete source route sections and boundary vertices are retained; coverage may be incomplete.'};
  }
  function publicChart(selection) {
    const {base,entry,item,lfaId,layerVisibility}=selection;
    const sources=[];
    const metadata=record=>{
      const source={source:text(sourceText(record.source || 'India AIP'),500),effectiveInfo:text(record.effectiveInfo || item.effectiveInfo,1000)};
      let sourceIndex=sources.findIndex(s=>JSON.stringify(s)===JSON.stringify(source));if(sourceIndex<0){sourceIndex=sources.length;sources.push(source);}
      return {sourceIndex,reference:text(record.reference || sourceURL(base.source) || item.source,1000)};
    };
    const areas=selection.areas.map(a=>({id:a.id,name:a.name,kind:a.kind,points:vertices(a).map(p=>project(p,item.origin)),floorLabel:a.floorLabel,ceilingLabel:a.ceilingLabel,...metadata(a),notes:[a.notes,a.activation,a.publishedLateralLimits].filter(Boolean).join('\n')}));
    const byName=new Map(selection.fixes.map(f=>[f.name,f]));
    const routes=selection.routes.map(r=>({id:r.id,name:r.name,points:r.fixNames.map(n=>project(byName.get(n),item.origin)),levelLimits:r.levelLimits || '',...metadata(r)}));
    const fixes=selection.fixes.map(f=>({id:f.id,name:f.name,...project(f,item.origin)}));
    const runways=(base.runways || []).map(r=>({id:r.id,name:r.id,widthNm:r.widthM/1852,points:r.ends.map(e=>project(e.threshold,item.origin)),...metadata({source:sourceText(r.source),reference:sourceURL(r.source),effectiveInfo:r.source?.pageEffectiveDate})}));
    return normalizePublishedAirspace({schemaVersion:1,baseId:base.id,baseName:base.officialName,lfaId,lfaName:entry.officialTitle,selectionId:entry.id,origin:item.origin,areas,routes,fixes,runways,layerVisibility,
      sources,referenceBoundaries:base.referenceBoundaries || [],source:sourceText(base.source) || item.source,effectiveInfo:item.effectiveInfo,status:entry.status || 'dated-snapshot',
      gaps:[selection.extentNote,...(entry.geometryNotes ? [sourceText(entry.geometryNotes)] : []),'Static published geometry only. Activation / NOTAM / AUP / UUP is not live. Runway in use remains instructor-set.']});
  }
  function normalizePublishedAirspace(value) {
    if (value == null) return null;
    if (typeof value!=='object' || Array.isArray(value) || value.schemaVersion!==1 || EXCLUDED.has(String(value.baseId).toLowerCase())) throw new Error('Invalid published airspace package.');
    const strictText=(input,limit)=>{if(input==null)return '';if(typeof input!=='string'||input.includes('\0')||input.length>limit)throw new Error('Invalid published chart text.');return input;};
    const result={schemaVersion:1,origin:geo(value.origin),layerVisibility:{}};
    for(const key of ['baseId','baseName','lfaId','lfaName','selectionId','source','effectiveInfo','status']) result[key]=strictText(value[key],2000);
    if(!result.baseId || !result.lfaId || !result.baseName) throw new Error('Published airspace needs a base and selected LFA.');
    if(!Array.isArray(value.sources) || value.sources.length>100) throw new Error('Invalid published source table.');
    result.sources=value.sources.map(s=>({source:strictText(s.source,500),effectiveInfo:strictText(s.effectiveInfo,1000)}));
    for(const key of Object.keys(LAYERS)) {
      if(value.layerVisibility?.[key]!=null && typeof value.layerVisibility[key]!=='boolean') throw new Error('Invalid published layer visibility.');
      result.layerVisibility[key]=value.layerVisibility?.[key]!==false;
    }
    const point=p=>{
      if(!p || !Number.isFinite(p.xNm) || !Number.isFinite(p.yNm) || Math.abs(p.xNm)>2000 || Math.abs(p.yNm)>2000) throw new Error('Invalid published local point.');
      return {xNm:p.xNm,yNm:p.yNm};
    };
    for(const [key,maximum,minPoints] of [['areas',200,3],['routes',100,2],['runways',12,2],['fixes',200,0]]) {
      if(!Array.isArray(value[key]) || value[key].length>maximum) throw new Error(`Invalid published ${key}.`);
      const ids=new Set();
      result[key]=value[key].map(record=>{
        const row={id:strictText(record.id,150),name:strictText(record.name,250)};
        if(!row.id || !row.name || ids.has(row.id)) throw new Error(`Invalid or duplicate published ${key} identity.`); ids.add(row.id);
        if(minPoints) {
          if(!Array.isArray(record.points) || record.points.length<minPoints || record.points.length>500) throw new Error('Invalid published feature vertices.');
          row.points=record.points.map(point);
          for(const field of ['source','reference','effectiveInfo','notes','floorLabel','ceilingLabel','levelLimits']) if(record[field]!=null) row[field]=strictText(record[field],field==='notes'?4000:2000);
          if(!Number.isInteger(record.sourceIndex) || record.sourceIndex<0 || record.sourceIndex>=result.sources.length) throw new Error('Published feature source is missing.');row.sourceIndex=record.sourceIndex;
        } else Object.assign(row,point(record));
        if(key==='areas') {if(!['local-flying','prohibited','restricted','danger','control-zone'].includes(record.kind)) throw new Error('Invalid published area category.');row.kind=record.kind;}
        if(key==='runways') {if(record.points.length!==2 || !Number.isFinite(record.widthNm) || record.widthNm<=0 || record.widthNm>1) throw new Error('Invalid published runway endpoints or width.'); row.widthNm=record.widthNm;}
        return row;
      });
    }
    if(!result.areas.some(a=>a.id===result.lfaId)) throw new Error('Selected LFA boundary is missing.');
    if(value.gaps!=null && (!Array.isArray(value.gaps)||value.gaps.length>30))throw new Error('Invalid published chart gaps.');
    result.gaps=Array.isArray(value.gaps) ? value.gaps.map(g=>strictText(g,2000)).filter(Boolean) : [];
    const boundaries=root.ATSPublishedBoundaries || root.PublishedBoundaries || (typeof require==='function' ? (()=>{try{return require('../../qgh-engine/published-boundaries.js');}catch{return null;}})() : null);
    if(value.referenceBoundaries!=null && !Array.isArray(value.referenceBoundaries)) throw new Error('Invalid published reference boundaries.');
    if(value.referenceBoundaries?.length && !boundaries?.normalizeBoundaries) throw new Error('Verified boundary validation is unavailable.');
    result.referenceBoundaries=value.referenceBoundaries?.length ? boundaries.normalizeBoundaries(value.referenceBoundaries) : [];
    if(new TextEncoder().encode(JSON.stringify(result)).length>MAX_BYTES) throw new Error('This published selection exceeds the 52 KB shared chart limit. Choose a smaller LFA; source geometry has not been simplified.');
    return result;
  }
  async function loadData(baseURL='',fetcher=root.fetch?.bind(root)) {
    const paths=['india-airbase-lfa-catalogue.json','india-airspace.json','india-aip-enroute.json'];
    const [catalogue,airspace,enroute]=await Promise.all(paths.map(async path=>{const response=await fetcher(baseURL+path);if(!response.ok) throw new Error('Published airspace catalogue is unavailable.');return response.json();}));
    return {catalogue,airspace,enroute};
  }
  function createPicker(container,{data,onChange=()=>{},idPrefix='published'}={}) {
    const doc=container.ownerDocument || document;
    const el=(tag,content='',className='')=>{const n=doc.createElement(tag);n.textContent=content;if(className)n.className=className;return n;};
    const label=(name,node)=>{const l=el('label',name);l.setAttribute('for',node.id);node.setAttribute('aria-label',name);l.append(node);return l;};
    const selectOption=(name,value)=>{const o=el('option',name);o.value=value;return o;};
    const search=el('input');search.type='search';search.placeholder='Find an airbase';search.id=`${idPrefix}-search`;
    const baseSelect=el('select');baseSelect.id=`${idPrefix}-base`;
    const lfaSelect=el('select');lfaSelect.id=`${idPrefix}-lfa`;
    const status=el('p','','published-status');status.setAttribute('role','status');
    const layers=el('fieldset','','published-layers');layers.append(el('legend','Visible layers'));
    const featureSelect=el('select');featureSelect.id=`${idPrefix}-feature`;
    const inspect=el('div','','published-inspector');
    const detail=el('details');detail.append(el('summary','Feature details & source'),label('Inspect feature',featureSelect),inspect);
    const notice=el('p','Published geometry is a dated training snapshot. No live NOTAM / AUP / UUP activation. Runway in use is set separately.','published-note');
    container.classList.add('published-airspace-picker');container.append(label('Find airbase',search),label('1 · Airbase',baseSelect),label('2 · Associated LFA',lfaSelect),status,layers,detail,notice);
    let selection=null,visibility={},features=[];
    const showFeature=()=>{
      inspect.replaceChildren();const f=features[Number(featureSelect.value)];if(!f)return;
      const dl=el('dl');
      const rows=[['Name',f.name||f.officialTitle||f.officialName],['Identifier',f.identifier||f.id],['Vertical limits',[f.floorLabel,f.ceilingLabel].filter(Boolean).join(' / ')||f.levelLimits||'Not applicable / see source'],['Lateral definition',f.publishedLateralLimits||f.boundaryDefinition?.publishedText||f.geometryNotes||f.notes||'Coordinates retained from the cited snapshot.'],['Restrictions',f.publishedRestrictions],['Status',sourceText(f.status)||'Dated geometry; current activation not supplied'],['Activation',typeof f.activation==='string'?f.activation:f.activation?.text],['Source',sourceText(f.source)],['Edition / effective date',f.effectiveInfo||f.source?.pageEffectiveDate||sourceText(data.catalogue.sourceEdition)||'See source record'],['Gaps',Array.isArray(f.gaps)?f.gaps.join('\n'):'']];
      for(const [name,value] of rows){if(!value)continue;dl.append(el('dt',name),el('dd',typeof value==='string'?value:JSON.stringify(value)));}inspect.append(dl);
      if(f.layers){
        const coverage=el('ul');
        for(const [key,name] of Object.entries(LAYERS)){
          const layer=f.layers[key],gaps=Array.isArray(layer?.gaps)?layer.gaps.join(' '):layer?.gaps;
          coverage.append(el('li',`${name}: ${gaps || sourceText(layer?.status) || 'See the source record.'}`));
        }
        inspect.append(el('h4','Layer coverage'),coverage);
        if(selection)inspect.append(el('p',selection.extentNote));
      }
      const url=f.reference||sourceURL(f.source);if(/^https:\/\//.test(url)){const a=el('a','Open published source ↗');a.href=url;a.target='_blank';a.rel='noopener';inspect.append(a);}
    };
    const update=()=>{
      layers.replaceChildren(el('legend','Visible layers'));selection=null;features=[];
      const base=bases(data).find(b=>b.id===baseSelect.value),entry=base?.lfaEntries?.find(l=>l.id===lfaSelect.value);
      if(!base){status.textContent='Choose an airbase, then its associated LFA.';lfaSelect.disabled=true;detail.hidden=true;onChange(null);return;}
      lfaSelect.disabled=false;detail.hidden=false;
      if(entry){try{selection=buildSelection(data,base.id,entry.id,visibility);status.textContent=`${entry.officialTitle} · ${selection.routes.length} nearby route sections · ${selection.areas.length} areas`;}catch(error){status.textContent=error.message;}}
      else status.textContent='Choose one published LFA. Only source-verified associations are listed.';
      for(const [key,name] of Object.entries(LAYERS)){
        const input=el('input');input.type='checkbox';input.dataset.layer=key;input.id=`${idPrefix}-layer-${key}`;input.setAttribute('aria-label',name);input.checked=selection?.layerVisibility[key]===true;input.disabled=!selection?.available[key];
        const l=el('label','','published-layer');l.setAttribute('for',input.id);l.append(input,el('span',name));
        if(input.disabled)l.append(el('small',!entry?'Select LFA':key==='internationalBoundary'?'Verified IB data unavailable':'Unavailable · see source details'));
        input.addEventListener('change',()=>{visibility[key]=input.checked;if(selection)selection.layerVisibility[key]=input.checked;onChange(selection);});layers.append(l);
      }
      features=[base,...(entry?[{...entry,name:entry.officialTitle}]:[]),...(selection?.areas||[]),...(selection?.routes||[]),...(base.runways||[])];
      featureSelect.replaceChildren(...features.map((f,i)=>selectOption(f.name||f.officialTitle||f.officialName||f.id,String(i))));showFeature();onChange(selection);
    };
    const populateLfas=(selected='')=>{
      const base=bases(data).find(b=>b.id===baseSelect.value),entries=base?.lfaEntries||[];
      const usable=entries.filter(entry=>entry.geometryRef);
      lfaSelect.replaceChildren(selectOption('Select associated LFA…',''),...entries.map(e=>selectOption(`${e.officialTitle}${e.geometryRef?'':' · geometry unavailable'}`,e.id)));
      lfaSelect.value=selected || (usable.length===1?usable[0].id:'');update();
    };
    const populateBases=()=>{const selected=baseSelect.value,query=search.value.trim().toLocaleLowerCase();baseSelect.replaceChildren(selectOption('Select airbase…',''),...bases(data).filter(b=>!query||[b.officialName,b.icao,...(b.aliases||[])].join(' ').toLocaleLowerCase().includes(query)).map(b=>selectOption(b.officialName+(b.icao?` · ${b.icao}`:''),b.id)));baseSelect.value=selected;if(baseSelect.value!==selected)populateLfas();};
    search.addEventListener('input',populateBases);baseSelect.addEventListener('change',()=>{visibility={};populateLfas();});lfaSelect.addEventListener('change',()=>{visibility={};update();});featureSelect.addEventListener('change',showFeature);
    populateBases();populateLfas();
    return {get:()=>selection,set(baseId,lfaId,shown={}){search.value='';populateBases();baseSelect.value=baseId;visibility={...shown};populateLfas(lfaId);},refresh:update};
  }
  return Object.freeze({LAYERS,MAX_BYTES,bases,buildSelection,publicChart,normalizePublishedAirspace,loadData,createPicker,project,vertices,layerForArea});
});
