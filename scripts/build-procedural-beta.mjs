import {buildSuiteGuides} from './build-suite-guides.mjs';
import {buildEntryTheme} from './build-entry-theme.mjs';
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
  await copyFile(resolve(source,'static/remote-config.js'), resolve(outputRoot,'instructor-led/remote-config.js'));
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
  const landingHTML = await readFile(resolve(landingRoot,'index.html'),'utf8');
  await writeFile(homePath, landingHTML.replace('src="suite-landing-register.js"',`src="suite-landing-register.js?release=${manifest.version}"`));

  for (const page of ['single.html','tactical.html','training-centre.html','user-guide.html']) {
    const path = resolve(outputRoot,page);
    let html = await readFile(path,'utf8');
    html = html.replaceAll('href="index.html"','href="qgh.html"').replaceAll('Reds QGH Simulator','QGH Simulator')
      .replaceAll('Reds QGH','ATC Training Suite');
    const suiteLink = '<a class="mode-home-link" href="./">ATC SUITE</a>';
    if (page === 'single.html') {
      const marker = '<div class="brand"><h1>QGH SIMULATOR</h1>';
      if (!html.includes(marker)) throw new Error('Missing Single QGH header for Pages suite link');
      html = html.replace(marker, marker + suiteLink);
    } else if (page === 'tactical.html') {
      const marker = '<div class="tactical-brand"><h1>TACTICAL QGH SIMULATOR</h1>';
      if (!html.includes(marker)) throw new Error('Missing Tactical QGH header for Pages suite link');
      html = html.replace(marker, marker + '<a class="tactical-mode-home" href="./">ATC SUITE</a>');
    } else if (page === 'training-centre.html') {
      const marker = '<div class="header-links">';
      if (!html.includes(marker)) throw new Error('Missing Training Centre header for Pages suite link');
      html = html.replace(marker, marker + '<a class="back-link" href="./">ATC Suite</a>');
    }
    await writeFile(path,html);
  }
  for (const page of ['index.html','instructor.html','student.html','training-guide.html']) {
    const path = resolve(outputRoot,'instructor-led',page);
    let html = await readFile(path,'utf8');
    html = html.replace("connect-src 'self';", "connect-src 'self' https://yigmtmdrqpufdwvzswjd.supabase.co;");
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
      .replace('REDS · PROCEDURAL TRAINING','ATC · PROCEDURAL TRAINING')
      .replace('</head>',`<script defer src="../suite-landing-register.js?release=${manifest.version}"></script></head>`);
    await writeFile(path,html);
  }
  await buildSuiteGuides(outputRoot, root, manifest.version);
  // One guide/assistant source serves every GitHub Pages branch.
  for (const [page, prefix] of [
    ...['index.html','qgh.html','single.html','tactical.html','training-centre.html','user-guide.html'].map(page => [page, 'procedural-beta/']),
    ...['index.html','instructor.html','student.html','training-guide.html'].map(page => ['instructor-led/' + page, '../procedural-beta/']),
  ]) {
    const path = resolve(outputRoot,page); let html = await readFile(path,'utf8');
    if (!html.includes('suite-guide-chat.js')) html = html.replace('</head>', `<link rel="stylesheet" href="${prefix}suite-guide-chat.css"><script defer src="${prefix}guide-knowledge.js"></script><script defer src="${prefix}guide-search.js"></script><script defer src="${prefix}suite-guide-chat.js"></script></head>`);
    await writeFile(path,html);
  }
  for (const page of ['single.html','tactical.html','instructor-led/instructor.html','instructor-led/student.html','procedural-beta/index.html','procedural-beta/procedural.html']) {
    const prefix = page.startsWith('procedural-beta/') ? '' : page.includes('/') ? '../procedural-beta/' : 'procedural-beta/';
    const path = resolve(outputRoot,page);
    const html = await readFile(path,'utf8');
    await writeFile(path,html.replace('</head>',`<link rel="stylesheet" href="${prefix}suite-tour.css"><script defer src="${prefix}suite-tour.js"></script></head>`));
  }
  const manifestPath = resolve(outputRoot,'manifest.webmanifest');
  await buildEntryTheme(outputRoot, root, manifest.version);
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
  // A new cache version must revalidate its files instead of copying the
  // previous deployment out of the browser's HTTP cache.
  const freshPrecache = source => {
    if (!source.includes('cache.addAll(APP_SHELL)')) throw new Error('Missing app-shell installation');
    return source.replace('cache.addAll(APP_SHELL)', "cache.addAll(APP_SHELL.map(asset => new Request(new URL(asset, self.registration.scope), {cache: 'reload'})))");
  };
  sw = freshPrecache(sw);
  sw = sw.replace(/(const CACHE_NAME = `[^`]+)(`;)/, `$1-suite-${manifest.version}$2`);
  sw = sw.replace("  './index.html',","  './index.html',\n  './qgh.html',\n  './suite-landing.css',\n  './suite-landing-register.js',\n  './hero-airspace.png',\n  './qgh-towers.png',\n  './procedural-airspace.png',\n  './aircraft-icon.png',\n  './instructor-icon.png',");
  sw = sw.replace("['./', './index.html', './user-guide.html'","['./', './index.html', './qgh.html', './user-guide.html'");
  if (!sw.includes("'./qgh.html'") || !sw.includes("'./suite-landing.css'")) throw new Error('QGH offline suite shell was not updated');
  // The assistant assets are shared, cacheable and never fetch an AI service.
  sw = sw.replace("  './qgh.html',", "  './qgh.html',\n  './procedural-beta/guide-knowledge.js',\n  './procedural-beta/suite-guide-chat.js',\n  './procedural-beta/suite-guide-chat.css',\n  './procedural-beta/gyani-fox.png',");
  const proceduralShell = [...manifest.files.filter(file => file.path.startsWith('static/')).map(file => './procedural-beta/' + file.path.slice(7)), './procedural-beta/index.html', './procedural-beta/'];
  const uncached = proceduralShell.filter(path => !sw.includes(`'${path}'`));
  sw = sw.replace('const APP_SHELL = [', 'const APP_SHELL = [\n' + uncached.map(path => `  '${path}',`).join('\n'));
  sw = sw.replace('const APP_SHELL = [', "const APP_SHELL = [\n  './flow-theme.css',\n  './qgh-cloudbreak.png',");
  if (uncached.length && !sw.includes(`'${uncached[0]}'`)) throw new Error('Procedural offline shell was not updated');
  sw = sw.replace("['./', './index.html', './qgh.html'", "['./procedural-beta/', './procedural-beta/index.html', './procedural-beta/procedural.html', './procedural-beta/procedural-guide.html', './', './index.html', './qgh.html'");
  sw = sw.replace('  if (requestUrl.search) {', `  const proceduralRoot = new URL('./procedural-beta/', self.registration.scope).pathname;
  const isRoomWorker = requestUrl.pathname === proceduralRoot + 'browser-worker.js'
    && [...requestUrl.searchParams.keys()].every(key => key === 'room')
    && /^[a-f0-9-]{36}$/.test(requestUrl.searchParams.get('room') || '');
  const isControllerPage = [proceduralRoot, proceduralRoot + 'index.html', proceduralRoot + 'procedural.html'].includes(requestUrl.pathname)
    && [...requestUrl.searchParams.keys()].every(key => ['position','connection'].includes(key))
    && requestUrl.searchParams.get('position') === 'student'
    && ['online','local',null].includes(requestUrl.searchParams.get('connection'));
  const isSuiteAsset = [new URL('./flow-theme.css', self.registration.scope).pathname, new URL('./suite-landing-register.js', self.registration.scope).pathname].includes(requestUrl.pathname)
    && requestUrl.search === '?release=${manifest.version}';
  if (requestUrl.search && !isRoomWorker && !isControllerPage && !isSuiteAsset) {`);
  await writeFile(swPath,sw);
  const instructorSWPath = resolve(outputRoot,'instructor-led/service-worker.js');
  let instructorSW = await readFile(instructorSWPath,'utf8');
  instructorSW = instructorSW.replace('const APP_SHELL = [', "const APP_SHELL = [\n  '../flow-theme.css',\n  '../qgh-cloudbreak.png',\n  '../qgh-towers.png',\n  '../hero-airspace.png',\n  '../fonts/ibm-plex-sans-400.ttf',\n  '../fonts/ibm-plex-sans-600.ttf',\n  '../fonts/ibm-plex-mono-500.ttf',\n  '../suite-landing-register.js',");
  instructorSW = instructorSW.replace('  if (requestUrl.search) {', `  const isSuiteAsset = [new URL('../flow-theme.css', self.registration.scope).pathname, new URL('../suite-landing-register.js', self.registration.scope).pathname].includes(requestUrl.pathname)
    && requestUrl.search === '?release=${manifest.version}';
  if (requestUrl.search && !isSuiteAsset) {`);
  instructorSW = freshPrecache(instructorSW);
  instructorSW = instructorSW.replace(/(const CACHE_NAME = `[^`]+)(`;)/, `$1-guide-${manifest.version}$2`)
    .replace("  './suite.css',", "  './suite.css',\n  '../procedural-beta/guide-knowledge.js',\n  '../procedural-beta/guide-search.js',\n  '../procedural-beta/current-flow-guide.css',\n  '../procedural-beta/suite-guide-chat.js',\n  '../procedural-beta/suite-guide-chat.css',\n  '../procedural-beta/gyani-fox.png',\n  '../procedural-beta/suite-tour.js',\n  '../procedural-beta/suite-tour.css',");
  await writeFile(instructorSWPath,instructorSW);
  console.log(`Built GitHub-only ATC Training Suite with Procedural Beta ${manifest.version}`);
}
