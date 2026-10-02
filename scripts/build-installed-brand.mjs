import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

// Hosted installed-app identity. Keep document titles, visible branding,
// manifest IDs, start URLs and scopes unchanged.
export async function buildInstalledBrand(output, root) {
  const assets = ['ats-simbox-192.png', 'ats-simbox-512.png', 'ats-simbox-apple.png'];
  for (const branch of ['', 'instructor-led/']) {
    const iconRoot = resolve(output, branch, 'icons');
    await mkdir(iconRoot, {recursive: true});
    for (const asset of assets) await copyFile(resolve(root, 'packages/site-landing/install-icons', asset), resolve(iconRoot, asset));
    const path = resolve(output, branch, 'manifest.webmanifest');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    manifest.name = manifest.short_name = 'ATS SIMBOX';
    manifest.description = `${branch ? 'QGH, SRA and vectoring instructor' : 'QGH, Procedural, SRA and vectoring'} training. Offline: same PC and browser profile. Online: different devices with internet on both.`;
    manifest.icons = [
      {src: 'icons/ats-simbox-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
      {src: 'icons/ats-simbox-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable'},
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
      .replace(/<link rel="apple-touch-icon"[^>]*>/g, '');
    const manifestLink = html.includes('rel="manifest"') ? '' : `<link rel="manifest" href="${prefix}manifest.webmanifest">`;
    html = html.replace('</head>', `${manifestLink}<meta name="apple-mobile-web-app-title" content="ATS SIMBOX"><link rel="apple-touch-icon" sizes="180x180" href="${prefix}icons/ats-simbox-apple.png"></head>`);
    await writeFile(path, html);
  }
  for (const branch of ['', 'instructor-led/']) {
    const path = resolve(output, branch, 'service-worker.js');
    const sw = await readFile(path, 'utf8');
    await writeFile(path, sw.replace('const APP_SHELL = [', 'const APP_SHELL = [\n' + assets.map(asset => `  './icons/${asset}',`).join('\n')));
  }
}
