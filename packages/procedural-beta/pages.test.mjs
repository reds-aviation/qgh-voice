import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');

test('Pages package: guide links, assets, unique IDs and safe offline room routes',()=>{
  execFileSync(process.execPath,['scripts/build-web.mjs'],{cwd:root,env:{...process.env,QGH_PROCEDURAL_BETA:'1'},stdio:'pipe'});
  const dist=resolve(root,'apps/web/dist');
  const base='https://example.test/qgh-voice/';
  const pages=['index.html','qgh.html','single.html','tactical.html','training-centre.html','user-guide.html','instructor-led/index.html','instructor-led/instructor.html','instructor-led/student.html','instructor-led/training-guide.html','procedural-beta/index.html','procedural-beta/procedural.html','procedural-beta/procedural-guide.html'];
  for(const page of pages) {
    const html=readFileSync(resolve(dist,page),'utf8'),{document}=parseHTML(html),ids=[...document.querySelectorAll('[id]')].map(el=>el.id);
    assert.equal(new Set(ids).size,ids.length,`duplicate ID in ${page}`);
    assert.ok(html.includes('suite-guide-chat.js'),`missing Gyani in ${page}`);
    assert.ok(!html.includes('entry-theme.css'),`deferred theme included in ${page}`);
    for(const el of document.querySelectorAll('script[src],link[href],img[src],a[href]')) {
      const value=el.getAttribute('src') || el.getAttribute('href');
      if(!value || value.startsWith('#')) continue;
      const url=new URL(value,new URL(page,base));
      if(!url.href.startsWith(base)) continue;
      const path=decodeURIComponent(url.pathname.slice('/qgh-voice/'.length));
      assert.ok(existsSync(resolve(dist,path.endsWith('/')?path+'index.html':path)),`${page}: missing ${value}`);
    }
  }
  for(const page of ['training-centre.html','user-guide.html','instructor-led/training-guide.html','procedural-beta/procedural-guide.html']) {
    const html=readFileSync(resolve(dist,page),'utf8');assert.equal((html.match(/id="current-flow"/g)||[]).length,1);
    assert.ok(html.includes('I am also learning.'));
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
});
