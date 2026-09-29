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
  'index.html',
  'instructor.html',
  'student.html',
  'training-guide.html',
  'suite-command-reference.js',
  'suite.css',
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
  'simulator-core.js',
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
  const guide = readFileSync(resolve(outputRoot, 'training-guide.html'), 'utf8');
  assert.ok(guide.includes(`BETA TRAINING GUIDE · ${version}`));
  assert.ok(!guide.includes('BETA_DIRECT_COMMANDS') && !guide.includes('__ATC_GUIDE_VERSION__'));
  for (const row of commandReference.commands) for (const alias of row.aliases) assert.ok(guide.includes(`<code>${alias}</code>`), `Guide includes executable alias ${alias}`);

  for (const page of ['index.html', 'instructor.html', 'student.html', 'training-guide.html']) {
    const html = readFileSync(resolve(outputRoot, page), 'utf8');
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
  assert.match(entry, new RegExp(`BETA PROJECT · UNDER DEVELOPMENT · USER TRIALS · ${version.replaceAll('.', '\\.')}`));

  const css = readFileSync(resolve(outputRoot, 'suite.css'), 'utf8');
  for (const [, reference] of css.matchAll(/url\(['"]?([^)'"?#]+)[^)]*\)/g)) {
    assert.equal(existsSync(resolve(outputRoot, reference)), true, `suite.css reference exists: ${reference}`);
  }

  const worker = readFileSync(resolve(outputRoot, 'service-worker.js'), 'utf8');
  assert.doesNotMatch(worker, /__ATC_SUITE_VERSION__/);
  assert.ok(worker.includes(`const APP_VERSION = '${version}'`));

  const manifest = JSON.parse(readFileSync(resolve(outputRoot, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'Reds ATC Training Suite');
  assert.equal(manifest.id, './reds-atc-training-suite');
  assert.notEqual(manifest.id, './');

  for (const icon of ['icon-192.png', 'icon-512.png']) {
    const source = resolve(repositoryRoot, 'apps', 'web', 'static', 'icons', icon);
    const built = resolve(outputRoot, 'icons', icon);
    assert.equal(sha256(built), sha256(source), `${icon} is copied without altering the existing QGH asset`);
  }
});
