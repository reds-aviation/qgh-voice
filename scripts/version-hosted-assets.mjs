import {readFile, readdir, writeFile} from 'node:fs/promises';
import {relative, resolve} from 'node:path';

const assetExtension = /\.(?:css|m?js|wasm|json)$/i;
const stableWorker = /(?:^|\/)(?:service-worker|browser-worker)\.js$/;
const integrityManaged = /^(?:pilot-voices\/|vendor\/pilot-tts\/)/;

function safeRevision(revision) {
  if (!/^[a-z0-9][a-z0-9.+-]{0,79}$/i.test(revision)) throw new Error('Invalid hosted asset revision.');
  return revision;
}

// Existing workers and their room names are lifetime identities, not hot-swap
// targets. Their imports/WASM are qualified when a fresh worker is loaded.
export async function versionHostedAssets(outputRoot, revision) {
  safeRevision(revision);
  const root = resolve(outputRoot), files = [];
  async function inventory(directory) {
    for (const entry of await readdir(directory, {withFileTypes:true})) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await inventory(path);
      else if (entry.isFile()) files.push(relative(root, path).replaceAll('\\', '/'));
    }
  }
  await inventory(root);
  const assets = new Set(files.filter(path => assetExtension.test(path) && !integrityManaged.test(path)));
  function qualify(reference, emitter) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(reference)) return reference;
    const url = new URL(reference, 'https://suite-build.invalid/' + emitter);
    const target = url.pathname.slice(1);
    if (!assets.has(target) || stableWorker.test(target)) return reference;
    url.searchParams.set('release', revision);
    return reference.split(/[?#]/, 1)[0] + url.search + url.hash;
  }
  for (const file of files) {
    if (!/\.(?:html|css|m?js)$/i.test(file) || /(?:^|\/)service-worker\.js$/.test(file) || integrityManaged.test(file)) continue;
    const path = resolve(root, file), original = await readFile(path, 'utf8');
    let updated;
    if (file.endsWith('.html')) {
      updated = original.replace(/\b(src|href)=(['"])([^'"\r\n]+)\2/g, (all, attribute, quote, value) => {
        const qualified = qualify(value.replaceAll('&amp;', '&'), file);
        return `${attribute}=${quote}${qualified.replaceAll('&', '&amp;')}${quote}`;
      });
    } else {
      updated = original.replace(/(['"])([^'"\r\n]+?\.(?:m?js|css|wasm|json)(?:[?#][^'"\r\n]*)?)\1/g, (all, quote, value, offset) => {
        // Built UMD files remain loadable by Node as well as browser scripts.
        if (/\brequire\s*\(\s*$/.test(original.slice(Math.max(0, offset - 30), offset))) return all;
        return quote + qualify(value, file) + quote;
      });
    }
    if (updated !== original) await writeFile(path, updated, 'utf8');
  }
}

// The path/method/origin allowlist runs before this query check. Only the exact
// current revision can use its query-free offline shell entry; an older worker
// must let a new release reach the network rather than supply old cached code.
export function releaseQueryGuard(revision) {
  safeRevision(revision);
  return `const isSuiteAsset = !PAGE_SHELL_PATHS.has(requestUrl.pathname)
    && /\\.(?:css|m?js|wasm|json)$/i.test(requestUrl.pathname)
    && !/(?:^|\\/)(?:service-worker|browser-worker)\\.js$/.test(requestUrl.pathname)
    && !/(?:^|\\/)(?:pilot-voices\\/|vendor\\/pilot-tts\\/)/.test(requestUrl.pathname)
    && requestUrl.searchParams.get('release') === '${revision}'
    && [...requestUrl.searchParams.keys()].length === new Set(requestUrl.searchParams.keys()).size
    && [...requestUrl.searchParams.keys()].every(key => ['v', 'release'].includes(key))
    && (!requestUrl.searchParams.has('v') || requestUrl.searchParams.get('v') === APP_VERSION);`;
}
