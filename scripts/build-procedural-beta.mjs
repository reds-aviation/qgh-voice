import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function buildProceduralBeta(outputRoot) {
  if (resolve(outputRoot) !== resolve(root,'apps/web/dist')) throw new Error('Unexpected Pages output');
  const source = resolve(root,'packages/procedural-beta');
  const manifest = JSON.parse(await readFile(resolve(source,'manifest.json'),'utf8'));
  const seen = new Set();
  for (const file of manifest.files) {
    if (!/^(static|engine)\/[a-zA-Z0-9_./-]+$/.test(file.path) || file.path.split('/').includes('..') || seen.has(file.path)) throw new Error('Unsafe procedural asset');
    seen.add(file.path);
    const data = await readFile(resolve(source,file.path));
    if (data.length !== file.bytes || createHash('sha256').update(data).digest('hex') !== file.sha256) throw new Error(`Procedural asset mismatch: ${file.path}`);
    if (!file.path.startsWith('static/')) continue;
    const target = resolve(outputRoot,'procedural-beta',file.path.slice(7));
    await mkdir(dirname(target),{recursive:true});
    await writeFile(target,data);
  }
  await copyFile(resolve(outputRoot,'procedural-beta/procedural.html'),resolve(outputRoot,'procedural-beta/index.html'));
  const landingRoot = resolve(root,'packages/site-landing');
  const landingAssets = ['suite-landing.css','suite-landing-register.js','hero-airspace.png','qgh-towers.png','procedural-airspace.png','aircraft-icon.png','instructor-icon.png'];
  for (const asset of landingAssets) await copyFile(resolve(landingRoot,asset),resolve(outputRoot,asset));

  // Keep the already-built QGH exercise picker at a stable Pages-only URL.
  // The shared QGH source, native apps, and default Netlify build are untouched.
  const homePath = resolve(outputRoot,'index.html');
  let qgh = await readFile(homePath,'utf8');
  const individualTab = '<a class="entry-program-tab entry-program-tab--active" href="index.html" aria-current="page">INDIVIDUAL PRACTICE</a>';
  if (!qgh.includes(individualTab)) throw new Error('Missing QGH navigation tab');
  qgh = qgh.replace(individualTab,'<a class="entry-program-tab" href="index.html">SUITE HOME</a>');
  qgh = qgh.replaceAll('Reds QGH Simulator','QGH Simulator').replaceAll('Reds QGH','ATC Training Suite')
    .replace('INSTALL QGH ON THIS DEVICE','INSTALL ATC SUITE ON THIS DEVICE')
    .replace('Install QGH Simulator','Install ATC Training Suite');
  await writeFile(resolve(outputRoot,'qgh.html'),qgh);
  await copyFile(resolve(landingRoot,'index.html'),homePath);

  for (const page of ['single.html','tactical.html','training-centre.html','user-guide.html']) {
    const path = resolve(outputRoot,page);
    let html = await readFile(path,'utf8');
    html = html.replaceAll('href="index.html"','href="qgh.html"').replaceAll('Reds QGH Simulator','QGH Simulator')
      .replaceAll('Reds QGH','ATC Training Suite');
    await writeFile(path,html);
  }
  for (const page of ['index.html','instructor.html','student.html','training-guide.html']) {
    const path = resolve(outputRoot,'instructor-led',page);
    let html = await readFile(path,'utf8');
    html = html.replaceAll('<span>REDS</span> ATC TRAINING SUITE','ATC TRAINING SUITE')
      .replaceAll('REDS ATC TRAINING SUITE','ATC TRAINING SUITE')
      .replaceAll('Reds ATC Training Suite','ATC Training Suite')
      .replaceAll('Reds ATC Suite','ATC Suite')
      .replaceAll('>INDIVIDUAL PRACTICE</a>','>SUITE HOME</a>');
    await writeFile(path,html);
  }
  for (const page of ['procedural.html','index.html','procedural-guide.html']) {
    const path = resolve(outputRoot,'procedural-beta',page);
    let html = await readFile(path,'utf8');
    html = html.replace('<span class="brand-mark">R</span>','<span class="brand-mark">⌖</span>')
      .replace('REDS · PROCEDURAL TRAINING','ATC · PROCEDURAL TRAINING');
    await writeFile(path,html);
  }
  const manifestPath = resolve(outputRoot,'manifest.webmanifest');
  const qghManifest = JSON.parse(await readFile(manifestPath,'utf8'));
  qghManifest.name = 'ATC Training Suite';
  qghManifest.short_name = 'ATC Suite';
  qghManifest.start_url = './index.html';
  await writeFile(manifestPath,JSON.stringify(qghManifest,null,2)+'\n');
  const distributionPath = resolve(outputRoot,'web-distribution.js');
  const distribution = await readFile(distributionPath,'utf8');
  if (!distribution.includes('INSTALL QGH ON THIS DEVICE')) throw new Error('Missing QGH install label');
  await writeFile(distributionPath,distribution.replaceAll('INSTALL QGH ON THIS DEVICE','INSTALL ATC SUITE ON THIS DEVICE'));

  const swPath = resolve(outputRoot,'service-worker.js');
  let sw = await readFile(swPath,'utf8');
  sw = sw.replace(/(const CACHE_NAME = `[^`]+)(`;)/, '$1-suite-landing-2$2');
  sw = sw.replace("  './index.html',","  './index.html',\n  './qgh.html',\n  './suite-landing.css',\n  './suite-landing-register.js',\n  './hero-airspace.png',\n  './qgh-towers.png',\n  './procedural-airspace.png',\n  './aircraft-icon.png',\n  './instructor-icon.png',");
  sw = sw.replace("['./', './index.html', './user-guide.html'","['./', './index.html', './qgh.html', './user-guide.html'");
  if (!sw.includes("'./qgh.html'") || !sw.includes("'./suite-landing.css'")) throw new Error('QGH offline suite shell was not updated');
  await writeFile(swPath,sw);
  console.log(`Built GitHub-only ATC Training Suite with Procedural Beta ${manifest.version}`);
}
