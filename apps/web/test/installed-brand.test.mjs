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
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {buildInstalledBrand} from '../../../scripts/build-installed-brand.mjs';
import {versionHostedAssets} from '../../../scripts/version-hosted-assets.mjs';

const assets = ['ats-simbox-192.png', 'ats-simbox-512.png', 'ats-simbox-apple.png', 'ats-simbox-maskable-512.png', 'favicon-32.png'];
const pages = ['index.html', 'qgh.html', 'single.html', 'tactical.html', 'training-centre.html', 'user-guide.html',
  'instructor-led/index.html', 'instructor-led/instructor.html', 'instructor-led/student.html', 'instructor-led/training-guide.html',
  'procedural-beta/index.html', 'procedural-beta/procedural.html', 'procedural-beta/procedural-guide.html'];
const sourceDirectory = asset => asset === 'favicon-32.png' ? 'apps/web/static/icons' : 'packages/site-landing/install-icons';
const identity = branch => ({id: branch ? './reds-atc-training-suite' : './', start_url: './index.html', scope: './'});

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'ats-installed-brand-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const root = join(directory, 'source'), output = join(directory, 'output');
  const put = async (path, value) => {
    await mkdir(dirname(path), {recursive: true});
    await writeFile(path, value);
  };
  for (const asset of assets) await put(join(root, sourceDirectory(asset), asset), Buffer.from(`PNG fixture: ${asset}`));
  for (const branch of ['', 'instructor-led/']) {
    await put(join(output, branch, 'manifest.webmanifest'), JSON.stringify({...identity(branch), name: 'Old logo', display: 'standalone', icons: []}));
    await put(join(output, branch, 'service-worker.js'), "const APP_SHELL = [\n  './index.html',\n  './manifest.webmanifest',\n  './icons/favicon-32.png',\n];");
  }
  for (const page of pages) {
    const prefix = page.startsWith('procedural-beta/') ? '../' : '';
    await put(join(output, page), `<html><head><title>Unchanged title</title><link rel="manifest" href="${prefix}manifest.webmanifest"><link rel="icon" href="old-icon.png"><link rel="apple-touch-icon" href="old-apple.png"></head><body><a href="instructor.html?room=123456#scope">Return to exercise</a></body></html>`);
  }
  return {
    root, output,
    read: path => readFile(join(output, path), 'utf8'),
    manifest: async branch => JSON.parse(await readFile(join(output, branch, 'manifest.webmanifest'), 'utf8')),
    shell: async branch => Array.from(vm.runInNewContext(await readFile(join(output, branch, 'service-worker.js'), 'utf8') + '; APP_SHELL')),
  };
}

function pageIconUrls(html) {
  return [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map(match => match[1]);
}

test('installed icon URLs identify artwork bytes in both app scopes and every page link resolves offline', async t => {
  const f = await fixture(t);
  await buildInstalledBrand(f.output, f.root);
  for (const branch of ['', 'instructor-led/']) {
    const manifest = await f.manifest(branch), shell = await f.shell(branch);
    assert.deepEqual(Object.fromEntries(Object.keys(identity(branch)).map(key => [key, manifest[key]])), identity(branch));
    assert.equal(manifest.display, 'standalone');
    assert.deepEqual(manifest.icons.map(({sizes, purpose}) => ({sizes, purpose})), [
      {sizes: '192x192', purpose: 'any'}, {sizes: '512x512', purpose: 'any'}, {sizes: '512x512', purpose: 'maskable'},
    ]);
    for (const icon of manifest.icons) {
      assert.match(icon.src, /^icons\/ats-simbox-(?:192|512|maskable-512)\.[a-f0-9]{12}\.png$/);
      assert.ok(shell.includes('./' + icon.src), 'install icon is available offline');
    }
    assert.equal(shell.length, new Set(shell).size, 'existing favicon cache entry is retained once');
    for (const url of shell) assert.ok((await readFile(join(f.output, branch, url))).length, `precache file exists: ${branch}${url}`);
    for (const asset of assets) {
      const original = await readFile(join(f.root, sourceDirectory(asset), asset));
      assert.deepEqual(await readFile(join(f.output, branch, 'icons', asset)), original, 'legacy URL retains approved artwork');
      const hashed = shell.find(url => url.startsWith('./icons/' + asset.slice(0, -4) + '.'));
      assert.ok(hashed, `hashed variant cached: ${asset}`);
      assert.deepEqual(await readFile(join(f.output, branch, hashed)), original, 'fingerprinted asset is an exact copy');
    }
  }
  for (const page of pages) {
    const html = await f.read(page), urls = pageIconUrls(html);
    assert.equal(urls.length, 2);
    assert.ok(!html.includes('href="old-'));
    assert.ok(html.includes('<title>Unchanged title</title>'));
    assert.ok(html.includes('href="instructor.html?room=123456#scope"'));
    const prefix = page.startsWith('procedural-beta/') ? '../' : '';
    assert.ok(html.includes(`rel="manifest" href="${prefix}manifest.webmanifest"`), 'stable manifest URL preserves installed identity');
    for (const url of urls) {
      assert.ok(url.startsWith(prefix + 'icons/'), `${page} has its own app scope icon path`);
      assert.match(url, /\.[a-f0-9]{12}\.png$/);
      assert.ok((await readFile(join(f.output, dirname(page), url))).length);
    }
  }
});

test('unchanged artwork keeps stable install URLs through repeat builds and unrelated release updates', async t => {
  const f = await fixture(t);
  await buildInstalledBrand(f.output, f.root);
  await versionHostedAssets(f.output, '1.0.9');
  const paths = [...pages, 'manifest.webmanifest', 'instructor-led/manifest.webmanifest', 'service-worker.js', 'instructor-led/service-worker.js'];
  const before = await Promise.all(paths.map(f.read));
  await buildInstalledBrand(f.output, f.root);
  await versionHostedAssets(f.output, '1.0.10');
  assert.deepEqual(await Promise.all(paths.map(f.read)), before);
});

test('changing PNG bytes changes the matching install URL while other icons and app identity stay stable', async t => {
  const f = await fixture(t);
  await buildInstalledBrand(f.output, f.root);
  const before = await f.manifest(''), previousShell = await f.shell('');
  const beforePageIcons = pageIconUrls(await f.read('index.html'));
  for (const asset of ['ats-simbox-512.png', 'ats-simbox-apple.png', 'favicon-32.png']) {
    await writeFile(join(f.root, sourceDirectory(asset), asset), Buffer.from(`New approved PNG: ${asset}`));
  }
  await buildInstalledBrand(f.output, f.root);
  for (const branch of ['', 'instructor-led/']) {
    const after = await f.manifest(branch);
    assert.notEqual(after.icons[1].src, before.icons[1].src, 'browser sees a fresh URL when artwork changes');
    assert.ok(!previousShell.includes('./' + after.icons[1].src), 'old shell has no entry that can answer this fresh URL');
    assert.equal(after.icons[0].src, before.icons[0].src);
    assert.equal(after.icons[2].src, before.icons[2].src);
    assert.deepEqual(Object.fromEntries(Object.keys(identity(branch)).map(key => [key, after[key]])), identity(branch));
    const freshBytes = await readFile(join(f.output, branch, after.icons[1].src));
    assert.equal(freshBytes.toString(), 'New approved PNG: ats-simbox-512.png');
    assert.ok((await f.shell(branch)).includes('./' + after.icons[1].src));
  }
  const afterPageIcons = pageIconUrls(await f.read('index.html'));
  assert.notEqual(afterPageIcons[0], beforePageIcons[0], 'favicon URL changes with its bytes');
  assert.notEqual(afterPageIcons[1], beforePageIcons[1], 'Apple home-screen icon URL changes with its bytes');
});
