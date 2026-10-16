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
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';
import commandReference from '../../../packages/atc-suite/suite-command-reference.js';

const repositoryRoot = resolve(import.meta.dirname, '..', '..', '..');
const outputRoot = resolve(repositoryRoot, 'apps', 'suite-web', 'dist');
const suiteProbe = resolve(repositoryRoot, 'packages', 'atc-suite', '__suite-build-probe__.js');
const staticProbe = resolve(repositoryRoot, 'apps', 'suite-web', 'static', '__suite-static-probe__.txt');

const expectedFiles = [
  'LICENSE.txt',
  'COPYRIGHT.txt',
  'MIT-legacy.txt',
  'THIRD_PARTY_NOTICES.txt',
  'license-footer.css',
  'meeting-room.js',
  'index.html',
  'instructor.html',
  'student.html',
  'training-guide.html',
  'suite-command-reference.js',
  'suite.css',
  'suite-entry.js',
  'suite-entry.css',
  'suite-core.js',
  'suite-display.js',
  'suite-instructor.js',
  'suite-review.js',
  'suite-sensors.js',
  'suite-session.js',
  'suite-cloud.js',
  'remote-service.js',
  'remote-config.js',
  'suite-student.js',
  'student-plotting.js',
  'student-plotting.css',
  'workspace-shell.js',
  'workspace-shell.css',
  'simulator-core.js',
  'scope-visuals.js',
  'procedure-core.js',
  'fonts/ibm-plex-mono-500.ttf',
  'fonts/ibm-plex-sans-400.ttf',
  'fonts/ibm-plex-sans-600.ttf',
  'fonts/OFL-1.1.txt',
  'manifest.webmanifest',
  'service-worker.js',
  'pwa-register.js',
  'pwa.css',
  'app-version.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
].sort();

const absoluteFiles = directory => readdirSync(directory, { withFileTypes: true })
  .flatMap(entry => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? absoluteFiles(entryPath) : [entryPath];
  });

const outputFiles = () => absoluteFiles(outputRoot)
  .map(file => relative(outputRoot, file).replaceAll('\\', '/'))
  .sort();

const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');

test('suite build creates only the isolated allowlisted PWA package', () => {
  writeFileSync(suiteProbe, 'This package file is intentionally outside the build allowlist.');
  if (existsSync(resolve(repositoryRoot, 'apps', 'suite-web', 'static'))) {
    writeFileSync(staticProbe, 'This static file is intentionally outside the build allowlist.');
  }

  try {
    execFileSync(process.execPath, [resolve(repositoryRoot, 'scripts', 'build-suite-web.mjs')], {
      cwd: repositoryRoot,
      stdio: 'pipe',
    });
  } finally {
    if (existsSync(suiteProbe)) unlinkSync(suiteProbe);
    if (existsSync(staticProbe)) unlinkSync(staticProbe);
  }

  assert.deepEqual(outputFiles(), expectedFiles);
  assert.equal(existsSync(resolve(outputRoot, '__suite-build-probe__.js')), false);
  assert.equal(existsSync(resolve(outputRoot, '__suite-static-probe__.txt')), false);
  assert.equal(existsSync(resolve(outputRoot, 'test')), false, 'suite tests are not published');

  const { version } = JSON.parse(readFileSync(resolve(outputRoot, 'app-version.json'), 'utf8'));
  const sourceVersion = JSON.parse(readFileSync(resolve(repositoryRoot, 'apps/suite-web/static/app-version.json'), 'utf8')).version;
  assert.equal(version, sourceVersion);
  for (const [source, destination] of [['LICENSE','LICENSE.txt'],['COPYRIGHT.md','COPYRIGHT.txt'],['LICENSES/MIT-legacy.txt','MIT-legacy.txt'],['THIRD_PARTY_NOTICES.md','THIRD_PARTY_NOTICES.txt']]) {
    assert.equal(readFileSync(resolve(outputRoot, destination), 'utf8'), readFileSync(resolve(repositoryRoot, source), 'utf8'), `${destination} preserves the original notice`);
  }
  const guide = readFileSync(resolve(outputRoot, 'training-guide.html'), 'utf8');
  assert.ok(guide.includes('TRAINING GUIDE · Version 1'));
  assert.ok(!guide.includes('DIRECT_COMMANDS') && !guide.includes('__ATC_GUIDE_VERSION__'));
  for (const row of commandReference.commands) for (const alias of row.aliases) assert.ok(guide.includes(`<code>${alias}</code>`), `Guide includes executable alias ${alias}`);

  for (const page of ['index.html', 'instructor.html', 'student.html', 'training-guide.html']) {
    const html = readFileSync(resolve(outputRoot, page), 'utf8');
    assert.match(html, /ATS SIM BOX · Version 1/, `${page}: common public product and version`);
    assert.equal((html.match(/class="license-footer"/g) || []).length, 1, `${page}: one normal-flow copyright footer`);
    assert.ok(html.includes('© 2026 Balaram Reddy'));
    assert.doesNotMatch(html.replace(/<[^>]+>/g, ' '), /\bBETA\b|UNDER DEVELOPMENT|USER TRIALS/i, `${page}: no old release-stage labels`);
    const localAssets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)\?v=([^"]+))"/g)];
    assert.ok(localAssets.length > 0, `${page} contains version-qualified local assets`);
    for (const [, , assetVersion] of localAssets) assert.equal(assetVersion, version);
    assert.match(html, /manifest\.webmanifest/);
    assert.ok(html.includes(`pwa.css?v=${version}`));
    assert.ok(html.includes(`pwa-register.js?v=${version}`));

    for (const [, reference] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (/^(?:[a-z]+:|#)/i.test(reference)) continue;
      // The parent route is deliberately resolved only when this isolated
      // package is mounted at /instructor-led/ by the GitHub Pages builder.
      if (reference === '../index.html') continue;
      const localPath = reference.split(/[?#]/, 1)[0];
      assert.equal(existsSync(resolve(outputRoot, localPath)), true, `${page} reference exists: ${localPath}`);
    }
  }
  const entry = readFileSync(resolve(outputRoot, 'index.html'), 'utf8');
  assert.match(entry, /ATS SIM BOX · Version 1/);
  assert.ok(entry.includes(`suite-entry.js?v=${version}`), 'entry navigation is bundled and versioned');
  for (const page of ['index.html','student.html']) {
    assert.ok(readFileSync(resolve(outputRoot,page),'utf8').includes(`suite-entry.css?v=${version}`), `${page} uses shared entry layout`);
  }
  const instructor = readFileSync(resolve(outputRoot,'instructor.html'),'utf8');
  assert.ok(instructor.indexOf('scope-visuals.js?') < instructor.indexOf('suite-display.js?'), 'scope helper loads before instructor renderers');
  assert.equal(sha256(resolve(outputRoot,'scope-visuals.js')),sha256(resolve(repositoryRoot,'packages/qgh-engine/scope-visuals.js')), 'suite scope helper is the canonical source');
  assert.equal(sha256(resolve(outputRoot,'suite-entry.css')),sha256(resolve(repositoryRoot,'packages/procedural-beta/static/suite-entry.css')), 'both training families share one entry stylesheet');

  const css = readFileSync(resolve(outputRoot, 'suite.css'), 'utf8');
  for (const [, reference] of css.matchAll(/url\(['"]?([^)'"?#]+)[^)]*\)/g)) {
    assert.equal(existsSync(resolve(outputRoot, reference)), true, `suite.css reference exists: ${reference}`);
  }

  const worker = readFileSync(resolve(outputRoot, 'service-worker.js'), 'utf8');
  assert.doesNotMatch(worker, /__ATC_SUITE_VERSION__/);
  assert.ok(worker.includes(`const APP_VERSION = '${version}'`));

  const manifest = JSON.parse(readFileSync(resolve(outputRoot, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'ATS SIM BOX');
  assert.equal(manifest.short_name, 'ATS SIM BOX');
  assert.equal(manifest.id, './reds-atc-training-suite');
  assert.notEqual(manifest.id, './');

  for (const icon of ['icon-192.png', 'icon-512.png']) {
    const source = resolve(repositoryRoot, 'apps', 'web', 'static', 'icons', icon);
    const built = resolve(outputRoot, 'icons', icon);
    assert.equal(sha256(built), sha256(source), `${icon} is copied without altering the existing QGH asset`);
  }
});
