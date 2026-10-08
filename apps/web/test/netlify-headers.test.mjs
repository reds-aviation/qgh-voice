import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const headers=readFileSync(new URL('../static/_headers',import.meta.url),'utf8');
const config=readFileSync(new URL('../../../packages/procedural-beta/static/remote-config.js',import.meta.url),'utf8');
const endpoint=config.match(/https:\/\/[a-z0-9-]+\.supabase\.co/)?.[0];
assert.ok(endpoint,'The configured online-service origin is present');
// Netlify documents :placeholders as matching one path segment (never /) and
// combines repeated headers. Check every applicable policy, not only the last.
// https://docs.netlify.com/manage/routing/headers/
function policies(path) {
  const pathname=new URL(path,'https://simulator.test').pathname, matching=[];
  let pattern='';
  for(const line of headers.split(/\r?\n/)) {
    if(!line.trim() || line.trim().startsWith('#'))continue;
    if(!/^\s/.test(line)){pattern=line.trim();continue;}
    const csp=line.match(/^\s+Content-Security-Policy:\s*(.+)$/i);if(!csp)continue;
    const expression=pattern.split('/').map(segment=>segment.startsWith(':')?'[^/]+':segment.split('*').map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')).join('/');
    if(new RegExp('^'+expression+'$').test(pathname))matching.push(csp[1]);
  }
  return matching.map(policy=>new Map(policy.split(';').map(directive=>directive.trim().split(/\s+/)).filter(([name])=>name).map(([name,...values])=>[name,values])));
}
const canConnect=(list,origin)=>list.length>0 && list.every(policy=>(policy.get('connect-src') || policy.get('default-src') || []).includes(origin));

test('Netlify online desk documents can connect to the exact configured service under every matching CSP',()=>{
  for(const path of ['/instructor-led/','/instructor-led/instructor.html?release=1.0.0','/instructor-led/student.html','/procedural-beta/','/procedural-beta/procedural.html?release=1.0.0']) {
    const list=policies(path);assert.equal(list.length,1,`${path}: one scoped policy avoids a restrictive global policy intersection`);
    assert.equal(canConnect(list,endpoint),true,`${path}: configured online service is allowed`);
    assert.equal(canConnect(list,'https://unconfigured.supabase.co'),false,`${path}: other projects stay blocked`);
    assert.deepEqual(list[0].get('connect-src'),["'self'",endpoint]);
    assert.deepEqual(list[0].get('worker-src'),["'self'",'blob:']);
    assert.deepEqual(list[0].get('object-src'),["'none'"]);
  }
});

test('Netlify Individual Practice, offline voice assets and root worker remain same-origin only',()=>{
  for(const path of ['/','/qgh.html','/single.html','/tactical.html','/offline-voice-engine.js','/pilot-voice-worker.js','/vendor/vosk-browser-0.0.8.js','/voice-models/qgh-vosk-en-us-small-0.15.tar.gz','/pilot-voices/manifest.json','/service-worker.js']) {
    const list=policies(path);assert.ok(list.length>0,`${path}: protected by a response CSP`);
    assert.equal(canConnect(list,"'self'"),true,`${path}: local assets remain usable`);
    assert.equal(canConnect(list,endpoint),false,`${path}: Individual voice cannot connect to the online service`);
    for(const policy of list)assert.deepEqual(policy.get('connect-src'),["'self'"]);
  }
  assert.doesNotMatch(headers,/^\s+!\s+/m,'Use documented nonoverlapping Netlify paths rather than unsupported header-unset directives');
});
