import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {buildEntryTheme} from '../../../scripts/build-entry-theme.mjs';
import {syncProceduralScopeVisuals, verifyProceduralScopeVisuals} from '../../../scripts/sync-procedural-scope-visuals.mjs';

const entryPages = ['instructor-led/index.html','instructor-led/student.html','procedural-beta/index.html','procedural-beta/procedural.html'];
const otherPages = ['qgh.html','single.html','tactical.html','instructor-led/instructor.html','training-centre.html','user-guide.html','instructor-led/training-guide.html','procedural-beta/procedural-guide.html'];

test('shared entry rules follow the generated Pages theme on both training families', async () => {
  const fixture = await mkdtemp(resolve(tmpdir(),'qgh-entry-theme-'));
  try {
    const source = resolve(fixture,'source'), output = resolve(fixture,'output');
    await mkdir(resolve(source,'packages/site-landing'),{recursive:true});
    await writeFile(resolve(source,'packages/site-landing/flow-theme.css'),'/* generated theme */');
    await writeFile(resolve(source,'packages/site-landing/qgh-cloudbreak.png'),'fixture');
    for (const page of [...entryPages,...otherPages]) {
      await mkdir(dirname(resolve(output,page)),{recursive:true});
      const entryStyle = entryPages.includes(page) ? '<link rel="stylesheet" href="suite-entry.css?v=0.2.13-beta.1">' : '';
      await writeFile(resolve(output,page),`<html><head>${entryStyle}<link rel="stylesheet" href="workspace.css"></head><body><main>Fixture</main></body></html>`);
    }
    await buildEntryTheme(output,source,'2026.10.07.1');
    for (const page of entryPages) {
      const html = await readFile(resolve(output,page),'utf8');
      assert.equal((html.match(/href="suite-entry\.css/g)||[]).length,1,`${page}: one shared entry stylesheet`);
      assert.ok(html.indexOf('flow-theme.css?release=2026.10.07.1') < html.indexOf('suite-entry.css?v=0.2.13-beta.1'),`${page}: final entry layout wins the cascade`);
      assert.ok(html.indexOf('suite-entry.css?v=0.2.13-beta.1') < html.indexOf('</head>'),`${page}: entry rules remain in the head`);
    }
    const single = await readFile(resolve(output,'single.html'),'utf8');
    assert.ok(!single.includes('suite-entry.css'),'individual exercise has no entry overrides');
  } finally { await rm(fixture,{recursive:true,force:true}); }
});

test('Procedural uses an exact managed copy of the canonical scope helper', async () => {
  const fixture = await mkdtemp(resolve(tmpdir(),'qgh-scope-copy-'));
  try {
    const canonical = resolve(fixture,'packages/qgh-engine/scope-visuals.js');
    const managed = resolve(fixture,'packages/procedural-beta/static/scope-visuals.js');
    await mkdir(dirname(canonical),{recursive:true});
    await writeFile(canonical,'/* canonical v1 */');
    await assert.rejects(verifyProceduralScopeVisuals(fixture),/Missing Procedural scope-visuals/);
    await syncProceduralScopeVisuals(fixture);
    await verifyProceduralScopeVisuals(fixture);
    assert.equal(await readFile(managed,'utf8'),'/* canonical v1 */');
    await writeFile(canonical,'/* canonical v2 */');
    await assert.rejects(verifyProceduralScopeVisuals(fixture),/differs from its QGH source/);
    await syncProceduralScopeVisuals(fixture);
    assert.equal(await readFile(managed,'utf8'),'/* canonical v2 */');
    const repositoryRoot = resolve(import.meta.dirname,'../../..');
    for (const script of ['Sync-WebAssets.ps1','Verify-WebAssets.ps1']) {
      assert.ok((await readFile(resolve(repositoryRoot,'scripts',script),'utf8')).includes("'scope-visuals.js'"),`${script}: future native asset sync includes the canonical helper`);
    }
  } finally { await rm(fixture,{recursive:true,force:true}); }
});

test('built entry pages keep one Prepare your position label in shared and legacy markup', async () => {
  const fixture = await mkdtemp(resolve(tmpdir(),'qgh-entry-label-'));
  try {
    const source = resolve(fixture,'source'), output = resolve(fixture,'output');
    const repositoryRoot = resolve(import.meta.dirname,'../../..');
    await mkdir(resolve(source,'packages/site-landing'),{recursive:true});
    await writeFile(resolve(source,'packages/site-landing/flow-theme.css'),'/* generated theme */');
    await writeFile(resolve(source,'packages/site-landing/qgh-cloudbreak.png'),'fixture');
    const procedural = await readFile(resolve(repositoryRoot,'packages/procedural-beta/static/procedural.html'),'utf8');
    const qgh = await readFile(resolve(repositoryRoot,'packages/atc-suite/index.html'),'utf8');
    for (const page of [...entryPages,...otherPages]) {
      await mkdir(dirname(resolve(output,page)),{recursive:true});
      const entryStyle = entryPages.includes(page) ? '<link rel="stylesheet" href="suite-entry.css">' : '';
      const html = page==='instructor-led/index.html' ? qgh
        : page==='procedural-beta/procedural.html' ? procedural
        : page==='procedural-beta/index.html' ? procedural.replace('<span class="eyebrow">PREPARE YOUR POSITION</span>','')
        : `<html><head>${entryStyle}</head><body><main>Fixture</main></body></html>`;
      await writeFile(resolve(output,page),html);
    }
    await buildEntryTheme(output,source,'2026.10.07.1');
    for (const page of ['instructor-led/index.html','procedural-beta/index.html','procedural-beta/procedural.html']) {
      const html = await readFile(resolve(output,page),'utf8');
      assert.equal((html.match(/PREPARE YOUR POSITION/g)||[]).length,1,`${page}: one role-card introduction`);
    }
  } finally { await rm(fixture,{recursive:true,force:true}); }
});
