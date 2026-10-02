import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {releaseQueryGuard, versionHostedAssets} from '../../../scripts/version-hosted-assets.mjs';

const root = resolve(import.meta.dirname, '../../..');
const revision = '2026.10.03.5';
const base = 'https://training.example/qgh-voice/';

test('hosted pages and nested runtime dependencies load one release while room identity and verified packs stay stable', async () => {
  const output = await mkdtemp(join(tmpdir(), 'qgh-hosted-assets-'));
  const fixture = {
    'index.html': '<link rel="stylesheet" href="flow-theme.css?release=2026.10.03.4"><script src="app.js?v=5.0.5&amp;release=5.0.5"></script><script src="https://cdn.example/app.js"></script><a href="user-guide.html#instructor">Guide</a>',
    'flow-theme.css': 'body{color:white}',
    'app.js': "const appVersion = fetch('app-version.json', {cache:'no-cache'}); const missing = './missing.js'; const api = '/api/procedural/state'; const pack = 'pilot-voices/manifest.json'; const model = './vendor/pilot-tts/model.wasm'; const vosk = './vendor/vosk.js'; const dependency = require('./core.js');",
    'core.js': 'globalThis.Core = {};',
    'app-version.json': '{"version":"5.0.5"}',
    'user-guide.html': '<p>Guide</p>',
    'service-worker.js': "const APP_SHELL = ['./app.js', './flow-theme.css'];",
    'vendor/vosk.js': 'globalThis.Vosk = {};',
    'vendor/pilot-tts/runtime.mjs': "const binary = 'model.wasm';",
    'vendor/pilot-tts/model.wasm': 'verified-model',
    'pilot-voices/manifest.json': '{"version":"verified-pack"}',
    'instructor-led/student.html': '<link href="../flow-theme.css?release=old" rel="stylesheet"><link href="scope-workspace.css?v=0.2.9-beta.1" rel="stylesheet"><script src="suite-student.js?v=0.2.9-beta.1"></script>',
    'instructor-led/suite-student.js': "import './student-plotting.js'; import('./student-plotting.js').then(ready); const stylesheet = '../procedural-beta/student-plotting.css';",
    'instructor-led/scope-workspace.css': 'canvas{min-height:200px}',
    'instructor-led/student-plotting.js': 'export const ready = true;',
    'instructor-led/service-worker.js': "const APP_SHELL = ['./suite-student.js'];",
    'procedural-beta/procedural.html': '<script type="module" src="browser-client.js"></script><link href="scope-workspace.css" rel="stylesheet">',
    'procedural-beta/browser-client.js': "import './remote-service.js'; const url = new URL('browser-worker.js', import.meta.url); url.searchParams.set('room', roomId); const worker = new SharedWorker(url, {name:`qgh-procedural-${roomId}`}); await import('./procedural.js');",
    'procedural-beta/browser-worker.js': "importScripts('wasm_exec.js', 'browser-room-registry.js'); const engine = await fetch('procedural-engine.wasm');",
    'procedural-beta/remote-service.js': 'export const service = true;',
    'procedural-beta/procedural.js': "import {ready} from './chart-workshop.js?v=1#module';",
    'procedural-beta/chart-workshop.js': "import './chart-geometry.js'; for (const href of ['airspace-preparation.css','student-plotting.css']) addStylesheet(href); const catalogues = ['india-airspace.json','india-aip-enroute.json'].map(path=>fetch(path));",
    'procedural-beta/chart-geometry.js': 'export const geometry = true;',
    'procedural-beta/airspace-preparation.css': 'button{color:teal}',
    'procedural-beta/student-plotting.css': '.estimate{color:violet}',
    'procedural-beta/scope-workspace.css': 'canvas{min-height:200px}',
    'procedural-beta/india-airspace.json': '{"bases":[]}',
    'procedural-beta/india-aip-enroute.json': '{"routes":[]}',
    'procedural-beta/wasm_exec.js': 'globalThis.Go = class {};',
    'procedural-beta/browser-room-registry.js': 'globalThis.Registry = {};',
    'procedural-beta/procedural-engine.wasm': 'engine',
  };
  try {
    for (const [path, value] of Object.entries(fixture)) {
      await mkdir(dirname(join(output,path)), {recursive:true});
      await writeFile(join(output,path), value);
    }
    await versionHostedAssets(output, revision);
    const read = path => readFile(join(output,path),'utf8');
    const home = await read('index.html');
    assert.ok(home.includes(`href="flow-theme.css?release=${revision}"`));
    assert.ok(home.includes(`src="app.js?v=5.0.5&amp;release=${revision}"`));
    assert.ok(home.includes('src="https://cdn.example/app.js"'));
    assert.ok(home.includes('href="user-guide.html#instructor"'));
    const student = await read('instructor-led/student.html');
    assert.ok(student.includes(`href="scope-workspace.css?v=0.2.9-beta.1&amp;release=${revision}"`));
    assert.ok(student.includes(`href="../flow-theme.css?release=${revision}"`));
    assert.ok(student.includes(`src="suite-student.js?v=0.2.9-beta.1&amp;release=${revision}"`));
    const instructorScript = await read('instructor-led/suite-student.js');
    assert.ok(instructorScript.includes(`import './student-plotting.js?release=${revision}'`));
    assert.ok(instructorScript.includes(`import('./student-plotting.js?release=${revision}')`));
    assert.ok(instructorScript.includes(`'../procedural-beta/student-plotting.css?release=${revision}'`));
    const client = await read('procedural-beta/browser-client.js');
    assert.ok(client.includes(`import './remote-service.js?release=${revision}'`));
    assert.ok(client.includes(`await import('./procedural.js?release=${revision}')`));
    assert.ok(client.includes("new URL('browser-worker.js', import.meta.url)"), 'entry URL remains stable for active rooms');
    assert.ok(client.includes('name:`qgh-procedural-${roomId}`'), 'named room identity is unchanged');
    const worker = await read('procedural-beta/browser-worker.js');
    assert.ok(worker.includes(`importScripts('wasm_exec.js?release=${revision}', 'browser-room-registry.js?release=${revision}')`));
    assert.ok(worker.includes(`fetch('procedural-engine.wasm?release=${revision}')`));
    assert.ok((await read('procedural-beta/procedural.js')).includes(`'./chart-workshop.js?v=1&release=${revision}#module'`));
    const catalogue = await read('procedural-beta/chart-workshop.js');
    for (const path of ['chart-geometry.js','airspace-preparation.css','student-plotting.css','india-airspace.json','india-aip-enroute.json']) assert.ok(catalogue.includes(`${path}?release=${revision}`), path);
    const app = await read('app.js');
    assert.ok(app.includes(`fetch('app-version.json?release=${revision}'`));
    assert.ok(app.includes(`'./vendor/vosk.js?release=${revision}'`));
    for (const reference of ["'./missing.js'", "'/api/procedural/state'", "'pilot-voices/manifest.json'", "'./vendor/pilot-tts/model.wasm'", "require('./core.js')"]) assert.ok(app.includes(reference), reference);
    for (const path of ['service-worker.js','instructor-led/service-worker.js','vendor/pilot-tts/runtime.mjs','vendor/pilot-tts/model.wasm','pilot-voices/manifest.json','procedural-beta/procedural-engine.wasm']) assert.equal(await read(path), fixture[path], path+' retains its bytes');
    const firstPass = await Promise.all(Object.keys(fixture).map(read));
    await versionHostedAssets(output,revision);
    assert.deepEqual(await Promise.all(Object.keys(fixture).map(read)), firstPass, 'repeat builds do not duplicate queries');
  } finally {
    await rm(output,{recursive:true,force:true});
  }
});

async function shellHarness(kind, currentRevision = revision) {
  const isRoot = kind === 'root';
  const scope = isRoot ? base : base+'instructor-led/';
  const version = isRoot ? '5.0.5' : '0.2.9-beta.1';
  const template = await readFile(resolve(root,isRoot?'apps/web/static/service-worker.js':'apps/suite-web/static/service-worker.js'),'utf8');
  const proc = isRoot ? './procedural-beta/' : '../procedural-beta/';
  const paths = ['scope-workspace.css','chart-workshop.js','procedural-engine.wasm','india-airspace.json','browser-worker.js','service-worker.js'].map(path=>proc+path);
  paths.push('../flow-theme.css','./pilot-voices/manifest.json','./vendor/pilot-tts/model.wasm');
  let source = template.replaceAll(isRoot?'__QGH_VERSION__':'__ATC_SUITE_VERSION__',version)
    .replace('const APP_SHELL = [', 'const APP_SHELL = [\n'+paths.map(path=>`  '${path}',`).join('\n'));
  source = source.replace('  if (requestUrl.search) {', `  ${releaseQueryGuard(currentRevision)}\n  if (requestUrl.search && !isSuiteAsset) {`);
  const handlers = new Map(), matches = [], cache = {match:async request=>{matches.push(request.url);return new Response('cached current shell');}};
  const context = vm.createContext({URL,Request,Response,Set,Promise,
    caches:{open:async()=>cache},
    self:{location:{origin:'https://training.example'},registration:{scope},addEventListener:(name,fn)=>handlers.set(name,fn)}});
  const key = vm.runInContext(source+'; shellCacheKey',context);
  return {key,fetch:handlers.get('fetch'),matches,scope,version,proc};
}

for (const kind of ['root','instructor']) {
  test(`${kind} worker serves only the current release-qualified runtime from canonical offline keys`, async () => {
    const harness = await shellHarness(kind);
    for (const filename of ['scope-workspace.css','chart-workshop.js','procedural-engine.wasm','india-airspace.json']) {
      const canonical = new URL(harness.proc+filename,harness.scope).href;
      for (const query of [`release=${revision}`,`v=${harness.version}&release=${revision}`,`release=${revision}&v=${harness.version}`]) {
        assert.equal(harness.key(new Request(canonical+'?'+query)).url, canonical);
      }
      let response;
      harness.fetch({request:new Request(canonical+'?release='+revision),respondWith:promise=>{response=promise;}});
      assert.equal(await (await response).text(),'cached current shell');
      assert.equal(harness.matches.at(-1),canonical);
    }
    const canonical = new URL(harness.proc+'scope-workspace.css',harness.scope).href;
    for (const query of ['release=2026.10.03.4','release=2026.10.03.6',`release=${revision}&token=hidden`,`release=${revision}&release=${revision}`,`release=${revision}&v=wrong`,`release=${revision}&v=${harness.version}&v=${harness.version}`]) assert.equal(harness.key(new Request(canonical+'?'+query)),null,query);
    for (const path of [harness.proc+'browser-worker.js',harness.proc+'service-worker.js','./pilot-voices/manifest.json','./vendor/pilot-tts/model.wasm','./instructor.html','./index.html']) assert.equal(harness.key(new Request(new URL(path+'?release='+revision,harness.scope))),null,path);
    assert.equal(harness.key(new Request(new URL('./api/session?release='+revision,harness.scope))),null);
    assert.equal(harness.key(new Request('https://backend.example/session?release='+revision)),null);
    assert.equal(harness.key(new Request(canonical+'?release='+revision,{method:'POST'})),null);
    const previous = await shellHarness(kind,'2026.10.03.4');
    assert.equal(previous.key(new Request(canonical+'?release='+revision)),null,'an older worker yields the new release to the network');
  });
}

test('hosted qualification runs after the final generated content and both worker guards use it', async () => {
  const build = await readFile(resolve(root,'scripts/build-procedural-beta.mjs'),'utf8');
  assert.equal((build.match(/\$\{releaseQueryGuard\(manifest\.version\)\}/g)||[]).length,2);
  assert.ok(build.indexOf('await versionHostedAssets(outputRoot, manifest.version)')>build.indexOf('await buildInstalledBrand(outputRoot, root)'));
  assert.throws(()=>releaseQueryGuard("x';attack()//"),/Invalid hosted asset revision/);
});
