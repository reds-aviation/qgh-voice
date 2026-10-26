/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import commandReference from '../packages/atc-suite/suite-command-reference.js';
import {addLicenseFooter, copyLicenseNotices} from './build-license-notice.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const suiteRoot = resolve(repositoryRoot, 'packages', 'atc-suite');
const engineRoot = resolve(repositoryRoot, 'packages', 'qgh-engine');
const suiteWebRoot = resolve(repositoryRoot, 'apps', 'suite-web');
const staticRoot = resolve(suiteWebRoot, 'static');
const sharedIconRoot = resolve(repositoryRoot, 'apps', 'web', 'static', 'icons');
const outputRoot = resolve(suiteWebRoot, 'dist');

const suiteFiles = [
  'index.html',
  'instructor.html',
  'student.html',
  'training-guide.html',
  'suite-command-reference.js',
  'suite.css',
  'suite-entry.js',
  'suite-core.js',
  'suite-display.js',
  'suite-instructor.js',
  'suite-review.js',
  'suite-sensors.js',
  'suite-session.js',
  'suite-cloud.js',
  'suite-student.js',
];
const sharedEngineFiles = [
  'published-boundaries.js',
  'ats-simbox-logo.png',
  'license-footer.css',
  'simulator-core.js',
  'scope-visuals.js',
  'procedure-core.js',
  'fonts/ibm-plex-mono-500.ttf',
  'fonts/ibm-plex-sans-400.ttf',
  'fonts/ibm-plex-sans-600.ttf',
  'fonts/OFL-1.1.txt',
];
const sharedProceduralFiles = [
  'published-airspace.js',
  'published-airspace.css',
  'india-airbase-lfa-catalogue.json',
  'india-airspace.json',
  'india-aip-enroute.json',
  'remote-service.js',
  'student-plotting.js',
  'student-plotting.css',
  'workspace-shell.js',
  'workspace-shell.css',
  'meeting-room.js',
  'suite-entry.css',
];
const staticFiles = [
  'manifest.webmanifest',
  'service-worker.js',
  'pwa-register.js',
  'pwa.css',
  'app-version.json',
];
const sharedIcons = [
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'favicon-32.png',
];
const pageFiles = ['index.html', 'instructor.html', 'student.html', 'training-guide.html'];

async function copyFrom(sourceRoot, relativePath, destinationPath = relativePath) {
  const destination = resolve(outputRoot, destinationPath);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(sourceRoot, relativePath), destination);
}

async function readSuiteVersion() {
  const versionFile = resolve(staticRoot, 'app-version.json');
  const { version } = JSON.parse(await readFile(versionFile, 'utf8'));
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(version)) {
    throw new Error('apps/suite-web/static/app-version.json must contain a safe semantic version string.');
  }
  return version;
}

function preparePage(source, version) {
  const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  let html = addLicenseFooter(source).replaceAll('__ATC_GUIDE_VERSION__', version).replace('<!-- DIRECT_COMMANDS -->',
    commandReference.commands.map(row => `<tr><td>${row.aliases.map(alias => `<code>${escape(alias)}</code>`).join(' / ')}</td><td>${escape(row.description)}</td></tr>`).join('\n'));
  if (!html.includes('pwa.css')) {
    html = html.replace('</head>', '  <link rel="stylesheet" href="pwa.css">\n</head>');
  }
  html = html.replace(
    /BETA PROJECT · UNDER DEVELOPMENT · USER TRIALS · [0-9]+\.[0-9]+\.[0-9]+(?:[-+][a-zA-Z0-9.-]+)?/g,
    'ATS SIM BOX'
  );
  return html.replace(
    /((?:src|href)=")([^"#?]+\.(?:js|css))("\s*)/g,
    `$1$2?v=${version}$3`
  );
}

async function applyBuildVersion(version) {
  const workerPath = resolve(outputRoot, 'service-worker.js');
  const worker = await readFile(workerPath, 'utf8');
  if (!worker.includes('__ATC_SUITE_VERSION__')) {
    throw new Error('The ATC Suite service worker is missing its version token.');
  }
  await writeFile(workerPath, worker.replaceAll('__ATC_SUITE_VERSION__', version), 'utf8');

  await Promise.all(pageFiles.map(async page => {
    const pagePath = resolve(outputRoot, page);
    const html = await readFile(pagePath, 'utf8');
    await writeFile(pagePath, preparePage(html, version), 'utf8');
  }));
}

async function build() {
  const version = await readSuiteVersion();
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  await Promise.all([
    ...suiteFiles.map(file => copyFrom(suiteRoot, file)),
    ...sharedEngineFiles.map(file => copyFrom(engineRoot, file)),
    ...sharedProceduralFiles.map(file => copyFrom(resolve(repositoryRoot, 'packages/procedural-beta/static'), file)),
    ...staticFiles.map(file => copyFrom(staticRoot, file)),
    ...sharedIcons.map(file => copyFrom(sharedIconRoot, file, `icons/${file}`)),
  ]);
  await copyLicenseNotices(outputRoot, repositoryRoot);
  await applyBuildVersion(version);
  await writeFile(resolve(outputRoot,'remote-config.js'), 'export const remoteConfig = Object.freeze({url:"",publishableKey:""});\n');

  const expectedOutput = [
    'remote-config.js',
    ...suiteFiles,
    ...sharedEngineFiles,
    ...sharedProceduralFiles,
    ...staticFiles,
    ...sharedIcons.map(file => `icons/${file}`),
  ];
  await Promise.all(expectedOutput.map(async file => {
    try {
      await access(resolve(outputRoot, file));
    } catch {
      throw new Error(`ATC Suite build is missing required output: ${file}`);
    }
  }));

  console.log(`Built ATS SIM BOX Version 1 (${version}) at ${outputRoot}`);
}

await build();
