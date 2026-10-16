/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '..', '..', '..');

test('release version stays aligned across PWA, Windows, and Android', () => {
  execFileSync(
    process.execPath,
    [resolve(repositoryRoot, 'scripts', 'verify-release-version.mjs')],
    { cwd: repositoryRoot, stdio: 'pipe' }
  );
});

test('release version guard rejects an empty prerelease identifier', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'qgh-release-version-'));

  try {
    const webDirectory = join(fixtureRoot, 'apps', 'web', 'static');
    const windowsDirectory = join(fixtureRoot, 'apps', 'windows');
    const androidDirectory = join(fixtureRoot, 'apps', 'android', 'app');
    mkdirSync(webDirectory, { recursive: true });
    mkdirSync(windowsDirectory, { recursive: true });
    mkdirSync(androidDirectory, { recursive: true });

    const malformedRelease = JSON.parse(readFileSync(
      resolve(repositoryRoot, 'apps', 'web', 'static', 'app-version.json'),
      'utf8'
    ));
    malformedRelease.version = '4.0.2-a..b';

    writeFileSync(
      join(webDirectory, 'app-version.json'),
      JSON.stringify(malformedRelease, null, 2) + '\n'
    );
    writeFileSync(
      join(windowsDirectory, 'package.json'),
      readFileSync(resolve(repositoryRoot, 'apps', 'windows', 'package.json'))
    );
    writeFileSync(
      join(androidDirectory, 'build.gradle.kts'),
      readFileSync(resolve(repositoryRoot, 'apps', 'android', 'app', 'build.gradle.kts'))
    );

    assert.throws(
      () => execFileSync(
        process.execPath,
        [resolve(repositoryRoot, 'scripts', 'verify-release-version.mjs')],
        {
          cwd: repositoryRoot,
          env: { ...process.env, QGH_RELEASE_VALIDATION_ROOT: fixtureRoot },
          stdio: 'pipe',
        }
      ),
      /must contain a semantic release version/
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('unified release guard rejects a different version in a suite module', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'ats-release-version-'));
  const paths = ['apps/web/static/app-version.json', 'apps/suite-web/static/app-version.json',
    'apps/windows/package.json', 'apps/android/app/build.gradle.kts',
    'packages/procedural-beta/manifest.json', 'packages/procedural-beta/static/guide-knowledge.js'];
  try {
    for (const path of paths) {
      const target = join(fixtureRoot, path);
      mkdirSync(resolve(target, '..'), {recursive: true});
      writeFileSync(target, readFileSync(resolve(repositoryRoot, path)));
    }
    const target = join(fixtureRoot, 'apps/suite-web/static/app-version.json');
    const suite = JSON.parse(readFileSync(target, 'utf8')); suite.version = '0.0.1';
    writeFileSync(target, JSON.stringify(suite));
    assert.throws(() => execFileSync(process.execPath,
      [resolve(repositoryRoot, 'scripts/verify-release-version.mjs')],
      {cwd: repositoryRoot, env: {...process.env, QGH_RELEASE_VALIDATION_ROOT: fixtureRoot}, stdio: 'pipe'}),
      /ATS suite version is 0\.0\.1/);
  } finally { rmSync(fixtureRoot, {recursive: true, force: true}); }
});

test(
  'PowerShell release updater rejects an empty prerelease identifier',
  { skip: process.platform !== 'win32' },
  () => {
    assert.throws(
      () => execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          resolve(repositoryRoot, 'scripts', 'Set-QghReleaseVersion.ps1'),
          '-Version',
          '4.0.2-a..b',
          '-AndroidVersionCode',
          '12',
        ],
        { cwd: repositoryRoot, stdio: 'pipe' }
      ),
      (error) => error.status !== 0 && /ParameterArgumentValidationError,Set-QghReleaseVersion\.ps1/i.test(
        error.stderr?.toString() ?? ''
      )
    );
  }
);
