/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

// Hosted installed-app identity. Keep document titles, visible branding,
// manifest IDs, start URLs and scopes unchanged.
export async function buildInstalledBrand(output, root) {
  const assets = ['ats-simbox-192.png', 'ats-simbox-512.png', 'ats-simbox-apple.png', 'ats-simbox-maskable-512.png', 'favicon-32.png'];
  const iconFiles = new Map();
  for (const asset of assets) {
    const source = asset === 'favicon-32.png' ? 'apps/web/static/icons' : 'packages/site-landing/install-icons';
    const bytes = await readFile(resolve(root, source, asset));
    // Installed browsers may treat an unchanged icon URL as immutable. A byte
    // digest changes only artwork URLs, without creating a new app identity.
    const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    iconFiles.set(asset, {bytes, name: asset.replace(/\.png$/, `.${digest}.png`)});
  }
  for (const branch of ['', 'instructor-led/']) {
    const iconRoot = resolve(output, branch, 'icons');
    await mkdir(iconRoot, {recursive: true});
    for (const [asset, icon] of iconFiles) {
      await writeFile(resolve(iconRoot, asset), icon.bytes);
      await writeFile(resolve(iconRoot, icon.name), icon.bytes);
    }
    const path = resolve(output, branch, 'manifest.webmanifest');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    manifest.name = manifest.short_name = 'ATS SIM BOX';
    manifest.description = `${branch ? 'QGH, SRA and vectoring instructor' : 'QGH, Procedural, SRA and vectoring'} training. Offline: same PC and browser profile. Online: different devices with internet on both.`;
    manifest.icons = [
      {src: `icons/${iconFiles.get('ats-simbox-192.png').name}`, sizes: '192x192', type: 'image/png', purpose: 'any'},
      {src: `icons/${iconFiles.get('ats-simbox-512.png').name}`, sizes: '512x512', type: 'image/png', purpose: 'any'},
      {src: `icons/${iconFiles.get('ats-simbox-maskable-512.png').name}`, sizes: '512x512', type: 'image/png', purpose: 'maskable'},
    ];
    await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
  }
  const pages = ['index.html', 'qgh.html', 'single.html', 'tactical.html', 'training-centre.html', 'user-guide.html',
    'instructor-led/index.html', 'instructor-led/instructor.html', 'instructor-led/student.html', 'instructor-led/training-guide.html',
    'procedural-beta/index.html', 'procedural-beta/procedural.html', 'procedural-beta/procedural-guide.html'];
  for (const page of pages) {
    const path = resolve(output, page);
    const prefix = page.startsWith('procedural-beta/') ? '../' : '';
    let html = await readFile(path, 'utf8');
    html = html.replace(/<meta name="apple-mobile-web-app-title"[^>]*>/g, '')
      .replace(/<link rel="apple-touch-icon"[^>]*>/g, '')
      .replace(/<link rel="icon"[^>]*>/g, '');
    const manifestLink = html.includes('rel="manifest"') ? '' : `<link rel="manifest" href="${prefix}manifest.webmanifest">`;
    html = html.replace('</head>', `${manifestLink}<meta name="apple-mobile-web-app-title" content="ATS SIM BOX"><link rel="icon" type="image/png" sizes="32x32" href="${prefix}icons/${iconFiles.get('favicon-32.png').name}"><link rel="apple-touch-icon" sizes="180x180" href="${prefix}icons/${iconFiles.get('ats-simbox-apple.png').name}"></head>`);
    await writeFile(path, html);
  }
  for (const branch of ['', 'instructor-led/']) {
    const path = resolve(output, branch, 'service-worker.js');
    const sw = await readFile(path, 'utf8');
    const cacheAssets = [...assets, ...[...iconFiles.values()].map(icon => icon.name)]
      .filter(asset => !sw.includes(`'./icons/${asset}'`));
    if (cacheAssets.length) await writeFile(path, sw.replace('const APP_SHELL = [', 'const APP_SHELL = [\n' + cacheAssets.map(asset => `  './icons/${asset}',`).join('\n')));
  }
}
