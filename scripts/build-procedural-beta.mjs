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
  const homePath = resolve(outputRoot,'index.html');
  let home = await readFile(homePath,'utf8');
  const marker = '      <div class="entry-credit">';
  if (!home.includes(marker)) throw new Error('Missing QGH header insertion point');
  home = home.replace(marker, `      <nav class="entry-beta-links" aria-label="Instructor training"><a href="instructor-led/index.html">Instructor <span>Beta</span></a><a class="procedural-beta-link" href="procedural-beta/">Procedural <span>Beta</span></a></nav>\n${marker}`);
  home = home.replace('</head>','<link rel="stylesheet" href="pages-beta.css?v=5.0.5&amp;release=5.0.5"></head>');
  await writeFile(homePath,home);
  await writeFile(resolve(outputRoot,'pages-beta.css'),'.entry-beta-links{margin-left:auto;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.entry-beta-links a{display:flex;align-items:center;gap:8px;padding:11px 15px;border:1px solid #c8dfdd;border-radius:9px;color:#075d60;background:#f4fbfa;text-decoration:none;font:600 13px "IBM Plex Sans",sans-serif}.entry-beta-links span{text-transform:uppercase;font-size:9px;letter-spacing:.08em;background:#d6eeeb;padding:3px 5px;border-radius:4px}.entry-beta-links .procedural-beta-link{background:#075d60;color:#fff;border-color:#075d60}.procedural-beta-link span{color:#06484b}.entry-beta-links a:hover{outline:2px solid #279f99;outline-offset:2px}.entry-beta-links a:focus-visible{outline:3px solid #bc7400;outline-offset:3px}.entry-header{gap:22px}@media(max-width:720px){.entry-header{flex-wrap:wrap}.entry-beta-links{order:3;width:100%;margin-left:0}.entry-beta-links a{flex:1;justify-content:center}.entry-credit{margin-left:auto}}');
  const swPath = resolve(outputRoot,'service-worker.js');
  let sw = await readFile(swPath,'utf8');
  sw = sw.replace(/(const CACHE_NAME = `[^`]+)(`;)/, '$1-procedural-1$2');
  sw = sw.replace("  './entry.css',","  './entry.css',\n  './pages-beta.css',");
  await writeFile(swPath,sw);
  console.log(`Built GitHub-only Procedural Beta ${manifest.version}`);
}
