/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = process.env.QGH_RELEASE_VALIDATION_ROOT
  ? resolve(process.env.QGH_RELEASE_VALIDATION_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = JSON.parse(readFileSync(
  resolve(repositoryRoot, 'apps', 'web', 'static', 'app-version.json'),
  'utf8'
));
const windowsPackage = JSON.parse(readFileSync(
  resolve(repositoryRoot, 'apps', 'windows', 'package.json'),
  'utf8'
));
const androidBuild = readFileSync(
  resolve(repositoryRoot, 'apps', 'android', 'app', 'build.gradle.kts'),
  'utf8'
);

// SemVer 2.0.0: prerelease and build identifiers are non-empty dot-separated parts.
const versionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*)|(?:[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))(?:\.(?:(?:0|[1-9]\d*)|(?:[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const androidName = androidBuild.match(/versionName\s*=\s*"([^"]+)"/);
const androidCode = androidBuild.match(/versionCode\s*=\s*(\d+)/);

if (!versionPattern.test(release.version)) {
  throw new Error('apps/web/static/app-version.json must contain a semantic release version.');
}

if (!Number.isInteger(release.androidVersionCode) || release.androidVersionCode < 1) {
  throw new Error('apps/web/static/app-version.json must contain a positive androidVersionCode.');
}

if (!androidName || !androidCode) {
  throw new Error('Could not read Android versionName and versionCode from app/build.gradle.kts.');
}

const mismatches = [
  {
    label: 'ATS suite version',
    actual: JSON.parse(readFileSync(resolve(repositoryRoot, 'apps', 'suite-web', 'static', 'app-version.json'), 'utf8')).version,
    expected: release.version,
  },
  {
    label: 'Procedural version',
    actual: JSON.parse(readFileSync(resolve(repositoryRoot, 'packages', 'procedural-beta', 'manifest.json'), 'utf8')).version,
    expected: release.version,
  },
  {
    label: 'Shared guide version',
    actual: readFileSync(resolve(repositoryRoot, 'packages', 'procedural-beta', 'static', 'guide-knowledge.js'), 'utf8').match(/"revision":\s*"([^"]+)"/)?.[1],
    expected: release.version,
  },
  {
    label: 'Windows package version',
    actual: windowsPackage.version,
    expected: release.version,
  },
  {
    label: 'Android versionName',
    actual: androidName[1],
    expected: release.version,
  },
  {
    label: 'Android versionCode',
    actual: Number(androidCode[1]),
    expected: release.androidVersionCode,
  },
].filter(({ actual, expected }) => actual !== expected);

if (mismatches.length > 0) {
  const details = mismatches
    .map(({ label, actual }) => label + ' is ' + actual)
    .join('; ');
  throw new Error(
    'Cross-platform release versions are not aligned with PWA ' +
    release.version + ': ' + details + '.'
  );
}

console.log(
  'QGH release versions aligned: v' + release.version +
  ' (Android versionCode ' + release.androidVersionCode + ').'
);
