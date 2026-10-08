import {copyFile, mkdir, readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = root => [
  resolve(root, 'packages/qgh-engine/scope-visuals.js'),
  resolve(root, 'packages/procedural-beta/static/scope-visuals.js'),
];

export async function verifyProceduralScopeVisuals(root = repositoryRoot) {
  const [canonical, managed] = paths(root);
  let copy;
  try { copy = await readFile(managed); }
  catch { throw new Error('Missing Procedural scope-visuals.js. Run scripts/sync-procedural-scope-visuals.mjs, then refresh its manifest hash.'); }
  if (!(await readFile(canonical)).equals(copy)) {
    throw new Error('Procedural scope-visuals.js differs from its QGH source. Run scripts/sync-procedural-scope-visuals.mjs, then refresh its manifest hash.');
  }
}

export async function syncProceduralScopeVisuals(root = repositoryRoot) {
  const [canonical, managed] = paths(root);
  await mkdir(dirname(managed), {recursive:true});
  await copyFile(canonical, managed);
  await verifyProceduralScopeVisuals(root);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await syncProceduralScopeVisuals();
  console.log('Synced Procedural scope visuals from the canonical QGH helper. Refresh the Procedural manifest hash before building.');
}
