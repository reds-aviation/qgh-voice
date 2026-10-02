import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');

test('Pages package: guide links, assets, unique IDs and safe offline room routes',async()=>{
  execFileSync(process.execPath,['scripts/build-web.mjs'],{cwd:root,env:{...process.env,QGH_PROCEDURAL_BETA:'1'},stdio:'pipe'});
  const dist=resolve(root,'apps/web/dist');
  const base='https://example.test/qgh-voice/';
  const release=JSON.parse(readFileSync(resolve(root,'packages/procedural-beta/manifest.json'),'utf8')).version;
  for(const file of ['offline-setup.html','offline-setup.md','offline-guide.css']) assert.equal(existsSync(resolve(dist,file)),false,'private handbook must not be published');
  const pages=['index.html','qgh.html','single.html','tactical.html','training-centre.html','user-guide.html','instructor-led/index.html','instructor-led/instructor.html','instructor-led/student.html','instructor-led/training-guide.html','procedural-beta/index.html','procedural-beta/procedural.html','procedural-beta/procedural-guide.html'];
  for(const page of pages) {
    const html=readFileSync(resolve(dist,page),'utf8'),{document}=parseHTML(html),ids=[...document.querySelectorAll('[id]')].map(el=>el.id);
    assert.equal(new Set(ids).size,ids.length,`duplicate ID in ${page}`);
    assert.ok(!html.includes('offline-setup'), `private handbook link in ${page}`);
    if(!['instructor-led/training-guide.html','procedural-beta/procedural-guide.html'].includes(page))assert.ok(html.includes('suite-guide-chat.js'),`missing Gyani in ${page}`);
    assert.ok(!html.includes('entry-theme.css'),`deferred theme included in ${page}`);
    if(['qgh.html','single.html','tactical.html'].includes(page))assert.ok(!html.includes('guided-familiarisation.js'),`${page}: legacy tour must not compete with the shared suite tour`);
    if(['single.html','tactical.html'].includes(page))assert.ok(html.includes('suite-tour.js'),`${page}: shared tour is available`);
    for(const el of document.querySelectorAll('script[src],link[href],img[src],a[href]')) {
      const value=el.getAttribute('src') || el.getAttribute('href');
      if(!value || value.startsWith('#')) continue;
      const url=new URL(value,new URL(page,base));
      if(!url.href.startsWith(base)) continue;
      const path=decodeURIComponent(url.pathname.slice('/qgh-voice/'.length));
      assert.ok(existsSync(resolve(dist,path.endsWith('/')?path+'index.html':path)),`${page}: missing ${value}`);
      if ((el.tagName === 'SCRIPT' || (el.tagName === 'LINK' && el.getAttribute('rel') === 'stylesheet')) && /\.(?:css|m?js)$/.test(path) && !/(?:^|\/)(?:service-worker|browser-worker)\.js$/.test(path) && !/^(?:pilot-voices\/|vendor\/pilot-tts\/)/.test(path)) {
        assert.equal(url.searchParams.get('release'),release,`${page}: runtime ${value} uses this release`);
      }
    }
  }
  for(const page of ['training-centre.html','user-guide.html']) {
    const html=readFileSync(resolve(dist,page),'utf8');assert.equal((html.match(/id="current-flow"/g)||[]).length,1);
    if(page==='user-guide.html')assert.ok(html.includes('I am also learning.'),'common handbook explains Gyani limitations');
    else assert.ok(parseHTML(html).document.querySelector('a[href="user-guide.html#individual"]'),'radio catalogue points to the common handbook');
  }
  for(const [page,anchor] of [['instructor-led/training-guide.html','instructor'],['procedural-beta/procedural-guide.html','procedural']]) {
    const {document}=parseHTML(readFileSync(resolve(dist,page),'utf8'));
    const destination=`../user-guide.html#${anchor}`;
    assert.equal(document.querySelector('meta[http-equiv="refresh"]').getAttribute('content'),`0;url=${destination}`);
    assert.equal(document.querySelector('link[rel="canonical"]').getAttribute('href'),'../user-guide.html');
    assert.ok(document.querySelector(`a[href="${destination}"]`),`${page}: usable redirect fallback`);
    const {document:common}=parseHTML(readFileSync(resolve(dist,'user-guide.html'),'utf8'));
    assert.ok(common.getElementById(anchor),`${page}: common guide destination exists`);
    assert.ok([...common.querySelectorAll('script[src]')].some(script => new URL(script.getAttribute('src'),base).pathname === '/qgh-voice/procedural-beta/suite-guide-chat.js'),`${page}: common guide has Gyani`);
    assert.equal(document.querySelectorAll('#current-flow').length,0,`${page}: no competing handbook`);
  }
  const context=vm.createContext({URL,Request,Response,console,self:{registration:{scope:base},location:{origin:'https://example.test'},addEventListener(){}}});
  const sw=vm.runInContext(readFileSync(resolve(dist,'service-worker.js'),'utf8')+';({APP_SHELL,shellCacheKey})',context);
  assert.equal(new Set(sw.APP_SHELL).size,sw.APP_SHELL.length,'duplicate precache URL');
  for(const path of sw.APP_SHELL) assert.ok(existsSync(resolve(dist,path.endsWith('/')?path+'index.html':path)),`missing precache ${path}`);
  const worker=new URL('procedural-beta/browser-worker.js?room=12345678-1234-1234-1234-123456789abc',base);
  assert.equal(sw.shellCacheKey(new Request(worker)).url,new URL('procedural-beta/browser-worker.js',base).href);
  assert.ok(sw.shellCacheKey(new Request(new URL('procedural-beta/procedural.html?position=student&connection=online',base))));
  assert.equal(sw.shellCacheKey(new Request(new URL('procedural-beta/procedural.html?untrusted=1',base))),null);
  assert.equal(sw.shellCacheKey(new Request('https://example.supabase.co/rest/v1/rpc/atc_session')),null);
  assert.equal(sw.shellCacheKey(new Request(new URL('flow-theme.css?release='+release,base))).url,new URL('flow-theme.css',base).href);
  assert.equal(sw.shellCacheKey(new Request(new URL('flow-theme.css?release=untrusted',base))),null);
  for(const file of ['service-worker.js','instructor-led/service-worker.js']) {
    const handlers=new Map();let requests,installation;
    const workerScope=new URL(file,base).href.replace('service-worker.js','');
    const installContext=vm.createContext({URL,Request,Response,console,
      caches:{open:async()=>({addAll:async values=>{requests=values;}})},
      self:{registration:{scope:workerScope},location:{origin:'https://example.test'},addEventListener:(name,fn)=>handlers.set(name,fn)}});
    vm.runInContext(readFileSync(resolve(dist,file),'utf8'),installContext);
    handlers.get('install')({waitUntil:value=>{installation=value;}});await installation;
    assert.ok(requests.length>10);
    assert.ok(requests.every(request=>request.cache==='reload'),`${file} must not precache stale HTTP responses`);
  }
});
