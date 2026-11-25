/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

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
    await writeFile(resolve(source,'packages/site-landing/iaf-theme.css'),'/* IAF theme */');
    await writeFile(resolve(source,'packages/site-landing/qgh-cloudbreak.webp'),'fixture');
    for (const asset of ['exercise-motion.js','suite-appearance.js','suite-appearance.css','appearance-dark.css']) {
      await writeFile(resolve(source,'packages/site-landing',asset),'fixture');
    }
    for (const page of [...entryPages,...otherPages]) {
      await mkdir(dirname(resolve(output,page)),{recursive:true});
      const entryStyle = entryPages.includes(page) ? '<link rel="stylesheet" href="suite-entry.css?v=0.2.13-beta.1">' : '';
      const legacyChrome = page==='single.html' ? '<meta name="theme-color" content="#007d7d">' : '';
      const homeTarget = page.includes('/') ? '../index.html' : './';
      const homeLabel = page.includes('/') ? 'ATS suite Home' : 'ATC Suite';
      const navigation = `<a id="home" href="${homeTarget}">${homeLabel}</a><a href="qgh.html">Change QGH type</a>`;
      await writeFile(resolve(output,page),`<html><head>${legacyChrome}${entryStyle}<link rel="stylesheet" href="workspace.css"></head><body><main>${navigation}</main></body></html>`);
    }
    await buildEntryTheme(output,source,'2026.10.07.1');
    for (const page of entryPages) {
      const html = await readFile(resolve(output,page),'utf8');
      assert.equal((html.match(/href="suite-entry\.css/g)||[]).length,1,`${page}: one shared entry stylesheet`);
      assert.ok(html.indexOf('flow-theme.css?release=2026.10.07.1') < html.indexOf('suite-entry.css?v=0.2.13-beta.1'),`${page}: final entry layout wins the cascade`);
      assert.ok(html.indexOf('suite-entry.css?v=0.2.13-beta.1') < html.indexOf('iaf-theme.css?release=2026.10.07.1'),`${page}: IAF colours follow entry geometry`);
      assert.ok(html.indexOf('iaf-theme.css?release=2026.10.07.1') < html.indexOf('</head>'),`${page}: IAF theme remains in the head`);
    }
    const single = await readFile(resolve(output,'single.html'),'utf8');
    assert.ok(!single.includes('suite-entry.css'),'individual exercise has no entry overrides');
    for (const page of [...entryPages, ...otherPages]) {
      const html = await readFile(resolve(output,page),'utf8');
      for (const asset of ['suite-appearance.js', 'suite-appearance.css', 'appearance-dark.css']) {
        assert.equal(html.split(asset).length - 1, 1, `${page}: one copy of ${asset}`);
      }
      assert.ok(html.indexOf('appearance-dark.css') > html.indexOf('iaf-theme.css'), page);
      const homeTarget = page.includes('/') ? '../index.html' : './';
      assert.ok(html.includes(`<a id="home" href="${homeTarget}" data-suite-home`), page);
      assert.match(html, /data-suite-home[^>]*><svg aria-hidden="true"[^>]*>.*?<\/svg>Home<\/a>/);
      assert.ok(html.includes('<a href="qgh.html">Change QGH type</a>'), page);
      assert.deepEqual(html.match(/<meta name="theme-color"[^>]*>/g),['<meta name="theme-color" content="#64b4e6">'],page);
    }
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
    await writeFile(resolve(source,'packages/site-landing/iaf-theme.css'),'/* IAF theme */');
    await writeFile(resolve(source,'packages/site-landing/qgh-cloudbreak.webp'),'fixture');
    for (const asset of ['exercise-motion.js','suite-appearance.js','suite-appearance.css','appearance-dark.css']) {
      await writeFile(resolve(source,'packages/site-landing',asset),'fixture');
    }
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
      assert.equal((html.match(/PREPARE YOUR POSITION/gi)||[]).length,1,`${page}: one role-card introduction`);
    }
  } finally { await rm(fixture,{recursive:true,force:true}); }
});

test('hosted entry artwork stays within the startup transfer budget', async () => {
  const artwork = [
    'hero-airspace.webp', 'hero-airspace-760.webp', 'qgh-towers.webp',
    'procedural-airspace.webp', 'qgh-cloudbreak.webp', 'aircraft-icon.webp', 'instructor-icon.webp',
  ];
  const sizes = await Promise.all(artwork.map(async name =>
    (await readFile(new URL('../../../packages/site-landing/' + name, import.meta.url))).length));
  assert.ok(sizes[1] <= 12 * 1024, 'compact hero stays below 12 KiB');
  assert.ok(sizes.reduce((total, bytes) => total + bytes, 0) <= 100 * 1024,
    'both hero sizes and all entry card art together stay below 100 KiB');
});
